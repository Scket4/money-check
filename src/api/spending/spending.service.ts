import { Injectable } from '@nestjs/common';
import {
  GetSpendingByMonthDTO,
  GetSpendingByRangeDTO,
  GetSpendingListDto,
} from './dto/spending.dto';
import { PrismaService } from '../../services/prisma/prisma.service';
import { endOfMonth, startOfMonth } from 'date-fns';
import { TSpendingByMonthByCategories } from './domain/types';

@Injectable()
export class SpendingService {
  constructor(private readonly prisma: PrismaService) {}

  async getSpendingByRange(options: GetSpendingByRangeDTO) {
    const start = new Date(options.start);
    const end = new Date(options.end);

    return this.prisma.spending.findMany({
      where: {
        datetime: {
          gte: start,
          lte: end,
        },
        category: {
          hide: false,
        },
      },
    });
  }

  /**
   * Получение трат за месяц, сгруппированные по категориям
   * @param options
   * @return TSpendingByMonthByCategories[]
   */
  async getSpendingByMonthByCategories(
    options: GetSpendingByMonthDTO,
  ): Promise<TSpendingByMonthByCategories[]> {
    const spendingByCategory = await this.getAmountSpendingByMonth(options);

    const categories = await this.prisma.category.findMany({
      where: {
        id: { in: spendingByCategory.map((item) => item.categoryId) },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const categoryMap = categories.reduce((acc, category) => {
      acc[category.id] = category.name;
      return acc;
    }, {} as TSpendingByMonthByCategories);

    return spendingByCategory.map((item) => ({
      categoryId: item.categoryId,
      categoryName: categoryMap[item.categoryId] || 'Unknown',
      totalAmount: item._sum.amount ?? 0,
    }));
  }

  async getAmountSpendingByMonth(options: GetSpendingByMonthDTO) {
    const { month, year } = options;

    const startDate = startOfMonth(new Date(year, month, 1));
    const endDate = endOfMonth(startDate);

    return this.prisma.spending.groupBy({
      by: ['categoryId'],
      where: {
        datetime: {
          gte: startDate,
          lte: endDate,
        },
        category: {
          hide: false,
        },
      },
      _sum: {
        amount: true,
      },
    });
  }

  async getSpendingList(filters: GetSpendingListDto, id: number) {
    const {
      categoryId,
      dateFrom,
      dateTo,
      search,
      sortBy = 'datetime',
      sortOrder = 'asc',
      page = 1,
      limit = 10,
    } = filters;

    // Фильтрация
    const where: any = {
      category: {
        userId: id,
      },
    };
    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (dateFrom || dateTo) {
      where.datetime = {};
      if (dateFrom) where.datetime.gte = new Date(dateFrom);
      if (dateTo) where.datetime.lte = new Date(dateTo);
    }

    if (search) {
      where.comment = { contains: search, mode: 'insensitive' };
    }

    // Сортировка
    const orderBy: any = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder;
    }

    // Пагинация
    const skip = (page - 1) * limit;

    // Запрос к базе данных
    const [items, total] = await Promise.all([
      this.prisma.spending.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.spending.count({ where }),
    ]);

    return {
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
