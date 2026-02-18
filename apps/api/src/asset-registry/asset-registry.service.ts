import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@pixecom/database';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../media/r2.service';
import { IngestAssetDto } from './dto/ingest-asset.dto';
import { ListAssetsDto } from './dto/list-assets.dto';
import { RegisterAssetDto } from './dto/register-asset.dto';
import { SignedUploadDto } from './dto/signed-upload.dto';

/** Prisma select shape for asset rows */
const ASSET_SELECT = {
  id: true,
  ownerSellerId: true,
  sourceType: true,
  ingestionId: true,
  mediaType: true,
  url: true,
  storageKey: true,
  mimeType: true,
  fileSizeBytes: true,
  durationSec: true,
  width: true,
  height: true,
  checksum: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} as const;

type AssetRow = {
  id: string;
  ownerSellerId: string | null;
  sourceType: string;
  ingestionId: string | null;
  mediaType: string;
  url: string;
  storageKey: string | null;
  mimeType: string | null;
  fileSizeBytes: bigint | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  checksum: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

const MAX_PAGE_LIMIT = 100;

// ─── De-dup input shape ────────────────────────────────────────────────────

interface DedupeAndCreateInput {
  ownerSellerId: string | null;
  sourceType: string;
  ingestionId: string | null;
  mediaType: string;
  url: string;
  storageKey?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  durationSec?: number | null;
  width?: number | null;
  height?: number | null;
  checksum?: string | null;
  metadata?: object;
}

@Injectable()
export class AssetRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  // ─── Signed Upload ──────────────────────────────────────────────────────

  /**
   * Generates a presigned PUT URL for direct S3/R2 upload.
   * The client uploads directly; then calls POST /api/assets to register.
   */
  async getSignedUploadUrl(sellerId: string, dto: SignedUploadDto) {
    const key = this.r2.buildKey(sellerId, dto.filename);
    const { uploadUrl, publicUrl } = await this.r2.getSignedUploadUrl(
      key,
      dto.contentType,
    );
    return {
      uploadUrl,
      publicUrl,
      storageKey: key,
      expiresInSeconds: 300,
    };
  }

  // ─── Register (seller) ──────────────────────────────────────────────────

  /**
   * Seller self-registers an asset after uploading to R2.
   * De-duplication rules:
   *   1. If ingestionId present → unique by (sourceType=USER_UPLOAD, ingestionId)
   *   2. Else if checksum present → unique by (ownerSellerId, checksum)
   *   3. Else → create new record
   */
  async registerAsset(sellerId: string, dto: RegisterAssetDto) {
    return this.resolveExistingAssetOrCreate({
      ownerSellerId: sellerId,
      sourceType: 'USER_UPLOAD',
      ingestionId: dto.ingestionId ?? null,
      mediaType: dto.mediaType,
      url: dto.url,
      storageKey: dto.storageKey ?? null,
      mimeType: dto.mimeType ?? null,
      fileSizeBytes: dto.fileSizeBytes ?? null,
      durationSec: dto.durationSec ?? null,
      width: dto.width ?? null,
      height: dto.height ?? null,
      checksum: dto.checksum ?? null,
      metadata: (dto.metadata as object) ?? {},
    });
  }

  // ─── List ────────────────────────────────────────────────────────────────

  /**
   * Returns paginated assets visible to this seller:
   *   - Seller's own assets (ownerSellerId = sellerId)
   *   - Platform assets    (ownerSellerId = null)
   */
  async listAssets(sellerId: string, dto: ListAssetsDto) {
    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 20, MAX_PAGE_LIMIT);
    const skip = (page - 1) * limit;

    const platformOnly =
      dto.platformOnly === true || dto.platformOnly === 'true';

    const where = buildListWhere(sellerId, dto.mediaType, platformOnly);

    const [assets, total] = await this.prisma.$transaction([
      this.prisma.asset.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: ASSET_SELECT,
      }),
      this.prisma.asset.count({ where }),
    ]);

    return {
      data: assets.map((a) => mapToAssetDto(a as AssetRow)),
      total,
      page,
      limit,
    };
  }

  // ─── Get One ─────────────────────────────────────────────────────────────

  /**
   * Returns a single asset by id.
   * Accessible if:
   *   - ownerSellerId = sellerId (own asset), OR
   *   - ownerSellerId = null (platform asset)
   */
  async getAsset(sellerId: string, id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      select: ASSET_SELECT,
    });

    if (!asset) throw new NotFoundException('Asset not found');

    const isOwn = asset.ownerSellerId === sellerId;
    const isPlatform = asset.ownerSellerId === null;

    if (!isOwn && !isPlatform) {
      throw new NotFoundException('Asset not found');
    }

    return mapToAssetDto(asset as AssetRow);
  }

  // ─── Ingest (API key / superadmin) ──────────────────────────────────────

  /**
   * Internal ingestion endpoint for pipelines (PIXCON, partner API, migration).
   * De-duplication rules (deterministic, single helper):
   *   1. If ingestionId present → unique by (sourceType, ingestionId)
   *   2. Else if checksum present → unique by (ownerSellerId, checksum)
   *   3. Else → create new record
   */
  async ingestAsset(dto: IngestAssetDto) {
    return this.resolveExistingAssetOrCreate({
      ownerSellerId: dto.ownerSellerId ?? null,
      sourceType: dto.sourceType,
      ingestionId: dto.ingestionId ?? null,
      mediaType: dto.mediaType,
      url: dto.url,
      storageKey: dto.storageKey ?? null,
      mimeType: dto.mimeType ?? null,
      fileSizeBytes: dto.fileSizeBytes ?? null,
      durationSec: dto.durationSec ?? null,
      width: dto.width ?? null,
      height: dto.height ?? null,
      checksum: dto.checksum ?? null,
      metadata: (dto.metadata as object) ?? {},
    });
  }

  // ─── PRIVATE: De-dup helper ───────────────────────────────────────────────

  /**
   * Single deterministic de-duplication + create helper.
   *
   * Rules (applied in order):
   *   1. ingestionId present  → findFirst by (sourceType, ingestionId); return if found
   *   2. checksum present     → findFirst by (ownerSellerId, checksum); return if found
   *   3. neither              → create fresh record
   */
  private async resolveExistingAssetOrCreate(
    input: DedupeAndCreateInput,
  ): Promise<ReturnType<typeof mapToAssetDto>> {
    // Rule 1: ingestionId-based de-dup
    if (input.ingestionId) {
      const existing = await this.prisma.asset.findFirst({
        where: { sourceType: input.sourceType as any, ingestionId: input.ingestionId },
        select: ASSET_SELECT,
      });
      if (existing) return mapToAssetDto(existing as AssetRow);
    }

    // Rule 2: checksum-based de-dup
    if (input.checksum) {
      const existing = await this.prisma.asset.findFirst({
        where: { ownerSellerId: input.ownerSellerId, checksum: input.checksum },
        select: ASSET_SELECT,
      });
      if (existing) return mapToAssetDto(existing as AssetRow);
    }

    // Rule 3: create
    const asset = await this.prisma.asset.create({
      data: {
        ownerSellerId: input.ownerSellerId,
        sourceType: input.sourceType as any,
        ingestionId: input.ingestionId,
        mediaType: input.mediaType as any,
        url: input.url,
        storageKey: input.storageKey ?? null,
        mimeType: input.mimeType ?? null,
        fileSizeBytes: input.fileSizeBytes != null ? BigInt(input.fileSizeBytes) : null,
        durationSec: input.durationSec ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        checksum: input.checksum ?? null,
        metadata: input.metadata ?? {},
      },
      select: ASSET_SELECT,
    });

    return mapToAssetDto(asset as AssetRow);
  }
}

// ─── Module-level helpers ──────────────────────────────────────────────────

function buildListWhere(
  sellerId: string,
  mediaType?: string,
  platformOnly?: boolean,
): Prisma.AssetWhereInput {
  const ownerFilter: Prisma.AssetWhereInput = platformOnly
    ? { ownerSellerId: null }
    : {
        OR: [
          { ownerSellerId: sellerId },
          { ownerSellerId: null },
        ],
      };

  if (mediaType) {
    const mediaFilter = { mediaType } as Prisma.AssetWhereInput;
    return { AND: [ownerFilter, mediaFilter] };
  }
  return ownerFilter;
}

function mapToAssetDto(asset: AssetRow) {
  return {
    id: asset.id,
    ownerSellerId: asset.ownerSellerId,
    sourceType: asset.sourceType,
    ingestionId: asset.ingestionId,
    mediaType: asset.mediaType,
    url: asset.url,
    storageKey: asset.storageKey,
    mimeType: asset.mimeType,
    // BigInt → number (safe for file sizes < 2^53)
    fileSizeBytes: asset.fileSizeBytes !== null ? Number(asset.fileSizeBytes) : null,
    durationSec: asset.durationSec,
    width: asset.width,
    height: asset.height,
    checksum: asset.checksum,
    metadata: asset.metadata,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}
