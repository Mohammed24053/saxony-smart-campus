import { Body, Controller, HttpCode, HttpStatus, Ip, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { IsEmail, IsString, MaxLength } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { PasswordResetService } from './password-reset.service';
import { IsStrongPassword } from '../../common/validators/strong-password';

class RequestResetDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;
}

class ConfirmResetDto {
  @IsString()
  @MaxLength(512)
  token!: string;

  @IsString()
  @IsStrongPassword()
  newPassword!: string;
}

@ApiTags('auth')
@Controller('auth/password')
export class PasswordResetController {
  constructor(private readonly svc: PasswordResetService) {}

  @Public()
  @Throttle({ short: { limit: 3, ttl: 60_000 }, medium: { limit: 10, ttl: 3_600_000 } })
  @Post('forgot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a password-reset email if the address exists.' })
  async forgot(@Body() dto: RequestResetDto, @Ip() ip: string, @Req() req: Request) {
    await this.svc.requestReset(dto.email, { ip, ua: req.headers['user-agent'] });
    return { success: true };
  }

  @Public()
  @Throttle({ short: { limit: 5, ttl: 60_000 }, medium: { limit: 20, ttl: 3_600_000 } })
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a password reset with the token from email.' })
  async reset(@Body() dto: ConfirmResetDto, @Ip() ip: string, @Req() req: Request) {
    await this.svc.confirmReset(dto.token, dto.newPassword, { ip, ua: req.headers['user-agent'] });
    return { success: true };
  }
}
