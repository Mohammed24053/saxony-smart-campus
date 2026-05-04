import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class StartSessionDto {
  @ApiProperty()
  @IsString()
  scheduleSlotId!: string;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @IsNumber()
  intervalSeconds?: number;

  @ApiPropertyOptional({ default: 15, description: 'Minutes after session start before scans are marked late.' })
  @IsOptional()
  @IsNumber()
  lateAfterMinutes?: number;
}

export class ScanQrDto {
  /** Either the raw QR JSON payload, or just the token if `sessionId` is supplied. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payload?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  token?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  gpsLat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  gpsLng?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceFingerprint?: string;
}

export class ManualOverrideDto {
  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
