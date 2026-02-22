// ── Admin mock data (PREVIEW ONLY — no API calls) ──────────────────────────

export interface MockSeller {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'ACTIVE' | 'PENDING' | 'DEACTIVATED' | 'REJECTED';
  paymentGateway: 'stripe' | 'paypal' | null;
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
  status: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
  createdAt: string;
}

export interface MockStore {
  id: string;
  sellerId: string;
  sellerName: string;
  domain: string;
  status: 'ACTIVE' | 'PENDING' | 'INACTIVE';
  productCount: number;
  isDefault: boolean;
  createdAt: string;
}

export interface MockAdminProduct {
  id: string;
  sellerId: string;
  sellerName: string;
  name: string;
  sku: string;
  price: number;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  variants: number;
  orders: number;
  revenue: number;
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
  expiresAt: string | null;
}

export interface MockAdminUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPERADMIN' | 'SUPPORT' | 'FINANCE';
  status: 'ACTIVE' | 'INACTIVE';
  lastLogin: string;
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
    paymentGateway: 'stripe',
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
    paymentGateway: 'paypal',
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
    paymentGateway: null,
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
    paymentGateway: 'stripe',
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
    paymentGateway: 'stripe',
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
    paymentGateway: null,
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
    createdAt: '2026-02-22',
  },
];

// ── Stores / Domains ──────────────────────────────────────────────────────
export const MOCK_STORES: MockStore[] = [
  {
    id: 'str_01',
    sellerId: 'sel_01',
    sellerName: 'Alpha Dropship',
    domain: 'alpha-shop.pixelxlab.com',
    status: 'ACTIVE',
    productCount: 5,
    isDefault: true,
    createdAt: '2025-08-15',
  },
  {
    id: 'str_02',
    sellerId: 'sel_01',
    sellerName: 'Alpha Dropship',
    domain: 'alpha-gear.mystore.com',
    status: 'ACTIVE',
    productCount: 4,
    isDefault: false,
    createdAt: '2025-09-01',
  },
  {
    id: 'str_03',
    sellerId: 'sel_02',
    sellerName: 'Beta Commerce',
    domain: 'beta-tech.pixelxlab.com',
    status: 'ACTIVE',
    productCount: 8,
    isDefault: true,
    createdAt: '2025-09-22',
  },
  {
    id: 'str_04',
    sellerId: 'sel_04',
    sellerName: 'Delta Deals',
    domain: 'delta-deals.shop',
    status: 'ACTIVE',
    productCount: 12,
    isDefault: true,
    createdAt: '2025-07-03',
  },
  {
    id: 'str_05',
    sellerId: 'sel_03',
    sellerName: 'Gamma Goods',
    domain: 'gamma-preview.pixelxlab.com',
    status: 'PENDING',
    productCount: 4,
    isDefault: true,
    createdAt: '2026-01-10',
  },
];

// ── Products ──────────────────────────────────────────────────────────────
export const MOCK_ADMIN_PRODUCTS: MockAdminProduct[] = [
  {
    id: 'prd_01',
    sellerId: 'sel_01',
    sellerName: 'Alpha Dropship',
    name: 'Wireless Earbuds Pro',
    sku: 'WEP-001',
    price: 59.99,
    status: 'ACTIVE',
    variants: 3,
    orders: 142,
    revenue: 8519,
    createdAt: '2025-08-20',
  },
  {
    id: 'prd_02',
    sellerId: 'sel_01',
    sellerName: 'Alpha Dropship',
    name: 'LED Desk Lamp',
    sku: 'LDL-002',
    price: 24.99,
    status: 'ACTIVE',
    variants: 2,
    orders: 89,
    revenue: 2225,
    createdAt: '2025-09-05',
  },
  {
    id: 'prd_03',
    sellerId: 'sel_02',
    sellerName: 'Beta Commerce',
    name: 'Portable Charger 20K',
    sku: 'PC20-001',
    price: 34.99,
    status: 'ACTIVE',
    variants: 1,
    orders: 115,
    revenue: 4024,
    createdAt: '2025-10-01',
  },
  {
    id: 'prd_04',
    sellerId: 'sel_04',
    sellerName: 'Delta Deals',
    name: 'Smart Watch Series 3',
    sku: 'SW3-001',
    price: 129.99,
    status: 'ACTIVE',
    variants: 4,
    orders: 198,
    revenue: 25742,
    createdAt: '2025-07-10',
  },
  {
    id: 'prd_05',
    sellerId: 'sel_04',
    sellerName: 'Delta Deals',
    name: 'Yoga Mat Premium',
    sku: 'YMP-001',
    price: 44.99,
    status: 'ACTIVE',
    variants: 3,
    orders: 167,
    revenue: 7513,
    createdAt: '2025-07-15',
  },
  {
    id: 'prd_06',
    sellerId: 'sel_02',
    sellerName: 'Beta Commerce',
    name: 'Coffee Grinder Pro',
    sku: 'CGP-001',
    price: 79.99,
    status: 'DRAFT',
    variants: 2,
    orders: 0,
    revenue: 0,
    createdAt: '2025-12-01',
  },
  {
    id: 'prd_07',
    sellerId: 'sel_03',
    sellerName: 'Gamma Goods',
    name: 'Bamboo Cutting Board',
    sku: 'BCB-001',
    price: 32.99,
    status: 'ACTIVE',
    variants: 1,
    orders: 43,
    revenue: 1419,
    createdAt: '2026-01-15',
  },
  {
    id: 'prd_08',
    sellerId: 'sel_05',
    sellerName: 'Epsilon Shop',
    name: 'Resistance Bands Set',
    sku: 'RBS-001',
    price: 19.99,
    status: 'ARCHIVED',
    variants: 2,
    orders: 28,
    revenue: 560,
    createdAt: '2025-11-05',
  },
];

// ── Discounts ─────────────────────────────────────────────────────────────
export const MOCK_DISCOUNTS: MockDiscount[] = [
  {
    id: 'disc_01',
    code: 'LAUNCH20',
    type: 'PERCENT',
    value: 20,
    uses: 142,
    limit: 500,
    status: 'ACTIVE',
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
    expiresAt: null,
  },
];

// ── Admin Users ───────────────────────────────────────────────────────────
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

// ── Analytics Data ────────────────────────────────────────────────────────
export const ANALYTICS_DATA = {
  byDate: [
    { date: '2026-02-16', revenue: 18200, orders: 48, spend: 5200, roas: 3.5 },
    { date: '2026-02-17', revenue: 22500, orders: 61, spend: 6100, roas: 3.69 },
    { date: '2026-02-18', revenue: 19800, orders: 52, spend: 5800, roas: 3.41 },
    { date: '2026-02-19', revenue: 21300, orders: 58, spend: 6300, roas: 3.38 },
    { date: '2026-02-20', revenue: 25100, orders: 68, spend: 7200, roas: 3.49 },
    { date: '2026-02-21', revenue: 23700, orders: 64, spend: 6800, roas: 3.49 },
    { date: '2026-02-22', revenue: 14900, orders: 39, spend: 4100, roas: 3.63 },
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
    { domain: 'delta-deals.shop', revenue: 61300, orders: 478, cr: 4.2 },
    { domain: 'alpha-shop.pixelxlab.com', revenue: 38000, orders: 192, cr: 3.9 },
    { domain: 'alpha-gear.mystore.com', revenue: 30400, orders: 150, cr: 3.6 },
    { domain: 'beta-tech.pixelxlab.com', revenue: 43000, orders: 215, cr: 3.1 },
  ],
};
