import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetaService } from '../meta/meta.service';
import { BulkStatusDto, BulkBudgetDto } from './dto/bulk-action.dto';

// ─── Rate-limit: 1 sync per seller per 60 seconds ─────────────────────────────
const syncCooldownMs = 60_000;
const lastSyncMap = new Map<string, number>();

// ─── Status transition helpers ────────────────────────────────────────────────

const ACTIVE_TO_PAUSED = ['ACTIVE'];
const PAUSED_TO_ACTIVE = ['PAUSED'];

function canPause(status: string): boolean {
  return ACTIVE_TO_PAUSED.includes(status);
}
function canResume(status: string): boolean {
  return PAUSED_TO_ACTIVE.includes(status);
}

// ─── Meta field mapping for sync ─────────────────────────────────────────────

interface MetaCampaignRow {
  id: string;
  name: string;
  status: string;
  daily_budget?: string;
}

interface MetaAdsetRow {
  id: string;
  name: string;
  status: string;
}

interface MetaAdRow {
  id: string;
  name: string;
  status: string;
}

// ─── AdsManagerActionService ──────────────────────────────────────────────────

@Injectable()
export class AdsManagerActionService {
  private readonly logger = new Logger(AdsManagerActionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly meta: MetaService,
  ) {}

  // ─── BULK STATUS ─────────────────────────────────────────────────────────

  async bulkStatus(sellerId: string, dto: BulkStatusDto) {
    const { entityType, entityIds, action } = dto;

    if (entityIds.length === 0) {
      throw new BadRequestException('entityIds must not be empty');
    }

    const results = {
      updated: 0,
      skipped: 0,
      failed: [] as Array<{ id: string; reason: string }>,
    };

    // Load all entities & verify ownership
    const entities = await this.loadEntities(sellerId, entityType, entityIds);
    const foundIds = new Set(entities.map((e) => e.id));

    for (const id of entityIds) {
      if (!foundIds.has(id)) {
        results.failed.push({ id, reason: 'Not found or does not belong to seller' });
        continue;
      }
    }

    // Filter valid entities & check transitions
    const toUpdate: Array<{ id: string; externalId: string | null; adAccountId: string | null }> = [];

    for (const entity of entities) {
      const canTransition =
        action === 'pause' ? canPause(entity.status) : canResume(entity.status);

      if (!canTransition) {
        results.skipped++;
        results.failed.push({
          id: entity.id,
          reason: `Cannot ${action} entity with status ${entity.status}`,
        });
        continue;
      }
      toUpdate.push(entity);
    }

    if (toUpdate.length === 0) {
      return results;
    }

    const newStatus = action === 'pause' ? 'PAUSED' : 'ACTIVE';

    // Batch DB update (single transaction)
    await this.batchUpdateStatus(entityType, toUpdate.map((e) => e.id), newStatus);
    results.updated += toUpdate.length;

    // Meta sync (graceful, sequential)
    for (const entity of toUpdate) {
      if (entity.externalId && entity.adAccountId) {
        try {
          await this.meta.post(
            entity.adAccountId,
            entity.externalId,
            { status: newStatus },
          );
        } catch (err) {
          this.logger.warn(
            `Meta sync failed for ${entityType} ${entity.id}: ${(err as Error).message}`,
          );
        }
      }
    }

    return results;
  }

  // ─── BULK BUDGET ─────────────────────────────────────────────────────────

  async bulkBudget(sellerId: string, dto: BulkBudgetDto) {
    const { campaignIds, budget, budgetType } = dto;

    const results = {
      updated: 0,
      skipped: 0,
      failed: [] as Array<{ id: string; reason: string }>,
    };

    // Load all campaigns & verify ownership
    const campaigns = await this.prisma.campaign.findMany({
      where: { id: { in: campaignIds }, sellerId },
      select: { id: true, externalCampaignId: true, adAccountId: true },
    });

    const foundIds = new Set(campaigns.map((c) => c.id));
    for (const id of campaignIds) {
      if (!foundIds.has(id)) {
        results.failed.push({ id, reason: 'Campaign not found or does not belong to seller' });
      }
    }

    if (campaigns.length === 0) {
      return results;
    }

    // Batch DB update
    const updateData: Record<string, unknown> = { budget };
    if (budgetType) updateData['budgetType'] = budgetType;

    await this.prisma.campaign.updateMany({
      where: { id: { in: campaigns.map((c) => c.id) } },
      data: updateData as never,
    });
    results.updated += campaigns.length;

    // Meta sync (graceful, sequential)
    for (const campaign of campaigns) {
      if (campaign.externalCampaignId) {
        try {
          const metaPayload: Record<string, unknown> = {
            daily_budget: Math.round(budget * 100), // Meta uses cents
          };
          if (budgetType === 'LIFETIME') {
            delete metaPayload['daily_budget'];
            metaPayload['lifetime_budget'] = Math.round(budget * 100);
          }
          await this.meta.post(
            campaign.adAccountId,
            campaign.externalCampaignId,
            metaPayload,
          );
        } catch (err) {
          this.logger.warn(
            `Meta budget sync failed for campaign ${campaign.id}: ${(err as Error).message}`,
          );
        }
      }
    }

    return results;
  }

  // ─── MANUAL SYNC FROM META ────────────────────────────────────────────────

  async syncFromMeta(sellerId: string) {
    // Rate limit: 1 sync per seller per 60s
    const now = Date.now();
    const lastSync = lastSyncMap.get(sellerId) ?? 0;
    if (now - lastSync < syncCooldownMs) {
      const waitSec = Math.ceil((syncCooldownMs - (now - lastSync)) / 1000);
      throw new BadRequestException(
        `Sync rate limited. Please wait ${waitSec}s before syncing again.`,
      );
    }
    lastSyncMap.set(sellerId, now);

    const result = {
      synced: { campaigns: 0, adsets: 0, ads: 0 },
      errors: [] as Array<{ accountName: string; reason: string }>,
      lastSyncAt: new Date().toISOString(),
    };

    // Load active AD_ACCOUNT FbConnections
    const adAccounts = await this.prisma.fbConnection.findMany({
      where: { sellerId, connectionType: 'AD_ACCOUNT', isActive: true },
      select: { id: true, externalId: true, name: true },
    });

    for (const adAccount of adAccounts) {
      try {
        // Sync campaigns
        const metaPath = `act_${adAccount.externalId}/campaigns`;
        const campaignRes = await this.meta.get<{ data: MetaCampaignRow[] }>(
          adAccount.id,
          metaPath,
          { fields: 'id,name,status,daily_budget', limit: '100' },
        );

        for (const mc of campaignRes.data ?? []) {
          const local = await this.prisma.campaign.findFirst({
            where: { externalCampaignId: mc.id, sellerId },
            select: { id: true, adAccountId: true },
          });
          if (local) {
            const updateData: Record<string, unknown> = {
              status: this.mapMetaCampaignStatus(mc.status),
            };
            if (mc.daily_budget) {
              updateData['budget'] = Number(mc.daily_budget) / 100;
            }
            await this.prisma.campaign.update({
              where: { id: local.id },
              data: updateData as never,
            });
            result.synced.campaigns++;
          }
        }

        // Sync adsets
        const adsetPath = `act_${adAccount.externalId}/adsets`;
        const adsetRes = await this.meta.get<{ data: MetaAdsetRow[] }>(
          adAccount.id,
          adsetPath,
          { fields: 'id,name,status', limit: '100' },
        );

        for (const mas of adsetRes.data ?? []) {
          const localAdset = await this.prisma.adset.findFirst({
            where: { externalAdsetId: mas.id, sellerId },
            select: { id: true },
          });
          if (localAdset) {
            await this.prisma.adset.update({
              where: { id: localAdset.id },
              data: { status: this.mapMetaCampaignStatus(mas.status) as never },
            });
            result.synced.adsets++;
          }
        }

        // Sync ads
        const adPath = `act_${adAccount.externalId}/ads`;
        const adRes = await this.meta.get<{ data: MetaAdRow[] }>(
          adAccount.id,
          adPath,
          { fields: 'id,name,status', limit: '100' },
        );

        for (const ma of adRes.data ?? []) {
          const localAd = await this.prisma.ad.findFirst({
            where: { externalAdId: ma.id, sellerId },
            select: { id: true },
          });
          if (localAd) {
            await this.prisma.ad.update({
              where: { id: localAd.id },
              data: { status: this.mapMetaCampaignStatus(ma.status) as never },
            });
            result.synced.ads++;
          }
        }
      } catch (err) {
        const reason = (err as Error).message ?? 'Unknown error';
        this.logger.warn(
          `Sync failed for ad account "${adAccount.name}" (${adAccount.id}): ${reason}`,
        );
        result.errors.push({ accountName: adAccount.name ?? adAccount.id, reason });
      }
    }

    return result;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Load entities by type + verify seller ownership.
   * Returns id, status, externalId, and adAccountId (resolved for meta calls).
   */
  private async loadEntities(
    sellerId: string,
    entityType: string,
    ids: string[],
  ): Promise<Array<{ id: string; status: string; externalId: string | null; adAccountId: string | null }>> {
    if (entityType === 'campaign') {
      const rows = await this.prisma.campaign.findMany({
        where: { id: { in: ids }, sellerId },
        select: { id: true, status: true, externalCampaignId: true, adAccountId: true },
      });
      return rows.map((r) => ({
        id: r.id,
        status: r.status.toString(),
        externalId: r.externalCampaignId,
        adAccountId: r.adAccountId,
      }));
    }

    if (entityType === 'adset') {
      const rows = await this.prisma.adset.findMany({
        where: { id: { in: ids }, sellerId },
        select: {
          id: true,
          status: true,
          externalAdsetId: true,
          campaign: { select: { adAccountId: true } },
        },
      });
      return rows.map((r) => ({
        id: r.id,
        status: r.status.toString(),
        externalId: r.externalAdsetId,
        adAccountId: r.campaign?.adAccountId ?? null,
      }));
    }

    if (entityType === 'ad') {
      const rows = await this.prisma.ad.findMany({
        where: { id: { in: ids }, sellerId },
        select: {
          id: true,
          status: true,
          externalAdId: true,
          adset: {
            select: {
              campaign: { select: { adAccountId: true } },
            },
          },
        },
      });
      return rows.map((r) => ({
        id: r.id,
        status: r.status.toString(),
        externalId: r.externalAdId,
        adAccountId: r.adset?.campaign?.adAccountId ?? null,
      }));
    }

    return [];
  }

  private async batchUpdateStatus(
    entityType: string,
    ids: string[],
    newStatus: string,
  ) {
    if (entityType === 'campaign') {
      await this.prisma.campaign.updateMany({
        where: { id: { in: ids } },
        data: { status: newStatus as never },
      });
    } else if (entityType === 'adset') {
      await this.prisma.adset.updateMany({
        where: { id: { in: ids } },
        data: { status: newStatus as never },
      });
    } else if (entityType === 'ad') {
      await this.prisma.ad.updateMany({
        where: { id: { in: ids } },
        data: { status: newStatus as never },
      });
    }
  }

  /** Map Meta campaign status string to local CampaignStatus enum string */
  private mapMetaCampaignStatus(metaStatus: string): string {
    switch (metaStatus?.toUpperCase()) {
      case 'ACTIVE': return 'ACTIVE';
      case 'PAUSED': return 'PAUSED';
      case 'ARCHIVED': return 'ARCHIVED';
      case 'DELETED': return 'ARCHIVED';
      default: return 'PAUSED';
    }
  }
}
