import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceGateway } from './attendance.gateway';
import { GpsService } from './gps.service';
import { QrTokenService } from './qr-token.service';
import { AtRiskModule } from '../at-risk/at-risk.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'at-risk' }),
    forwardRef(() => AtRiskModule),
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceGateway, GpsService, QrTokenService],
  exports: [AttendanceService, QrTokenService, GpsService, AttendanceGateway],
})
export class AttendanceModule {}
