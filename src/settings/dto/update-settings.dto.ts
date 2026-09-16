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
}
