import { Ctx, Hears, Scene, SceneEnter } from 'nestjs-telegraf';
import { SCENES } from '../../../../constants';
import { BaseExtendScene } from '../../domain/BaseScene';
import { PrismaService } from '../../../../services/prisma/prisma.service';
import { IContext } from '../../domain/iSceneContext';
import { Markup } from 'telegraf';
import { TEXT } from '../../text';

const text = TEXT.INCOME;

@Scene(SCENES.INCOME_MENU)
export class IncomeMenuScene extends BaseExtendScene {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  @SceneEnter()
  async _enterScene(@Ctx() ctx: IContext) {
    await ctx.reply(
      TEXT.CORE.WHAT_YOU_WANT,
      Markup.keyboard(
        [Markup.button.text(text.MONTH), Markup.button.text(text.PLAN)],
        { columns: 2 },
      )
        .resize(true)
        .placeholder(TEXT.CORE.WHAT_YOU_WANT),
    );
  }

  @Hears(text.MONTH)
  async _onMonthIncome(@Ctx() ctx: IContext) {
    const incomeBySource = await this.prisma.income.groupBy({
      by: ['sourceId'], // Группируем по категории
      where: {
        datetime: {
          gte: new Date(new Date().setDate(1)), // Фильтрация по текущему месяцу
        },
      },
      _sum: {
        amount: true, // Суммируем поле `amount` для каждой категории
      },
    });

    if (!incomeBySource?.length) {
      await ctx.reply(text.NO_INCOME);
      return;
    }

    const sourceIds = incomeBySource.map((item) => item.sourceId);

    const sources = await this.prisma.source.findMany({
      where: {
        id: {
          in: sourceIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const result = incomeBySource.map((item) => {
      const source = sources.find((sour) => sour.id === item.sourceId);
      return {
        sourceId: item.sourceId,
        sourceNameName: source ? source.name : 'Unknown',
        totalAmount: item._sum.amount,
      };
    });

    const str = this.generateIncomeReport(result);

    await ctx.replyWithHTML(str);
  }

  generateIncomeReport(incomeBySource: Array<any>) {
    // Начало отчёта
    let report = `<b>${text.INCOME_REPORT}:</b>\n\n`;

    // Формируем строки для каждого источника
    incomeBySource.forEach((item) => {
      report += `<b>${item.sourceNameName}</b>: ${item.totalAmount}$\n`;
    });

    return report;
  }
}
