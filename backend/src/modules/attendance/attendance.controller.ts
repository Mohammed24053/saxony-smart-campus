import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUniversity } from '../../common/decorators/university.decorator';
import { CurrentUser, AuthPrincipal } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ManualOverrideDto, ScanQrDto, StartSessionDto } from './dto/attendance.dto';
import { AttendanceService } from './attendance.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';

@ApiBearerAuth()
@ApiTags('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('session/start')
  @Roles('doctor')
  @ApiOperation({ summary: 'Doctor starts an attendance session for one of their slots.' })
  start(
    @CurrentUniversity() uni: string,
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: StartSessionDto,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.attendance.startSession(uni, user, dto);
  }

  @Get('session/:id/qr')
  @Roles('doctor')
  @ApiOperation({ summary: 'Refresh the rotating QR token for a session.' })
  qr(
    @CurrentUniversity() uni: string,
    @CurrentUser() user: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.attendance.getCurrentQr(uni, user, id);
  }

  @Post('session/:id/end')
  @Roles('doctor')
  @HttpCode(HttpStatus.OK)
  end(
    @CurrentUniversity() uni: string,
    @CurrentUser() user: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.attendance.endSession(uni, user, id);
  }

  @Post('scan')
  @Roles('student')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Student scans a rotating QR (with GPS).' })
  scan(
    @CurrentUniversity() uni: string,
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: ScanQrDto,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.attendance.scan(uni, user, dto);
  }

  @Get('session/:id/live')
  @Roles('doctor', 'admin')
  live(
    @CurrentUniversity() uni: string,
    @CurrentUser() user: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.attendance.live(uni, user, id);
  }

  @Put(':recordId')
  @Roles('doctor')
  @ApiOperation({ summary: 'Manual override of an attendance record.' })
  manual(
    @CurrentUniversity() uni: string,
    @CurrentUser() user: AuthPrincipal,
    @Param('recordId', new ParseUUIDPipe()) recordId: string,
    @Body() dto: ManualOverrideDto,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.attendance.manualOverride(uni, user, recordId, dto.status, dto.reason);
  }

  @Get('student/:id')
  @Roles('admin', 'doctor', 'student')
  history(
    @CurrentUniversity() uni: string,
    @CurrentUser() user: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    if (user.role === 'student' && user.userId !== id) {
      throw new AppException(ErrorCodes.FORBIDDEN);
    }
    return this.attendance.studentHistory(uni, id);
  }

  @Get('session/:id/report')
  @Roles('admin', 'doctor')
  report(
    @CurrentUniversity() uni: string,
    @CurrentUser() user: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.attendance.sessionReport(uni, user, id);
  }
}
