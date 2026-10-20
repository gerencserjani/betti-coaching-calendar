import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { oauth2 } from '@googleapis/oauth2';
import { OAuth2Client } from 'google-auth-library';
import { decrypt, encrypt } from '../common/crypto.util.js';
import type { AppConfig } from '../config/configuration.js';
import { PrismaService } from '../prisma/prisma.service.js';

// calendar.events for Meet-link creation, userinfo.email so the
// oauth2.userinfo.get() call below (used to record connectedEmail) is
// actually authorized -- without it, that call 401s even though the token
// exchange itself succeeds, since the granted token only carries whatever
// scopes were requested here.
const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private newOAuthClient(): OAuth2Client {
    const { google: googleConfig } = this.configService.get<AppConfig>('app')!;
    // One registered OAuth app (GOOGLE_CLIENT_ID/SECRET) for the whole
    // platform, shared across every coach's own connection -- this isn't
    // per-coach data, same as e.g. a "Sign in with Google" SaaS using one
    // OAuth app for many end users' own Google accounts.
    return new OAuth2Client(
      googleConfig.clientId,
      googleConfig.clientSecret,
      googleConfig.redirectUri,
    );
  }

  getAuthUrl(state: string): string {
    const client = this.newOAuthClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: CALENDAR_SCOPES,
      state,
    });
  }

  async handleCallback(code: string, coachId: string): Promise<void> {
    if (!code) {
      throw new BadRequestException('Missing authorization code');
    }
    const client = this.newOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      throw new BadRequestException(
        'Google did not return a refresh token. Revoke prior access at https://myaccount.google.com/permissions and try connecting again.',
      );
    }
    client.setCredentials(tokens);

    const oauth2Client = oauth2({ auth: client, version: 'v2' });
    const { data: userInfo } = await oauth2Client.userinfo.get();

    const { encryptionKey } = this.configService.get<AppConfig>('app')!;
    await this.prisma.googleIntegration.upsert({
      where: { coachId },
      create: {
        coachId,
        refreshTokenEncrypted: encrypt(tokens.refresh_token, encryptionKey),
        connectedEmail: userInfo.email ?? 'unknown',
      },
      update: {
        refreshTokenEncrypted: encrypt(tokens.refresh_token, encryptionKey),
        connectedEmail: userInfo.email ?? 'unknown',
        connectedAt: new Date(),
      },
    });
    // Worth its own log line regardless of level: this changes which Google
    // account every future Meet-link booking for this coach is created in.
    this.logger.log(
      `Google Calendar connected for coach ${coachId}: ${userInfo.email ?? 'unknown'}`,
    );
  }

  async status(coachId: string): Promise<{
    connected: boolean;
    connectedEmail?: string;
    connectedAt?: Date;
  }> {
    const integration = await this.prisma.googleIntegration.findUnique({
      where: { coachId },
    });
    if (!integration) {
      return { connected: false };
    }
    return {
      connected: true,
      connectedEmail: integration.connectedEmail,
      connectedAt: integration.connectedAt,
    };
  }

  async getAuthenticatedClient(coachId: string): Promise<OAuth2Client> {
    const integration = await this.prisma.googleIntegration.findUnique({
      where: { coachId },
    });
    if (!integration) {
      throw new ServiceUnavailableException(
        'Google Calendar is not connected yet',
      );
    }
    const { encryptionKey } = this.configService.get<AppConfig>('app')!;
    const refreshToken = decrypt(
      integration.refreshTokenEncrypted,
      encryptionKey,
    );

    const client = this.newOAuthClient();
    client.setCredentials({ refresh_token: refreshToken });
    return client;
  }
}
