import { ApiProperty } from '@nestjs/swagger';

export class SessionItemDto {
  @ApiProperty({ example: '4b8f8f6b-5a43-4c4a-9a1a-9c3e0c6d8a1f' }) id!: string;
  @ApiProperty({ example: '2025-08-16T12:00:00.000Z' }) createdAt!: string;
  @ApiProperty({ example: '2025-08-16T12:05:00.000Z' }) lastUsedAt!: string;
  @ApiProperty({ example: null }) revokedAt!: string | null;
  @ApiProperty({ example: '127.0.0.1' }) ip!: string | null;
  @ApiProperty({ example: 'Mozilla/5.0 ...' }) userAgent!: string | null;
  @ApiProperty({ example: 'dev-123' }) deviceId!: string | null;
}

export class SessionsResponseDto {
  @ApiProperty({ type: [SessionItemDto] })
  sessions!: SessionItemDto[];
}
