export interface AppConfig {
  port: number;
  businessTimezone: string;
  frontendUrl: string;
  jwtSecret: string;
  emailFrom: string;
  gmail: {
    user: string;
    appPassword: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  encryptionKey: string;
}

export default (): { app: AppConfig } => ({
  app: {
    port: parseInt(process.env.PORT ?? '3000', 10),
    businessTimezone: process.env.BUSINESS_TIMEZONE ?? 'Europe/Budapest',
    frontendUrl: process.env.FRONTEND_URL ?? '',
    jwtSecret: process.env.JWT_SECRET ?? '',
    emailFrom: process.env.EMAIL_FROM ?? '',
    gmail: {
      user: process.env.GMAIL_USER ?? '',
      appPassword: process.env.GMAIL_APP_PASSWORD ?? '',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI ?? '',
    },
    encryptionKey: process.env.ENCRYPTION_KEY ?? '',
  },
});
