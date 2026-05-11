import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { getQueueToken } from '@nestjs/bull';
import { Queue } from 'bull';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { v4 as uuid } from 'uuid';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';
import { buildValidationPipe } from './common/pipes/validation.pipe';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const cfg = config.getOrThrow<AppConfig>('app');

  app.setGlobalPrefix(cfg.apiPrefix);

  // Security headers — Helmet defaults plus a per-route CSP. We can't enable
  // a strict CSP globally because Swagger UI inlines scripts; the docs route
  // disables CSP individually below.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'img-src': ["'self'", 'data:', 'blob:'],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'connect-src': ["'self'"],
          'frame-ancestors': ["'none'"],
          'base-uri': ["'self'"],
          'object-src': ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  // Parse cookies on the incoming request (read by the auth controller's
  // refresh-token cookie path). When `COOKIE_SECRET` is provided we sign
  // cookies, enabling signed-cookie verification for future endpoints.
  app.use(cookieParser(process.env.COOKIE_SECRET || undefined));

  // Request-id propagation for log correlation. Generates a UUID per request
  // (or accepts a client-supplied X-Request-Id) and echoes it back on the
  // response so the admin can surface it for support tickets.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const incoming = (req.headers['x-request-id'] || req.headers['x-correlation-id']) as
      | string
      | undefined;
    const id = incoming && incoming.length <= 128 ? incoming : uuid();
    (req as Request & { id?: string }).id = id;
    res.setHeader('X-Request-Id', id);
    next();
  });

  // Refuse the `*` + credentials combination — browsers reject it at runtime
  // and it gives the operator a false sense of working CORS. In production
  // require an explicit allow-list of origins; in development log a warning.
  if (cfg.adminWebOrigin === '*') {
    if (cfg.nodeEnv === 'production') {
      throw new Error(
        'ADMIN_WEB_ORIGIN=* is not allowed in production (credentials require explicit origins).',
      );
    }
    Logger.warn(
      'ADMIN_WEB_ORIGIN=* — using a permissive non-credentialed CORS policy.',
      'Bootstrap',
    );
    app.enableCors({
      origin: true,
      credentials: false,
      exposedHeaders: ['X-Request-Id'],
    });
  } else {
    app.enableCors({
      origin: cfg.adminWebOrigin.split(',').map((s) => s.trim()),
      credentials: true,
      exposedHeaders: ['X-Request-Id'],
    });
  }

  app.useGlobalPipes(buildValidationPipe());

  // Allow Nest to gracefully drain Bull/Redis/Socket.io connections on SIGTERM.
  app.enableShutdownHooks();

  // Bull-Board admin UI for inspecting Bull queues. Mounted on
  // `/{apiPrefix}/admin/queues`, behind a Bearer-token middleware that
  // requires `role === 'admin'`. The token must be supplied via the
  // `Authorization` header — query-string access has been removed.
  try {
    const jwt = app.get(JwtService);
    const prisma = app.get(PrismaService);
    const httpAdapter = app.getHttpAdapter().getInstance() as {
      use: (path: string, ...handlers: unknown[]) => void;
    };
    const queueNames = ['at-risk'] as const;
    const queues: Queue[] = queueNames
      .map((name) => app.get<Queue>(getQueueToken(name), { strict: false }))
      .filter((q): q is Queue => Boolean(q));

    if (queues.length > 0) {
      const adapter = new ExpressAdapter();
      const basePath = `/${cfg.apiPrefix}/admin/queues`;
      adapter.setBasePath(basePath);
      createBullBoard({
        queues: queues.map((q) => new BullAdapter(q)),
        serverAdapter: adapter,
      });

      const guard = async (req: Request, res: Response, next: NextFunction) => {
        try {
          // Header-only — `?access_token=` was removed because it leaks the
          // bearer JWT into proxy access logs, the Referer header and the
          // browser history bar. Admins paste the token in DevTools instead.
          const headerToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
          const token = headerToken;
          if (!token) return res.status(401).send('Unauthorized');
          const payload = (await jwt.verifyAsync(token)) as { sub: string; role?: string };
          if (payload.role !== 'admin') return res.status(403).send('Forbidden');
          const user = await prisma.user.findUnique({
            where: { id: payload.sub },
            select: { isActive: true, deletedAt: true, role: true },
          });
          if (!user || !user.isActive || user.deletedAt || user.role !== 'admin') {
            return res.status(403).send('Forbidden');
          }
          return next();
        } catch {
          return res.status(401).send('Unauthorized');
        }
      };

      httpAdapter.use(basePath, guard, adapter.getRouter());
      Logger.log(`Bull-Board mounted at ${basePath}`, 'Bootstrap');
    }
  } catch (err) {
    Logger.warn(`Failed to mount Bull-Board: ${(err as Error)?.message ?? err}`, 'Bootstrap');
  }

  const swagger = new DocumentBuilder()
    .setTitle('Saxony Smart Campus API')
    .setDescription('B2B SaaS for university operations.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addCookieAuth('refreshToken')
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
