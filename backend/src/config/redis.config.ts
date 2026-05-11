import { registerAs } from '@nestjs/config';

export interface RedisConfig {
  url: string;
  host: string;
  port: number;
}

export default registerAs('redis', (): RedisConfig => {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  let host = 'localhost';
  let port = 6379;
  try {
    const u = new URL(url);
    host = u.hostname;
    port = parseInt(u.port || '6379', 10);
  } catch {
    /* keep defaults */
  }
  return { url, host, port };
});
