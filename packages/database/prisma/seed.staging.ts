/**
 * Alpha Staging Seed — PixEcom v2 (Milestone 2.4.0)
 *
 * Creates a self-contained, realistic dataset for frontend integration testing.
 *
 * Dataset:
 *   - 1 seller (alpha-seller@pixecom.io / AlphaSeed2026!)
 *   - 3 sellpages (2 PUBLISHED, 1 DRAFT)
 *   - 100 orders spread across last 30 days (mixed statuses)
 *   - 10 campaigns / 30 adsets / 60 ads
 *   - 14–30 days of realistic AdStatsDaily per entity
 *   - 30 days of SellpageStatsDaily per sellpage
 *
 * Idempotent: all records use fixed UUIDs with "SEED" prefix.
 * Reset: run seed.staging.reset.ts to remove only these records.
 *
 * Guard: refuses to run unless NODE_ENV=staging or APP_ENV=staging.
 *
 * Run:
 *   pnpm --filter @pixecom/database seed:staging
 *   # or from root:
 *   pnpm seed:staging
 */

import { PrismaClient } from '@prisma/client';

// ─── Staging Guard ────────────────────────────────────────────────────────────
const env = process.env.NODE_ENV;
const appEnv = process.env.APP_ENV;

if (env !== 'staging' && appEnv !== 'staging') {
  console.error(
    `❌ STAGING GUARD: This seed only runs in staging environment.\n` +
    `   Current: NODE_ENV="${env ?? 'undefined'}", APP_ENV="${appEnv ?? 'undefined'}"\n` +
    `   Set NODE_ENV=staging or APP_ENV=staging before running.`,
  );
  process.exit(1);
}

const prisma = new PrismaClient();

// ─── Fixed IDs (SEED prefix = 000000000000-SEED) ────────────────────────────
// Pattern: 00000000-SEED-<layer>-<type>-<index padded 6 digits>
// Layer:   0001=seller, 0002=sellpage, 0003=order, 0004=campaign, 0005=adset, 0006=ad, 0007=stats
const SEED = {
  // Auth
  USER_ID:   '00000000-5eed-0001-0001-000000000001',
  SELLER_ID: '00000000-5eed-0001-0002-000000000001',

  // Sellpages
  SP:    (i: number) => `00000000-5eed-0002-0001-${String(i).padStart(12, '0')}`,

  // Orders
  ORD:   (i: number) => `00000000-5eed-0003-0001-${String(i).padStart(12, '0')}`,
  OI:    (i: number) => `00000000-5eed-0003-0002-${String(i).padStart(12, '0')}`,
  OE:    (i: number) => `00000000-5eed-0003-0003-${String(i).padStart(12, '0')}`,

  // Ads
  FB:    (i: number) => `00000000-5eed-0004-0001-${String(i).padStart(12, '0')}`,
  CMP:   (i: number) => `00000000-5eed-0004-0002-${String(i).padStart(12, '0')}`,
  ADS:   (i: number) => `00000000-5eed-0004-0003-${String(i).padStart(12, '0')}`,
  AD:    (i: number) => `00000000-5eed-0004-0004-${String(i).padStart(12, '0')}`,
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number, hour = 12): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function dateOnly(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function jitter(base: number, pct = 0.25): number {
  return base * (1 - pct + Math.random() * pct * 2);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting Alpha Staging Seed (seed_tag: alpha_staging_v1)...\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // 0. ENSURE PLATFORM PRODUCTS EXIST (require main seed first)
  // ═══════════════════════════════════════════════════════════════════════════

  const [product1, product2, product3] = await Promise.all([
    prisma.product.findUnique({ where: { productCode: 'MOUSE-001' } }),
    prisma.product.findUnique({ where: { productCode: 'STAND-001' } }),
    prisma.product.findUnique({ where: { productCode: 'DESKPAD-001' } }),
  ]);

  if (!product1 || !product2 || !product3) {
    console.error(
      '❌ Platform products not found.\n' +
      '   Run main seed first: pnpm --filter @pixecom/database db:seed',
    );
    process.exit(1);
  }

  // Load variants (we'll use them for order items)
  const [variants1, variants2, variants3] = await Promise.all([
    prisma.productVariant.findMany({ where: { productId: product1.id }, orderBy: { position: 'asc' } }),
    prisma.productVariant.findMany({ where: { productId: product2.id }, orderBy: { position: 'asc' } }),
    prisma.productVariant.findMany({ where: { productId: product3.id }, orderBy: { position: 'asc' } }),
  ]);

  console.log(`✅ Platform products: ${product1.name}, ${product2.name}, ${product3.name}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. SELLER + USER
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n👤 Seeding alpha seller...');

  // bcrypt hash of "AlphaSeed2026!" (cost=12) — pre-computed for idempotency
  const ALPHA_PASSWORD_HASH = '$2b$12$sdYt7WcMkP4r5P2R4mi62O6At7xazYTxzD.LZU7g/8L8.zNTPoQhC';

  await prisma.user.upsert({
    where: { id: SEED.USER_ID },
    update: { passwordHash: ALPHA_PASSWORD_HASH }, // always ensure correct hash on re-run
    create: {
      id: SEED.USER_ID,
      email: 'alpha-seller@pixecom.io',
      passwordHash: ALPHA_PASSWORD_HASH,
      displayName: 'Alpha Seller',
      isActive: true,
    },
  });

  await prisma.seller.upsert({
    where: { id: SEED.SELLER_ID },
    update: {},
    create: {
      id: SEED.SELLER_ID,
      name: 'Alpha Test Store',
      slug: 'alpha-test-store',
      isActive: true,
    },
  });

  await prisma.sellerUser.upsert({
    where: { uq_seller_user: { sellerId: SEED.SELLER_ID, userId: SEED.USER_ID } },
    update: {},
    create: {
      sellerId: SEED.SELLER_ID,
      userId: SEED.USER_ID,
      role: 'OWNER',
      isActive: true,
    },
  });

  await prisma.sellerSettings.upsert({
    where: { sellerId: SEED.SELLER_ID },
    update: {},
    create: {
      sellerId: SEED.SELLER_ID,
      brandName: 'Alpha Test Store',
      defaultCurrency: 'USD',
      timezone: 'America/New_York',
      supportEmail: 'support@alpha-test.io',
    },
  });

  const sellerId = SEED.SELLER_ID;
  console.log(`   ✅ Seller: Alpha Test Store (${sellerId})`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. SELLPAGES (3: 2 PUBLISHED, 1 DRAFT)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n📄 Seeding sellpages...');

  const sellpageData = [
    {
      id: SEED.SP(1),
      productId: product1.id,
      slug: 'staging-mouse-deal',
      status: 'PUBLISHED' as const,
      titleOverride: 'SlimPro Wireless Mouse — Flash Deal',
      descriptionOverride: 'Top-rated wireless mouse at an unbeatable price. Free shipping today.',
    },
    {
      id: SEED.SP(2),
      productId: product2.id,
      slug: 'staging-stand-offer',
      status: 'PUBLISHED' as const,
      titleOverride: 'ProStand — Upgrade Your Workspace',
      descriptionOverride: null,
    },
    {
      id: SEED.SP(3),
      productId: product3.id,
      slug: 'staging-deskpad-promo',
      status: 'DRAFT' as const,
      titleOverride: null,
      descriptionOverride: null,
    },
  ];

  for (const sp of sellpageData) {
    await prisma.sellpage.upsert({
      where: { id: sp.id },
      update: {},
      create: {
        id: sp.id,
        sellerId,
        productId: sp.productId,
        slug: sp.slug,
        status: sp.status,
        titleOverride: sp.titleOverride,
        descriptionOverride: sp.descriptionOverride,
      },
    });
  }

  console.log('   ✅ 3 sellpages (2 PUBLISHED, 1 DRAFT)');

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. 100 ORDERS — spread across last 30 days
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n🛒 Seeding 100 orders across 30 days...');

  const orderStatuses = [
    'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED',
    'DELIVERED', 'DELIVERED', 'DELIVERED', // weight DELIVERED higher
    'CANCELLED', 'REFUNDED',
  ] as const;

  const customerPool = [
    { name: 'Alice Nguyen',   email: 'alice.nguyen@gmail.com',   phone: '+84901234567', city: 'Ho Chi Minh City', country: 'VN', zip: '70000' },
    { name: 'Bob Tran',       email: 'bob.tran@outlook.com',     phone: '+84909876543', city: 'Da Nang',          country: 'VN', zip: '50000' },
    { name: 'Charlie Le',     email: 'charlie.le@yahoo.com',     phone: null,           city: 'Ha Noi',           country: 'VN', zip: '10000' },
    { name: 'Diana Pham',     email: 'diana.pham@gmail.com',     phone: '+84912345678', city: 'Ho Chi Minh City', country: 'VN', zip: '70000' },
    { name: 'Ethan Vo',       email: 'ethan.vo@hotmail.com',     phone: null,           city: 'Can Tho',          country: 'VN', zip: '90000' },
    { name: 'Fiona Doan',     email: 'fiona.doan@gmail.com',     phone: '+84905678901', city: 'Hue',              country: 'VN', zip: '53000' },
    { name: 'George Ngo',     email: 'george.ngo@icloud.com',    phone: '+84898765432', city: 'Vung Tau',         country: 'VN', zip: '78000' },
    { name: 'Hannah Mai',     email: 'hannah.mai@gmail.com',     phone: '+84977654321', city: 'Nha Trang',        country: 'VN', zip: '65000' },
    { name: 'Ivan Luong',     email: 'ivan.luong@yahoo.com',     phone: null,           city: 'Binh Duong',       country: 'VN', zip: '75000' },
    { name: 'Jenny Hoang',    email: 'jenny.hoang@gmail.com',    phone: '+84922345678', city: 'Long An',          country: 'VN', zip: '82000' },
    { name: 'Kevin Do',       email: 'kevin.do@gmail.com',       phone: '+84933456789', city: 'Hai Phong',        country: 'VN', zip: '18000' },
    { name: 'Linda Truong',   email: 'linda.truong@outlook.com', phone: null,           city: 'Quang Ninh',       country: 'VN', zip: '20000' },
  ];

  const productPairs = [
    { product: product1, variants: variants1, priceBase: 29.99, productName: product1.name },
    { product: product2, variants: variants2, priceBase: 34.99, productName: product2.name },
    { product: product3, variants: variants3, priceBase: 24.99, productName: product3.name },
  ];

  const sellpageIds = [SEED.SP(1), SEED.SP(2)]; // Published sellpages

  let orderItemIdx = 1;
  let orderEventIdx = 1;

  for (let i = 1; i <= 100; i++) {
    const daysBack = Math.floor(Math.random() * 30); // 0-29 days ago
    const createdAt = daysAgo(daysBack, 8 + Math.floor(Math.random() * 14));
    const customer = customerPool[(i - 1) % customerPool.length];
    const status = pick(orderStatuses);
    const sellpageId = pick(sellpageIds);

    // 1 or 2 line items per order
    const numItems = Math.random() < 0.3 ? 2 : 1;
    const prodPick = pick(productPairs);
    const variant = prodPick.variants[Math.floor(Math.random() * prodPick.variants.length)] ?? prodPick.variants[0];
    const unitPrice = variant?.priceOverride
      ? Number(variant.priceOverride)
      : prodPick.priceBase;
    const qty = Math.random() < 0.2 ? 2 : 1;
    const lineTotal1 = +(unitPrice * qty).toFixed(2);
    let subtotal = lineTotal1;

    let subtotal2 = 0;
    const prodPick2 = numItems > 1 ? pick(productPairs) : null;
    const variant2 = prodPick2?.variants[0];
    const unitPrice2 = variant2?.priceOverride
      ? Number(variant2.priceOverride)
      : (prodPick2?.priceBase ?? 0);
    if (numItems > 1) {
      subtotal2 = +(unitPrice2).toFixed(2);
      subtotal = +(subtotal + subtotal2).toFixed(2);
    }

    const shippingCost = Math.random() < 0.3 ? 0 : 5.00;
    const taxAmount = +(subtotal * 0.05).toFixed(2);
    const discountAmount = Math.random() < 0.15 ? 5.00 : 0;
    const total = +(subtotal + shippingCost + taxAmount - discountAmount).toFixed(2);

    const orderNumber = `STG-${String(i).padStart(4, '0')}`;

    await prisma.order.upsert({
      where: { id: SEED.ORD(i) },
      update: {},
      create: {
        id: SEED.ORD(i),
        sellerId,
        sellpageId,
        orderNumber,
        customerEmail: customer.email,
        customerName: customer.name,
        customerPhone: customer.phone,
        shippingAddress: {
          street: `${100 + i} Sample Street`,
          city: customer.city,
          country: customer.country,
          zip: customer.zip,
        },
        subtotal,
        shippingCost,
        taxAmount,
        discountAmount,
        total,
        currency: 'USD',
        status,
        paymentMethod: Math.random() < 0.7 ? 'card' : 'paypal',
        paymentId: `PAY-${String(i).padStart(6, '0')}-ALPHA`,
        paidAt: status === 'PENDING' ? null : new Date(createdAt.getTime() + 60000),
        trackingNumber: ['SHIPPED', 'DELIVERED'].includes(status)
          ? `TRK${String(i).padStart(10, '0')}`
          : null,
        createdAt,
      },
    });

    // Order item 1
    const oi1Id = SEED.OI(orderItemIdx++);
    await prisma.orderItem.upsert({
      where: { id: oi1Id },
      update: {},
      create: {
        id: oi1Id,
        orderId: SEED.ORD(i),
        productId: prodPick.product.id,
        variantId: variant?.id,
        productName: prodPick.productName,
        variantName: variant?.name ?? null,
        sku: variant?.sku ?? null,
        quantity: qty,
        unitPrice,
        lineTotal: lineTotal1,
      },
    });

    // Order item 2 (optional)
    if (numItems > 1 && prodPick2 && variant2) {
      const oi2Id = SEED.OI(orderItemIdx++);
      await prisma.orderItem.upsert({
        where: { id: oi2Id },
        update: {},
        create: {
          id: oi2Id,
          orderId: SEED.ORD(i),
          productId: prodPick2.product.id,
          variantId: variant2.id,
          productName: prodPick2.productName,
          variantName: variant2.name,
          sku: variant2.sku ?? null,
          quantity: 1,
          unitPrice: unitPrice2,
          lineTotal: subtotal2,
        },
      });
    }

    // Order events
    const evtCreatedId = SEED.OE(orderEventIdx++);
    await prisma.orderEvent.upsert({
      where: { id: evtCreatedId },
      update: {},
      create: {
        id: evtCreatedId,
        orderId: SEED.ORD(i),
        sellerId,
        eventType: 'CREATED',
        description: 'Order placed via sellpage',
        createdAt,
      },
    });

    if (['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'REFUNDED'].includes(status)) {
      const evtConfId = SEED.OE(orderEventIdx++);
      await prisma.orderEvent.upsert({
        where: { id: evtConfId },
        update: {},
        create: {
          id: evtConfId,
          orderId: SEED.ORD(i),
          sellerId,
          eventType: 'CONFIRMED',
          description: 'Payment confirmed',
          createdAt: new Date(createdAt.getTime() + 3600000),
        },
      });
    }

    if (['SHIPPED', 'DELIVERED'].includes(status)) {
      const evtShipId = SEED.OE(orderEventIdx++);
      await prisma.orderEvent.upsert({
        where: { id: evtShipId },
        update: {},
        create: {
          id: evtShipId,
          orderId: SEED.ORD(i),
          sellerId,
          eventType: 'SHIPPED',
          description: `Shipped — TRK${String(i).padStart(10, '0')}`,
          createdAt: new Date(createdAt.getTime() + 86400000 * 2),
        },
      });
    }

    if (status === 'DELIVERED') {
      const evtDelId = SEED.OE(orderEventIdx++);
      await prisma.orderEvent.upsert({
        where: { id: evtDelId },
        update: {},
        create: {
          id: evtDelId,
          orderId: SEED.ORD(i),
          sellerId,
          eventType: 'DELIVERED',
          description: 'Customer received',
          createdAt: new Date(createdAt.getTime() + 86400000 * 5),
        },
      });
    }

    if (status === 'CANCELLED') {
      const evtCancelId = SEED.OE(orderEventIdx++);
      await prisma.orderEvent.upsert({
        where: { id: evtCancelId },
        update: {},
        create: {
          id: evtCancelId,
          orderId: SEED.ORD(i),
          sellerId,
          eventType: 'CANCELLED',
          description: 'Customer requested cancellation',
          createdAt: new Date(createdAt.getTime() + 3600000 * 4),
        },
      });
    }

    if (status === 'REFUNDED') {
      const evtRefId = SEED.OE(orderEventIdx++);
      await prisma.orderEvent.upsert({
        where: { id: evtRefId },
        update: {},
        create: {
          id: evtRefId,
          orderId: SEED.ORD(i),
          sellerId,
          eventType: 'REFUNDED',
          description: 'Refund processed',
          createdAt: new Date(createdAt.getTime() + 86400000 * 7),
        },
      });
    }
  }

  console.log(`   ✅ 100 orders, ${orderItemIdx - 1} order items, ${orderEventIdx - 1} order events`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. FB CONNECTION (1 AD_ACCOUNT)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n🔗 Seeding FB connection...');

  await prisma.fbConnection.upsert({
    where: { id: SEED.FB(1) },
    update: {},
    create: {
      id: SEED.FB(1),
      sellerId,
      connectionType: 'AD_ACCOUNT',
      externalId: 'act_staging_test_001',
      name: 'Staging Test Ad Account',
      accessTokenEnc: null,
      isPrimary: true,
      isActive: true,
    },
  });

  console.log('   ✅ 1 AD_ACCOUNT FB connection');

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. CAMPAIGNS (10) / ADSETS (30 = 3 per campaign) / ADS (60 = 2 per adset)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n📢 Seeding 10 campaigns / 30 adsets / 60 ads...');

  const campaignDefs = [
    { name: 'Mouse Flash Sale — Q1',       sp: SEED.SP(1), budget: 50.00, status: 'ACTIVE'  as const, days: 30 },
    { name: 'Mouse Retargeting',            sp: SEED.SP(1), budget: 30.00, status: 'ACTIVE'  as const, days: 25 },
    { name: 'Mouse Lookalike — 1%',        sp: SEED.SP(1), budget: 40.00, status: 'PAUSED'  as const, days: 20 },
    { name: 'Stand Awareness',             sp: SEED.SP(2), budget: 35.00, status: 'ACTIVE'  as const, days: 28 },
    { name: 'Stand Conversions',           sp: SEED.SP(2), budget: 60.00, status: 'ACTIVE'  as const, days: 30 },
    { name: 'Stand Interest — Office',     sp: SEED.SP(2), budget: 25.00, status: 'PAUSED'  as const, days: 14 },
    { name: 'Mouse Brand — Video',         sp: SEED.SP(1), budget: 45.00, status: 'ACTIVE'  as const, days: 22 },
    { name: 'Mouse Broad Audience',        sp: SEED.SP(1), budget: 20.00, status: 'ARCHIVED'as const, days: 10 },
    { name: 'Stand Broad Audience',        sp: SEED.SP(2), budget: 20.00, status: 'ACTIVE'  as const, days: 18 },
    { name: 'Cross-Sell Bundle Campaign',  sp: SEED.SP(1), budget: 55.00, status: 'PAUSED'  as const, days: 15 },
  ];

  const adsetGoals = ['CONVERSIONS', 'LINK_CLICKS', 'REACH'];
  const adsetTargetings = [
    { interests: ['technology', 'gadgets'], age_min: 25, age_max: 45 },
    { lookalike: 'past_purchasers_1pct' },
    { interests: ['home-office', 'remote-work'], age_min: 22, age_max: 55 },
  ];

  let adIdx = 1;

  for (let ci = 1; ci <= 10; ci++) {
    const cdef = campaignDefs[ci - 1];
    const cmpId = SEED.CMP(ci);

    await prisma.campaign.upsert({
      where: { id: cmpId },
      update: {},
      create: {
        id: cmpId,
        sellerId,
        sellpageId: cdef.sp,
        adAccountId: SEED.FB(1),
        name: cdef.name,
        budget: cdef.budget,
        budgetType: 'DAILY',
        status: cdef.status,
        deliveryStatus: cdef.status.toLowerCase(),
        externalCampaignId: `ext_stg_cmp_${String(ci).padStart(3, '0')}`,
        startDate: daysAgo(cdef.days),
        createdAt: daysAgo(cdef.days),
      },
    });

    // 3 adsets per campaign
    for (let ai = 1; ai <= 3; ai++) {
      const adsetIdx = (ci - 1) * 3 + ai;
      const adsId = SEED.ADS(adsetIdx);
      const adsetStatus = cdef.status === 'ARCHIVED' ? 'ARCHIVED' : (ai === 3 ? 'PAUSED' : cdef.status);

      await prisma.adset.upsert({
        where: { id: adsId },
        update: {},
        create: {
          id: adsId,
          campaignId: cmpId,
          sellerId,
          name: `${cdef.name} — Adset ${ai}`,
          status: adsetStatus as any,
          deliveryStatus: adsetStatus.toLowerCase(),
          optimizationGoal: adsetGoals[(ai - 1) % 3],
          targeting: adsetTargetings[(ai - 1) % 3],
          externalAdsetId: `ext_stg_ads_${String(adsetIdx).padStart(3, '0')}`,
          createdAt: daysAgo(cdef.days),
        },
      });

      // 2 ads per adset
      for (let adI = 1; adI <= 2; adI++) {
        const currentAdIdx = adIdx++;
        const currentAdId = SEED.AD(currentAdIdx);
        const adStatus = adsetStatus === 'ARCHIVED' ? 'ARCHIVED' : adsetStatus;

        await prisma.ad.upsert({
          where: { id: currentAdId },
          update: {},
          create: {
            id: currentAdId,
            adsetId: adsId,
            sellerId,
            name: `${cdef.name} — Ad ${adI}`,
            status: adStatus as any,
            deliveryStatus: adStatus.toLowerCase(),
            externalAdId: `ext_stg_ad_${String(currentAdIdx).padStart(3, '0')}`,
            createdAt: daysAgo(cdef.days),
          },
        });
      }
    }
  }

  console.log(`   ✅ 10 campaigns, 30 adsets, 60 ads`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. AD STATS DAILY — 14-30 days per entity (campaigns, adsets, ads)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n📊 Seeding ad stats (14-30 days per entity)...');

  // Base metrics per campaign (realistic ranges for a mid-size seller)
  const cmpMetrics = [
    { spendBase: 48, impBase: 6000, clickBase: 250, cvBase: 170, coBase: 28, purchBase: 12, pvBase: 410 },
    { spendBase: 28, impBase: 3500, clickBase: 140, cvBase: 95,  coBase: 16, purchBase:  6, pvBase: 200 },
    { spendBase: 38, impBase: 4800, clickBase: 190, cvBase: 130, coBase: 22, purchBase: 10, pvBase: 340 },
    { spendBase: 33, impBase: 4200, clickBase: 165, cvBase: 110, coBase: 18, purchBase:  7, pvBase: 240 },
    { spendBase: 58, impBase: 7200, clickBase: 290, cvBase: 195, coBase: 32, purchBase: 14, pvBase: 490 },
    { spendBase: 23, impBase: 2900, clickBase: 115, cvBase:  78, coBase: 12, purchBase:  5, pvBase: 170 },
    { spendBase: 43, impBase: 5400, clickBase: 215, cvBase: 145, coBase: 24, purchBase: 10, pvBase: 360 },
    { spendBase: 18, impBase: 2200, clickBase:  88, cvBase:  60, coBase: 10, purchBase:  4, pvBase: 130 },
    { spendBase: 19, impBase: 2400, clickBase:  96, cvBase:  65, coBase: 11, purchBase:  4, pvBase: 145 },
    { spendBase: 53, impBase: 6600, clickBase: 265, cvBase: 178, coBase: 30, purchBase: 13, pvBase: 440 },
  ];

  let statsRowCount = 0;

  for (let ci = 1; ci <= 10; ci++) {
    const cdef = campaignDefs[ci - 1];
    const statDays = cdef.days; // 14-30 days of history
    const cmpId = SEED.CMP(ci);
    const m = cmpMetrics[ci - 1];

    for (let day = 0; day < statDays; day++) {
      const statDate = dateOnly(statDays - 1 - day);
      const spend = +jitter(m.spendBase).toFixed(2);
      const impressions = Math.round(jitter(m.impBase));
      const linkClicks = Math.round(jitter(m.clickBase));
      const contentViews = Math.round(jitter(m.cvBase));
      const checkoutInitiated = Math.round(jitter(m.coBase));
      const purchases = Math.round(jitter(m.purchBase));
      const purchaseValue = +jitter(m.pvBase).toFixed(2);
      const ctr = impressions > 0 ? +((linkClicks / impressions) * 100).toFixed(4) : 0;
      const cpc = linkClicks > 0 ? +(spend / linkClicks).toFixed(4) : 0;
      const cpm = impressions > 0 ? +((spend / impressions) * 1000).toFixed(4) : 0;
      const costPerPurchase = purchases > 0 ? +(spend / purchases).toFixed(2) : 0;
      const roas = spend > 0 ? +(purchaseValue / spend).toFixed(4) : 0;

      await prisma.adStatsDaily.upsert({
        where: { uq_ad_stats_daily: { sellerId, entityType: 'CAMPAIGN', entityId: cmpId, statDate } },
        update: { spend, impressions, linkClicks, contentViews, checkoutInitiated, purchases, purchaseValue, ctr, cpc, cpm, costPerPurchase, roas },
        create: { sellerId, entityType: 'CAMPAIGN', entityId: cmpId, statDate, spend, impressions, linkClicks, contentViews, checkoutInitiated, purchases, purchaseValue, ctr, cpc, cpm, costPerPurchase, roas },
      });
      statsRowCount++;
    }

    // 3 adsets per campaign
    for (let ai = 1; ai <= 3; ai++) {
      const adsetIdx = (ci - 1) * 3 + ai;
      const adsId = SEED.ADS(adsetIdx);
      const adsetDays = Math.min(statDays, 21); // adsets may have less history

      // Adset share of campaign budget: ~30-40% each (3 adsets split the campaign)
      const adsetFactor = 0.28 + Math.random() * 0.15;

      for (let day = 0; day < adsetDays; day++) {
        const statDate = dateOnly(adsetDays - 1 - day);
        const spend = +jitter(m.spendBase * adsetFactor).toFixed(2);
        const impressions = Math.round(jitter(m.impBase * adsetFactor));
        const linkClicks = Math.round(jitter(m.clickBase * adsetFactor));
        const contentViews = Math.round(jitter(m.cvBase * adsetFactor));
        const checkoutInitiated = Math.round(jitter(m.coBase * adsetFactor));
        const purchases = Math.round(jitter(m.purchBase * adsetFactor));
        const purchaseValue = +jitter(m.pvBase * adsetFactor).toFixed(2);
        const ctr = impressions > 0 ? +((linkClicks / impressions) * 100).toFixed(4) : 0;
        const cpc = linkClicks > 0 ? +(spend / linkClicks).toFixed(4) : 0;
        const cpm = impressions > 0 ? +((spend / impressions) * 1000).toFixed(4) : 0;
        const costPerPurchase = purchases > 0 ? +(spend / purchases).toFixed(2) : 0;
        const roas = spend > 0 ? +(purchaseValue / spend).toFixed(4) : 0;

        await prisma.adStatsDaily.upsert({
          where: { uq_ad_stats_daily: { sellerId, entityType: 'ADSET', entityId: adsId, statDate } },
          update: { spend, impressions, linkClicks, contentViews, checkoutInitiated, purchases, purchaseValue, ctr, cpc, cpm, costPerPurchase, roas },
          create: { sellerId, entityType: 'ADSET', entityId: adsId, statDate, spend, impressions, linkClicks, contentViews, checkoutInitiated, purchases, purchaseValue, ctr, cpc, cpm, costPerPurchase, roas },
        });
        statsRowCount++;
      }

      // 2 ads per adset
      for (let adI = 1; adI <= 2; adI++) {
        const adGlobalIdx = (ci - 1) * 6 + (ai - 1) * 2 + adI;
        const adId = SEED.AD(adGlobalIdx);
        const adDays = Math.min(adsetDays, 14);
        const adFactor = adsetFactor * (0.45 + Math.random() * 0.1);

        for (let day = 0; day < adDays; day++) {
          const statDate = dateOnly(adDays - 1 - day);
          const spend = +jitter(m.spendBase * adFactor).toFixed(2);
          const impressions = Math.round(jitter(m.impBase * adFactor));
          const linkClicks = Math.round(jitter(m.clickBase * adFactor));
          const contentViews = Math.round(jitter(m.cvBase * adFactor));
          const checkoutInitiated = Math.round(jitter(m.coBase * adFactor));
          const purchases = Math.round(jitter(m.purchBase * adFactor));
          const purchaseValue = +jitter(m.pvBase * adFactor).toFixed(2);
          const ctr = impressions > 0 ? +((linkClicks / impressions) * 100).toFixed(4) : 0;
          const cpc = linkClicks > 0 ? +(spend / linkClicks).toFixed(4) : 0;
          const cpm = impressions > 0 ? +((spend / impressions) * 1000).toFixed(4) : 0;
          const costPerPurchase = purchases > 0 ? +(spend / purchases).toFixed(2) : 0;
          const roas = spend > 0 ? +(purchaseValue / spend).toFixed(4) : 0;

          await prisma.adStatsDaily.upsert({
            where: { uq_ad_stats_daily: { sellerId, entityType: 'AD', entityId: adId, statDate } },
            update: { spend, impressions, linkClicks, contentViews, checkoutInitiated, purchases, purchaseValue, ctr, cpc, cpm, costPerPurchase, roas },
            create: { sellerId, entityType: 'AD', entityId: adId, statDate, spend, impressions, linkClicks, contentViews, checkoutInitiated, purchases, purchaseValue, ctr, cpc, cpm, costPerPurchase, roas },
          });
          statsRowCount++;
        }
      }
    }
  }

  console.log(`   ✅ ${statsRowCount} ad stats rows`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. SELLPAGE STATS DAILY — 30 days, 2 published sellpages, 3 ad sources
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n📈 Seeding sellpage stats (30 days × 2 sellpages × 3 ad sources)...');

  const adSources = ['facebook', 'instagram', 'organic'];

  const sellpageMetrics = [
    // SP1 (Mouse — high performer)
    { revenue: 320, orders: 9, adSpend: 45, linkClicks: 240, contentViews: 160, checkout: 25, purchases: 9 },
    // SP2 (Stand — moderate)
    { revenue: 210, orders: 6, adSpend: 32, linkClicks: 165, contentViews: 110, checkout: 16, purchases: 6 },
  ];

  const adSourceWeights = [0.55, 0.30, 0.15]; // facebook, instagram, organic

  let sellpageStatsRows = 0;

  for (let spI = 0; spI < 2; spI++) {
    const spId = SEED.SP(spI + 1);
    const baseM = sellpageMetrics[spI];

    for (let day = 0; day < 30; day++) {
      const statDate = dateOnly(29 - day);

      for (let srcI = 0; srcI < 3; srcI++) {
        const adSource = adSources[srcI];
        const w = adSourceWeights[srcI];

        const revenue = +jitter(baseM.revenue * w).toFixed(2);
        const ordersCount = Math.max(0, Math.round(jitter(baseM.orders * w)));
        const adSpend = srcI < 2 ? +jitter(baseM.adSpend * w).toFixed(2) : 0; // organic = 0 spend
        const linkClicks = Math.round(jitter(baseM.linkClicks * w));
        const contentViews = Math.round(jitter(baseM.contentViews * w));
        const checkoutInitiated = Math.round(jitter(baseM.checkout * w));
        const purchases = ordersCount;
        const roas = adSpend > 0 ? +(revenue / adSpend).toFixed(4) : 0;
        const cpm = linkClicks > 0 && adSpend > 0 ? +((adSpend / linkClicks) * 1000).toFixed(4) : 0;
        const ctr = linkClicks > 0 && contentViews > 0 ? +((purchases / linkClicks) * 100).toFixed(4) : 0;
        const costPerPurchase = purchases > 0 && adSpend > 0 ? +(adSpend / purchases).toFixed(2) : 0;
        const cr1 = linkClicks > 0 ? +(contentViews / linkClicks).toFixed(4) : 0;
        const cr2 = contentViews > 0 ? +(checkoutInitiated / Math.max(contentViews, 1)).toFixed(4) : 0;
        const cr3 = checkoutInitiated > 0 ? +(purchases / Math.max(checkoutInitiated, 1)).toFixed(4) : 0;

        await prisma.sellpageStatsDaily.upsert({
          where: {
            uq_sellpage_stats_daily: { sellerId, sellpageId: spId, statDate, adSource },
          },
          update: { revenue, ordersCount, adSpend, roas, cpm, ctr, linkClicks, contentViews, addToCart: checkoutInitiated, checkoutInitiated, purchases, costPerPurchase, cr1, cr2, cr3 },
          create: {
            sellerId,
            sellpageId: spId,
            statDate,
            adSource,
            revenue,
            ordersCount,
            adSpend,
            roas,
            cpm,
            ctr,
            linkClicks,
            contentViews,
            addToCart: checkoutInitiated,
            checkoutInitiated,
            purchases,
            costPerPurchase,
            cr1,
            cr2,
            cr3,
          },
        });
        sellpageStatsRows++;
      }
    }
  }

  console.log(`   ✅ ${sellpageStatsRows} sellpage stats rows (30 days × 2 sellpages × 3 sources)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  const counts = await Promise.all([
    prisma.sellpage.count({ where: { sellerId } }),
    prisma.order.count({ where: { sellerId } }),
    prisma.campaign.count({ where: { sellerId } }),
    prisma.adset.count({ where: { sellerId } }),
    prisma.ad.count({ where: { sellerId } }),
    prisma.adStatsDaily.count({ where: { sellerId } }),
    prisma.sellpageStatsDaily.count({ where: { sellerId } }),
  ]);

  console.log(`
╔══════════════════════════════════════════════════╗
║         Alpha Staging Seed Complete              ║
╠══════════════════════════════════════════════════╣
║  Seller ID: ${sellerId}  ║
║  Email:     alpha-seller@pixecom.io              ║
║  Password:  AlphaSeed2026!                       ║
╠══════════════════════════════════════════════════╣
║  Sellpages:       ${String(counts[0]).padEnd(4)} (2 published, 1 draft)    ║
║  Orders:          ${String(counts[1]).padEnd(4)} (30-day spread)           ║
║  Campaigns:       ${String(counts[2]).padEnd(4)}                           ║
║  Adsets:          ${String(counts[3]).padEnd(4)}                           ║
║  Ads:             ${String(counts[4]).padEnd(4)}                           ║
║  Ad Stats Rows:   ${String(counts[5]).padEnd(4)}                           ║
║  Sellpage Stats:  ${String(counts[6]).padEnd(4)}                           ║
╚══════════════════════════════════════════════════╝
`);
}

main()
  .catch((e) => {
    console.error('❌ Alpha staging seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
