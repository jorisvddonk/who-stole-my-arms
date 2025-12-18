import { DatabaseManager, Storage } from "../database-manager.js";
import { HasStorage } from "../interfaces/Storage.js";



/**
 * Creates middleware that injects database storage into request context.
 * Automatically determines whether to use session-specific or global storage based on URL path.
 * @param dbManager The database manager instance
 * @param component The component that requires storage
 * @returns A middleware function that wraps handlers
 */
export function withStorage(dbManager: DatabaseManager, component: HasStorage) {
  return function(handler: any): any {
    if (typeof handler === 'function') {
      return async (req: Request, params?: any) => {
        const url = new URL(req.url);
        const parts = url.pathname.split('/');
        let storage: Storage;
        if (parts[1] === 'sessions' && parts[2]) {
          const sessionId = parts[2];
          const db = await dbManager.getSessionDB(sessionId);
          storage = new Storage(db, component.getFQDN(), sessionId);
        } else {
          const db = dbManager.getGlobalDB();
          storage = new Storage(db, component.getFQDN());
        }
        await component.init(storage);
        (req as any).context = (req as any).context || new Map();
        (req as any).context.set('storage', storage);

        return handler(req, params);
      };
    } else if (typeof handler === 'object' && handler !== null) {
      const wrapped: any = {};
      for (const method in handler) {
        wrapped[method] = withStorage(dbManager, component)(handler[method]);
      }
      return wrapped;
    }
    return handler;
  };
}

// Function to apply storage middleware to route groups
export function applyStorageMiddleware(
  dbManager: DatabaseManager,
  routeGroups: Array<{ routes: Record<string, any>; component?: any }>
): Record<string, any> {
  const wrappedRoutes: Record<string, any> = {};
  for (const { routes, component } of routeGroups) {
    for (const [path, handler] of Object.entries(routes)) {
      let wrappedHandler = handler;
       if (component && typeof component.getFQDN === 'function' && typeof component.init === 'function') {
         wrappedHandler = withStorage(dbManager, component as HasStorage)(wrappedHandler);
       }
      wrappedRoutes[path] = wrappedHandler;
    }
  }
  return wrappedRoutes;
}