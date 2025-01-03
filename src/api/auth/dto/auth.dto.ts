import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TelegramAuthDto {
  @ApiProperty({ required: true, type: String })
  @IsString()
  initData: string;
}

export class TelegramAuthResponse {
  @ApiProperty({ description: 'Токен', type: String })
  accessToken: string;
}
