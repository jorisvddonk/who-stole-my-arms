import { ToolboxTool } from "../../interfaces/ToolboxTool.js";
import { HasStorage, Storage } from "../../interfaces/Storage.js";
import * as path from 'path';
import * as os from 'os';

interface ComfyUISettings {
  host: string;
  port: number;
  workflowPath: string;
  outputFolder: string;
  debugBypass: boolean;
}

export class ComfyUISettingsTool implements ToolboxTool, HasStorage {
  private storage?: Storage;
  private settings: ComfyUISettings;
  private onSettingsChange?: (settings: ComfyUISettings) => void;

  constructor(toolboxCollector: any, onSettingsChange?: (settings: ComfyUISettings) => void) {
    toolboxCollector.register('/widgets/comfyui-settings-widget.js');
    this.onSettingsChange = onSettingsChange;
    this.settings = {
      host: 'localhost',
      port: 8188,
      workflowPath: './config/comfyui-workflow.json',
      outputFolder: path.join(os.homedir(), 'ComfyUI', 'output'),
      debugBypass: false
    };
  }

  private async loadSettings() {
    if (!this.storage) return;

    try {
      const rows = await this.storage.findAll();
      if (rows.length > 0) {
        this.settings = { ...this.settings, ...rows[0] };
        this.settings.debugBypass = Boolean(this.settings.debugBypass);
      }
    } catch (error) {
      console.log('Using default ComfyUI settings');
    }
  }

  private async saveSettings() {
    if (!this.storage) return;

    try {
      const settingsToSave = {
        ...this.settings,
        debugBypass: this.settings.debugBypass ? 1 : 0
      };
      const existing = await this.storage.findById('1');
      if (existing) {
        await this.storage.update('1', settingsToSave);
      } else {
        await this.storage.insert(settingsToSave, '1');
      }
    } catch (error) {
      console.error('Failed to save ComfyUI settings:', error);
      throw error;
    }
  }

  getSettings(): ComfyUISettings {
    return { ...this.settings };
  }

  getRoutes(): Record<string, any> {
    return {
      "/comfyui/settings": {
        GET: async (req: any) => {
          return new Response(JSON.stringify(this.settings), { headers: { 'Content-Type': 'application/json' } });
        },
        POST: async (req: any) => {
          try {
            const newSettings = await req.json();

            if (typeof newSettings.host !== 'string' || newSettings.host.trim() === '') {
              return new Response(JSON.stringify({ error: 'host must be a non-empty string' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.port !== 'number' || newSettings.port < 1 || newSettings.port > 65535) {
              return new Response(JSON.stringify({ error: 'port must be a number between 1 and 65535' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.workflowPath !== 'string') {
              return new Response(JSON.stringify({ error: 'workflowPath must be a string' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.debugBypass !== 'boolean') {
              return new Response(JSON.stringify({ error: 'debugBypass must be a boolean' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.outputFolder !== 'string' || newSettings.outputFolder.trim() === '') {
              return new Response(JSON.stringify({ error: 'outputFolder must be a non-empty string' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            this.settings = { ...this.settings, ...newSettings };
            await this.saveSettings();

            if (this.onSettingsChange) {
              this.onSettingsChange(this.settings);
            }

            return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            console.error('Error saving ComfyUI settings:', error);
            return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
      }
    };
  }

  getFQDN(): string {
    return 'tools.comfyui.settings';
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
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        workflowPath TEXT NOT NULL,
        outputFolder TEXT NOT NULL,
        debugBypass INTEGER NOT NULL DEFAULT 0
      )`
    );

    const currentVersion = await storage.getComponentVersion();
    if (currentVersion === null) {
      await storage.setComponentVersion(1);
      await this.storage!.insert(this.settings, '1');
    }

    await this.loadSettings();
  }
}
