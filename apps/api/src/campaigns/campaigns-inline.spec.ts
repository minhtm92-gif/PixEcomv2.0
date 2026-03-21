/**
 * campaigns-inline.spec.ts
 *
 * Unit tests for Task A inline actions:
 *  - A.1: pauseAdset / resumeAdset
 *  - A.1: pauseAd / resumeAd
 *  - A.2: updateCampaignBudget
 *
 * All Meta calls are graceful — local update succeeds even if Meta fails.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetaService } from '../meta/meta.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SELLER_ID   = '00000000-0000-0000-0000-000000000001';
const CAMPAIGN_ID = '00000000-0000-0000-0000-000000000010';
const ADSET_ID    = '00000000-0000-0000-0000-000000000020';
const AD_ID       = '00000000-0000-0000-0000-000000000030';
const ACC_ID      = '00000000-0000-0000-0000-000000000040';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  campaign: {
    findFirst: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  adset: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  ad: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  fbConnection: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  adStrategy: {
    findFirst: jest.fn(),
  },
  sellpage: {
    findFirst: jest.fn(),
  },
};

const mockMeta = {
  post: jest.fn(),
  get: jest.fn(),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CampaignsService — inline actions (Task A)', () => {
  let service: CampaignsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MetaService, useValue: mockMeta },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
  });

  // ── A.2: Campaign budget ─────────────────────────────────────────────────

  it('A.2: updates campaign budget without Meta (no externalCampaignId)', async () => {
    mockPrisma.campaign.findFirst.mockResolvedValueOnce({
      id: CAMPAIGN_ID,
      sellerId: SELLER_ID,
      adAccountId: ACC_ID,
      externalCampaignId: null,
      status: 'PAUSED',
      name: 'Test Campaign',
    });
    const updatedRow = {
      id: CAMPAIGN_ID, sellerId: SELLER_ID, sellpageId: 'sp1',
      adAccountId: ACC_ID, adStrategyId: null, externalCampaignId: null,
      name: 'Test', budget: 100, budgetType: 'DAILY', status: 'PAUSED',
      deliveryStatus: null, startDate: null, endDate: null,
      createdAt: new Date(), updatedAt: new Date(),
    };
    mockPrisma.campaign.update.mockResolvedValueOnce(updatedRow);

    const result = await service.updateCampaignBudget(SELLER_ID, CAMPAIGN_ID, {
      budget: 100,
      budgetType: 'DAILY',
    });

    expect(result.budget).toBe(100);
    expect(mockMeta.post).not.toHaveBeenCalled();
  });

  it('A.2: tries Meta call when externalCampaignId exists (graceful on failure)', async () => {
    mockPrisma.campaign.findFirst.mockResolvedValueOnce({
      id: CAMPAIGN_ID,
      sellerId: SELLER_ID,
      adAccountId: ACC_ID,
      externalCampaignId: 'ext_campaign_123',
      status: 'ACTIVE',
      name: 'Test Campaign',
    });
    mockMeta.post.mockRejectedValueOnce(new Error('Meta API error'));
    const updatedRow = {
      id: CAMPAIGN_ID, sellerId: SELLER_ID, sellpageId: 'sp1',
      adAccountId: ACC_ID, adStrategyId: null, externalCampaignId: 'ext_campaign_123',
      name: 'Test', budget: 150, budgetType: 'DAILY', status: 'ACTIVE',
      deliveryStatus: null, startDate: null, endDate: null,
      createdAt: new Date(), updatedAt: new Date(),
    };
    mockPrisma.campaign.update.mockResolvedValueOnce(updatedRow);

    // Should NOT throw — Meta failure is graceful
    const result = await service.updateCampaignBudget(SELLER_ID, CAMPAIGN_ID, { budget: 150 });

    expect(result.budget).toBe(150);
    expect(mockMeta.post).toHaveBeenCalledTimes(1);
  });

  it('A.2: throws 400 for budget <= 0', async () => {
    mockPrisma.campaign.findFirst.mockResolvedValueOnce({
      id: CAMPAIGN_ID, sellerId: SELLER_ID, adAccountId: ACC_ID,
      externalCampaignId: null, status: 'PAUSED', name: 'Test',
    });

    await expect(
      service.updateCampaignBudget(SELLER_ID, CAMPAIGN_ID, { budget: 0 }),
    ).rejects.toThrow(BadRequestException);
  });

  // ── A.1: Adset pause/resume ──────────────────────────────────────────────

  it('A.1: pauses an ACTIVE adset (no externalAdsetId → no Meta call)', async () => {
    mockPrisma.adset.findFirst.mockResolvedValueOnce({
      id: ADSET_ID, status: 'ACTIVE', externalAdsetId: null,
      campaign: { adAccountId: ACC_ID },
    });
    mockPrisma.adset.update.mockResolvedValueOnce({
      id: ADSET_ID, campaignId: 'c1', sellerId: SELLER_ID,
      externalAdsetId: null, name: 'Adset', status: 'PAUSED',
      deliveryStatus: null, optimizationGoal: null, targeting: {},
      createdAt: new Date(), updatedAt: new Date(),
    });

    await service.pauseAdset(SELLER_ID, ADSET_ID);

    expect(mockPrisma.adset.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PAUSED' } }),
    );
    expect(mockMeta.post).not.toHaveBeenCalled();
  });

  it('A.1: throws 409 when adset is already PAUSED', async () => {
    mockPrisma.adset.findFirst.mockResolvedValueOnce({
      id: ADSET_ID, status: 'PAUSED', externalAdsetId: null,
      campaign: { adAccountId: ACC_ID },
    });

    await expect(
      service.pauseAdset(SELLER_ID, ADSET_ID),
    ).rejects.toThrow(ConflictException);
  });

  it('A.1: resumes a PAUSED adset with graceful Meta sync', async () => {
    mockPrisma.adset.findFirst.mockResolvedValueOnce({
      id: ADSET_ID, status: 'PAUSED', externalAdsetId: 'ext_adset_999',
      campaign: { adAccountId: ACC_ID },
    });
    mockMeta.post.mockResolvedValueOnce({ success: true });
    mockPrisma.adset.update.mockResolvedValueOnce({
      id: ADSET_ID, campaignId: 'c1', sellerId: SELLER_ID,
      externalAdsetId: 'ext_adset_999', name: 'Adset', status: 'ACTIVE',
      deliveryStatus: null, optimizationGoal: null, targeting: {},
      createdAt: new Date(), updatedAt: new Date(),
    });

    await service.resumeAdset(SELLER_ID, ADSET_ID);

    expect(mockMeta.post).toHaveBeenCalledWith(ACC_ID, 'ext_adset_999', { status: 'ACTIVE' });
    expect(mockPrisma.adset.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ACTIVE' } }),
    );
  });

  it('A.1: throws 404 when adset not found', async () => {
    mockPrisma.adset.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.pauseAdset(SELLER_ID, ADSET_ID),
    ).rejects.toThrow(NotFoundException);
  });

  // ── A.1: Ad pause/resume ─────────────────────────────────────────────────

  it('A.1: pauses an ACTIVE ad', async () => {
    mockPrisma.ad.findFirst.mockResolvedValueOnce({
      id: AD_ID, status: 'ACTIVE', externalAdId: null,
      adset: { campaign: { adAccountId: ACC_ID } },
    });
    mockPrisma.ad.update.mockResolvedValueOnce({
      id: AD_ID, adsetId: ADSET_ID, sellerId: SELLER_ID,
      externalAdId: null, name: 'Ad', status: 'PAUSED',
      deliveryStatus: null, createdAt: new Date(), updatedAt: new Date(),
    });

    await service.pauseAd(SELLER_ID, AD_ID);

    expect(mockPrisma.ad.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PAUSED' } }),
    );
  });

  it('A.1: throws 409 when ad is already PAUSED', async () => {
    mockPrisma.ad.findFirst.mockResolvedValueOnce({
      id: AD_ID, status: 'PAUSED', externalAdId: null,
      adset: { campaign: { adAccountId: ACC_ID } },
    });

    await expect(service.pauseAd(SELLER_ID, AD_ID)).rejects.toThrow(ConflictException);
  });

  it('A.1: resumes a PAUSED ad with graceful Meta failure', async () => {
    mockPrisma.ad.findFirst.mockResolvedValueOnce({
      id: AD_ID, status: 'PAUSED', externalAdId: 'ext_ad_456',
      adset: { campaign: { adAccountId: ACC_ID } },
    });
    mockMeta.post.mockRejectedValueOnce(new Error('Rate limit'));
    mockPrisma.ad.update.mockResolvedValueOnce({
      id: AD_ID, adsetId: ADSET_ID, sellerId: SELLER_ID,
      externalAdId: 'ext_ad_456', name: 'Ad', status: 'ACTIVE',
      deliveryStatus: null, createdAt: new Date(), updatedAt: new Date(),
    });

    // Should not throw even though Meta failed
    await expect(service.resumeAd(SELLER_ID, AD_ID)).resolves.toBeDefined();
    expect(mockPrisma.ad.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ACTIVE' } }),
    );
  });
});
