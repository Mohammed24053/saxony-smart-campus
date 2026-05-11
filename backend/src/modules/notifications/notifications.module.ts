import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FcmService } from './fcm.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, FcmService],
  exports: [NotificationsService, FcmService, NotificationsGateway],
})
export class NotificationsModule {}
