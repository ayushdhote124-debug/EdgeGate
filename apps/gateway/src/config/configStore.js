// Keeps the service table in memory so no request ever waits on MongoDB.
// Loaded at startup, then reloaded every `reloadMs` (Phase 5 adds instant
// reload through Redis pub/sub). If a reload fails, the last good table stays.
import { Service } from '@edgegate/shared/models';
import { createRouter } from '../routing/router.js';

export function createConfigStore({ logger, reloadMs = 30_000 } = {}) {
  let router = createRouter([]);
  let loadedAt = null;
  let timer = null;

  async function reload() {
    const services = await Service.find({ enabled: true }).lean();
    router = createRouter(services);
    loadedAt = new Date();
    logger?.debug({ services: router.list() }, 'service table loaded');
    return router.size;
  }

  return {
    async start() {
      const count = await reload();
      logger?.info({ count, routes: router.list().map((r) => r.prefix) }, 'services loaded');
      timer = setInterval(() => {
        reload().catch((err) => logger?.warn({ err: err.message }, 'service reload failed; keeping last table'));
      }, reloadMs);
      timer.unref(); // never keep the process alive just for this timer
    },
    stop() {
      clearInterval(timer);
    },
    reload,
    match: (path) => router.match(path),
    status: () => ({ services: router.size, loadedAt }),
  };
}

/** A fixed service table, for tests and local experiments. */
export function createStaticConfigStore(services) {
  const router = createRouter(services);
  return {
    async start() {},
    stop() {},
    async reload() {
      return router.size;
    },
    match: (path) => router.match(path),
    status: () => ({ services: router.size, loadedAt: null }),
  };
}