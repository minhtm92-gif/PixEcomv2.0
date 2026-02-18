/**
 * Unit tests for AssetRegistryService.resolveExistingAssetOrCreate
 *
 * Task 3 — Standardize Ingest De-dup Rules
 *
 * Verifies the deterministic de-dup rules:
 *   1. ingestionId present → unique by (sourceType, ingestionId)
 *   2. checksum present    → unique by (ownerSellerId, checksum)
 *   3. neither             → create fresh record
 */

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AssetRegistryService } from './asset-registry.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockAsset = (overrides: Partial<any> = {}) => ({
  id: 'asset-uuid-1234',
  ownerSellerId: null,
  sourceType: 'SYSTEM',
  ingestionId: 'some-ingestion-id',
  mediaType: 'VIDEO',
  url: 'https://cdn.example.com/video.mp4',
  storageKey: null,
  mimeType: null,
  fileSizeBytes: null,
  durationSec: null,
  width: null,
  height: null,
  checksum: null,
  metadata: {},
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

/** Creates a fake PrismaService with controllable responses */
function makePrisma(overrides: Partial<any> = {}) {
  return {
    asset: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((args: any) =>
        Promise.resolve(mockAsset({ id: 'new-asset-id', ...args.data })),
      ),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn().mockImplementation((queries: any[]) =>
      Promise.all(queries),
    ),
    ...overrides,
  };
}

/** Fake R2Service */
const fakeR2 = {
  buildKey: jest.fn().mockReturnValue('sellers/test/file.mp4'),
  getSignedUploadUrl: jest.fn().mockResolvedValue({
    uploadUrl: 'https://r2.example.com/upload',
    publicUrl: 'https://cdn.example.com/file.mp4',
  }),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AssetRegistryService — resolveExistingAssetOrCreate', () => {
  let service: AssetRegistryService;
  let prismaMock: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prismaMock = makePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetRegistryService,
        { provide: 'PrismaService', useValue: prismaMock },
        { provide: 'R2Service', useValue: fakeR2 },
      ],
    })
      .overrideProvider(AssetRegistryService)
      .useFactory({
        factory: () => {
          const svc = new (AssetRegistryService as any)(prismaMock, fakeR2);
          return svc;
        },
      })
      .compile();

    service = module.get<AssetRegistryService>(AssetRegistryService);
  });

  // ── Rule 1: ingestionId de-dup ─────────────────────────────────────────────

  describe('Rule 1 — ingestionId-based de-dup', () => {
    it('returns existing asset when (sourceType, ingestionId) already exists', async () => {
      const existing = mockAsset({ id: 'existing-id', ingestionId: 'ing-001', sourceType: 'SYSTEM' });
      prismaMock.asset.findFirst.mockResolvedValueOnce(existing);

      const result = await service.ingestAsset({
        sourceType: 'SYSTEM',
        ingestionId: 'ing-001',
        mediaType: 'VIDEO',
        url: 'https://cdn.example.com/new-video.mp4',
      } as any);

      expect(result.id).toBe('existing-id');
      // Should NOT call create
      expect(prismaMock.asset.create).not.toHaveBeenCalled();
    });

    it('does NOT call checksum lookup when ingestionId is set and match found', async () => {
      const existing = mockAsset({ ingestionId: 'ing-002' });
      prismaMock.asset.findFirst.mockResolvedValueOnce(existing);

      await service.ingestAsset({
        sourceType: 'SYSTEM',
        ingestionId: 'ing-002',
        checksum: 'some-checksum',
        mediaType: 'IMAGE',
        url: 'https://cdn.example.com/img.jpg',
      } as any);

      // findFirst called only once (ingestionId check), not twice (checksum check)
      expect(prismaMock.asset.findFirst).toHaveBeenCalledTimes(1);
      expect(prismaMock.asset.create).not.toHaveBeenCalled();
    });

    it('creates new asset when ingestionId not found', async () => {
      // findFirst returns null → no existing record
      prismaMock.asset.findFirst.mockResolvedValueOnce(null);
      prismaMock.asset.create.mockResolvedValueOnce(mockAsset({ id: 'created-id' }));

      const result = await service.ingestAsset({
        sourceType: 'SYSTEM',
        ingestionId: 'new-ing-003',
        mediaType: 'VIDEO',
        url: 'https://cdn.example.com/video3.mp4',
      } as any);

      expect(result.id).toBe('created-id');
      expect(prismaMock.asset.create).toHaveBeenCalledTimes(1);
    });
  });

  // ── Rule 2: checksum de-dup ────────────────────────────────────────────────

  describe('Rule 2 — checksum-based de-dup', () => {
    it('returns existing asset when (ownerSellerId, checksum) already exists', async () => {
      const existing = mockAsset({ id: 'checksum-match-id', checksum: 'abc123' });
      // First findFirst (no ingestionId → skipped), second findFirst (checksum)
      prismaMock.asset.findFirst.mockResolvedValueOnce(existing);

      const result = await service.ingestAsset({
        sourceType: 'SYSTEM',
        // No ingestionId
        checksum: 'abc123',
        mediaType: 'IMAGE',
        url: 'https://cdn.example.com/img.jpg',
      } as any);

      expect(result.id).toBe('checksum-match-id');
      expect(prismaMock.asset.create).not.toHaveBeenCalled();
    });

    it('also works via registerAsset (seller upload) with same checksum', async () => {
      const existing = mockAsset({ id: 'seller-checksum-match', ownerSellerId: 'seller-1', checksum: 'deadbeef' });
      prismaMock.asset.findFirst.mockResolvedValueOnce(existing);

      const result = await service.registerAsset('seller-1', {
        mediaType: 'VIDEO',
        url: 'https://cdn.example.com/video.mp4',
        checksum: 'deadbeef',
      } as any);

      expect(result.id).toBe('seller-checksum-match');
      expect(prismaMock.asset.create).not.toHaveBeenCalled();
    });
  });

  // ── Rule 3: no de-dup keys → create ───────────────────────────────────────

  describe('Rule 3 — no de-dup keys → always create', () => {
    it('creates new asset when neither ingestionId nor checksum provided', async () => {
      prismaMock.asset.create.mockResolvedValueOnce(mockAsset({ id: 'fresh-id' }));

      const result = await service.ingestAsset({
        sourceType: 'PARTNER_API',
        mediaType: 'IMAGE',
        url: 'https://cdn.example.com/partner-img.jpg',
      } as any);

      expect(result.id).toBe('fresh-id');
      // findFirst never called since no ingestionId nor checksum
      expect(prismaMock.asset.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.asset.create).toHaveBeenCalledTimes(1);
    });
  });

  // ── Verify rules are deterministic and ordered ─────────────────────────────

  describe('Rule ordering — ingestionId takes priority over checksum', () => {
    it('if both ingestionId and checksum provided, ingestionId check runs first', async () => {
      const existing = mockAsset({ id: 'by-ingestion', ingestionId: 'test-ing' });
      // First call returns match (ingestionId), second call should never happen
      prismaMock.asset.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(mockAsset({ id: 'by-checksum' }));

      const result = await service.ingestAsset({
        sourceType: 'SYSTEM',
        ingestionId: 'test-ing',
        checksum: 'some-hash',
        mediaType: 'VIDEO',
        url: 'https://cdn.example.com/video.mp4',
      } as any);

      expect(result.id).toBe('by-ingestion');
      // Only 1 findFirst call (ingestionId), not 2
      expect(prismaMock.asset.findFirst).toHaveBeenCalledTimes(1);
    });
  });
});
