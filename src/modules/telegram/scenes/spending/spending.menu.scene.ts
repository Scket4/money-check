import { Ctx, Hears, Scene, SceneEnter } from 'nestjs-telegraf';
import { SCENES } from '../../../../constants';
import { BaseExtendScene } from '../../domain/BaseScene';
import { PrismaService } from '../../../../services/prisma/prisma.service';
import { IContext } from '../../domain/iSceneContext';
import { Markup } from 'telegraf';
import { TEXT } from '../../text';

const text = TEXT.SPENDING;

@Scene(SCENES.SPENDING_MENU)
export class SpendingMenuScene extends BaseExtendScene {
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
