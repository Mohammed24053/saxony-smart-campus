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
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class TwoFaVerifyDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  code!: string;
}
