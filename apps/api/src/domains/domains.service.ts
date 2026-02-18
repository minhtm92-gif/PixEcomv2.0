import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import { UpdateDomainDto } from './dto/update-domain.dto';
import { VerifyDomainDto } from './dto/verify-domain.dto';

// ─── Prisma select shapes ─────────────────────────────────────────────────────

const DOMAIN_SELECT = {
  id: true,
  sellerId: true,
  hostname: true,
  status: true,
  isPrimary: true,
  verificationMethod: true,
  verificationToken: true,
  verifiedAt: true,
  failureReason: true,
  createdAt: true,
  updatedAt: true,
} as const;

type DomainRow = {
  id: string;
  sellerId: string;
  hostname: string;
  status: string;
  isPrimary: boolean;
  verificationMethod: string;
  verificationToken: string;
  verifiedAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Hostname validation regex ────────────────────────────────────────────────

/**
 * Validates a hostname:
 *  - 1–255 chars
 *  - Each label (dot-separated) is 1–63 chars of [a-z0-9-]
 *  - Labels cannot start or end with a hyphen
 *  - Must contain at least one dot (so bare labels like "localhost" are rejected)
 */
const HOSTNAME_REGEX =
  /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?){1,}$/;

@Injectable()
export class DomainsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Adds a custom domain for the seller.
   *
   * Normalizes the input:
   *   - lowercase, trim
   *   - strip protocol (http:// or https://)
   *   - strip path and query string
   *
   * Validates:
   *   - normalized hostname matches HOSTNAME_REGEX
   *   - not already registered by this seller (409 uq_seller_domain)
   *   - not already registered by any seller (409 global unique on hostname)
   *
   * Returns the domain with a stub verification record:
   *   type: TXT  |  name: _pixecom  |  value: <random-hex-token>
   */
  async createDomain(sellerId: string, dto: CreateDomainDto) {
    const hostname = normalizeDomain(dto.domain);

    if (!isValidHostname(hostname)) {
      throw new BadRequestException(
        `"${dto.domain}" is not a valid hostname. ` +
          'Provide a bare domain like "shop.example.com" (no protocol, no path).',
      );
    }

    // Global uniqueness check (across all sellers).
    // We use findFirst on hostname — the DB-level unique index applied via
    // migration prevents duplicates even if two concurrent requests race.
    const globalExisting = await this.prisma.sellerDomain.findFirst({
      where: { hostname },
      select: { id: true, sellerId: true },
    });
    if (globalExisting) {
      if (globalExisting.sellerId === sellerId) {
        throw new ConflictException(
          `Domain "${hostname}" is already registered to your account`,
        );
      }
      throw new ConflictException(
        `Domain "${hostname}" is already registered by another seller`,
      );
    }

    const verificationToken = randomBytes(24).toString('hex');

    const domain = await this.prisma.sellerDomain.create({
      data: {
        sellerId,
        hostname,
        verificationMethod: 'TXT',
        verificationToken,
        status: 'PENDING',
        isPrimary: false,
      },
      select: DOMAIN_SELECT,
    });

    return mapToDomainDto(domain);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIST
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns all domains belonging to the seller, ordered by createdAt desc.
   */
  async listDomains(sellerId: string) {
    const domains = await this.prisma.sellerDomain.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      select: DOMAIN_SELECT,
    });
    return domains.map((d) => mapToDomainDto(d as DomainRow));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE (set primary)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Updates a domain — currently only supports isPrimary.
   *
   * When isPrimary=true, all other domains for this seller are unset in the
   * same transaction so there is always at most one primary per seller.
   */
  async updateDomain(sellerId: string, id: string, dto: UpdateDomainDto) {
    if (dto.isPrimary === undefined) {
      throw new BadRequestException(
        'At least one field must be provided for update',
      );
    }

    await this.assertDomainBelongsToSeller(sellerId, id);

    if (dto.isPrimary === true) {
      // Transaction: unset all other primaries then set this one
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.sellerDomain.updateMany({
          where: { sellerId, isPrimary: true, id: { not: id } },
          data: { isPrimary: false },
        });
        return tx.sellerDomain.update({
          where: { id },
          data: { isPrimary: true },
          select: DOMAIN_SELECT,
        });
      });
      return mapToDomainDto(updated as DomainRow);
    }

    // isPrimary=false — just unset
    const updated = await this.prisma.sellerDomain.update({
      where: { id },
      data: { isPrimary: false },
      select: DOMAIN_SELECT,
    });
    return mapToDomainDto(updated as DomainRow);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Deletes a domain.
   *
   * Throws 409 if the domain is currently used by one or more sellpages.
   * (The FK is SET NULL on delete, but we enforce explicit confirmation to
   * prevent silent link removal from live pages.)
   */
  async deleteDomain(sellerId: string, id: string) {
    await this.assertDomainBelongsToSeller(sellerId, id);

    const usedCount = await this.prisma.sellpage.count({
      where: { domainId: id },
    });
    if (usedCount > 0) {
      throw new ConflictException(
        `Domain is used by ${usedCount} sellpage(s). ` +
          'Remove the domain from all sellpages before deleting.',
      );
    }

    await this.prisma.sellerDomain.delete({ where: { id } });
    return { deleted: true, id };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VERIFY (stub)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Phase 1 stub — marks the domain as VERIFIED immediately when { force: true }.
   *
   * Phase 2 will replace this with a real DNS TXT lookup using the
   * verificationToken stored on the domain record.
   */
  async verifyDomain(sellerId: string, id: string, dto: VerifyDomainDto) {
    if (!dto.force) {
      throw new BadRequestException(
        'Pass { "force": true } to confirm stub verification. ' +
          'Phase 2 will perform a real DNS TXT check.',
      );
    }

    const domain = await this.assertDomainBelongsToSeller(sellerId, id);

    if (domain.status === 'VERIFIED') {
      throw new BadRequestException('Domain is already verified');
    }

    const updated = await this.prisma.sellerDomain.update({
      where: { id },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        failureReason: null,
      },
      select: DOMAIN_SELECT,
    });

    return mapToDomainDto(updated as DomainRow);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Asserts domain exists and belongs to this seller.
   * Returns domain row with status for caller use.
   * Throws 404 if not found or belongs to another seller.
   */
  private async assertDomainBelongsToSeller(sellerId: string, id: string) {
    const domain = await this.prisma.sellerDomain.findUnique({
      where: { id },
      select: { id: true, sellerId: true, status: true, isPrimary: true },
    });
    if (!domain || domain.sellerId !== sellerId) {
      throw new NotFoundException('Domain not found');
    }
    return domain;
  }
}

// ─── Module-level pure functions ──────────────────────────────────────────────

/**
 * Normalizes a raw domain input:
 *   1. Trim whitespace
 *   2. Lowercase
 *   3. Strip protocol prefix (http:// or https://)
 *   4. Strip everything after the first / (path, query, fragment)
 *   5. Strip port number (e.g., :8080)
 *
 * Examples:
 *   "HTTPS://Shop.Example.com/products?q=1" → "shop.example.com"
 *   "  shop.EXAMPLE.com  "                  → "shop.example.com"
 *   "shop.example.com:443"                  → "shop.example.com"
 */
export function normalizeDomain(raw: string): string {
  let s = raw.trim().toLowerCase();
  // Strip protocol
  s = s.replace(/^https?:\/\//, '');
  // Strip path, query, fragment
  s = s.split('/')[0];
  // Strip port
  s = s.split(':')[0];
  return s;
}

/**
 * Returns true if the hostname is a valid, fully-qualified hostname.
 * Rejects bare labels (no dot), invalid chars, too-long labels.
 */
export function isValidHostname(hostname: string): boolean {
  if (!hostname || hostname.length > 255) return false;
  return HOSTNAME_REGEX.test(hostname);
}

/**
 * Maps a Prisma SellerDomain row to the API response DTO.
 * The verification object matches the shape clients need to configure DNS.
 */
function mapToDomainDto(domain: DomainRow) {
  return {
    id: domain.id,
    hostname: domain.hostname,
    status: domain.status,
    isPrimary: domain.isPrimary,
    verification: {
      type: domain.verificationMethod,
      name: '_pixecom',
      value: domain.verificationToken,
    },
    verifiedAt: domain.verifiedAt ? domain.verifiedAt.toISOString() : null,
    failureReason: domain.failureReason,
    createdAt: domain.createdAt.toISOString(),
    updatedAt: domain.updatedAt.toISOString(),
  };
}
