import { IsDateString, IsOptional, IsString } from 'class-validator';

export class QuerySlotsDto {
  @IsString()
  eventTypeId!: string;

  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  // Set when rescheduling: the booking's own current slot would otherwise
  // conflict with itself and never show up as pickable.
  @IsOptional()
  @IsString()
  excludeBookingId?: string;
}
