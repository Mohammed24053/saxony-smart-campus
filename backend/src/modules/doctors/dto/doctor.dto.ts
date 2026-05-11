import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

/**
 * `availability` is a free-form JSON document of the form
 *   { mon: ["09:00-12:00"], tue: ["13:00-17:00"], … }
 * for the schedule generator to consult.
 */
export class CreateDoctorDto {
  @ApiProperty()
  @IsString()
  @Length(2, 64)
  doctorId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: 'object' })
  @IsOptional()
  @IsObject()
  availability?: Record<string, string[]>;
}

export class UpdateDoctorDto extends PartialType(CreateDoctorDto) {}

export class UpdateAvailabilityDto {
  @ApiProperty({ type: 'object', example: { mon: ['09:00-12:00'] } })
  @IsObject()
  availability!: Record<string, string[]>;
}
