import { IsOptional, IsString } from 'class-validator';

/** Used for the public, client-initiated cancellation - a reason is optional. */
export class ClientCancelBookingDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

/** Used for the coach/admin-initiated cancellation - a reason is mandatory. */
export class CoachCancelBookingDto {
  @IsString()
  reason!: string;
}
