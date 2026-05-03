import { registerAs } from '@nestjs/config';

export interface MinioConfig {
  endpoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

export default registerAs('minio', (): MinioConfig => ({
  endpoint: process.env.MINIO_ENDPOINT ?? 'localhost',
  port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
  useSSL: (process.env.MINIO_USE_SSL ?? 'false') === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY ?? 'campusminio',
  secretKey: process.env.MINIO_SECRET_KEY ?? 'campusminio',
  bucket: process.env.MINIO_BUCKET ?? 'smart-campus',
}));
