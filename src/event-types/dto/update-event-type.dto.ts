import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateEventTypeDto } from './create-event-type.dto.js';

export class UpdateEventTypeDto extends PartialType(CreateEventTypeDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
