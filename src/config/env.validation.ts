import { plainToInstance } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  // Exactly one of DATABASE_URL (local dev/test, no pooled/direct
  // distinction) or the two production-only vars below must be present --
  // checked after class-validator runs, since "at least one of" isn't a
  // single-field constraint. See PrismaService/PgBossService
  // (DATABASE_POOLER_URL) and prisma7.config.ts (DATABASE_DIRECT_URL).
  @IsOptional()
  @IsString()
  DATABASE_URL?: string;

  @IsOptional()
  @IsString()
  DATABASE_POOLER_URL?: string;

  @IsOptional()
  @IsString()
  DATABASE_DIRECT_URL?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  BUSINESS_TIMEZONE!: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  @IsEmail()
  GMAIL_USER!: string;

  @IsString()
  @MinLength(16)
  GMAIL_APP_PASSWORD!: string;

  @IsString()
  EMAIL_FROM!: string;

  // Optional: once set, tenants can switch their own sending over to Resend
  // by setting Settings.emailFrom (see EmailService) -- until then, every
  // tenant keeps sending through the GMAIL_* fallback above. Not required
  // at boot because the app must keep working before any domain is
  // verified in Resend.
  @IsOptional()
  @IsString()
  RESEND_API_KEY?: string;

  @IsString()
  GOOGLE_CLIENT_ID!: string;

  @IsString()
  GOOGLE_CLIENT_SECRET!: string;

  @IsUrl({ require_tld: false })
  GOOGLE_OAUTH_REDIRECT_URI!: string;

  @IsString()
  ENCRYPTION_KEY!: string;

  @IsIn(['development', 'production', 'test'])
  NODE_ENV: string = 'development';
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const message = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment configuration: ${message}`);
  }

  // class-validator can't express "at least one of A or B" on its own --
  // every connection the app/migrations actually make resolves through a
  // DATABASE_POOLER_URL-or-DATABASE_URL / DATABASE_DIRECT_URL-or-DATABASE_URL
  // fallback (see PrismaService/PgBossService/prisma7.config.ts), so fail
  // fast here if a deploy forgets all the vars that one side needs instead
  // of discovering it as a connection error at the first query.
  if (!validated.DATABASE_POOLER_URL && !validated.DATABASE_URL) {
    throw new Error(
      'Invalid environment configuration: set DATABASE_POOLER_URL (production) or DATABASE_URL (local/test)',
    );
  }
  if (!validated.DATABASE_DIRECT_URL && !validated.DATABASE_URL) {
    throw new Error(
      'Invalid environment configuration: set DATABASE_DIRECT_URL (production) or DATABASE_URL (local/test)',
    );
  }

  // class-validator only checks that ENCRYPTION_KEY is a string; AES-256-GCM
  // (see common/crypto.util.ts) needs it to decode from base64 to exactly 32
  // bytes, or every encrypt/decrypt call throws at first use instead of at
  // boot -- most confusingly, the first time someone connects Google Calendar.
  const keyBytes = Buffer.from(validated.ENCRYPTION_KEY, 'base64').length;
  if (keyBytes !== 32) {
    throw new Error(
      `Invalid environment configuration: ENCRYPTION_KEY must decode from base64 to exactly 32 bytes for AES-256 (got ${keyBytes})`,
    );
  }

  return validated;
}
