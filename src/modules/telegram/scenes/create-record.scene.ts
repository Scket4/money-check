import { Ctx, Wizard, WizardStep } from 'nestjs-telegraf';
import { SCENES, TYPE } from '../../../constants';
import { IWizardContext } from '../domain/iSceneContext';
import { generateButtonsWithNameAndId, isNumeric } from '../../../helpers';
import { Markup } from 'telegraf';
import { ISubmitData } from '../domain/ISubmitData';
import { BaseExtendScene } from '../domain/BaseScene';
import { TEXT } from '../text';

const text = TEXT.CREATE_RECORD;

@Wizard(SCENES.CREATE_RECORD)
export class CreateRecordScene extends BaseExtendScene {
  NO_COMMENT: string = 'no-comment';

  @WizardStep(1)
  async _firstStep(@Ctx() ctx: IWizardContext) {
    await ctx.reply('Первый шаг', {
      reply_markup: {
        remove_keyboard: true,
      },
    });

    await ctx.reply('Выбери тип:', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Траты', callback_data: TYPE.SPENDING },
            { text: 'Доходы', callback_data: TYPE.INCOME },
          ],
        ],
        input_field_placeholder: 'Выберите опцию:',
      },
    });

    ctx.wizard.next();
  }

  @WizardStep(2)
  async _secondStep(@Ctx() ctx: IWizardContext) {
    await ctx.deleteMessage();
    const type = ctx.update.callback_query.data;
    ctx.session.state.type = type;

    let categories = [];

    if (type === TYPE.SPENDING) {
      categories = await this.prisma.category.findMany();

      await ctx.reply(
        'Выбери категорию',
        generateButtonsWithNameAndId(categories),
      );
      ctx.wizard.next();
      return;
    }

    const sources = await this.prisma.source.findMany();

    await ctx.reply('Выбери источник', generateButtonsWithNameAndId(sources));

    ctx.wizard.next();
  }

  @WizardStep(3)
  async _thirdStep(@Ctx() ctx: IWizardContext) {
    await ctx.deleteMessage();
    ctx.session.state.categoryId = ctx.update.callback_query?.data;

    const lastSpending = await this.prisma.spending.findFirst({
      select: {
        exchangeRate: true,
      },
      orderBy: {
        datetime: 'desc',
      },
    });

    let button = undefined;

    if (lastSpending.exchangeRate) {
      const data = String(lastSpending.exchangeRate);

      button = Markup.inlineKeyboard([Markup.button.callback(data, data)]);
    }

    await ctx.reply('Введи обменный курс или примени последний:', button);

    ctx.wizard.next();
  }

  @WizardStep(4)
  async _fourthStep(@Ctx() ctx: IWizardContext) {
    await ctx.deleteMessage();

    const exchangeRate = ctx.update.callback_query?.data || ctx.message.text;

    const isNumber = isNumeric(exchangeRate);

    if (!isNumber) {
      await ctx.reply('Возможен ввод только чисел');
      ctx.wizard.selectStep(3);
      return;
    }

    ctx.session.state.exchangeRate = exchangeRate;

    await ctx.reply(
      'Введи комментарий к записи:',
      Markup.inlineKeyboard([
        Markup.button.callback(text.NO_COMMENT, this.NO_COMMENT),
      ]),
    );
    ctx.wizard.next();
  }

  @WizardStep(5)
  async _fifthStep(@Ctx() ctx: IWizardContext) {
    const answer = ctx.message?.text || ctx.update.callback_query.data;

    await ctx.deleteMessage();

    // @todo подумать про удаление сообщения. Сохранять id отправленного и его удалять. Потому что если я ввожу коммент то удаляется мой коммент
    if (answer && answer !== this.NO_COMMENT) {
      ctx.session.state.comment = answer;
    }

    try {
      const newData = await this.onHandleSubmit(ctx.session.state);

      if (ctx.session.state.type === TYPE.SPENDING) {
        const text = `Запись создана успешно: \n\n<b>Тип:</b> Трата\n<b>Категория:</b> ${newData.category.name}\n<b>Сумма:</b> ${newData.amount}\n<b>Дата:</b> ${new Date(newData.datetime).toLocaleDateString()}\n<b>Комментарий:</b> ${newData.comment || '-'}`;
        await ctx.replyWithHTML(text);

        return;
      }

      const text = `Запись создана успешно: \n\n<b>Тип:</b> Доход\n<b>Источник:</b> ${newData.source.name}\n<b>Сумма:</b> ${newData.amount}\n<b>Дата:</b> ${new Date(newData.datetime).toLocaleDateString()}\n<b>Комментарий:</b> ${newData.comment || '-'}`;
      await ctx.replyWithHTML(text);
    } catch (e) {
      await ctx.reply(`Произошла ошибка при записи данных: ${e}`);
    } finally {
      ctx.session.state = {};
      await ctx.scene.enter(SCENES.MAIN);
    }
  }

  // @todo Вынести в сервис API Spending
  async onHandleSubmit({
    amount,
    exchangeRate,
    categoryId,
    type,
    comment,
  }: ISubmitData): Promise<any> {
    // Проверка обязательных полей
    const requiredFields = { amount, exchangeRate, categoryId, type };
    Object.entries(requiredFields).forEach(([key, value]) => {
      if (!value) throw new Error(`Ошибка в данных: ${key} is missing`);
    });

    // Упрощённое разделение по типам
    if (type === TYPE.SPENDING) {
      return this.prisma.spending.create({
        data: {
          amount: Number(amount),
          exchangeRate: Number(exchangeRate),
          categoryId: Number(categoryId),
          comment,
        },
        include: { category: true },
      });
    }

    if (type === TYPE.INCOME) {
      return this.prisma.income.create({
        data: {
          amount: Number(amount),
          exchangeRate: Number(exchangeRate),
          sourceId: Number(categoryId),
          comment,
        },
        include: { source: true },
      });
    }

    throw new Error('Unsupported operation type');
  }
}
