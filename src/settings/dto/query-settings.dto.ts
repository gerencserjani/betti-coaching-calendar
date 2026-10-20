import { IsString } from 'class-validator';

export class QuerySettingsDto {
  // See QueryEventTypesDto for why this is required on a public endpoint.
  @IsString()
  coachId!: string;
}
