import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@saxony-egypt.edu' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'ChangeMe!2025' })
  @IsString()
  @MinLength(6)
  password!: string;

  /** Required when the admin has 2FA enabled. */
  @ApiProperty({ required: false, example: '123456' })
  @IsOptional()
  @IsString()
  twoFactorCode?: string;
}

export class RefreshTokenDto {
  /**
   * The refresh token. Optional in the request body — when omitted, the
   * server falls back to the `refreshToken` HttpOnly cookie set by `/login`.
   * Mobile clients (which can't carry cookies) keep using the body.
   */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class TwoFaVerifyDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  code!: string;
}
