import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}
  async findByTelegramId(telegramId: string) {
    return this.prisma.user.findUnique({
      where: { telegramId },
    });
  }

  async create({
    telegramId,
    username,
    firstName,
  }: {
    telegramId: string;
    firstName: string;
    username: string;
  }) {
    return this.prisma.user.create({
      data: { telegramId, username, firstName },
    });
  }
}
