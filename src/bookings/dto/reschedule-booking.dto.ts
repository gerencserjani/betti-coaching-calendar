import { IsISO8601 } from 'class-validator';

export class RescheduleBookingDto {
  @IsISO8601()
  startAt!: string;
}
