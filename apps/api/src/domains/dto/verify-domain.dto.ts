import { IsBoolean } from 'class-validator';

/**
 * DTO for POST /api/domains/:id/verify
 *
 * Phase 1 stub — requires { force: true } to explicitly confirm intent.
 * This guard prevents accidental calls during development.
 *
 * Phase 2: replace stub with real DNS TXT record lookup.
 */
export class VerifyDomainDto {
  @IsBoolean()
  force!: boolean;
}
