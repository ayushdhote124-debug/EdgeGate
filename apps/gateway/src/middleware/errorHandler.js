// Last middleware: turns any thrown error into the standard error response.
import { GatewayError, errorBody } from '@edgegate/shared';

export function notFound() {
  return (_req, _res, next) => next(new GatewayError('ROUTE_NOT_FOUND'));
}

export function errorHandler(logger) {
  // Express recognises an error handler by its four arguments.
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, _next) => {
    const known = err instanceof GatewayError;
    if (!known) logger.error({ err, requestId: req.id }, 'unhandled error');

    res.locals.errorCode = known ? err.code : 'INTERNAL_ERROR';

    // If the upstream already started sending its body, we cannot change the
    // status any more; the only honest option is to cut the connection.
    if (res.headersSent) {
      res.destroy(err);
      return;
    }

    const status = known ? err.status : 500;
    res.status(status).set(known ? err.headers : {}).json(errorBody(err, req.id));
  };
}