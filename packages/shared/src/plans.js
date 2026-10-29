// Default limits per plan. A tenant or a single key can override them.
export const PLANS = Object.freeze({
    free: { rate: 5, burst: 10, monthlyQuota: 10_000 },
    pro: { rate: 50, burst: 100, monthlyQuota: 1_000_000 },
    enterprise: { rate: 500, burst: 1000, monthlyQuota: 50_000_000 },
  });
  
  /**
   * Effective limits = plan defaults, then tenant overrides, then key overrides.
   * Undefined/null fields in an override are ignored.
   */
  export function resolveLimits(plan, tenantLimits = {}, keyLimits = {}) {
    const base = PLANS[plan] ?? PLANS.free;
    const pick = (field) => keyLimits?.[field] ?? tenantLimits?.[field] ?? base[field];
    return { rate: pick('rate'), burst: pick('burst'), monthlyQuota: pick('monthlyQuota') };
  }