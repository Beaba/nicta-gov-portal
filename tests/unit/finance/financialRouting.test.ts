import { describe, it, expect } from 'vitest';
import { resolveFinancialRouting } from '@/lib/finance/financialRouting';

// #A32 — financial routing reads the FinancialApprovalRule table (seeded with the client's 3
// initial tiers), never hard-coded thresholds. Confirms the seeded configuration resolves
// correctly and that an amount outside every configured rule fails closed (no rule => no silent
// approval path).
describe('financialRouting — resolveFinancialRouting', () => {
  it('routes a small amount to the Director-only tier', async () => {
    const result = await resolveFinancialRouting(25000);
    expect(result.rule?.label).toBe('Up to K50,000');
    expect(result.requiresCeoApproval).toBe(false);
  });

  it('routes an amount above K50,000 to require CEO approval', async () => {
    const result = await resolveFinancialRouting(250000);
    expect(result.rule?.label).toBe('Above K50,000 up to K1,000,000');
    expect(result.requiresCeoApproval).toBe(true);
    expect(result.requiresBoardApproval).toBe(false);
  });

  it('routes an amount above K1,000,000 to require Board approval', async () => {
    const result = await resolveFinancialRouting(2500000);
    expect(result.rule?.label).toBe('Above K1,000,000');
    expect(result.requiresBoardApproval).toBe(true);
  });

  it('fails closed (no rule) for an amount with no active configuration, rather than silently approving', async () => {
    const result = await resolveFinancialRouting(-1);
    expect(result.rule).toBeNull();
    expect(result.requiresCeoApproval).toBe(false);
    expect(result.requiresBoardApproval).toBe(false);
  });
});
