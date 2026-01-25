import { ToolboxTool } from "../../interfaces/ToolboxTool.js";
import { HasStorage } from "../../interfaces/Storage.js";
import { Storage } from "../database-manager.js";
import { createMethodRouter } from "../util/route-utils.js";

export class SessionNameTool implements ToolboxTool, HasStorage {
  constructor(toolboxCollector: any) {
    // No widget registration needed - this is just an API tool
  }

  getFQDN(): string {
    return 'tools.session.name';
  }

  async init(storage: Storage): Promise<void> {
    await storage.init();
  }

  getRoutes(): Record<string, any> {
    return {
      "/sessions/:sessionid/name": createMethodRouter({
        GET: async (req) => {
          try {
            const sessionId = (req as any).params.sessionid;
            const storage = (req as any).context.get('storage');
            const records = await storage.findAll();
            const record = records.find((r: any) => r.key === 'sessionName');
            const name = record ? record.value : sessionId;
            return new Response(JSON.stringify({ name }), { headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            const sessionId = (req as any).params.sessionid;
            return new Response(JSON.stringify({ name: sessionId }), { headers: { 'Content-Type': 'application/json' } });
          }
        },
        PUT: async (req) => {
          try {
            const storage = (req as any).context.get('storage');
            const { name } = await req.json();
            if (!name) {
              return new Response(JSON.stringify({ error: 'name required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            await storage.insert({ key: 'sessionName', value: name }, 'sessionName');
            return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
      })
    };
  }
}
