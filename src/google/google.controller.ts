import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CoachRole } from '@prisma/client';
import { GoogleOAuthService } from './google-oauth.service.js';

@Controller('admin/google')
export class GoogleController {
  constructor(private readonly oauthService: GoogleOAuthService) {}

  // Meant to be opened directly in a browser (it 302s to Google's consent
  // screen), so it can't sit behind JwtAuthGuard - a plain navigation can't
  // carry an Authorization header. Not linked anywhere public; see README for
  // the one-time setup flow. Worst case if someone else finds this URL, they
  // connect their own Google account to the app's Meet-link integration -
  // not a data exposure.
  @Get('connect')
  connect(@Res() res: Response) {
    res.redirect(this.oauthService.getAuthUrl());
  }

  // Google redirects the browser here with ?code=... after consent - same
  // reasoning as /connect above, this can't carry a bearer token either.
  @Get('callback')
  async callback(@Query('code') code: string) {
    await this.oauthService.handleCallback(code);
    return { connected: true };
  }

  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CoachRole.ADMIN)
  status() {
    return this.oauthService.status();
  }
}
