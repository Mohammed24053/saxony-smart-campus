import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthPrincipal, CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ScheduleService } from '../schedule/schedule.service';
import { MeService } from './me.service';

class UpdateMeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

class PushTokenDto {
  @IsString()
  token!: string;

  @IsIn(['ios', 'android', 'web'])
  platform!: 'ios' | 'android' | 'web';
}

@ApiBearerAuth()
@ApiTags('me')
@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(
    private readonly svc: MeService,
    private readonly schedule: ScheduleService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get the current authenticated user.' })
  me(@CurrentUser() user: AuthPrincipal) {
    return this.svc.getProfile(user.userId);
  }

  @Get('schedule/today')
  @ApiOperation({
    summary: "List the current user's schedule slots for today.",
    description:
      'Doctors get all their own slots scheduled today; students get all ' +
      'slots for their section scheduled today. Used by the mobile doctor ' +
      'home screen and the student dashboard.',
  })
  scheduleToday(@CurrentUser() user: AuthPrincipal) {
    return this.schedule.listTodayFor(user.universityId, user.userId, user.role);
  }

  @Patch()
  @ApiOperation({ summary: 'Update the current user profile (name, phone).' })
  update(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: UpdateMeDto,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.svc.updateProfile(user.userId, dto, { ip, ua: req.headers['user-agent'] });
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change the current user password (revokes all sessions).' })
  async changePassword(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: ChangePasswordDto,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    await this.svc.changePassword(user.userId, dto.currentPassword, dto.newPassword, {
      ip,
      ua: req.headers['user-agent'],
    });
    return { success: true };
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List active refresh-token sessions for the current user.' })
  sessions(@CurrentUser() user: AuthPrincipal) {
    return this.svc.listSessions(user.userId);
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out from all devices (revoke all refresh tokens).' })
  async revokeAll(@CurrentUser() user: AuthPrincipal) {
    await this.svc.revokeAllOtherSessions(user.userId);
    return { success: true };
  }

  @Post('push-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register or refresh an FCM push token for this device.' })
  async registerPush(@CurrentUser() user: AuthPrincipal, @Body() dto: PushTokenDto) {
    await this.svc.registerPushToken(user.userId, dto.token, dto.platform);
    return { success: true };
  }

  @Delete('push-token/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unregister an FCM push token (logout / device wipe).' })
  async unregisterPush(@CurrentUser() user: AuthPrincipal, @Param('token') token: string) {
    await this.svc.unregisterPushToken(user.userId, token);
    return { success: true };
  }
}
