import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ListCampaignsQueryDto } from './dto/list-campaigns.dto';

export const QUEUE_NAME = 'stats-sync';
const LEVELS: Array<'CAMPAIGN' | 'ADSET' | 'AD'> = ['CAMPAIGN', 'ADSET', 'AD'];
const DEFAULT_LIMIT = 50;

interface StatsSyncJobData {
  sellerId: string;
  dateFrom: string;
  dateTo: string;
  level: 'CAMPAIGN' | 'ADSET' | 'AD';
}

// ── Response shapes (public contract) ────────────────────────────────────────

export interface CampaignStats {
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  roas: number;
}

export interface CampaignRow {
  id: string;
  name: string;
  status: string;
  dailyBudget: number;
  budgetType: string;
  sellpage: { id: string; url: string };
  fbConnection: { id: string; adAccountExternalId: string };
  stats: CampaignStats;
}

export interface ListCampaignsResult {
  dateFrom: string;
  dateTo: string;
  rows: CampaignRow[];
  nextCursor: string | null;
}

// ── AdsManagerService ─────────────────────────────────────────────────────────

@Injectable()
export class AdsManagerService implements OnModuleInit, OnModuleDestroy {
  private queue!: Queue<StatsSyncJobData>;
  private connection!: IORedis;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue<StatsSyncJobData>(QUEUE_NAME, {
      connection: this.connection as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }

  async onModuleDestroy() {
    await this.queue.close();
    await this.connection.quit();
  }

  // ── Manual sync enqueue ─────────────────────────────────────────────────────

  /**
   * Enqueue CAMPAIGN + ADSET + AD sync jobs for the seller on the given date.
   * BullMQ jobId dedup ensures duplicate calls for the same seller/date are ignored.
   */
  async enqueueSync(sellerId: string, date: string): Promise<string[]> {
    const jobIds: string[] = [];
    for (const level of LEVELS) {
      // BullMQ v5+ forbids ':' in custom jobIds — use '__' separator
      const jobId = `sync__${sellerId}__${date}__${date}__${level}`;
      await this.queue.add(
        'stats-sync',
        { sellerId, dateFrom: date, dateTo: date, level },
        { jobId },
      );
      jobIds.push(jobId);
    }
    return jobIds;
  }

  // ── Campaign listing with aggregated stats ──────────────────────────────────

  async getCampaigns(
    sellerId: string,
    query: ListCampaignsQueryDto,
  ): Promise<ListCampaignsResult> {
    const dateFrom = query.dateFrom ?? this.todayUTC();
    const dateTo = query.dateTo ?? this.todayUTC();
    const limit = query.limit ?? DEFAULT_LIMIT;
    const sortBy = query.sortBy ?? 'spend';
    const sortDir = query.sortDir ?? 'desc';

    // ── Query 1: Fetch campaigns ──────────────────────────────────────────────
    const statusFilter = this.buildStatusFilter(query);

    const campaigns = await this.prisma.campaign.findMany({
      where: {
        sellerId,
        ...statusFilter,
        ...(query.sellpageId ? { sellpageId: query.sellpageId } : {}),
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),  // cursor pagination
      },
      select: {
        id: true,
        name: true,
        status: true,
        budget: true,
        budgetType: true,
        sellpage: {
          select: {
            id: true,
            slug: true,
            domain: { select: { hostname: true } },
          },
        },
        adAccount: {
          select: {
            id: true,
            externalId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      // Fetch one extra to determine nextCursor
      take: limit + 1,
    });

    const hasNextPage = campaigns.length > limit;
    const pageRows = hasNextPage ? campaigns.slice(0, limit) : campaigns;
    const nextCursor = hasNextPage ? pageRows[pageRows.length - 1].id : null;

    if (pageRows.length === 0) {
      return { dateFrom, dateTo, rows: [], nextCursor: null };
    }

    // ── Query 2: Aggregate stats for these campaign IDs in the date range ─────
    const campaignIds = pageRows.map((c) => c.id);
    const statsMap = await this.aggregateStats(campaignIds, dateFrom, dateTo);

    // ── Build response rows ───────────────────────────────────────────────────
    const rows: CampaignRow[] = pageRows.map((c) => {
      const stats = statsMap.get(c.id) ?? ZERO_STATS;
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        dailyBudget: Number(c.budget),
        budgetType: c.budgetType,
        sellpage: {
          id: c.sellpage.id,
          url: buildSellpageUrl(c.sellpage.slug, c.sellpage.domain),
        },
        fbConnection: {
          id: c.adAccount.id,
          adAccountExternalId: c.adAccount.externalId,
        },
        stats,
      };
    });

    // ── Client-side sort by stats field ──────────────────────────────────────
    // (DB sort on stats would need a subquery; simpler and fast enough at these volumes)
    rows.sort((a, b) => {
      const aVal = a.stats[sortBy as keyof CampaignStats] as number;
      const bVal = b.stats[sortBy as keyof CampaignStats] as number;
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return { dateFrom, dateTo, rows, nextCursor };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Aggregate ad_stats_daily for the given campaign IDs over the date range.
   * Single query, no N+1.
   * Returns a Map<campaignId, CampaignStats>.
   */
  private async aggregateStats(
    campaignIds: string[],
    dateFrom: string,
    dateTo: string,
  ): Promise<Map<string, CampaignStats>> {
    const grouped = await this.prisma.adStatsDaily.groupBy({
      by: ['entityId'],
      where: {
        entityType: 'CAMPAIGN',
        entityId: { in: campaignIds },
        statDate: {
          gte: new Date(`${dateFrom}T00:00:00.000Z`),
          lte: new Date(`${dateTo}T00:00:00.000Z`),
        },
      },
      _sum: {
        spend: true,
        impressions: true,
        linkClicks: true,
        purchases: true,
        purchaseValue: true,
      },
    });

    const map = new Map<string, CampaignStats>();
    for (const row of grouped) {
      const spend = Number(row._sum.spend ?? 0);
      const purchaseValue = Number(row._sum.purchaseValue ?? 0);
      map.set(row.entityId, {
        spend,
        impressions: Number(row._sum.impressions ?? 0),
        clicks: Number(row._sum.linkClicks ?? 0),
        purchases: Number(row._sum.purchases ?? 0),
        revenue: purchaseValue,
        roas: spend > 0 ? round4(purchaseValue / spend) : 0,
      });
    }
    return map;
  }

  /**
   * Build Prisma where filter for campaign status.
   * Default: ACTIVE + PAUSED (exclude DELETED always).
   * If includeArchived=true and no status filter: ACTIVE + PAUSED + ARCHIVED.
   * If explicit status filter provided: use that.
   */
  private buildStatusFilter(query: ListCampaignsQueryDto): object {
    if (query.status) {
      // Explicit status filter — but never include DELETED
      return { status: query.status };
    }
    if (query.includeArchived) {
      return { status: { in: ['ACTIVE', 'PAUSED', 'ARCHIVED'] } };
    }
    return { status: { in: ['ACTIVE', 'PAUSED'] } };
  }

  /** Returns today's date in YYYY-MM-DD (UTC). */
  todayUTC(): string {
    return new Date().toISOString().slice(0, 10);
  }
}

// ── Module-level helpers ──────────────────────────────────────────────────────

const ZERO_STATS: CampaignStats = {
  spend: 0,
  impressions: 0,
  clicks: 0,
  purchases: 0,
  revenue: 0,
  roas: 0,
};

function buildSellpageUrl(
  slug: string,
  domain: { hostname: string } | null,
): string {
  if (domain) return `https://${domain.hostname}/${slug}`;
  return `<unassigned-domain>/${slug}`;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
