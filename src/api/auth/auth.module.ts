import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../services/prisma/prisma.service';
import { UserModule } from '../user/user.module';
import { JwtStrategy } from '../../modules/jwt/jwt.straegy';

@Module({
  imports: [
    UserModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'jwt_money-check',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [AuthService, PrismaService, JwtService, JwtStrategy],
  controllers: [AuthController],
  exports: [JwtModule], // Экспортируем для использования в других модулях
})
export class AuthModule {}
