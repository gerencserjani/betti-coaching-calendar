import { IsInt, Max, Min } from 'class-validator';

export class CreateWeeklyAvailabilityDto {
  /** ISO weekday: 1 = Monday ... 7 = Sunday */
  @IsInt()
  @Min(1)
  @Max(7)
  weekday!: number;

  /** Minutes since midnight, business timezone */
  @IsInt()
  @Min(0)
  @Max(24 * 60)
  startMinute!: number;

  @IsInt()
  @Min(0)
  @Max(24 * 60)
  endMinute!: number;
}
