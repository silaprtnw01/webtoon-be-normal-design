import { ApiProperty } from '@nestjs/swagger';
export class TooManyResponseDto {
  @ApiProperty({ example: 429 }) statusCode!: number;
  @ApiProperty({ example: 'Too Many Requests' }) message!: string;
  @ApiProperty({ example: 'ThrottlerException: Too Many Requests' })
  error!: string;
}
