import { logRequest } from "../logging/logger.js";

// Middleware function to add logging to handlers
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

// Function to apply logging middleware to routes or component
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