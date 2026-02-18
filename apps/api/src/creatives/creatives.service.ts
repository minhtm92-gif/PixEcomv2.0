import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttachAssetDto } from './dto/attach-asset.dto';
import { CreateCreativeDto } from './dto/create-creative.dto';
import { UpdateCreativeDto } from './dto/update-creative.dto';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Roles that are single-slot (only one per creative). EXTRA is multi-slot. */
const SINGLE_SLOT_ROLES = new Set([
  'PRIMARY_VIDEO',
  'THUMBNAIL',
  'PRIMARY_TEXT',
  'HEADLINE',
  'DESCRIPTION',
] as const);

/** READY validation rules by creativeType */
const READY_RULES: Record<
  string,
  (roles: Set<string>) => { pass: boolean; missing: string[] }
> = {
  VIDEO_AD: (roles) => {
    const missing: string[] = [];
    if (!roles.has('PRIMARY_VIDEO') && !roles.has('THUMBNAIL')) {
      missing.push('PRIMARY_VIDEO or THUMBNAIL');
    }
    if (!roles.has('THUMBNAIL')) missing.push('THUMBNAIL');
    if (!roles.has('PRIMARY_TEXT')) missing.push('PRIMARY_TEXT');
    // De-dup — if both media and thumbnail are missing, report once
    const dedupMissing = Array.from(new Set(missing));
    return { pass: dedupMissing.length === 0, missing: dedupMissing };
  },
  IMAGE_AD: (roles) => {
    const missing: string[] = [];
    if (!roles.has('THUMBNAIL')) missing.push('IMAGE (THUMBNAIL role)');
    if (!roles.has('PRIMARY_TEXT')) missing.push('PRIMARY_TEXT');
    return { pass: missing.length === 0, missing };
  },
  TEXT_ONLY: (roles) => {
    const missing: string[] = [];
    if (!roles.has('PRIMARY_TEXT')) missing.push('PRIMARY_TEXT');
    return { pass: missing.length === 0, missing };
  },
  UGC_BUNDLE: (roles) => {
    const missing: string[] = [];
    if (!roles.has('PRIMARY_VIDEO')) missing.push('PRIMARY_VIDEO');
    return { pass: missing.length === 0, missing };
  },
};

// ─── Prisma select shapes ─────────────────────────────────────────────────────

const CREATIVE_CARD_SELECT = {
  id: true,
  sellerId: true,
  productId: true,
  name: true,
  status: true,
  creativeType: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} as const;

const CREATIVE_DETAIL_SELECT = {
  id: true,
  sellerId: true,
  productId: true,
  name: true,
  status: true,
  creativeType: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  assets: {
    select: {
      id: true,
      role: true,
      asset: {
        select: {
          id: true,
          ownerSellerId: true,
          sourceType: true,
          mediaType: true,
          url: true,
          mimeType: true,
          fileSizeBytes: true,
          durationSec: true,
          width: true,
          height: true,
          metadata: true,
          createdAt: true,
        },
      },
    },
  },
};

type CreativeCardRow = {
  id: string;
  sellerId: string;
  productId: string | null;
  name: string;
  status: string;
  creativeType: string;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type AssetSlotRow = {
  id: string;
  role: string;
  asset: {
    id: string;
    ownerSellerId: string | null;
    sourceType: string;
    mediaType: string;
    url: string;
    mimeType: string | null;
    fileSizeBytes: bigint | null;
    durationSec: number | null;
    width: number | null;
    height: number | null;
    metadata: unknown;
    createdAt: Date;
  };
};

type CreativeDetailRow = CreativeCardRow & { assets: AssetSlotRow[] };

@Injectable()
export class CreativesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── CREATE ────────────────────────────────────────────────────────────────

  async createCreative(sellerId: string, dto: CreateCreativeDto) {
    if (dto.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
        select: { id: true },
      });
      if (!product) throw new NotFoundException('Product not found');
    }

    const creative = await this.prisma.creative.create({
      data: {
        sellerId,
        name: dto.name,
        creativeType: (dto.creativeType ?? 'VIDEO_AD') as any,
        productId: dto.productId ?? null,
        metadata: (dto.metadata as object) ?? {},
      },
      select: CREATIVE_CARD_SELECT,
    });

    return mapToCardDto(creative as CreativeCardRow);
  }

  // ─── LIST ──────────────────────────────────────────────────────────────────

  async listCreatives(sellerId: string) {
    const creatives = await this.prisma.creative.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      select: CREATIVE_CARD_SELECT,
    });
    return creatives.map((c) => mapToCardDto(c as CreativeCardRow));
  }

  // ─── GET ONE ───────────────────────────────────────────────────────────────

  async getCreative(sellerId: string, id: string) {
    const creative = await this.prisma.creative.findUnique({
      where: { id },
      select: CREATIVE_DETAIL_SELECT,
    });
    if (!creative || creative.sellerId !== sellerId) {
      throw new NotFoundException('Creative not found');
    }
    return mapToDetailDto(creative as unknown as CreativeDetailRow);
  }

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  async updateCreative(sellerId: string, id: string, dto: UpdateCreativeDto) {
    const hasFields =
      dto.name !== undefined ||
      dto.productId !== undefined ||
      dto.status !== undefined ||
      dto.creativeType !== undefined ||
      dto.metadata !== undefined;

    if (!hasFields) {
      throw new BadRequestException('At least one field must be provided');
    }

    await this.assertCreativeBelongsToSeller(sellerId, id);

    if (dto.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
        select: { id: true },
      });
      if (!product) throw new NotFoundException('Product not found');
    }

    const updated = await this.prisma.creative.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.productId !== undefined && { productId: dto.productId }),
        ...(dto.status !== undefined && { status: dto.status as any }),
        ...(dto.creativeType !== undefined && { creativeType: dto.creativeType as any }),
        ...(dto.metadata !== undefined && { metadata: dto.metadata as object }),
      },
      select: CREATIVE_CARD_SELECT,
    });

    return mapToCardDto(updated as CreativeCardRow);
  }

  // ─── ATTACH ASSET ──────────────────────────────────────────────────────────

  /**
   * Attaches (or replaces) an asset slot in the creative.
   *
   * - Single-slot roles (non-EXTRA): upsert via conditional unique index.
   * - EXTRA role: always creates a new row (multi-slot).
   *
   * Validates:
   *  - creative belongs to seller
   *  - asset is accessible (owned by seller OR platform asset)
   */
  async attachAsset(sellerId: string, creativeId: string, dto: AttachAssetDto) {
    await this.assertCreativeBelongsToSeller(sellerId, creativeId);
    await this.assertAssetAccessible(sellerId, dto.assetId);

    if (dto.role === 'EXTRA') {
      // Multi-slot: always insert a new row
      const slot = await this.prisma.creativeAsset.create({
        data: { creativeId, assetId: dto.assetId, role: 'EXTRA' },
        select: { id: true, creativeId: true, assetId: true, role: true },
      });
      return slot;
    }

    // Single-slot: use raw upsert via ON CONFLICT
    // Prisma upsert requires the named unique index — but we removed @@unique from schema.
    // Instead we use deleteFirst + create in a transaction (atomic, simple).
    const slot = await this.prisma.$transaction(async (tx) => {
      // Delete existing slot for this role if present
      await tx.creativeAsset.deleteMany({
        where: { creativeId, role: dto.role as any },
      });
      // Insert fresh
      return tx.creativeAsset.create({
        data: { creativeId, assetId: dto.assetId, role: dto.role as any },
        select: { id: true, creativeId: true, assetId: true, role: true },
      });
    });

    return slot;
  }

  // ─── DETACH ASSET ──────────────────────────────────────────────────────────

  /**
   * For single-slot roles: removes the slot by role name.
   * For EXTRA: removes ALL EXTRA slots (or callers pass assetId to target one).
   */
  async detachAsset(sellerId: string, creativeId: string, role: string) {
    await this.assertCreativeBelongsToSeller(sellerId, creativeId);

    const slots = await this.prisma.creativeAsset.findMany({
      where: { creativeId, role: role as any },
      select: { id: true },
    });

    if (slots.length === 0) {
      throw new NotFoundException(`No asset attached for role "${role}"`);
    }

    await this.prisma.creativeAsset.deleteMany({
      where: { creativeId, role: role as any },
    });

    return { detached: true, creativeId, role, count: slots.length };
  }

  // ─── VALIDATE → READY ──────────────────────────────────────────────────────

  /**
   * Transitions a creative from DRAFT → READY based on creativeType rules.
   *
   * Rules by type:
   *   VIDEO_AD:   PRIMARY_VIDEO (or THUMBNAIL as fallback) + THUMBNAIL + PRIMARY_TEXT
   *   IMAGE_AD:   THUMBNAIL + PRIMARY_TEXT
   *   TEXT_ONLY:  PRIMARY_TEXT
   *   UGC_BUNDLE: PRIMARY_VIDEO
   */
  async validateCreative(sellerId: string, id: string) {
    const creative = await this.assertCreativeBelongsToSeller(sellerId, id);

    if (creative.status === 'READY') {
      throw new BadRequestException('Creative is already READY');
    }
    if (creative.status === 'ARCHIVED') {
      throw new BadRequestException('Cannot validate an archived creative');
    }

    const slots = await this.prisma.creativeAsset.findMany({
      where: { creativeId: id },
      select: { role: true },
    });
    const roles = new Set(slots.map((s) => s.role));

    const rule = READY_RULES[creative.creativeType] ?? READY_RULES['VIDEO_AD'];
    const { pass, missing } = rule(roles);

    if (!pass) {
      throw new BadRequestException(
        `Creative is missing required assets: ${missing.join(', ')}`,
      );
    }

    const updated = await this.prisma.creative.update({
      where: { id },
      data: { status: 'READY' },
      select: CREATIVE_CARD_SELECT,
    });

    return mapToCardDto(updated as CreativeCardRow);
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────

  /**
   * Returns a compiled render payload for ad delivery:
   * Resolves asset slots to typed fields, reads text content from metadata.
   */
  async renderCreative(sellerId: string, id: string) {
    const creative = await this.prisma.creative.findUnique({
      where: { id },
      select: CREATIVE_DETAIL_SELECT,
    });

    if (!creative || creative.sellerId !== sellerId) {
      throw new NotFoundException('Creative not found');
    }

    const detail = creative as unknown as CreativeDetailRow;

    // Build role → asset map (for single-slot roles, last write wins)
    const slotMap = new Map<string, AssetSlotRow['asset']>();
    const extraSlots: AssetSlotRow['asset'][] = [];

    for (const slot of detail.assets) {
      if (slot.role === 'EXTRA') {
        extraSlots.push(slot.asset);
      } else {
        slotMap.set(slot.role, slot.asset);
      }
    }

    const primaryVideo = slotMap.get('PRIMARY_VIDEO');
    const thumbnail = slotMap.get('THUMBNAIL');
    const primaryText = slotMap.get('PRIMARY_TEXT');
    const headline = slotMap.get('HEADLINE');
    const description = slotMap.get('DESCRIPTION');

    // Resolve text content: prefer asset.metadata.content, fall back to asset.url
    const resolveText = (asset?: AssetSlotRow['asset']): string | undefined => {
      if (!asset) return undefined;
      const meta = asset.metadata as Record<string, unknown> | null;
      return (meta?.content as string) ?? asset.url;
    };

    return {
      id: detail.id,
      creativeType: detail.creativeType,
      status: detail.status,
      videoUrl: primaryVideo?.url ?? null,
      imageUrl: thumbnail?.url ?? null,
      thumbnailUrl: thumbnail?.url ?? null,
      primaryText: resolveText(primaryText) ?? null,
      headline: resolveText(headline) ?? null,
      description: resolveText(description) ?? null,
      extras: extraSlots.map((a) => ({ url: a.url, mediaType: a.mediaType })),
    };
  }

  // ─── PRIVATE HELPERS ───────────────────────────────────────────────────────

  private async assertCreativeBelongsToSeller(sellerId: string, id: string) {
    const creative = await this.prisma.creative.findUnique({
      where: { id },
      select: { id: true, sellerId: true, status: true, creativeType: true },
    });
    if (!creative || creative.sellerId !== sellerId) {
      throw new NotFoundException('Creative not found');
    }
    return creative;
  }

  private async assertAssetAccessible(sellerId: string, assetId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, ownerSellerId: true },
    });
    if (!asset) throw new NotFoundException(`Asset ${assetId} not found`);

    const isOwn = asset.ownerSellerId === sellerId;
    const isPlatform = asset.ownerSellerId === null;

    if (!isOwn && !isPlatform) {
      throw new ForbiddenException('Asset does not belong to this seller');
    }
    return asset;
  }
}

// ─── Module-level pure mapping functions ──────────────────────────────────────

function mapToCardDto(creative: CreativeCardRow) {
  return {
    id: creative.id,
    sellerId: creative.sellerId,
    productId: creative.productId,
    name: creative.name,
    status: creative.status,
    creativeType: creative.creativeType,
    metadata: creative.metadata,
    createdAt: creative.createdAt.toISOString(),
    updatedAt: creative.updatedAt.toISOString(),
  };
}

function mapToDetailDto(creative: CreativeDetailRow) {
  const card = mapToCardDto(creative);
  return {
    ...card,
    assets: creative.assets.map((slot) => ({
      id: slot.id,
      role: slot.role,
      asset: {
        id: slot.asset.id,
        ownerSellerId: slot.asset.ownerSellerId,
        sourceType: slot.asset.sourceType,
        mediaType: slot.asset.mediaType,
        url: slot.asset.url,
        mimeType: slot.asset.mimeType,
        fileSizeBytes:
          slot.asset.fileSizeBytes !== null
            ? Number(slot.asset.fileSizeBytes)
            : null,
        durationSec: slot.asset.durationSec,
        width: slot.asset.width,
        height: slot.asset.height,
        createdAt: slot.asset.createdAt.toISOString(),
      },
    })),
  };
}
