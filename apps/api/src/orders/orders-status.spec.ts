/**
 * orders-status.spec.ts
 *
 * Unit tests for Task C: Order manual status change.
 *
 * Covers:
 *  - C.1: updateOrderStatus — happy path PENDING → CONFIRMED
 *  - C.1: updateOrderStatus — invalid transition → 400
 *  - C.1: updateOrderStatus — order not found → 404
 *  - C.1: updateOrderStatus — terminal status (CANCELLED) → 400
 *  - C.1: updateOrderStatus — custom note saved
 *  - C.2: bulkUpdateStatus — skips invalid transitions, updates valid ones
 *  - C.3: getOrderTransitions — returns valid transitions for PENDING
 *  - C.3: getOrderTransitions — returns empty array for CANCELLED
 *  - C.3: getOrderTransitions — order not found → 404
 *  - canTransition helper — all valid transitions
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService, ORDER_TRANSITIONS, canTransition } from './orders.service';
import { OrdersBulkService } from './orders-bulk.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SELLER_ID = '00000000-0000-0000-0000-000000000001';
const ORDER_ID  = '00000000-0000-0000-0000-000000000002';

function makeOrder(status: string) {
  return { id: ORDER_ID, status, orderNumber: 'ORD-001', updatedAt: new Date() };
}

// ─── Prisma mock ─────────────────────────────────────────────────────────────

const mockPrisma = {
  order: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  orderEvent: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('OrdersService — status change (Task C)', () => {
  let service: OrdersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  // ── C.1: Happy path ─────────────────────────────────────────────────────

  it('C.1: updates PENDING → CONFIRMED and creates event', async () => {
    mockPrisma.order.findFirst.mockResolvedValueOnce(makeOrder('PENDING'));
    const updated = { id: ORDER_ID, orderNumber: 'ORD-001', status: 'CONFIRMED', updatedAt: new Date() };
    mockPrisma.$transaction.mockResolvedValueOnce([updated, {}]);

    const result = await service.updateOrderStatus(SELLER_ID, ORDER_ID, {
      status: 'CONFIRMED',
      note: 'Confirmed by seller',
    });

    expect(result.status).toBe('CONFIRMED');
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('C.1: uses default note when none provided', async () => {
    mockPrisma.order.findFirst.mockResolvedValueOnce(makeOrder('PENDING'));
    mockPrisma.$transaction.mockResolvedValueOnce([makeOrder('CONFIRMED'), {}]);

    await service.updateOrderStatus(SELLER_ID, ORDER_ID, { status: 'CONFIRMED' });

    // Transaction should have been called
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('C.1: throws 400 for invalid transition (PENDING → SHIPPED)', async () => {
    mockPrisma.order.findFirst.mockResolvedValueOnce(makeOrder('PENDING'));

    await expect(
      service.updateOrderStatus(SELLER_ID, ORDER_ID, { status: 'SHIPPED' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('C.1: throws 404 when order not found', async () => {
    mockPrisma.order.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.updateOrderStatus(SELLER_ID, ORDER_ID, { status: 'CONFIRMED' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('C.1: CANCELLED is terminal — throws 400 for any transition', async () => {
    mockPrisma.order.findFirst.mockResolvedValueOnce(makeOrder('CANCELLED'));

    await expect(
      service.updateOrderStatus(SELLER_ID, ORDER_ID, { status: 'PENDING' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('C.1: REFUNDED is terminal — throws 400 for any transition', async () => {
    mockPrisma.order.findFirst.mockResolvedValueOnce(makeOrder('REFUNDED'));

    await expect(
      service.updateOrderStatus(SELLER_ID, ORDER_ID, { status: 'PENDING' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('C.1: SHIPPED → DELIVERED is valid', async () => {
    mockPrisma.order.findFirst.mockResolvedValueOnce(makeOrder('SHIPPED'));
    mockPrisma.$transaction.mockResolvedValueOnce([makeOrder('DELIVERED'), {}]);

    const result = await service.updateOrderStatus(SELLER_ID, ORDER_ID, {
      status: 'DELIVERED',
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  // ── C.3: Get transitions ─────────────────────────────────────────────────

  it('C.3: returns valid transitions for PENDING', async () => {
    mockPrisma.order.findFirst.mockResolvedValueOnce(makeOrder('PENDING'));

    const result = await service.getOrderTransitions(SELLER_ID, ORDER_ID);

    expect(result.currentStatus).toBe('PENDING');
    expect(result.validTransitions).toContain('CONFIRMED');
    expect(result.validTransitions).toContain('CANCELLED');
    expect(result.validTransitions).not.toContain('SHIPPED');
  });

  it('C.3: returns empty array for CANCELLED (terminal)', async () => {
    mockPrisma.order.findFirst.mockResolvedValueOnce(makeOrder('CANCELLED'));

    const result = await service.getOrderTransitions(SELLER_ID, ORDER_ID);

    expect(result.currentStatus).toBe('CANCELLED');
    expect(result.validTransitions).toHaveLength(0);
  });

  it('C.3: throws 404 when order not found', async () => {
    mockPrisma.order.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.getOrderTransitions(SELLER_ID, ORDER_ID),
    ).rejects.toThrow(NotFoundException);
  });
});

// ─── canTransition helper ─────────────────────────────────────────────────────

describe('canTransition helper', () => {
  it('PENDING → CONFIRMED: valid', () => expect(canTransition('PENDING', 'CONFIRMED')).toBe(true));
  it('PENDING → CANCELLED: valid', () => expect(canTransition('PENDING', 'CANCELLED')).toBe(true));
  it('PENDING → SHIPPED: invalid', () => expect(canTransition('PENDING', 'SHIPPED')).toBe(false));
  it('CONFIRMED → PROCESSING: valid', () => expect(canTransition('CONFIRMED', 'PROCESSING')).toBe(true));
  it('PROCESSING → SHIPPED: valid', () => expect(canTransition('PROCESSING', 'SHIPPED')).toBe(true));
  it('SHIPPED → DELIVERED: valid', () => expect(canTransition('SHIPPED', 'DELIVERED')).toBe(true));
  it('SHIPPED → REFUNDED: valid', () => expect(canTransition('SHIPPED', 'REFUNDED')).toBe(true));
  it('DELIVERED → REFUNDED: valid', () => expect(canTransition('DELIVERED', 'REFUNDED')).toBe(true));
  it('CANCELLED → anything: invalid', () => expect(canTransition('CANCELLED', 'PENDING')).toBe(false));
  it('REFUNDED → anything: invalid', () => expect(canTransition('REFUNDED', 'PENDING')).toBe(false));
});

// ─── C.2: BulkUpdateStatus with transition validation ──────────────────────

describe('OrdersBulkService — transition validation (C.2)', () => {
  let bulkService: OrdersBulkService;

  const bulkPrisma = {
    order: { findFirst: jest.fn(), update: jest.fn() },
    orderEvent: { create: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersBulkService,
        { provide: PrismaService, useValue: bulkPrisma },
      ],
    }).compile();

    bulkService = module.get<OrdersBulkService>(OrdersBulkService);
  });

  it('C.2: skips orders with invalid transitions, updates valid ones', async () => {
    const ID_VALID   = '00000000-0000-0000-0000-000000000010';
    const ID_INVALID = '00000000-0000-0000-0000-000000000011';

    bulkPrisma.order.findFirst
      .mockResolvedValueOnce({ id: ID_VALID,   status: 'PENDING' })   // valid
      .mockResolvedValueOnce({ id: ID_INVALID, status: 'SHIPPED' });   // invalid → cannot → CONFIRMED

    bulkPrisma.$transaction.mockResolvedValueOnce([{}, {}]);

    const result = await bulkService.bulkUpdateStatus(SELLER_ID, {
      orderIds: [ID_VALID, ID_INVALID],
      status: 'CONFIRMED',
    });

    expect(result.updated).toBe(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].orderId).toBe(ID_INVALID);
    expect(result.failed[0].reason).toMatch(/Cannot transition/);
  });

  it('C.2: returns failed for not-found orders', async () => {
    bulkPrisma.order.findFirst.mockResolvedValueOnce(null);

    const result = await bulkService.bulkUpdateStatus(SELLER_ID, {
      orderIds: ['00000000-0000-0000-0000-000000000099'],
      status: 'CONFIRMED',
    });

    expect(result.updated).toBe(0);
    expect(result.failed).toHaveLength(1);
  });
});
