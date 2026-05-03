import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { SubjectType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateSubjectDto {
  @ApiProperty({ example: 'CS101' })
  @IsString()
  @Length(2, 32)
  code!: string;

  @ApiProperty({ example: 'Introduction to Computer Science' })
  @IsString()
  @Length(2, 128)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  faculty?: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  hoursPerWeek?: number;

  @ApiPropertyOptional({ example: 40 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxRoomCapacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultDoctorId?: string;

  @ApiProperty({ enum: SubjectType })
  @IsEnum(SubjectType)
  type!: SubjectType;
}

export class UpdateSubjectDto extends PartialType(CreateSubjectDto) {}
