// ── Admin mock data (PREVIEW ONLY — no API calls) ──────────────────────────

export interface MockSeller {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'ACTIVE' | 'PENDING' | 'DEACTIVATED' | 'REJECTED';
  paypalGateway: string | null;
  creditCardGateway: string | null;
  stripeAccountId?: string;
  paypalEmail?: string;
  stores: number;
  products: number;
  orders: number;
  revenue: number;
  roas: number;
  createdAt: string;
}

export interface MockAdminOrder {
  id: string;
  orderNumber: string;
  sellerName: string;
  sellerId: string;
  customer: string;
  product: string;
  total: number;
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
  trackingNumber: string | null;
  transactionId: string | null;
  createdAt: string;
}

export interface MockStore {
  id: string;
  sellerId: string;
  sellerName: string;
  domain: string;
  status: 'ACTIVE' | 'PENDING' | 'INACTIVE';
  productCount: number;
  sellpageCount: number;
  monthlyVolume: number;
  isDefault: boolean;
  verificationMethod: 'TXT' | 'A_RECORD';
  verificationToken: string;
  createdAt: string;
}

export interface MockAdminProduct {
  id: string;
  makerName: string;
  name: string;
  sku: string;
  productCode: string;
  price: number;
  compareAtPrice: number;
  costPrice: number;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  variants: number;
  orders: number;
  revenue: number;
  spend: number;
  roas: number;
  description: string;
  tags: string[];
  createdAt: string;
}

export interface MockDiscount {
  id: string;
  code: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  uses: number;
  limit: number | null;
  status: 'ACTIVE' | 'EXPIRED' | 'DISABLED';
  sellpageName: string | null;
  expiresAt: string | null;
}

export interface MockAdminUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPERADMIN' | 'SUPPORT' | 'FINANCE' | 'CONTENT';
  status: 'ACTIVE' | 'INACTIVE';
  lastLogin: string;
  createdAt: string;
}

export interface MockPaymentGateway {
  id: string;
  name: string;
  type: 'stripe' | 'paypal';
  status: 'ACTIVE' | 'INACTIVE';
<<<<<<< HEAD
  environment: 'live' | 'sandbox';
=======
  environment: 'live';
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
  assignedSellers: string[];
  createdAt: string;
}

export interface MockProductVariant {
  id: string;
  name: string;
  properties: string;
  price: number;
  compareAtPrice: number;
  costPrice: number;
  fulfillmentCost: number;
  sku: string;
  stock: number;
  image?: string;
}

export interface MockProductReview {
  id: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
  images: string[];
  createdAt: string;
}

export interface MockContentPerformanceSellpage {
  id: string;
  name: string;
  slug: string;
  product: string;
  status: 'PUBLISHED' | 'DRAFT';
  views: number;
  orders: number;
  cr: number;
  revenue: number;
  createdAt: string;
}

export interface MockContentPerformanceCreative {
  id: string;
  name: string;
  type: 'VIDEO_AD' | 'IMAGE_AD' | 'TEXT_ONLY' | 'UGC_BUNDLE';
  product: string;
  status: 'READY' | 'DRAFT';
  spend: number;
  clicks: number;
  ctr: number;
  roas: number;
  createdAt: string;
}

// ── Sellers ────────────────────────────────────────────────────────────────
export const MOCK_SELLERS: MockSeller[] = [
  {
    id: 'sel_01',
    name: 'Alpha Dropship',
    email: 'alpha@example.com',
    phone: '+1 555-0101',
    status: 'ACTIVE',
    paypalGateway: null,
    creditCardGateway: 'stripe',
    stripeAccountId: 'acct_1Abc123XYZ',
    stores: 3,
    products: 12,
    orders: 342,
    revenue: 68400,
    roas: 3.8,
    createdAt: '2025-08-15',
  },
  {
    id: 'sel_02',
    name: 'Beta Commerce',
    email: 'beta@example.com',
    phone: '+1 555-0202',
    status: 'ACTIVE',
    paypalGateway: 'paypal',
    creditCardGateway: null,
    paypalEmail: 'beta-pay@example.com',
    stores: 2,
    products: 8,
    orders: 215,
    revenue: 43000,
    roas: 2.9,
    createdAt: '2025-09-22',
  },
  {
    id: 'sel_03',
    name: 'Gamma Goods',
    email: 'gamma@example.com',
    phone: '+1 555-0303',
    status: 'PENDING',
    paypalGateway: null,
    creditCardGateway: null,
    stores: 1,
    products: 4,
    orders: 0,
    revenue: 0,
    roas: 0,
    createdAt: '2026-01-10',
  },
  {
    id: 'sel_04',
    name: 'Delta Deals',
    email: 'delta@example.com',
    phone: '+1 555-0404',
    status: 'ACTIVE',
    paypalGateway: null,
    creditCardGateway: 'stripe',
    stripeAccountId: 'acct_2Def456UVW',
    stores: 4,
    products: 20,
    orders: 478,
    revenue: 61300,
    roas: 4.2,
    createdAt: '2025-07-03',
  },
  {
    id: 'sel_05',
    name: 'Epsilon Shop',
    email: 'epsilon@example.com',
    phone: '+1 555-0505',
    status: 'DEACTIVATED',
    paypalGateway: null,
    creditCardGateway: 'stripe',
    stripeAccountId: 'acct_3Ghi789RST',
    stores: 1,
    products: 3,
    orders: 28,
    revenue: 5600,
    roas: 1.4,
    createdAt: '2025-11-01',
  },
  {
    id: 'sel_06',
    name: 'Zeta Ventures',
    email: 'zeta@example.com',
    phone: '+1 555-0606',
    status: 'REJECTED',
    paypalGateway: null,
    creditCardGateway: null,
    stores: 0,
    products: 0,
    orders: 0,
    revenue: 0,
    roas: 0,
    createdAt: '2026-02-01',
  },
];

// ── Orders ────────────────────────────────────────────────────────────────
export const MOCK_ADMIN_ORDERS: MockAdminOrder[] = [
  {
    id: 'ord_01',
    orderNumber: 'ORD-1001',
    sellerName: 'Alpha Dropship',
    sellerId: 'sel_01',
    customer: 'John Smith',
    product: 'Wireless Earbuds Pro',
    total: 59.99,
    status: 'DELIVERED',
    trackingNumber: 'TRK-98765432',
    transactionId: 'txn_3Abc123XYZ',
    createdAt: '2026-02-20',
  },
  {
    id: 'ord_02',
    orderNumber: 'ORD-1002',
    sellerName: 'Beta Commerce',
    sellerId: 'sel_02',
    customer: 'Sarah Lee',
    product: 'Portable Charger 20K',
    total: 34.99,
    status: 'SHIPPED',
    trackingNumber: 'TRK-12345678',
    transactionId: 'txn_4Def456UVW',
    createdAt: '2026-02-20',
  },
  {
    id: 'ord_03',
    orderNumber: 'ORD-1003',
    sellerName: 'Delta Deals',
    sellerId: 'sel_04',
    customer: 'Mike Chen',
    product: 'Smart Watch Series 3',
    total: 129.99,
    status: 'CONFIRMED',
    trackingNumber: null,
    transactionId: 'txn_5Ghi789RST',
    createdAt: '2026-02-21',
  },
  {
    id: 'ord_04',
    orderNumber: 'ORD-1004',
    sellerName: 'Alpha Dropship',
    sellerId: 'sel_01',
    customer: 'Emily Davis',
    product: 'LED Desk Lamp',
    total: 24.99,
    status: 'PENDING',
    trackingNumber: null,
    transactionId: null,
    createdAt: '2026-02-21',
  },
  {
    id: 'ord_05',
    orderNumber: 'ORD-1005',
    sellerName: 'Delta Deals',
    sellerId: 'sel_04',
    customer: 'Robert Kim',
    product: 'Yoga Mat Premium',
    total: 44.99,
    status: 'CANCELLED',
    trackingNumber: null,
    transactionId: 'txn_6Jkl012MNO',
    createdAt: '2026-02-19',
  },
  {
    id: 'ord_06',
    orderNumber: 'ORD-1006',
    sellerName: 'Beta Commerce',
    sellerId: 'sel_02',
    customer: 'Lisa Wang',
    product: 'Coffee Grinder Pro',
    total: 79.99,
    status: 'REFUNDED',
    trackingNumber: 'TRK-55551234',
    transactionId: 'txn_7Mno345PQR',
    createdAt: '2026-02-18',
  },
  {
    id: 'ord_07',
    orderNumber: 'ORD-1007',
    sellerName: 'Alpha Dropship',
    sellerId: 'sel_01',
    customer: 'Tom Brown',
    product: 'Resistance Bands Set',
    total: 19.99,
    status: 'DELIVERED',
    trackingNumber: 'TRK-77778899',
    transactionId: 'txn_8Pqr678STU',
    createdAt: '2026-02-17',
  },
  {
    id: 'ord_08',
    orderNumber: 'ORD-1008',
    sellerName: 'Delta Deals',
    sellerId: 'sel_04',
    customer: 'Anna Wilson',
    product: 'Bamboo Cutting Board',
    total: 32.99,
    status: 'SHIPPED',
    trackingNumber: 'TRK-44443322',
    transactionId: 'txn_9Stu901VWX',
    createdAt: '2026-02-22',
  },
];

// ── Stores / Domains (TLD-based, FB-11) ─────────────────────────────────
export const MOCK_STORES: MockStore[] = [
  {
    id: 'str_01',
    sellerId: 'sel_01',
    sellerName: 'Alpha Dropship',
    domain: 'bestbra.com',
    status: 'ACTIVE',
    productCount: 5,
    sellpageCount: 8,
    monthlyVolume: 12400,
    isDefault: true,
    verificationMethod: 'TXT',
    verificationToken: 'pixecom-verify=a1b2c3d4e5f6',
    createdAt: '2025-08-15',
  },
  {
    id: 'str_02',
    sellerId: 'sel_01',
    sellerName: 'Alpha Dropship',
    domain: 'alphagear.store',
    status: 'ACTIVE',
    productCount: 4,
    sellpageCount: 5,
    monthlyVolume: 8700,
    isDefault: false,
    verificationMethod: 'TXT',
    verificationToken: 'pixecom-verify=g7h8i9j0k1l2',
    createdAt: '2025-09-01',
  },
  {
    id: 'str_03',
    sellerId: 'sel_02',
    sellerName: 'Beta Commerce',
    domain: 'alphatech.store',
    status: 'ACTIVE',
    productCount: 8,
    sellpageCount: 12,
    monthlyVolume: 15600,
    isDefault: true,
    verificationMethod: 'A_RECORD',
    verificationToken: 'pixecom-verify=m3n4o5p6q7r8',
    createdAt: '2025-09-22',
  },
  {
    id: 'str_04',
    sellerId: 'sel_04',
    sellerName: 'Delta Deals',
    domain: 'luxhome.co',
    status: 'ACTIVE',
    productCount: 12,
    sellpageCount: 18,
    monthlyVolume: 22300,
    isDefault: true,
    verificationMethod: 'TXT',
    verificationToken: 'pixecom-verify=s9t0u1v2w3x4',
    createdAt: '2025-07-03',
  },
  {
    id: 'str_05',
    sellerId: 'sel_03',
    sellerName: 'Gamma Goods',
    domain: 'gammagoods.shop',
    status: 'PENDING',
    productCount: 4,
    sellpageCount: 2,
    monthlyVolume: 0,
    isDefault: true,
    verificationMethod: 'TXT',
    verificationToken: 'pixecom-verify=y5z6a7b8c9d0',
    createdAt: '2026-01-10',
  },
];

// ── Products (FB-07: seller→maker, FB-08: +ROAS) ────────────────────────
export const MOCK_ADMIN_PRODUCTS: MockAdminProduct[] = [
  {
    id: 'prd_01',
    makerName: 'Admin (PixEcom)',
    name: 'Wireless Earbuds Pro',
    sku: 'WEP-001',
    productCode: 'PIX-WEP-001',
    price: 59.99,
    compareAtPrice: 99.99,
    costPrice: 18.5,
    status: 'ACTIVE',
    variants: 3,
    orders: 142,
    revenue: 8519,
    spend: 2240,
    roas: 3.8,
    description: 'Premium wireless earbuds with ANC and 24h battery life.',
    tags: ['Electronics', 'Audio', 'Bestseller'],
    createdAt: '2025-08-20',
  },
  {
    id: 'prd_02',
    makerName: 'Admin (PixEcom)',
    name: 'LED Desk Lamp',
    sku: 'LDL-002',
    productCode: 'PIX-LDL-002',
    price: 24.99,
    compareAtPrice: 39.99,
    costPrice: 8.0,
    status: 'ACTIVE',
    variants: 2,
    orders: 89,
    revenue: 2225,
    spend: 780,
    roas: 2.85,
    description: 'Adjustable LED desk lamp with 3 color temperatures.',
    tags: ['Home', 'Lighting'],
    createdAt: '2025-09-05',
  },
  {
    id: 'prd_03',
    makerName: 'Content Team',
    name: 'Portable Charger 20K',
    sku: 'PC20-001',
    productCode: 'PIX-PC20-001',
    price: 34.99,
    compareAtPrice: 49.99,
    costPrice: 12.0,
    status: 'ACTIVE',
    variants: 1,
    orders: 115,
    revenue: 4024,
    spend: 1390,
    roas: 2.9,
    description: '20000mAh portable charger with USB-C PD fast charging.',
    tags: ['Electronics', 'Accessories'],
    createdAt: '2025-10-01',
  },
  {
    id: 'prd_04',
    makerName: 'Admin (PixEcom)',
    name: 'Smart Watch Series 3',
    sku: 'SW3-001',
    productCode: 'PIX-SW3-001',
    price: 129.99,
    compareAtPrice: 199.99,
    costPrice: 42.0,
    status: 'ACTIVE',
    variants: 4,
    orders: 198,
    revenue: 25742,
    spend: 6130,
    roas: 4.2,
    description: 'Fitness-focused smartwatch with heart rate, GPS, and 7-day battery.',
    tags: ['Electronics', 'Wearable', 'Bestseller'],
    createdAt: '2025-07-10',
  },
  {
    id: 'prd_05',
    makerName: 'Content Team',
    name: 'Yoga Mat Premium',
    sku: 'YMP-001',
    productCode: 'PIX-YMP-001',
    price: 44.99,
    compareAtPrice: 69.99,
    costPrice: 14.0,
    status: 'ACTIVE',
    variants: 3,
    orders: 167,
    revenue: 7513,
    spend: 2150,
    roas: 3.49,
    description: 'Non-slip premium yoga mat, 6mm thick, eco-friendly materials.',
    tags: ['Fitness', 'Wellness'],
    createdAt: '2025-07-15',
  },
  {
    id: 'prd_06',
    makerName: 'Content Team',
    name: 'Coffee Grinder Pro',
    sku: 'CGP-001',
    productCode: 'PIX-CGP-001',
    price: 79.99,
    compareAtPrice: 119.99,
    costPrice: 28.0,
    status: 'DRAFT',
    variants: 2,
    orders: 0,
    revenue: 0,
    spend: 0,
    roas: 0,
    description: 'Burr coffee grinder with 40 grind settings and quiet motor.',
    tags: ['Kitchen', 'Appliance'],
    createdAt: '2025-12-01',
  },
  {
    id: 'prd_07',
    makerName: 'Admin (PixEcom)',
    name: 'Bamboo Cutting Board',
    sku: 'BCB-001',
    productCode: 'PIX-BCB-001',
    price: 32.99,
    compareAtPrice: 49.99,
    costPrice: 10.0,
    status: 'ACTIVE',
    variants: 1,
    orders: 43,
    revenue: 1419,
    spend: 510,
    roas: 2.78,
    description: 'Organic bamboo cutting board set, 3 sizes included.',
    tags: ['Kitchen', 'Eco-friendly'],
    createdAt: '2026-01-15',
  },
  {
    id: 'prd_08',
    makerName: 'Admin (PixEcom)',
    name: 'Resistance Bands Set',
    sku: 'RBS-001',
    productCode: 'PIX-RBS-001',
    price: 19.99,
    compareAtPrice: 29.99,
    costPrice: 5.5,
    status: 'ARCHIVED',
    variants: 2,
    orders: 28,
    revenue: 560,
    spend: 400,
    roas: 1.4,
    description: '5-piece resistance bands set with door anchor and bag.',
    tags: ['Fitness'],
    createdAt: '2025-11-05',
  },
];

// ── Product Detail Mock (for /admin/products/[id]) ──────────────────────
export const MOCK_PRODUCT_VARIANTS: MockProductVariant[] = [
  { id: 'var_01', name: 'S / Black', properties: 'Size: S, Color: Black', price: 59.99, compareAtPrice: 99.99, costPrice: 18.5, fulfillmentCost: 4.5, sku: 'WEP-S-BLK', stock: 120, image: 'https://picsum.photos/seed/v1/80/80' },
  { id: 'var_02', name: 'M / Black', properties: 'Size: M, Color: Black', price: 59.99, compareAtPrice: 99.99, costPrice: 18.5, fulfillmentCost: 4.5, sku: 'WEP-M-BLK', stock: 85, image: 'https://picsum.photos/seed/v2/80/80' },
  { id: 'var_03', name: 'L / Black', properties: 'Size: L, Color: Black', price: 64.99, compareAtPrice: 109.99, costPrice: 20.0, fulfillmentCost: 5.0, sku: 'WEP-L-BLK', stock: 60 },
  { id: 'var_04', name: 'S / White', properties: 'Size: S, Color: White', price: 59.99, compareAtPrice: 99.99, costPrice: 18.5, fulfillmentCost: 4.5, sku: 'WEP-S-WHT', stock: 95 },
  { id: 'var_05', name: 'M / White', properties: 'Size: M, Color: White', price: 59.99, compareAtPrice: 99.99, costPrice: 18.5, fulfillmentCost: 4.5, sku: 'WEP-M-WHT', stock: 72 },
  { id: 'var_06', name: 'L / White', properties: 'Size: L, Color: White', price: 64.99, compareAtPrice: 109.99, costPrice: 20.0, fulfillmentCost: 5.0, sku: 'WEP-L-WHT', stock: 45 },
];

export const MOCK_PRODUCT_REVIEWS: MockProductReview[] = [
  { id: 'rev_01', author: 'John D.', rating: 5, title: 'Amazing sound quality!', body: 'Best earbuds I\'ve ever used. The ANC is incredible and battery life is as advertised.', verified: true, images: ['https://picsum.photos/seed/r1/200/200', 'https://picsum.photos/seed/r2/200/200'], createdAt: '2026-02-15' },
  { id: 'rev_02', author: 'Sarah M.', rating: 4, title: 'Great value for money', body: 'Very comfortable and good sound. Only minor issue is the case is a bit bulky.', verified: true, images: ['https://picsum.photos/seed/r3/200/200'], createdAt: '2026-02-12' },
  { id: 'rev_03', author: 'Mike R.', rating: 5, title: 'Perfect for workouts', body: 'These stay in my ears during intense workouts. Sweat resistant and great bass.', verified: false, images: [], createdAt: '2026-02-08' },
  { id: 'rev_04', author: 'Emily K.', rating: 3, title: 'Good but not great', body: 'Sound is decent but I expected more from the ANC. Battery life is excellent though.', verified: true, images: ['https://picsum.photos/seed/r4/200/200', 'https://picsum.photos/seed/r5/200/200', 'https://picsum.photos/seed/r6/200/200'], createdAt: '2026-01-30' },
];

export const MOCK_PRODUCT_SELLPAGES = [
  { id: 'sp_01', slug: 'wireless-earbuds-pro', sellerName: 'Alpha Dropship', status: 'PUBLISHED' as const, domain: 'bestbra.com', views: 4520, orders: 142, cr: 3.14 },
  { id: 'sp_02', slug: 'earbuds-deal', sellerName: 'Delta Deals', status: 'PUBLISHED' as const, domain: 'luxhome.co', views: 2180, orders: 56, cr: 2.57 },
  { id: 'sp_03', slug: 'earbuds-premium', sellerName: 'Beta Commerce', status: 'DRAFT' as const, domain: 'alphatech.store', views: 0, orders: 0, cr: 0 },
];

// ── Discounts (FB-15: +sellpageName) ────────────────────────────────────
export const MOCK_DISCOUNTS: MockDiscount[] = [
  {
    id: 'disc_01',
    code: 'LAUNCH20',
    type: 'PERCENT',
    value: 20,
    uses: 142,
    limit: 500,
    status: 'ACTIVE',
    sellpageName: null,
    expiresAt: '2026-03-31',
  },
  {
    id: 'disc_02',
    code: 'FLAT10',
    type: 'FIXED',
    value: 10,
    uses: 67,
    limit: null,
    status: 'ACTIVE',
    sellpageName: 'Wireless Earbuds Pro — bestbra.com',
    expiresAt: null,
  },
  {
    id: 'disc_03',
    code: 'VIP30',
    type: 'PERCENT',
    value: 30,
    uses: 89,
    limit: 100,
    status: 'EXPIRED',
    sellpageName: 'Smart Watch Deal — luxhome.co',
    expiresAt: '2026-01-31',
  },
  {
    id: 'disc_04',
    code: 'TESTCODE',
    type: 'FIXED',
    value: 5,
    uses: 3,
    limit: 10,
    status: 'DISABLED',
    sellpageName: null,
    expiresAt: null,
  },
];

// ── Admin Users (FB-20: +CONTENT role) ──────────────────────────────────
export const MOCK_ADMIN_USERS: MockAdminUser[] = [
  {
    id: 'usr_01',
    name: 'Alex Superadmin',
    email: 'alex@pixelxlab.com',
    role: 'SUPERADMIN',
    status: 'ACTIVE',
    lastLogin: '2026-02-22',
    createdAt: '2025-01-01',
  },
  {
    id: 'usr_02',
    name: 'Maria Support',
    email: 'maria@pixelxlab.com',
    role: 'SUPPORT',
    status: 'ACTIVE',
    lastLogin: '2026-02-21',
    createdAt: '2025-06-15',
  },
  {
    id: 'usr_03',
    name: 'David Finance',
    email: 'david@pixelxlab.com',
    role: 'FINANCE',
    status: 'INACTIVE',
    lastLogin: '2026-01-10',
    createdAt: '2025-09-01',
  },
  {
    id: 'usr_04',
    name: 'Linh Content',
    email: 'linh@pixelxlab.com',
    role: 'CONTENT',
    status: 'ACTIVE',
    lastLogin: '2026-02-22',
    createdAt: '2026-01-15',
  },
  {
    id: 'usr_05',
    name: 'Minh Content',
    email: 'minh@pixelxlab.com',
    role: 'CONTENT',
    status: 'ACTIVE',
    lastLogin: '2026-02-21',
    createdAt: '2026-02-01',
  },
];

// ── Payment Gateways (FB-13) ────────────────────────────────────────────
export const MOCK_PAYMENT_GATEWAYS: MockPaymentGateway[] = [
  {
    id: 'gw_01',
    name: 'Stripe Main',
    type: 'stripe',
    status: 'ACTIVE',
    environment: 'live',
    assignedSellers: ['Alpha Dropship', 'Delta Deals'],
    createdAt: '2025-06-01',
  },
  {
    id: 'gw_02',
<<<<<<< HEAD
    name: 'Stripe Test',
    type: 'stripe',
    status: 'ACTIVE',
    environment: 'sandbox',
=======
    name: 'Stripe Secondary',
    type: 'stripe',
    status: 'ACTIVE',
    environment: 'live',
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
    assignedSellers: ['Gamma Goods'],
    createdAt: '2025-06-01',
  },
  {
    id: 'gw_03',
    name: 'PayPal Business',
    type: 'paypal',
    status: 'ACTIVE',
    environment: 'live',
    assignedSellers: ['Beta Commerce'],
    createdAt: '2025-08-15',
  },
<<<<<<< HEAD
  {
    id: 'gw_04',
    name: 'PayPal Sandbox',
    type: 'paypal',
    status: 'INACTIVE',
    environment: 'sandbox',
    assignedSellers: [],
    createdAt: '2025-08-15',
  },
=======
>>>>>>> feature/2.4.2-alpha-ads-seed-v1
];

// ── Dashboard KPIs ────────────────────────────────────────────────────────
export const DASHBOARD_KPIS = {
  activeSellers: 3,
  pendingApprovals: 1,
  totalOrders: 1035,
  totalRevenue: 172700,
  avgRoas: 3.15,
  revenueByDay: [
    { date: '2026-02-16', revenue: 18200, orders: 48 },
    { date: '2026-02-17', revenue: 22500, orders: 61 },
    { date: '2026-02-18', revenue: 19800, orders: 52 },
    { date: '2026-02-19', revenue: 21300, orders: 58 },
    { date: '2026-02-20', revenue: 25100, orders: 68 },
    { date: '2026-02-21', revenue: 23700, orders: 64 },
    { date: '2026-02-22', revenue: 14900, orders: 39 },
  ],
  topSellers: [
    { name: 'Delta Deals', orders: 478, revenue: 61300, roas: 4.2 },
    { name: 'Alpha Dropship', orders: 342, revenue: 68400, roas: 3.8 },
    { name: 'Beta Commerce', orders: 215, revenue: 43000, roas: 2.9 },
  ],
};

// ── Analytics Data (FB-12: +productCost, paymentFee, profit) ────────────
export const ANALYTICS_DATA = {
  byDate: [
    { date: '2026-02-16', revenue: 18200, orders: 48, spend: 5200, productCost: 4800, paymentFee: 546, profit: 7654, roas: 3.5 },
    { date: '2026-02-17', revenue: 22500, orders: 61, spend: 6100, productCost: 5950, paymentFee: 675, profit: 9775, roas: 3.69 },
    { date: '2026-02-18', revenue: 19800, orders: 52, spend: 5800, productCost: 5200, paymentFee: 594, profit: 8206, roas: 3.41 },
    { date: '2026-02-19', revenue: 21300, orders: 58, spend: 6300, productCost: 5600, paymentFee: 639, profit: 8761, roas: 3.38 },
    { date: '2026-02-20', revenue: 25100, orders: 68, spend: 7200, productCost: 6600, paymentFee: 753, profit: 10547, roas: 3.49 },
    { date: '2026-02-21', revenue: 23700, orders: 64, spend: 6800, productCost: 6200, paymentFee: 711, profit: 9989, roas: 3.49 },
    { date: '2026-02-22', revenue: 14900, orders: 39, spend: 4100, productCost: 3800, paymentFee: 447, profit: 6553, roas: 3.63 },
  ],
  bySeller: [
    { name: 'Delta Deals', revenue: 61300, orders: 478, spend: 14600, roas: 4.2 },
    { name: 'Alpha Dropship', revenue: 68400, orders: 342, spend: 18000, roas: 3.8 },
    { name: 'Beta Commerce', revenue: 43000, orders: 215, spend: 14828, roas: 2.9 },
    { name: 'Gamma Goods', revenue: 5600, orders: 43, spend: 2000, roas: 2.8 },
  ],
  byProduct: [
    { name: 'Smart Watch Series 3', revenue: 25742, orders: 198, cr: 4.2 },
    { name: 'Wireless Earbuds Pro', revenue: 8519, orders: 142, cr: 3.8 },
    { name: 'Yoga Mat Premium', revenue: 7513, orders: 167, cr: 3.5 },
    { name: 'Portable Charger 20K', revenue: 4024, orders: 115, cr: 2.9 },
    { name: 'LED Desk Lamp', revenue: 2225, orders: 89, cr: 2.6 },
  ],
  byDomain: [
    { domain: 'luxhome.co', revenue: 61300, orders: 478, cr: 4.2 },
    { domain: 'bestbra.com', revenue: 38000, orders: 192, cr: 3.9 },
    { domain: 'alphagear.store', revenue: 30400, orders: 150, cr: 3.6 },
    { domain: 'alphatech.store', revenue: 43000, orders: 215, cr: 3.1 },
  ],
};

// ── Content Performance (FB-21 / CMO-04) ────────────────────────────────
export const CONTENT_PERFORMANCE_SELLPAGES: MockContentPerformanceSellpage[] = [
  { id: 'csp_01', name: 'Earbuds Pro Landing', slug: 'wireless-earbuds-pro', product: 'Wireless Earbuds Pro', status: 'PUBLISHED', views: 4520, orders: 142, cr: 3.14, revenue: 8519, createdAt: '2025-09-01' },
  { id: 'csp_02', name: 'Smart Watch Deal', slug: 'smart-watch-deal', product: 'Smart Watch Series 3', status: 'PUBLISHED', views: 6230, orders: 198, cr: 3.18, revenue: 25742, createdAt: '2025-08-10' },
  { id: 'csp_03', name: 'Yoga Mat Promo', slug: 'yoga-mat-promo', product: 'Yoga Mat Premium', status: 'PUBLISHED', views: 3180, orders: 89, cr: 2.80, revenue: 4004, createdAt: '2025-10-15' },
  { id: 'csp_04', name: 'Coffee Grinder Launch', slug: 'coffee-grinder-launch', product: 'Coffee Grinder Pro', status: 'DRAFT', views: 0, orders: 0, cr: 0, revenue: 0, createdAt: '2026-02-01' },
];

export const CONTENT_PERFORMANCE_CREATIVES: MockContentPerformanceCreative[] = [
  { id: 'ccr_01', name: 'Earbuds Video V1', type: 'VIDEO_AD', product: 'Wireless Earbuds Pro', status: 'READY', spend: 1240, clicks: 3800, ctr: 4.2, roas: 3.8, createdAt: '2025-09-05' },
  { id: 'ccr_02', name: 'Earbuds Image Set', type: 'IMAGE_AD', product: 'Wireless Earbuds Pro', status: 'READY', spend: 980, clicks: 2400, ctr: 3.1, roas: 4.1, createdAt: '2025-09-10' },
  { id: 'ccr_03', name: 'Watch UGC Bundle', type: 'UGC_BUNDLE', product: 'Smart Watch Series 3', status: 'READY', spend: 2800, clicks: 6200, ctr: 3.8, roas: 4.5, createdAt: '2025-08-20' },
  { id: 'ccr_04', name: 'Yoga Video V2', type: 'VIDEO_AD', product: 'Yoga Mat Premium', status: 'READY', spend: 650, clicks: 1800, ctr: 2.9, roas: 3.2, createdAt: '2025-11-01' },
  { id: 'ccr_05', name: 'Coffee Grinder Teaser', type: 'IMAGE_AD', product: 'Coffee Grinder Pro', status: 'DRAFT', spend: 0, clicks: 0, ctr: 0, roas: 0, createdAt: '2026-02-05' },
];
