import { Controller, Post, Body } from '@nestjs/common';
import { SpendingService } from './spending.service';
import {
  GetSpendingByMonthDTO,
  GetSpendingByRangeDTO,
} from './dto/spending.dto';

@Controller('spending')
export class SpendingController {
  constructor(private readonly spendingService: SpendingService) {}

  @Post('range')
  async getSpendingByRange(@Body() dto: GetSpendingByRangeDTO) {
    return this.spendingService.getSpendingByRange(dto);
  }

  @Post('month')
  async getSpendingByMonthByCategories(@Body() dto: GetSpendingByMonthDTO) {
    return this.spendingService.getSpendingByMonthByCategories(dto);
  }
}
