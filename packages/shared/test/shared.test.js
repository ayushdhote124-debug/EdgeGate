import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey, looksLikeApiKey, KEY_PREFIX } from '../src/apiKeys.js';
import { GatewayError, errorBody } from '../src/errors.js';
import { resolveLimits, PLANS } from '../src/plans.js';

describe('api keys', () => {
  it('generates keys in the expected format', () => {
    const { rawKey, keyHash, prefix } = generateApiKey();
    expect(rawKey.startsWith(KEY_PREFIX)).toBe(true);
    expect(rawKey).toHaveLength(KEY_PREFIX.length + 32);
    expect(looksLikeApiKey(rawKey)).toBe(true);
    expect(prefix).toBe(rawKey.slice(0, 12));
    expect(keyHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashes deterministically and never returns the raw key', () => {
    const { rawKey, keyHash } = generateApiKey();
    expect(hashApiKey(rawKey)).toBe(keyHash);
    expect(keyHash).not.toContain(rawKey.slice(KEY_PREFIX.length));
  });

  it('produces unique keys', () => {
    const keys = new Set(Array.from({ length: 1000 }, () => generateApiKey().rawKey));
    expect(keys.size).toBe(1000);
  });

  it('rejects malformed keys', () => {
    expect(looksLikeApiKey(undefined)).toBe(false);
    expect(looksLikeApiKey('eg_live_short')).toBe(false);
    expect(looksLikeApiKey('xx_live_' + 'a'.repeat(32))).toBe(false);
    expect(looksLikeApiKey(KEY_PREFIX + '!'.repeat(32))).toBe(false);
  });
});

describe('errors', () => {
  it('maps codes to status and the standard body', () => {
    const err = new GatewayError('RATE_LIMITED', { message: 'Limit is 5 req/s', headers: { 'Retry-After': '1' } });
    expect(err.status).toBe(429);
    expect(err.headers['Retry-After']).toBe('1');
    expect(errorBody(err, 'req_1')).toEqual({
      error: { code: 'RATE_LIMITED', message: 'Limit is 5 req/s', requestId: 'req_1' },
    });
  });

  it('hides details of unknown errors', () => {
    const body = errorBody(new Error('db password is hunter2'), 'req_2');
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('hunter2');
  });
});

describe('plan limits', () => {
  it('uses plan defaults', () => {
    expect(resolveLimits('pro')).toEqual(PLANS.pro);
  });

  it('applies tenant then key overrides', () => {
    const limits = resolveLimits('free', { rate: 20, monthlyQuota: 50_000 }, { rate: 2 });
    expect(limits).toEqual({ rate: 2, burst: PLANS.free.burst, monthlyQuota: 50_000 });
  });

  it('falls back to free for an unknown plan', () => {
    expect(resolveLimits('gold')).toEqual(PLANS.free);
  });
});