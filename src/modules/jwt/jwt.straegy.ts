import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // Отклоняем истекшие токены
      secretOrKey: process.env.JWT_SECRET || 'jwt_money-check',
    });
  }

  async validate(payload: any) {
    // Здесь выполняется валидация токена и извлечение полезной информации
    // Возвращаем объект, который будет доступен в `request.user`
    return { userId: payload.sub, telegramId: payload.telegramId };
  }
}
