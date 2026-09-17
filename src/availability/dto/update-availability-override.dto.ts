import { PartialType } from '@nestjs/mapped-types';
import { CreateAvailabilityOverrideDto } from './create-availability-override.dto.js';

export class UpdateAvailabilityOverrideDto extends PartialType(
  CreateAvailabilityOverrideDto,
) {}
