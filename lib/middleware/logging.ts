import { logRequest } from "../logging/logger.js";

/**
 * Creates middleware that adds request logging to handlers.
 * Logs incoming requests with session and component information.
 * @param handler The handler function to wrap
 * @param component Optional component for FQDN logging
 * @returns The wrapped handler with logging
 */
export function withLogging(handler: any, component?: any): any {
  if (typeof handler === 'function') {
    return async (req: Request) => {
      const url = new URL(req.url);
      const parts = url.pathname.split('/');
      const sessionId = (parts[1] === 'sessions' && parts[2]) ? parts[2] : null;
      const componentName = component?.getFQDN?.() || null;
      logRequest(req, sessionId, componentName);
      return handler(req);
    };
  } else if (typeof handler === 'object' && handler !== null) {
    const wrapped: any = {};
    for (const method in handler) {
      wrapped[method] = withLogging(handler[method], component);
    }
    return wrapped;
  }
  return handler;
}

/**
 * Applies logging middleware to all routes in a route object or component.
 * @param input Either a routes object or a component with getRoutes method
 * @returns Routes object with logging middleware applied
 */
export function applyLoggingMiddleware(input: Record<string, any> | any): Record<string, any> {
  let routes: Record<string, any>;
  let component: any;

  if (typeof input === 'object' && input !== null && typeof input.getRoutes === 'function') {
    component = input;
    routes = input.getRoutes();
  } else {
    routes = input;
    component = undefined;
  }

  return Object.fromEntries(
    Object.entries(routes).map(([path, handler]) => [path, withLogging(handler, component)])
  );
}