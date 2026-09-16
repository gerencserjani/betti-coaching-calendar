import { IsDateString, IsString } from 'class-validator';

export class QuerySlotsDto {
  @IsString()
  eventTypeId!: string;

  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}
