import {
  Action,
  Ctx,
  Hears,
  InjectBot,
  Scene,
  SceneEnter,
} from 'nestjs-telegraf';
import { SCENES } from '../../../../constants';
import { BaseExtendScene } from '../../domain/BaseScene';
import { PrismaService } from '../../../../services/prisma/prisma.service';
import { IContext } from '../../domain/iSceneContext';
import { Markup, Telegraf } from 'telegraf';
import { TEXT } from '../../text';
import { generateSpendingPDF } from '../../../../helpers/pdfGenerator';
import * as fs from 'node:fs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Calendar = require('telegraf-calendar-telegram');

const text = TEXT.SPENDING;

@Scene(SCENES.SPENDING_MENU)
export class SpendingMenuScene extends BaseExtendScene {
  calendar: typeof Calendar;
  constructor(
    readonly prisma: PrismaService,
    @InjectBot() bot: Telegraf,
  ) {
    super(prisma, bot);
    // Инициализация календаря
    this.calendar = new Calendar(this.bot, {
      startWeekDay: 1,
      weekDayNames: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
      monthNames: [
        'Январь',
        'Февраль',
        'Март',
        'Апрель',
        'Май',
        'Июнь',
        'Июль',
        'Август',
        'Сентябрь',
        'Октябрь',
        'Ноябрь',
        'Декабрь',
      ],
      minDate: null,
      maxDate: null,
      dateFormat: 'DD.MM.YYYY',
    });

    // Устанавливаем обработчик выбора даты
    this.calendar.setDateListener(this.onDateSelected.bind(this));
  }

  // Обработчик клика по календарю
  @Action(/calendar-.+/)
  async onCalendarAction(@Ctx() ctx: IContext) {
    await this.calendar.handleAction(ctx);
  }

  async onDateSelected(ctx: IContext, date: string) {
    if (!ctx.session.state.spendingRange.startDate) {
      ctx.session.state.spendingRange.startDate = date;
      await ctx.deleteMessage();
      await ctx.reply(
        `Начальная дата выбрана: ${date}. Выберите конечную дату:`,
        this.calendar.getCalendar(),
      );
    } else {
      ctx.session.state.spendingRange.endDate = date;
      await ctx.deleteMessage();

      const startDate = new Date(ctx.session.state.spendingRange.startDate);
      const endDate = new Date(ctx.session.state.spendingRange.endDate);
      if (startDate > endDate) {
        await ctx.reply(
          'Начальная дата не может быть позже конечной. Попробуйте снова.',
        );
        ctx.session.state.spendingRange = {};
        await ctx.reply(
          'Выберите начальную дату:',
          this.calendar.getCalendar(),
        );
        return;
      }
      await this.showSpending(ctx, startDate, endDate);
    }
  }

  @SceneEnter()
  async _enterScene(@Ctx() ctx: IContext) {
    await ctx.reply(
      TEXT.CORE.WHAT_YOU_WANT,
      Markup.keyboard(
        [
          Markup.button.text(text.MONTH),
          Markup.button.text(text.PLAN),
          Markup.button.text(text.SPENDING),
        ],
        { columns: 2 },
      )
        .resize(true)
        .placeholder(TEXT.CORE.WHAT_YOU_WANT),
    );
  }

  @Hears(text.MONTH)
  async _onMonthSpending(@Ctx() ctx: IContext) {
    const spendingByCategory = await this.prisma.spending.groupBy({
      by: ['categoryId'], // Группируем по категории
      where: {
        datetime: {
          gte: new Date(new Date().setDate(1)), // Фильтрация по текущему месяцу
        },
      },
      _sum: {
        amount: true, // Суммируем поле `amount` для каждой категории
      },
    });

    const categoryIds = spendingByCategory.map((item) => item.categoryId);

    const categories = await this.prisma.category.findMany({
      where: {
        id: {
          in: categoryIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const result = spendingByCategory.map((item) => {
      const category = categories.find((cat) => cat.id === item.categoryId);
      return {
        categoryId: item.categoryId,
        categoryName: category ? category.name : 'Unknown',
        totalAmount: item._sum.amount,
      };
    });

    const str = this.generateSpendingReport(result);

    await ctx.replyWithHTML(str);
  }

  @Hears(text.PLAN)
  async _getPlanSum(@Ctx() ctx: IContext) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(5, 0, 0, 0);

    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    // Retrieve the plan for the current month
    const plan = await this.prisma.plan.findFirst({
      where: {
        monthDateTime: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
      },
      include: {
        CategoryPlan: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!plan) {
      await ctx.reply('План на текущий месяц не найден.');
      return;
    }

    // Get actual spendings per category for the current month
    const spendingByCategory = await this.prisma.spending.groupBy({
      by: ['categoryId'],
      where: {
        datetime: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
      },
      _sum: {
        amount: true,
      },
    });

    // Map actual spendings per category
    const spendingMap = {};
    spendingByCategory.forEach((spend) => {
      spendingMap[spend.categoryId] = spend._sum.amount;
    });

    // Prepare data for the table
    const rows = plan.CategoryPlan.map((categoryPlan) => {
      const categoryName = categoryPlan.category.name;
      const plannedAmount = categoryPlan.amount;
      const actualSpending = spendingMap[categoryPlan.categoryId] || 0;
      const remainder = plannedAmount - actualSpending;
      return {
        categoryName,
        remainder,
      };
    });

    const today = new Date().toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
    });

    let message = `<b>Остаток на : ${today}</b>\n\n`;

    rows.forEach((row) => {
      const { categoryName, remainder } = row;
      if (remainder >= 0) {
        message += `✅ <b>${categoryName}</b>: ${remainder.toFixed(0)}$\n`;
      } else {
        message += `❌ <b>${categoryName}</b>: ${remainder.toFixed(0)}$\n`;
      }
    });

    await ctx.replyWithHTML(message);
  }

  @Hears(text.SPENDING)
  async _getSpendingByRange(@Ctx() ctx: IContext) {
    ctx.session.state.spendingRange = {};
    await this.showRangeOptions(ctx);
  }

  /**
   * Отображает опции выбора диапазона дат
   */
  async showRangeOptions(ctx: IContext) {
    await ctx.reply(
      'Выберите диапазон дат для отображения трат:',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('За сегодня', 'spending_range_today'),
          Markup.button.callback('За 3 дня', 'spending_range_3_days'),
        ],
        [
          Markup.button.callback('За 5 дней', 'spending_range_5_days'),
          Markup.button.callback('За неделю', 'spending_range_week'),
        ],
        [
          Markup.button.callback('За 2 недели', 'spending_range_2_weeks'),
          Markup.button.callback('За месяц', 'spending_range_month'),
        ],
        [Markup.button.callback('Другая дата', 'spending_range_custom')],
      ]),
    );
  }

  /**
   * Обработка выбора диапазона дат
   */
  @Action(/spending_range_.+/)
  async handleRangeSelection(@Ctx() ctx: IContext) {
    const action = ctx.update.callback_query.data;
    await ctx.deleteMessage();

    let startDate: Date;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Устанавливаем в UTC, чтобы избежать локальных смещений

    const endDate = new Date(new Date().setUTCHours(24, 59, 0, 0)); // Устанавливаем в UTC, чтобы избежать локальных смещений

    switch (action) {
      case 'spending_range_today':
        startDate = new Date(today);
        break;
      case 'spending_range_3_days':
        startDate = new Date();
        startDate.setDate(today.getDate() - 2);
        break;
      case 'spending_range_5_days':
        startDate = new Date();
        startDate.setDate(today.getDate() - 4);
        break;
      case 'spending_range_week':
        startDate = new Date();
        startDate.setDate(today.getDate() - 6);
        break;
      case 'spending_range_2_weeks':
        startDate = new Date();
        startDate.setDate(today.getDate() - 13);
        break;
      case 'spending_range_month':
        startDate = new Date();
        startDate.setDate(today.getDate() - 30);
        break;
      case 'spending_range_custom':
        // Запуск выбора дат через календарь
        ctx.session.state.spendingRange = {};
        await ctx.reply(
          'Выберите начальную дату:',
          this.calendar.getCalendar(),
        );
        return;
      default:
        await ctx.answerCbQuery('Неизвестный диапазон.');
        return;
    }

    await ctx.answerCbQuery(); // Закрываем всплывающее уведомление

    // Показываем траты за выбранный диапазон
    await this.showSpending(ctx, startDate, endDate);
  }

  async showSpending(ctx: IContext, startDate: Date, endDate: Date) {
    // Получаем траты из базы данных
    const spendings = await this.prisma.spending.findMany({
      where: {
        datetime: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        category: true,
      },
      orderBy: {
        datetime: 'asc',
      },
    });

    if (spendings.length === 0) {
      await ctx.reply('За выбранный период трат не найдено.');
      return;
    }

    // Подготовка данных
    const maxCommentLength = 30;
    const data = spendings.map((spending) => ({
      date: spending.datetime.toLocaleDateString('ru-RU'),
      category: spending.category.name,
      amount: Number(spending.amount).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }),
      comment: (spending.comment || '-').substring(0, maxCommentLength),
    }));

    // Определяем заголовки и колонки с использованием `id`
    const columns = [
      { label: 'Дата', id: 'date', width: 100 },
      { label: 'Категория', id: 'category', width: 100 },
      { label: 'Сумма', id: 'amount', width: 100 },
      { label: 'Комментарий', id: 'comment', width: 100 },
    ];

    // Генерируем PDF
    const title = `Траты с ${startDate.toLocaleDateString()} по ${endDate.toLocaleDateString()}`;
    const filePath = './src/helpers/files/spending_report.pdf';
    await generateSpendingPDF(data, title, columns, filePath);

    // Отправляем PDF пользователю
    await ctx.replyWithDocument({
      source: filePath,
      filename: 'spending_report.pdf',
    });

    // Удаляем временный файл
    fs.unlinkSync(filePath);
  }

  generateSpendingReport(spendingByCategory: Array<any>) {
    // Начало отчёта
    let report = '<b>Траты за месяц по категориям:</b>\n\n';

    // Формируем строки для каждой категории
    spendingByCategory.forEach((item) => {
      report += `<b>${item.categoryName}</b>: ${item.totalAmount}$\n`;
    });

    return report;
  }
}
