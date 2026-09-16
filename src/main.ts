import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { StripPasswordHashInterceptor } from './common/strip-password-hash.interceptor.js';
import type { AppConfig } from './config/configuration.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const { port, frontendUrl } = configService.get<AppConfig>('app')!;

  app.enableCors({ origin: frontendUrl });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new StripPasswordHashInterceptor());

  await app.listen(port);
}
await bootstrap();
