// First middleware: gives every request an id and a start time.
// The id is returned to the client and forwarded upstream, so one request
// can be followed through gateway logs, backend logs and (later) traces.
import { randomUUID } from 'node:crypto';

// Accept a caller's id only if it is short and safe to put in logs and headers.
const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

export function requestContext() {
  return (req, res, next) => {
    const incoming = req.get('x-request-id');
    req.id = incoming && SAFE_ID.test(incoming) ? incoming : `req_${randomUUID().replaceAll('-', '')}`;
    req.startedAt = process.hrtime.bigint();
    res.set('x-request-id', req.id);
    next();
  };
}

/** Milliseconds since requestContext ran, with 0.1 ms precision. */
export function elapsedMs(req) {
  return Math.round(Number(process.hrtime.bigint() - req.startedAt) / 1e5) / 10;
}