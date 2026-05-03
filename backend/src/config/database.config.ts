import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
}

export default registerAs('database', (): DatabaseConfig => ({
  url:
    process.env.DATABASE_URL ??
    'postgresql://campus:campus@localhost:5432/smart_campus?schema=public',
}));
