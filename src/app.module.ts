import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { CoachesModule } from './coaches/coaches.module.js';
import configuration from './config/configuration.js';
import { validateEnv } from './config/env.validation.js';
import { EventTypesModule } from './event-types/event-types.module.js';
import { GoogleModule } from './google/google.module.js';
import { I18nModule } from './i18n/i18n.module.js';
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
    BookingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
