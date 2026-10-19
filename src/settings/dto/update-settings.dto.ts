import {
  IsInt,
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
}
