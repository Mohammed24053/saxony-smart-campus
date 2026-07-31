import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class StartSessionDto {
  @ApiProperty()
  @IsUUID()
  scheduleSlotId!: string;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(300)
  intervalSeconds?: number;

  @ApiPropertyOptional({
    default: 15,
    description: 'Minutes after session start before scans are marked late.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  lateAfterMinutes?: number;
}

export class ScanQrDto {
  /** Either the raw QR JSON payload, or just the token if `sessionId` is supplied. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  payload?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(256)
  token?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
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
  @MaxLength(256)
  deviceFingerprint?: string;
}

export class ManualOverrideDto {
  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
