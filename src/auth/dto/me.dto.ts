import { ApiProperty } from '@nestjs/swagger';

export class MeResponseDto {
  @ApiProperty({ example: 'e2e-user-id-uuid' }) id!: string;
  @ApiProperty({ example: 'a@b.com' }) email!: string;
  @ApiProperty({ example: 'Alice' }) displayName!: string;
  @ApiProperty({ example: null }) externalCustomerId!: string | null;
  @ApiProperty({ example: '2025-08-01T00:00:00.000Z' }) createdAt!: string;
  @ApiProperty({ example: '2025-08-16T00:00:00.000Z' }) updatedAt!: string;
  @ApiProperty({ example: ['user'] }) roles!: string[];
}
