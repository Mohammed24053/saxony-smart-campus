import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUniversity } from '../../common/decorators/university.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CreateDoctorDto, UpdateAvailabilityDto, UpdateDoctorDto } from './dto/doctor.dto';
import { DoctorsService } from './doctors.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';

@ApiBearerAuth()
@ApiTags('doctors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctors: DoctorsService) {}

  @Get()
  @Roles('admin')
  list(@CurrentUniversity() uni: string, @Query() q: PaginationQueryDto) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.doctors.list(uni, q.page ?? 1, q.pageSize ?? 20, q.search);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create a doctor.' })
  create(@CurrentUniversity() uni: string, @Body() dto: CreateDoctorDto) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.doctors.create(uni, dto);
  }

  @Get(':id')
  @Roles('admin')
  findOne(@CurrentUniversity() uni: string, @Param('id', new ParseUUIDPipe()) id: string) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.doctors.findById(uni, id);
  }

  @Put(':id')
  @Roles('admin')
  update(
    @CurrentUniversity() uni: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDoctorDto,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.doctors.update(uni, id, dto);
  }

  @Put(':id/availability')
  @Roles('admin')
  @ApiOperation({ summary: 'Replace the doctor\'s weekly availability.' })
  updateAvailability(
    @CurrentUniversity() uni: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.doctors.updateAvailability(uni, id, dto.availability);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUniversity() uni: string, @Param('id', new ParseUUIDPipe()) id: string) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    await this.doctors.softDelete(uni, id);
    return { success: true };
  }
}
