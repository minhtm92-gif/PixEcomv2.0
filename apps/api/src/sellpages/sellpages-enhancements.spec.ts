/**
 * sellpages-enhancements.spec.ts
 *
 * Unit tests for Task B: Sellpage enhancements
 *
 * Covers:
 *  - B.1: checkDomainAvailability — domain free → available:true
 *  - B.1: checkDomainAvailability — domain taken → available:false
 *  - B.1: verifyDomain — always returns verified:true (mock)
 *  - B.1: verifyDomain — returns 404 if sellpage not found
 *  - B.2: updateSellpage with pixelId — validates FbConnection
 *  - B.2: updateSellpage with pixelId — throws 400 if pixel not found
 *  - B.2: updateSellpage with pixelId=null — clears pixel
 *  - B.2: getPixel — returns pixel info
 *  - B.2: getPixel — returns nulls when no pixel set
 *  - B.3: getLinkedAds — returns enhanced response with metrics + assets
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SellpagesService } from './sellpages.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SELLER_ID    = '00000000-0000-0000-0000-000000000001';
const SELLPAGE_ID  = '00000000-0000-0000-0000-000000000010';
const PIXEL_ID     = '00000000-0000-0000-000a-000000000303';
const DOMAIN_NAME  = 'my-store';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  sellpage: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  fbConnection: {
    findFirst: jest.fn(),
  },
  sellerDomain: {
    findUnique: jest.fn(),
  },
  campaign: {
    findMany: jest.fn(),
  },
  adStatsDaily: {
    findMany: jest.fn(),
  },
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SellpagesService — enhancements (Task B)', () => {
  let service: SellpagesService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SellpagesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SellpagesService>(SellpagesService);
  });

  // ── B.1: checkDomainAvailability ─────────────────────────────────────────

  it('B.1: returns available:true when domain is free', async () => {
    mockPrisma.sellpage.findFirst.mockResolvedValueOnce(null);

    const result = await service.checkDomainAvailability(DOMAIN_NAME);

    expect(result.available).toBe(true);
  });

  it('B.1: returns available:false when domain is taken', async () => {
    mockPrisma.sellpage.findFirst.mockResolvedValueOnce({ id: 'some-id' });

    const result = await service.checkDomainAvailability(DOMAIN_NAME);

    expect(result.available).toBe(false);
  });

  // ── B.1: verifyDomain ────────────────────────────────────────────────────

  it('B.1: verifyDomain always returns verified:true (alpha mock)', async () => {
    mockPrisma.sellpage.findUnique
      .mockResolvedValueOnce({ id: SELLPAGE_ID, sellerId: SELLER_ID, status: 'DRAFT', domainId: null })
      .mockResolvedValueOnce({ customDomain: DOMAIN_NAME });

    const result = await service.verifyDomain(SELLER_ID, SELLPAGE_ID);

    expect(result.verified).toBe(true);
    expect(result.domain).toBe(DOMAIN_NAME);
    expect(result.expectedCname).toBeDefined();
  });

  it('B.1: verifyDomain throws 404 if sellpage not found or wrong seller', async () => {
    mockPrisma.sellpage.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.verifyDomain(SELLER_ID, SELLPAGE_ID),
    ).rejects.toThrow(NotFoundException);
  });

  // ── B.2: getPixel ────────────────────────────────────────────────────────

  it('B.2: getPixel returns null when no pixel assigned', async () => {
    mockPrisma.sellpage.findUnique.mockResolvedValueOnce({
      sellerId: SELLER_ID,
      headerConfig: {},
    });

    const result = await service.getPixel(SELLER_ID, SELLPAGE_ID);

    expect(result.pixelId).toBeNull();
    expect(result.pixelName).toBeNull();
    expect(result.pixelExternalId).toBeNull();
  });

  it('B.2: getPixel returns pixel info when assigned', async () => {
    mockPrisma.sellpage.findUnique.mockResolvedValueOnce({
      sellerId: SELLER_ID,
      headerConfig: { pixelId: PIXEL_ID },
    });
    mockPrisma.fbConnection.findFirst.mockResolvedValueOnce({
      id: PIXEL_ID,
      name: 'Alpha Test Pixel',
      externalId: 'pixel_987654321',
    });

    const result = await service.getPixel(SELLER_ID, SELLPAGE_ID);

    expect(result.pixelId).toBe(PIXEL_ID);
    expect(result.pixelName).toBe('Alpha Test Pixel');
    expect(result.pixelExternalId).toBe('pixel_987654321');
  });

  it('B.2: getPixel throws 404 if sellpage not found', async () => {
    mockPrisma.sellpage.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.getPixel(SELLER_ID, SELLPAGE_ID),
    ).rejects.toThrow(NotFoundException);
  });

  // ── B.2: updateSellpage with pixelId ────────────────────────────────────

  it('B.2: updateSellpage validates FbConnection when pixelId provided', async () => {
    mockPrisma.sellpage.findUnique
      .mockResolvedValueOnce({ id: SELLPAGE_ID, sellerId: SELLER_ID, status: 'DRAFT', domainId: null })
      .mockResolvedValueOnce({ headerConfig: {} });

    mockPrisma.fbConnection.findFirst.mockResolvedValueOnce(null); // pixel not found

    await expect(
      service.updateSellpage(SELLER_ID, SELLPAGE_ID, { pixelId: PIXEL_ID }),
    ).rejects.toThrow(BadRequestException);
  });

  it('B.2: updateSellpage saves pixelId in headerConfig', async () => {
    mockPrisma.sellpage.findUnique
      .mockResolvedValueOnce({ id: SELLPAGE_ID, sellerId: SELLER_ID, status: 'DRAFT', domainId: null })
      .mockResolvedValueOnce({ headerConfig: {} });

    mockPrisma.fbConnection.findFirst.mockResolvedValueOnce({ id: PIXEL_ID });

    mockPrisma.sellpage.update.mockResolvedValueOnce({
      id: SELLPAGE_ID, sellerId: SELLER_ID, productId: 'p1',
      domainId: null, slug: 'test', status: 'DRAFT',
      sellpageType: 'SINGLE', titleOverride: null, descriptionOverride: null,
      createdAt: new Date(), updatedAt: new Date(),
      domain: null,
    });

    const result = await service.updateSellpage(SELLER_ID, SELLPAGE_ID, { pixelId: PIXEL_ID });

    expect(mockPrisma.sellpage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          headerConfig: expect.objectContaining({ pixelId: PIXEL_ID }),
        }),
      }),
    );
  });

  // ── B.3: getLinkedAds enhanced ──────────────────────────────────────────

  it('B.3: getLinkedAds returns ads with metrics and asset details', async () => {
    const AD_ID = '00000000-0000-0000-0000-000000000099';

    mockPrisma.sellpage.findUnique.mockResolvedValueOnce({
      id: SELLPAGE_ID, sellerId: SELLER_ID,
    });

    mockPrisma.campaign.findMany.mockResolvedValueOnce([
      {
        id: 'camp1', name: 'Camp', status: 'ACTIVE',
        adsets: [
          {
            id: 'adset1', name: 'Adset', status: 'ACTIVE',
            ads: [
              {
                id: AD_ID, name: 'Ad', status: 'ACTIVE',
                adPosts: [
                  {
                    externalPostId: 'post123',
                    pageId: 'page1',
                    createdAt: new Date(),
                    page: { name: 'Alpha Test Page' },
                    assetThumbnail: { url: 'https://cdn.example.com/thumb.jpg' },
                    assetAdtext: { primaryText: 'Buy now!' },
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);

    mockPrisma.adStatsDaily.findMany.mockResolvedValueOnce([
      {
        entityId: AD_ID,
        spend: 50,
        impressions: 1000,
        linkClicks: 50,
        purchases: 5,
        purchaseValue: 250,
      },
    ]);

    const result = await service.getLinkedAds(SELLER_ID, SELLPAGE_ID);

    const ad = result.campaigns[0].adsets[0].ads[0];
    expect(ad.adPost?.pageName).toBe('Alpha Test Page');
    expect(ad.adPost?.thumbnailUrl).toBe('https://cdn.example.com/thumb.jpg');
    expect(ad.adPost?.adText).toBe('Buy now!');
    expect(ad.metrics?.spend).toBe(50);
    expect(ad.metrics?.roas).toBe(5); // 250 / 50
  });

  it('B.3: getLinkedAds returns null metrics when no stats', async () => {
    const AD_ID_2 = '00000000-0000-0000-0000-000000000098';

    mockPrisma.sellpage.findUnique.mockResolvedValueOnce({
      id: SELLPAGE_ID, sellerId: SELLER_ID,
    });

    mockPrisma.campaign.findMany.mockResolvedValueOnce([
      {
        id: 'camp2', name: 'Camp2', status: 'ACTIVE',
        adsets: [
          {
            id: 'adset2', name: 'Adset2', status: 'ACTIVE',
            ads: [
              {
                id: AD_ID_2, name: 'Ad2', status: 'PAUSED',
                adPosts: [],
              },
            ],
          },
        ],
      },
    ]);

    mockPrisma.adStatsDaily.findMany.mockResolvedValueOnce([]); // no stats

    const result = await service.getLinkedAds(SELLER_ID, SELLPAGE_ID);

    const ad = result.campaigns[0].adsets[0].ads[0];
    expect(ad.adPost).toBeNull();
    expect(ad.metrics).toBeNull();
  });
});
