import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function buildOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Betti Coaching Calendar API')
    .setDescription(
      [
        'Booking/calendar backend for a single shared coaching calendar.',
        '',
        'Most endpoints are public (client-facing booking flow, no login).',
        'Coach/admin endpoints require a bearer token from `POST /auth/login`',
        '- click "Authorize" below and paste the `accessToken` from that response.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();

  return SwaggerModule.createDocument(app, config);
}
