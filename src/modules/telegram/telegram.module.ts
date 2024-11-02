import { Module } from '@nestjs/common';
import { AppUpdate } from './telegram.service';
import { TelegrafModule } from 'nestjs-telegraf';
import { PrismaService } from 'src/services/prisma/prisma.service';
import scenes from './scenes';
import sessionMiddleware from './middleware/session.middleware';

import { Telegraf } from 'telegraf';
import * as process from 'node:process';
import { SpendingService } from '../../api/spending/spending.service';

@Module({
  imports: [
    TelegrafModule.forRoot({
      token: process.env.API_KEY,
      middlewares: [sessionMiddleware.middleware()],
    }),
  ],
  controllers: [],
  providers: [AppUpdate, PrismaService, SpendingService, Telegraf, ...scenes],
})
export class TelegramModule {}
