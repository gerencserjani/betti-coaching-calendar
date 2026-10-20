import { IsOptional, IsString } from 'class-validator';

/**
 * Shared by authenticated, coach-scoped endpoints that accept an optional
 * `coachId` override (see `resolveCoachScope` in `ownership.util.ts`) --
 * unlike the public endpoints' required `coachId` (QueryEventTypesDto,
 * QuerySettingsDto), the caller's own coach is already known from the JWT,
 * so this only matters for an ADMIN naming a specific coach's site.
 */
export class OptionalCoachIdQueryDto {
  @IsOptional()
  @IsString()
  coachId?: string;
}
