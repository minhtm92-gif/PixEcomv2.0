/**
 * Alpha Seed v2 Verify — PixEcom v2 (Milestone 2.4.1)
 *
 * Prints a counts table per seller for all alpha_seed_v2 seeded entities.
 * Use after running seed.alpha.ts to confirm the data is present.
 *
 * Does NOT require staging guard — safe to run anywhere (read-only).
 *
 * Run:
 *   pnpm --filter @pixecom/database seed:alpha:verify
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SELLER_IDS = {
  'Alpha Store One (alpha1@pixecom.io)': '00000000-A100-0001-0002-000000000001',
  'Alpha Store Two (alpha2@pixecom.io)': '00000000-A200-0001-0002-000000000001',
};

async function main() {
  console.log('\n🔍 Alpha Seed v2 Verify\n');

  let allGood = true;

  for (const [label, sellerId] of Object.entries(SELLER_IDS)) {
    console.log(`\n  ┌─ ${label}`);
    console.log(`  │  Seller ID: ${sellerId}`);

    // Seller exists?
    const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
    if (!seller) {
      console.log('  │  ❌ SELLER NOT FOUND — run: APP_ENV=staging pnpm seed:alpha');
      allGood = false;
      continue;
    }

    // Counts
    const [
      domains, publishedSP, draftSP, totalSP,
      deliveredOrd, shippedOrd, confirmedOrd, cancelledOrd, refundedOrd, totalOrd,
      totalItems, totalEvents,
    ] = await Promise.all([
      prisma.sellerDomain.count({ where: { sellerId } }),
      prisma.sellpage.count({ where: { sellerId, status: 'PUBLISHED' } }),
      prisma.sellpage.count({ where: { sellerId, status: 'DRAFT' } }),
      prisma.sellpage.count({ where: { sellerId } }),
      prisma.order.count({ where: { sellerId, status: 'DELIVERED' } }),
      prisma.order.count({ where: { sellerId, status: 'SHIPPED' } }),
      prisma.order.count({ where: { sellerId, status: 'CONFIRMED' } }),
      prisma.order.count({ where: { sellerId, status: 'CANCELLED' } }),
      prisma.order.count({ where: { sellerId, status: 'REFUNDED' } }),
      prisma.order.count({ where: { sellerId } }),
      prisma.orderItem.count({ where: { order: { sellerId } } }),
      prisma.orderEvent.count({ where: { sellerId } }),
    ]);

    // Domain verification
    const domain = await prisma.sellerDomain.findFirst({ where: { sellerId } });
    const domainStatus = domain ? `${domain.hostname} [${domain.status}${domain.isPrimary ? ', PRIMARY' : ''}]` : 'NONE';

    // Check expected totals
    const checks: Array<[string, number, number, boolean]> = [
      ['Domains',          domains,       1,   domains >= 1],
      ['Domains VERIFIED', domain?.status === 'VERIFIED' ? 1 : 0, 1, domain?.status === 'VERIFIED'],
      ['Sellpages total',  totalSP,       4,   totalSP === 4],
      ['Sellpages PUBLISHED', publishedSP, 2,  publishedSP === 2],
      ['Sellpages DRAFT',  draftSP,       2,   draftSP === 2],
      ['Orders total',     totalOrd,      120, totalOrd === 120],
      ['  DELIVERED',      deliveredOrd,  -1,  deliveredOrd > 0],
      ['  SHIPPED',        shippedOrd,    -1,  shippedOrd > 0],
      ['  CONFIRMED',      confirmedOrd,  -1,  confirmedOrd > 0],
      ['  CANCELLED',      cancelledOrd,  -1,  cancelledOrd > 0],
      ['  REFUNDED',       refundedOrd,   -1,  refundedOrd > 0],
      ['Order Items',      totalItems,    -1,  totalItems >= 120],
      ['Order Events',     totalEvents,   -1,  totalEvents >= 120],
    ];

    for (const [name, actual, expected, ok] of checks) {
      const icon = ok ? '✅' : '❌';
      const exp  = expected >= 0 ? ` (expected ${expected})` : '';
      console.log(`  │  ${icon} ${name.padEnd(22)} ${actual}${exp}`);
      if (!ok) allGood = false;
    }

    // Domain detail
    console.log(`  │     Domain: ${domainStatus}`);

    // Order financial spot-check (first order)
    const sampleOrder = await prisma.order.findFirst({
      where: { sellerId },
      include: { items: true, events: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });

    if (sampleOrder) {
      const calcSubtotal = sampleOrder.items.reduce(
        (s, it) => s + Number(it.lineTotal), 0,
      );
      const calcTotal = calcSubtotal
        + Number(sampleOrder.shippingCost)
        + Number(sampleOrder.taxAmount)
        - Number(sampleOrder.discountAmount);

      const subtotalMatch = Math.abs(calcSubtotal - Number(sampleOrder.subtotal)) < 0.02;
      const totalMatch    = Math.abs(calcTotal - Number(sampleOrder.total)) < 0.02;

      console.log(`  │  ${subtotalMatch ? '✅' : '❌'} Sample order subtotal math: items=${calcSubtotal.toFixed(2)}, stored=${Number(sampleOrder.subtotal).toFixed(2)}`);
      console.log(`  │  ${totalMatch    ? '✅' : '❌'} Sample order total math:    calc=${calcTotal.toFixed(2)}, stored=${Number(sampleOrder.total).toFixed(2)}`);
      console.log(`  │     Events on sample order: ${sampleOrder.events.map((e) => e.eventType).join(' → ')}`);

      if (!subtotalMatch || !totalMatch) allGood = false;
    }

    console.log(`  └─ ${seller.name} OK`);
  }

  console.log('\n' + '─'.repeat(60));
  if (allGood) {
    console.log('  ✅ All checks passed — alpha_seed_v2 data is complete.\n');
    process.exit(0);
  } else {
    console.log('  ❌ Some checks FAILED. Re-run: APP_ENV=staging pnpm seed:alpha\n');
    process.exit(1);
  }
}

main()
  .catch((e) => { console.error('❌ Verify failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
