import { DockWidget } from "../../interfaces/DockWidget.js";
import { ToolboxTool } from "../../interfaces/ToolboxTool.js";
import { HasStorage, Storage } from "../../interfaces/Storage.js";
import { PromptProvider, NamedGroup } from "../prompt-manager.js";
import { widgetCollector } from "../widget-collector.js";
import { toolboxCollector } from "../toolbox-collector.js";
import { createMethodRouter } from "../util/route-utils.js";

export class CharacterBioDockWidget implements DockWidget, ToolboxTool, HasStorage, PromptProvider {
  private storage: Storage | null = null;

  getFQDN(): string {
    return 'components.character.bio';
  }

  async init(storage: Storage): Promise<void> {
    this.storage = storage;
    const sessionId = storage.getSessionId();
    console.log(`\x1b[32mInitializing character bio component database${sessionId ? ` for session \x1b[34m${sessionId}\x1b[32m` : ''}...\x1b[0m`);
    await storage.execute(`CREATE TABLE IF NOT EXISTS ${storage.getTableName()} (id INTEGER PRIMARY KEY, bio TEXT)`);
    const currentVersion = await storage.getComponentVersion();
    if (currentVersion === null) {
      await storage.setComponentVersion(1);
      // Insert default empty bio
      await storage.insert({ bio: '' });
    }
  }

  constructor() {
    widgetCollector.register('/widgets/character-bio-dock-widget.js');
    toolboxCollector.register('/widgets/character-bio-tool-widget.js');
  }

  getRoutes(): Record<string, any> {
    return {
      "/sessions/:sessionId/widgets/character-bio": createMethodRouter({
        GET: async (req) => {
          const storage = (req as any).context.get('storage');
          const bios = await storage.findAll();
          const bio = bios.length > 0 ? bios[0].bio : '';
          return new Response(JSON.stringify({ bio }), { headers: { 'Content-Type': 'application/json' } });
        },
        POST: async (req) => {
          try {
            const storage = (req as any).context.get('storage');
            const body = await req.json();
            const { bio } = body;
            if (typeof bio !== 'string') {
              return new Response(JSON.stringify({ error: 'bio must be a string' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            const bios = await storage.findAll();
            if (bios.length > 0) {
              await storage.update(bios[0].id, { bio });
            } else {
              await storage.insert({ bio });
            }

            return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
      })
    };
  }

  async getNamedPromptGroup(groupName: string, context?: any): Promise<NamedGroup | null> {
    if (groupName === 'bio') {
      if (!this.storage) {
        return null;
      }
      const bios = await this.storage.findAll();
      const bio = bios.length > 0 ? bios[0].bio : '';
      return {
        type: 'group',
        name: 'bio',
        items: [
          {
            type: 'prompt',
            name: 'character-bio',
            prompt: bio ? `Character Biography: ${bio}` : '',
            tags: ['character', 'bio']
          }
        ]
      };
    }
    return null;
  }

  getAvailablePromptGroups(): { name: string; description: string }[] {
    return [
      { name: 'bio', description: 'Character biography' }
    ];
  }
}