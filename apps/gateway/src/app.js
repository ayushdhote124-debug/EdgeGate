// Builds the gateway's Express app. Kept separate from index.js so tests can
// create an app with a fake service table and no database.
import express from 'express';
import { requestContext } from './middleware/requestContext.js';
import { accessLog } from './middleware/accessLog.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { createProxy, createUpstreamAgent } from './routing/proxy.js';

export function createApp({ configStore, logger, agent = createUpstreamAgent() }) {
  const app = express();
  app.disable('x-powered-by'); // don't advertise the framework
  app.set('trust proxy', false); // Phase 8: set to the cloud LB's hop count

  // The gateway's own endpoints, outside the proxied space.
  app.get('/__gateway/health', (_req, res) => {
    res.json({ status: 'ok', ...configStore.status() });
  });

  // The pipeline. Phase 3 adds authenticate, rateLimit and quota before proxy;
  // Phase 4 adds the circuit breaker and load balancer.
  app.use(requestContext());
  app.use(accessLog(logger));
  app.use(createProxy({ configStore, agent }));
  app.use(notFound());
  app.use(errorHandler(logger));

  return app;
}