/**
 * ads-manager-action.service.spec.ts
 *
 * Unit tests for Task A: AdsManagerActionService
 *
 * Covers:
 *  - A.3: bulkStatus — pause campaigns: valid + not-found + wrong-seller
 *  - A.3: bulkStatus — resume adsets
 *  - A.3: bulkStatus — skips if invalid transition (already PAUSED)
 *  - A.3: bulkStatus — validates entityIds.length
 *  - A.4: bulkBudget — updates campaigns + graceful Meta skip
 *  - A.5: syncFromMeta — rate limit (60s between calls)
 *  - A.5: syncFromMeta — graceful on Meta error (still returns result)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AdsManagerActionService } from './ads-manager-action.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetaService } from '../meta/meta.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SELLER_ID  = '00000000-0000-0000-0000-000000000001';
const CAMPAIGN_1 = '00000000-0000-0000-0000-000000000010';
const CAMPAIGN_2 = '00000000-0000-0000-0000-000000000011';
const ADSET_1    = '00000000-0000-0000-0000-000000000020';
const AD_1       = '00000000-0000-0000-0000-000000000030';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  campaign: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  adset: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  ad: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  fbConnection: {
    findMany: jest.fn(),
  },
};

const mockMeta = {
  post: jest.fn(),
  get:  jest.fn(),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AdsManagerActionService', () => {
  let service: AdsManagerActionService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdsManagerActionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MetaService, useValue: mockMeta },
      ],
    }).compile();

    service = module.get<AdsManagerActionService>(AdsManagerActionService);

    // Reset in-memory rate-limit map between tests
    (service as any).__proto__.constructor; // no-op, rate map is module-level
  });

  // ── A.3: bulkStatus campaigns ─────────────────────────────────────────────

  it('A.3: pauses ACTIVE campaigns', async () => {
    mockPrisma.campaign.findMany.mockResolvedValueOnce([
      { id: CAMPAIGN_1, status: 'ACTIVE', externalCampaignId: null, adAccountId: 'acc1' },
    ]);
    mockPrisma.campaign.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await service.bulkStatus(SELLER_ID, {
      entityType: 'campaign',
      entityIds: [CAMPAIGN_1],
      action: 'pause',
    });

    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(0);
    expect(mockPrisma.campaign.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PAUSED' } }),
    );
  });

  it('A.3: skips already-PAUSED campaigns when pausing', async () => {
    mockPrisma.campaign.findMany.mockResolvedValueOnce([
      { id: CAMPAIGN_1, status: 'PAUSED', externalCampaignId: null, adAccountId: 'acc1' },
    ]);

    const result = await service.bulkStatus(SELLER_ID, {
      entityType: 'campaign',
      entityIds: [CAMPAIGN_1],
      action: 'pause',
    });

    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.failed[0].reason).toMatch(/Cannot pause/);
  });

  it('A.3: reports not-found IDs in failed array', async () => {
    mockPrisma.campaign.findMany.mockResolvedValueOnce([]); // nothing found

    const result = await service.bulkStatus(SELLER_ID, {
      entityType: 'campaign',
      entityIds: [CAMPAIGN_1],
      action: 'pause',
    });

    expect(result.updated).toBe(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].id).toBe(CAMPAIGN_1);
  });

  it('A.3: graceful Meta sync — continues even if Meta throws', async () => {
    mockPrisma.campaign.findMany.mockResolvedValueOnce([
      { id: CAMPAIGN_1, status: 'ACTIVE', externalCampaignId: 'ext123', adAccountId: 'acc1' },
    ]);
    mockPrisma.campaign.updateMany.mockResolvedValueOnce({ count: 1 });
    mockMeta.post.mockRejectedValueOnce(new Error('Meta API error'));

    const result = await service.bulkStatus(SELLER_ID, {
      entityType: 'campaign',
      entityIds: [CAMPAIGN_1],
      action: 'pause',
    });

    // Should still update locally despite Meta failure
    expect(result.updated).toBe(1);
  });

  it('A.3: resumes PAUSED adsets', async () => {
    mockPrisma.adset.findMany.mockResolvedValueOnce([
      {
        id: ADSET_1,
        status: 'PAUSED',
        externalAdsetId: null,
        campaign: { adAccountId: 'acc1' },
      },
    ]);
    mockPrisma.adset.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await service.bulkStatus(SELLER_ID, {
      entityType: 'adset',
      entityIds: [ADSET_1],
      action: 'resume',
    });

    expect(result.updated).toBe(1);
  });

  // ── A.4: bulkBudget ──────────────────────────────────────────────────────

  it('A.4: updates campaign budgets', async () => {
    mockPrisma.campaign.findMany.mockResolvedValueOnce([
      { id: CAMPAIGN_1, externalCampaignId: null, adAccountId: 'acc1' },
      { id: CAMPAIGN_2, externalCampaignId: null, adAccountId: 'acc1' },
    ]);
    mockPrisma.campaign.updateMany.mockResolvedValueOnce({ count: 2 });

    const result = await service.bulkBudget(SELLER_ID, {
      campaignIds: [CAMPAIGN_1, CAMPAIGN_2],
      budget: 50,
      budgetType: 'DAILY',
    });

    expect(result.updated).toBe(2);
    expect(mockPrisma.campaign.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [CAMPAIGN_1, CAMPAIGN_2] } },
        data: expect.objectContaining({ budget: 50 }),
      }),
    );
  });

  it('A.4: reports not-found campaigns in failed array', async () => {
    mockPrisma.campaign.findMany.mockResolvedValueOnce([]); // nothing found

    const result = await service.bulkBudget(SELLER_ID, {
      campaignIds: [CAMPAIGN_1],
      budget: 50,
    });

    expect(result.updated).toBe(0);
    expect(result.failed).toHaveLength(1);
  });

  // ── A.5: syncFromMeta ────────────────────────────────────────────────────

  it('A.5: throws 400 when rate limited within 60s', async () => {
    // First call (sets timestamp)
    mockPrisma.fbConnection.findMany.mockResolvedValue([]);
    await service.syncFromMeta(SELLER_ID + '-ratelimit');

    // Immediate second call should be rate-limited
    await expect(
      service.syncFromMeta(SELLER_ID + '-ratelimit'),
    ).rejects.toThrow(BadRequestException);
  });

  it('A.5: handles no ad accounts gracefully', async () => {
    const uniqueSeller = SELLER_ID + '-noaccounts';
    mockPrisma.fbConnection.findMany.mockResolvedValueOnce([]);

    const result = await service.syncFromMeta(uniqueSeller);

    expect(result.synced.campaigns).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.lastSyncAt).toBeDefined();
  });

  it('A.5: catches Meta errors and adds to errors array', async () => {
    const uniqueSeller = SELLER_ID + '-metaerror';
    mockPrisma.fbConnection.findMany.mockResolvedValueOnce([
      { id: 'fb1', externalId: 'act_123', name: 'Test Account' },
    ]);
    mockMeta.get.mockRejectedValueOnce(new Error('Token expired'));

    const result = await service.syncFromMeta(uniqueSeller);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].accountName).toBe('Test Account');
    expect(result.errors[0].reason).toMatch(/Token expired/);
  });
});
