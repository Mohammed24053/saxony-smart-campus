import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { IsArray, IsEnum, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export const NOTIFICATION_TARGET_TYPES = ['user', 'section', 'subject', 'broadcast'] as const;
export type NotificationTargetType = (typeof NOTIFICATION_TARGET_TYPES)[number];

export class SendNotificationDto {
  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type!: NotificationType;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty()
  @IsString()
  body!: string;

  @ApiProperty({
    enum: NOTIFICATION_TARGET_TYPES,
    description: 'user | section | subject | broadcast',
  })
  @IsIn(NOTIFICATION_TARGET_TYPES as unknown as string[])
  targetType!: NotificationTargetType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientUserIds?: string[];
}
