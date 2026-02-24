/**
 * Admin Portal Seed — PixEcom v2 (Phase D)
 *
 * Seeds data needed for the admin portal pages:
 *   - PlatformSettings (1 row)
 *   - PaymentGateways (4: Stripe Main, Stripe Test, PayPal Business, PayPal Sandbox)
 *   - 4 new Sellers (ACTIVE×2, PENDING, DEACTIVATED) with Users/SellerUsers/SellerSettings
 *   - 6 SellerDomains (across sellers)
 *   - 8 Sellpages (linked to products)
 *   - 12 Orders with OrderItems + OrderEvents (varied statuses, 7-day spread)
 *   - 4 Discounts (ACTIVE/EXPIRED/DISABLED)
 *   - 4 Admin Users (SUPERADMIN + SUPPORT + FINANCE + CONTENT)
 *   - SellpageStatsDaily (7 days × 6 sellpages)
 *
 * Prerequisites: Run main seed first (seed.ts → products) + seed-alpha.ts (alpha seller data)
 * Run: pnpm --filter @pixecom/database seed:admin
 * Idempotent: safe to re-run (uses upsert with fixed UUIDs).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Fixed UUIDs (prefix 0B for admin-portal seed) ──────────────────────────
const ID = {
  // PaymentGateways
  GW1: '00000000-0000-0000-000b-000000000001',
  GW2: '00000000-0000-0000-000b-000000000002',
  GW3: '00000000-0000-0000-000b-000000000003',
  GW4: '00000000-0000-0000-000b-000000000004',
  // Sellers
  S1: '00000000-0000-0000-000b-000000000101',
  S2: '00000000-0000-0000-000b-000000000102',
  S3: '00000000-0000-0000-000b-000000000103',
  S4: '00000000-0000-0000-000b-000000000104',
  // Users (seller owners)
  U1: '00000000-0000-0000-000b-000000000201',
  U2: '00000000-0000-0000-000b-000000000202',
  U3: '00000000-0000-0000-000b-000000000203',
  U4: '00000000-0000-0000-000b-000000000204',
  // Admin staff users
  UA1: '00000000-0000-0000-000b-000000000211',
  UA2: '00000000-0000-0000-000b-000000000212',
  UA3: '00000000-0000-0000-000b-000000000213',
  UA4: '00000000-0000-0000-000b-000000000214',
  // Domains
  D1: '00000000-0000-0000-000b-000000000301',
  D2: '00000000-0000-0000-000b-000000000302',
  D3: '00000000-0000-0000-000b-000000000303',
  D4: '00000000-0000-0000-000b-000000000304',
  D5: '00000000-0000-0000-000b-000000000305',
  D6: '00000000-0000-0000-000b-000000000306',
  // Sellpages
  SP1: '00000000-0000-0000-000b-000000000401',
  SP2: '00000000-0000-0000-000b-000000000402',
  SP3: '00000000-0000-0000-000b-000000000403',
  SP4: '00000000-0000-0000-000b-000000000404',
  SP5: '00000000-0000-0000-000b-000000000405',
  SP6: '00000000-0000-0000-000b-000000000406',
  SP7: '00000000-0000-0000-000b-000000000407',
  SP8: '00000000-0000-0000-000b-000000000408',
  // Orders
  O1: '00000000-0000-0000-000b-000000000501',
  O2: '00000000-0000-0000-000b-000000000502',
  O3: '00000000-0000-0000-000b-000000000503',
  O4: '00000000-0000-0000-000b-000000000504',
  O5: '00000000-0000-0000-000b-000000000505',
  O6: '00000000-0000-0000-000b-000000000506',
  O7: '00000000-0000-0000-000b-000000000507',
  O8: '00000000-0000-0000-000b-000000000508',
  O9: '00000000-0000-0000-000b-000000000509',
  O10: '00000000-0000-0000-000b-000000000510',
  O11: '00000000-0000-0000-000b-000000000511',
  O12: '00000000-0000-0000-000b-000000000512',
  // OrderItems
  OI1: '00000000-0000-0000-000b-000000000601',
  OI2: '00000000-0000-0000-000b-000000000602',
  OI3: '00000000-0000-0000-000b-000000000603',
  OI4: '00000000-0000-0000-000b-000000000604',
  OI5: '00000000-0000-0000-000b-000000000605',
  OI6: '00000000-0000-0000-000b-000000000606',
  OI7: '00000000-0000-0000-000b-000000000607',
  OI8: '00000000-0000-0000-000b-000000000608',
  OI9: '00000000-0000-0000-000b-000000000609',
  OI10: '00000000-0000-0000-000b-000000000610',
  OI11: '00000000-0000-0000-000b-000000000611',
  OI12: '00000000-0000-0000-000b-000000000612',
  OI13: '00000000-0000-0000-000b-000000000613',
  OI14: '00000000-0000-0000-000b-000000000614',
  // Discounts
  DC1: '00000000-0000-0000-000b-000000000701',
  DC2: '00000000-0000-0000-000b-000000000702',
  DC3: '00000000-0000-0000-000b-000000000703',
  DC4: '00000000-0000-0000-000b-000000000704',
  // PlatformSettings
  PS1: '00000000-0000-0000-000b-000000000801',
} as const;

// bcrypt hash of "Password123!" at cost 10 — pre-computed for idempotency
const DEFAULT_HASH = '$2b$10$cUujddZFj9TelHT.IQTGgeHpZx.Tp59yCx0dR82aADolWZz4gq6n.';

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
  console.log('🔧 Admin Portal Seed — starting...\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. PLATFORM SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('⚙️  Seeding platform settings...');
  await prisma.platformSettings.upsert({
    where: { id: ID.PS1 },
    update: {},
    create: {
      id: ID.PS1,
      platformName: 'PixEcom',
      defaultCurrency: 'USD',
      defaultTimezone: 'Asia/Ho_Chi_Minh',
      defaultLanguage: 'en',
      supportEmail: 'support@pixelxlab.com',
      logoUrl: 'https://cdn.pixelxlab.com/logo.png',
      smtpConfig: {
        host: 'smtp.sendgrid.net',
        port: 587,
        user: 'apikey',
        from: 'noreply@pixelxlab.com',
      },
      smsConfig: {},
      legalPages: {
        termsOfService: 'https://pixelxlab.com/terms',
        privacyPolicy: 'https://pixelxlab.com/privacy',
        refundPolicy: 'https://pixelxlab.com/refunds',
      },
      billingConfig: {
        platformFeePercent: 3,
        paymentProcessingFee: 2.9,
        paymentFixedFee: 0.30,
      },
    },
  });
  console.log('   ✅ PlatformSettings created');

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. PAYMENT GATEWAYS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n💳 Seeding payment gateways...');

  await prisma.paymentGateway.upsert({
    where: { id: ID.GW1 },
    update: {},
    create: {
      id: ID.GW1,
      name: 'Stripe Main',
      type: 'stripe',
      status: 'ACTIVE',
      environment: 'live',
      credentials: { publishableKey: 'pk_live_xxx', secretKey: 'sk_live_xxx' },
    },
  });

  await prisma.paymentGateway.upsert({
    where: { id: ID.GW2 },
    update: {},
    create: {
      id: ID.GW2,
      name: 'Stripe Test',
      type: 'stripe',
      status: 'ACTIVE',
      environment: 'sandbox',
      credentials: { publishableKey: 'pk_test_xxx', secretKey: 'sk_test_xxx' },
    },
  });

  await prisma.paymentGateway.upsert({
    where: { id: ID.GW3 },
    update: {},
    create: {
      id: ID.GW3,
      name: 'PayPal Business',
      type: 'paypal',
      status: 'ACTIVE',
      environment: 'live',
      credentials: { clientId: 'paypal_live_xxx', clientSecret: 'paypal_secret_xxx' },
    },
  });

  await prisma.paymentGateway.upsert({
    where: { id: ID.GW4 },
    update: {},
    create: {
      id: ID.GW4,
      name: 'PayPal Sandbox',
      type: 'paypal',
      status: 'INACTIVE',
      environment: 'sandbox',
      credentials: { clientId: 'paypal_sandbox_xxx', clientSecret: 'paypal_sandbox_secret_xxx' },
    },
  });

  console.log('   ✅ 4 payment gateways (Stripe Main/Test, PayPal Business/Sandbox)');

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. SELLERS (4 new) + USERS + SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n👥 Seeding sellers...');

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

  // ── Seller 1: TechGear Pro (ACTIVE, Stripe Main) ────────────────────────
  const userS1 = await prisma.user.upsert({
    where: { id: ID.U1 },
    update: {},
    create: {
      id: ID.U1,
      email: 'techgear@example.com',
      passwordHash: DEFAULT_HASH,
      displayName: 'TechGear Owner',
      isActive: true,
      role: 'SELLER',
    },
  });

  await prisma.seller.upsert({
    where: { id: ID.S1 },
    update: { paymentGatewayId: ID.GW1 },
    create: {
      id: ID.S1,
      name: 'TechGear Pro',
      slug: 'techgear-pro',
      isActive: true,
      status: 'ACTIVE',
      paymentGatewayId: ID.GW1,
    },
  });

  await prisma.sellerUser.upsert({
    where: { uq_seller_user: { sellerId: ID.S1, userId: userS1.id } },
    update: {},
    create: { sellerId: ID.S1, userId: userS1.id, role: 'OWNER', isActive: true },
  });

  await prisma.sellerSettings.upsert({
    where: { sellerId: ID.S1 },
    update: {},
    create: {
      sellerId: ID.S1,
      brandName: 'TechGear Pro',
      defaultCurrency: 'USD',
      timezone: 'America/New_York',
      supportEmail: 'support@techgear-pro.com',
      metaPixelId: 'px_techgear_001',
    },
  });

  // ── Seller 2: FashionHub VN (ACTIVE, PayPal Business) ───────────────────
  const userS2 = await prisma.user.upsert({
    where: { id: ID.U2 },
    update: {},
    create: {
      id: ID.U2,
      email: 'fashionhub@example.com',
      passwordHash: DEFAULT_HASH,
      displayName: 'FashionHub Owner',
      isActive: true,
      role: 'SELLER',
    },
  });

  await prisma.seller.upsert({
    where: { id: ID.S2 },
    update: { paymentGatewayId: ID.GW3 },
    create: {
      id: ID.S2,
      name: 'FashionHub VN',
      slug: 'fashionhub-vn',
      isActive: true,
      status: 'ACTIVE',
      paymentGatewayId: ID.GW3,
    },
  });

  await prisma.sellerUser.upsert({
    where: { uq_seller_user: { sellerId: ID.S2, userId: userS2.id } },
    update: {},
    create: { sellerId: ID.S2, userId: userS2.id, role: 'OWNER', isActive: true },
  });

  await prisma.sellerSettings.upsert({
    where: { sellerId: ID.S2 },
    update: {},
    create: {
      sellerId: ID.S2,
      brandName: 'FashionHub VN',
      defaultCurrency: 'USD',
      timezone: 'Asia/Ho_Chi_Minh',
      supportEmail: 'hello@fashionhub.vn',
    },
  });

  // ── Seller 3: HomeStyle Plus (PENDING, no gateway) ──────────────────────
  const userS3 = await prisma.user.upsert({
    where: { id: ID.U3 },
    update: {},
    create: {
      id: ID.U3,
      email: 'homestyle@example.com',
      passwordHash: DEFAULT_HASH,
      displayName: 'HomeStyle Owner',
      isActive: true,
      role: 'SELLER',
    },
  });

  await prisma.seller.upsert({
    where: { id: ID.S3 },
    update: {},
    create: {
      id: ID.S3,
      name: 'HomeStyle Plus',
      slug: 'homestyle-plus',
      isActive: true,
      status: 'PENDING',
      paymentGatewayId: null,
    },
  });

  await prisma.sellerUser.upsert({
    where: { uq_seller_user: { sellerId: ID.S3, userId: userS3.id } },
    update: {},
    create: { sellerId: ID.S3, userId: userS3.id, role: 'OWNER', isActive: true },
  });

  await prisma.sellerSettings.upsert({
    where: { sellerId: ID.S3 },
    update: {},
    create: {
      sellerId: ID.S3,
      brandName: 'HomeStyle Plus',
      defaultCurrency: 'USD',
      timezone: 'UTC',
      supportEmail: 'apply@homestyle-plus.com',
    },
  });

  // ── Seller 4: GreenLiving Co (DEACTIVATED, was Stripe Test) ─────────────
  const userS4 = await prisma.user.upsert({
    where: { id: ID.U4 },
    update: {},
    create: {
      id: ID.U4,
      email: 'greenliving@example.com',
      passwordHash: DEFAULT_HASH,
      displayName: 'GreenLiving Owner',
      isActive: false,
      role: 'SELLER',
    },
  });

  await prisma.seller.upsert({
    where: { id: ID.S4 },
    update: {},
    create: {
      id: ID.S4,
      name: 'GreenLiving Co',
      slug: 'greenliving-co',
      isActive: false,
      status: 'DEACTIVATED',
      paymentGatewayId: ID.GW2,
    },
  });

  await prisma.sellerUser.upsert({
    where: { uq_seller_user: { sellerId: ID.S4, userId: userS4.id } },
    update: {},
    create: { sellerId: ID.S4, userId: userS4.id, role: 'OWNER', isActive: false },
  });

  await prisma.sellerSettings.upsert({
    where: { sellerId: ID.S4 },
    update: {},
    create: {
      sellerId: ID.S4,
      brandName: 'GreenLiving Co',
      defaultCurrency: 'USD',
      timezone: 'Europe/London',
      supportEmail: 'info@greenliving.co',
    },
  });

  console.log('   ✅ 4 sellers (TechGear=ACTIVE/Stripe, FashionHub=ACTIVE/PayPal, HomeStyle=PENDING, GreenLiving=DEACTIVATED)');

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. ADMIN STAFF USERS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n👤 Seeding admin staff users...');

  // Ensure the main admin user exists and is SUPERADMIN
  await prisma.user.upsert({
    where: { email: 'admin@pixecom.com' },
    update: { isSuperadmin: true, role: 'SUPERADMIN' },
    create: {
      email: 'admin@pixecom.com',
      passwordHash: DEFAULT_HASH,
      displayName: 'PixEcom Admin',
      isSuperadmin: true,
      role: 'SUPERADMIN',
    },
  });

  await prisma.user.upsert({
    where: { id: ID.UA1 },
    update: {},
    create: {
      id: ID.UA1,
      email: 'maria@pixelxlab.com',
      passwordHash: DEFAULT_HASH,
      displayName: 'Maria Support',
      isActive: true,
      isSuperadmin: true,
      role: 'SUPPORT',
    },
  });

  await prisma.user.upsert({
    where: { id: ID.UA2 },
    update: {},
    create: {
      id: ID.UA2,
      email: 'david@pixelxlab.com',
      passwordHash: DEFAULT_HASH,
      displayName: 'David Finance',
      isActive: false,
      isSuperadmin: true,
      role: 'FINANCE',
    },
  });

  await prisma.user.upsert({
    where: { id: ID.UA3 },
    update: {},
    create: {
      id: ID.UA3,
      email: 'linh@pixelxlab.com',
      passwordHash: DEFAULT_HASH,
      displayName: 'Linh Content',
      isActive: true,
      isSuperadmin: true,
      role: 'CONTENT',
    },
  });

  await prisma.user.upsert({
    where: { id: ID.UA4 },
    update: {},
    create: {
      id: ID.UA4,
      email: 'minh@pixelxlab.com',
      passwordHash: DEFAULT_HASH,
      displayName: 'Minh Content',
      isActive: true,
      isSuperadmin: true,
      role: 'CONTENT',
    },
  });

  console.log('   ✅ 4 admin staff (SUPPORT, FINANCE, CONTENT×2) + main SUPERADMIN');

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. SELLER DOMAINS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n🌐 Seeding seller domains...');

  // TechGear: 2 domains (both VERIFIED)
  await prisma.sellerDomain.upsert({
    where: { id: ID.D1 },
    update: {},
    create: {
      id: ID.D1,
      sellerId: ID.S1,
      hostname: 'techgear-pro.com',
      verificationMethod: 'TXT',
      verificationToken: 'pixecom-verify=tg1a2b3c4d5e',
      status: 'VERIFIED',
      isPrimary: true,
      verifiedAt: new Date('2026-01-15T00:00:00Z'),
    },
  });

  await prisma.sellerDomain.upsert({
    where: { id: ID.D2 },
    update: {},
    create: {
      id: ID.D2,
      sellerId: ID.S1,
      hostname: 'gadgets.sale',
      verificationMethod: 'TXT',
      verificationToken: 'pixecom-verify=gs6f7g8h9i0j',
      status: 'VERIFIED',
      isPrimary: false,
      verifiedAt: new Date('2026-01-20T00:00:00Z'),
    },
  });

  // FashionHub: 1 domain (VERIFIED)
  await prisma.sellerDomain.upsert({
    where: { id: ID.D3 },
    update: {},
    create: {
      id: ID.D3,
      sellerId: ID.S2,
      hostname: 'fashionhub.vn',
      verificationMethod: 'A_RECORD',
      verificationToken: 'pixecom-verify=fh1k2l3m4n5o',
      status: 'VERIFIED',
      isPrimary: true,
      verifiedAt: new Date('2026-01-10T00:00:00Z'),
    },
  });

  // HomeStyle: 1 domain (PENDING)
  await prisma.sellerDomain.upsert({
    where: { id: ID.D4 },
    update: {},
    create: {
      id: ID.D4,
      sellerId: ID.S3,
      hostname: 'homestyle-plus.com',
      verificationMethod: 'TXT',
      verificationToken: 'pixecom-verify=hs6p7q8r9s0t',
      status: 'PENDING',
      isPrimary: true,
    },
  });

  // GreenLiving: 2 domains (1 VERIFIED, 1 FAILED)
  await prisma.sellerDomain.upsert({
    where: { id: ID.D5 },
    update: {},
    create: {
      id: ID.D5,
      sellerId: ID.S4,
      hostname: 'greenliving.co',
      verificationMethod: 'TXT',
      verificationToken: 'pixecom-verify=gl1u2v3w4x5y',
      status: 'VERIFIED',
      isPrimary: true,
      verifiedAt: new Date('2025-11-01T00:00:00Z'),
    },
  });

  await prisma.sellerDomain.upsert({
    where: { id: ID.D6 },
    update: {},
    create: {
      id: ID.D6,
      sellerId: ID.S4,
      hostname: 'eco-shop.store',
      verificationMethod: 'TXT',
      verificationToken: 'pixecom-verify=es6z7a8b9c0d',
      status: 'FAILED',
      isPrimary: false,
      failureReason: 'TXT record not found after 72 hours',
    },
  });

  console.log('   ✅ 6 domains (TechGear×2, FashionHub×1, HomeStyle×1, GreenLiving×2)');

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. SELLPAGES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n📄 Seeding sellpages...');

  // TechGear: 3 sellpages
  await prisma.sellpage.upsert({
    where: { id: ID.SP1 },
    update: {},
    create: {
      id: ID.SP1,
      sellerId: ID.S1,
      productId: product1.id,
      domainId: ID.D1,
      slug: 'wireless-mouse-deal',
      status: 'PUBLISHED',
      titleOverride: 'SlimPro Mouse — 50% Off Today',
    },
  });

  await prisma.sellpage.upsert({
    where: { id: ID.SP2 },
    update: {},
    create: {
      id: ID.SP2,
      sellerId: ID.S1,
      productId: product2.id,
      domainId: ID.D1,
      slug: 'laptop-stand-pro',
      status: 'PUBLISHED',
      titleOverride: 'ProStand — Upgrade Your Desk Setup',
    },
  });

  await prisma.sellpage.upsert({
    where: { id: ID.SP3 },
    update: {},
    create: {
      id: ID.SP3,
      sellerId: ID.S1,
      productId: product3.id,
      domainId: ID.D2,
      slug: 'desk-pad-sale',
      status: 'PUBLISHED',
      titleOverride: 'Premium Desk Pad — Free Shipping',
    },
  });

  // FashionHub: 3 sellpages
  await prisma.sellpage.upsert({
    where: { id: ID.SP4 },
    update: {},
    create: {
      id: ID.SP4,
      sellerId: ID.S2,
      productId: product1.id,
      domainId: ID.D3,
      slug: 'chuot-khong-day',
      status: 'PUBLISHED',
      titleOverride: 'Chuột không dây SlimPro — Giá sốc',
    },
  });

  await prisma.sellpage.upsert({
    where: { id: ID.SP5 },
    update: {},
    create: {
      id: ID.SP5,
      sellerId: ID.S2,
      productId: product2.id,
      domainId: ID.D3,
      slug: 'gia-do-laptop',
      status: 'PUBLISHED',
      titleOverride: 'Giá đỡ Laptop ProStand — Giảm 40%',
    },
  });

  await prisma.sellpage.upsert({
    where: { id: ID.SP6 },
    update: {},
    create: {
      id: ID.SP6,
      sellerId: ID.S2,
      productId: product3.id,
      domainId: ID.D3,
      slug: 'ban-di-chuot',
      status: 'DRAFT',
      titleOverride: null,
    },
  });

  // HomeStyle: 1 sellpage (draft, pending approval)
  await prisma.sellpage.upsert({
    where: { id: ID.SP7 },
    update: {},
    create: {
      id: ID.SP7,
      sellerId: ID.S3,
      productId: product2.id,
      domainId: ID.D4,
      slug: 'home-office-stand',
      status: 'DRAFT',
    },
  });

  // GreenLiving: 1 sellpage (published but seller is deactivated)
  await prisma.sellpage.upsert({
    where: { id: ID.SP8 },
    update: {},
    create: {
      id: ID.SP8,
      sellerId: ID.S4,
      productId: product3.id,
      domainId: ID.D5,
      slug: 'eco-desk-pad',
      status: 'PUBLISHED',
      titleOverride: 'Eco-Friendly Desk Pad',
    },
  });

  console.log('   ✅ 8 sellpages (TechGear×3, FashionHub×3, HomeStyle×1, GreenLiving×1)');

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. ORDERS (12 orders across sellers, 7-day spread)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n🛒 Seeding orders...');

  // --- TechGear orders (5) ---

  // O1: DELIVERED, 6 days ago
  await prisma.order.upsert({
    where: { id: ID.O1 },
    update: {},
    create: {
      id: ID.O1,
      sellerId: ID.S1,
      sellpageId: ID.SP1,
      orderNumber: 'ADM-1001',
      customerEmail: 'john.smith@gmail.com',
      customerName: 'John Smith',
      customerPhone: '+1-555-0101',
      shippingAddress: { street: '123 Main St', city: 'New York', state: 'NY', country: 'US', zip: '10001' },
      subtotal: 62.98,
      shippingCost: 5.00,
      taxAmount: 3.40,
      total: 71.38,
      status: 'DELIVERED',
      paymentMethod: 'STRIPE',
      paymentId: 'pi_adm_001',
      transactionId: 'txn_adm_001',
      trackingNumber: 'TRK-98765432',
      paidAt: daysAgo(6),
      createdAt: daysAgo(6),
    },
  });
  await prisma.orderItem.upsert({ where: { id: ID.OI1 }, update: {}, create: { id: ID.OI1, orderId: ID.O1, productId: product1.id, variantId: variants1[0]?.id, productName: product1.name, variantName: 'Black', sku: 'MOUSE-001-BLK', quantity: 2, unitPrice: 29.99, lineTotal: 59.98 } });
  await prisma.orderItem.upsert({ where: { id: ID.OI2 }, update: {}, create: { id: ID.OI2, orderId: ID.O1, productId: product2.id, variantId: variants2[0]?.id, productName: product2.name, variantName: 'Silver', sku: 'STAND-001-SLV', quantity: 0, unitPrice: 0, lineTotal: 0 } }); // just mouse
  await upsertEvent('00000000-0000-0000-000b-0000000e0101', ID.O1, ID.S1, 'CREATED', 'Order placed', daysAgo(6));
  await upsertEvent('00000000-0000-0000-000b-0000000e0102', ID.O1, ID.S1, 'CONFIRMED', 'Payment confirmed via Stripe', daysAgo(6));
  await upsertEvent('00000000-0000-0000-000b-0000000e0103', ID.O1, ID.S1, 'SHIPPED', 'Shipped via FedEx — TRK-98765432', daysAgo(4));
  await upsertEvent('00000000-0000-0000-000b-0000000e0104', ID.O1, ID.S1, 'DELIVERED', 'Customer received', daysAgo(1));

  // O2: SHIPPED, 4 days ago
  await prisma.order.upsert({
    where: { id: ID.O2 },
    update: {},
    create: {
      id: ID.O2,
      sellerId: ID.S1,
      sellpageId: ID.SP2,
      orderNumber: 'ADM-1002',
      customerEmail: 'sarah.lee@outlook.com',
      customerName: 'Sarah Lee',
      shippingAddress: { street: '45 Oak Ave', city: 'Los Angeles', state: 'CA', country: 'US', zip: '90001' },
      subtotal: 34.99,
      shippingCost: 5.00,
      taxAmount: 2.00,
      total: 41.99,
      status: 'SHIPPED',
      paymentMethod: 'STRIPE',
      paymentId: 'pi_adm_002',
      transactionId: 'txn_adm_002',
      trackingNumber: 'TRK-12345678',
      paidAt: daysAgo(4),
      createdAt: daysAgo(4),
    },
  });
  await prisma.orderItem.upsert({ where: { id: ID.OI3 }, update: {}, create: { id: ID.OI3, orderId: ID.O2, productId: product2.id, variantId: variants2[0]?.id, productName: product2.name, variantName: 'Silver', sku: 'STAND-001-SLV', quantity: 1, unitPrice: 34.99, lineTotal: 34.99 } });
  await upsertEvent('00000000-0000-0000-000b-0000000e0201', ID.O2, ID.S1, 'CREATED', 'Order placed', daysAgo(4));
  await upsertEvent('00000000-0000-0000-000b-0000000e0202', ID.O2, ID.S1, 'CONFIRMED', 'Payment confirmed', daysAgo(4));
  await upsertEvent('00000000-0000-0000-000b-0000000e0203', ID.O2, ID.S1, 'SHIPPED', 'Shipped — TRK-12345678', daysAgo(2));

  // O3: CONFIRMED, 3 days ago
  await prisma.order.upsert({
    where: { id: ID.O3 },
    update: {},
    create: {
      id: ID.O3,
      sellerId: ID.S1,
      sellpageId: ID.SP3,
      orderNumber: 'ADM-1003',
      customerEmail: 'mike.chen@yahoo.com',
      customerName: 'Mike Chen',
      shippingAddress: { street: '789 Pine Rd', city: 'Chicago', state: 'IL', country: 'US', zip: '60601' },
      subtotal: 24.99,
      shippingCost: 0,
      taxAmount: 1.25,
      total: 26.24,
      status: 'CONFIRMED',
      paymentMethod: 'STRIPE',
      paymentId: 'pi_adm_003',
      transactionId: 'txn_adm_003',
      paidAt: daysAgo(3),
      createdAt: daysAgo(3),
    },
  });
  await prisma.orderItem.upsert({ where: { id: ID.OI4 }, update: {}, create: { id: ID.OI4, orderId: ID.O3, productId: product3.id, variantId: variants3[0]?.id, productName: product3.name, variantName: 'Black / XL', sku: 'DESKPAD-001-BLK-XL', quantity: 1, unitPrice: 24.99, lineTotal: 24.99 } });
  await upsertEvent('00000000-0000-0000-000b-0000000e0301', ID.O3, ID.S1, 'CREATED', 'Order placed', daysAgo(3));
  await upsertEvent('00000000-0000-0000-000b-0000000e0302', ID.O3, ID.S1, 'CONFIRMED', 'Payment confirmed', daysAgo(3));

  // O4: PENDING, today
  await prisma.order.upsert({
    where: { id: ID.O4 },
    update: {},
    create: {
      id: ID.O4,
      sellerId: ID.S1,
      sellpageId: ID.SP1,
      orderNumber: 'ADM-1004',
      customerEmail: 'emily.davis@gmail.com',
      customerName: 'Emily Davis',
      shippingAddress: { street: '56 Elm St', city: 'Seattle', state: 'WA', country: 'US', zip: '98101' },
      subtotal: 29.99,
      shippingCost: 5.00,
      taxAmount: 1.75,
      total: 36.74,
      status: 'PENDING',
      createdAt: daysAgo(0),
    },
  });
  await prisma.orderItem.upsert({ where: { id: ID.OI5 }, update: {}, create: { id: ID.OI5, orderId: ID.O4, productId: product1.id, variantId: variants1[0]?.id, productName: product1.name, variantName: 'Black', sku: 'MOUSE-001-BLK', quantity: 1, unitPrice: 29.99, lineTotal: 29.99 } });
  await upsertEvent('00000000-0000-0000-000b-0000000e0401', ID.O4, ID.S1, 'CREATED', 'Order placed, awaiting payment', daysAgo(0));

  // O5: CANCELLED, 5 days ago
  await prisma.order.upsert({
    where: { id: ID.O5 },
    update: {},
    create: {
      id: ID.O5,
      sellerId: ID.S1,
      sellpageId: ID.SP2,
      orderNumber: 'ADM-1005',
      customerEmail: 'robert.kim@hotmail.com',
      customerName: 'Robert Kim',
      shippingAddress: { street: '321 Maple Dr', city: 'Austin', state: 'TX', country: 'US', zip: '73301' },
      subtotal: 34.99,
      shippingCost: 5.00,
      taxAmount: 2.00,
      total: 41.99,
      status: 'CANCELLED',
      paymentMethod: 'STRIPE',
      transactionId: 'txn_adm_005',
      createdAt: daysAgo(5),
    },
  });
  await prisma.orderItem.upsert({ where: { id: ID.OI6 }, update: {}, create: { id: ID.OI6, orderId: ID.O5, productId: product2.id, variantId: variants2[1]?.id, productName: product2.name, variantName: 'Space Gray', sku: 'STAND-001-SGR', quantity: 1, unitPrice: 37.99, lineTotal: 37.99 } });
  await upsertEvent('00000000-0000-0000-000b-0000000e0501', ID.O5, ID.S1, 'CREATED', 'Order placed', daysAgo(5));
  await upsertEvent('00000000-0000-0000-000b-0000000e0502', ID.O5, ID.S1, 'CANCELLED', 'Customer requested cancellation', daysAgo(4));

  // --- FashionHub orders (4) ---

  // O6: DELIVERED, 5 days ago
  await prisma.order.upsert({
    where: { id: ID.O6 },
    update: {},
    create: {
      id: ID.O6,
      sellerId: ID.S2,
      sellpageId: ID.SP4,
      orderNumber: 'ADM-2001',
      customerEmail: 'lisa.wang@gmail.com',
      customerName: 'Lisa Wang',
      customerPhone: '+84901111222',
      shippingAddress: { street: '12 Nguyen Hue', city: 'HCMC', country: 'VN', zip: '70000' },
      subtotal: 59.98,
      shippingCost: 0,
      taxAmount: 3.00,
      total: 62.98,
      status: 'DELIVERED',
      paymentMethod: 'PAYPAL',
      paymentId: 'pp_adm_006',
      transactionId: 'txn_adm_006',
      trackingNumber: 'VN2026020112345',
      paidAt: daysAgo(5),
      createdAt: daysAgo(5),
    },
  });
  await prisma.orderItem.upsert({ where: { id: ID.OI7 }, update: {}, create: { id: ID.OI7, orderId: ID.O6, productId: product1.id, variantId: variants1[0]?.id, productName: product1.name, variantName: 'Black', sku: 'MOUSE-001-BLK', quantity: 2, unitPrice: 29.99, lineTotal: 59.98 } });
  await upsertEvent('00000000-0000-0000-000b-0000000e0601', ID.O6, ID.S2, 'CREATED', 'Order placed', daysAgo(5));
  await upsertEvent('00000000-0000-0000-000b-0000000e0602', ID.O6, ID.S2, 'CONFIRMED', 'PayPal payment confirmed', daysAgo(5));
  await upsertEvent('00000000-0000-0000-000b-0000000e0603', ID.O6, ID.S2, 'SHIPPED', 'Shipped — VN2026020112345', daysAgo(3));
  await upsertEvent('00000000-0000-0000-000b-0000000e0604', ID.O6, ID.S2, 'DELIVERED', 'Delivered', daysAgo(1));

  // O7: SHIPPED, 3 days ago
  await prisma.order.upsert({
    where: { id: ID.O7 },
    update: {},
    create: {
      id: ID.O7,
      sellerId: ID.S2,
      sellpageId: ID.SP5,
      orderNumber: 'ADM-2002',
      customerEmail: 'tom.brown@outlook.com',
      customerName: 'Tom Brown',
      shippingAddress: { street: '78 Le Loi', city: 'Da Nang', country: 'VN', zip: '50000' },
      subtotal: 34.99,
      shippingCost: 5.00,
      taxAmount: 2.00,
      total: 41.99,
      status: 'SHIPPED',
      paymentMethod: 'PAYPAL',
      paymentId: 'pp_adm_007',
      transactionId: 'txn_adm_007',
      trackingNumber: 'VN2026020254321',
      paidAt: daysAgo(3),
      createdAt: daysAgo(3),
    },
  });
  await prisma.orderItem.upsert({ where: { id: ID.OI8 }, update: {}, create: { id: ID.OI8, orderId: ID.O7, productId: product2.id, variantId: variants2[0]?.id, productName: product2.name, variantName: 'Silver', sku: 'STAND-001-SLV', quantity: 1, unitPrice: 34.99, lineTotal: 34.99 } });
  await upsertEvent('00000000-0000-0000-000b-0000000e0701', ID.O7, ID.S2, 'CREATED', 'Order placed', daysAgo(3));
  await upsertEvent('00000000-0000-0000-000b-0000000e0702', ID.O7, ID.S2, 'CONFIRMED', 'Payment confirmed', daysAgo(3));
  await upsertEvent('00000000-0000-0000-000b-0000000e0703', ID.O7, ID.S2, 'SHIPPED', 'Shipped', daysAgo(1));

  // O8: CONFIRMED, 2 days ago
  await prisma.order.upsert({
    where: { id: ID.O8 },
    update: {},
    create: {
      id: ID.O8,
      sellerId: ID.S2,
      sellpageId: ID.SP4,
      orderNumber: 'ADM-2003',
      customerEmail: 'anna.wilson@gmail.com',
      customerName: 'Anna Wilson',
      shippingAddress: { street: '90 Tran Phu', city: 'Ha Noi', country: 'VN', zip: '10000' },
      subtotal: 29.99,
      shippingCost: 5.00,
      taxAmount: 1.75,
      total: 36.74,
      status: 'CONFIRMED',
      paymentMethod: 'PAYPAL',
      paymentId: 'pp_adm_008',
      transactionId: 'txn_adm_008',
      paidAt: daysAgo(2),
      createdAt: daysAgo(2),
    },
  });
  await prisma.orderItem.upsert({ where: { id: ID.OI9 }, update: {}, create: { id: ID.OI9, orderId: ID.O8, productId: product1.id, variantId: variants1[1]?.id, productName: product1.name, variantName: 'White', sku: 'MOUSE-001-WHT', quantity: 1, unitPrice: 29.99, lineTotal: 29.99 } });
  await upsertEvent('00000000-0000-0000-000b-0000000e0801', ID.O8, ID.S2, 'CREATED', 'Order placed', daysAgo(2));
  await upsertEvent('00000000-0000-0000-000b-0000000e0802', ID.O8, ID.S2, 'CONFIRMED', 'Payment confirmed', daysAgo(2));

  // O9: REFUNDED, 6 days ago
  await prisma.order.upsert({
    where: { id: ID.O9 },
    update: {},
    create: {
      id: ID.O9,
      sellerId: ID.S2,
      sellpageId: ID.SP5,
      orderNumber: 'ADM-2004',
      customerEmail: 'kevin.nguyen@hotmail.com',
      customerName: 'Kevin Nguyen',
      shippingAddress: { street: '45 Hai Ba Trung', city: 'HCMC', country: 'VN', zip: '70000' },
      subtotal: 34.99,
      shippingCost: 5.00,
      taxAmount: 2.00,
      total: 41.99,
      status: 'REFUNDED',
      paymentMethod: 'PAYPAL',
      paymentId: 'pp_adm_009',
      transactionId: 'txn_adm_009',
      trackingNumber: 'VN2026020399999',
      paidAt: daysAgo(6),
      createdAt: daysAgo(6),
    },
  });
  await prisma.orderItem.upsert({ where: { id: ID.OI10 }, update: {}, create: { id: ID.OI10, orderId: ID.O9, productId: product2.id, variantId: variants2[1]?.id, productName: product2.name, variantName: 'Space Gray', sku: 'STAND-001-SGR', quantity: 1, unitPrice: 37.99, lineTotal: 37.99 } });
  await upsertEvent('00000000-0000-0000-000b-0000000e0901', ID.O9, ID.S2, 'CREATED', 'Order placed', daysAgo(6));
  await upsertEvent('00000000-0000-0000-000b-0000000e0902', ID.O9, ID.S2, 'CONFIRMED', 'Payment confirmed', daysAgo(6));
  await upsertEvent('00000000-0000-0000-000b-0000000e0903', ID.O9, ID.S2, 'SHIPPED', 'Shipped', daysAgo(4));
  await upsertEvent('00000000-0000-0000-000b-0000000e0904', ID.O9, ID.S2, 'REFUNDED', 'Customer returned — full refund issued', daysAgo(1));

  // --- GreenLiving orders (3, before deactivation) ---

  // O10: DELIVERED, 7 days ago
  await prisma.order.upsert({
    where: { id: ID.O10 },
    update: {},
    create: {
      id: ID.O10,
      sellerId: ID.S4,
      sellpageId: ID.SP8,
      orderNumber: 'ADM-4001',
      customerEmail: 'green.buyer@gmail.com',
      customerName: 'Oliver Green',
      shippingAddress: { street: '10 Park Lane', city: 'London', country: 'GB', zip: 'W1K 1AA' },
      subtotal: 24.99,
      shippingCost: 7.00,
      taxAmount: 1.60,
      total: 33.59,
      status: 'DELIVERED',
      paymentMethod: 'STRIPE',
      paymentId: 'pi_adm_010',
      transactionId: 'txn_adm_010',
      trackingNumber: 'UK2026020100001',
      paidAt: daysAgo(7),
      createdAt: daysAgo(7),
    },
  });
  await prisma.orderItem.upsert({ where: { id: ID.OI11 }, update: {}, create: { id: ID.OI11, orderId: ID.O10, productId: product3.id, variantId: variants3[1]?.id, productName: product3.name, variantName: 'Grey / XL', sku: 'DESKPAD-001-GRY-XL', quantity: 1, unitPrice: 24.99, lineTotal: 24.99 } });
  await upsertEvent('00000000-0000-0000-000b-0000000e1001', ID.O10, ID.S4, 'CREATED', 'Order placed', daysAgo(7));
  await upsertEvent('00000000-0000-0000-000b-0000000e1002', ID.O10, ID.S4, 'CONFIRMED', 'Payment confirmed', daysAgo(7));
  await upsertEvent('00000000-0000-0000-000b-0000000e1003', ID.O10, ID.S4, 'SHIPPED', 'Shipped', daysAgo(5));
  await upsertEvent('00000000-0000-0000-000b-0000000e1004', ID.O10, ID.S4, 'DELIVERED', 'Delivered', daysAgo(2));

  // O11: PROCESSING, 2 days ago
  await prisma.order.upsert({
    where: { id: ID.O11 },
    update: {},
    create: {
      id: ID.O11,
      sellerId: ID.S4,
      sellpageId: ID.SP8,
      orderNumber: 'ADM-4002',
      customerEmail: 'eco.fan@gmail.com',
      customerName: 'Sophie Taylor',
      shippingAddress: { street: '22 High Street', city: 'Manchester', country: 'GB', zip: 'M1 1AA' },
      subtotal: 49.98,
      shippingCost: 7.00,
      taxAmount: 2.85,
      total: 59.83,
      status: 'PROCESSING',
      paymentMethod: 'STRIPE',
      paymentId: 'pi_adm_011',
      transactionId: 'txn_adm_011',
      paidAt: daysAgo(2),
      createdAt: daysAgo(2),
    },
  });
  await prisma.orderItem.upsert({ where: { id: ID.OI12 }, update: {}, create: { id: ID.OI12, orderId: ID.O11, productId: product3.id, variantId: variants3[0]?.id, productName: product3.name, variantName: 'Black / XL', sku: 'DESKPAD-001-BLK-XL', quantity: 2, unitPrice: 24.99, lineTotal: 49.98 } });
  await upsertEvent('00000000-0000-0000-000b-0000000e1101', ID.O11, ID.S4, 'CREATED', 'Order placed', daysAgo(2));
  await upsertEvent('00000000-0000-0000-000b-0000000e1102', ID.O11, ID.S4, 'CONFIRMED', 'Payment confirmed', daysAgo(2));
  await upsertEvent('00000000-0000-0000-000b-0000000e1103', ID.O11, ID.S4, 'PROCESSING', 'Being prepared for shipment', daysAgo(1));

  // O12: DELIVERED, 4 days ago
  await prisma.order.upsert({
    where: { id: ID.O12 },
    update: {},
    create: {
      id: ID.O12,
      sellerId: ID.S4,
      sellpageId: ID.SP8,
      orderNumber: 'ADM-4003',
      customerEmail: 'nature.lover@outlook.com',
      customerName: 'James Wright',
      shippingAddress: { street: '5 Garden Rd', city: 'Bristol', country: 'GB', zip: 'BS1 1AA' },
      subtotal: 24.99,
      shippingCost: 7.00,
      taxAmount: 1.60,
      total: 33.59,
      status: 'DELIVERED',
      paymentMethod: 'STRIPE',
      paymentId: 'pi_adm_012',
      transactionId: 'txn_adm_012',
      trackingNumber: 'UK2026020200002',
      paidAt: daysAgo(4),
      createdAt: daysAgo(4),
    },
  });
  await prisma.orderItem.upsert({ where: { id: ID.OI13 }, update: {}, create: { id: ID.OI13, orderId: ID.O12, productId: product3.id, variantId: variants3[2]?.id, productName: product3.name, variantName: 'Pink / XL', sku: 'DESKPAD-001-PNK-XL', quantity: 1, unitPrice: 26.99, lineTotal: 26.99 } });
  await upsertEvent('00000000-0000-0000-000b-0000000e1201', ID.O12, ID.S4, 'CREATED', 'Order placed', daysAgo(4));
  await upsertEvent('00000000-0000-0000-000b-0000000e1202', ID.O12, ID.S4, 'CONFIRMED', 'Payment confirmed', daysAgo(4));
  await upsertEvent('00000000-0000-0000-000b-0000000e1203', ID.O12, ID.S4, 'SHIPPED', 'Shipped', daysAgo(3));
  await upsertEvent('00000000-0000-0000-000b-0000000e1204', ID.O12, ID.S4, 'DELIVERED', 'Delivered', daysAgo(1));

  console.log('   ✅ 12 orders (TechGear×5, FashionHub×4, GreenLiving×3)');

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. DISCOUNTS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n🏷️  Seeding discounts...');

  await prisma.discount.upsert({
    where: { id: ID.DC1 },
    update: {},
    create: {
      id: ID.DC1,
      code: 'LAUNCH20',
      type: 'PERCENT',
      value: 20,
      uses: 142,
      usageLimit: 500,
      status: 'ACTIVE',
      sellpageId: null,
      expiresAt: new Date('2026-03-31T23:59:59Z'),
    },
  });

  await prisma.discount.upsert({
    where: { id: ID.DC2 },
    update: {},
    create: {
      id: ID.DC2,
      code: 'FLAT10',
      type: 'FIXED',
      value: 10,
      uses: 67,
      usageLimit: null,
      status: 'ACTIVE',
      sellpageId: ID.SP1,
      expiresAt: null,
    },
  });

  await prisma.discount.upsert({
    where: { id: ID.DC3 },
    update: {},
    create: {
      id: ID.DC3,
      code: 'VIP30',
      type: 'PERCENT',
      value: 30,
      uses: 89,
      usageLimit: 100,
      status: 'EXPIRED',
      sellpageId: ID.SP2,
      expiresAt: new Date('2026-01-31T23:59:59Z'),
    },
  });

  await prisma.discount.upsert({
    where: { id: ID.DC4 },
    update: {},
    create: {
      id: ID.DC4,
      code: 'TESTCODE',
      type: 'FIXED',
      value: 5,
      uses: 3,
      usageLimit: 10,
      status: 'DISABLED',
      sellpageId: null,
      expiresAt: null,
    },
  });

  console.log('   ✅ 4 discounts (LAUNCH20, FLAT10, VIP30, TESTCODE)');

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. SELLPAGE STATS DAILY (7 days × 6 published sellpages)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n📊 Seeding sellpage stats (7 days × 6 sellpages)...');

  const spStatsConfig = [
    // TechGear sellpages
    { spId: ID.SP1, sellerId: ID.S1, revBase: 1800, ordBase: 12, spendBase: 480, cvBase: 380, purchBase: 12, coBase: 18 },
    { spId: ID.SP2, sellerId: ID.S1, revBase: 1200, ordBase: 8, spendBase: 320, cvBase: 260, purchBase: 8, coBase: 12 },
    { spId: ID.SP3, sellerId: ID.S1, revBase: 900, ordBase: 6, spendBase: 240, cvBase: 200, purchBase: 6, coBase: 9 },
    // FashionHub sellpages
    { spId: ID.SP4, sellerId: ID.S2, revBase: 1500, ordBase: 10, spendBase: 400, cvBase: 320, purchBase: 10, coBase: 15 },
    { spId: ID.SP5, sellerId: ID.S2, revBase: 800, ordBase: 5, spendBase: 220, cvBase: 180, purchBase: 5, coBase: 8 },
    // GreenLiving sellpage
    { spId: ID.SP8, sellerId: ID.S4, revBase: 400, ordBase: 3, spendBase: 150, cvBase: 120, purchBase: 3, coBase: 4 },
  ];

  let statsCount = 0;
  for (const cfg of spStatsConfig) {
    for (let day = 0; day < 7; day++) {
      const v = () => 0.8 + Math.random() * 0.4; // ±20% daily variance
      const revenue = +(cfg.revBase * v()).toFixed(2);
      const ordersCount = Math.round(cfg.ordBase * v());
      const adSpend = +(cfg.spendBase * v()).toFixed(2);
      const contentViews = Math.round(cfg.cvBase * v());
      const purchases = Math.round(cfg.purchBase * v());
      const checkoutInitiated = Math.round(cfg.coBase * v());
      const linkClicks = Math.round(contentViews * 1.5 * v());
      const addToCart = Math.round(checkoutInitiated * 1.3 * v());

      const roas = adSpend > 0 ? +(revenue / adSpend).toFixed(4) : 0;
      const cpm = contentViews > 0 ? +((adSpend / contentViews) * 1000).toFixed(4) : 0;
      const ctr = contentViews > 0 ? +((linkClicks / (contentViews * 10)) * 100).toFixed(4) : 0;
      const costPerPurchase = purchases > 0 ? +(adSpend / purchases).toFixed(2) : 0;
      const cr1 = contentViews > 0 ? +(checkoutInitiated / contentViews).toFixed(4) : 0;
      const cr2 = checkoutInitiated > 0 ? +(purchases / checkoutInitiated).toFixed(4) : 0;
      const cr3 = contentViews > 0 ? +(purchases / contentViews).toFixed(4) : 0;

      const statDate = dateOnly(day);

      await prisma.sellpageStatsDaily.upsert({
        where: {
          uq_sellpage_stats_daily: {
            sellerId: cfg.sellerId,
            sellpageId: cfg.spId,
            statDate,
            adSource: 'facebook',
          },
        },
        update: {
          revenue, ordersCount, adSpend, contentViews, purchases, checkoutInitiated,
          linkClicks, addToCart, roas, cpm, ctr, costPerPurchase, cr1, cr2, cr3,
        },
        create: {
          sellerId: cfg.sellerId,
          sellpageId: cfg.spId,
          statDate,
          adSource: 'facebook',
          revenue,
          ordersCount,
          adSpend,
          contentViews,
          purchases,
          checkoutInitiated,
          linkClicks,
          addToCart,
          roas,
          cpm,
          ctr,
          costPerPurchase,
          cr1,
          cr2,
          cr3,
        },
      });
      statsCount++;
    }
  }

  console.log(`   ✅ ${statsCount} sellpage stats rows (6 sellpages × 7 days)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  const counts = {
    platformSettings: await prisma.platformSettings.count(),
    paymentGateways: await prisma.paymentGateway.count(),
    sellers: await prisma.seller.count(),
    users: await prisma.user.count(),
    domains: await prisma.sellerDomain.count(),
    sellpages: await prisma.sellpage.count(),
    orders: await prisma.order.count(),
    orderItems: await prisma.orderItem.count(),
    discounts: await prisma.discount.count(),
    sellpageStats: await prisma.sellpageStatsDaily.count(),
  };

  console.log('\n🎉 Admin Portal Seed complete!');
  console.log(`   PlatformSettings: ${counts.platformSettings}`);
  console.log(`   PaymentGateways: ${counts.paymentGateways}`);
  console.log(`   Sellers: ${counts.sellers}`);
  console.log(`   Users: ${counts.users}`);
  console.log(`   Domains: ${counts.domains}`);
  console.log(`   Sellpages: ${counts.sellpages}`);
  console.log(`   Orders: ${counts.orders} (${counts.orderItems} items)`);
  console.log(`   Discounts: ${counts.discounts}`);
  console.log(`   SellpageStatsDaily: ${counts.sellpageStats}`);
}

// ── Helper: upsert order event ─────────────────────────────────────────────
async function upsertEvent(
  id: string,
  orderId: string,
  sellerId: string,
  eventType: 'CREATED' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED' | 'NOTE_ADDED',
  description: string | null,
  createdAt: Date,
) {
  await prisma.orderEvent.upsert({
    where: { id },
    update: {},
    create: { id, orderId, sellerId, eventType, description, createdAt },
  });
}

main()
  .catch((e) => {
    console.error('❌ Admin seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
