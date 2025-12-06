import { HasStorage } from "../interfaces/Storage.js";
import { createMethodRouter } from "./util/route-utils.js";

export class DockManager implements HasStorage {
  getFQDN(): string {
    return "dock.manager";
  }

  async init(storage: any): Promise<void> {
    await storage.execute(`CREATE TABLE IF NOT EXISTS ${storage.getTableName()} (name TEXT NOT NULL UNIQUE, data TEXT NOT NULL)`);
    const currentVersion = await storage.getComponentVersion();
    if (currentVersion === null) {
      await storage.setComponentVersion(1);
    }
  }

  getRoutes() {
    return {
      "/sessions/:sessionId/dock/config": createMethodRouter({
        GET: async (req) => {
          try {
            const storage = (req as any).context.get('storage');
            const rows = await storage.findAll();
            const configRow = rows.find((row: any) => row.name === 'dock-config');
            const config = configRow ? JSON.parse(configRow.data) : [
              { id: 1, widgets: [{ type: 'empty-widget', span: 12 }] }
            ];
            return new Response(JSON.stringify({ rows: config }), { headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            console.error('Failed to load dock config:', error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        },
        POST: async (req) => {
          try {
            const storage = (req as any).context.get('storage');
            const body = await req.json();
            const { rows } = body;
            await storage.execute(
              `INSERT OR REPLACE INTO ${storage.getTableName()} (name, data) VALUES (?, ?)`,
              ['dock-config', JSON.stringify(rows)]
            );
            return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            console.error('Failed to save dock config:', error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
      })
    };
  }
}