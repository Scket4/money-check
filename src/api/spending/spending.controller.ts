import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SpendingService } from './spending.service';
import {
  GetSpendingByMonthDTO,
  GetSpendingByRangeDTO,
  GetSpendingListDto,
} from './dto/spending.dto';
import { ApiQuery, ApiResponse } from '@nestjs/swagger';
import { PaginatedItemsResponseDto } from './domain/swagger';
import { JwtAuthGuard } from '../../modules/jwt/jwt.guard';
import { AuthenticatedRequest } from '../../domain';

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

  @Get('list')
  @UseGuards(JwtAuthGuard)
  @ApiQuery({ name: 'categoryId', required: false, type: Number })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['datetime', 'amount'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'page', required: false, type: Number, default: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, default: 10 })
  @ApiResponse({ status: 200, type: PaginatedItemsResponseDto })
  async getItems(
    @Query() query: GetSpendingListDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const id = req.user?.id;

    return this.spendingService.getSpendingList(query, id);
  }
}
