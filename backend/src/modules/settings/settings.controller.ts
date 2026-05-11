import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AuthPrincipal, CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUniversity } from '../../common/decorators/university.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SettingsService } from './settings.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';

class UpdateSettingsDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() arabicName?: string;
  @IsOptional() @IsString() schoolYear?: string;
  @IsOptional() @IsString() brandLogoUrl?: string;
  @IsOptional() @IsInt() @Min(0) @Max(6) weekStartsOn?: number;
  @IsOptional() @IsInt() @Min(0) @Max(120) defaultLateAfterMinutes?: number;
}

@ApiBearerAuth()
@ApiTags('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @Get()
  @Roles('admin', 'doctor', 'student')
  @ApiOperation({ summary: 'Get the current university settings.' })
  get(@CurrentUniversity() uni: string) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.svc.get(uni);
  }

  @Patch()
  @Roles('admin')
  @ApiOperation({ summary: 'Update university settings (admin only).' })
  update(
    @CurrentUniversity() uni: string,
    @CurrentUser() actor: AuthPrincipal,
    @Body() dto: UpdateSettingsDto,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.svc.update(uni, actor.userId, dto);
  }
}
