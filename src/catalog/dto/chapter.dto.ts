import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateChapterDto {
  @ApiProperty({ example: 1 }) @IsInt() @Min(0) number!: number;
  @ApiPropertyOptional() @IsString() @MinLength(1) @IsOptional() title?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() slug?: string;
  @ApiPropertyOptional({ enum: ['draft', 'published'] })
  @IsEnum(['draft', 'published'])
  @IsOptional()
  status?: 'draft' | 'published';
}
export class UpdateChapterDto {
  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @Min(0)
  @IsOptional()
  number?: number;
  @ApiPropertyOptional() @IsString() @MinLength(1) @IsOptional() title?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() slug?: string;
  @ApiPropertyOptional({ enum: ['draft', 'published'] })
  @IsEnum(['draft', 'published'])
  @IsOptional()
  status?: 'draft' | 'published';
}
