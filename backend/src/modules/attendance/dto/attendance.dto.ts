import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class StartSessionDto {
  @ApiProperty()
  @IsString()
  scheduleSlotId!: string;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @IsNumber()
  intervalSeconds?: number;

  @ApiPropertyOptional({
    default: 15,
    description: 'Minutes after session start before scans are marked late.',
  })
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

  /**
   * BSSID of the Wi-Fi AP the student is currently connected to. When set
   * and the room has any `wifiBssids` configured, a match is accepted as
   * a location proof even if GPS is missing or out of range.
   */
  @ApiPropertyOptional({
    description:
      "Wi-Fi BSSID of the student's currently associated access point (lowercase, colon-separated).",
  })
  @IsOptional()
  @IsString()
  wifiBssid?: string;

  /**
   * UUID/major/minor of the BLE beacon the device sees with the strongest
   * RSSI. Accepted as a location proof if the room has `bleBeaconId` set
   * and it matches.
   */
  @ApiPropertyOptional({
    description: 'BLE beacon identifier visible to the device (UUID:major:minor).',
  })
  @IsOptional()
  @IsString()
  bleBeaconId?: string;

  @ApiPropertyOptional({
    description: 'RSSI of the strongest BLE beacon reading (dBm, negative).',
  })
  @IsOptional()
  @IsNumber()
  bleRssi?: number;

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
