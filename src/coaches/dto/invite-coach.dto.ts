import { IsEmail, IsString, IsUrl, MinLength } from 'class-validator';

export class InviteCoachDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  // The coach's own frontend's origin (e.g. https://peti-coaching.vercel.app)
  // -- the admin provides this since there's no other way for the backend
  // to know it at invite time. Used only to build the invite link; not
  // persisted (see CONTEXT.md's "Booking email links, per coach" for why
  // ongoing emails instead derive this per-booking from the request's own
  // Origin header).
  @IsUrl({ require_tld: false })
  frontendUrl!: string;
}
