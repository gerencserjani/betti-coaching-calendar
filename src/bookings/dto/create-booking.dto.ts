import {
  IsEmail,
  IsEnum,
  IsIn,
  IsISO8601,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LocationType } from '@prisma/client';

export class CreateBookingDto {
  @IsString()
  eventTypeId!: string;

  @IsISO8601()
  startAt!: string;

  @IsEnum(LocationType)
  location!: LocationType;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  clientName!: string;

  @IsEmail()
  clientEmail!: string;

  @IsPhoneNumber()
  clientPhone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  clientNote?: string;

  @IsIn(['hu', 'en'])
  locale!: string;
}
