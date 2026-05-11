import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { allConfig } from './config';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { StorageModule } from './modules/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { StudentsModule } from './modules/students/students.module';
import { DoctorsModule } from './modules/doctors/doctors.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { SectionsModule } from './modules/sections/sections.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AtRiskModule } from './modules/at-risk/at-risk.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HealthModule } from './modules/health/health.module';
import { AuditModule } from './modules/audit/audit.module';
import { EmailModule } from './modules/email/email.module';
import { MeModule } from './modules/me/me.module';
import { UsersModule } from './modules/users/users.module';
import { PasswordResetModule } from './modules/password-reset/password-reset.module';
import { LeaveRequestsModule } from './modules/leave-requests/leave-requests.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: allConfig }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: () => ({
        // Multiple named throttlers — endpoints opt into strict tiers via
        // @Throttle({ short: { limit, ttl } }). The default "global" tier
        // applies to every route automatically.
        throttlers: [
          { name: 'global', ttl: 60_000, limit: 100 },
          { name: 'short', ttl: 60_000, limit: 5 },
          { name: 'medium', ttl: 600_000, limit: 20 },
        ],
      }),
    }),
    PrismaModule,
    RedisModule,
    StorageModule,
    AuditModule,
    EmailModule,
    NotificationsModule,
    AuthModule,
    MeModule,
    UsersModule,
    PasswordResetModule,
    LeaveRequestsModule,
    SettingsModule,
    ReportsModule,
    StudentsModule,
    DoctorsModule,
    RoomsModule,
    SubjectsModule,
    SectionsModule,
    ScheduleModule,
    AttendanceModule,
    AtRiskModule,
    AnalyticsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
