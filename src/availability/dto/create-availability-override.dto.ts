import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateAvailabilityOverrideDto {
  /** Calendar date, e.g. "2026-12-24" */
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsBoolean()
  isUnavailable?: boolean = false;

  @ValidateIf((dto: CreateAvailabilityOverrideDto) => !dto.isUnavailable)
  @IsInt()
  @Min(0)
  @Max(24 * 60)
  startMinute?: number;

  @ValidateIf((dto: CreateAvailabilityOverrideDto) => !dto.isUnavailable)
  @IsInt()
  @Min(0)
  @Max(24 * 60)
  endMinute?: number;
}
