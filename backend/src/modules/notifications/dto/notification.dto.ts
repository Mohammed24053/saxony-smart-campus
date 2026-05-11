import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export const NOTIFICATION_TARGET_TYPES = ['user', 'section', 'subject', 'broadcast'] as const;
export type NotificationTargetType = (typeof NOTIFICATION_TARGET_TYPES)[number];

export class SendNotificationDto {
  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type!: NotificationType;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  body!: string;

  @ApiProperty({
    enum: NOTIFICATION_TARGET_TYPES,
    description: 'user | section | subject | broadcast',
  })
  @IsIn(NOTIFICATION_TARGET_TYPES as unknown as string[])
  targetType!: NotificationTargetType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  targetId?: string;

  @ApiPropertyOptional({ description: 'Explicit recipient list (UUIDs, max 1000).' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsUUID('4', { each: true })
  recipientUserIds?: string[];
}
