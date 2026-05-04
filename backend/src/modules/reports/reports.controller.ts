import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUniversity } from '../../common/decorators/university.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ReportsService } from './reports.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';

@ApiBearerAuth()
@ApiTags('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('session/:id')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Per-session attendance report (JSON or CSV).' })
  async session(
    @CurrentUniversity() uni: string,
    @Param('id') id: string,
    @Query('format') format = 'json',
    @Res({ passthrough: false }) res?: Response,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    const report = await this.svc.sessionReport(uni, id);
    if (format === 'csv' && res) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="session-${id}.csv"`);
      return res.send(this.svc.toCsvSession(report));
    }
    return report;
  }

  @Get('subject/:id')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Per-subject attendance roll-up (JSON or CSV).' })
  async subject(
    @CurrentUniversity() uni: string,
    @Param('id') id: string,
    @Query('format') format = 'json',
    @Res({ passthrough: false }) res?: Response,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    const report = await this.svc.subjectReport(uni, id);
    if (format === 'csv' && res) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="subject-${id}.csv"`);
      return res.send(this.svc.toCsvSubject(report));
    }
    return report;
  }
}
