import { ToolboxTool } from "../../interfaces/ToolboxTool.js";
import { HasStorage, Storage } from "../../interfaces/Storage.js";

interface OllamaSettings {
  baseUrl: string;
  model: string;
  temperature: number;
  topP: number;
  topK: number;
  numCtx: number;
  numGPU: number;
  numThread: number;
  repeatPenalty: number;
  repeatLastN: number;
  seed: number;
  stop: string[];
  format: string;
}

export class OllamaSettingsTool implements ToolboxTool, HasStorage {
  private storage?: Storage;
  private settings: OllamaSettings;
  private onSettingsChange?: (settings: OllamaSettings) => void;

  constructor(toolboxCollector: any, onSettingsChange?: (settings: OllamaSettings) => void) {
    toolboxCollector.register('/widgets/ollama-settings-widget.js');
    this.onSettingsChange = onSettingsChange;
    this.settings = {
      baseUrl: 'http://localhost:11434',
      model: 'gemma3:1b',
      temperature: 0.8,
      topP: 0.9,
      topK: 40,
      numCtx: 4096,
      numGPU: 0,
      numThread: 0,
      repeatPenalty: 1.1,
      repeatLastN: 64,
      seed: -1,
      stop: [],
      format: ''
    };
  }

  private async loadSettings() {
    if (!this.storage) return;

    try {
      const rows = await this.storage.findAll();
      if (rows.length > 0) {
        this.settings = {
          ...this.settings,
          ...rows[0],
          stop: Array.isArray(rows[0].stop) ? rows[0].stop : JSON.parse(rows[0].stop || '[]')
        };
      }
    } catch (error) {
      console.log('Using default Ollama settings');
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
      console.error('Failed to save Ollama settings:', error);
      throw error;
    }
  }

  getSettings(): OllamaSettings {
    return { ...this.settings };
  }

  getRoutes(): Record<string, any> {
    return {
      "/ollama/settings": {
        GET: async (req) => {
          return new Response(JSON.stringify(this.settings), { headers: { 'Content-Type': 'application/json' } });
        },
        POST: async (req) => {
          try {
            const newSettings = await req.json();

            if (typeof newSettings.baseUrl !== 'string') {
              return new Response(JSON.stringify({ error: 'baseUrl must be a string' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.model !== 'string' || newSettings.model.trim() === '') {
              return new Response(JSON.stringify({ error: 'model must be a non-empty string' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.temperature !== 'number' || newSettings.temperature < 0 || newSettings.temperature > 2) {
              return new Response(JSON.stringify({ error: 'temperature must be a number between 0 and 2' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.topP !== 'number' || newSettings.topP < 0 || newSettings.topP > 1) {
              return new Response(JSON.stringify({ error: 'topP must be a number between 0 and 1' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.topK !== 'number' || newSettings.topK < 0) {
              return new Response(JSON.stringify({ error: 'topK must be a number greater than 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.numCtx !== 'number' || newSettings.numCtx < 1) {
              return new Response(JSON.stringify({ error: 'numCtx must be a number greater than 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.numGPU !== 'number' || newSettings.numGPU < 0) {
              return new Response(JSON.stringify({ error: 'numGPU must be a number greater than or equal to 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.numThread !== 'number' || newSettings.numThread < 0) {
              return new Response(JSON.stringify({ error: 'numThread must be a number greater than or equal to 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.repeatPenalty !== 'number' || newSettings.repeatPenalty < 0) {
              return new Response(JSON.stringify({ error: 'repeatPenalty must be a number greater than 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.repeatLastN !== 'number' || newSettings.repeatLastN < 0) {
              return new Response(JSON.stringify({ error: 'repeatLastN must be a number greater than or equal to 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.seed !== 'number') {
              return new Response(JSON.stringify({ error: 'seed must be a number' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (!Array.isArray(newSettings.stop) || !newSettings.stop.every(x => typeof x === 'string')) {
              return new Response(JSON.stringify({ error: 'stop must be an array of strings' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.format !== 'string') {
              return new Response(JSON.stringify({ error: 'format must be a string' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            this.settings = { ...this.settings, ...newSettings };
            await this.saveSettings();

            if (this.onSettingsChange) {
              this.onSettingsChange(this.settings);
            }

            return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            console.error('Error saving Ollama settings:', error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
      },
      "/ollama/models": {
        GET: async (req) => {
          try {
            const response = await fetch(`${this.settings.baseUrl}/api/tags`);

            if (!response.ok) {
              throw new Error(`Ollama API error: ${response.status}`);
            }

            const data = await response.json();
            return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            console.error('Error fetching Ollama models:', error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
      }
    };
  }

  getFQDN(): string {
    return 'tools.ollama.settings';
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
        numCtx INTEGER NOT NULL,
        numGPU INTEGER NOT NULL,
        numThread INTEGER NOT NULL,
        repeatPenalty REAL NOT NULL,
        repeatLastN INTEGER NOT NULL,
        seed INTEGER NOT NULL,
        stop TEXT NOT NULL,
        format TEXT NOT NULL
      )`
    );

    const currentVersion = await storage.getComponentVersion();
    if (currentVersion === null) {
      await storage.setComponentVersion(1);
      const settingsToSave = {
        ...this.settings,
        stop: JSON.stringify(this.settings.stop)
      };
      await this.storage.insert(settingsToSave);
    }

    await this.loadSettings();
  }
}
