import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { decrypt, encrypt } from '../common/crypto.util.js';
import type { AppConfig } from '../config/configuration.js';
import { PrismaService } from '../prisma/prisma.service.js';

const GOOGLE_INTEGRATION_ID = 'singleton';
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
    return new google.auth.OAuth2(
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

  async handleCallback(code: string): Promise<void> {
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

    const oauth2 = google.oauth2({ auth: client, version: 'v2' });
    const { data: userInfo } = await oauth2.userinfo.get();

    const { encryptionKey } = this.configService.get<AppConfig>('app')!;
    await this.prisma.googleIntegration.upsert({
      where: { id: GOOGLE_INTEGRATION_ID },
      create: {
        id: GOOGLE_INTEGRATION_ID,
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
    // account every future Meet-link booking is created in.
    this.logger.log(
      `Google Calendar connected: ${userInfo.email ?? 'unknown'}`,
    );
  }

  async status(): Promise<{
    connected: boolean;
    connectedEmail?: string;
    connectedAt?: Date;
  }> {
    const integration = await this.prisma.googleIntegration.findUnique({
      where: { id: GOOGLE_INTEGRATION_ID },
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

  async getAuthenticatedClient(): Promise<OAuth2Client> {
    const integration = await this.prisma.googleIntegration.findUnique({
      where: { id: GOOGLE_INTEGRATION_ID },
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
