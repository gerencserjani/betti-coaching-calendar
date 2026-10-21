import { IsUrl } from 'class-validator';

export class SetFrontendUrlDto {
  // Must match one of the admin's already-allow-listed AllowedOrigin rows,
  // same rule CoachesService.invite() enforces for a brand-new coach -- see
  // that DTO's comment for why.
  @IsUrl({ require_tld: false })
  frontendUrl!: string;
}
