import { logRequest } from "../logging/logger.js";

// Middleware function to add logging to handlers
export function withLogging(handler: any): any {
  if (typeof handler === 'function') {
    return async (req: Request) => {
      logRequest(req);
      return handler(req);
    };
  } else if (typeof handler === 'object' && handler !== null) {
    const wrapped: any = {};
    for (const method in handler) {
      wrapped[method] = withLogging(handler[method]);
    }
    return wrapped;
  }
  return handler;
}

// Function to apply logging middleware to a routes object
export function applyLoggingMiddleware(routes: Record<string, any>): Record<string, any> {
  const wrappedRoutes: Record<string, any> = {};
  for (const [path, handler] of Object.entries(routes)) {
    wrappedRoutes[path] = withLogging(handler);
  }
  return wrappedRoutes;
}