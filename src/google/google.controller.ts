import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CurrentCoach } from '../auth/current-coach.decorator.js';
import { TokenService } from '../auth/token.service.js';
import { CoachRole, type Coach } from '@prisma/client';
import { GoogleOAuthService } from './google-oauth.service.js';

@ApiTags('google')
@Controller('admin/google')
export class GoogleController {
  constructor(
    private readonly oauthService: GoogleOAuthService,
    private readonly tokenService: TokenService,
  ) {}

  // Requires a real admin session (unlike /connect and /callback below,
  // this one IS a normal fetch and can carry a bearer token). Mints a
  // short-lived, purpose-scoped token proving an authenticated admin
  // actually asked for this, which the browser then carries through the
  // /connect -> Google consent -> /callback round trip via the OAuth
  // `state` param -- see the comments on those two routes for why that
  // round trip can't just use JwtAuthGuard directly.
  @ApiBearerAuth()
  @Get('connect-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CoachRole.ADMIN)
  connectToken(@CurrentCoach() coach: Coach) {
    return { state: this.tokenService.signGoogleConnectState(coach.id) };
  }

  // Meant to be opened directly in a browser (it 302s to Google's consent
  // screen), so it can't sit behind JwtAuthGuard - a plain navigation can't
  // carry an Authorization header. Instead it requires a valid `state` token
  // minted by /connect-token above, so only someone who already completed an
  // authenticated admin request can reach Google's consent screen through
  // this app. Without this, anyone who finds (or guesses) this URL could
  // connect their own Google account to the site's single shared Meet-link
  // integration, silently redirecting all future clients' names/emails/notes
  // into a stranger's calendar.
  @Get('connect')
  connect(@Query('state') state: string, @Res() res: Response) {
    this.tokenService.verifyGoogleConnectState(state);
    res.redirect(this.oauthService.getAuthUrl(state));
  }

  // Google redirects the browser here with ?code=&state= after consent. The
  // `state` is checked again here for the same reason as /connect: without
  // it, an attacker could skip our /connect entirely, start their own Google
  // consent flow directly against this app's public client ID and registered
  // redirect URI, and land a legitimate `code` on this endpoint.
  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string) {
    this.tokenService.verifyGoogleConnectState(state);
    await this.oauthService.handleCallback(code);
    return { connected: true };
  }

  @ApiBearerAuth()
  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(CoachRole.ADMIN)
  status() {
    return this.oauthService.status();
  }
}
