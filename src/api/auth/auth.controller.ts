import { Body, Controller, Post } from '@nestjs/common';
import { TelegramAuthDto, TelegramAuthResponse } from './dto/auth.dto';
import { AuthService } from './auth.service';
import { ApiResponse } from '@nestjs/swagger';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('telegram')
  @ApiResponse({ status: 200, type: TelegramAuthResponse })
  async authenticate(@Body() { initData }: TelegramAuthDto) {
    return this.authService.authenticate(initData);
  }
}
