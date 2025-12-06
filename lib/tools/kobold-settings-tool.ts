import { ToolboxTool } from "../../interfaces/ToolboxTool.js";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

interface KoboldSettings {
  baseUrl: string;
  maxLength: number;
  temperature: number;
  topK: number;
  topP: number;
  repetitionPenalty: number;
  minP: number;
}

export class KoboldSettingsTool implements ToolboxTool {
  private settingsFile: string;
  private settings: KoboldSettings;
  private onSettingsChange?: (settings: KoboldSettings) => void;

  constructor(toolboxCollector: any, onSettingsChange?: (settings: KoboldSettings) => void) {
    toolboxCollector.register('/widgets/kobold-settings-widget.js');
    this.settingsFile = join(process.cwd(), 'kobold-settings.json');
    this.onSettingsChange = onSettingsChange;
    this.settings = {
      baseUrl: 'http://localhost:5001',
      maxLength: 100,
      temperature: 0.7,
      topK: 40,
      topP: 0.9,
      repetitionPenalty: 1.0,
      minP: 0.05
    };
    this.loadSettings();
  }

  private async loadSettings() {
    try {
      const data = await readFile(this.settingsFile, 'utf-8');
      const loadedSettings = JSON.parse(data);
      this.settings = { ...this.settings, ...loadedSettings };
    } catch (error) {
      // File doesn't exist or is invalid, use defaults
      console.log('Using default KoboldCPP settings');
    }
  }

  private async saveSettings() {
    try {
      await writeFile(this.settingsFile, JSON.stringify(this.settings, null, 2));
    } catch (error) {
      console.error('Failed to save KoboldCPP settings:', error);
      throw error;
    }
  }

  getSettings(): KoboldSettings {
    return { ...this.settings };
  }

  getRoutes(): Record<string, any> {
    return {
      "/kobold/settings": {
        GET: async (req) => {
          return new Response(JSON.stringify(this.settings), { headers: { 'Content-Type': 'application/json' } });
        },
        POST: async (req) => {
          try {
            const newSettings = await req.json();

            // Validate settings
            if (typeof newSettings.baseUrl !== 'string') {
              return new Response(JSON.stringify({ error: 'baseUrl must be a string' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.maxLength !== 'number' || newSettings.maxLength < 1) {
              return new Response(JSON.stringify({ error: 'maxLength must be a number greater than 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.temperature !== 'number' || newSettings.temperature < 0 || newSettings.temperature > 2) {
              return new Response(JSON.stringify({ error: 'temperature must be a number between 0 and 2' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.topK !== 'number' || newSettings.topK < 0 || newSettings.topK > 100) {
              return new Response(JSON.stringify({ error: 'topK must be a number between 0 and 100' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.topP !== 'number' || newSettings.topP < 0 || newSettings.topP > 1) {
              return new Response(JSON.stringify({ error: 'topP must be a number between 0 and 1' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.repetitionPenalty !== 'number' || newSettings.repetitionPenalty < 0.1 || newSettings.repetitionPenalty > 2) {
              return new Response(JSON.stringify({ error: 'repetitionPenalty must be a number between 0.1 and 2' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.minP !== 'number' || newSettings.minP < 0 || newSettings.minP > 1) {
              return new Response(JSON.stringify({ error: 'minP must be a number between 0 and 1' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
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
            console.error('Error saving KoboldCPP settings:', error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
      }
    };
  }
}