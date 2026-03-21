import { MetaRateLimiter } from './meta-rate-limiter';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MetaRateLimiter', () => {
  let limiter: MetaRateLimiter;

  beforeEach(() => {
    limiter = new MetaRateLimiter();
  });

  // ── Under limit ────────────────────────────────────────────────────────────

  it('allows first call for a new account', () => {
    expect(() => limiter.checkLimit('act_111')).not.toThrow();
  });

  it('allows up to 200 calls without throwing', () => {
    const accountId = 'act_200';
    expect(() => {
      for (let i = 0; i < 200; i++) {
        limiter.checkLimit(accountId);
      }
    }).not.toThrow();
  });

  it('getStatus returns 200 remaining for a fresh account', () => {
    const status = limiter.getStatus('act_fresh');
    expect(status.remaining).toBe(200);
    expect(status.resetAt).toBeNull();
  });

  it('getStatus decrements remaining after calls', () => {
    const accountId = 'act_stat';
    limiter.checkLimit(accountId);
    limiter.checkLimit(accountId);
    const status = limiter.getStatus(accountId);
    expect(status.remaining).toBe(198);
    expect(status.resetAt).not.toBeNull();
  });

  // ── Over limit ─────────────────────────────────────────────────────────────

  it('throws 429 HttpException on the 201st call', () => {
    const accountId = 'act_over';
    // Use up the quota
    for (let i = 0; i < 200; i++) {
      limiter.checkLimit(accountId);
    }
    // 201st should throw
    expect(() => limiter.checkLimit(accountId)).toThrow();
  });

  it('thrown exception has status 429', () => {
    const accountId = 'act_429';
    for (let i = 0; i < 200; i++) {
      limiter.checkLimit(accountId);
    }
    try {
      limiter.checkLimit(accountId);
      fail('Expected exception to be thrown');
    } catch (err: unknown) {
      expect((err as { getStatus?: () => number }).getStatus?.()).toBe(429);
    }
  });

  it('thrown exception body contains retryAfter > 0', () => {
    const accountId = 'act_retry';
    for (let i = 0; i < 200; i++) {
      limiter.checkLimit(accountId);
    }
    try {
      limiter.checkLimit(accountId);
      fail('Expected exception to be thrown');
    } catch (err: unknown) {
      const body = (err as { getResponse?: () => unknown }).getResponse?.() as { retryAfter?: number } | undefined;
      expect(body?.retryAfter).toBeGreaterThan(0);
    }
  });

  // ── Isolation ──────────────────────────────────────────────────────────────

  it('different accounts have independent counters', () => {
    const a = 'act_a';
    const b = 'act_b';
    // Exhaust account A
    for (let i = 0; i < 200; i++) {
      limiter.checkLimit(a);
    }
    expect(() => limiter.checkLimit(a)).toThrow();
    // Account B is unaffected
    expect(() => limiter.checkLimit(b)).not.toThrow();
  });

  // ── Reset ──────────────────────────────────────────────────────────────────

  it('reset() clears the counter so calls are allowed again', () => {
    const accountId = 'act_reset';
    for (let i = 0; i < 200; i++) {
      limiter.checkLimit(accountId);
    }
    expect(() => limiter.checkLimit(accountId)).toThrow();

    limiter.reset(accountId);

    expect(() => limiter.checkLimit(accountId)).not.toThrow();
    expect(limiter.getStatus(accountId).remaining).toBe(199);
  });

  // ── Window expiry ──────────────────────────────────────────────────────────

  it('counter resets automatically after the window expires', () => {
    const accountId = 'act_window';

    // Manually inject an expired entry by accessing the private store
    // (cast to any to bypass TypeScript private access)
    const store = (limiter as unknown as { store: Map<string, { count: number; resetAt: number }> }).store;
    store.set(accountId, { count: 200, resetAt: Date.now() - 1 }); // already expired

    // Should be allowed again since window has passed
    expect(() => limiter.checkLimit(accountId)).not.toThrow();
  });
});
