import { minimatch } from 'minimatch';
import { minimatch } from 'minimatch';
import { ToolboxTool } from '../interfaces/ToolboxTool.js';
import { HasStorage, Storage } from '../interfaces/Storage.js';
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

export type Item = PromptItem | NamedGroup;

export interface PromptProvider {
  getNamedPromptGroup(groupName: string, context?: any): Promise<NamedGroup | null>;
  getAvailablePromptGroups(): string[];
}

export interface PromptTemplate {
  name: string;
  groups: string[];
  createdAt: Date;
}

export class PromptManager implements ToolboxTool, HasStorage {
  private providers: Map<string, PromptProvider> = new Map();
  private currentContext: any = {};
  private storage?: Storage;

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

  getAllGroups(): { provider: string; groups: string[] }[] {
    const result: { provider: string; groups: string[] }[] = [];

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

  saveTemplate(name: string, groups: string[]): boolean {
    if (!name || !groups || !Array.isArray(groups) || !this.storage) {
      return false;
    }

    try {
      const template = {
        name,
        groups: [...groups],
        createdAt: new Date()
      };

      // Use execute directly for INSERT OR REPLACE
      this.storage.execute(
        `INSERT OR REPLACE INTO ${this.storage.getTableName()} (name, data) VALUES (?, ?)`,
        [name, JSON.stringify(template)]
      );

      return true;
    } catch (error) {
      logError(`Failed to save template ${name}: ${error.message}`);
      return false;
    }
  }

  async loadTemplate(name: string): Promise<string[] | null> {
    if (!this.storage) return null;

    try {
      const rows = await this.storage.findAll();
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

  async getAllTemplates(): Promise<PromptTemplate[]> {
    if (!this.storage) return [];

    try {
      const rows = await this.storage.findAll();
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

  async deleteTemplate(name: string): Promise<boolean> {
    if (!this.storage) return false;

    try {
      const rows = await this.storage.findAll();
      const templateRow = rows.find(row => {
        const template = JSON.parse(row.data);
        return template.name === name;
      });

      if (templateRow) {
        await this.storage.delete(templateRow.id);
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
      "/prompts/build": {
        POST: async (req) => {
          try {
            const body = await req.json();
            const { groups, context } = body;
            if (!groups || !Array.isArray(groups)) {
              return new Response(JSON.stringify({ error: 'groups array is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            const prompt = await this.getPrompt(groups, context);
            return new Response(JSON.stringify({ prompt }), { headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            logError(error.message);
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
      },
      "/prompts/providers": (req) => {
        const providers = this.getRegisteredProviders();
        return new Response(JSON.stringify({ providers }), { headers: { 'Content-Type': 'application/json' } });
      },
      "/prompts/groups": (req) => {
        const url = new URL(req.url);
        const providerFilter = url.searchParams.get('provider');

        const allGroups = this.getAllGroups();
        const filteredGroups = providerFilter
          ? allGroups.filter(g => g.provider === providerFilter)
          : allGroups;

        return new Response(JSON.stringify({ groups: filteredGroups }), { headers: { 'Content-Type': 'application/json' } });
      },
      "/prompts/templates": {
        GET: async (req) => {
          const templates = await this.getAllTemplates();
          return new Response(JSON.stringify({ templates }), { headers: { 'Content-Type': 'application/json' } });
        },
        POST: async (req) => {
          try {
            const body = await req.json();
            const { name, groups } = body;

            if (!name || !groups || !Array.isArray(groups)) {
              return new Response(JSON.stringify({ error: 'name and groups array are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            const success = this.saveTemplate(name, groups);
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
      "/prompts/templates/:name": createMethodRouter({
        GET: async (req) => {
          const url = new URL(req.url);
          const pathParts = url.pathname.split('/');
          const name = pathParts[pathParts.length - 1];
          const groups = await this.loadTemplate(decodeURIComponent(name));

          if (groups === null) {
            return new Response(JSON.stringify({ error: 'Template not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
          }

          return new Response(JSON.stringify({ name, groups }), { headers: { 'Content-Type': 'application/json' } });
        },
        DELETE: async (req) => {
          const url = new URL(req.url);
          const pathParts = url.pathname.split('/');
          const name = pathParts[pathParts.length - 1];
          const success = await this.deleteTemplate(decodeURIComponent(name));

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

  async getPrompt(orderedGroups: string[], context?: any): Promise<string> {
    const mergedContext = { ...this.currentContext, ...context };
    const expandedGroups = this.expandGlobs(orderedGroups);
    const prompts: string[] = [];

    for (const groupPath of expandedGroups) {
      try {
        const group = await this.resolveGroup(groupPath, mergedContext);
        if (group) {
          const flattened = this.flattenToString(group);
          if (flattened.trim()) {
            prompts.push(flattened);
          }
        } else {
          console.warn(`PromptManager: Group not found: ${groupPath}`);
        }
      } catch (error) {
        console.warn(`PromptManager: Error resolving group ${groupPath}:`, error);
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
            for (const groupName of availableGroups) {
              const fullPath = `${providerName}/${groupName}`;
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

  private flattenToString(item: Item): string {
    if (item.type === 'prompt') {
      return item.prompt;
    } else if (item.type === 'group') {
      return item.items.map(subItem => this.flattenToString(subItem)).join('\n\n');
    }
    return '';
  }

  // HasStorage implementation
  getFQDN(): string {
    return 'tools.prompt.manager';
  }

  setStorage(storage: Storage): void {
    this.storage = storage;
  }

  async init(storage: Storage): Promise<void> {
    const tableName = storage.getTableName();

    // Create table if needed
    await storage.execute(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        data TEXT NOT NULL
      )
    `);

    // Check version and migrate
    const currentVersion = await storage.getComponentVersion();
    if (currentVersion === null) {
      await storage.setComponentVersion(1);
    }
  }
}