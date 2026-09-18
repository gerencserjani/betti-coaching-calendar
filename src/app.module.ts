import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { CoachesModule } from './coaches/coaches.module.js';
import { RequestLoggingMiddleware } from './common/request-logging.middleware.js';
import configuration from './config/configuration.js';
import { validateEnv } from './config/env.validation.js';
import { EventTypesModule } from './event-types/event-types.module.js';
import { GoogleModule } from './google/google.module.js';
import { I18nModule } from './i18n/i18n.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { SlotsModule } from './slots/slots.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    // Sane default for every route; the handful of public, higher-risk
    // endpoints (login, bookings, slots) set tighter per-route limits via
    // @Throttle. Keyed by IP by default, which is what ThrottlerGuard does
    // out of the box.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    I18nModule,
    AuthModule,
    SettingsModule,
    CoachesModule,
    EventTypesModule,
    AvailabilityModule,
    SlotsModule,
    GoogleModule,
    NotificationsModule,
    JobsModule,
    BookingsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
