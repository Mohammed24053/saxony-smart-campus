import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';
import { buildValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const cfg = config.getOrThrow<AppConfig>('app');

  app.setGlobalPrefix(cfg.apiPrefix);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({
    origin: cfg.adminWebOrigin === '*' ? true : cfg.adminWebOrigin.split(',').map((s) => s.trim()),
    credentials: true,
  });
  app.useGlobalPipes(buildValidationPipe());

  const swagger = new DocumentBuilder()
    .setTitle('Saxony Smart Campus API')
    .setDescription('B2B SaaS for university operations.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup(`${cfg.apiPrefix}/docs`, app, document);

  await app.listen(cfg.port);
  Logger.log(
    `Saxony Smart Campus backend listening on http://localhost:${cfg.port}/${cfg.apiPrefix}`,
    'Bootstrap',
  );
}

bootstrap();
