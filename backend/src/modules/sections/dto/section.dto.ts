import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateSectionDto {
  @ApiProperty()
  @IsString()
  @Length(1, 64)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  faculty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ description: 'Subject IDs this section studies.' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  subjectIds?: string[];
}

export class UpdateSectionDto extends PartialType(CreateSectionDto) {}
