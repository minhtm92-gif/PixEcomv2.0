import { IsBoolean, IsOptional } from 'class-validator';

/**
 * DTO for PATCH /api/domains/:id
 *
 * Currently only supports setting isPrimary.
 * Setting isPrimary=true unsets all other primary domains for this seller
 * (enforced in the service via a transaction).
 */
export class UpdateDomainDto {
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
