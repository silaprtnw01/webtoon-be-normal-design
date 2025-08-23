import { ApiProperty } from '@nestjs/swagger';

export class ProviderItemDto {
  @ApiProperty({ example: 'google' }) provider!: string;
  @ApiProperty({ example: '117000000000000000000' }) providerId!: string;
  @ApiProperty({ example: '2025-08-16T12:00:00.000Z' }) createdAt!: string;
}

export class ProvidersResponseDto {
  @ApiProperty({ type: [ProviderItemDto] })
  providers!: ProviderItemDto[];
}
