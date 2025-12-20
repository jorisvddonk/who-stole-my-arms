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
    toolboxCollector.register("/widgets/formatter-settings-widget.js");
    this.settings = {
      selectedFormatter: "chatHistoryMessageFormatter_Basic",
    };
  }

  static async ensureTableExists(storage: Storage) {
    const tableName = storage.getTableName();
    await storage.execute(
      `CREATE TABLE IF NOT EXISTS ${tableName} (id TEXT PRIMARY KEY, key TEXT, value TEXT)`,
    );
  }

  static async getSelectedFormatter(
    dbManager: DatabaseManager,
    sessionId: string,
  ): Promise<string> {
    const db = await dbManager.getSessionDB(sessionId);
    const formatterStorage = new Storage(
      db,
      "tools.formatter.settings",
      sessionId,
    );
    await FormatterSettingsTool.ensureTableExists(formatterStorage);
    const formatterSettings = await formatterStorage.findAll();
    const selectedFormatterRow = formatterSettings.find(
      (r: any) => r.key === "selectedFormatter",
    );
    return selectedFormatterRow
      ? selectedFormatterRow.value
      : "chatHistoryMessageFormatter_Basic";
  }

  getFQDN(): string {
    return "tools.formatter.settings";
  }

  setStorage(storage: Storage): void {
    this.storage = storage;
  }

  private static async migrateTableIfNeeded(
    storage: Storage,
  ): Promise<boolean> {
    const tableName = storage.getTableName();
    let migrated = false;
    try {
      // Check if table exists with old schema (selectedFormatter column)
      await storage.query(`SELECT selectedFormatter FROM ${tableName} LIMIT 1`);
      // If we get here, table has old schema - drop and recreate
      console.log(
        `\x1b[33mDropping old table ${tableName} with incompatible schema\x1b[0m`,
      );
      await storage.execute(`DROP TABLE ${tableName}`);
      migrated = true;
    } catch (e) {
      // Table doesn't exist or already has new schema
    }
    return migrated;
  }

  async init(storage: Storage): Promise<void> {
    this.storage = storage;
    await FormatterSettingsTool.migrateTableIfNeeded(storage);
    await FormatterSettingsTool.ensureTableExists(storage);

    const currentVersion = await storage.getComponentVersion();
    if (currentVersion === null) {
      await storage.setComponentVersion(1);
      await storage.insert(
        {
          key: "selectedFormatter",
          value: "chatHistoryMessageFormatter_Basic",
        },
        "selectedFormatter",
      );
    }
    await this.loadSettings();
  }

  private async loadSettings() {
    if (!this.storage) return;
    try {
      const rows = await this.storage.findAll();
      const loadedSettings: any = {};
      for (const row of rows) {
        loadedSettings[row.key] = row.value;
      }
      this.settings = { ...this.settings, ...loadedSettings };
    } catch (error) {
      console.error("Error loading formatter settings:", error);
    }
  }

  getRoutes(): Record<string, any> {
    return {
      "/sessions/:sessionId/formatter/settings": {
        GET: async (req) => {
          try {
            const storage = (req as any).context.get("storage");
            await FormatterSettingsTool.migrateTableIfNeeded(storage);
            await FormatterSettingsTool.ensureTableExists(storage);
            const rows = await storage.findAll();
            const selectedFormatterRow = rows.find(
              (r: any) => r.key === "selectedFormatter",
            );
            const settings = {
              selectedFormatter: selectedFormatterRow
                ? selectedFormatterRow.value
                : "chatHistoryMessageFormatter_Basic",
            };
            return new Response(JSON.stringify(settings), {
              headers: { "Content-Type": "application/json" },
            });
          } catch (error) {
            console.error("Error loading formatter settings:", error);
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
        },
        POST: async (req) => {
          try {
            const storage = (req as any).context.get("storage");
            await FormatterSettingsTool.migrateTableIfNeeded(storage);
            await FormatterSettingsTool.ensureTableExists(storage);
            const newSettings = await req.json();

            if (typeof newSettings.selectedFormatter !== "string") {
              return new Response(
                JSON.stringify({ error: "selectedFormatter must be a string" }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" },
                },
              );
            }

            const registry = FormatterRegistry.getInstance();
            if (!registry.get(newSettings.selectedFormatter)) {
              return new Response(
                JSON.stringify({ error: "Formatter not found" }),
                {
                  status: 400,
                  headers: { "Content-Type": "application/json" },
                },
              );
            }

            const existingRows = await storage.findAll();
            const existingFormatterRow = existingRows.find(
              (r: any) => r.key === "selectedFormatter",
            );
            if (existingFormatterRow) {
              await storage.update(existingFormatterRow.id, {
                value: newSettings.selectedFormatter,
              });
            } else {
              await storage.insert(
                {
                  key: "selectedFormatter",
                  value: newSettings.selectedFormatter,
                },
                "selectedFormatter",
              );
            }

            return new Response(JSON.stringify({ success: true }), {
              headers: { "Content-Type": "application/json" },
            });
          } catch (error) {
            console.error("Error saving formatter settings:", error);
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
        },
      },
    };
  }
}
