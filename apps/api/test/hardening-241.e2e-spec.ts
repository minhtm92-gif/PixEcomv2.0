import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Hardening 2.4.1 E2E Tests
 *
 * Covers:
 *  Task 1: creativeType-aware READY validation
 *  Task 2: GET /api/creatives/:id/render
 *  Task 4: EXTRA multi-slot / single-slot uniqueness
 *  Task 5: Dual API key rotation
 *
 * Task 3 (resolveExistingAssetOrCreate) is covered by unit tests.
 */
describe('Hardening 2.4.1 (e2e)', () => {
  let app: INestApplication;
  let sellerToken: string;
  let sellerBToken: string;
  let videoAssetId: string;
  let thumbnailAssetId: string;
  let textAssetId: string;
  let imageAdCreativeId: string;
  let textOnlyCreativeId: string;
  let ugcCreativeId: string;
  let videoAdCreativeId: string;
  let extraTestCreativeId: string;

  const API_KEY = 'hardening-test-key-current';
  const API_KEY_NEXT = 'hardening-test-key-next';

  const uniqueEmail = (prefix = 'h241') =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(-4)}@pixecom-e2e.io`;

  const register = (email: string, displayName: string) =>
    request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'Password123!', displayName });

  const auth = (token: string) => `Bearer ${token}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.init();

    // Set up dual-key env vars for Task 5 tests
    process.env.INGEST_API_KEY_CURRENT = API_KEY;
    process.env.INGEST_API_KEY_NEXT = API_KEY_NEXT;
    process.env.INGEST_API_KEY = ''; // Clear legacy key

    const resA = await register(uniqueEmail('h241-a'), 'Hardening Seller A');
    sellerToken = resA.body.accessToken;

    const resB = await register(uniqueEmail('h241-b'), 'Hardening Seller B');
    sellerBToken = resB.body.accessToken;

    // Create shared assets for creative tests
    const videoRes = await request(app.getHttpServer())
      .post('/api/assets')
      .set('Authorization', auth(sellerToken))
      .send({
        url: 'https://cdn.pixelxlab.com/h241/video.mp4',
        mediaType: 'VIDEO',
        checksum: `h241-video-${Date.now()}`,
      });
    videoAssetId = videoRes.body.id;

    const thumbRes = await request(app.getHttpServer())
      .post('/api/assets')
      .set('Authorization', auth(sellerToken))
      .send({
        url: 'https://cdn.pixelxlab.com/h241/thumb.jpg',
        mediaType: 'IMAGE',
        checksum: `h241-thumb-${Date.now()}`,
      });
    thumbnailAssetId = thumbRes.body.id;

    const textRes = await request(app.getHttpServer())
      .post('/api/assets')
      .set('Authorization', auth(sellerToken))
      .send({
        url: 'https://cdn.pixelxlab.com/h241/copy.txt',
        mediaType: 'TEXT',
        checksum: `h241-text-${Date.now()}`,
        metadata: { content: 'Buy now! Best deal.' },
      });
    textAssetId = textRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Task 1: creativeType-aware READY validation ─────────────────────────

  describe('Task 1 — creativeType READY validation', () => {
    it('creates IMAGE_AD creative with creativeType field', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/creatives')
        .set('Authorization', auth(sellerToken))
        .send({ name: 'My Image Ad', creativeType: 'IMAGE_AD' });
      expect(res.status).toBe(201);
      expect(res.body.creativeType).toBe('IMAGE_AD');
      imageAdCreativeId = res.body.id;
    });

    it('IMAGE_AD: validate fails when only VIDEO attached (no IMAGE/THUMBNAIL)', async () => {
      await request(app.getHttpServer())
        .post(`/api/creatives/${imageAdCreativeId}/assets`)
        .set('Authorization', auth(sellerToken))
        .send({ assetId: videoAssetId, role: 'PRIMARY_VIDEO' });

      await request(app.getHttpServer())
        .post(`/api/creatives/${imageAdCreativeId}/assets`)
        .set('Authorization', auth(sellerToken))
        .send({ assetId: textAssetId, role: 'PRIMARY_TEXT' });

      const res = await request(app.getHttpServer())
        .post(`/api/creatives/${imageAdCreativeId}/validate`)
        .set('Authorization', auth(sellerToken));

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('missing required assets');
      expect(res.body.message).toContain('THUMBNAIL');
    });

    it('IMAGE_AD: validate succeeds when THUMBNAIL + PRIMARY_TEXT present', async () => {
      // Attach thumbnail
      await request(app.getHttpServer())
        .post(`/api/creatives/${imageAdCreativeId}/assets`)
        .set('Authorization', auth(sellerToken))
        .send({ assetId: thumbnailAssetId, role: 'THUMBNAIL' });

      const res = await request(app.getHttpServer())
        .post(`/api/creatives/${imageAdCreativeId}/validate`)
        .set('Authorization', auth(sellerToken));

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('READY');
      expect(res.body.creativeType).toBe('IMAGE_AD');
    });

    it('TEXT_ONLY: validate passes with only PRIMARY_TEXT', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/creatives')
        .set('Authorization', auth(sellerToken))
        .send({ name: 'Text Only Ad', creativeType: 'TEXT_ONLY' });
      textOnlyCreativeId = create.body.id;

      await request(app.getHttpServer())
        .post(`/api/creatives/${textOnlyCreativeId}/assets`)
        .set('Authorization', auth(sellerToken))
        .send({ assetId: textAssetId, role: 'PRIMARY_TEXT' });

      const res = await request(app.getHttpServer())
        .post(`/api/creatives/${textOnlyCreativeId}/validate`)
        .set('Authorization', auth(sellerToken));

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('READY');
    });

    it('TEXT_ONLY: validate fails without PRIMARY_TEXT', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/creatives')
        .set('Authorization', auth(sellerToken))
        .send({ name: 'Empty Text Only', creativeType: 'TEXT_ONLY' });

      const res = await request(app.getHttpServer())
        .post(`/api/creatives/${create.body.id}/validate`)
        .set('Authorization', auth(sellerToken));

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('PRIMARY_TEXT');
    });

    it('UGC_BUNDLE: validate passes with only PRIMARY_VIDEO', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/creatives')
        .set('Authorization', auth(sellerToken))
        .send({ name: 'UGC Bundle', creativeType: 'UGC_BUNDLE' });
      ugcCreativeId = create.body.id;

      await request(app.getHttpServer())
        .post(`/api/creatives/${ugcCreativeId}/assets`)
        .set('Authorization', auth(sellerToken))
        .send({ assetId: videoAssetId, role: 'PRIMARY_VIDEO' });

      const res = await request(app.getHttpServer())
        .post(`/api/creatives/${ugcCreativeId}/validate`)
        .set('Authorization', auth(sellerToken));

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('READY');
    });

    it('VIDEO_AD: validate fails without THUMBNAIL', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/creatives')
        .set('Authorization', auth(sellerToken))
        .send({ name: 'Video Ad No Thumb', creativeType: 'VIDEO_AD' });
      videoAdCreativeId = create.body.id;

      // Attach video + text but no thumbnail
      await request(app.getHttpServer())
        .post(`/api/creatives/${videoAdCreativeId}/assets`)
        .set('Authorization', auth(sellerToken))
        .send({ assetId: videoAssetId, role: 'PRIMARY_VIDEO' });

      await request(app.getHttpServer())
        .post(`/api/creatives/${videoAdCreativeId}/assets`)
        .set('Authorization', auth(sellerToken))
        .send({ assetId: textAssetId, role: 'PRIMARY_TEXT' });

      const res = await request(app.getHttpServer())
        .post(`/api/creatives/${videoAdCreativeId}/validate`)
        .set('Authorization', auth(sellerToken));

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('THUMBNAIL');
    });

    it('PATCH /api/creatives/:id can change creativeType', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/creatives')
        .set('Authorization', auth(sellerToken))
        .send({ name: 'Type Change Test', creativeType: 'VIDEO_AD' });
      const id = create.body.id;

      const res = await request(app.getHttpServer())
        .patch(`/api/creatives/${id}`)
        .set('Authorization', auth(sellerToken))
        .send({ creativeType: 'TEXT_ONLY' });

      expect(res.status).toBe(200);
      expect(res.body.creativeType).toBe('TEXT_ONLY');
    });
  });

  // ─── Task 2: Render endpoint ──────────────────────────────────────────────

  describe('Task 2 — GET /api/creatives/:id/render', () => {
    it('returns compiled render payload for IMAGE_AD creative', async () => {
      // imageAdCreativeId is READY with THUMBNAIL + PRIMARY_TEXT + PRIMARY_VIDEO
      const res = await request(app.getHttpServer())
        .get(`/api/creatives/${imageAdCreativeId}/render`)
        .set('Authorization', auth(sellerToken));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(imageAdCreativeId);
      expect(res.body.creativeType).toBe('IMAGE_AD');
      expect(res.body.status).toBe('READY');
      expect(res.body.thumbnailUrl).toBeTruthy();
      expect(res.body.imageUrl).toBeTruthy();
      expect(res.body.primaryText).toBeTruthy(); // content from metadata
      expect(res.body.videoUrl).toBeTruthy();    // also has PRIMARY_VIDEO
      expect(Array.isArray(res.body.extras)).toBe(true);
    });

    it('render returns null fields for missing slots', async () => {
      // textOnlyCreativeId has only PRIMARY_TEXT
      const res = await request(app.getHttpServer())
        .get(`/api/creatives/${textOnlyCreativeId}/render`)
        .set('Authorization', auth(sellerToken));

      expect(res.status).toBe(200);
      expect(res.body.videoUrl).toBeNull();
      expect(res.body.imageUrl).toBeNull();
      expect(res.body.primaryText).toBeTruthy();
      expect(res.body.headline).toBeNull();
    });

    it('seller B cannot render seller A creative (returns 404)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/creatives/${imageAdCreativeId}/render`)
        .set('Authorization', auth(sellerBToken));
      expect(res.status).toBe(404);
    });

    it('primaryText returns metadata.content when set', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/creatives/${textOnlyCreativeId}/render`)
        .set('Authorization', auth(sellerToken));

      expect(res.status).toBe(200);
      // The text asset has metadata.content = 'Buy now! Best deal.'
      expect(res.body.primaryText).toBe('Buy now! Best deal.');
    });
  });

  // ─── Task 4: EXTRA multi-slot ─────────────────────────────────────────────

  describe('Task 4 — EXTRA multi-slot / single-slot uniqueness', () => {
    beforeAll(async () => {
      const create = await request(app.getHttpServer())
        .post('/api/creatives')
        .set('Authorization', auth(sellerToken))
        .send({ name: 'EXTRA Slot Test', creativeType: 'VIDEO_AD' });
      extraTestCreativeId = create.body.id;
    });

    it('attaching EXTRA role creates a new row each time (multi-slot)', async () => {
      // Attach first EXTRA
      const res1 = await request(app.getHttpServer())
        .post(`/api/creatives/${extraTestCreativeId}/assets`)
        .set('Authorization', auth(sellerToken))
        .send({ assetId: videoAssetId, role: 'EXTRA' });
      expect(res1.status).toBe(201);
      const id1 = res1.body.id;

      // Attach second EXTRA — should create a new row, not replace
      const res2 = await request(app.getHttpServer())
        .post(`/api/creatives/${extraTestCreativeId}/assets`)
        .set('Authorization', auth(sellerToken))
        .send({ assetId: thumbnailAssetId, role: 'EXTRA' });
      expect(res2.status).toBe(201);
      const id2 = res2.body.id;

      // Both slots should exist (different IDs)
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);

      // GET creative should show 2 EXTRA slots
      const detail = await request(app.getHttpServer())
        .get(`/api/creatives/${extraTestCreativeId}`)
        .set('Authorization', auth(sellerToken));
      const extras = detail.body.assets.filter((a: any) => a.role === 'EXTRA');
      expect(extras.length).toBe(2);
    });

    it('attaching single-slot role PRIMARY_VIDEO replaces (not duplicates)', async () => {
      // First attach
      await request(app.getHttpServer())
        .post(`/api/creatives/${extraTestCreativeId}/assets`)
        .set('Authorization', auth(sellerToken))
        .send({ assetId: videoAssetId, role: 'PRIMARY_VIDEO' });

      // Second attach to same role — should upsert
      const res2 = await request(app.getHttpServer())
        .post(`/api/creatives/${extraTestCreativeId}/assets`)
        .set('Authorization', auth(sellerToken))
        .send({ assetId: thumbnailAssetId, role: 'PRIMARY_VIDEO' });
      expect(res2.status).toBe(201);

      // Should still have only 1 PRIMARY_VIDEO slot
      const detail = await request(app.getHttpServer())
        .get(`/api/creatives/${extraTestCreativeId}`)
        .set('Authorization', auth(sellerToken));
      const primaryVideos = detail.body.assets.filter(
        (a: any) => a.role === 'PRIMARY_VIDEO',
      );
      expect(primaryVideos.length).toBe(1);
      // Asset should be the second one (thumbnail used as video for test)
      expect(primaryVideos[0].asset.id).toBe(thumbnailAssetId);
    });
  });

  // ─── Task 5: Dual API key rotation ───────────────────────────────────────

  describe('Task 5 — Dual API key rotation', () => {
    it('accepts INGEST_API_KEY_CURRENT', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/assets/ingest')
        .set('X-Api-Key', API_KEY)
        .send({
          sourceType: 'SYSTEM',
          ingestionId: `h241-key-current-${Date.now()}`,
          mediaType: 'IMAGE',
          url: 'https://cdn.pixelxlab.com/h241/platform-img.jpg',
        });
      expect(res.status).toBe(201);
    });

    it('accepts INGEST_API_KEY_NEXT (rotation candidate)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/assets/ingest')
        .set('X-Api-Key', API_KEY_NEXT)
        .send({
          sourceType: 'SYSTEM',
          ingestionId: `h241-key-next-${Date.now()}`,
          mediaType: 'IMAGE',
          url: 'https://cdn.pixelxlab.com/h241/platform-img2.jpg',
        });
      expect(res.status).toBe(201);
    });

    it('rejects unknown API key with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/assets/ingest')
        .set('X-Api-Key', 'totally-wrong-key')
        .send({
          sourceType: 'SYSTEM',
          mediaType: 'IMAGE',
          url: 'https://cdn.pixelxlab.com/h241/bad.jpg',
        });
      expect(res.status).toBe(401);
    });

    it('rejects request with no auth with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/assets/ingest')
        .send({
          sourceType: 'SYSTEM',
          mediaType: 'IMAGE',
          url: 'https://cdn.pixelxlab.com/h241/no-auth.jpg',
        });
      expect(res.status).toBe(401);
    });
  });
});
