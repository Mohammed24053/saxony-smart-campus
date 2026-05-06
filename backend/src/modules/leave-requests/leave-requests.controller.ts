import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { LeaveRequestStatus } from '@prisma/client';
import { AuthPrincipal, CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUniversity } from '../../common/decorators/university.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { LeaveRequestsService } from './leave-requests.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';

class CreateLeaveDto {
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsString() reason!: string;
  @IsOptional() @IsString() attachmentKey?: string;
  @IsOptional() @IsString() sessionId?: string;
}

class ReviewLeaveDto {
  @IsIn(['approved', 'rejected']) decision!: 'approved' | 'rejected';
  @IsOptional() @IsString() note?: string;
}

@ApiBearerAuth()
@ApiTags('leave-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(private readonly svc: LeaveRequestsService) {}

  @Post()
  @Roles('student')
  @ApiOperation({ summary: 'Submit a leave / excuse request (student only).' })
  create(
    @CurrentUniversity() uni: string,
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: CreateLeaveDto,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.svc.createForStudent(uni, user.userId, {
      studentId: user.userId,
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      reason: dto.reason,
      attachmentKey: dto.attachmentKey,
      sessionId: dto.sessionId,
    });
  }

  @Get('mine')
  @Roles('student')
  @ApiOperation({ summary: 'List my own leave requests.' })
  mine(@CurrentUser() user: AuthPrincipal, @Query() q: PaginationQueryDto) {
    return this.svc.listForStudent(user.userId, q.page ?? 1, q.pageSize ?? 25);
  }

  @Get()
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'List leave requests (admin / doctor).' })
  list(
    @CurrentUniversity() uni: string,
    @Query() q: PaginationQueryDto,
    @Query('studentId') studentId?: string,
    @Query('status') status?: LeaveRequestStatus,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.svc.list(uni, q.page ?? 1, q.pageSize ?? 25, { studentId, status });
  }

  @Patch(':id/review')
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'Approve or reject a leave request.' })
  review(
    @CurrentUniversity() uni: string,
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: ReviewLeaveDto,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.svc.review(uni, actor.userId, id, dto.decision, dto.note);
  }
}
