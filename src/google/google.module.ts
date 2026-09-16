import { Module } from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service.js';
import { GoogleController } from './google.controller.js';
import { GoogleOAuthService } from './google-oauth.service.js';

@Module({
  controllers: [GoogleController],
  providers: [GoogleOAuthService, GoogleCalendarService],
  exports: [GoogleOAuthService, GoogleCalendarService],
})
export class GoogleModule {}
