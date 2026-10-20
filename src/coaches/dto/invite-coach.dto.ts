import { IsEmail, IsString, IsUrl, MinLength } from 'class-validator';

export class InviteCoachDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  // Must match one of the admin's already-allow-listed AllowedOrigin rows
  // (see #35) -- CoachesService.invite() checks this, so an invite can only
  // ever point at a real, known site, not a freehand URL. Persisted as
  // Coach.frontendUrl once the invite is accepted; AllowedOrigin itself
  // stays a separate, global, coach-agnostic CORS list -- it is not where
  // "which coach owns this site" gets recorded.
  @IsUrl({ require_tld: false })
  frontendUrl!: string;
}
