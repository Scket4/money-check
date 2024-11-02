import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TelegramModule } from './modules/telegram/telegram.module';
import { SpendingModule } from './api/spending/spending.module';

@Module({
  imports: [TelegramModule, SpendingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
