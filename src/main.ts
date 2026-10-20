import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AllowedOriginsService } from './allowed-origins/allowed-origins.service.js';
import { AppModule } from './app.module.js';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';
import { isLocalhostOrigin } from './common/origin.util.js';
import { StripPasswordHashInterceptor } from './common/strip-password-hash.interceptor.js';
import type { AppConfig } from './config/configuration.js';
import { buildOpenApiDocument } from './swagger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const { port } = configService.get<AppConfig>('app')!;
  const allowedOriginsService = app.get(AllowedOriginsService);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      // No Origin header at all (server-to-server, curl, same-origin) --
      // nothing to check against.
      if (!origin || isLocalhostOrigin(origin)) {
        callback(null, true);
        return;
      }
      allowedOriginsService.isAllowed(origin).then(
        (allowed) => callback(null, allowed),
        (error: Error) => callback(error, false),
      );
    },
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new StripPasswordHashInterceptor());
  app.useGlobalFilters(new PrismaExceptionFilter());

  // Interactive docs at /docs, raw spec at /docs-json (and /docs-yaml) - a
  // frontend agent can fetch /docs-json directly instead of reading source.
  SwaggerModule.setup('docs', app, buildOpenApiDocument(app));

  // Without this, OnModuleDestroy hooks (e.g. PgBossService's graceful
  // boss.stop()) never run - Nest only wires SIGTERM/SIGINT to app.close()
  // when shutdown hooks are explicitly enabled. Cloud Run sends SIGTERM on
  // every scale-down/redeploy, so this matters in practice, not just in theory.
  app.enableShutdownHooks();

  await app.listen(port);
}
await bootstrap();
