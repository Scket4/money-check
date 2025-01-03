import { ApiProperty } from '@nestjs/swagger';

class ItemDto {
  @ApiProperty({ description: 'Идентификатор записи', type: Number })
  id: number;

  @ApiProperty({ description: 'Комментарий', type: String })
  comment?: string;

  @ApiProperty({ description: 'Идентификатор категории', type: Number })
  categoryId: number;

  @ApiProperty({ description: 'Дата создания', type: Date })
  datetime: Date;

  @ApiProperty({ description: 'Сумма', type: Number })
  amount: number;

  @ApiProperty({ description: 'Курс обмена', type: Number })
  exchangeRate: number;
}

class PaginatedResponseDto<T> {
  @ApiProperty({ description: 'Список трат', type: Array })
  data: T[];

  @ApiProperty({ description: 'Общее количество записей', type: Number })
  total: number;

  @ApiProperty({ description: 'Номер текущей страницы', type: Number })
  page: number;

  @ApiProperty({ description: 'Лимит записей на страницу', type: Number })
  limit: number;

  @ApiProperty({ description: 'Общее количество страниц', type: Number })
  totalPages: number;
}

export class PaginatedItemsResponseDto extends PaginatedResponseDto<ItemDto> {
  @ApiProperty({ description: 'Список записей', type: [ItemDto] })
  data: ItemDto[];
}
