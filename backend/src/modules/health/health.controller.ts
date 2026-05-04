import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lightweight liveness probe.' })
  ping() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('readiness')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness check: DB + Redis must be reachable.' })
  ready() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('db', this.prisma),
      async (): Promise<HealthIndicatorResult> => {
        try {
          const ok = await this.redis.ping();
          return { redis: { status: ok ? 'up' : 'down' } };
        } catch (err) {
          return { redis: { status: 'down', error: (err as Error).message } };
        }
      },
    ]);
  }
}
