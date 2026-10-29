// Forwards the request to one instance of the matched service and streams
// the response back. Bodies are streamed in both directions, never buffered,
// so a large upload or download does not sit in gateway memory.
import { pipeline } from 'node:stream/promises';
import { Agent, request } from 'undici';
import { GatewayError } from '@edgegate/shared';
import { buildUpstreamHeaders, filterResponseHeaders } from './headers.js';

const BODYLESS = new Set(['GET', 'HEAD', 'OPTIONS', 'DELETE']);

// One keep-alive connection pool shared by all upstreams.
export function createUpstreamAgent() {
  return new Agent({
    connections: 128, // max open sockets per upstream origin
    keepAliveTimeout: 10_000,
    connect: { timeout: 2_000 }, // fail fast if the host is unreachable
  });
}

// Phase 2 placeholder: rotate through instances. Phase 4 replaces this with
// the real load balancer (strategies, health checks).
const cursors = new Map();
function pickInstance(service) {
  const n = service.instances.length;
  const i = cursors.get(service.name) ?? 0;
  cursors.set(service.name, (i + 1) % n);
  return service.instances[i % n].url;
}

export function createProxy({ configStore, agent }) {
  return async function proxy(req, res, next) {
    const service = configStore.match(req.path);
    if (!service) return next(new GatewayError('ROUTE_NOT_FOUND'));

    const instance = pickInstance(service);
    res.locals.service = service.name;
    res.locals.instance = instance;

    const timeoutMs = service.timeoutMs ?? 3000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new TimeoutError()), timeoutMs);
    // If the client goes away, stop the upstream call too.
    const onClientGone = () => {
      if (!res.writableFinished) controller.abort(new ClientGoneError());
    };
    res.on('close', onClientGone);

    const upstreamStart = process.hrtime.bigint();
    try {
      const upstream = await request(instance + req.originalUrl, {
        method: req.method,
        headers: buildUpstreamHeaders(req),
        body: BODYLESS.has(req.method) ? undefined : req,
        dispatcher: agent,
        signal: controller.signal,
      });

      res.locals.upstreamMs = msSince(upstreamStart);
      res.status(upstream.statusCode).set(filterResponseHeaders(upstream.headers));
      await pipeline(upstream.body, res);
    } catch (err) {
      res.locals.upstreamMs ??= msSince(upstreamStart);
      if (controller.signal.reason instanceof ClientGoneError) return; // nobody to answer
      next(toGatewayError(err, controller.signal.reason, service, timeoutMs));
    } finally {
      clearTimeout(timer);
      res.off('close', onClientGone);
    }
  };
}

class TimeoutError extends Error {}
class ClientGoneError extends Error {}

function toGatewayError(err, abortReason, service, timeoutMs) {
  if (abortReason instanceof TimeoutError) {
    return new GatewayError('UPSTREAM_TIMEOUT', {
      message: `${service.name} did not respond within ${timeoutMs} ms`,
    });
  }
  // Connection refused, DNS failure, reset, connect timeout: the upstream is unreachable.
  return new GatewayError('UPSTREAM_ERROR', {
    message: `${service.name} could not be reached`,
    details: { reason: err.code ?? err.name },
  });
}

function msSince(start) {
  return Math.round(Number(process.hrtime.bigint() - start) / 1e5) / 10;
}