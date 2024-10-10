import { Command, Ctx } from 'nestjs-telegraf';
import { COMMANDS, SCENES } from 'src/constants';
import { IContext } from './iSceneContext';

export class BaseExtendScene {
  @Command(COMMANDS.START)
  private async _onStart(@Ctx() ctx: IContext) {
    ctx.session.state = {};
    await ctx.scene.enter(SCENES.MAIN);
  }
}
