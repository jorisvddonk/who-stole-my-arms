/**
 * Utility functions for the application
 */

/**
 * Creates a router that dispatches requests based on HTTP method.
 * Useful for creating endpoints that support multiple HTTP methods.
 * @param methods Record mapping HTTP methods (GET, POST, etc.) to handler functions
 * @returns A router function that dispatches based on request method
 */
export function createMethodRouter(methods: Record<string, (req: Request, params?: any) => Response | Promise<Response>>) {
  return (req: Request, params?: any) => {
    const method = req.method.toUpperCase();
    const handler = methods[method];

    if (!handler) {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return handler(req, params);
  };
}