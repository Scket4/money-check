// base-extend.scene.ts

import { Command, Ctx, InjectBot } from 'nestjs-telegraf';
import { COMMANDS, SCENES } from 'src/constants';
import { IContext } from './iSceneContext';
import { Telegraf } from 'telegraf';
import { PrismaService } from '../../../services/prisma/prisma.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Calendar = require('telegraf-calendar-telegram');

export abstract class BaseExtendScene {
  protected calendar: any;

  constructor(
    readonly prisma: PrismaService,
    @InjectBot() public readonly bot: Telegraf,
  ) {
    // Инициализация календаря
    this.calendar = new Calendar(this.bot, {
      startWeekDay: 1,
      weekDayNames: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
      monthNames: [
        'Январь',
        'Февраль',
        'Март',
        'Апрель',
        'Май',
        'Июнь',
        'Июль',
        'Август',
        'Сентябрь',
        'Октябрь',
        'Ноябрь',
        'Декабрь',
      ],
      minDate: null,
      maxDate: null,
      dateFormat: 'DD.MM.YYYY',
    });
  }

  // Метод для установки обработчика выбора даты
  protected setDateListener(callback: (ctx: IContext, date: string) => void) {
    this.calendar.setDateListener(callback);
  }

  @Command(COMMANDS.START)
  private async _onStart(@Ctx() ctx: IContext) {
    ctx.session.state = {};
    await ctx.scene.enter(SCENES.MAIN);
  }
}
