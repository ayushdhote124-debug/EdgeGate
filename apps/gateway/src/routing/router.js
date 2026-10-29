// Maps a request path to a registered service by longest prefix.
//   /orders      -> orders
//   /orders/42   -> orders
//   /ordersx     -> no match (prefixes only match on a "/" boundary)
// With /api and /api/v2 both registered, /api/v2/users goes to /api/v2.

export function normalizePrefix(prefix) {
    if (prefix === '/') return '/';
    return prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  }
  
  export function createRouter(services) {
    // Longest prefix first, so the first match is the most specific one.
    const routes = services
      .filter((s) => s.enabled !== false)
      .map((s) => ({ prefix: normalizePrefix(s.routePrefix), service: s }))
      .sort((a, b) => b.prefix.length - a.prefix.length);
  
    return {
      match(path) {
        for (const route of routes) {
          if (route.prefix === '/' || path === route.prefix || path.startsWith(route.prefix + '/')) {
            return route.service;
          }
        }
        return null;
      },
      get size() {
        return routes.length;
      },
      list() {
        return routes.map((r) => ({ prefix: r.prefix, name: r.service.name }));
      },
    };
  }