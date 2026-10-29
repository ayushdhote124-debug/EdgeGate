// Logs one line per request when the response finishes (or the client disconnects).
import { elapsedMs } from './requestContext.js';

export function accessLog(logger) {
  return (req, res, next) => {
    let logged = false;
    const write = (aborted) => {
      if (logged) return;
      logged = true;
      const entry = {
        requestId: req.id,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        latencyMs: elapsedMs(req),
        service: res.locals.service,
        instance: res.locals.instance,
        upstreamMs: res.locals.upstreamMs,
        errorCode: res.locals.errorCode,
      };
      if (aborted) entry.clientAborted = true;
      const level = res.statusCode >= 500 ? 'warn' : 'info';
      logger[level](entry, 'request');
    };
    res.on('finish', () => write(false));
    res.on('close', () => write(!res.writableFinished));
    next();
  };
}