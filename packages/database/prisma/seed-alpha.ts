/**
 * Alpha Test Seed — PixEcom v2
 *
 * Seeds realistic data for the Admin PixelXLab seller account:
 *   - 3 Sellpages (PUBLISHED, PUBLISHED, DRAFT)
 *   - 5 Orders with items + events (mix statuses, 7-day spread)
 *   - 1 FbConnection (AD_ACCOUNT)
 *   - 2 Campaigns (ACTIVE, PAUSED) with adsets, ads
 *   - AdStatsDaily (7 days of realistic metrics per entity)
 *
 * Looks up sellerId dynamically by querying admin@pixelxlab.com user.
 * Products are reused from the main seed (MOUSE-001, STAND-001, DESKPAD-001).
 *
 * Run: pnpm --filter @pixecom/database db:seed-alpha
 * Idempotent: safe to re-run (uses upsert with fixed UUIDs).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Fixed UUIDs (prefix 0A for alpha) ──────────────────────────────────
const ID = {
  // Sellpages
  SP1: '00000000-0000-0000-000a-000000000001',
  SP2: '00000000-0000-0000-000a-000000000002',
  SP3: '00000000-0000-0000-000a-000000000003',
  // Orders
  ORD1: '00000000-0000-0000-000a-000000000101',
  ORD2: '00000000-0000-0000-000a-000000000102',
  ORD3: '00000000-0000-0000-000a-000000000103',
  ORD4: '00000000-0000-0000-000a-000000000104',
  ORD5: '00000000-0000-0000-000a-000000000105',
  // OrderItems
  OI1: '00000000-0000-0000-000a-000000000201',
  OI2: '00000000-0000-0000-000a-000000000202',
  OI3: '00000000-0000-0000-000a-000000000203',
  OI4: '00000000-0000-0000-000a-000000000204',
  OI5: '00000000-0000-0000-000a-000000000205',
  OI6: '00000000-0000-0000-000a-000000000206',
  OI7: '00000000-0000-0000-000a-000000000207',
  OI8: '00000000-0000-0000-000a-000000000208',
  // FbConnection
  FB1: '00000000-0000-0000-000a-000000000301',
  // Campaigns
  CMP1: '00000000-0000-0000-000a-000000000401',
  CMP2: '00000000-0000-0000-000a-000000000402',
  // Adsets
  ADS1: '00000000-0000-0000-000a-000000000501',
  ADS2: '00000000-0000-0000-000a-000000000502',
  ADS3: '00000000-0000-0000-000a-000000000503',
  // Ads
  AD1: '00000000-0000-0000-000a-000000000601',
  AD2: '00000000-0000-0000-000a-000000000602',
  AD3: '00000000-0000-0000-000a-000000000603',
  AD4: '00000000-0000-0000-000a-000000000604',
} as const;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}

function dateOnly(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function main() {
  console.log('🔍 Looking up Admin PixelXLab seller...');

  // Find the seller by email
  const targetEmail = process.env.ALPHA_SEED_EMAIL || 'admin@pixecom.com';
  console.log(`  Using email: ${targetEmail}`);
  const adminUser = await prisma.user.findFirst({
    where: { email: targetEmail },
    include: {
      sellerUsers: { include: { seller: true } },
    },
  });

  if (!adminUser || adminUser.sellerUsers.length === 0) {
    console.error(`❌ User ${targetEmail} not found or has no seller. Register first or set ALPHA_SEED_EMAIL env var.`);
    process.exit(1);
  }

  // Prefer the dedicated alpha test seller if it exists (created by main seed)
  const ALPHA_SELLER_ID = '00000000-0000-0000-0000-000000009001';
  const preferredSellerUser =
    adminUser.sellerUsers.find((su) => su.sellerId === ALPHA_SELLER_ID) ??
    adminUser.sellerUsers[0];
  const sellerId = preferredSellerUser.sellerId;
  console.log(`✅ Found seller: ${preferredSellerUser.seller.name} (${sellerId})`);

  // Find products from main seed
  const product1 = await prisma.product.findUnique({ where: { productCode: 'MOUSE-001' } });
  const product2 = await prisma.product.findUnique({ where: { productCode: 'STAND-001' } });
  const product3 = await prisma.product.findUnique({ where: { productCode: 'DESKPAD-001' } });

  if (!product1 || !product2 || !product3) {
    console.error('❌ Products not found. Run main seed first: pnpm --filter @pixecom/database db:seed');
    process.exit(1);
  }

  // Get variants for order items
  const variants1 = await prisma.productVariant.findMany({ where: { productId: product1.id }, orderBy: { position: 'asc' } });
  const variants2 = await prisma.productVariant.findMany({ where: { productId: product2.id }, orderBy: { position: 'asc' } });
  const variants3 = await prisma.productVariant.findMany({ where: { productId: product3.id }, orderBy: { position: 'asc' } });

  console.log(`📦 Products: ${product1.name}, ${product2.name}, ${product3.name}`);

  // ═══════════════════════════════════════════════════════════════════════
  // A. SELLPAGES
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n📄 Seeding sellpages...');

  await prisma.sellpage.upsert({
    where: { id: ID.SP1 },
    update: {},
    create: {
      id: ID.SP1,
      sellerId,
      productId: product1.id,
      slug: 'alpha-mouse-deal',
      status: 'PUBLISHED',
      titleOverride: 'Flash Sale: SlimPro Mouse -25%',
      descriptionOverride: 'Grab the best wireless mouse at an incredible price.',
    },
  });

  await prisma.sellpage.upsert({
    where: { id: ID.SP2 },
    update: {},
    create: {
      id: ID.SP2,
      sellerId,
      productId: product2.id,
      slug: 'alpha-stand-offer',
      status: 'PUBLISHED',
      titleOverride: 'ProStand — Your Desk Upgrade',
      descriptionOverride: null,
    },
  });

  await prisma.sellpage.upsert({
    where: { id: ID.SP3 },
    update: {},
    create: {
      id: ID.SP3,
      sellerId,
      productId: product3.id,
      slug: 'alpha-deskpad-promo',
      status: 'DRAFT',
      titleOverride: null,
      descriptionOverride: null,
    },
  });

  console.log('   ✅ 3 sellpages (2 PUBLISHED, 1 DRAFT)');

  // ═══════════════════════════════════════════════════════════════════════
  // B. ORDERS (5 orders, spread over last 7 days)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n🛒 Seeding orders...');

  // Order 1: CONFIRMED, 2 items, 6 days ago — source: facebook (from CMP1 ad)
  await prisma.order.upsert({
    where: { id: ID.ORD1 },
    update: { source: 'facebook', utmSource: 'facebook', utmMedium: 'paid', utmCampaign: `c_${ID.CMP1}` },
    create: {
      id: ID.ORD1,
      sellerId,
      sellpageId: ID.SP1,
      orderNumber: 'ALPHA-001',
      customerEmail: 'alice.nguyen@gmail.com',
      customerName: 'Alice Nguyen',
      customerPhone: '+84901234567',
      shippingAddress: { street: '123 Nguyen Hue', city: 'HCMC', country: 'VN', zip: '70000' },
      subtotal: 62.98,
      shippingCost: 5.00,
      taxAmount: 3.00,
      discountAmount: 0,
      total: 70.98,
      currency: 'USD',
      status: 'CONFIRMED',
      source: 'facebook',
      utmSource: 'facebook',
      utmMedium: 'paid',
      utmCampaign: `c_${ID.CMP1}`,
      createdAt: daysAgo(6),
    },
  });
  await prisma.orderItem.upsert({ where: { id: ID.OI1 }, update: {}, create: { id: ID.OI1, orderId: ID.ORD1, productId: product1.id, variantId: variants1[0]?.id, productName: product1.name, variantName: 'Black', sku: 'MOUSE-001-BLK', quantity: 1, unitPrice: 29.99, lineTotal: 29.99 } });
  await prisma.orderItem.upsert({ where: { id: ID.OI2 }, update: {}, create: { id: ID.OI2, orderId: ID.ORD1, productId: product1.id, variantId: variants1[2]?.id, productName: product1.name, variantName: 'Rose Gold', sku: 'MOUSE-001-RGD', quantity: 1, unitPrice: 32.99, lineTotal: 32.99 } });
  await prisma.orderEvent.upsert({ where: { id: '00000000-0000-0000-000a-0000000e0101' }, update: {}, create: { id: '00000000-0000-0000-000a-0000000e0101', orderId: ID.ORD1, sellerId, eventType: 'CREATED', description: 'Order placed via sellpage', createdAt: daysAgo(6) } });
  await prisma.orderEvent.upsert({ where: { id: '00000000-0000-0000-000a-0000000e0102' }, update: {}, create: { id: '00000000-0000-0000-000a-0000000e0102', orderId: ID.ORD1, sellerId, eventType: 'CONFIRMED', description: 'Payment confirmed', createdAt: daysAgo(5) } });

  // Order 2: SHIPPED, 1 item, 4 days ago — source: tiktok
  await prisma.order.upsert({
    where: { id: ID.ORD2 },
    update: { source: 'tiktok', utmSource: 'tiktok', utmMedium: 'paid' },
    create: {
      id: ID.ORD2,
      sellerId,
      sellpageId: ID.SP2,
      orderNumber: 'ALPHA-002',
      customerEmail: 'bob.tran@outlook.com',
      customerName: 'Bob Tran',
      customerPhone: '+84909876543',
      shippingAddress: { street: '45 Le Loi', city: 'Da Nang', country: 'VN', zip: '50000' },
      subtotal: 34.99,
      shippingCost: 5.00,
      taxAmount: 2.00,
      discountAmount: 0,
      total: 41.99,
      currency: 'USD',
      status: 'SHIPPED',
      trackingNumber: 'VN2026022001234',
      trackingUrl: 'https://tracking.example.com/VN2026022001234',
      source: 'tiktok',
      utmSource: 'tiktok',
      utmMedium: 'paid',
      createdAt: daysAgo(4),
    },
  });
  await prisma.orderItem.upsert({ where: { id: ID.OI3 }, update: {}, create: { id: ID.OI3, orderId: ID.ORD2, productId: product2.id, variantId: variants2[0]?.id, productName: product2.name, variantName: 'Silver', sku: 'STAND-001-SLV', quantity: 1, unitPrice: 34.99, lineTotal: 34.99 } });
  await prisma.orderEvent.upsert({ where: { id: '00000000-0000-0000-000a-0000000e0201' }, update: {}, create: { id: '00000000-0000-0000-000a-0000000e0201', orderId: ID.ORD2, sellerId, eventType: 'CREATED', description: 'Order placed', createdAt: daysAgo(4) } });
  await prisma.orderEvent.upsert({ where: { id: '00000000-0000-0000-000a-0000000e0202' }, update: {}, create: { id: '00000000-0000-0000-000a-0000000e0202', orderId: ID.ORD2, sellerId, eventType: 'CONFIRMED', description: 'Payment confirmed', createdAt: daysAgo(4) } });
  await prisma.orderEvent.upsert({ where: { id: '00000000-0000-0000-000a-0000000e0203' }, update: {}, create: { id: '00000000-0000-0000-000a-0000000e0203', orderId: ID.ORD2, sellerId, eventType: 'SHIPPED', description: 'Shipped via GHTK - VN2026022001234', createdAt: daysAgo(2) } });

  // Order 3: DELIVERED, 3 items, 5 days ago — source: facebook (from CMP1 ad)
  await prisma.order.upsert({
    where: { id: ID.ORD3 },
    update: { source: 'facebook', utmSource: 'facebook', utmMedium: 'paid', utmCampaign: `c_${ID.CMP1}` },
    create: {
      id: ID.ORD3,
      sellerId,
      sellpageId: ID.SP1,
      orderNumber: 'ALPHA-003',
      customerEmail: 'charlie.le@yahoo.com',
      customerName: 'Charlie Le',
      customerPhone: null,
      shippingAddress: { street: '789 Tran Hung Dao', city: 'Ha Noi', country: 'VN', zip: '10000' },
      subtotal: 89.97,
      shippingCost: 0,
      taxAmount: 4.50,
      discountAmount: 5.00,
      total: 89.47,
      currency: 'USD',
      status: 'DELIVERED',
      source: 'facebook',
      utmSource: 'facebook',
      utmMedium: 'paid',
      utmCampaign: `c_${ID.CMP1}`,
      createdAt: daysAgo(5),
    },
  });
  await prisma.orderItem.upsert({ where: { id: ID.OI4 }, update: {}, create: { id: ID.OI4, orderId: ID.ORD3, productId: product1.id, variantId: variants1[1]?.id, productName: product1.name, variantName: 'White', sku: 'MOUSE-001-WHT', quantity: 2, unitPrice: 29.99, lineTotal: 59.98 } });
  await prisma.orderItem.upsert({ where: { id: ID.OI5 }, update: {}, create: { id: ID.OI5, orderId: ID.ORD3, productId: product1.id, variantId: variants1[0]?.id, productName: product1.name, variantName: 'Black', sku: 'MOUSE-001-BLK', quantity: 1, unitPrice: 29.99, lineTotal: 29.99 } });
  await prisma.orderEvent.upsert({ where: { id: '00000000-0000-0000-000a-0000000e0301' }, update: {}, create: { id: '00000000-0000-0000-000a-0000000e0301', orderId: ID.ORD3, sellerId, eventType: 'CREATED', createdAt: daysAgo(5) } });
  await prisma.orderEvent.upsert({ where: { id: '00000000-0000-0000-000a-0000000e0302' }, update: {}, create: { id: '00000000-0000-0000-000a-0000000e0302', orderId: ID.ORD3, sellerId, eventType: 'CONFIRMED', createdAt: daysAgo(5) } });
  await prisma.orderEvent.upsert({ where: { id: '00000000-0000-0000-000a-0000000e0303' }, update: {}, create: { id: '00000000-0000-0000-000a-0000000e0303', orderId: ID.ORD3, sellerId, eventType: 'SHIPPED', createdAt: daysAgo(3) } });
  await prisma.orderEvent.upsert({ where: { id: '00000000-0000-0000-000a-0000000e0304' }, update: {}, create: { id: '00000000-0000-0000-000a-0000000e0304', orderId: ID.ORD3, sellerId, eventType: 'DELIVERED', description: 'Customer received', createdAt: daysAgo(1) } });

  // Order 4: PENDING, 1 item, today — source: direct
  await prisma.order.upsert({
    where: { id: ID.ORD4 },
    update: { source: 'direct' },
    create: {
      id: ID.ORD4,
      sellerId,
      sellpageId: ID.SP1,
      orderNumber: 'ALPHA-004',
      customerEmail: 'diana.pham@gmail.com',
      customerName: 'Diana Pham',
      customerPhone: '+84912345678',
      shippingAddress: { street: '56 Hai Ba Trung', city: 'HCMC', country: 'VN', zip: '70000' },
      subtotal: 29.99,
      shippingCost: 5.00,
      taxAmount: 1.75,
      discountAmount: 0,
      total: 36.74,
      currency: 'USD',
      status: 'PENDING',
      source: 'direct',
      createdAt: daysAgo(0),
    },
  });
  await prisma.orderItem.upsert({ where: { id: ID.OI6 }, update: {}, create: { id: ID.OI6, orderId: ID.ORD4, productId: product1.id, variantId: variants1[0]?.id, productName: product1.name, variantName: 'Black', sku: 'MOUSE-001-BLK', quantity: 1, unitPrice: 29.99, lineTotal: 29.99 } });
  await prisma.orderEvent.upsert({ where: { id: '00000000-0000-0000-000a-0000000e0401' }, update: {}, create: { id: '00000000-0000-0000-000a-0000000e0401', orderId: ID.ORD4, sellerId, eventType: 'CREATED', description: 'Order placed, awaiting payment', createdAt: daysAgo(0) } });

  // Order 5: CANCELLED, 1 item, 3 days ago — source: direct
  await prisma.order.upsert({
    where: { id: ID.ORD5 },
    update: { source: 'direct' },
    create: {
      id: ID.ORD5,
      sellerId,
      sellpageId: ID.SP3,
      orderNumber: 'ALPHA-005',
      customerEmail: 'ethan.vo@hotmail.com',
      customerName: 'Ethan Vo',
      customerPhone: null,
      shippingAddress: { street: '12 Pham Van Dong', city: 'HCMC', country: 'VN', zip: '70000' },
      subtotal: 24.99,
      shippingCost: 5.00,
      taxAmount: 1.50,
      discountAmount: 0,
      total: 31.49,
      currency: 'USD',
      status: 'CANCELLED',
      source: 'direct',
      createdAt: daysAgo(3),
    },
  });
  await prisma.orderItem.upsert({ where: { id: ID.OI7 }, update: {}, create: { id: ID.OI7, orderId: ID.ORD5, productId: product3.id, variantId: variants3[0]?.id, productName: product3.name, variantName: 'Black / XL', sku: 'DESKPAD-001-BLK-XL', quantity: 1, unitPrice: 24.99, lineTotal: 24.99 } });
  await prisma.orderEvent.upsert({ where: { id: '00000000-0000-0000-000a-0000000e0501' }, update: {}, create: { id: '00000000-0000-0000-000a-0000000e0501', orderId: ID.ORD5, sellerId, eventType: 'CREATED', createdAt: daysAgo(3) } });
  await prisma.orderEvent.upsert({ where: { id: '00000000-0000-0000-000a-0000000e0502' }, update: {}, create: { id: '00000000-0000-0000-000a-0000000e0502', orderId: ID.ORD5, sellerId, eventType: 'CANCELLED', description: 'Customer requested cancellation', createdAt: daysAgo(2) } });

  console.log('   ✅ 5 orders (CONFIRMED/facebook, SHIPPED/tiktok, DELIVERED/facebook, PENDING/direct, CANCELLED/direct)');

  // ═══════════════════════════════════════════════════════════════════════
  // B.2 ORDER PAYMENT ENRICHMENT
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n💳 Enriching orders with payment data...');

  await prisma.order.update({
    where: { id: ID.ORD1 },
    data: {
      paymentMethod: 'STRIPE',
      paymentId: 'pi_3PxTest12345678',
      transactionId: 'txn_alpha_001_stripe',
      paidAt: new Date('2026-02-15T10:30:00Z'),
    },
  });

  await prisma.order.update({
    where: { id: ID.ORD3 },
    data: {
      paymentMethod: 'COD',
      paymentId: null,
      transactionId: 'txn_alpha_003_cod',
      paidAt: new Date('2026-02-12T14:00:00Z'),
    },
  });

  console.log('   ✅ ALPHA-001 → STRIPE (pi_3PxTest12345678) | ALPHA-003 → COD (txn_alpha_003_cod)');

  // ═══════════════════════════════════════════════════════════════════════
  // C. FB CONNECTION (AD_ACCOUNT — required for campaigns)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n🔗 Seeding FB connection...');

  await prisma.fbConnection.upsert({
    where: { id: ID.FB1 },
    update: {},
    create: {
      id: ID.FB1,
      sellerId,
      connectionType: 'AD_ACCOUNT',
      externalId: 'act_alpha_test_001',
      name: 'Alpha Test Ad Account',
      accessTokenEnc: null,
      isPrimary: true,
      isActive: true,
    },
  });

  console.log('   ✅ 1 AD_ACCOUNT connection');

  // ═══════════════════════════════════════════════════════════════════════
  // C.2 FB CONNECTION ENRICHMENT (mock token + PAGE + PIXEL)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n🔗 Enriching FB connections...');

  // Update AD_ACCOUNT with mock encrypted token
  await prisma.fbConnection.update({
    where: { id: ID.FB1 },
    data: {
      accessTokenEnc: 'MOCK_ENC_TOKEN_FOR_ALPHA_TEST_DO_NOT_USE_IN_PRODUCTION',
      isPrimary: true,
    },
  });

  // PAGE connection
  await prisma.fbConnection.upsert({
    where: { id: '00000000-0000-0000-000a-000000000302' },
    update: {},
    create: {
      id: '00000000-0000-0000-000a-000000000302',
      sellerId,
      connectionType: 'PAGE',
      externalId: 'page_123456789',
      name: 'Alpha Test Page',
      accessTokenEnc: 'MOCK_PAGE_TOKEN',
      isActive: true,
      metadata: { pageCategory: 'E-commerce', followers: 5000 },
    },
  });

  // PIXEL connection (child of AD_ACCOUNT)
  await prisma.fbConnection.upsert({
    where: { id: '00000000-0000-0000-000a-000000000303' },
    update: {},
    create: {
      id: '00000000-0000-0000-000a-000000000303',
      sellerId,
      connectionType: 'PIXEL',
      externalId: 'pixel_987654321',
      name: 'Alpha Test Pixel',
      parentId: '00000000-0000-0000-000a-000000000301',
      isActive: true,
      metadata: { pixelCode: 'fbq("init", "987654321")' },
    },
  });

  console.log('   ✅ AD_ACCOUNT mock token set | PAGE (page_123456789) + PIXEL (pixel_987654321) added');

  // ═══════════════════════════════════════════════════════════════════════
  // D. CAMPAIGNS
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n📢 Seeding campaigns...');

  await prisma.campaign.upsert({
    where: { id: ID.CMP1 },
    update: {},
    create: {
      id: ID.CMP1,
      sellerId,
      sellpageId: ID.SP1,
      adAccountId: ID.FB1,
      name: 'Mouse Flash Sale',
      budget: 50.00,
      budgetType: 'DAILY',
      status: 'ACTIVE',
      deliveryStatus: 'active',
      externalCampaignId: 'ext_cmp_alpha_001',
      startDate: daysAgo(7),
      createdAt: daysAgo(7),
    },
  });

  await prisma.campaign.upsert({
    where: { id: ID.CMP2 },
    update: {},
    create: {
      id: ID.CMP2,
      sellerId,
      sellpageId: ID.SP2,
      adAccountId: ID.FB1,
      name: 'Stand Awareness',
      budget: 30.00,
      budgetType: 'DAILY',
      status: 'PAUSED',
      deliveryStatus: 'paused',
      externalCampaignId: 'ext_cmp_alpha_002',
      startDate: daysAgo(7),
      createdAt: daysAgo(7),
    },
  });

  console.log('   ✅ 2 campaigns (ACTIVE, PAUSED)');

  // ═══════════════════════════════════════════════════════════════════════
  // E. ADSETS
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n🎯 Seeding adsets...');

  await prisma.adset.upsert({
    where: { id: ID.ADS1 },
    update: {},
    create: {
      id: ID.ADS1,
      campaignId: ID.CMP1,
      sellerId,
      name: 'Interest — Tech Buyers',
      status: 'ACTIVE',
      deliveryStatus: 'active',
      optimizationGoal: 'CONVERSIONS',
      targeting: { interests: ['technology', 'gadgets'], age_min: 25, age_max: 45 },
      externalAdsetId: 'ext_adset_alpha_001',
    },
  });

  await prisma.adset.upsert({
    where: { id: ID.ADS2 },
    update: {},
    create: {
      id: ID.ADS2,
      campaignId: ID.CMP1,
      sellerId,
      name: 'Lookalike — Past Buyers',
      status: 'ACTIVE',
      deliveryStatus: 'active',
      optimizationGoal: 'CONVERSIONS',
      targeting: { lookalike: 'past_purchasers_1pct' },
      externalAdsetId: 'ext_adset_alpha_002',
    },
  });

  await prisma.adset.upsert({
    where: { id: ID.ADS3 },
    update: {},
    create: {
      id: ID.ADS3,
      campaignId: ID.CMP2,
      sellerId,
      name: 'Broad — Office Workers',
      status: 'PAUSED',
      deliveryStatus: 'paused',
      optimizationGoal: 'LINK_CLICKS',
      targeting: { interests: ['home-office', 'remote-work'], age_min: 22, age_max: 55 },
      externalAdsetId: 'ext_adset_alpha_003',
    },
  });

  console.log('   ✅ 3 adsets');

  // ═══════════════════════════════════════════════════════════════════════
  // F. ADS
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n🖼️  Seeding ads...');

  await prisma.ad.upsert({ where: { id: ID.AD1 }, update: {}, create: { id: ID.AD1, adsetId: ID.ADS1, sellerId, name: 'Mouse Video Ad — V1', status: 'ACTIVE', deliveryStatus: 'active', externalAdId: 'ext_ad_alpha_001' } });
  await prisma.ad.upsert({ where: { id: ID.AD2 }, update: {}, create: { id: ID.AD2, adsetId: ID.ADS1, sellerId, name: 'Mouse Carousel Ad', status: 'ACTIVE', deliveryStatus: 'active', externalAdId: 'ext_ad_alpha_002' } });
  await prisma.ad.upsert({ where: { id: ID.AD3 }, update: {}, create: { id: ID.AD3, adsetId: ID.ADS2, sellerId, name: 'Mouse UGC Ad', status: 'ACTIVE', deliveryStatus: 'active', externalAdId: 'ext_ad_alpha_003' } });
  await prisma.ad.upsert({ where: { id: ID.AD4 }, update: {}, create: { id: ID.AD4, adsetId: ID.ADS3, sellerId, name: 'Stand Image Ad', status: 'PAUSED', deliveryStatus: 'paused', externalAdId: 'ext_ad_alpha_004' } });

  console.log('   ✅ 4 ads');

  // ═══════════════════════════════════════════════════════════════════════
  // G. AD STATS DAILY (7 days, realistic metrics)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n📊 Seeding ad stats (7 days)...');

  const entities = [
    { type: 'CAMPAIGN' as const, id: ID.CMP1, spendBase: 45, impBase: 5500, clickBase: 220, cvBase: 150, coBase: 25, purchBase: 10, pvBase: 350 },
    { type: 'CAMPAIGN' as const, id: ID.CMP2, spendBase: 25, impBase: 3000, clickBase: 120, cvBase: 80, coBase: 12, purchBase: 4, pvBase: 130 },
    { type: 'ADSET' as const, id: ID.ADS1, spendBase: 28, impBase: 3500, clickBase: 140, cvBase: 95, coBase: 16, purchBase: 6, pvBase: 210 },
    { type: 'ADSET' as const, id: ID.ADS2, spendBase: 17, impBase: 2000, clickBase: 80, cvBase: 55, coBase: 9, purchBase: 4, pvBase: 140 },
    { type: 'ADSET' as const, id: ID.ADS3, spendBase: 25, impBase: 3000, clickBase: 120, cvBase: 80, coBase: 12, purchBase: 4, pvBase: 130 },
    { type: 'AD' as const, id: ID.AD1, spendBase: 16, impBase: 2000, clickBase: 80, cvBase: 55, coBase: 10, purchBase: 4, pvBase: 130 },
    { type: 'AD' as const, id: ID.AD2, spendBase: 12, impBase: 1500, clickBase: 60, cvBase: 40, coBase: 6, purchBase: 2, pvBase: 80 },
    { type: 'AD' as const, id: ID.AD3, spendBase: 17, impBase: 2000, clickBase: 80, cvBase: 55, coBase: 9, purchBase: 4, pvBase: 140 },
    { type: 'AD' as const, id: ID.AD4, spendBase: 25, impBase: 3000, clickBase: 120, cvBase: 80, coBase: 12, purchBase: 4, pvBase: 130 },
  ];

  let statsCount = 0;
  for (const e of entities) {
    for (let day = 0; day < 7; day++) {
      // Add slight daily variance (±20%)
      const v = () => 0.8 + Math.random() * 0.4;
      const spend = +(e.spendBase * v()).toFixed(2);
      const impressions = Math.round(e.impBase * v());
      const linkClicks = Math.round(e.clickBase * v());
      const contentViews = Math.round(e.cvBase * v());
      const checkoutInitiated = Math.round(e.coBase * v());
      const purchases = Math.round(e.purchBase * v());
      const purchaseValue = +(e.pvBase * v()).toFixed(2);

      const ctr = impressions > 0 ? +((linkClicks / impressions) * 100).toFixed(2) : 0;
      const cpc = linkClicks > 0 ? +(spend / linkClicks).toFixed(2) : 0;
      const cpm = impressions > 0 ? +((spend / impressions) * 1000).toFixed(2) : 0;
      const costPerPurchase = purchases > 0 ? +(spend / purchases).toFixed(2) : 0;
      const roas = spend > 0 ? +(purchaseValue / spend).toFixed(2) : 0;

      const statDate = dateOnly(day);
      const statsId = `00000000-0000-0000-000a-00s${e.type[0]}${e.id.slice(-2)}d${day}`;

      await prisma.adStatsDaily.upsert({
        where: {
          uq_ad_stats_daily: {
            sellerId,
            entityType: e.type,
            entityId: e.id,
            statDate,
          },
        },
        update: {
          spend, impressions, linkClicks, contentViews, checkoutInitiated,
          purchases, purchaseValue, ctr, cpc, cpm, costPerPurchase, roas,
        },
        create: {
          sellerId,
          entityType: e.type,
          entityId: e.id,
          statDate,
          spend,
          impressions,
          linkClicks,
          contentViews,
          checkoutInitiated,
          purchases,
          purchaseValue,
          ctr,
          cpc,
          cpm,
          costPerPurchase,
          roas,
        },
      });
      statsCount++;
    }
  }

  console.log(`   ✅ ${statsCount} ad stats rows (9 entities × 7 days)`);

  // ═══════════════════════════════════════════════════════════════════════
  // H. ASSETS — Products 2 & 3
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n🖼️  Seeding assets for Products 2 & 3...');

  // ── Product 2 (STAND-001) assets ──────────────────────────────────────

  const assetStandImage = await prisma.asset.upsert({
    where: { id: '00000000-0000-0000-000a-000000000601' },
    update: {},
    create: {
      id: '00000000-0000-0000-000a-000000000601',
      ownerSellerId: null, // platform asset — visible to all sellers
      sourceType: 'PIXCON',
      mediaType: 'IMAGE',
      url: 'https://cdn.pixelxlab.com/assets/alpha/stand-hero.jpg',
      mimeType: 'image/jpeg',
      fileSizeBytes: BigInt(245000),
      width: 1200,
      height: 800,
      metadata: { alt: 'Adjustable Laptop Stand' },
    },
  });

  const assetStandVideo = await prisma.asset.upsert({
    where: { id: '00000000-0000-0000-000a-000000000602' },
    update: {},
    create: {
      id: '00000000-0000-0000-000a-000000000602',
      ownerSellerId: null,
      sourceType: 'PIXCON',
      mediaType: 'VIDEO',
      url: 'https://cdn.pixelxlab.com/assets/alpha/stand-demo.mp4',
      mimeType: 'video/mp4',
      fileSizeBytes: BigInt(8500000),
      durationSec: 30,
      width: 1920,
      height: 1080,
      metadata: { alt: 'Stand Demo Video' },
    },
  });

  const assetStandAdtext = await prisma.asset.upsert({
    where: { id: '00000000-0000-0000-000a-000000000603' },
    update: {},
    create: {
      id: '00000000-0000-0000-000a-000000000603',
      ownerSellerId: sellerId, // seller-authored copy
      sourceType: 'USER_UPLOAD',
      mediaType: 'TEXT',
      url: '',
      metadata: {
        primaryText: 'Nâng cao tư thế làm việc với Stand Pro - giá chỉ từ 299K!',
        headline: 'Laptop Stand Pro - Giảm 40%',
        description: 'Chất liệu nhôm cao cấp, điều chỉnh 6 góc, gấp gọn dễ dàng.',
      },
    },
  });

  // ── Product 3 (DESKPAD-001) assets ────────────────────────────────────

  const assetDeskpadImage = await prisma.asset.upsert({
    where: { id: '00000000-0000-0000-000a-000000000604' },
    update: {},
    create: {
      id: '00000000-0000-0000-000a-000000000604',
      ownerSellerId: null,
      sourceType: 'PIXCON',
      mediaType: 'IMAGE',
      url: 'https://cdn.pixelxlab.com/assets/alpha/deskpad-hero.jpg',
      mimeType: 'image/jpeg',
      fileSizeBytes: BigInt(310000),
      width: 1200,
      height: 800,
      metadata: { alt: 'Premium Desk Pad' },
    },
  });

  const assetDeskpadAdtext = await prisma.asset.upsert({
    where: { id: '00000000-0000-0000-000a-000000000605' },
    update: {},
    create: {
      id: '00000000-0000-0000-000a-000000000605',
      ownerSellerId: sellerId,
      sourceType: 'USER_UPLOAD',
      mediaType: 'TEXT',
      url: '',
      metadata: {
        primaryText: 'Desk Pad size lớn, da PU chống nước - setup bàn đẹp ngay hôm nay!',
        headline: 'Desk Pad Premium - Free Ship',
        description: 'Kích thước 90x40cm, da PU cao cấp, mặt sau chống trượt.',
      },
    },
  });

  console.log('   ✅ 5 assets (3 PIXCON platform + 2 USER_UPLOAD seller)');

  // ═══════════════════════════════════════════════════════════════════════
  // I. CREATIVES — Products 2 & 3
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n🎨 Seeding creatives for Products 2 & 3...');

  // Creative for Product 2 — READY (VIDEO_AD, 3 slots)
  await prisma.creative.upsert({
    where: { id: '00000000-0000-0000-000a-000000000701' },
    update: {},
    create: {
      id: '00000000-0000-0000-000a-000000000701',
      sellerId,
      name: 'Stand Pro - Video Ad v1',
      creativeType: 'VIDEO_AD',
      productId: product2.id,
      status: 'READY',
    },
  });

  // CreativeAsset slots — deleteMany + create for idempotency
  // (CreativeAsset has no Prisma @@unique; uniqueness is a conditional SQL index)
  await prisma.creativeAsset.deleteMany({ where: { creativeId: '00000000-0000-0000-000a-000000000701', role: 'PRIMARY_VIDEO' } });
  await prisma.creativeAsset.create({ data: { creativeId: '00000000-0000-0000-000a-000000000701', assetId: assetStandVideo.id, role: 'PRIMARY_VIDEO' } });

  await prisma.creativeAsset.deleteMany({ where: { creativeId: '00000000-0000-0000-000a-000000000701', role: 'THUMBNAIL' } });
  await prisma.creativeAsset.create({ data: { creativeId: '00000000-0000-0000-000a-000000000701', assetId: assetStandImage.id, role: 'THUMBNAIL' } });

  await prisma.creativeAsset.deleteMany({ where: { creativeId: '00000000-0000-0000-000a-000000000701', role: 'PRIMARY_TEXT' } });
  await prisma.creativeAsset.create({ data: { creativeId: '00000000-0000-0000-000a-000000000701', assetId: assetStandAdtext.id, role: 'PRIMARY_TEXT' } });

  // Creative for Product 3 — DRAFT (IMAGE_AD, 2 slots)
  await prisma.creative.upsert({
    where: { id: '00000000-0000-0000-000a-000000000702' },
    update: {},
    create: {
      id: '00000000-0000-0000-000a-000000000702',
      sellerId,
      name: 'Desk Pad - Image Ad v1',
      creativeType: 'IMAGE_AD',
      productId: product3.id,
      status: 'DRAFT',
    },
  });

  await prisma.creativeAsset.deleteMany({ where: { creativeId: '00000000-0000-0000-000a-000000000702', role: 'THUMBNAIL' } });
  await prisma.creativeAsset.create({ data: { creativeId: '00000000-0000-0000-000a-000000000702', assetId: assetDeskpadImage.id, role: 'THUMBNAIL' } });

  await prisma.creativeAsset.deleteMany({ where: { creativeId: '00000000-0000-0000-000a-000000000702', role: 'PRIMARY_TEXT' } });
  await prisma.creativeAsset.create({ data: { creativeId: '00000000-0000-0000-000a-000000000702', assetId: assetDeskpadAdtext.id, role: 'PRIMARY_TEXT' } });

  console.log('   ✅ 2 creatives (Stand Pro READY/3-slots, Desk Pad DRAFT/2-slots)');

  // ═══════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════
  const sp = await prisma.sellpage.count({ where: { sellerId } });
  const ord = await prisma.order.count({ where: { sellerId } });
  const fb = await prisma.fbConnection.count({ where: { sellerId } });
  const cmp = await prisma.campaign.count({ where: { sellerId } });
  const ads = await prisma.adset.count({ where: { sellerId } });
  const ad = await prisma.ad.count({ where: { sellerId } });
  const st = await prisma.adStatsDaily.count({ where: { sellerId } });
  const crt = await prisma.creative.count({ where: { sellerId } });

  console.log(`\n🎉 Alpha seed complete for seller: ${sellerId}`);
  console.log(`   Sellpages: ${sp} | Orders: ${ord} | FB connections: ${fb}`);
  console.log(`   Campaigns: ${cmp} | Adsets: ${ads} | Ads: ${ad} | Stats: ${st}`);
  console.log(`   Creatives: ${crt}`);
}

main()
  .catch((e) => {
    console.error('❌ Alpha seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
