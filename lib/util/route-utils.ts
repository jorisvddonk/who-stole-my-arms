// Utility functions for the application

// Utility function to create method-based route handlers
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