import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateCoachDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(['hu', 'en'])
  preferredLocale?: string;
}
