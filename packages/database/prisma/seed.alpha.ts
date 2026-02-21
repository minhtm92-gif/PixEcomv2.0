/**
 * Alpha Seed v2 — PixEcom v2 (Milestone 2.4.1)
 * seed_tag: alpha_seed_v2
 *
 * Creates two fully-populated seller accounts for frontend integration testing:
 *
 *   alpha1@pixecom.io / Alpha1Pass2026!
 *   alpha2@pixecom.io / Alpha2Pass2026!
 *
 * Per seller:
 *   - 1 verified domain (so published sellpages show real URLs)
 *   - Products reused from platform seed (MOUSE-001, STAND-001, DESKPAD-001)
 *   - 4 sellpages: 2 PUBLISHED (on verified domain), 2 DRAFT
 *   - 120 orders across last 30 days (mix of statuses, 1–4 items, realistic totals)
 *   - Full order events timeline per status
 *   - trackingNumber + trackingUrl for SHIPPED/DELIVERED orders
 *
 * Idempotent: all rows use fixed UUIDs — safe to re-run.
 * Reset: run seed.alpha.reset.ts to delete only these records.
 * Guard: refuses to run unless APP_ENV=staging or NODE_ENV=staging.
 *
 * Run:
 *   APP_ENV=staging pnpm --filter @pixecom/database seed:alpha
 */

import { PrismaClient, Prisma } from '@prisma/client';

// ─── Staging Guard ────────────────────────────────────────────────────────────
if (process.env.APP_ENV !== 'staging' && process.env.NODE_ENV !== 'staging') {
  console.error(
    '❌ STAGING GUARD: seed.alpha only runs with APP_ENV=staging or NODE_ENV=staging.\n' +
    `   Got APP_ENV="${process.env.APP_ENV}" NODE_ENV="${process.env.NODE_ENV}"`,
  );
  process.exit(1);
}

const prisma = new PrismaClient();

// ─── Fixed UUID factory ───────────────────────────────────────────────────────
// Pattern: 00000000-A<seller>-<layer>-<type>-<index 12 digits>
//   seller: 1 or 2
//   layer:  01=user/seller, 02=domain, 03=sellpage, 04=order, 05=orderitem, 06=orderevent, 07=fbconn
const U = (seller: 1 | 2, layer: string, type: string, idx: number) =>
  `00000000-A${seller}${layer}-${type}-0001-${String(idx).padStart(12, '0')}`;

// Pre-built fixed IDs
const ID = {
  // ── Seller 1 ──────────────────────────────────────────────────────────────
  S1_USER:    '00000000-A100-0001-0001-000000000001',
  S1_SELLER:  '00000000-A100-0001-0002-000000000001',
  S1_DOMAIN:  '00000000-A100-0002-0001-000000000001',
  S1_SP:      (i: number) => `00000000-A100-0003-0001-${String(i).padStart(12, '0')}`,
  S1_ORD:     (i: number) => `00000000-A100-0004-0001-${String(i).padStart(12, '0')}`,
  S1_OI:      (i: number) => `00000000-A100-0005-0001-${String(i).padStart(12, '0')}`,
  S1_OE:      (i: number) => `00000000-A100-0006-0001-${String(i).padStart(12, '0')}`,

  // ── Seller 2 ──────────────────────────────────────────────────────────────
  S2_USER:    '00000000-A200-0001-0001-000000000001',
  S2_SELLER:  '00000000-A200-0001-0002-000000000001',
  S2_DOMAIN:  '00000000-A200-0002-0001-000000000001',
  S2_SP:      (i: number) => `00000000-A200-0003-0001-${String(i).padStart(12, '0')}`,
  S2_ORD:     (i: number) => `00000000-A200-0004-0001-${String(i).padStart(12, '0')}`,
  S2_OI:      (i: number) => `00000000-A200-0005-0001-${String(i).padStart(12, '0')}`,
  S2_OE:      (i: number) => `00000000-A200-0006-0001-${String(i).padStart(12, '0')}`,
} as const;

// ─── Deterministic PRNG (xorshift32) ─────────────────────────────────────────
// No external deps needed — gives stable data across re-runs per seller seed.
function makePrng(seed: number) {
  let s = seed >>> 0;
  return {
    next(): number {
      s ^= s << 13; s ^= s >> 17; s ^= s << 5;
      return (s >>> 0) / 0xffffffff;
    },
    int(min: number, max: number): number {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    pick<T>(arr: T[]): T {
      return arr[this.int(0, arr.length - 1)];
    },
  };
}

// ─── Synthetic data pools ─────────────────────────────────────────────────────
const FIRST_NAMES = [
  'Alice','Bob','Charlie','Diana','Ethan','Fiona','George','Hannah','Ivan',
  'Jenny','Kevin','Linda','Michael','Nancy','Oscar','Patricia','Quinn',
  'Rachel','Steven','Tina','Uma','Victor','Wendy','Xavier','Yvonne','Zack',
  'Sophia','James','Olivia','Liam','Emma','Noah','Ava','Lucas','Mia',
];
const LAST_NAMES = [
  'Nguyen','Tran','Le','Pham','Hoang','Doan','Vo','Ngo','Luong','Mai',
  'Do','Truong','Dinh','Bui','Duong','Ly','Ho','Vu','Trinh','Dao',
  'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis',
  'Wilson','Moore','Taylor','Anderson','Thomas','Jackson','White',
];
const EMAIL_DOMAINS = ['gmail.com','yahoo.com','outlook.com','icloud.com','hotmail.com'];
const CARRIERS = ['GHTK','J&T Express','GHN','Vietnam Post','Ninja Van','DHL','FedEx'];
const STREETS = [
  '12 Nguyen Hue','45 Le Loi','78 Tran Hung Dao','23 Hai Ba Trung',
  '99 Pham Van Dong','56 Nguyen Trai','34 Vo Van Tan','88 Dien Bien Phu',
  '17 Nam Ky Khoi Nghia','61 Ly Tu Trong','100 Hoang Dieu','5 Bach Dang',
  '42 Nguyen Dinh Chieu','73 Cach Mang Thang 8','11 Pasteur',
];
const CITIES = [
  { city: 'Ho Chi Minh City', country: 'VN', zip: '70000', taxRate: 0.08 },
  { city: 'Ha Noi',           country: 'VN', zip: '10000', taxRate: 0.08 },
  { city: 'Da Nang',          country: 'VN', zip: '50000', taxRate: 0.05 },
  { city: 'Can Tho',          country: 'VN', zip: '90000', taxRate: 0.05 },
  { city: 'Hue',              country: 'VN', zip: '53000', taxRate: 0.05 },
  { city: 'Vung Tau',         country: 'VN', zip: '78000', taxRate: 0.08 },
  { city: 'Nha Trang',        country: 'VN', zip: '65000', taxRate: 0.05 },
  { city: 'Binh Duong',       country: 'VN', zip: '75000', taxRate: 0.08 },
];

// Status distribution: 60% DELIVERED, 20% SHIPPED, 10% CONFIRMED, 5% CANCELLED, 5% REFUNDED
const STATUS_POOL = [
  ...Array(60).fill('DELIVERED'),
  ...Array(20).fill('SHIPPED'),
  ...Array(10).fill('CONFIRMED'),
  ...Array(5).fill('CANCELLED'),
  ...Array(5).fill('REFUNDED'),
] as const;

type OrderStatus = typeof STATUS_POOL[number];

// ─── Date helpers ─────────────────────────────────────────────────────────────
function daysAgo(n: number, hour = 12, min = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, min, 0, 0);
  return d;
}

function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3600_000);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

// ─── Seller definition ────────────────────────────────────────────────────────
interface SellerDef {
  userId: string;
  sellerId: string;
  domainId: string;
  email: string;
  password: string;    // plaintext (printed at end)
  passHash: string;    // bcrypt cost=12, pre-computed
  name: string;
  slug: string;
  brandName: string;
  hostname: string;
  verificationToken: string;
  spFn: (i: number) => string;
  ordFn: (i: number) => string;
  oiFn:  (i: number) => string;
  oeFn:  (i: number) => string;
  prngSeed: number;
}

const SELLERS: SellerDef[] = [
  {
    userId:   ID.S1_USER,
    sellerId: ID.S1_SELLER,
    domainId: ID.S1_DOMAIN,
    email:    'alpha1@pixecom.io',
    password: 'Alpha1Pass2026!',
    // bcrypt.hash('Alpha1Pass2026!', 12) — pre-computed
    passHash: '$2b$12$pSqkGfzBT9FwC0oIn4d1Ku.Vr9MVvdk3zUOZeOfgEZNeuuQowSMxm',
    name:     'Alpha Store One',
    slug:     'alpha-store-one',
    brandName:'Alpha Store One',
    hostname: 'alpha1-staging.pixelxlab.com',
    verificationToken: 'alpha1-seed-verified-token-abc123xyz456def',
    spFn:  ID.S1_SP,
    ordFn: ID.S1_ORD,
    oiFn:  ID.S1_OI,
    oeFn:  ID.S1_OE,
    prngSeed: 0xA1B2C3D4,
  },
  {
    userId:   ID.S2_USER,
    sellerId: ID.S2_SELLER,
    domainId: ID.S2_DOMAIN,
    email:    'alpha2@pixecom.io',
    password: 'Alpha2Pass2026!',
    // bcrypt.hash('Alpha2Pass2026!', 12) — pre-computed
    passHash: '$2b$12$SWI5gUDmsgvN/c9uYLet1.7Lkv1ms/ixnvG6e5Fr6FDhatXFUn0wu',
    name:     'Alpha Store Two',
    slug:     'alpha-store-two',
    brandName:'Alpha Store Two',
    hostname: 'alpha2-staging.pixelxlab.com',
    verificationToken: 'alpha2-seed-verified-token-xyz789uvw123ghi',
    spFn:  ID.S2_SP,
    ordFn: ID.S2_ORD,
    oiFn:  ID.S2_OI,
    oeFn:  ID.S2_OE,
    prngSeed: 0xD4C3B2A1,
  },
];

// ─── Product catalog (loaded from DB, from main seed) ─────────────────────────
interface ProductInfo {
  id: string;
  name: string;
  basePrice: number;
  variants: Array<{ id: string; name: string; sku: string | null; price: number }>;
}

async function loadProducts(): Promise<ProductInfo[]> {
  const codes = ['MOUSE-001', 'STAND-001', 'DESKPAD-001'];
  const products = await prisma.product.findMany({
    where: { productCode: { in: codes } },
    include: {
      variants: { where: { isActive: true }, orderBy: { position: 'asc' } },
    },
  });

  if (products.length !== 3) {
    console.error(
      `❌ Expected 3 platform products (${codes.join(', ')}), found ${products.length}.\n` +
      '   Run main seed first: pnpm --filter @pixecom/database db:seed',
    );
    process.exit(1);
  }

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    basePrice: Number(p.basePrice),
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      price: v.priceOverride != null ? Number(v.priceOverride) : Number(p.basePrice),
    })),
  }));
}

// ─── Seed one seller ──────────────────────────────────────────────────────────
async function seedSeller(def: SellerDef, products: ProductInfo[]): Promise<void> {
  const rng = makePrng(def.prngSeed);
  const sellerId = def.sellerId;

  console.log(`\n━━━ Seeding ${def.name} (${def.email}) ━━━`);

  // ── 1. User + Seller + Settings ────────────────────────────────────────────
  await prisma.user.upsert({
    where: { id: def.userId },
    update: { passwordHash: def.passHash },
    create: {
      id: def.userId,
      email: def.email,
      passwordHash: def.passHash,
      displayName: def.name,
      isActive: true,
    },
  });

  await prisma.seller.upsert({
    where: { id: sellerId },
    update: {},
    create: { id: sellerId, name: def.name, slug: def.slug, isActive: true },
  });

  await prisma.sellerUser.upsert({
    where: { uq_seller_user: { sellerId, userId: def.userId } },
    update: {},
    create: { sellerId, userId: def.userId, role: 'OWNER', isActive: true },
  });

  await prisma.sellerSettings.upsert({
    where: { sellerId },
    update: {},
    create: {
      sellerId,
      brandName: def.brandName,
      defaultCurrency: 'USD',
      timezone: 'Asia/Ho_Chi_Minh',
      supportEmail: `support@${def.slug}.io`,
    },
  });

  console.log('  ✅ User + Seller + Settings');

  // ── 2. Verified Domain ─────────────────────────────────────────────────────
  // The seed directly writes VERIFIED status — same as the force=true stub in
  // the domains service. No DNS lookup needed for seed data.
  await prisma.sellerDomain.upsert({
    where: { id: def.domainId },
    update: { status: 'VERIFIED', verifiedAt: new Date('2026-02-01T00:00:00Z') },
    create: {
      id: def.domainId,
      sellerId,
      hostname: def.hostname,
      verificationMethod: 'TXT',
      verificationToken: def.verificationToken,
      status: 'VERIFIED',
      isPrimary: true,
      verifiedAt: new Date('2026-02-01T00:00:00Z'),
    },
  });

  console.log(`  ✅ Domain: ${def.hostname} (VERIFIED, isPrimary)`);

  // ── 3. Sellpages: 2 PUBLISHED (on verified domain), 2 DRAFT ───────────────
  const spDefs = [
    {
      id: def.spFn(1),
      productId: products[0].id,
      slug: `${def.slug}-mouse-deal`,
      status: 'PUBLISHED' as const,
      domainId: def.domainId,
      titleOverride: `${def.brandName} — SlimPro Mouse Flash Sale`,
      descriptionOverride: 'Best wireless mouse at an unbeatable price. Free shipping today.',
    },
    {
      id: def.spFn(2),
      productId: products[1].id,
      slug: `${def.slug}-stand-offer`,
      status: 'PUBLISHED' as const,
      domainId: def.domainId,
      titleOverride: `${def.brandName} — ProStand Workspace Upgrade`,
      descriptionOverride: null,
    },
    {
      id: def.spFn(3),
      productId: products[2].id,
      slug: `${def.slug}-deskpad-promo`,
      status: 'DRAFT' as const,
      domainId: null,
      titleOverride: null,
      descriptionOverride: null,
    },
    {
      id: def.spFn(4),
      productId: products[0].id,
      slug: `${def.slug}-mouse-retarget`,
      status: 'DRAFT' as const,
      domainId: null,
      titleOverride: 'Special Offer — Limited Time',
      descriptionOverride: null,
    },
  ];

  for (const sp of spDefs) {
    await prisma.sellpage.upsert({
      where: { id: sp.id },
      update: {},
      create: {
        id: sp.id,
        sellerId,
        productId: sp.productId,
        domainId: sp.domainId,
        slug: sp.slug,
        status: sp.status,
        titleOverride: sp.titleOverride,
        descriptionOverride: sp.descriptionOverride,
      },
    });
  }

  console.log('  ✅ 4 sellpages (2 PUBLISHED on verified domain, 2 DRAFT)');

  // ── 4. 120 Orders ──────────────────────────────────────────────────────────
  // Published sellpage IDs — most orders come from published pages
  const publishedSpIds = [def.spFn(1), def.spFn(2)];
  const allSpIds = spDefs.map((s) => s.id);

  let oiCursor = 1;
  let oeCursor = 1;

  for (let i = 1; i <= 120; i++) {
    const orderId = def.ordFn(i);

    // Deterministic status from distribution pool
    const status: OrderStatus = STATUS_POOL[i % STATUS_POOL.length];

    // Days ago: spread deterministically over 0–29
    const daysBack = ((i - 1) * 29) % 30; // 0..29, cycling
    const orderHour = 8 + (i % 14);       // 08:00–21:00
    const orderMin  = (i * 7) % 60;
    const createdAt = daysAgo(daysBack, orderHour, orderMin);

    // Sellpage: 80% from published, 20% from any
    const spId = i % 5 === 0
      ? rng.pick(allSpIds)
      : rng.pick(publishedSpIds);

    // Customer
    const firstName = FIRST_NAMES[(i * 3 + def.prngSeed) % FIRST_NAMES.length];
    const lastName  = LAST_NAMES[ (i * 7 + def.prngSeed) % LAST_NAMES.length];
    const emailDom  = EMAIL_DOMAINS[i % EMAIL_DOMAINS.length];
    const customerName  = `${firstName} ${lastName}`;
    const customerEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${emailDom}`;
    const customerPhone = i % 4 === 0 ? null : `+849${String((i * 13579) % 100000000).padStart(8, '0')}`;

    // Address (deterministic by i)
    const addr = CITIES[i % CITIES.length];
    const street = STREETS[i % STREETS.length];

    // Items: 1–4
    const numItems = 1 + (i % 4);
    const items: Array<{ productId: string; variantId: string; productName: string; variantName: string; sku: string | null; qty: number; unitPrice: number }> = [];

    for (let k = 0; k < numItems; k++) {
      const prod = products[(i + k) % products.length];
      const variant = prod.variants[(i + k) % prod.variants.length];
      // Price in range $19.90–$89.90 using variant price (clamped)
      const rawPrice = Math.min(89.90, Math.max(19.90, variant.price));
      const unitPrice = Math.round(rawPrice * 100) / 100;
      const qty = 1 + ((i + k) % 3); // 1–3
      items.push({
        productId: prod.id,
        variantId: variant.id,
        productName: prod.name,
        variantName: variant.name,
        sku: variant.sku,
        qty,
        unitPrice,
      });
    }

    // Totals — mathematically consistent
    const subtotal = Math.round(items.reduce((s, it) => s + it.unitPrice * it.qty, 0) * 100) / 100;
    const shippingCost = [3.99, 4.99, 5.99, 7.99, 9.99][i % 5];
    const taxRate = addr.taxRate;
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
    // ~30% of orders get a discount of 5–20%
    const hasDiscount = i % 10 < 3;
    const discountPct = hasDiscount ? [0.05, 0.10, 0.15, 0.20][(i) % 4] : 0;
    const discountAmount = hasDiscount ? Math.round(subtotal * discountPct * 100) / 100 : 0;
    const total = Math.round((subtotal + shippingCost + taxAmount - discountAmount) * 100) / 100;

    // Tracking
    const hasTracking = status === 'SHIPPED' || status === 'DELIVERED';
    const carrier = hasTracking ? CARRIERS[i % CARRIERS.length] : null;
    const trackingNumber = hasTracking ? `${carrier!.replace(/[^A-Z]/gi,'').toUpperCase().slice(0,3)}${String(i * 123456789).slice(-10)}` : null;
    const trackingUrl = trackingNumber ? `https://tracking.pixelxlab.com/track/${trackingNumber}` : null;

    // Payment
    const paidAt = status !== 'PENDING' ? addHours(createdAt, 1) : null;

    await prisma.order.upsert({
      where: { id: orderId },
      update: {},
      create: {
        id: orderId,
        sellerId,
        sellpageId: spId,
        orderNumber: `A${def.sellerId.slice(-4).toUpperCase()}-${String(i).padStart(4, '0')}`,
        customerEmail,
        customerName,
        customerPhone,
        shippingAddress: {
          street,
          city: addr.city,
          country: addr.country,
          zip: addr.zip,
        },
        subtotal,
        shippingCost,
        taxAmount,
        discountAmount,
        total,
        currency: 'USD',
        status,
        paymentMethod: i % 3 === 0 ? 'paypal' : 'card',
        paymentId: `PAY-A${def.sellerId.slice(-2)}-${String(i).padStart(6, '0')}`,
        paidAt,
        trackingNumber,
        trackingUrl,
        notes: hasDiscount ? `${Math.round(discountPct * 100)}% loyalty discount applied` : null,
        createdAt,
      },
    });

    // Order items
    for (let k = 0; k < items.length; k++) {
      const it = items[k];
      const oiId = def.oiFn(oiCursor++);
      await prisma.orderItem.upsert({
        where: { id: oiId },
        update: {},
        create: {
          id: oiId,
          orderId,
          productId: it.productId,
          variantId: it.variantId,
          productName: it.productName,
          variantName: it.variantName,
          sku: it.sku,
          quantity: it.qty,
          unitPrice: it.unitPrice,
          lineTotal: Math.round(it.unitPrice * it.qty * 100) / 100,
        },
      });
    }

    // Order events (timeline)
    // CREATED always
    const oeCreated = def.oeFn(oeCursor++);
    await prisma.orderEvent.upsert({
      where: { id: oeCreated },
      update: {},
      create: {
        id: oeCreated,
        orderId,
        sellerId,
        eventType: 'CREATED',
        description: 'Order placed via sellpage',
        createdAt,
      },
    });

    // CONFIRMED (for all except PENDING and CANCELLED at same time)
    if (['CONFIRMED','PROCESSING','SHIPPED','DELIVERED','REFUNDED'].includes(status)) {
      const oeConf = def.oeFn(oeCursor++);
      const confirmedAt = addHours(createdAt, 2);
      await prisma.orderEvent.upsert({
        where: { id: oeConf },
        update: {},
        create: {
          id: oeConf,
          orderId,
          sellerId,
          eventType: 'CONFIRMED',
          description: 'Payment confirmed',
          metadata: { paymentMethod: i % 3 === 0 ? 'paypal' : 'card' },
          createdAt: confirmedAt,
        },
      });
    }

    // SHIPPED
    if (['SHIPPED','DELIVERED'].includes(status)) {
      const oeShip = def.oeFn(oeCursor++);
      const shippedAt = addDays(createdAt, 2);
      await prisma.orderEvent.upsert({
        where: { id: oeShip },
        update: {},
        create: {
          id: oeShip,
          orderId,
          sellerId,
          eventType: 'SHIPPED',
          description: `Shipped via ${carrier} — ${trackingNumber}`,
          metadata: { carrier, trackingNumber, trackingUrl },
          createdAt: shippedAt,
        },
      });
    }

    // DELIVERED
    if (status === 'DELIVERED') {
      const oeDel = def.oeFn(oeCursor++);
      const deliveredAt = addDays(createdAt, 5);
      await prisma.orderEvent.upsert({
        where: { id: oeDel },
        update: {},
        create: {
          id: oeDel,
          orderId,
          sellerId,
          eventType: 'DELIVERED',
          description: 'Package delivered to customer',
          metadata: { deliveredAt: deliveredAt.toISOString() },
          createdAt: deliveredAt,
        },
      });
    }

    // CANCELLED
    if (status === 'CANCELLED') {
      const oeCancel = def.oeFn(oeCursor++);
      const reasons = [
        'Customer requested cancellation',
        'Out of stock — cancelled automatically',
        'Payment declined after 3 attempts',
        'Duplicate order detected',
      ];
      await prisma.orderEvent.upsert({
        where: { id: oeCancel },
        update: {},
        create: {
          id: oeCancel,
          orderId,
          sellerId,
          eventType: 'CANCELLED',
          description: reasons[i % reasons.length],
          createdAt: addHours(createdAt, 3),
        },
      });
    }

    // REFUNDED
    if (status === 'REFUNDED') {
      const oeConf2 = def.oeFn(oeCursor++);
      await prisma.orderEvent.upsert({
        where: { id: oeConf2 },
        update: {},
        create: {
          id: oeConf2,
          orderId,
          sellerId,
          eventType: 'CONFIRMED',
          description: 'Payment confirmed',
          createdAt: addHours(createdAt, 2),
        },
      });

      const oeRef = def.oeFn(oeCursor++);
      await prisma.orderEvent.upsert({
        where: { id: oeRef },
        update: {},
        create: {
          id: oeRef,
          orderId,
          sellerId,
          eventType: 'REFUNDED',
          description: 'Full refund issued — customer request',
          metadata: { refundAmount: total, refundedAt: addDays(createdAt, 7).toISOString() },
          createdAt: addDays(createdAt, 7),
        },
      });
    }
  }

  console.log(`  ✅ 120 orders (${oiCursor - 1} items, ${oeCursor - 1} events)`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Alpha Seed v2 — seed_tag: alpha_seed_v2\n');

  const products = await loadProducts();
  console.log(`✅ Platform products loaded: ${products.map((p) => p.name).join(', ')}`);

  for (const def of SELLERS) {
    await seedSeller(def, products);
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('  Alpha Seed v2 Complete');
  console.log('═'.repeat(60));

  for (const def of SELLERS) {
    const [sp, ord, oi, oe] = await Promise.all([
      prisma.sellpage.count({ where: { sellerId: def.sellerId } }),
      prisma.order.count({ where: { sellerId: def.sellerId } }),
      prisma.orderItem.count({ where: { order: { sellerId: def.sellerId } } }),
      prisma.orderEvent.count({ where: { sellerId: def.sellerId } }),
    ]);
    console.log(`\n  ${def.name}`);
    console.log(`    Email:      ${def.email}`);
    console.log(`    Password:   ${def.password}`);
    console.log(`    Seller ID:  ${def.sellerId}`);
    console.log(`    Domain:     https://${def.hostname} (VERIFIED)`);
    console.log(`    Sellpages:  ${sp} (2 PUBLISHED, 2 DRAFT)`);
    console.log(`    Orders:     ${ord}`);
    console.log(`    Items:      ${oi}`);
    console.log(`    Events:     ${oe}`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  Reset:  APP_ENV=staging pnpm seed:alpha:reset');
  console.log('  Verify: APP_ENV=staging pnpm seed:alpha:verify');
  console.log('═'.repeat(60) + '\n');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
