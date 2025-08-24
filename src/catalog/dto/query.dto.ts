import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsInt, IsOptional, IsString } from 'class-validator';

export class CursorQueryDto {
  @ApiPropertyOptional({ example: 20 }) @IsOptional() @IsInt() take?: number;
  @ApiPropertyOptional({ example: 'uuid-cursor' })
  @IsOptional()
  @IsString()
  cursor?: string;
  @ApiPropertyOptional({
    example: 'true',
    description: 'list เฉพาะ published (default: true)',
  })
  @IsOptional()
  @IsBooleanString()
  publishedOnly?: string;
}
