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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUniversity } from '../../common/decorators/university.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CreateSectionDto, UpdateSectionDto } from './dto/section.dto';
import { SectionsService } from './sections.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';

@ApiBearerAuth()
@ApiTags('sections')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sections')
export class SectionsController {
  constructor(private readonly sections: SectionsService) {}

  @Get()
  @Roles('admin', 'doctor')
  list(@CurrentUniversity() uni: string, @Query() q: PaginationQueryDto) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.sections.list(uni, q.page ?? 1, q.pageSize ?? 20, q.search);
  }

  @Post()
  @Roles('admin')
  create(@CurrentUniversity() uni: string, @Body() dto: CreateSectionDto) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.sections.create(uni, dto);
  }

  @Get(':id')
  @Roles('admin', 'doctor')
  findOne(@CurrentUniversity() uni: string, @Param('id', new ParseUUIDPipe()) id: string) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.sections.findById(uni, id);
  }

  @Put(':id')
  @Roles('admin')
  update(
    @CurrentUniversity() uni: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSectionDto,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.sections.update(uni, id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUniversity() uni: string, @Param('id', new ParseUUIDPipe()) id: string) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    await this.sections.softDelete(uni, id);
    return { success: true };
  }
}
