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

// ─── Prisma select shapes ─────────────────────────────────────────────────────

const CREATIVE_CARD_SELECT = {
  id: true,
  sellerId: true,
  productId: true,
  name: true,
  status: true,
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
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type CreativeDetailRow = CreativeCardRow & {
  assets: Array<{
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
      createdAt: Date;
    };
  }>;
};

/** Roles required for a creative to be considered READY */
const READY_MEDIA_ROLES = ['PRIMARY_VIDEO', 'THUMBNAIL'] as const;
const READY_TEXT_ROLES = ['PRIMARY_TEXT'] as const;

@Injectable()
export class CreativesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── CREATE ────────────────────────────────────────────────────────────────

  async createCreative(sellerId: string, dto: CreateCreativeDto) {
    // Validate productId if provided
    if (dto.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
        select: { id: true },
      });
      if (!product) {
        throw new NotFoundException('Product not found');
      }
    }

    const creative = await this.prisma.creative.create({
      data: {
        sellerId,
        name: dto.name,
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
      if (!product) {
        throw new NotFoundException('Product not found');
      }
    }

    const updated = await this.prisma.creative.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.productId !== undefined && { productId: dto.productId }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.metadata !== undefined && { metadata: dto.metadata as object }),
      },
      select: CREATIVE_CARD_SELECT,
    });

    return mapToCardDto(updated as CreativeCardRow);
  }

  // ─── ATTACH ASSET ──────────────────────────────────────────────────────────

  /**
   * Attaches (or replaces) an asset slot in the creative.
   * Uses upsert so attaching to an existing role replaces it.
   *
   * Validates:
   *  - creative belongs to seller
   *  - asset is accessible (owned by seller OR platform asset)
   */
  async attachAsset(sellerId: string, creativeId: string, dto: AttachAssetDto) {
    await this.assertCreativeBelongsToSeller(sellerId, creativeId);
    await this.assertAssetAccessible(sellerId, dto.assetId);

    // Upsert the slot — replace if role already occupied
    const slot = await this.prisma.creativeAsset.upsert({
      where: { uq_creative_asset_role: { creativeId, role: dto.role } },
      create: { creativeId, assetId: dto.assetId, role: dto.role },
      update: { assetId: dto.assetId },
      select: {
        id: true,
        creativeId: true,
        assetId: true,
        role: true,
      },
    });

    return slot;
  }

  // ─── DETACH ASSET ──────────────────────────────────────────────────────────

  /**
   * Removes an asset slot from the creative by role name.
   */
  async detachAsset(sellerId: string, creativeId: string, role: string) {
    await this.assertCreativeBelongsToSeller(sellerId, creativeId);

    const existing = await this.prisma.creativeAsset.findUnique({
      where: { uq_creative_asset_role: { creativeId, role: role as any } },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`No asset attached for role "${role}"`);
    }

    await this.prisma.creativeAsset.delete({
      where: { uq_creative_asset_role: { creativeId, role: role as any } },
    });

    return { detached: true, creativeId, role };
  }

  // ─── VALIDATE → READY ──────────────────────────────────────────────────────

  /**
   * Transitions a creative from DRAFT → READY if it meets the requirements:
   *   - Has at least one of: PRIMARY_VIDEO or THUMBNAIL
   *   - Has PRIMARY_TEXT
   *
   * Throws 400 if requirements not met, or if already READY/ARCHIVED.
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

    const hasMedia =
      roles.has('PRIMARY_VIDEO') || roles.has('THUMBNAIL');
    const hasText = roles.has('PRIMARY_TEXT');

    if (!hasMedia || !hasText) {
      const missing: string[] = [];
      if (!hasMedia) missing.push('PRIMARY_VIDEO or THUMBNAIL');
      if (!hasText) missing.push('PRIMARY_TEXT');
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

  // ─── PRIVATE HELPERS ───────────────────────────────────────────────────────

  private async assertCreativeBelongsToSeller(sellerId: string, id: string) {
    const creative = await this.prisma.creative.findUnique({
      where: { id },
      select: { id: true, sellerId: true, status: true },
    });
    if (!creative || creative.sellerId !== sellerId) {
      throw new NotFoundException('Creative not found');
    }
    return creative;
  }

  /**
   * Asserts asset is accessible by this seller:
   *   - ownerSellerId = sellerId (own asset), OR
   *   - ownerSellerId = null     (platform asset)
   */
  private async assertAssetAccessible(sellerId: string, assetId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, ownerSellerId: true },
    });

    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }

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
