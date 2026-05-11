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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUniversity } from '../../common/decorators/university.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';
import { StudentsService } from './students.service';
import { StudentsImportService } from './students.import.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';

@ApiBearerAuth()
@ApiTags('students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students')
export class StudentsController {
  constructor(
    private readonly students: StudentsService,
    private readonly importer: StudentsImportService,
  ) {}

  @Get()
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Paginated list of students.' })
  list(@CurrentUniversity() uni: string, @Query() q: PaginationQueryDto) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.students.list(uni, q.page ?? 1, q.pageSize ?? 20, q.search);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create a single student.' })
  create(@CurrentUniversity() uni: string, @Body() dto: CreateStudentDto) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.students.create(uni, dto);
  }

  @Get('import/template')
  @Roles('admin')
  @ApiOperation({ summary: 'Download an Excel import template.' })
  async template(@Res() res: Response) {
    const buf = await this.importer.generateTemplate();
    res
      .setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      .setHeader('Content-Disposition', 'attachment; filename="students-template.xlsx"')
      .send(buf);
  }

  @Post('import')
  @Roles('admin')
  @UseInterceptors(
    FileInterceptor('file', {
      // Hard-cap on uploaded file size: 5 MB is more than enough for a sheet
      // of ~50k students. Prevents memory exhaustion / DoS via huge uploads.
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
      fileFilter: (_req, file, cb) => {
        const allowed = new Set([
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'application/octet-stream', // some clients send xlsx as octet-stream
        ]);
        const isXlsx = /\.xlsx$/i.test(file.originalname);
        if (allowed.has(file.mimetype) && isXlsx) {
          cb(null, true);
        } else {
          cb(null, false);
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Bulk import students from Excel.' })
  async import(
    @CurrentUniversity() uni: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    if (!file) throw new AppException(ErrorCodes.INVALID_FILE_FORMAT);
    return this.importer.parseAndImport(uni, file.buffer);
  }

  @Get(':id')
  @Roles('admin', 'doctor')
  findOne(@CurrentUniversity() uni: string, @Param('id', new ParseUUIDPipe()) id: string) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.students.findById(uni, id);
  }

  @Put(':id')
  @Roles('admin')
  update(
    @CurrentUniversity() uni: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.students.update(uni, id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUniversity() uni: string, @Param('id', new ParseUUIDPipe()) id: string) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    await this.students.softDelete(uni, id);
    return { success: true };
  }
}
