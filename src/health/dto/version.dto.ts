import { ApiProperty } from '@nestjs/swagger';

export class VersionResponseDto {
  @ApiProperty({ example: 'webtoon-platform' })
  name!: string;

  @ApiProperty({ example: '0.1.0' })
  version!: string;

  @ApiProperty({
    enum: ['development', 'test', 'production'],
    example: 'development',
  })
  nodeEnv!: 'development' | 'test' | 'production';
}
