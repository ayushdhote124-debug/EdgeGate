// Structured JSON logs (pino). In development they are pretty-printed.
import pino from 'pino';
import { config } from './config.js';

const pretty = !config.isProd && config.NODE_ENV !== 'test';

export const logger = pino({
  level: config.LOG_LEVEL,
  base: undefined, // drop pid/hostname noise
  redact: {
    // Never let secrets reach the logs.
    paths: ['req.headers["x-api-key"]', 'req.headers.authorization', '*.password', '*.passwordHash', '*.rawKey'],
    censor: '[redacted]',
  },
  transport: pretty
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'app' } }
    : undefined,
});

// Each app gets a child logger tagged with its name: logger.child({ app: 'gateway' })
export const createLogger = (app) => logger.child({ app });