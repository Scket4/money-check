// spending-menu.scene.ts

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
import * as fs from 'fs';
import { SpendingService } from '../../../../api/spending/spending.service';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { TSpendingByMonthByCategories } from '../../../../api/spending/domain/types';

const text = TEXT.SPENDING;

@Scene(SCENES.SPENDING_MENU)
export class SpendingMenuScene extends BaseExtendScene {
  constructor(
    readonly prisma: PrismaService,
    @InjectBot() bot: Telegraf,
    readonly spendingService: SpendingService,
  ) {
    super(prisma, bot);
    this.setDateListener(this.onDateSelected.bind(this));
  }

  @Action(/calendar-.+/)
  async onCalendarAction(@Ctx() ctx: IContext) {
    await this.calendar.handleAction(ctx);
  }

  async onDateSelected(ctx: IContext, date: string) {
    await ctx.deleteMessage();
    const { actionType } = ctx.session.state;

    switch (actionType) {
      case 'spending_month':
        await this.handleSpendingMonth(ctx, date);
        break;
      case 'plan':
        await this.handlePlan(ctx, date);
        break;
      default:
        await this.handleCustomDateRange(ctx, date);
        break;
    }

    ctx.session.state.actionType = null;
  }

  @SceneEnter()
  async _enterScene(@Ctx() ctx: IContext) {
    await ctx.reply(
      TEXT.CORE.WHAT_YOU_WANT,
      Markup.inlineKeyboard([
        Markup.button.webApp(
          'Открыть Web App',
          'https://88f4-2800-810-470-9346-f42c-5b64-983f-bcc.ngrok-free.app/list',
        ),
      ]),
    );
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
        .resize()
        .placeholder(TEXT.CORE.WHAT_YOU_WANT),
    );
  }

  @Hears(text.MONTH)
  async _onMonthSpending(@Ctx() ctx: IContext) {
    ctx.session.state.actionType = 'spending_month';
    await ctx.reply('Выберите дату:', this.calendar.getCalendar());
  }

  @Hears(text.PLAN)
  async _getPlanSum(@Ctx() ctx: IContext) {
    ctx.session.state.actionType = 'plan';
    await ctx.reply('Выберите дату:', this.calendar.getCalendar());
  }

  @Hears(text.SPENDING)
  async _getSpendingByRange(@Ctx() ctx: IContext) {
    ctx.session.state.spendingRange = {};
    await this.showRangeOptions(ctx);
  }

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

  @Action(/spending_range_.+/)
  async handleRangeSelection(@Ctx() ctx: IContext) {
    const action = ctx.update.callback_query.data;
    await ctx.deleteMessage();

    const { startDate, endDate } = this.calculateDateRange(action);

    if (!startDate || !endDate) {
      ctx.session.state.spendingRange = {};
      await ctx.reply('Выберите начальную дату:', this.calendar.getCalendar());
      return;
    }

    await ctx.answerCbQuery();
    await this.showSpending(ctx, startDate, endDate);
  }

  calculateDateRange(action: string): { startDate: Date; endDate: Date } {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const endDate = new Date(today);
    endDate.setUTCHours(23, 59, 59, 999);

    const startDate = new Date(today);

    const ranges = {
      spending_range_today: 0,
      spending_range_3_days: -2,
      spending_range_5_days: -4,
      spending_range_week: -6,
      spending_range_2_weeks: -13,
      spending_range_month: -30,
    };

    if (action in ranges) {
      startDate.setDate(today.getDate() + ranges[action]);
      return { startDate, endDate };
    }

    return { startDate: null, endDate: null };
  }

  async handleSpendingMonth(ctx: IContext, date: string) {
    const { month, year } = this.extractMonthAndYear(date);
    await this.getSpendingByMonth(ctx, month, year);
  }

  async handlePlan(ctx: IContext, date: string) {
    const { month, year } = this.extractMonthAndYear(date);
    await this.getPlanByMonth(ctx, month, year);
  }

  async handleCustomDateRange(ctx: IContext, date: string) {
    const { spendingRange } = ctx.session.state;

    if (!spendingRange.startDate) {
      spendingRange.startDate = date;
      await ctx.deleteMessage();
      await ctx.reply(
        `Начальная дата выбрана: ${date}. Выберите конечную дату:`,
        this.calendar.getCalendar(),
      );
    } else {
      spendingRange.endDate = date;
      await ctx.deleteMessage();

      if (spendingRange.startDate > spendingRange.endDate) {
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

      await this.showSpending(
        ctx,
        new Date(spendingRange.startDate),
        new Date(spendingRange.endDate),
      );
    }
  }

  extractMonthAndYear(date: string): { month: number; year: number } {
    const selectedDate = new Date(date);
    return {
      month: selectedDate.getMonth(),
      year: selectedDate.getFullYear(),
    };
  }

  async showSpending(ctx: IContext, startDate: Date, endDate: Date) {
    const spendings = await this.fetchSpendings(startDate, endDate);

    if (spendings.length === 0) {
      await ctx.reply('За выбранный период трат не найдено.');
      return;
    }

    const data = this.prepareSpendingData(spendings);
    const columns = this.getSpendingColumns();
    const title = `Траты с ${format(startDate, 'dd.MM.yyyy')} по ${format(
      endDate,
      'dd.MM.yyyy',
    )}`;
    const filePath = './src/helpers/files/spending_report.pdf';

    await generateSpendingPDF(data, title, columns, filePath);
    await ctx.replyWithDocument({
      source: filePath,
      filename: 'spending_report.pdf',
    });
    fs.unlinkSync(filePath);
  }

  async fetchSpendings(startDate: Date, endDate: Date) {
    return this.prisma.spending.findMany({
      where: { datetime: { gte: startDate, lte: endDate } },
      include: { category: true },
      orderBy: { datetime: 'asc' },
    });
  }

  prepareSpendingData(spendings) {
    return spendings.map((spending) => ({
      date: format(spending.datetime, 'dd.MM.yyyy'),
      category: spending.category.name,
      amount: spending.amount.toFixed(2) + '$',
      comment: spending.comment || '-',
    }));
  }

  getSpendingColumns() {
    return [
      { label: 'Дата', id: 'date', width: 100 },
      { label: 'Категория', id: 'category', width: 100 },
      { label: 'Сумма', id: 'amount', width: 100 },
      { label: 'Комментарий', id: 'comment', width: 100 },
    ];
  }

  generateSpendingReport(
    spendingByCategory: TSpendingByMonthByCategories[],
    date: string,
  ) {
    let amount = 0;
    const reportLines = spendingByCategory.map((item) => {
      amount += item.totalAmount;
      return `<b>${item.categoryName}</b>: ${item.totalAmount}$`;
    });

    return `<b>Траты за ${date} по категориям:</b>\n\n${reportLines.join('\n')}\n\nСумма: ${amount.toFixed()}$`;
  }

  async getSpendingByMonth(ctx: IContext, month: number, year: number) {
    const result = await this.spendingService.getSpendingByMonthByCategories({
      month,
      year,
    });
    const formattedDate = format(new Date(year, month), 'LLLL yyyy', {
      locale: ru,
    });

    if (!result.length) {
      await ctx.reply(`Трат за ${formattedDate} не найдено`);
      return;
    }

    const report = this.generateSpendingReport(result, formattedDate);
    await ctx.replyWithHTML(report);
  }

  async getPlanByMonth(ctx: IContext, month: number, year: number) {
    const plan = await this.fetchPlanForMonth(month, year);

    if (!plan) {
      await ctx.reply('План на выбранный месяц не найден.');
      return;
    }

    const spendingByCategory =
      await this.spendingService.getAmountSpendingByMonth({
        month,
        year,
      });

    const report = this.generatePlanReport(
      plan,
      spendingByCategory,
      month,
      year,
    );
    await ctx.replyWithHTML(report);
  }

  async fetchPlanForMonth(month: number, year: number) {
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 1);

    return this.prisma.plan.findFirst({
      where: { monthDateTime: { gte: startOfMonth, lt: endOfMonth } },
      include: {
        CategoryPlan: { include: { category: true } },
      },
    });
  }

  generatePlanReport(plan, spendingByCategory, month: number, year: number) {
    const spendingMap = spendingByCategory.reduce((acc, spend) => {
      acc[spend.categoryId] = spend._sum.amount;
      return acc;
    }, {});

    const rows = plan.CategoryPlan.map((categoryPlan) => {
      const categoryName = categoryPlan.category.name;
      const plannedAmount = categoryPlan.amount;
      const actualSpending = spendingMap[categoryPlan.categoryId] || 0;
      const remainder = plannedAmount - actualSpending;
      return { categoryName, remainder };
    });

    const formattedDate = format(new Date(year, month), 'LLLL yyyy', {
      locale: ru,
    });
    const reportLines = rows.map(({ categoryName, remainder }) => {
      const statusIcon = remainder >= 0 ? '✅' : '❌';
      return `${statusIcon} <b>${categoryName}</b>: ${remainder.toFixed(0)}$`;
    });

    return `<b>Остаток на ${formattedDate}:</b>\n\n${reportLines.join('\n')}`;
  }
}
