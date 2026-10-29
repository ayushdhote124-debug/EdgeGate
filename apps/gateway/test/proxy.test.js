// Integration tests: a real gateway in front of a real (fake) upstream, over HTTP.
// No database: the service table comes from createStaticConfigStore.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import pino from 'pino';
import { createApp } from '../src/app.js';
import { createStaticConfigStore } from '../src/config/configStore.js';
import { createUpstreamAgent } from '../src/routing/proxy.js';

const listen = (app) =>
  new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
const urlOf = (server) => `http://127.0.0.1:${server.address().port}`;

let upstream, upstreamB, gateway, agent, GW;

beforeAll(async () => {
  // Upstream that echoes what it received.
  const echo = (tag) => {
    const app = express();
    app.use(express.json());
    app.get('/slow/:ms', (req, res) => setTimeout(() => res.json({ ok: true }), Number(req.params.ms)));
    app.get('/boom', (_req, res) => res.status(500).json({ error: 'upstream broke' }));
    app.use((req, res) => {
      res.set('x-instance', tag).set('set-cookie', ['a=1', 'b=2']);
      res.status(req.method === 'POST' ? 201 : 200).json({
        instance: tag,
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body ?? null,
      });
    });
    return app;
  };
  upstream = await listen(echo('a'));
  upstreamB = await listen(echo('b'));

  const services = [
    { name: 'orders', routePrefix: '/orders', instances: [{ url: urlOf(upstream) }, { url: urlOf(upstreamB) }], timeoutMs: 3000 },
    { name: 'slowsvc', routePrefix: '/slow', instances: [{ url: urlOf(upstream) }], timeoutMs: 200 },
    { name: 'broken', routePrefix: '/boom', instances: [{ url: urlOf(upstream) }], timeoutMs: 500 },
    // Nothing listens on port 1: connection refused. Windows retries a refused
    // connect for about 2 s before failing, so this timeout must be longer than that.
    { name: 'dead', routePrefix: '/dead', instances: [{ url: 'http://127.0.0.1:1' }], timeoutMs: 4000 },
  ];
  agent = createUpstreamAgent();
  const app = createApp({ configStore: createStaticConfigStore(services), logger: pino({ level: 'silent' }), agent });
  gateway = await listen(app);
  GW = urlOf(gateway);
});

afterAll(async () => {
  await agent.close();
  await Promise.all([gateway, upstream, upstreamB].map((s) => new Promise((r) => s.close(r))));
});

describe('gateway proxy', () => {
  it('forwards GET with path and query string', async () => {
    const r = await fetch(`${GW}/orders/42?expand=items&x=1`);
    const body = await r.json();
    expect(r.status).toBe(200);
    expect(body.url).toBe('/orders/42?expand=items&x=1');
    expect(body.method).toBe('GET');
  });

  it('forwards a POST body and the upstream status', async () => {
    const r = await fetch(`${GW}/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ item: 'ticket', qty: 2 }),
    });
    const body = await r.json();
    expect(r.status).toBe(201);
    expect(body.body).toEqual({ item: 'ticket', qty: 2 });
  });

  it('removes credentials and spoofable identity headers, adds forwarding headers', async () => {
    const r = await fetch(`${GW}/orders/1`, {
      headers: { 'x-api-key': 'eg_live_secret', 'x-tenant-id': 'evil', 'x-forwarded-for': '6.6.6.6', 'x-custom': 'kept' },
    });
    const { headers } = await r.json();
    expect(headers['x-api-key']).toBeUndefined();
    expect(headers['x-tenant-id']).toBeUndefined();
    expect(headers['x-custom']).toBe('kept');
    expect(headers['x-forwarded-for']).toBe('127.0.0.1'); // forged value dropped
    expect(headers['x-forwarded-proto']).toBe('http');
    expect(headers['x-request-id']).toMatch(/^req_[0-9a-f]{32}$/);
  });

  it('returns the request id to the client and reuses a safe incoming one', async () => {
    const fresh = await fetch(`${GW}/orders/1`);
    expect(fresh.headers.get('x-request-id')).toMatch(/^req_/);

    const reused = await fetch(`${GW}/orders/1`, { headers: { 'x-request-id': 'client-abc-12345' } });
    expect(reused.headers.get('x-request-id')).toBe('client-abc-12345');
    expect((await reused.json()).headers['x-request-id']).toBe('client-abc-12345');

    const unsafe = await fetch(`${GW}/orders/1`, { headers: { 'x-request-id': 'bad id with spaces' } });
    expect(unsafe.headers.get('x-request-id')).toMatch(/^req_/);
  });

  it('passes upstream response headers through, including multiple set-cookie', async () => {
    const r = await fetch(`${GW}/orders/1`);
    expect(r.headers.get('x-instance')).toMatch(/^[ab]$/);
    expect(r.headers.getSetCookie()).toEqual(['a=1', 'b=2']);
    expect(r.headers.get('x-powered-by')).toBeNull();
  });

  it('rotates across instances', async () => {
    const seen = new Set();
    for (let i = 0; i < 4; i++) seen.add((await (await fetch(`${GW}/orders/1`)).json()).instance);
    expect(seen).toEqual(new Set(['a', 'b']));
  });

  it('passes upstream errors through unchanged', async () => {
    const r = await fetch(`${GW}/boom`);
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: 'upstream broke' });
  });

  it('returns 404 ROUTE_NOT_FOUND for unknown paths', async () => {
    const r = await fetch(`${GW}/nothing/here`);
    const body = await r.json();
    expect(r.status).toBe(404);
    expect(body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(body.error.requestId).toBe(r.headers.get('x-request-id'));
  });

  it('returns 504 UPSTREAM_TIMEOUT when the upstream is too slow', async () => {
    const started = Date.now();
    const r = await fetch(`${GW}/slow/2000`);
    const body = await r.json();
    expect(r.status).toBe(504);
    expect(body.error.code).toBe('UPSTREAM_TIMEOUT');
    expect(Date.now() - started).toBeLessThan(1000); // gave up at ~200 ms, not 2 s
  });

  it('answers normally when the upstream is within the timeout', async () => {
    const r = await fetch(`${GW}/slow/50`);
    expect(r.status).toBe(200);
  });

  it('returns 502 UPSTREAM_ERROR when the upstream is unreachable', async () => {
    const r = await fetch(`${GW}/dead/1`);
    const body = await r.json();
    expect(r.status).toBe(502);
    expect(body.error.code).toBe('UPSTREAM_ERROR');
  });

  it('serves its own health endpoint', async () => {
    const r = await fetch(`${GW}/__gateway/health`);
    expect(r.status).toBe(200);
    expect((await r.json()).status).toBe('ok');
  });
});