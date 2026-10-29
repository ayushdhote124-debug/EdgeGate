// Starts the gateway: connect to MongoDB, load services, listen, and shut down cleanly.
import { config, createLogger, connectMongo, disconnectMongo } from '@edgegate/shared';
import { createConfigStore } from './config/configStore.js';
import { createApp } from './app.js';
import { createUpstreamAgent } from './routing/proxy.js';

const logger = createLogger('gateway');

async function main() {
  await connectMongo();
  const configStore = createConfigStore({ logger });
  await configStore.start();

  const agent = createUpstreamAgent();
  const app = createApp({ configStore, logger, agent });

  const server = app.listen(config.GATEWAY_PORT, () => {
    logger.info(`EdgeGate listening on http://localhost:${config.GATEWAY_PORT}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') logger.error(`Port ${config.GATEWAY_PORT} is already in use`);
    else logger.error({ err }, 'server error');
    process.exit(1);
  });
  // Upstream timeouts are per service; this only stops idle or stuck client sockets.
  server.headersTimeout = 30_000;
  server.requestTimeout = 120_000;

  // Graceful shutdown: stop accepting, let in-flight requests finish (up to 10 s).
  let stopping = false;
  const shutdown = async (signal) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'shutting down');
    const force = setTimeout(() => process.exit(1), 10_000).unref();
    server.close(async () => {
      configStore.stop();
      await agent.close();
      await disconnectMongo();
      clearTimeout(force);
      process.exit(0);
    });
    server.closeIdleConnections?.();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error({ err: err.message }, 'gateway failed to start');
  process.exit(1);
});