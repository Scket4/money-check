import { IsDateString, IsNumber, Max, Min } from 'class-validator';

export class GetSpendingByRangeDTO {
  @IsDateString()
  start: string;

  @IsDateString()
  end: string;
}

export class GetSpendingByMonthDTO {
  @IsNumber()
  @Min(1)
  @Max(12)
  month: number;

  @IsNumber()
  year: number;
}
