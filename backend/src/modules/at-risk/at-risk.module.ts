import { BullModule } from '@nestjs/bull';
import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisConfig } from '../../config/redis.config';
import { NotificationsModule } from '../notifications/notifications.module';
import { AtRiskController } from './at-risk.controller';
import { AtRiskProcessor } from './at-risk.processor';
import { AtRiskService } from './at-risk.service';

@Module({
  imports: [
    forwardRef(() => NotificationsModule),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const cfg = config.getOrThrow<RedisConfig>('redis');
        return { redis: { host: cfg.host, port: cfg.port } };
      },
    }),
    BullModule.registerQueue({ name: 'at-risk' }),
  ],
  controllers: [AtRiskController],
  providers: [AtRiskService, AtRiskProcessor],
  exports: [AtRiskService, BullModule],
})
export class AtRiskModule {}
