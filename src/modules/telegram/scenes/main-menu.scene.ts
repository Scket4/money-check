import { Ctx, Hears, On, Scene, SceneEnter } from 'nestjs-telegraf';
import { SCENES } from 'src/constants';
import { BaseExtendScene } from '../domain/BaseScene';
import { IContext } from '../domain/iSceneContext';
import { isNumeric } from 'src/helpers';
import { Markup } from 'telegraf';
import { TEXT } from '../text';

const text = TEXT.MAIN;

// @todo сцену записи переделать в wizard
@Scene(SCENES.MAIN)
export class MainMenuScene extends BaseExtendScene {
  @SceneEnter()
  async _onEnter(@Ctx() ctx: IContext) {
    const batons = Markup.keyboard(
      [
        Markup.button.text(text.SPENDING),
        Markup.button.text(text.INCOME),
        Markup.button.text(text.PLAN),
        Markup.button.text('Отчеты'),
        Markup.button.text('Категории расходов'),
        Markup.button.text('Категории доходов'),
      ],
      { columns: 2 },
    ).resize(true);

    await ctx.reply(
      'Введи сумму для записи расходов/доходов или выбери необходимый пункт меню:',
      batons,
    );
  }

  @Hears(text.SPENDING)
  async _onSpending(@Ctx() ctx: IContext) {
    await ctx.scene.enter(SCENES.SPENDING_MENU);
  }

  @Hears(text.INCOME)
  async _onIncome(@Ctx() ctx: IContext) {
    await ctx.scene.enter(SCENES.INCOME_MENU);
  }

  @Hears(text.PLAN)
  async _onPlan(@Ctx() ctx: IContext) {
    await ctx.scene.enter(SCENES.PLAN_MENU);
  }

  @On('text')
  async _hearsText(@Ctx() ctx: IContext) {
    const isNumber = isNumeric(ctx.message.text);

    if (!isNumber) {
      await ctx.reply('Возможен ввод только чисел');
      return;
    }

    ctx.session.state = {};

    ctx.session.state.amount = ctx.message.text;

    await ctx.scene.enter(SCENES.CREATE_RECORD);
  }
}
