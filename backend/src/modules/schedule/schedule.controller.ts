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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUniversity } from '../../common/decorators/university.decorator';
import { CurrentUser, AuthPrincipal } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateScheduleSlotDto, UpdateScheduleSlotDto } from './dto/schedule.dto';
import { ScheduleService } from './schedule.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';

@ApiBearerAuth()
@ApiTags('schedule')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Post('generate')
  @Roles('admin')
  @ApiOperation({ summary: 'Auto-generate the weekly schedule.' })
  generate(@CurrentUniversity() uni: string) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.schedule.generate(uni);
  }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Full schedule (admin view).' })
  list(@CurrentUniversity() uni: string) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.schedule.listFor(uni);
  }

  @Get('my')
  @ApiOperation({ summary: "Current user's schedule (student or doctor)." })
  my(@CurrentUniversity() uni: string, @CurrentUser() user: AuthPrincipal) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    if (user.role === 'student') return this.schedule.listForStudent(uni, user.userId);
    if (user.role === 'doctor') return this.schedule.listForDoctor(uni, user.userId);
    throw new AppException(ErrorCodes.FORBIDDEN);
  }

  @Get('conflicts')
  @Roles('admin')
  conflicts(@CurrentUniversity() uni: string) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.schedule.getConflicts(uni);
  }

  @Post('publish')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  publish(@CurrentUniversity() uni: string) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.schedule.publish(uni);
  }

  @Put(':slotId')
  @Roles('admin')
  update(
    @CurrentUniversity() uni: string,
    @Param('slotId', new ParseUUIDPipe()) slotId: string,
    @Body() dto: UpdateScheduleSlotDto,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.schedule.updateSlot(uni, slotId, dto);
  }

  @Post('slot')
  @Roles('admin')
  @ApiOperation({ summary: 'Manually add a slot.' })
  create(@CurrentUniversity() uni: string, @Body() dto: CreateScheduleSlotDto) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.schedule.createSlot(uni, dto);
  }

  @Delete(':slotId')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUniversity() uni: string,
    @Param('slotId', new ParseUUIDPipe()) slotId: string,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    await this.schedule.deleteSlot(uni, slotId);
    return { success: true };
  }
}
