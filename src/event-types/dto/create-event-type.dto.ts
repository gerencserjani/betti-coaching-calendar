import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { LocationType } from '@prisma/client';

export class CreateEventTypeDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(5)
  @Max(24 * 60)
  durationMinutes!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(LocationType, { each: true })
  locations!: LocationType[];

  /** Whole HUF amount. Optional - omit or send 0 for "no price shown". */
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  /** Display order in the public catalog. Defaults to appended at the end. */
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
