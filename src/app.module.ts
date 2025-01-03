import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TelegramModule } from './modules/telegram/telegram.module';
import { SpendingModule } from './api/spending/spending.module';
import { AuthController } from './api/auth/auth.controller';
import { UserModule } from './api/user/user.module';
import { AuthService } from './api/auth/auth.service';
import { AuthModule } from './api/auth/auth.module';

@Module({
  imports: [TelegramModule, SpendingModule, UserModule, AuthModule],
  controllers: [AppController, AuthController],
  providers: [AppService, AuthService],
})
export class AppModule {}
