import { Command, Ctx, Hears, On, Scene, SceneEnter } from 'nestjs-telegraf';
import { SCENES } from '../../../../constants';
import { BaseExtendScene } from '../../domain/BaseScene';
import { PrismaService } from '../../../../services/prisma/prisma.service';
import { IContext } from '../../domain/iSceneContext';
import { Markup } from 'telegraf';
import { TEXT } from '../../text';
import {
  generateButtonsWithNameAndId,
  getMonthName,
  isNumeric,
} from '../../../../helpers';

const text = TEXT.PLAN;

@Scene(SCENES.PLAN_MENU)
export class PlanMenuScene extends BaseExtendScene {
  CREATE: string = 'create';
  CREATE_NEXT: string = 'create-next';
  EDIT: string = 'edit_';
  editedPlanId: number;
  editedCategoryId: number;

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  @Command('start')
  async onStart(@Ctx() ctx: IContext) {
    await ctx.scene.enter(SCENES.MAIN);
  }

  @SceneEnter()
  async _enterScene(@Ctx() ctx: IContext) {
    await ctx.reply(
      TEXT.CORE.WHAT_YOU_WANT,
      Markup.keyboard(
        [Markup.button.text(text.CURRENT), Markup.button.text(text.NEXT)],
        { columns: 2 },
      )
        .resize(true)
        .placeholder(TEXT.CORE.WHAT_YOU_WANT),
    );
  }

  @Hears(text.CURRENT)
  async _onCurrentPlan(@Ctx() ctx: IContext) {
    const firstDayOfMonth = new Date(new Date().setDate(1));
    firstDayOfMonth.setHours(0, 0, 0, 0); // Устанавливаем время на 00:00:00

    const nextMonth = new Date(firstDayOfMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setHours(0, 0, 0, 0); // Устанавливаем время на 00:00:00 для первого дня следующего месяца

    const currentMonthPlan = await this.prisma.plan.findFirst({
      where: {
        monthDateTime: {
          gte: firstDayOfMonth, // Дата больше или равна первому дню текущего месяца
          lt: nextMonth, // Дата меньше первого дня следующего месяца
        },
      },
      include: {
        CategoryPlan: true,
      },
    });

    if (!currentMonthPlan) {
      await ctx.reply(
        text.NO_CURRENT,
        Markup.inlineKeyboard([
          Markup.button.callback(text.CREATE, this.CREATE),
        ]),
      );

      return;
    }

    const str = await this.getCategoryPlanSummary(currentMonthPlan.id);

    await ctx.replyWithHTML(
      `План на <b>${currentMonthPlan.name}</b>: \n\n ${str}`,
      this.generateEditButton(currentMonthPlan.id),
    );
  }

  // @todo не может найти план на след месяц
  @Hears(text.NEXT)
  async _onNextPlan(@Ctx() ctx: IContext) {
    // Первый день следующего месяца
    const firstDayOfNextMonth = new Date();
    firstDayOfNextMonth.setMonth(new Date().getMonth() + 1, 1);
    firstDayOfNextMonth.setHours(0, 0, 0, 0); // Устанавливаем время на 00:00:00.000

    // Первый день месяца, который идёт после следующего (без времени)
    const firstDayOfMonthAfterNext = new Date(firstDayOfNextMonth);
    firstDayOfMonthAfterNext.setMonth(firstDayOfNextMonth.getMonth() + 1);
    firstDayOfMonthAfterNext.setHours(0, 0, 0, 0); // Устанавливаем время на 00:00:00.000

    // Запрос на план за следующий месяц
    const nextMonthPlan = await this.prisma.plan.findFirst({
      where: {
        monthDateTime: {
          gte: firstDayOfNextMonth, // Дата больше или равна первому дню следующего месяца
          lt: firstDayOfMonthAfterNext, // Дата меньше первого дня месяца после следующего
        },
      },
      include: {
        CategoryPlan: true,
      },
    });

    if (!nextMonthPlan) {
      await ctx.reply(
        text.NO_NEXT_PLAN,
        Markup.inlineKeyboard([
          Markup.button.callback(text.CREATE_NEXT, this.CREATE_NEXT),
        ]),
      );

      return;
    }

    const str = await this.getCategoryPlanSummary(nextMonthPlan.id);

    await ctx.replyWithHTML(
      `План на <b>${nextMonthPlan.name}</b>: \n\n ${str}`,
      this.generateEditButton(nextMonthPlan.id),
    );
  }

  @On('callback_query')
  async _onCallback(@Ctx() ctx: IContext) {
    const answer = ctx.update.callback_query.data;

    // Нажали на кнопку Создать
    if (answer === this.CREATE) {
      const currentDate = new Date();
      const monthName = getMonthName(currentDate.getMonth() + 1); // Учитываем 0-индексацию месяцев
      const year = currentDate.getFullYear();

      await this.createPlan(ctx, monthName, year, currentDate);
      return;
    } else if (answer === this.CREATE_NEXT) {
      const nextMonthDate = new Date();
      nextMonthDate.setMonth(nextMonthDate.getMonth() + 1, 1); // Следующий месяц
      const monthName = getMonthName(nextMonthDate.getMonth() + 1); // Учитываем 0-индексацию месяцев
      const year = nextMonthDate.getFullYear();

      await this.createPlan(ctx, monthName, year, nextMonthDate);
      return;
    }

    // Нажали на кнопку Редактировать
    if (answer.startsWith(this.EDIT)) {
      await ctx.deleteMessage();
      const planId = answer.replace(this.EDIT, '');
      this.editedPlanId = Number(planId);

      const { text, markup } = await this.getEditMessage(this.editedPlanId);

      await ctx.replyWithHTML(text, markup);

      return;
    }

    // Редактирование плана категорий
    if (this.editedPlanId && answer) {
      await ctx.editMessageReplyMarkup({
        inline_keyboard: [],
      });
      this.editedCategoryId = Number(answer);

      await ctx.replyWithHTML(
        'Введи сумму, которую планируешь потратить на эту категорию <b>($)</b>: ',
      );
    }
  }

  @On('text')
  async onText(@Ctx() ctx: IContext) {
    if (this.editedCategoryId && this.editedPlanId) {
      const text = ctx.message.text;

      const isNumber = isNumeric(text);

      if (!isNumber) {
        await ctx.reply('Введенное значение должно быть числом ($)');
        return;
      }

      try {
        await this.prisma.categoryPlan.updateMany({
          where: {
            categoryId: this.editedCategoryId,
            planId: this.editedPlanId,
          },
          data: {
            amount: Number(text),
          },
        });

        await ctx.reply('План на категорию изменен успешно!');
        const { text: messageText, markup } = await this.getEditMessage(
          this.editedPlanId,
        );

        await ctx.replyWithHTML(messageText, markup);
        return;
      } catch (e) {
        await ctx.reply('Произошла ошибка:', e);
        return;
      } finally {
        this.editedCategoryId = undefined;
      }
    }

    this.editedCategoryId = undefined;
    this.editedPlanId = undefined;

    await ctx.reply('Произошла ошибка, начните заново с выбора плана: ');
  }

  async getEditMessage(planId: number) {
    const summary = await this.getCategoryPlanSummary(Number(planId));

    const categories = await this.prisma.category.findMany();

    return {
      text: `${summary}\n\n<b>Выберите категорию для редактирования, затем введите число ($)</b>`,
      markup: generateButtonsWithNameAndId(categories),
    };
  }

  // Функция для создания плана
  async createPlan(
    ctx: IContext,
    monthName: string,
    year: number,
    monthDate: Date,
  ) {
    const plan = await this.prisma.plan.create({
      data: {
        name: `${monthName} ${year}`,
        monthDateTime: monthDate,
      },
    });

    // Получаем список категорий
    const categoriesIds = await this.getCategoryIds();

    // Массив данных для записи в таблицу CategoryPlan
    const categoryPlanData = categoriesIds.map((categoryId) => ({
      categoryId: categoryId.id,
      planId: plan.id,
      amount: 0,
    }));

    // Создаем записи для каждой категории
    await this.prisma.categoryPlan.createMany({
      data: categoryPlanData,
    });

    const str = await this.getCategoryPlanSummary(plan.id);

    await ctx.replyWithHTML(
      `План на <b>${plan.name}</b> создан:\n\n ${str}`,
      this.generateEditButton(plan.id),
    );
  }

  // Вспомогательная функция для получения списка категорий
  async getCategoryIds() {
    return this.prisma.category.findMany({
      select: {
        id: true,
      },
    });
  }

  generateEditButton(planId: number) {
    return Markup.inlineKeyboard([
      Markup.button.callback(text.EDIT, this.EDIT + planId),
    ]);
  }

  async getCategoryPlanSummary(planId: number): Promise<string> {
    // Получаем все записи из таблицы categoryPlan для указанного плана, включая связанные категории
    const categoryPlans = await this.prisma.categoryPlan.findMany({
      where: {
        planId: planId, // Фильтруем по плану
      },
      include: {
        category: true, // Включаем связанные категории, чтобы получить их названия
      },
    });

    // Формируем строку с итогами
    let summary = '';

    categoryPlans.forEach((categoryPlan) => {
      const categoryName = categoryPlan.category.name; // Название категории
      const amount = categoryPlan.amount; // Сумма
      summary += `<b>${categoryName}</b>: ${amount}$\n`;
    });

    return summary;
  }
}
