import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@saxony-egypt.edu' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'ChangeMe!2025' })
  @IsString()
  // We don't enforce complexity on _login_ — that's the credential the user
  // already chose. We DO enforce length bounds to make brute-forcing more
  // expensive and to prevent oversized inputs from reaching bcrypt.
  @Length(8, 128)
  password!: string;

  /** Required when the admin has 2FA enabled. */
  @ApiProperty({ required: false, example: '123456' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6,8}$/, { message: 'twoFactorCode must be a 6–8 digit TOTP code' })
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
  @MaxLength(512)
  refreshToken?: string;
}

export class TwoFaVerifyDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6,8}$/, { message: 'code must be a 6–8 digit TOTP code' })
  code!: string;
}
