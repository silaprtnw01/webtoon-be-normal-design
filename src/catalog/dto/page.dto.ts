import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreatePageDto {
  @ApiProperty({ example: 1 }) @IsInt() @Min(0) index!: number;
  @ApiProperty({ example: 'series/my-hero/chapter-1/page-1.jpg' })
  @IsString()
  imageKey!: string;
  @ApiPropertyOptional({ example: 1080 }) @IsOptional() @IsInt() width?: number;
  @ApiPropertyOptional({ example: 3200 })
  @IsOptional()
  @IsInt()
  height?: number;
}
export class UpdatePageDto {
  @ApiPropertyOptional({ example: 2 }) @IsOptional() @IsInt() index?: number;
  @ApiPropertyOptional({ example: 'series/.../page-2.jpg' })
  @IsOptional()
  @IsString()
  imageKey?: string;
  @ApiPropertyOptional({ example: 1080 }) @IsOptional() @IsInt() width?: number;
  @ApiPropertyOptional({ example: 3200 })
  @IsOptional()
  @IsInt()
  height?: number;
}
