import { Command, Ctx, InjectBot } from 'nestjs-telegraf';
import { COMMANDS, SCENES } from 'src/constants';
import { IContext } from './iSceneContext';
import { Telegraf } from 'telegraf';
import { PrismaService } from '../../../services/prisma/prisma.service';

export class BaseExtendScene {
  constructor(
    readonly prisma: PrismaService,
    @InjectBot() public readonly bot: Telegraf,
  ) {}
  @Command(COMMANDS.START)
  private async _onStart(@Ctx() ctx: IContext) {
    ctx.session.state = {};
    await ctx.scene.enter(SCENES.MAIN);
  }
}
