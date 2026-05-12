import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  imports: [AuthModule, ScheduleModule],
  controllers: [MeController],
  providers: [MeService],
  exports: [MeService],
})
export class MeModule {}
