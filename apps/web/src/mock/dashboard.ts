import { DashboardKpi } from './types';

export const mockDashboardKpi: DashboardKpi = {
  revenue: 23680.50,
  orders: 347,
  avgOrderValue: 68.24,
  conversionRate: 3.42,
  revenueDelta: 12.5,
  ordersDelta: 8.3,
  aovDelta: 3.9,
  conversionDelta: -0.8,
};

/** Revenue chart data — last 7 days */
export const mockRevenueChart = [
  { date: '2025-02-07', revenue: 2840, orders: 42 },
  { date: '2025-02-08', revenue: 3120, orders: 46 },
  { date: '2025-02-09', revenue: 2680, orders: 39 },
  { date: '2025-02-10', revenue: 3890, orders: 57 },
  { date: '2025-02-11', revenue: 4210, orders: 62 },
  { date: '2025-02-12', revenue: 3560, orders: 52 },
  { date: '2025-02-13', revenue: 3380, orders: 49 },
];

/** Top sellpages by revenue */
export const mockTopSellpages = [
  { slug: 'keto-burn-promo', revenue: 5680, orders: 83, conversion: 4.2 },
  { slug: 'slim-tea-summer-body', revenue: 4920, orders: 72, conversion: 3.8 },
  { slug: 'collagen-beauty-bundle', revenue: 3840, orders: 56, conversion: 3.5 },
  { slug: 'bright-smile-deal', revenue: 3210, orders: 47, conversion: 2.9 },
  { slug: 'dreamzzz-sleep-solution', revenue: 2460, orders: 36, conversion: 2.6 },
];

/** Recent orders for quick view */
export const mockRecentOrders = [
  { orderNumber: 'ORD-20250213-001', customer: 'Sarah Johnson', total: 99.90, status: 'DELIVERED' },
  { orderNumber: 'ORD-20250213-002', customer: 'Michael Chen', total: 194.97, status: 'SHIPPED' },
  { orderNumber: 'ORD-20250213-003', customer: 'Emma Williams', total: 44.99, status: 'CONFIRMED' },
  { orderNumber: 'ORD-20250212-001', customer: 'James Brown', total: 109.98, status: 'PROCESSING' },
  { orderNumber: 'ORD-20250212-002', customer: 'Lisa Martinez', total: 49.95, status: 'PENDING' },
];
