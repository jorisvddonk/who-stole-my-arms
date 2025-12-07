import { ToolboxTool } from "../../interfaces/ToolboxTool.js";
import { HasStorage } from "../../interfaces/Storage.js";
import { Storage } from "../../lib/database-manager.js";
import { FormatterRegistry } from "../../lib/formatters.js";
import { DatabaseManager } from "../../lib/database-manager.js";

interface FormatterSettings {
  selectedFormatter: string;
}

export class FormatterSettingsTool implements ToolboxTool, HasStorage {
  private storage?: Storage;
  private settings: FormatterSettings;

  constructor(toolboxCollector: any) {
    toolboxCollector.register('/widgets/formatter-settings-widget.js');
    this.settings = {
      selectedFormatter: 'chatHistoryMessageFormatter_Basic'
    };
  }

  static async ensureTableExists(storage: Storage) {
    const tableName = storage.getTableName();
    await storage.execute(`CREATE TABLE IF NOT EXISTS ${tableName} (
      id INTEGER PRIMARY KEY,
      selectedFormatter TEXT NOT NULL
    )`);
  }

  static async getSelectedFormatter(dbManager: DatabaseManager, sessionId: string): Promise<string> {
    const db = await dbManager.getSessionDB(sessionId);
    // Get formatter settings from session storage
    const formatterStorage = new Storage(db, 'tools.formatter.settings', sessionId);
    // Ensure table exists
    await FormatterSettingsTool.ensureTableExists(formatterStorage);
    const formatterSettings = await formatterStorage.findAll();
    return formatterSettings.length > 0 ? formatterSettings[0].selectedFormatter : 'chatHistoryMessageFormatter_Basic';
  }

  private async loadSettings() {
    if (!this.storage) return;

    try {
      const rows = await this.storage.findAll();
      if (rows.length > 0) {
        const loadedSettings = rows[0];
        this.settings = {
          ...this.settings,
          ...loadedSettings
        };
      }
    } catch (error) {
      console.log('Using default formatter settings');
    }
  }

  private async saveSettings() {
    if (!this.storage) return;

    try {
      await this.storage.update(1, this.settings);
    } catch (error) {
      console.error('Failed to save formatter settings:', error);
      throw error;
    }
  }

  getSettings(): FormatterSettings {
    return { ...this.settings };
  }

  getRoutes(): Record<string, any> {
    return {
      "/sessions/:sessionId/formatter/settings": {
        GET: async (req) => {
          try {
            const storage = (req as any).context.get('storage');
            // Ensure table exists
            await FormatterSettingsTool.ensureTableExists(storage);
            const rows = await storage.findAll();
            const settings = rows.length > 0 ? rows[0] : { selectedFormatter: 'chatHistoryMessageFormatter_Basic' };
            return new Response(JSON.stringify(settings), { headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            console.error('Error loading formatter settings:', error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        },
        POST: async (req) => {
          try {
            const storage = (req as any).context.get('storage');
            // Ensure table exists
            await FormatterSettingsTool.ensureTableExists(storage);
            const newSettings = await req.json();

            // Validate settings
            if (typeof newSettings.selectedFormatter !== 'string') {
              return new Response(JSON.stringify({ error: 'selectedFormatter must be a string' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            // Check if formatter exists
            const registry = FormatterRegistry.getInstance();
            if (!registry.get(newSettings.selectedFormatter)) {
              return new Response(JSON.stringify({ error: 'Formatter not found' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }

            // Check if settings already exist
            const existingRows = await storage.findAll();
            if (existingRows.length > 0) {
              // Update existing
              await storage.update(1, newSettings);
            } else {
              // Insert new
              await storage.insert(newSettings);
            }

            return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
          } catch (error) {
            console.error('Error saving formatter settings:', error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
        }
      }
    };
  }

  // HasStorage implementation
  getFQDN(): string {
    return 'tools.formatter.settings';
  }

  setStorage(storage: Storage): void {
    this.storage = storage;
  }

  async init(storage: Storage): Promise<void> {
    this.storage = storage;
    const tableName = storage.getTableName();

    // Create table if needed
    await FormatterSettingsTool.ensureTableExists(storage);

    const currentVersion = await storage.getComponentVersion();
    if (currentVersion === null) {
      await storage.setComponentVersion(1);
      // Insert default settings
      await storage.insert({ selectedFormatter: 'chatHistoryMessageFormatter_Basic' });
    }

    // Load settings
    await this.loadSettings();
  }
}