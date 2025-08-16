export class HealthDto {}
import { ApiProperty } from '@nestjs/swagger';

export class HealthChecksDto {
  @ApiProperty({ enum: ['ok', 'down'], example: 'ok' })
  db!: 'ok' | 'down';

  @ApiProperty({ enum: ['ok', 'down', 'skipped'], example: 'ok' })
  redis!: 'ok' | 'down' | 'skipped';

  @ApiProperty({ enum: ['ok', 'down'], example: 'ok' })
  minio!: 'ok' | 'down';
}

export class HealthResponseDto {
  @ApiProperty({ enum: ['ok', 'degraded'], example: 'ok' })
  status!: 'ok' | 'degraded';

  @ApiProperty({ type: HealthChecksDto })
  checks!: HealthChecksDto;

  @ApiProperty({ example: 12.345 })
  uptime!: number;

  @ApiProperty({ example: '2025-08-16T12:34:56.789Z' })
  timestamp!: string;
}

export class ReadinessChecksDto {
  @ApiProperty({ enum: ['ok', 'down'], example: 'ok' })
  db!: 'ok' | 'down';
}

export class ReadinessResponseDto {
  @ApiProperty({ enum: ['ready', 'not_ready'], example: 'ready' })
  status!: 'ready' | 'not_ready';

  @ApiProperty({ type: ReadinessChecksDto })
  checks!: ReadinessChecksDto;

  @ApiProperty({ example: '2025-08-16T12:34:56.789Z' })
  timestamp!: string;
}
