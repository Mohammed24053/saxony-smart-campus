import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtConfig } from '../../config/jwt.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { TokenService } from './token.service';
import { TwoFactorService } from './two-factor.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const cfg = config.getOrThrow<JwtConfig>('jwt');
        return {
          privateKey: cfg.accessPrivateKey,
          publicKey: cfg.accessPublicKey,
          signOptions: { algorithm: cfg.algorithm, expiresIn: cfg.accessExpires },
          verifyOptions: { algorithms: [cfg.algorithm] },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, TwoFactorService, JwtStrategy],
  exports: [AuthService, TokenService, TwoFactorService, JwtModule],
})
export class AuthModule {}
