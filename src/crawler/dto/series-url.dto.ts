import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl } from 'class-validator';

export class SeriesUrlDto {
  @ApiProperty({ example: 'https://one-manga.com/manga/solo-leveling/' })
  @IsString()
  @IsUrl()
  url!: string;
}
