import { Command, Ctx, On, Wizard, WizardStep } from 'nestjs-telegraf';
import { SCENES, TYPE } from '../../../constants';
import { IWizardContext } from '../domain/iSceneContext';
import { PrismaService } from '../../../services/prisma/prisma.service';
import { chunkArray, isNumeric } from '../../../helpers';
import { Markup } from 'telegraf';
import { ISubmitData } from '../domain/ISubmitData';
import { BaseExtendScene } from '../domain/BaseScene';

@Wizard(SCENES.CREATE_RECORD)
export class CreateRecordScene extends BaseExtendScene {
  constructor(public readonly prisma: PrismaService) {
    super();
  }

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

      await ctx.reply('Выбери категорию', this.generateButtons(categories));
      ctx.wizard.next();
      return;
    }

    const sources = await this.prisma.source.findMany();

    await ctx.reply('Выбери источник', this.generateButtons(sources));

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
    ctx.session.state.exchangeRate = exchangeRate;

    const isNumber = isNumeric(exchangeRate);

    if (!isNumber) {
      await ctx.reply('Возможен ввод только чисел');
      ctx.wizard.selectStep(3);
      return;
    }

    try {
      const newData = await this.onHandleSubmit(ctx.session.state);

      if (ctx.session.state.type === TYPE.SPENDING) {
        const text = `Запись создана успешно: \n\n<b>Тип:</b> Трата\n<b>Категория:</b> ${newData.category.name}\n<b>Сумма:</b> ${newData.amount}\n<b>Дата:</b> ${new Date(newData.datetime).toLocaleDateString()}`;
        await ctx.replyWithHTML(text);

        return;
      }

      const text = `Запись создана успешно: \n\n<b>Тип:</b> Доход\n<b>Источник:</b> ${newData.source.name}\n<b>Сумма:</b> ${newData.amount}\n<b>Дата:</b> ${new Date(newData.datetime).toLocaleDateString()}`;
      await ctx.replyWithHTML(text);
    } catch (e) {
      await ctx.reply(`Произошла ошибка при записи данных: ${e}`);
    } finally {
      ctx.session.state = {};
      await ctx.scene.enter(SCENES.MAIN);
    }
  }

  generateButtons(buttons: any[]) {
    const array = chunkArray(buttons, 3);

    return Markup.inlineKeyboard(
      array.map((i) => {
        return i.map((e: any) => {
          return Markup.button.callback(e.name, String(e.id));
        });
      }),
    );
  }

  // @todo Вынести в какой-ниюбудь сервис из апишки
  async onHandleSubmit({
    amount,
    exchangeRate,
    categoryId,
    type,
  }: ISubmitData): Promise<any> {
    if (!amount || !exchangeRate || !categoryId || !type) {
      throw new Error('Ошибка в данных');
    }

    if (type === TYPE.SPENDING) {
      console.log(amount, exchangeRate, categoryId, type);
      return this.prisma.spending.create({
        data: {
          amount: Number(amount),
          exchangeRate: Number(exchangeRate),
          categoryId: Number(categoryId),
        },
        include: {
          category: true,
        },
      });
    }

    return this.prisma.income.create({
      data: {
        amount: Number(amount),
        exchangeRate: Number(exchangeRate),
        sourceId: Number(categoryId),
      },
      include: {
        source: true,
      },
    });
  }
}
