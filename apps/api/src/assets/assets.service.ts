import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Phase 1 stub stats added to all asset items.
 * spend and roas will be populated from real data in Phase 2 (MetaProvider).
 */
const STUB_STATS = {
  spend: 0,
  roas: null as number | null,
};

export interface AssetMediaItem {
  id: string;
  version: string;
  url: string;
  mediaType: string;
  durationSec: number | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  position: number;
  isCurrent: boolean;
  createdAt: string;
  // Phase 1 stub stats
  spend: number;
  roas: number | null;
}

export interface AssetThumbnailItem {
  id: string;
  version: string;
  url: string;
  width: number | null;
  height: number | null;
  position: number;
  isCurrent: boolean;
  createdAt: string;
  // Phase 1 stub stats
  spend: number;
  roas: number | null;
}

export interface AssetAdtextItem {
  id: string;
  version: string;
  primaryText: string;
  headline: string;
  description: string | null;
  createdAt: string;
  // Phase 1 stub stats
  spend: number;
  roas: number | null;
}

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Private: verify product exists and is ACTIVE
  // ─────────────────────────────────────────────────────────────────────────

  private async assertProductActive(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, status: true },
    });
    if (!product || product.status !== 'ACTIVE') {
      throw new NotFoundException('Product not found');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MEDIA
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET /api/products/:id/assets/media
   *
   * Returns all media assets for the product, ordered by version asc
   * then position asc. Stub stats (spend: 0, roas: null) are appended
   * per item — will be replaced by real MetaProvider data in Phase 2.
   *
   * Version format: "v1", "v2", "b1", "b2" (v = video variant, b = B-roll).
   */
  async getMedia(productId: string): Promise<AssetMediaItem[]> {
    await this.assertProductActive(productId);

    const rows = await this.prisma.assetMedia.findMany({
      where: { productId },
      orderBy: [{ version: 'asc' }, { position: 'asc' }],
      select: {
        id: true,
        version: true,
        url: true,
        mediaType: true,
        durationSec: true,
        fileSize: true,
        width: true,
        height: true,
        position: true,
        isCurrent: true,
        createdAt: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      version: r.version,
      url: r.url,
      mediaType: r.mediaType,
      durationSec: r.durationSec,
      fileSize: r.fileSize,
      width: r.width,
      height: r.height,
      position: r.position,
      isCurrent: r.isCurrent,
      createdAt: r.createdAt.toISOString(),
      ...STUB_STATS,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // THUMBNAILS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET /api/products/:id/assets/thumbnails
   *
   * Returns all thumbnail assets, ordered by version then position.
   * Stub stats appended per item.
   */
  async getThumbnails(productId: string): Promise<AssetThumbnailItem[]> {
    await this.assertProductActive(productId);

    const rows = await this.prisma.assetThumbnail.findMany({
      where: { productId },
      orderBy: [{ version: 'asc' }, { position: 'asc' }],
      select: {
        id: true,
        version: true,
        url: true,
        width: true,
        height: true,
        position: true,
        isCurrent: true,
        createdAt: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      version: r.version,
      url: r.url,
      width: r.width,
      height: r.height,
      position: r.position,
      isCurrent: r.isCurrent,
      createdAt: r.createdAt.toISOString(),
      ...STUB_STATS,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AD TEXTS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET /api/products/:id/assets/adtexts
   *
   * Returns all ad text assets, ordered by version asc.
   * Stub stats appended per item.
   */
  async getAdtexts(productId: string): Promise<AssetAdtextItem[]> {
    await this.assertProductActive(productId);

    const rows = await this.prisma.assetAdtext.findMany({
      where: { productId },
      orderBy: { version: 'asc' },
      select: {
        id: true,
        version: true,
        primaryText: true,
        headline: true,
        description: true,
        createdAt: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      version: r.version,
      primaryText: r.primaryText,
      headline: r.headline,
      description: r.description,
      createdAt: r.createdAt.toISOString(),
      ...STUB_STATS,
    }));
  }
}
