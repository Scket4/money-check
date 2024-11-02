import { Module } from '@nestjs/common';
import { SpendingService } from './spending.service';
import { SpendingController } from './spending.controller';
import { PrismaService } from '../../services/prisma/prisma.service';

@Module({
  providers: [SpendingService, PrismaService],
  controllers: [SpendingController],
})
export class SpendingModule {}
