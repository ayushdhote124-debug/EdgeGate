import { describe, it, expect } from 'vitest';
import { createRouter } from '../src/routing/router.js';

const svc = (name, routePrefix, extra = {}) => ({ name, routePrefix, instances: [{ url: 'http://x' }], ...extra });

describe('router', () => {
  const router = createRouter([svc('orders', '/orders'), svc('api', '/api'), svc('apiv2', '/api/v2'), svc('off', '/off', { enabled: false })]);

  it('matches the exact prefix and anything below it', () => {
    expect(router.match('/orders')?.name).toBe('orders');
    expect(router.match('/orders/42')?.name).toBe('orders');
    expect(router.match('/orders/42/items')?.name).toBe('orders');
  });

  it('only matches on a path segment boundary', () => {
    expect(router.match('/ordersx')).toBeNull();
    expect(router.match('/order')).toBeNull();
  });

  it('prefers the longest prefix', () => {
    expect(router.match('/api/v2/users')?.name).toBe('apiv2');
    expect(router.match('/api/v1/users')?.name).toBe('api');
    expect(router.match('/api/v2')?.name).toBe('apiv2');
  });

  it('ignores disabled services', () => {
    expect(router.match('/off/1')).toBeNull();
    expect(router.size).toBe(3);
  });

  it('treats a trailing slash in the prefix the same', () => {
    expect(createRouter([svc('u', '/users/')]).match('/users/7')?.name).toBe('u');
  });

  it('returns null when nothing matches', () => {
    expect(router.match('/')).toBeNull();
    expect(router.match('/payments/1')).toBeNull();
  });
});