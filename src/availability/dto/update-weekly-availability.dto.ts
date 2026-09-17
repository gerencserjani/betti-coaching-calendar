import { PartialType } from '@nestjs/mapped-types';
import { CreateWeeklyAvailabilityDto } from './create-weekly-availability.dto.js';

export class UpdateWeeklyAvailabilityDto extends PartialType(
  CreateWeeklyAvailabilityDto,
) {}
