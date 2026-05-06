import { Test } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/**
 * Verifies that the dashboard's expensive aggregate queries are served
 * from Redis on cache hits and only recomputed on cache misses. The
 * dashboard renders frequently (every tab open, every refresh) so a
 * cache stampede here directly translates into Postgres load.
 */
describe('AnalyticsService (caching)', () => {
  let svc: AnalyticsService;
  let redis: { get: jest.Mock; setex: jest.Mock };
  let prisma: {
    $transaction: jest.Mock;
    user: { count: jest.Mock };
    section: { count: jest.Mock };
    room: { count: jest.Mock };
    atRiskRecord: { count: jest.Mock };
    attendanceSession: { count: jest.Mock };
    attendanceRecord: { count: jest.Mock };
  };

  beforeEach(async () => {
    redis = { get: jest.fn(), setex: jest.fn() };
    prisma = {
      $transaction: jest.fn(),
      user: { count: jest.fn() },
      section: { count: jest.fn() },
      room: { count: jest.fn() },
      atRiskRecord: { count: jest.fn() },
      attendanceSession: { count: jest.fn() },
      attendanceRecord: { count: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();
    svc = moduleRef.get(AnalyticsService);
  });

  it('returns the cached payload on a hit and skips Postgres entirely', async () => {
    const cached = {
      students: 10,
      doctors: 4,
      sections: 5,
      rooms: 3,
      atRiskOpen: 1,
      sessionsToday: 2,
      presentToday: 50,
    };
    redis.get.mockResolvedValueOnce(JSON.stringify(cached));

    const result = await svc.dashboard('uni-1');

    expect(result).toEqual(cached);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
  });

  it('computes and writes through to Redis on a miss', async () => {
    redis.get.mockResolvedValueOnce(null);
    prisma.$transaction.mockResolvedValueOnce([7, 3, 2, 4, 0, 1]);
    prisma.attendanceRecord.count.mockResolvedValueOnce(99);

    const result = await svc.dashboard('uni-2');

    expect(result).toMatchObject({ students: 7, presentToday: 99 });
    expect(redis.setex).toHaveBeenCalledTimes(1);
    const [key, ttl, body] = redis.setex.mock.calls[0];
    expect(key).toBe('analytics:dashboard:uni-2');
    expect(ttl).toBe(30);
    expect(JSON.parse(body)).toMatchObject({ students: 7, presentToday: 99 });
  });

  it('never throws if the cache write fails — the request still succeeds', async () => {
    redis.get.mockResolvedValueOnce(null);
    redis.setex.mockRejectedValueOnce(new Error('redis down'));
    prisma.$transaction.mockResolvedValueOnce([1, 1, 1, 1, 0, 0]);
    prisma.attendanceRecord.count.mockResolvedValueOnce(0);

    await expect(svc.dashboard('uni-3')).resolves.toMatchObject({ students: 1 });
  });

  it('falls back to a recompute when the cached payload is corrupt JSON', async () => {
    redis.get.mockResolvedValueOnce('not-json');
    prisma.$transaction.mockResolvedValueOnce([1, 1, 1, 1, 0, 0]);
    prisma.attendanceRecord.count.mockResolvedValueOnce(5);

    const result = await svc.dashboard('uni-4');

    expect(result).toMatchObject({ presentToday: 5 });
    expect(redis.setex).toHaveBeenCalledTimes(1);
  });
});
