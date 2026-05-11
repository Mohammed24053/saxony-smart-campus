import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Redis as RedisClient } from 'ioredis';
import { RedisConfig } from '../../config/redis.config';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: RedisClient;

  constructor(config: ConfigService) {
    const cfg = config.getOrThrow<RedisConfig>('redis');
    this.client = new Redis(cfg.url, { maxRetriesPerRequest: null, lazyConnect: false });
    this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
    this.client.on('connect', () => this.logger.log(`Redis connected → ${cfg.host}:${cfg.port}`));
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    return this.client.setex(key, seconds, value);
  }

  async set(key: string, value: string): Promise<'OK'> {
    return this.client.set(key, value);
  }

  /**
   * Atomic SET-if-not-exists with TTL. Returns 'OK' when the key was set
   * (i.e. the caller "won" the race), or null when the key already existed.
   * Implemented via a single Redis SET … NX EX command, which is atomic on
   * the server and immune to the GET-then-SETEX race window.
   */
  async setNxEx(key: string, value: string, seconds: number): Promise<'OK' | null> {
    return this.client.set(key, value, 'EX', seconds, 'NX');
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.client.del(...keys);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  /**
   * Token-bucket-ish rate limiter: allow `limit` actions per `windowSeconds`.
   * Returns true when the action is allowed, false when limited.
   */
  async rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, windowSeconds);
    }
    return count <= limit;
  }

  async ping(): Promise<boolean> {
    const r = await this.client.ping();
    return r === 'PONG';
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
