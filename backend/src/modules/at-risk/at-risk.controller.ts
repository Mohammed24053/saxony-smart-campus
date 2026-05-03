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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUniversity } from '../../common/decorators/university.decorator';
import { CurrentUser, AuthPrincipal } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AtRiskService } from './at-risk.service';
import {
  CreateAtRiskSettingDto,
  NotifyAtRiskDto,
  UpdateAtRiskSettingDto,
} from './dto/at-risk.dto';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';

@ApiBearerAuth()
@ApiTags('at-risk')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('at-risk')
export class AtRiskController {
  constructor(private readonly atRisk: AtRiskService) {}

  @Get()
  @Roles('admin', 'doctor')
  @ApiOperation({ summary: 'All open at-risk records (paginated).' })
  list(@CurrentUniversity() uni: string, @Query() q: PaginationQueryDto) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.atRisk.list(uni, q.page ?? 1, q.pageSize ?? 20);
  }

  @Get('settings')
  @Roles('admin')
  listSettings(@CurrentUniversity() uni: string) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.atRisk.listSettings(uni);
  }

  @Post('settings')
  @Roles('admin')
  createSetting(@CurrentUniversity() uni: string, @Body() dto: CreateAtRiskSettingDto) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.atRisk.createSetting(uni, dto);
  }

  @Put('settings/:id')
  @Roles('admin')
  updateSetting(
    @CurrentUniversity() uni: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAtRiskSettingDto,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.atRisk.updateSetting(uni, id, dto);
  }

  @Get(':studentId')
  @Roles('admin', 'doctor', 'student')
  detail(
    @CurrentUniversity() uni: string,
    @CurrentUser() user: AuthPrincipal,
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    if (user.role === 'student' && user.userId !== studentId) {
      throw new AppException(ErrorCodes.FORBIDDEN);
    }
    return this.atRisk.findStudentRecords(uni, studentId);
  }

  @Post(':studentId/notify')
  @Roles('admin', 'doctor')
  @HttpCode(HttpStatus.OK)
  notify(
    @CurrentUniversity() uni: string,
    @CurrentUser() user: AuthPrincipal,
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
    @Body() dto: NotifyAtRiskDto,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.atRisk.sendCustomNotification(uni, user.userId, studentId, dto);
  }

  @Put(':id/resolve')
  @Roles('admin')
  resolve(
    @CurrentUniversity() uni: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.atRisk.resolve(id);
  }
}
