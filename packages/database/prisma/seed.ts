/**
 * Seed script for PixEcom v2 — Milestone 2.2.3
 *
 * Seeds:
 *   - 4 ProductLabels: bestseller, new-arrival, trending, limited-edition
 *   - 3 Products (all ACTIVE), each with variants
 *   - Product-Label associations
 *   - AssetMedia / AssetThumbnail / AssetAdtext for Product 1
 *   - PricingRules:
 *       Product 1 -> percentage  (sellerTakeFixed = null)  -> 49.99 * 40% = "20.00"
 *       Product 2 -> fixed       (sellerTakeFixed = 15.00) -> "15.00"
 *       Product 3 -> percentage  (sellerTakeFixed = null)  -> 39.99 * 35% = "14.00"
 *   - 1 Seed Seller (seed-seller@pixecom.io / password: seedpassword123)
 *       with SellerSettings + 3 Sellpages (DRAFT, PUBLISHED, DRAFT)
 *
 * Run: pnpm --filter @pixecom/database db:seed
 * Idempotent: safe to re-run.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const labelBestseller = await prisma.productLabel.upsert({
    where: { slug: 'bestseller' },
    update: {},
    create: { name: 'Bestseller', slug: 'bestseller' },
  });
  const labelNewArrival = await prisma.productLabel.upsert({
    where: { slug: 'new-arrival' },
    update: {},
    create: { name: 'New Arrival', slug: 'new-arrival' },
  });
  const labelTrending = await prisma.productLabel.upsert({
    where: { slug: 'trending' },
    update: {},
    create: { name: 'Trending', slug: 'trending' },
  });
  const labelLimited = await prisma.productLabel.upsert({
    where: { slug: 'limited-edition' },
    update: {},
    create: { name: 'Limited Edition', slug: 'limited-edition' },
  });
  console.log('Labels seeded');

  // ---- Product 1: SlimPro Wireless Mouse (percentage pricing) ----
  const product1 = await prisma.product.upsert({
    where: { productCode: 'MOUSE-001' },
    update: {},
    create: {
      productCode: 'MOUSE-001',
      name: 'SlimPro Wireless Mouse',
      slug: 'slimpro-wireless-mouse',
      basePrice: 29.99,
      compareAtPrice: 39.99,
      currency: 'USD',
      sku: 'MOUSE-001-SKU',
      description: 'Ergonomic wireless mouse with precision tracking and 6-month battery life.',
      descriptionBlocks: [
        { type: 'paragraph', content: 'Ultra-slim ergonomic design for all-day comfort.' },
        { type: 'bullet_list', items: ['2.4GHz wireless', '1600 DPI sensor', '6-month battery'] },
      ],
      shippingInfo: { weight_g: 95, dimensions_cm: { l: 11.5, w: 6.2, h: 3.8 } },
      tags: ['wireless', 'ergonomic', 'office', 'productivity'],
      status: 'ACTIVE',
    },
  });
  await prisma.productVariant.upsert({ where: { id: '00000000-0000-0000-0000-000000000101' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000101', productId: product1.id, name: 'Black', sku: 'MOUSE-001-BLK', priceOverride: null, options: { color: 'Black' }, stockQuantity: 150, isActive: true, position: 0 } });
  await prisma.productVariant.upsert({ where: { id: '00000000-0000-0000-0000-000000000102' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000102', productId: product1.id, name: 'White', sku: 'MOUSE-001-WHT', priceOverride: null, options: { color: 'White' }, stockQuantity: 80, isActive: true, position: 1 } });
  await prisma.productVariant.upsert({ where: { id: '00000000-0000-0000-0000-000000000103' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000103', productId: product1.id, name: 'Rose Gold', sku: 'MOUSE-001-RGD', priceOverride: 32.99, options: { color: 'Rose Gold' }, stockQuantity: 40, isActive: true, position: 2 } });
  await prisma.productProductLabel.upsert({ where: { productId_labelId: { productId: product1.id, labelId: labelBestseller.id } }, update: {}, create: { productId: product1.id, labelId: labelBestseller.id } });
  await prisma.productProductLabel.upsert({ where: { productId_labelId: { productId: product1.id, labelId: labelTrending.id } }, update: {}, create: { productId: product1.id, labelId: labelTrending.id } });
  // Pricing: percentage - 49.99 * 40% = 20.00
  await prisma.pricingRule.upsert({ where: { id: '00000000-0000-0000-0000-000000000201' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000201', productId: product1.id, suggestedRetail: 49.99, sellerTakePercent: 40.00, sellerTakeFixed: null, holdPercent: 10, holdDurationDays: 7, effectiveFrom: new Date('2026-01-01T00:00:00Z'), effectiveUntil: null, isActive: true } });
  // Assets
  await prisma.assetMedia.upsert({ where: { id: '00000000-0000-0000-0000-000000000301' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000301', productId: product1.id, version: 'v1', url: 'https://cdn.pixelxlab.com/assets/mouse-001/v1-main.mp4', mediaType: 'VIDEO', durationSec: 30, fileSize: 8500000, width: 1080, height: 1080, position: 0, isCurrent: true } });
  await prisma.assetMedia.upsert({ where: { id: '00000000-0000-0000-0000-000000000302' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000302', productId: product1.id, version: 'b1', url: 'https://cdn.pixelxlab.com/assets/mouse-001/b1-lifestyle.mp4', mediaType: 'VIDEO', durationSec: 15, fileSize: 3200000, width: 1080, height: 1920, position: 1, isCurrent: false } });
  await prisma.assetThumbnail.upsert({ where: { id: '00000000-0000-0000-0000-000000000401' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000401', productId: product1.id, version: 'v1', url: 'https://cdn.pixelxlab.com/assets/mouse-001/v1-thumb.jpg', width: 800, height: 800, position: 0, isCurrent: true } });
  await prisma.assetThumbnail.upsert({ where: { id: '00000000-0000-0000-0000-000000000402' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000402', productId: product1.id, version: 'b1', url: 'https://cdn.pixelxlab.com/assets/mouse-001/b1-thumb.jpg', width: 800, height: 800, position: 1, isCurrent: false } });
  await prisma.assetAdtext.upsert({ where: { id: '00000000-0000-0000-0000-000000000501' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000501', productId: product1.id, version: 'v1', primaryText: 'Say goodbye to tangled cables. The SlimPro wireless mouse gives you the freedom to work from anywhere.', headline: 'SlimPro Wireless Mouse — Work Smarter', description: 'Ergonomic. Precise. Silent. Free 2-day shipping.' } });
  await prisma.assetAdtext.upsert({ where: { id: '00000000-0000-0000-0000-000000000502' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000502', productId: product1.id, version: 'b1', primaryText: 'The mouse that feels as good as it looks. Slim, precise, and wireless.', headline: 'Go Wireless Today — Only $29.99', description: null } });
  console.log('Product 1 (SlimPro Wireless Mouse) seeded');

  // ---- Product 2: ProStand Laptop Stand (fixed pricing override) ----
  const product2 = await prisma.product.upsert({
    where: { productCode: 'STAND-001' },
    update: {},
    create: {
      productCode: 'STAND-001',
      name: 'ProStand Laptop Stand',
      slug: 'prostand-laptop-stand',
      basePrice: 34.99,
      compareAtPrice: 49.99,
      currency: 'USD',
      sku: 'STAND-001-SKU',
      description: 'Adjustable aluminum laptop stand with cable management.',
      descriptionBlocks: [
        { type: 'paragraph', content: 'Premium aluminum alloy construction.' },
        { type: 'bullet_list', items: ['Adjustable 0-60 degrees', 'Fits 10-17 inch laptops', 'Foldable for travel'] },
      ],
      shippingInfo: { weight_g: 420, dimensions_cm: { l: 26, w: 22, h: 3 } },
      tags: ['laptop', 'stand', 'ergonomic', 'aluminum', 'portable'],
      status: 'ACTIVE',
    },
  });
  await prisma.productVariant.upsert({ where: { id: '00000000-0000-0000-0000-000000000111' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000111', productId: product2.id, name: 'Silver', sku: 'STAND-001-SLV', priceOverride: null, options: { color: 'Silver' }, stockQuantity: 200, isActive: true, position: 0 } });
  await prisma.productVariant.upsert({ where: { id: '00000000-0000-0000-0000-000000000112' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000112', productId: product2.id, name: 'Space Gray', sku: 'STAND-001-SGR', priceOverride: 37.99, options: { color: 'Space Gray' }, stockQuantity: 120, isActive: true, position: 1 } });
  await prisma.productProductLabel.upsert({ where: { productId_labelId: { productId: product2.id, labelId: labelBestseller.id } }, update: {}, create: { productId: product2.id, labelId: labelBestseller.id } });
  await prisma.productProductLabel.upsert({ where: { productId_labelId: { productId: product2.id, labelId: labelNewArrival.id } }, update: {}, create: { productId: product2.id, labelId: labelNewArrival.id } });
  // Pricing: fixed override = 15.00 (percentage 25% ignored when fixed is set)
  await prisma.pricingRule.upsert({ where: { id: '00000000-0000-0000-0000-000000000202' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000202', productId: product2.id, suggestedRetail: 54.99, sellerTakePercent: 25.00, sellerTakeFixed: 15.00, holdPercent: 10, holdDurationDays: 7, effectiveFrom: new Date('2026-01-01T00:00:00Z'), effectiveUntil: null, isActive: true } });
  console.log('Product 2 (ProStand Laptop Stand) seeded');

  // ---- Product 3: UltraClean Desk Pad (percentage pricing, limited-edition) ----
  const product3 = await prisma.product.upsert({
    where: { productCode: 'DESKPAD-001' },
    update: {},
    create: {
      productCode: 'DESKPAD-001',
      name: 'UltraClean Desk Pad',
      slug: 'ultraclean-desk-pad',
      basePrice: 24.99,
      compareAtPrice: null,
      currency: 'USD',
      sku: 'DESKPAD-001-SKU',
      description: 'Large waterproof desk pad with stitched edges and non-slip rubber base.',
      descriptionBlocks: [
        { type: 'paragraph', content: 'Keep your desk clean and organised.' },
        { type: 'bullet_list', items: ['900x400mm XL size', 'Waterproof surface', 'Non-slip base'] },
      ],
      shippingInfo: { weight_g: 280, dimensions_cm: { l: 92, w: 42, h: 0.3 } },
      tags: ['desk', 'pad', 'waterproof', 'home-office'],
      status: 'ACTIVE',
    },
  });
  await prisma.productVariant.upsert({ where: { id: '00000000-0000-0000-0000-000000000121' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000121', productId: product3.id, name: 'Black / XL', sku: 'DESKPAD-001-BLK-XL', priceOverride: null, options: { color: 'Black', size: 'XL' }, stockQuantity: 300, isActive: true, position: 0 } });
  await prisma.productVariant.upsert({ where: { id: '00000000-0000-0000-0000-000000000122' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000122', productId: product3.id, name: 'Grey / XL', sku: 'DESKPAD-001-GRY-XL', priceOverride: null, options: { color: 'Grey', size: 'XL' }, stockQuantity: 250, isActive: true, position: 1 } });
  await prisma.productVariant.upsert({ where: { id: '00000000-0000-0000-0000-000000000123' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000123', productId: product3.id, name: 'Pink / XL', sku: 'DESKPAD-001-PNK-XL', priceOverride: 26.99, options: { color: 'Pink', size: 'XL' }, stockQuantity: 75, isActive: true, position: 2 } });
  await prisma.productProductLabel.upsert({ where: { productId_labelId: { productId: product3.id, labelId: labelLimited.id } }, update: {}, create: { productId: product3.id, labelId: labelLimited.id } });
  await prisma.productProductLabel.upsert({ where: { productId_labelId: { productId: product3.id, labelId: labelTrending.id } }, update: {}, create: { productId: product3.id, labelId: labelTrending.id } });
  // Pricing: 39.99 * 35% = 14.00
  await prisma.pricingRule.upsert({ where: { id: '00000000-0000-0000-0000-000000000203' }, update: {}, create: { id: '00000000-0000-0000-0000-000000000203', productId: product3.id, suggestedRetail: 39.99, sellerTakePercent: 35.00, sellerTakeFixed: null, holdPercent: 10, holdDurationDays: 7, effectiveFrom: new Date('2026-01-01T00:00:00Z'), effectiveUntil: null, isActive: true } });
  console.log('Product 3 (UltraClean Desk Pad) seeded');

  // ─────────────────────────────────────────────────────────────────────────
  // SEED SELLER + SELLPAGES (for Milestone 2.2.2 e2e / dev testing)
  // ─────────────────────────────────────────────────────────────────────────

  // Seed User (password hash is bcrypt of "seedpassword123" at cost 12)
  // Pre-computed hash so the seed is deterministic and requires no bcrypt dep.
  const SEED_USER_ID = '00000000-0000-0000-0000-000000001001';
  const SEED_SELLER_ID = '00000000-0000-0000-0000-000000001002';

  const seedUser = await prisma.user.upsert({
    where: { id: SEED_USER_ID },
    update: {},
    create: {
      id: SEED_USER_ID,
      email: 'seed-seller@pixecom.io',
      // bcrypt hash of "seedpassword123" (cost=12) — pre-computed for idempotency
      passwordHash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCMcmDIoWS8SMCdp/05W5lG',
      displayName: 'Seed Seller',
      isActive: true,
    },
  });

  const seedSeller = await prisma.seller.upsert({
    where: { id: SEED_SELLER_ID },
    update: {},
    create: {
      id: SEED_SELLER_ID,
      name: 'Seed Seller Co.',
      slug: 'seed-seller-co',
      isActive: true,
    },
  });

  await prisma.sellerUser.upsert({
    where: { uq_seller_user: { sellerId: seedSeller.id, userId: seedUser.id } },
    update: {},
    create: {
      sellerId: seedSeller.id,
      userId: seedUser.id,
      role: 'OWNER',
      isActive: true,
    },
  });

  await prisma.sellerSettings.upsert({
    where: { sellerId: seedSeller.id },
    update: {},
    create: {
      sellerId: seedSeller.id,
      brandName: 'Seed Seller Co.',
      defaultCurrency: 'USD',
      timezone: 'UTC',
    },
  });

  console.log('Seed seller seeded');

  // Sellpage 1: DRAFT — mouse sellpage (no domain)
  await prisma.sellpage.upsert({
    where: { id: '00000000-0000-0000-0000-000000002001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000002001',
      sellerId: seedSeller.id,
      productId: product1.id,
      slug: 'my-mouse-offer',
      status: 'DRAFT',
      titleOverride: 'Get the SlimPro Mouse Today',
      descriptionOverride: 'Limited time wireless mouse deal.',
    },
  });

  // Sellpage 2: PUBLISHED — laptop stand sellpage (no domain)
  await prisma.sellpage.upsert({
    where: { id: '00000000-0000-0000-0000-000000002002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000002002',
      sellerId: seedSeller.id,
      productId: product2.id,
      slug: 'prostand-special',
      status: 'PUBLISHED',
      titleOverride: 'ProStand — Best Laptop Stand',
      descriptionOverride: null,
    },
  });

  // Sellpage 3: DRAFT — desk pad sellpage (no domain)
  await prisma.sellpage.upsert({
    where: { id: '00000000-0000-0000-0000-000000002003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000002003',
      sellerId: seedSeller.id,
      productId: product3.id,
      slug: 'desk-pad-offer',
      status: 'DRAFT',
      titleOverride: null,
      descriptionOverride: null,
    },
  });

  console.log('Sellpages seeded');

  // ─────────────────────────────────────────────────────────────────────────
  // SEED DOMAINS (for Milestone 2.2.3 e2e / dev testing)
  // ─────────────────────────────────────────────────────────────────────────

  // Domain 1: VERIFIED + isPrimary — used to test verified domain flow
  const seedDomain1 = await prisma.sellerDomain.upsert({
    where: { id: '00000000-0000-0000-0000-000000003001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000003001',
      sellerId: seedSeller.id,
      hostname: 'seed-shop.example.com',
      verificationMethod: 'TXT',
      verificationToken: 'seed-verified-token-abc123xyz',
      status: 'VERIFIED',
      isPrimary: true,
      verifiedAt: new Date('2026-02-01T00:00:00Z'),
    },
  });

  // Domain 2: PENDING — used to test that publish fails on unverified domain
  await prisma.sellerDomain.upsert({
    where: { id: '00000000-0000-0000-0000-000000003002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000003002',
      sellerId: seedSeller.id,
      hostname: 'seed-pending.example.com',
      verificationMethod: 'TXT',
      verificationToken: 'seed-pending-token-def456uvw',
      status: 'PENDING',
      isPrimary: false,
    },
  });

  console.log('Seed domains seeded');

  // Update sellpage 2 to use the verified domain
  // urlPreview should now be: https://seed-shop.example.com/prostand-special
  await prisma.sellpage.update({
    where: { id: '00000000-0000-0000-0000-000000002002' },
    data: { domainId: seedDomain1.id },
  });

  console.log('Sellpage 2 linked to verified domain');

  // ─────────────────────────────────────────────────────────────────────────
  // SEED ASSETS + CREATIVES (for Milestone 2.4 e2e / dev testing)
  // ─────────────────────────────────────────────────────────────────────────

  // Platform asset 1: VIDEO (ownerSellerId = null → visible to all sellers)
  const platformAsset1 = await prisma.asset.upsert({
    where: { id: '00000000-0000-0000-0000-000000004001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000004001',
      ownerSellerId: null,
      sourceType: 'SYSTEM',
      ingestionId: 'platform-video-001',
      mediaType: 'VIDEO',
      url: 'https://cdn.pixelxlab.com/platform/v1-demo-video.mp4',
      storageKey: 'platform/v1-demo-video.mp4',
      mimeType: 'video/mp4',
      fileSizeBytes: BigInt(12000000),
      durationSec: 30,
      width: 1080,
      height: 1080,
    },
  });

  // Platform asset 2: IMAGE (ownerSellerId = null → visible to all sellers)
  const platformAsset2 = await prisma.asset.upsert({
    where: { id: '00000000-0000-0000-0000-000000004002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000004002',
      ownerSellerId: null,
      sourceType: 'SYSTEM',
      ingestionId: 'platform-image-001',
      mediaType: 'IMAGE',
      url: 'https://cdn.pixelxlab.com/platform/v1-product-thumb.jpg',
      storageKey: 'platform/v1-product-thumb.jpg',
      mimeType: 'image/jpeg',
      fileSizeBytes: BigInt(250000),
      width: 800,
      height: 800,
    },
  });

  // Seller asset 1: USER_UPLOAD VIDEO (owned by seed seller)
  const sellerAsset1 = await prisma.asset.upsert({
    where: { id: '00000000-0000-0000-0000-000000004003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000004003',
      ownerSellerId: SEED_SELLER_ID,
      sourceType: 'USER_UPLOAD',
      ingestionId: null,
      mediaType: 'VIDEO',
      url: 'https://cdn.pixelxlab.com/sellers/seed/mouse-ad-video.mp4',
      storageKey: 'sellers/seed/mouse-ad-video.mp4',
      mimeType: 'video/mp4',
      fileSizeBytes: BigInt(5200000),
      durationSec: 15,
      width: 1080,
      height: 1920,
      checksum: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
  });

  // Seller asset 2: USER_UPLOAD TEXT (owned by seed seller)
  const sellerAsset2 = await prisma.asset.upsert({
    where: { id: '00000000-0000-0000-0000-000000004004' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000004004',
      ownerSellerId: SEED_SELLER_ID,
      sourceType: 'USER_UPLOAD',
      ingestionId: null,
      mediaType: 'TEXT',
      url: 'https://cdn.pixelxlab.com/sellers/seed/mouse-ad-copy.txt',
      storageKey: 'sellers/seed/mouse-ad-copy.txt',
      mimeType: 'text/plain',
    },
  });

  console.log('Assets seeded (2 platform + 2 seller)');

  // Creative 1: DRAFT — mouse ad (seed seller, linked to product 1)
  // Has PRIMARY_VIDEO + THUMBNAIL + PRIMARY_TEXT → can be validated to READY
  const seedCreative1 = await prisma.creative.upsert({
    where: { id: '00000000-0000-0000-0000-000000005001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000005001',
      sellerId: SEED_SELLER_ID,
      productId: product1.id,
      name: 'Mouse Ad — Seed Creative',
      status: 'DRAFT',
    },
  });

  // CreativeAsset slot 1: PRIMARY_VIDEO (seller asset 1 — own video)
  await prisma.creativeAsset.upsert({
    where: {
      uq_creative_asset_role: {
        creativeId: seedCreative1.id,
        role: 'PRIMARY_VIDEO',
      },
    },
    update: {},
    create: {
      creativeId: seedCreative1.id,
      assetId: sellerAsset1.id,
      role: 'PRIMARY_VIDEO',
    },
  });

  // CreativeAsset slot 2: THUMBNAIL (platform image asset 2)
  await prisma.creativeAsset.upsert({
    where: {
      uq_creative_asset_role: {
        creativeId: seedCreative1.id,
        role: 'THUMBNAIL',
      },
    },
    update: {},
    create: {
      creativeId: seedCreative1.id,
      assetId: platformAsset2.id,
      role: 'THUMBNAIL',
    },
  });

  // CreativeAsset slot 3: PRIMARY_TEXT (seller text asset)
  await prisma.creativeAsset.upsert({
    where: {
      uq_creative_asset_role: {
        creativeId: seedCreative1.id,
        role: 'PRIMARY_TEXT',
      },
    },
    update: {},
    create: {
      creativeId: seedCreative1.id,
      assetId: sellerAsset2.id,
      role: 'PRIMARY_TEXT',
    },
  });

  console.log('Creative seeded with 3 asset slots (ready to validate)');

  // ─────────────────────────────────────────────────────────────────────────
  // SUPERADMIN ACCOUNT
  // ─────────────────────────────────────────────────────────────────────────

  // bcrypt hash of "admin123456" at cost 10 — pre-computed for idempotency
  await prisma.user.upsert({
    where: { email: 'admin@pixecom.com' },
    update: { isSuperadmin: true },
    create: {
      email: 'admin@pixecom.com',
      passwordHash: '$2b$10$cUujddZFj9TelHT.IQTGgeHpZx.Tp59yCx0dR82aADolWZz4gq6n.',
      displayName: 'PixEcom Admin',
      isSuperadmin: true,
    },
  });
  console.log('Superadmin seeded: admin@pixecom.com / admin123456');

  const pc = await prisma.product.count();
  const vc = await prisma.productVariant.count();
  const lc = await prisma.productLabel.count();
  const mc = await prisma.assetMedia.count();
  const tc = await prisma.assetThumbnail.count();
  const ac = await prisma.assetAdtext.count();
  const rc = await prisma.pricingRule.count();
  const sc = await prisma.sellpage.count();
  const dc = await prisma.sellerDomain.count();
  const assetCount = await prisma.asset.count();
  const creativeCount = await prisma.creative.count();
  const creativeAssetCount = await prisma.creativeAsset.count();
  console.log(`Summary: ${pc} products, ${vc} variants, ${lc} labels, ${mc} media, ${tc} thumbs, ${ac} adtexts, ${rc} pricing rules, ${sc} sellpages, ${dc} domains, ${assetCount} assets, ${creativeCount} creatives, ${creativeAssetCount} creative_assets`);
  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
