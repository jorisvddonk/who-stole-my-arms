import { ToolboxTool } from "../../interfaces/ToolboxTool.js";
import { HasStorage, Storage } from "../../interfaces/Storage.js";

interface LlamaCppSettings {
  baseUrl: string;
  model: string;
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  stop: string[];
  repeatPenalty: number;
  presencePenalty: number;
  frequencyPenalty: number;
}

export class LlamaCppSettingsTool implements ToolboxTool, HasStorage {
  private storage?: Storage;
  private settings: LlamaCppSettings;
  private onSettingsChange?: (settings: LlamaCppSettings) => void;

  constructor(toolboxCollector: any, onSettingsChange?: (settings: LlamaCppSettings) => void) {
    this.onSettingsChange = onSettingsChange;
    this.settings = {
      baseUrl: 'http://localhost:8080',
      model: 'llama-3.2-3b-instruct',
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxTokens: 512,
      stop: ['<|tool_call_end|>', '<|agent_call_end|>', '<|error_end|>'],
      repeatPenalty: 1.0,
      presencePenalty: 0,
      frequencyPenalty: 0
    };
  }

  private async loadSettings() {
    if (!this.storage) return;

    try {
      const rows = await this.storage.findAll();
      if (rows.length > 0) {
        const loadedSettings = rows[0];
        this.settings = {
          ...this.settings,
          ...loadedSettings,
          stop: JSON.parse(loadedSettings.stop || '[]')
        };
      }
    } catch {
      console.log('Using default LlamaCpp settings');
    }
  }

  private async saveSettings() {
    if (!this.storage) return;

    try {
      const settingsToSave = {
        ...this.settings,
        stop: JSON.stringify(this.settings.stop)
      };
      await this.storage.update(1, settingsToSave);
    } catch (error) {
      console.error('Failed to save LlamaCpp settings:', error);
      throw error;
    }
  }

  getSettings(): LlamaCppSettings {
    return { ...this.settings };
  }

  getRoutes(): Record<string, any> {
    return {
      "/llama/settings": {
        GET: async (req) => {
          return new Response(JSON.stringify(this.settings), { headers: { 'Content-Type': 'application/json' } });
        },
        POST: async (req) => {
          try {
            const newSettings = await req.json();

            if (typeof newSettings.baseUrl !== 'string') {
              return new Response(JSON.stringify({ error: 'baseUrl must be a string' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.model !== 'string') {
              return new Response(JSON.stringify({ error: 'model must be a string' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.temperature !== 'number' || newSettings.temperature < 0 || newSettings.temperature > 2) {
              return new Response(JSON.stringify({ error: 'temperature must be a number between 0 and 2' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.topP !== 'number' || newSettings.topP < 0 || newSettings.topP > 1) {
              return new Response(JSON.stringify({ error: 'topP must be a number between 0 and 1' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.topK !== 'number' || newSettings.topK < 0) {
              return new Response(JSON.stringify({ error: 'topK must be a number greater than or equal to 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.maxTokens !== 'number' || newSettings.maxTokens < 1) {
              return new Response(JSON.stringify({ error: 'maxTokens must be a number greater than 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (!Array.isArray(newSettings.stop) || !newSettings.stop.every(x => typeof x === 'string')) {
              return new Response(JSON.stringify({ error: 'stop must be an array of strings' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.repeatPenalty !== 'number' || newSettings.repeatPenalty < 0.1 || newSettings.repeatPenalty > 2) {
              return new Response(JSON.stringify({ error: 'repeatPenalty must be a number between 0.1 and 2' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.presencePenalty !== 'number' || newSettings.presencePenalty < -2 || newSettings.presencePenalty > 2) {
              return new Response(JSON.stringify({ error: 'presencePenalty must be a number between -2 and 2' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.frequencyPenalty !== 'number' || newSettings.frequencyPenalty < -2 || newSettings.frequencyPenalty > 2) {
              return new Response(JSON.stringify({ error: 'frequencyPenalty must be a number between -2 and 2' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            this.settings = { ...this.settings, ...newSettings };
            await this.saveSettings();

            if (this.onSettingsChange) {
              this.onSettingsChange(this.settings);
            }

            return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            console.error('Error saving LlamaCpp settings:', error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
      }
    };
  }

  getFQDN(): string {
    return 'tools.llama.settings';
  }

  setStorage(storage: Storage): void {
    this.storage = storage;
  }

  async init(storage: Storage): Promise<void> {
    this.storage = storage;
    const tableName = storage.getTableName();

    await storage.execute(
      `CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY,
        baseUrl TEXT NOT NULL,
        model TEXT NOT NULL,
        temperature REAL NOT NULL,
        topP REAL NOT NULL,
        topK INTEGER NOT NULL,
        maxTokens INTEGER NOT NULL,
        stop TEXT NOT NULL,
        repeatPenalty REAL NOT NULL,
        presencePenalty REAL NOT NULL,
        frequencyPenalty REAL NOT NULL
      )`
    );

    const currentVersion = await storage.getComponentVersion();
    if (currentVersion === null) {
      await storage.setComponentVersion(1);
      await this.loadSettings();
    }

    await this.loadSettings();
  }
}
