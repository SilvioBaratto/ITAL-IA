/**
 * Vercel serverless entry point.
 *
 * NestJS is bootstrapped once per cold start and the underlying Express
 * instance is reused across invocations within the same function container.
 * This avoids repeated bootstrap overhead and keeps Prisma connections alive
 * between warm requests.
 */
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import helmet from 'helmet';
import express, { Express } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaClientExceptionFilter } from './common/filters/prisma-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

const APP_VERSION = process.env.npm_package_version ?? '1.0.0';

let cachedApp: Express | null = null;

async function createExpressApp(): Promise<Express> {
  const logger = new Logger('ServerlessBootstrap');
  const expressInstance = express();
  const adapter = new ExpressAdapter(expressInstance);

  const app = await NestFactory.create(AppModule, adapter, {
    logger: ['error', 'warn', 'log'],
  });

  app.enableShutdownHooks();

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
        },
      },
    }),
  );

  const corsOrigins =
    process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? [
      'http://localhost:4200',
      'http://localhost:4300',
    ];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Accept',
      'Origin',
      'User-Agent',
      'X-Requested-With',
      'X-Client-Info',
      'X-Dev-User',
    ],
    exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
    maxAge: 3600,
  });

  app.setGlobalPrefix('api/v1', {
    exclude: ['docs', 'docs/(.*)'],
  });

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(
    new HttpExceptionFilter(),
    new PrismaClientExceptionFilter(httpAdapter),
  );

  app.useGlobalInterceptors(new TransformInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ITAL-IA API')
    .setDescription('Italy regional discovery API')
    .setVersion(APP_VERSION)
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, cleanupOpenApiDoc(document));

  const expressApp = app.getHttpAdapter().getInstance() as Express;
  expressApp.get('/', (_req, res) => {
    res.json({
      message: 'Welcome to the ITAL-IA API!',
      version: APP_VERSION,
      status: 'operational',
      environment: process.env.NODE_ENV ?? 'production',
      api_version: 'v1',
      docs_url: '/docs',
    });
  });
  expressApp.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  await app.init();

  logger.log('NestJS application initialised for serverless runtime');
  return expressInstance;
}

export async function getApp(): Promise<Express> {
  if (!cachedApp) {
    cachedApp = await createExpressApp();
  }
  return cachedApp;
}
