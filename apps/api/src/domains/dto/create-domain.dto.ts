import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * DTO for POST /api/domains
 *
 * Accepts a raw domain string — the service normalizes it:
 *   - lowercase, trim
 *   - strip protocol (https?://)
 *   - strip trailing slashes and paths
 *
 * Examples of valid inputs:
 *   "shop.example.com"
 *   "SHOP.EXAMPLE.COM"      → normalized to "shop.example.com"
 *   "https://shop.example.com/page" → normalized to "shop.example.com"
 *
 * The service validates the normalized result is a proper hostname
 * (no spaces, must contain a dot, only valid hostname characters).
 */
export class CreateDomainDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  domain!: string;
}
