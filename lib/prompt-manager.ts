import { minimatch } from 'minimatch';
import { ToolboxTool } from '../interfaces/ToolboxTool.js';
import { Storage, HasStorage } from '../interfaces/Storage.js';

import { logError } from './logging/logger.js';
import { createMethodRouter } from './util/route-utils.js';

export interface PromptItem {
  type: 'prompt';
  name: string;
  prompt: string;
  tags: string[];
}

export interface NamedGroup {
  type: 'group';
  name: string;
  items: Item[];
}

export interface NamedGroupReference {
  type: 'groupRef';
  name: string;
}

export type Item = PromptItem | NamedGroup | NamedGroupReference;

export interface PromptProvider {
  getNamedPromptGroup(groupName: string, context?: any): Promise<NamedGroup | null>;
  getAvailablePromptGroups(): { name: string; description: string }[];
}

export interface PromptTemplate {
  name: string;
  groups: string[];
  createdAt: Date;
}

export class PromptManager implements ToolboxTool, HasStorage {
  private providers: Map<string, PromptProvider> = new Map();
  private currentContext: any = {};

  getFQDN(): string {
    return 'tools.prompt.manager';
  }

  async init(storage: Storage): Promise<void> {
    const sessionId = storage.getSessionId();
    console.log(`\x1b[32mInitializing prompt template database${sessionId ? ` for session \x1b[34m${sessionId}\x1b[32m` : ''}...\x1b[0m`);
    await storage.execute(`CREATE TABLE IF NOT EXISTS ${storage.getTableName()} (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, data TEXT NOT NULL)`);
    const currentVersion = await storage.getComponentVersion();
    if (currentVersion === null) {
      await storage.setComponentVersion(1);

       // Add default chatMessage template
       const defaultTemplate = {
         name: 'chatMessage',
         groups: ['system/advanced', 'tools/tools', 'character-bio/bio', 'chat/chat'],
         createdAt: new Date()
       };
      await storage.insert({
        name: 'chatMessage',
        data: JSON.stringify(defaultTemplate)
      });
    }
  }



  constructor(toolboxCollector?: any) {
    if (toolboxCollector) {
      toolboxCollector.register('/widgets/prompt-manager-widget.js');
    }
  }

  registerProvider(name: string, provider: PromptProvider): void {
    this.providers.set(name, provider);
  }

  unregisterProvider(name: string): void {
    this.providers.delete(name);
  }

  getRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getAllGroups(): { provider: string; groups: { name: string; description: string }[] }[] {
    const result: { provider: string; groups: { name: string; description: string }[] }[] = [];

    for (const [providerName, provider] of this.providers) {
      try {
        const groups = provider.getAvailablePromptGroups();
        result.push({
          provider: providerName,
          groups
        });
      } catch (error) {
        console.warn(`Error getting groups from provider ${providerName}:`, error);
      }
    }

    return result;
  }

  saveTemplate(storage: Storage, name: string, groups: string[]): boolean {
    if (!name || !groups || !Array.isArray(groups)) {
      return false;
    }

    try {
      const template = {
        name,
        groups: [...groups],
        createdAt: new Date()
      };

      // Use execute directly for INSERT OR REPLACE
      storage.execute(
        `INSERT OR REPLACE INTO ${storage.getTableName()} (name, data) VALUES (?, ?)`,
        [name, JSON.stringify(template)]
      );

      return true;
    } catch (error) {
      logError(`Failed to save template ${name}: ${error.message}`);
      return false;
    }
  }

  async loadTemplate(storage: Storage, name: string): Promise<string[] | null> {
    try {
      const rows = await storage.findAll();
      const row = rows.find(row => {
        const template = JSON.parse(row.data);
        return template.name === name;
      });

      if (row) {
        const template = JSON.parse(row.data);
        return [...template.groups];
      }
      return null;
    } catch (error) {
      logError(`Failed to load template ${name}: ${error.message}`);
      return null;
    }
  }

  async getAllTemplates(storage: Storage): Promise<PromptTemplate[]> {
    try {
      const rows = await storage.findAll();
      const templates: PromptTemplate[] = rows.map(row => {
        const template = JSON.parse(row.data);
        return {
          ...template,
          createdAt: new Date(template.createdAt)
        };
      });

      return templates.sort((a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime()
      );
    } catch (error) {
      logError(`Failed to get all templates: ${error.message}`);
      return [];
    }
  }

  async deleteTemplate(storage: Storage, name: string): Promise<boolean> {
    try {
      const rows = await storage.findAll();
      const templateRow = rows.find(row => {
        const template = JSON.parse(row.data);
        return template.name === name;
      });

      if (templateRow) {
        await storage.delete(templateRow.id);
        return true;
      }
      return false;
    } catch (error) {
      logError(`Failed to delete template ${name}: ${error.message}`);
      return false;
    }
  }

  getRoutes(): Record<string, any> {
    return {
      "/sessions/:sessionid/prompts/build": {
        POST: async (req) => {
          try {
            const body = await req.json();
            const { groups, context } = body;
            if (!groups || !Array.isArray(groups)) {
              return new Response(JSON.stringify({ error: 'groups array is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            const mergedContext = { ...context, sessionId: (req as any).params.sessionid };
            const prompt = await this.getPrompt(groups, mergedContext);
            return new Response(JSON.stringify({ prompt }), { headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            logError(error.message);
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
      },
      "/sessions/:sessionid/prompts/providers": (req) => {
        const providers = this.getRegisteredProviders();
        return new Response(JSON.stringify({ providers }), { headers: { 'Content-Type': 'application/json' } });
      },
      "/sessions/:sessionid/prompts/groups": (req) => {
        const url = new URL(req.url);
        const providerFilter = url.searchParams.get('provider');

        const allGroups = this.getAllGroups();
        const filteredGroups = providerFilter
          ? allGroups.filter(g => g.provider === providerFilter)
          : allGroups;

        return new Response(JSON.stringify({ groups: filteredGroups }), { headers: { 'Content-Type': 'application/json' } });
      },
      "/sessions/:sessionid/prompts/templates": {
        GET: async (req) => {
          const storage = (req as any).context.get('storage');
          const templates = await this.getAllTemplates(storage);
          return new Response(JSON.stringify({ templates }), { headers: { 'Content-Type': 'application/json' } });
        },
        POST: async (req) => {
          try {
            const storage = (req as any).context.get('storage');
            const body = await req.json();
            const { name, groups } = body;

            if (!name || !groups || !Array.isArray(groups)) {
              return new Response(JSON.stringify({ error: 'name and groups array are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            const success = this.saveTemplate(storage, name, groups);
            if (!success) {
              return new Response(JSON.stringify({ error: 'Failed to save template' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }

            return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            logError(error.message);
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
      },
      "/sessions/:sessionid/prompts/templates/:name": createMethodRouter({
        GET: async (req) => {
          const name = (req as any).params.name;
          const storage = (req as any).context.get('storage');
          const groups = await this.loadTemplate(storage, decodeURIComponent(name));

          if (groups === null) {
            return new Response(JSON.stringify({ error: 'Template not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
          }

          return new Response(JSON.stringify({ name, groups }), { headers: { 'Content-Type': 'application/json' } });
        },
        DELETE: async (req) => {
          const name = (req as any).params.name;
          const storage = (req as any).context.get('storage');
          const success = await this.deleteTemplate(storage, decodeURIComponent(name));

          if (!success) {
            return new Response(JSON.stringify({ error: 'Template not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
          }

          return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
        }
      })
    };
  }

  getCurrentContext(): any {
    return { ...this.currentContext };
  }

  async getPromptFromTemplate(storage: Storage, templateName: string): Promise<string> {
    const templateGroups = await this.loadTemplate(storage, templateName);
    if (templateGroups) {
      return await this.getPrompt(templateGroups);
    }
    return '';
  }

  async getPrompt(orderedGroups: string[], context?: any): Promise<string> {
    const mergedContext = { ...this.currentContext, ...context };
    const expandedGroups = this.expandGlobs(orderedGroups);
    const prompts: string[] = [];

    for (const groupPath of expandedGroups) {
      try {
        const group = await this.resolveGroup(groupPath, mergedContext);
        if (group) {
          const flattened = await this.flattenToString(group, mergedContext);
          if (flattened.trim()) {
            prompts.push(flattened);
          }
        } else {
          console.log(`PromptManager: Group not found: ${groupPath}`);
        }
      } catch (error) {
        console.log(`PromptManager: Error resolving group ${groupPath}:`, error);
      }
    }

    return prompts.join('\n\n');
  }

  private expandGlobs(patterns: string[]): string[] {
    const expanded: string[] = [];

    for (const pattern of patterns) {
      if (pattern.includes('*') || pattern.includes('?') || pattern.includes('[')) {
        // Glob pattern - expand it
        for (const [providerName, provider] of this.providers) {
          try {
            const availableGroups = provider.getAvailablePromptGroups();
            for (const group of availableGroups) {
              const fullPath = `${providerName}/${group.name}`;
              if (minimatch(fullPath, pattern)) {
                expanded.push(fullPath);
              }
            }
          } catch (error) {
            console.warn(`PromptManager: Error getting groups from provider ${providerName}:`, error);
          }
        }
      } else {
        // Literal path
        expanded.push(pattern);
      }
    }

    // Remove duplicates while preserving order
    const seen = new Set<string>();
    return expanded.filter(path => {
      //if (seen.has(path)) return false;
      //seen.add(path);
      return true;
    });
  }

  private async resolveGroup(groupPath: string, context?: any): Promise<NamedGroup | null> {
    const [providerName, groupName] = groupPath.split('/', 2);
    if (!providerName || !groupName) {
      console.warn(`PromptManager: Invalid group path format: ${groupPath}`);
      return null;
    }

    const provider = this.providers.get(providerName);
    if (!provider) {
      console.warn(`PromptManager: Provider not found: ${providerName}`);
      return null;
    }

    return await provider.getNamedPromptGroup(groupName, context);
  }

  private async flattenToString(item: Item, context?: any): Promise<string> {
    if (item.type === 'prompt') {
      return item.prompt;
    } else if (item.type === 'group') {
      const subStrings = await Promise.all(item.items.map(subItem => this.flattenToString(subItem, context)));
      return subStrings.join('\n\n');
    } else if (item.type === 'groupRef') {
      const group = await this.resolveGroup(item.name, context);
      if (group) {
        return await this.flattenToString(group, context);
      }
      return '';
    }
    return '';
  }


}