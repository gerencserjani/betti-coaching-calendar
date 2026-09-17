import { plainToInstance } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsString()
  DATABASE_URL!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  BUSINESS_TIMEZONE!: string;

  @IsUrl({ require_tld: false })
  FRONTEND_URL!: string;

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
