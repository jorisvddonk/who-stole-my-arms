import { ToolboxTool } from "../../interfaces/ToolboxTool.js";
import { HasStorage, Storage } from "../../interfaces/Storage.js";
import { readFile, unlink } from "fs/promises";

interface OpenRouterSettings {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  enableReasoning: boolean;
}

export class OpenRouterSettingsTool implements ToolboxTool, HasStorage {
  private storage?: Storage;
  private settings: OpenRouterSettings;
  private onSettingsChange?: (settings: OpenRouterSettings) => void;

  constructor(toolboxCollector: any, onSettingsChange?: (settings: OpenRouterSettings) => void) {
    toolboxCollector.register('/widgets/openrouter-settings-widget.js');
    this.onSettingsChange = onSettingsChange;
    this.settings = {
      apiKey: '',
      model: 'tngtech/tng-r1t-chimera:free',
      maxTokens: 100,
      temperature: 0.7,
      topP: 0.9,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      enableReasoning: true
    };
  }

  private async loadSettings() {
    if (!this.storage) return;

    try {
      const rows = await this.storage.findAll();
      if (rows.length > 0) {
        this.settings = { ...this.settings, ...rows[0] };
        // Convert database integer to boolean
        this.settings.enableReasoning = Boolean(this.settings.enableReasoning);
      }
    } catch (error) {
      console.log('Using default OpenRouter settings');
    }
  }

  private async saveSettings() {
    if (!this.storage) return;

    try {
      await this.storage.update(1, this.settings);
    } catch (error) {
      console.error('Failed to save OpenRouter settings:', error);
      throw error;
    }
  }

  getSettings(): OpenRouterSettings {
    return { ...this.settings };
  }

  getRoutes(): Record<string, any> {
    return {
      "/openrouter/settings": {
        GET: async (req) => {
          return new Response(JSON.stringify(this.settings), { headers: { 'Content-Type': 'application/json' } });
        },
        POST: async (req) => {
          try {
            const newSettings = await req.json();

            // Validate settings
            if (typeof newSettings.apiKey !== 'string') {
              return new Response(JSON.stringify({ error: 'apiKey must be a string' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.model !== 'string' || newSettings.model.trim() === '') {
              return new Response(JSON.stringify({ error: 'model must be a non-empty string' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.maxTokens !== 'number' || newSettings.maxTokens < 1) {
              return new Response(JSON.stringify({ error: 'maxTokens must be a number greater than 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.temperature !== 'number' || newSettings.temperature < 0 || newSettings.temperature > 2) {
              return new Response(JSON.stringify({ error: 'temperature must be a number between 0 and 2' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.topP !== 'number' || newSettings.topP < 0 || newSettings.topP > 1) {
              return new Response(JSON.stringify({ error: 'topP must be a number between 0 and 1' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.frequencyPenalty !== 'number' || newSettings.frequencyPenalty < -2 || newSettings.frequencyPenalty > 2) {
              return new Response(JSON.stringify({ error: 'frequencyPenalty must be a number between -2 and 2' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.presencePenalty !== 'number' || newSettings.presencePenalty < -2 || newSettings.presencePenalty > 2) {
              return new Response(JSON.stringify({ error: 'presencePenalty must be a number between -2 and 2' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.enableReasoning !== 'boolean') {
              return new Response(JSON.stringify({ error: 'enableReasoning must be a boolean' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            // Update settings
            this.settings = { ...this.settings, ...newSettings };
            await this.saveSettings();

            // Notify listeners of settings change
            if (this.onSettingsChange) {
              this.onSettingsChange(this.settings);
            }

            return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            console.error('Error saving OpenRouter settings:', error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
      },
      "/openrouter/models": {
        GET: async (req) => {
          try {
            if (!this.settings.apiKey) {
              return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            const response = await fetch('https://openrouter.ai/api/v1/models', {
              headers: {
                'Authorization': `Bearer ${this.settings.apiKey}`
              }
            });

            if (!response.ok) {
              throw new Error(`OpenRouter API error: ${response.status}`);
            }

            const data = await response.json();
            return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            console.error('Error fetching OpenRouter models:', error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
      }
    };
  }

  // HasStorage implementation
  getFQDN(): string {
    return 'tools.openrouter.settings';
  }

  setStorage(storage: Storage): void {
    this.storage = storage;
  }

  async init(storage: Storage): Promise<void> {
    this.storage = storage;
    const tableName = storage.getTableName();

    // Create table if needed
    await storage.execute(
      `CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY,
        apiKey TEXT NOT NULL,
        model TEXT NOT NULL,
        maxTokens INTEGER NOT NULL,
        temperature REAL NOT NULL,
        topP REAL NOT NULL,
        frequencyPenalty REAL NOT NULL,
        presencePenalty REAL NOT NULL,
        enableReasoning INTEGER NOT NULL DEFAULT 1
      )`
    );

    // Check version and migrate
    const currentVersion = await storage.getComponentVersion();
    if (currentVersion === null) {
      await storage.setComponentVersion(2);
      await this.migrateFromJSON();
    } else if (currentVersion < 2) {
      await this.migrateToVersion2();
      await storage.setComponentVersion(2);
    }

    // Load settings
    await this.loadSettings();
  }

  private async migrateFromJSON(): Promise<void> {
    try {
      const data = await readFile('openrouter-settings.json', 'utf-8');
      const loadedSettings = JSON.parse(data);
      const settings = { ...this.settings, ...loadedSettings };
      await this.storage!.insert(settings);
      await unlink('openrouter-settings.json');
      console.log('Migrated OpenRouter settings from JSON to database');
    } catch (error) {
      // No JSON file or migration failed, insert defaults
      await this.storage!.insert(this.settings);
    }
  }

  private async migrateToVersion2(): Promise<void> {
    try {
      // Add enableReasoning column to existing table
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN enableReasoning INTEGER NOT NULL DEFAULT 1`);
      console.log('Migrated OpenRouter settings to version 2: added enableReasoning column');
    } catch (error) {
      console.error('Failed to migrate to version 2:', error);
    }
  }
}