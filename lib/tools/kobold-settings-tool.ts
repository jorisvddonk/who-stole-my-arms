import { ToolboxTool } from "../../interfaces/ToolboxTool.js";
import { HasStorage, Storage } from "../../interfaces/Storage.js";
import { readFile, unlink } from "fs/promises";

interface KoboldSettings {
  baseUrl: string;
  n: number;
  maxContextLength: number;
  maxLength: number;
  repetitionPenalty: number;
  temperature: number;
  topP: number;
  topK: number;
  topA: number;
  typical: number;
  tfs: number;
  repPenRange: number;
  repPenSlope: number;
  samplerOrder: number[];
  memory: string;
  trimStop: boolean;
  minP: number;
  dynatempRange: number;
  dynatempExponent: number;
  smoothingFactor: number;
  nsigma: number;
  bannedTokens: number[];
  renderSpecial: boolean;
  logprobs: boolean;
  replaceInstructPlaceholders: boolean;
  presencePenalty: number;
  logitBias: Record<string, number>;
  stopSequence: string[];
  useDefaultBadwordsids: boolean;
  bypassEos: boolean;
}

export class KoboldSettingsTool implements ToolboxTool, HasStorage {
  private storage?: Storage;
  private settings: KoboldSettings;
  private onSettingsChange?: (settings: KoboldSettings) => void;

  constructor(toolboxCollector: any, onSettingsChange?: (settings: KoboldSettings) => void) {
    toolboxCollector.register('/widgets/kobold-settings-widget.js');
    this.onSettingsChange = onSettingsChange;
    this.settings = {
      baseUrl: 'http://localhost:5001',
      n: 1,
      maxContextLength: 10240,
      maxLength: 100,
      repetitionPenalty: 1.05,
      temperature: 0.75,
      topP: 0.92,
      topK: 100,
      topA: 0,
      typical: 1,
      tfs: 1,
      repPenRange: 360,
      repPenSlope: 0.7,
      samplerOrder: [6, 0, 1, 3, 4, 2, 5],
      memory: '',
      trimStop: true,
      minP: 0,
      dynatempRange: 0,
      dynatempExponent: 1,
      smoothingFactor: 0,
      nsigma: 0,
      bannedTokens: [],
      renderSpecial: false,
      logprobs: false,
      replaceInstructPlaceholders: true,
      presencePenalty: 0,
      logitBias: {},
      stopSequence: ['{{[INPUT]}}', '{{[OUTPUT]}}'],
      useDefaultBadwordsids: false,
      bypassEos: false
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
          samplerOrder: JSON.parse(loadedSettings.samplerOrder || '[]'),
          bannedTokens: JSON.parse(loadedSettings.bannedTokens || '[]'),
          logitBias: JSON.parse(loadedSettings.logitBias || '{}'),
          stopSequence: JSON.parse(loadedSettings.stopSequence || '[]'),
          trimStop: loadedSettings.trimStop === 1,
          renderSpecial: loadedSettings.renderSpecial === 1,
          logprobs: loadedSettings.logprobs === 1,
          replaceInstructPlaceholders: loadedSettings.replaceInstructPlaceholders === 1,
          useDefaultBadwordsids: loadedSettings.useDefaultBadwordsids === 1,
          bypassEos: loadedSettings.bypassEos === 1
        };
      }
    } catch (error) {
      console.log('Using default KoboldCPP settings');
    }
  }

  private async saveSettings() {
    if (!this.storage) return;

    try {
      const settingsToSave = {
        ...this.settings,
        samplerOrder: JSON.stringify(this.settings.samplerOrder),
        bannedTokens: JSON.stringify(this.settings.bannedTokens),
        logitBias: JSON.stringify(this.settings.logitBias),
        stopSequence: JSON.stringify(this.settings.stopSequence),
        trimStop: this.settings.trimStop ? 1 : 0,
        renderSpecial: this.settings.renderSpecial ? 1 : 0,
        logprobs: this.settings.logprobs ? 1 : 0,
        replaceInstructPlaceholders: this.settings.replaceInstructPlaceholders ? 1 : 0,
        useDefaultBadwordsids: this.settings.useDefaultBadwordsids ? 1 : 0,
        bypassEos: this.settings.bypassEos ? 1 : 0
      };
      await this.storage.update(1, settingsToSave);
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
            if (typeof newSettings.n !== 'number' || newSettings.n < 1) {
              return new Response(JSON.stringify({ error: 'n must be a number greater than 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.maxContextLength !== 'number' || newSettings.maxContextLength < 1) {
              return new Response(JSON.stringify({ error: 'maxContextLength must be a number greater than 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.maxLength !== 'number' || newSettings.maxLength < 1) {
              return new Response(JSON.stringify({ error: 'maxLength must be a number greater than 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.repetitionPenalty !== 'number' || newSettings.repetitionPenalty < 0.1 || newSettings.repetitionPenalty > 2) {
              return new Response(JSON.stringify({ error: 'repetitionPenalty must be a number between 0.1 and 2' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.temperature !== 'number' || newSettings.temperature < 0 || newSettings.temperature > 2) {
              return new Response(JSON.stringify({ error: 'temperature must be a number between 0 and 2' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.topP !== 'number' || newSettings.topP < 0 || newSettings.topP > 1) {
              return new Response(JSON.stringify({ error: 'topP must be a number between 0 and 1' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.topK !== 'number' || newSettings.topK < 0 || newSettings.topK > 100) {
              return new Response(JSON.stringify({ error: 'topK must be a number between 0 and 100' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.topA !== 'number' || newSettings.topA < 0 || newSettings.topA > 1) {
              return new Response(JSON.stringify({ error: 'topA must be a number between 0 and 1' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.typical !== 'number' || newSettings.typical < 0 || newSettings.typical > 1) {
              return new Response(JSON.stringify({ error: 'typical must be a number between 0 and 1' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.tfs !== 'number' || newSettings.tfs < 0 || newSettings.tfs > 1) {
              return new Response(JSON.stringify({ error: 'tfs must be a number between 0 and 1' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.repPenRange !== 'number' || newSettings.repPenRange < 0) {
              return new Response(JSON.stringify({ error: 'repPenRange must be a number greater than or equal to 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.repPenSlope !== 'number' || newSettings.repPenSlope < 0) {
              return new Response(JSON.stringify({ error: 'repPenSlope must be a number greater than or equal to 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (!Array.isArray(newSettings.samplerOrder) || !newSettings.samplerOrder.every(x => typeof x === 'number')) {
              return new Response(JSON.stringify({ error: 'samplerOrder must be an array of numbers' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.memory !== 'string') {
              return new Response(JSON.stringify({ error: 'memory must be a string' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.trimStop !== 'boolean') {
              return new Response(JSON.stringify({ error: 'trimStop must be a boolean' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.minP !== 'number' || newSettings.minP < 0 || newSettings.minP > 1) {
              return new Response(JSON.stringify({ error: 'minP must be a number between 0 and 1' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.dynatempRange !== 'number' || newSettings.dynatempRange < 0) {
              return new Response(JSON.stringify({ error: 'dynatempRange must be a number greater than or equal to 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.dynatempExponent !== 'number' || newSettings.dynatempExponent < 0) {
              return new Response(JSON.stringify({ error: 'dynatempExponent must be a number greater than or equal to 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.smoothingFactor !== 'number' || newSettings.smoothingFactor < 0) {
              return new Response(JSON.stringify({ error: 'smoothingFactor must be a number greater than or equal to 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.nsigma !== 'number' || newSettings.nsigma < 0) {
              return new Response(JSON.stringify({ error: 'nsigma must be a number greater than or equal to 0' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (!Array.isArray(newSettings.bannedTokens) || !newSettings.bannedTokens.every(x => typeof x === 'number')) {
              return new Response(JSON.stringify({ error: 'bannedTokens must be an array of numbers' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.renderSpecial !== 'boolean') {
              return new Response(JSON.stringify({ error: 'renderSpecial must be a boolean' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.logprobs !== 'boolean') {
              return new Response(JSON.stringify({ error: 'logprobs must be a boolean' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.replaceInstructPlaceholders !== 'boolean') {
              return new Response(JSON.stringify({ error: 'replaceInstructPlaceholders must be a boolean' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.presencePenalty !== 'number' || newSettings.presencePenalty < 0 || newSettings.presencePenalty > 2) {
              return new Response(JSON.stringify({ error: 'presencePenalty must be a number between 0 and 2' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.logitBias !== 'object' || newSettings.logitBias === null) {
              return new Response(JSON.stringify({ error: 'logitBias must be an object' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (!Array.isArray(newSettings.stopSequence) || !newSettings.stopSequence.every(x => typeof x === 'string')) {
              return new Response(JSON.stringify({ error: 'stopSequence must be an array of strings' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.useDefaultBadwordsids !== 'boolean') {
              return new Response(JSON.stringify({ error: 'useDefaultBadwordsids must be a boolean' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            if (typeof newSettings.bypassEos !== 'boolean') {
              return new Response(JSON.stringify({ error: 'bypassEos must be a boolean' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
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

  // HasStorage implementation
  getFQDN(): string {
    return 'tools.kobold.settings';
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
        baseUrl TEXT NOT NULL,
        n INTEGER NOT NULL,
        maxContextLength INTEGER NOT NULL,
        maxLength INTEGER NOT NULL,
        repetitionPenalty REAL NOT NULL,
        temperature REAL NOT NULL,
        topP REAL NOT NULL,
        topK INTEGER NOT NULL,
        topA REAL NOT NULL,
        typical REAL NOT NULL,
        tfs REAL NOT NULL,
        repPenRange REAL NOT NULL,
        repPenSlope REAL NOT NULL,
        samplerOrder TEXT NOT NULL,
        memory TEXT NOT NULL,
        trimStop INTEGER NOT NULL,
        minP REAL NOT NULL,
        dynatempRange REAL NOT NULL,
        dynatempExponent REAL NOT NULL,
        smoothingFactor REAL NOT NULL,
        nsigma REAL NOT NULL,
        bannedTokens TEXT NOT NULL,
        renderSpecial INTEGER NOT NULL,
        logprobs INTEGER NOT NULL,
        replaceInstructPlaceholders INTEGER NOT NULL,
        presencePenalty REAL NOT NULL,
        logitBias TEXT NOT NULL,
        stopSequence TEXT NOT NULL,
        useDefaultBadwordsids INTEGER NOT NULL,
        bypassEos INTEGER NOT NULL
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
      const data = await readFile('kobold-settings.json', 'utf-8');
      const loadedSettings = JSON.parse(data);
      const settings = { ...this.settings, ...loadedSettings };
      const settingsToSave = {
        ...settings,
        samplerOrder: JSON.stringify(settings.samplerOrder || []),
        bannedTokens: JSON.stringify(settings.bannedTokens || []),
        logitBias: JSON.stringify(settings.logitBias || {}),
        stopSequence: JSON.stringify(settings.stopSequence || []),
        trimStop: settings.trimStop ? 1 : 0,
        renderSpecial: settings.renderSpecial ? 1 : 0,
        logprobs: settings.logprobs ? 1 : 0,
        replaceInstructPlaceholders: settings.replaceInstructPlaceholders ? 1 : 0,
        useDefaultBadwordsids: settings.useDefaultBadwordsids ? 1 : 0,
        bypassEos: settings.bypassEos ? 1 : 0
      };
      await this.storage!.insert(settingsToSave);
      await unlink('kobold-settings.json');
      console.log('Migrated KoboldCPP settings from JSON to database');
    } catch (error) {
      // No JSON file or migration failed, insert defaults
      const settingsToSave = {
        ...this.settings,
        samplerOrder: JSON.stringify(this.settings.samplerOrder),
        bannedTokens: JSON.stringify(this.settings.bannedTokens),
        logitBias: JSON.stringify(this.settings.logitBias),
        stopSequence: JSON.stringify(this.settings.stopSequence),
        trimStop: this.settings.trimStop ? 1 : 0,
        renderSpecial: this.settings.renderSpecial ? 1 : 0,
        logprobs: this.settings.logprobs ? 1 : 0,
        replaceInstructPlaceholders: this.settings.replaceInstructPlaceholders ? 1 : 0,
        useDefaultBadwordsids: this.settings.useDefaultBadwordsids ? 1 : 0,
        bypassEos: this.settings.bypassEos ? 1 : 0
      };
      await this.storage!.insert(settingsToSave);
    }
  }

  private async migrateToVersion2(): Promise<void> {
    try {
      // Add new columns to existing table
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN n INTEGER DEFAULT 1`);
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN maxContextLength INTEGER DEFAULT 10240`);
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN topA REAL DEFAULT 0`);
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN typical REAL DEFAULT 1`);
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN tfs REAL DEFAULT 1`);
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN repPenRange REAL DEFAULT 360`);
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN repPenSlope REAL DEFAULT 0.7`);
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN samplerOrder TEXT DEFAULT '[6,0,1,3,4,2,5]'`);
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN memory TEXT DEFAULT ''`);
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN trimStop INTEGER DEFAULT 1`);
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN dynatempRange REAL DEFAULT 0`);
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN dynatempExponent REAL DEFAULT 1`);
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN smoothingFactor REAL DEFAULT 0`);
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN nsigma REAL DEFAULT 0`);
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN bannedTokens TEXT DEFAULT '[]'`);
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN renderSpecial INTEGER DEFAULT 0`);
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN logprobs INTEGER DEFAULT 0`);
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN replaceInstructPlaceholders INTEGER DEFAULT 1`);
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN presencePenalty REAL DEFAULT 0`);
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN logitBias TEXT DEFAULT '{}'`);
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN stopSequence TEXT DEFAULT '["{{[INPUT]}}","{{[OUTPUT]}}"]'`);
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN useDefaultBadwordsids INTEGER DEFAULT 0`);
      await this.storage!.execute(`ALTER TABLE ${this.storage!.getTableName()} ADD COLUMN bypassEos INTEGER DEFAULT 0`);
      console.log('Migrated Kobold settings to version 2: added new columns');
    } catch (error) {
      console.error('Failed to migrate to version 2:', error);
    }
  }
}