import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { RoomType } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

/**
 * IEEE 802.11 BSSID in colon- or hyphen-separated MAC-48 form. We accept
 * both upper- and lower-case hex on input and the service normalises to
 * lowercase with colons before persisting.
 */
const BSSID_REGEX = /^([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}$/;

export class CreateRoomDto {
  @ApiProperty()
  @IsString()
  @Length(1, 64)
  name!: string;

  @ApiProperty({ enum: RoomType })
  @IsEnum(RoomType)
  type!: RoomType;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  capacity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsInt()
  @Min(5)
  gpsRadius?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  gpsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  building?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  floor?: number;

  /**
   * Allow-list of Wi-Fi access-point BSSIDs that a student's device may be
   * associated with to count as a valid location proof for this room.
   * Empty array disables the Wi-Fi channel.
   */
  @ApiPropertyOptional({
    type: [String],
    description:
      'Allow-list of Wi-Fi BSSIDs (MAC-48, colon- or hyphen-separated) for location-proof fallback.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @IsString({ each: true })
  @Matches(BSSID_REGEX, { each: true, message: 'each BSSID must be a valid MAC-48 address' })
  wifiBssids?: string[];

  /**
   * Identifier of the BLE beacon installed in this room (`UUID:major:minor`
   * or any opaque string the campus IoT fleet uses). Null disables BLE.
   */
  @ApiPropertyOptional({
    description: 'BLE beacon identifier (e.g. UUID:major:minor) for location-proof fallback.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  bleBeaconId?: string;
}

export class UpdateRoomDto extends PartialType(CreateRoomDto) {}
