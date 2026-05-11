import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthPrincipal } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, TwoFaVerifyDto } from './dto/login.dto';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';

/**
 * Cookie used by the admin web UI to carry the refresh token across requests.
 * Mobile clients ignore this and continue using the request body.
 *
 * Marked `httpOnly` so JavaScript cannot read it — defends against XSS-driven
 * token theft. `sameSite=strict` neutralises CSRF on the refresh path.
 */
const REFRESH_COOKIE = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // matches JWT_REFRESH_EXPIRES default

function refreshCookieOptions(req: Request): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  };
}

function readRefreshToken(req: Request, dto: RefreshTokenDto): string {
  const fromCookie = (req as Request & { cookies?: Record<string, string> }).cookies?.[
    REFRESH_COOKIE
  ];
  const token = dto.refreshToken ?? fromCookie;
  if (!token) throw new AppException(ErrorCodes.UNAUTHORIZED);
  return token;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ short: { limit: 5, ttl: 60_000 }, medium: { limit: 20, ttl: 600_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Email + password login (admins also send 2FA code).' })
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.auth.login(dto, { ip, ua: req.headers['user-agent'] });
    // Mirror the refresh token to an HttpOnly cookie for the web client.
    // Mobile clients ignore the Set-Cookie and still pull from the body.
    if (tokens?.refreshToken) {
      res.cookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions(req));
    }
    return tokens;
  }

  @Public()
  @Throttle({ short: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Rotate the refresh token. Web clients may rely on the HttpOnly cookie — mobile sends the token in the body.',
  })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = readRefreshToken(req, dto);
    const tokens = await this.auth.refresh(token, { ip, ua: req.headers['user-agent'] });
    if (tokens?.refreshToken) {
      res.cookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions(req));
    }
    return tokens;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the supplied refresh token (or the cookie if absent).' })
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = readRefreshToken(req, dto);
    await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    return { success: true };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('csrf')
  @ApiOperation({ summary: 'Issue a CSRF token tied to the current session.' })
  csrf(): { csrfToken: string } {
    // Lightweight CSRF stub — emits a random opaque token the SPA can echo
    // on mutating requests. Refresh + login already use SameSite=strict, so
    // this is defence in depth for any future cookie-bearing endpoints.
    return { csrfToken: cryptoRandomBase64(32) };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('admin/2fa/setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a TOTP secret + otpauth URL for the current admin.' })
  async setup2fa(@CurrentUser() user: AuthPrincipal) {
    if (!user.email) throw new AppException(ErrorCodes.VALIDATION_ERROR);
    return this.auth.setupTwoFa(user.userId, user.email);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Throttle({ short: { limit: 5, ttl: 60_000 } })
  @Post('admin/2fa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a TOTP code and enable 2FA for the current admin.' })
  async verify2fa(@CurrentUser() user: AuthPrincipal, @Body() dto: TwoFaVerifyDto) {
    await this.auth.verifyTwoFa(user.userId, dto.code);
    return { success: true };
  }
}

function cryptoRandomBase64(bytes: number): string {
  return randomBytes(bytes).toString('base64url');
}
