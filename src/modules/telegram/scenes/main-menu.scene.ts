import { Ctx, On, Scene, SceneEnter } from 'nestjs-telegraf';
import { SCENES } from 'src/constants';
import { BaseExtendScene } from '../domain/BaseScene';
import { IContext } from '../domain/iSceneContext';
import { isNumeric } from 'src/helpers';
import { Markup } from 'telegraf';

// @todo сцену записи переделать в wizard
@Scene(SCENES.MAIN)
export class MainMenuScene extends BaseExtendScene {
  @SceneEnter()
  async onEnter(@Ctx() ctx: IContext) {
    const batons = Markup.keyboard(
      [
        Markup.button.text('Учет расходов'),
        Markup.button.text('Учет доходов'),
        Markup.button.text('Категории расходов'),
        Markup.button.text('Категории доходов'),
        Markup.button.text('Планирование бюджета'),
        Markup.button.text('Отчеты'),
      ],
      { columns: 2 },
    ).resize(true);

    await ctx.reply('Введи сумму', batons);
  }

  @On('text')
  async hears(@Ctx() ctx: IContext) {
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
