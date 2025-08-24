import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SeedDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'จำนวนหน้า listing ที่จะ seed',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  pages?: number = 1;
}
