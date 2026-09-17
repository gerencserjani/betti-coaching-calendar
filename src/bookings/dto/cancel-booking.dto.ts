import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Used for the public, client-initiated cancellation - a reason is optional. */
export class ClientCancelBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

/** Used for the coach/admin-initiated cancellation - a reason is mandatory. */
export class CoachCancelBookingDto {
  @IsString()
  @MaxLength(2000)
  reason!: string;
}
