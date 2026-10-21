import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsTimeZone,
  Max,
  Min,
} from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  businessAddress?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 30)
  cancellationNoticeHours?: number;

  @IsOptional()
  @IsTimeZone()
  businessTimezone?: string;

  // Set only once this tenant's domain is verified in Resend -- switches
  // EmailService over from the shared GMAIL_* fallback to Resend for this
  // tenant. Pass null to revert to the Gmail fallback.
  @IsOptional()
  @IsString()
  emailFrom?: string | null;

  // Public-facing business name for booking email letterheads -- see
  // BookingEmail.tsx and Settings.brandName. Null/omitted falls back to
  // Coach.name.
  @IsOptional()
  @IsString()
  brandName?: string | null;

  // Shown under brandName in the email letterhead. Null/omitted omits the
  // tagline line entirely.
  @IsOptional()
  @IsString()
  brandTagline?: string | null;

  // `{ light: {...}, dark: {...} }` -- see EmailBrandPalette (BookingEmail.
  // tsx). Structural validation (required keys, hex colors) happens in
  // SettingsService, not here -- see email-brand-palette.util.ts's own
  // comment for why.
  @IsOptional()
  @IsObject()
  emailBrandPalette?: Record<string, unknown> | null;
}
