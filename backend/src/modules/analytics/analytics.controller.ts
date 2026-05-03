import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUniversity } from '../../common/decorators/university.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AnalyticsService } from './analytics.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';

@ApiBearerAuth()
@ApiTags('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('dashboard')
  dashboard(@CurrentUniversity() uni: string) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.analytics.dashboard(uni);
  }

  @Get('attendance/chart')
  attendanceChart(@CurrentUniversity() uni: string, @Query('days') days?: string) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.analytics.attendanceChart(uni, days ? Number(days) : 14);
  }

  @Get('rooms')
  rooms(@CurrentUniversity() uni: string) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.analytics.roomUtilization(uni);
  }

  @Get('doctors')
  doctors(@CurrentUniversity() uni: string) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.analytics.doctorPerformance(uni);
  }

  @Get('at-risk/weekly')
  atRiskWeekly(@CurrentUniversity() uni: string) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.analytics.weeklyAtRisk(uni);
  }
}
