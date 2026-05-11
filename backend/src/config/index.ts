import appConfig from './app.config';
import databaseConfig from './database.config';
import redisConfig from './redis.config';
import jwtConfig from './jwt.config';
import firebaseConfig from './firebase.config';
import minioConfig from './minio.config';
import qrConfig from './qr.config';

export const allConfig = [
  appConfig,
  databaseConfig,
  redisConfig,
  jwtConfig,
  firebaseConfig,
  minioConfig,
  qrConfig,
];

export { appConfig, databaseConfig, redisConfig, jwtConfig, firebaseConfig, minioConfig, qrConfig };
