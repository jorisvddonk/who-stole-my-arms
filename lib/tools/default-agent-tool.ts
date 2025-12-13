import { ToolboxTool } from "../../interfaces/ToolboxTool.js";
import { HasStorage } from "../../interfaces/Storage.js";
import { Storage } from "../database-manager.js";
import { AgentManager } from "../agents/AgentManager.js";
import { createMethodRouter } from "../util/route-utils.js";

export class DefaultAgentTool implements ToolboxTool, HasStorage {
  constructor(toolboxCollector: any, private agentManager: AgentManager) {
    toolboxCollector.register('/widgets/default-agent-widget.js');
  }

  getFQDN(): string {
    return 'tools.default.agent';
  }

  async init(storage: Storage): Promise<void> {
    const sessionId = storage.getSessionId();
    console.log(`\x1b[32mInitializing default agent tool${sessionId ? ` for session \x1b[34m${sessionId}\x1b[32m` : ''}...\x1b[0m`);

    // Check if table needs migration from old schema (key PRIMARY KEY, value) to new (id PRIMARY KEY, key, value)
    let migrated = false;
    try {
      const pragma = await storage.query(`PRAGMA table_info(${storage.getTableName()})`);
      const hasId = pragma.some((col: any) => col.name === 'id');
      if (!hasId) {
        // Migrate old table
        const oldTable = `old_${storage.getTableName()}`;
        await storage.execute(`ALTER TABLE ${storage.getTableName()} RENAME TO ${oldTable}`);
        await storage.init(); // creates new table with id, key, value
        // Copy data with id = key
        const oldRows = await storage.query(`SELECT key, value FROM ${oldTable}`);
        for (const row of oldRows) {
          await storage.insert({ key: row.key, value: row.value }, row.key);
        }
        await storage.execute(`DROP TABLE ${oldTable}`);
        migrated = true;
        console.log(`\x1b[33mMigrated default agent table for session ${sessionId}\x1b[0m`);
      }
    } catch (e) {
      // Table doesn't exist or migration failed, fine
    }
    if (!migrated) {
      await storage.init();
    }

    const currentVersion = await storage.getComponentVersion();
    if (currentVersion === null) {
      await storage.setComponentVersion(1);
    }
  }

  getRoutes(): Record<string, any> {
    return {
      "/agents/list": (req) => {
        const agents = this.agentManager.getAgentNames();
        return new Response(JSON.stringify({ agents }), { headers: { 'Content-Type': 'application/json' } });
      },
      "/sessions/:sessionid/default-agent": createMethodRouter({
        GET: async (req) => {
          try {
            const storage = (req as any).context.get('storage');
            const records = await storage.findAll();
            const record = records.find((r: any) => r.key === 'defaultAgent');
            const defaultAgent = record ? record.value : 'RPGGameMasterAgent'; // default
            return new Response(JSON.stringify({ defaultAgent }), { headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        },
        PUT: async (req) => {
          try {
            const storage = (req as any).context.get('storage');
            const body = await req.json();
            const { agentName } = body;
            if (!agentName) {
              return new Response(JSON.stringify({ error: 'agentName required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            // Validate agent exists
            const knownAgents = this.agentManager.getAgentNames();
            if (!knownAgents.includes(agentName)) {
              return new Response(JSON.stringify({ error: 'Unknown agent' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            await storage.insert({ key: 'defaultAgent', value: agentName }, 'defaultAgent');
            return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
      })
    };
  }
}