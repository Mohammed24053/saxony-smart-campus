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
  // refresh-token cookie path).
  app.use(cookieParser());

  // Request-id propagation for log correlation. Generates a UUID per request
  // (or accepts a client-supplied X-Request-Id) and echoes it back on the
  // response so the admin can surface it for support tickets.
  //
  // We constrain accepted client values to `[A-Za-z0-9._-]{1,128}` to avoid
  // log-injection / response-splitting via header smuggling — a malicious
  // client otherwise could embed control characters into the value, which
  // then end up in plaintext log lines.
  const REQUEST_ID_RE = /^[A-Za-z0-9._-]{1,128}$/;
  app.use((req: Request, res: Response, next: NextFunction) => {
    const incoming = (req.headers['x-request-id'] || req.headers['x-correlation-id']) as
      | string
      | undefined;
    const id = incoming && REQUEST_ID_RE.test(incoming) ? incoming : uuid();
    (req as Request & { id?: string }).id = id;
    res.setHeader('X-Request-Id', id);
    next();
  });

  app.enableCors({
    origin: cfg.adminWebOrigin === '*' ? true : cfg.adminWebOrigin.split(',').map((s) => s.trim()),
    credentials: true,
    exposedHeaders: ['X-Request-Id'],
  });

  app.useGlobalPipes(buildValidationPipe());

  // Allow Nest to gracefully drain Bull/Redis/Socket.io connections on SIGTERM.
  app.enableShutdownHooks();

  // Bull-Board admin UI for inspecting Bull queues. Mounted on
  // `/{apiPrefix}/admin/queues`, behind a Bearer-token middleware that
  // requires `role === 'admin'`. Tokens may also be supplied via
  // `?access_token=…` so an admin can open the UI from a deep link.
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

      // Bull-Board guard. Only accepts a Bearer token in the Authorization
      // header — query-string tokens used to be supported but were dropped
      // because they leak into nginx / cdn / browser-history access logs and
      // referrer chains (CWE-598).
      const guard = async (req: Request, res: Response, next: NextFunction) => {
        try {
          const headerToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
          if (!headerToken) {
            res.setHeader('WWW-Authenticate', 'Bearer realm="bull-board"');
            return res.status(401).send('Unauthorized');
          }
          const payload = (await jwt.verifyAsync(headerToken)) as { sub: string; role?: string };
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

  // Swagger UI surfaces the full API contract (routes, DTOs, error codes) and
  // is therefore reconnaissance gold for an attacker. We expose it only in
  // non-production, or when the operator explicitly opts in via
  // `ENABLE_SWAGGER_UI=true`. Production deploys should keep it disabled.
  const swaggerEnabled = cfg.nodeEnv !== 'production' || process.env.ENABLE_SWAGGER_UI === 'true';
  if (swaggerEnabled) {
    const swagger = new DocumentBuilder()
      .setTitle('Saxony Smart Campus API')
      .setDescription('B2B SaaS for university operations.')
      .setVersion('1.0.0')
      .addBearerAuth()
      .addCookieAuth('refreshToken')
      .build();
    const document = SwaggerModule.createDocument(app, swagger);
    SwaggerModule.setup(`${cfg.apiPrefix}/docs`, app, document);
  } else {
    Logger.log('Swagger UI disabled (NODE_ENV=production)', 'Bootstrap');
  }

  await app.listen(cfg.port);
  Logger.log(
    `Saxony Smart Campus backend listening on http://localhost:${cfg.port}/${cfg.apiPrefix}`,
    'Bootstrap',
  );
}

bootstrap();
