import { Global, Module } from '@nestjs/common';
import { FcmService } from './fcm.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, FcmService],
  exports: [NotificationsService, FcmService, NotificationsGateway],
})
export class NotificationsModule {}
