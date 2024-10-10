import { Injectable } from '@nestjs/common';
import { Update, Ctx, Start, InjectBot } from 'nestjs-telegraf';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { IContext } from './domain/iSceneContext';
import { SCENES } from 'src/constants';
import { Telegraf } from 'telegraf';

@Update()
@Injectable()
export class AppUpdate {
  constructor(
    private prisma: PrismaService,
    @InjectBot() private telegrafService: Telegraf,
  ) {}
  @Start()
  async onEnter(@Ctx() ctx: IContext) {
    await ctx.scene.enter(SCENES.MAIN);
  }

  async onModuleInit() {
    this.telegrafService.catch((err: string, ctx: IContext) => {
      this.sendMessage(
        String(ctx.from.id),
        `Произошла ошибка, попробуйте снова\n\nТекст ошибки: <b>${err}</b>`,
      );
      console.log(err);
    });
  }

  public async sendMessage(userId: string, text: string) {
    await this.telegrafService.telegram.sendMessage(userId, text, {
      parse_mode: 'HTML',
    });
  }
}
