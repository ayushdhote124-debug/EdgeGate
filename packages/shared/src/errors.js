// One error format for every gateway rejection, so clients can handle them uniformly:
// { "error": { "code": "RATE_LIMITED", "message": "...", "requestId": "req_..." } }

export const ErrorCodes = Object.freeze({
    INVALID_API_KEY: { status: 401, message: 'Missing or invalid API key' },
    KEY_REVOKED: { status: 403, message: 'This API key has been revoked or its tenant is disabled' },
    RATE_LIMITED: { status: 429, message: 'Rate limit exceeded' },
    QUOTA_EXCEEDED: { status: 429, message: 'Monthly quota exceeded' },
    ROUTE_NOT_FOUND: { status: 404, message: 'No service is registered for this path' },
    SERVICE_UNAVAILABLE: { status: 503, message: 'Service is temporarily unavailable' },
    NO_HEALTHY_INSTANCE: { status: 503, message: 'No healthy instance is available for this service' },
    UPSTREAM_TIMEOUT: { status: 504, message: 'The upstream service did not respond in time' },
    UPSTREAM_ERROR: { status: 502, message: 'The upstream service could not be reached' },
    VALIDATION_FAILED: { status: 400, message: 'Request validation failed' },
    UNAUTHORIZED: { status: 401, message: 'Authentication required' },
    NOT_FOUND: { status: 404, message: 'Resource not found' },
    INTERNAL_ERROR: { status: 500, message: 'Internal server error' },
  });
  
  export class GatewayError extends Error {
    /**
     * @param {keyof typeof ErrorCodes} code
     * @param {{ message?: string, headers?: Record<string,string>, details?: unknown }} [opts]
     */
    constructor(code, opts = {}) {
      const def = ErrorCodes[code] ?? ErrorCodes.INTERNAL_ERROR;
      super(opts.message ?? def.message);
      this.name = 'GatewayError';
      this.code = ErrorCodes[code] ? code : 'INTERNAL_ERROR';
      this.status = def.status;
      this.headers = opts.headers ?? {};
      this.details = opts.details;
    }
  }
  
  /** Builds the JSON body for an error response. */
  export function errorBody(err, requestId) {
    const isKnown = err instanceof GatewayError;
    return {
      error: {
        code: isKnown ? err.code : 'INTERNAL_ERROR',
        message: isKnown ? err.message : ErrorCodes.INTERNAL_ERROR.message,
        ...(requestId ? { requestId } : {}),
        ...(isKnown && err.details !== undefined ? { details: err.details } : {}),
      },
    };
  }