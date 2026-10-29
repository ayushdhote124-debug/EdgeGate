// Which headers cross the gateway, in each direction.

// Hop-by-hop headers describe one TCP connection, not the request itself,
// so a proxy must not pass them on (RFC 9110, section 7.6.1).
const HOP_BY_HOP = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'proxy-connection',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
  ]);
  
  // Never forwarded upstream: the backend must not see client credentials.
  const STRIP_UPSTREAM = new Set(['host', 'x-api-key', 'content-length', 'expect']);
  
  function connectionTokens(headers) {
    const value = headers.connection;
    if (!value) return new Set();
    return new Set(String(value).split(',').map((t) => t.trim().toLowerCase()));
  }
  
  export function buildUpstreamHeaders(req, extra = {}) {
    const listed = connectionTokens(req.headers);
    const out = {};
    for (const [name, value] of Object.entries(req.headers)) {
      const lower = name.toLowerCase();
      if (HOP_BY_HOP.has(lower) || STRIP_UPSTREAM.has(lower) || listed.has(lower)) continue;
      // Client-supplied identity headers are replaced by the gateway, never trusted.
      if (lower === 'x-tenant-id' || lower.startsWith('x-forwarded-')) continue;
      out[lower] = value;
    }
  
    // The gateway is the edge, so the client's own x-forwarded-for could be forged.
    // Use the socket address only. (Behind a cloud LB, Phase 8 trusts its hop.)
    out['x-forwarded-for'] = req.socket.remoteAddress ?? '';
    out['x-forwarded-proto'] = req.protocol;
    if (req.headers.host) out['x-forwarded-host'] = req.headers.host;
    out['x-request-id'] = req.id;
  
    return { ...out, ...extra };
  }
  
  // Never returned to clients: they reveal backend software and versions.
  const STRIP_DOWNSTREAM = new Set(['x-powered-by', 'server']);
  
  export function filterResponseHeaders(headers) {
    const listed = connectionTokens(headers);
    const out = {};
    for (const [name, value] of Object.entries(headers)) {
      const lower = name.toLowerCase();
      if (HOP_BY_HOP.has(lower) || STRIP_DOWNSTREAM.has(lower) || listed.has(lower)) continue;
      out[lower] = value;
    }
    return out;
  }