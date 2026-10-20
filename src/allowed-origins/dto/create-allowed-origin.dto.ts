import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateAllowedOriginDto {
  // IsUrl with require_tld: false -- an origin like http://localhost:5173
  // or https://foo.run.app has no path, which IsUrl otherwise tolerates
  // fine, but require_tld would wrongly reject a bare IP/host in dev setups.
  @IsUrl({ require_tld: false })
  origin!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;
}
