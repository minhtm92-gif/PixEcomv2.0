/**
 * cart-tracker.processor.ts
 *
 * BullMQ job handler for the "pixecom-cart-tracker" queue.
 * Runs every 5 minutes (repeatable).
 *
 * 1. Detect cart abandonment  (add_to_cart with no checkout/purchase within 1h)
 * 2. Detect checkout abandonment (checkout with no purchase within 30min)
 * 3. Recover completed carts (purchase event found after abandonment)
 * 4. Expire old carts past their expiry window
 *
 * Error handling is per-item: one bad session does not abort the run.
 */

import { PrismaClient } from '@pixecom/database';
import type { Job } from 'bullmq';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartEventRow {
  session_id: string;
  seller_id: string;
  event_time: Date;
  product_id: string | null;
  variant_id: string | null;
  value: string | null;
  quantity: number | null;
}

interface RecoveryRow {
  id: string;
  session_id: string;
}

// ─── Processor ────────────────────────────────────────────────────────────────

export async function cartTrackerProcessor(
  job: Job,
  prisma: PrismaClient,
): Promise<void> {
  const logger = {
    log: (msg: string) => console.log(`[CartTrackerProcessor][Job ${job.id}] ${msg}`),
    error: (msg: string, err?: unknown) =>
      console.error(`[CartTrackerProcessor][Job ${job.id}] ${msg}`, err ?? ''),
  };

  logger.log('Starting cart abandonment detection');

  const now = new Date();
  let cartAbandoned = 0;
  let checkoutAbandoned = 0;
  let recovered = 0;
  let expired = 0;

  try {
    // ── 1. Detect cart abandonment ─────────────────────────────────────────
    // add_to_cart events older than 1 hour but within 72 hours,
    // where the same session has no subsequent checkout or purchase

    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    try {
      const cartEvents = await prisma.$queryRawUnsafe<CartEventRow[]>(
        `SELECT DISTINCT ON (e.session_id)
          e.session_id,
          e.seller_id,
          e.created_at AS event_time,
          e.product_id,
          e.variant_id,
          e.value,
          e.quantity
        FROM storefront_events e
        WHERE e.event_type = 'add_to_cart'
          AND e.session_id IS NOT NULL
          AND e.created_at < $1
          AND e.created_at > $2
          AND NOT EXISTS (
            SELECT 1 FROM storefront_events e2
            WHERE e2.session_id = e.session_id
              AND e2.event_type IN ('checkout', 'purchase')
              AND e2.created_at > e.created_at
          )
          AND NOT EXISTS (
            SELECT 1 FROM abandoned_carts ac
            WHERE ac.session_id = e.session_id
              AND ac.stage = 'cart'
          )
        ORDER BY e.session_id, e.created_at DESC`,
        oneHourAgo,
        seventyTwoHoursAgo,
      );

      for (const event of cartEvents) {
        try {
          // Build items array from all add_to_cart events for this session
          const sessionItems = await prisma.$queryRawUnsafe<CartEventRow[]>(
            `SELECT product_id, variant_id, value, quantity
             FROM storefront_events
             WHERE session_id = $1 AND event_type = 'add_to_cart'
             ORDER BY created_at ASC`,
            event.session_id,
          );

          const items = sessionItems.map((item) => ({
            productId: item.product_id,
            variantId: item.variant_id,
            value: item.value ? parseFloat(item.value) : 0,
            quantity: item.quantity ?? 1,
          }));

          const totalValue = items.reduce((sum, i) => sum + i.value * i.quantity, 0);
          const abandonedAt = event.event_time;
          const expiresAt = new Date(abandonedAt.getTime() + 96 * 60 * 60 * 1000); // +96 hours

          await prisma.abandonedCart.create({
            data: {
              sellerId: event.seller_id,
              sessionId: event.session_id,
              stage: 'cart',
              items: JSON.parse(JSON.stringify(items)),
              totalValue,
              abandonedAt,
              expiresAt,
            },
          });

          cartAbandoned++;
        } catch (itemErr) {
          logger.error(`Failed to create cart abandonment for session ${event.session_id}`, itemErr);
        }
      }
    } catch (err) {
      logger.error('Cart abandonment detection query failed', err);
    }

    // ── 2. Detect checkout abandonment ─────────────────────────────────────
    // checkout events older than 30 minutes but within 72 hours,
    // where the same session has no subsequent purchase

    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

    try {
      const checkoutEvents = await prisma.$queryRawUnsafe<CartEventRow[]>(
        `SELECT DISTINCT ON (e.session_id)
          e.session_id,
          e.seller_id,
          e.created_at AS event_time,
          e.product_id,
          e.variant_id,
          e.value,
          e.quantity
        FROM storefront_events e
        WHERE e.event_type = 'checkout'
          AND e.session_id IS NOT NULL
          AND e.created_at < $1
          AND e.created_at > $2
          AND NOT EXISTS (
            SELECT 1 FROM storefront_events e2
            WHERE e2.session_id = e.session_id
              AND e2.event_type = 'purchase'
              AND e2.created_at > e.created_at
          )
          AND NOT EXISTS (
            SELECT 1 FROM abandoned_carts ac
            WHERE ac.session_id = e.session_id
              AND ac.stage = 'checkout'
          )
        ORDER BY e.session_id, e.created_at DESC`,
        thirtyMinAgo,
        seventyTwoHoursAgo,
      );

      for (const event of checkoutEvents) {
        try {
          // Build items array from add_to_cart events for this session
          const sessionItems = await prisma.$queryRawUnsafe<CartEventRow[]>(
            `SELECT product_id, variant_id, value, quantity
             FROM storefront_events
             WHERE session_id = $1 AND event_type = 'add_to_cart'
             ORDER BY created_at ASC`,
            event.session_id,
          );

          const items = sessionItems.map((item) => ({
            productId: item.product_id,
            variantId: item.variant_id,
            value: item.value ? parseFloat(item.value) : 0,
            quantity: item.quantity ?? 1,
          }));

          const totalValue = items.reduce((sum, i) => sum + i.value * i.quantity, 0);
          const abandonedAt = event.event_time;
          const expiresAt = new Date(abandonedAt.getTime() + 72 * 60 * 60 * 1000); // +72 hours

          await prisma.abandonedCart.create({
            data: {
              sellerId: event.seller_id,
              sessionId: event.session_id,
              stage: 'checkout',
              items: JSON.parse(JSON.stringify(items)),
              totalValue,
              abandonedAt,
              expiresAt,
            },
          });

          checkoutAbandoned++;
        } catch (itemErr) {
          logger.error(
            `Failed to create checkout abandonment for session ${event.session_id}`,
            itemErr,
          );
        }
      }
    } catch (err) {
      logger.error('Checkout abandonment detection query failed', err);
    }

    // ── 3. Recover completed carts ─────────────────────────────────────────
    // AbandonedCarts where a purchase event now exists for the same session

    try {
      const recoverableCarts = await prisma.$queryRawUnsafe<RecoveryRow[]>(
        `SELECT ac.id, ac.session_id
         FROM abandoned_carts ac
         WHERE ac.recovered_at IS NULL
           AND ac.expires_at > $1
           AND EXISTS (
             SELECT 1 FROM storefront_events e
             WHERE e.session_id = ac.session_id
               AND e.event_type = 'purchase'
               AND e.created_at > ac.abandoned_at
           )`,
        now,
      );

      for (const cart of recoverableCarts) {
        try {
          await prisma.abandonedCart.update({
            where: { id: cart.id },
            data: {
              recoveredAt: new Date(),
            },
          });
          recovered++;
        } catch (recoverErr) {
          logger.error(`Failed to recover cart ${cart.id}`, recoverErr);
        }
      }
    } catch (err) {
      logger.error('Cart recovery detection query failed', err);
    }

    // ── 4. Expire old carts ────────────────────────────────────────────────
    // AbandonedCarts past their expiresAt with no recovery

    try {
      const expiredCarts = await prisma.abandonedCart.findMany({
        where: {
          expiresAt: { lt: now },
          recoveredAt: null,
        },
        select: { id: true, sessionId: true, sellerId: true },
      });

      for (const cart of expiredCarts) {
        try {
          // Cancel any pending EmailJob for this cart's session
          await prisma.emailJob.updateMany({
            where: {
              sellerId: cart.sellerId,
              status: 'QUEUED',
              flowId: {
                in: [
                  'cart_recovery_1',
                  'cart_recovery_2',
                  'cart_recovery_3',
                  'checkout_recovery_1',
                  'checkout_recovery_2',
                  'checkout_recovery_3',
                ],
              },
              // Match via variables JSON — the session is embedded in variables
              variables: {
                path: ['session_id'],
                equals: cart.sessionId,
              },
            },
            data: { status: 'CANCELLED' },
          });

          // Delete the expired cart record (or we could keep it for analytics)
          // For now, we keep the record — it's already expired by expiresAt
          expired++;
        } catch (expireErr) {
          logger.error(`Failed to expire cart ${cart.id}`, expireErr);
        }
      }
    } catch (err) {
      logger.error('Cart expiration query failed', err);
    }

    logger.log(
      `Cart tracking complete. Abandoned carts: ${cartAbandoned}, Abandoned checkouts: ${checkoutAbandoned}, Recovered: ${recovered}, Expired: ${expired}`,
    );
  } catch (err) {
    logger.error('Cart tracker failed', err);
    throw err; // Let BullMQ mark the job as failed
  }
}
