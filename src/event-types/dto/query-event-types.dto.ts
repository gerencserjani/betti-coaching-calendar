import { IsString } from 'class-validator';

export class QueryEventTypesDto {
  // Public, unauthenticated endpoint -- no domain/subdomain resolution
  // exists (see #14), so the frontend tells us directly which coach's
  // catalog it wants. Each frontend deployment is configured with its own
  // coachId (see betti-coaching's VITE_COACH_ID) -- one backend serving
  // multiple independent frontends this way.
  @IsString()
  coachId!: string;
}
