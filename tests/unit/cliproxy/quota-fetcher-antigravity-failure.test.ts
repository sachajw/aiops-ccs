import { describe, expect, it } from 'bun:test';

async function loadAntigravityQuotaTestExports() {
  const moduleId = Date.now() + Math.random();
  const mod = await import(`../../../src/cliproxy/quota-fetcher?agy-quota-fetcher=${moduleId}`);
  return mod.__testExports;
}

describe('Antigravity quota failure metadata', () => {
  it('marks 403 failures as not entitled', async () => {
    const { buildAntigravityFailure } = await loadAntigravityQuotaTestExports();

    const result = buildAntigravityFailure(403, 'forbidden');

    expect(result.entitlement).toMatchObject({
      accessState: 'not_entitled',
      capacityState: 'unknown',
    });
  });

  it('marks 429 failures as rate limited', async () => {
    const { buildAntigravityFailure } = await loadAntigravityQuotaTestExports();

    const result = buildAntigravityFailure(429, 'rate limited');

    expect(result.entitlement).toMatchObject({
      accessState: 'unknown',
      capacityState: 'rate_limited',
    });
  });
});
