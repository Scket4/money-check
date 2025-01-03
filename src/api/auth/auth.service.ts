import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  private readonly botToken = process.env.API_KEY;

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  validateTelegramAuth(initData: string): {
    telegramId: string;
    username?: string;
    firstName?: string;
  } {
    const data = new URLSearchParams(initData);

    const hash = data.get('hash');
    if (!hash) {
      throw new UnauthorizedException('No hash in initData');
    }

    const dataCheckString = Array.from(data.entries())
      .filter(([key]) => key !== 'hash')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(this.botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) {
      throw new UnauthorizedException('Invalid Telegram auth data');
    }

    const user = JSON.parse(data.get('user'));

    return {
      telegramId: String(user.id),
      username: user.username || '',
      firstName: user.first_name,
    };
  }

  async authenticate(initData: string): Promise<{ accessToken: string }> {
    // Проверка initData
    const { telegramId, username, firstName } =
      this.validateTelegramAuth(initData);

    // Поиск или создание пользователя
    let user = await this.userService.findByTelegramId(telegramId);
    if (!user) {
      user = await this.userService.create({
        telegramId,
        username,
        firstName,
      });
    }

    // Генерация JWT
    const payload = { sub: user.id, telegramId: user.telegramId };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
  }
}
