import { Database } from "bun:sqlite";
import { join } from "path";
import { mkdir, readdir, unlink } from "fs/promises";
import { HasStorage, Storage } from "../interfaces/Storage.js";

export class Storage implements Storage {
  constructor(private db: Database, private fqdn: string, private sessionId?: string) {}

  getTableName(): string {
    if (this.sessionId) {
      return `session_${this.sessionId}_${this.fqdn.replace(/\./g, '_')}`;
    } else {
      return `global_${this.fqdn.replace(/\./g, '_')}`;
    }
  }

  getDB(): Database {
    return this.db;
  }

  getSessionId(): string | undefined {
    return this.sessionId;
  }

  execute(sql: string, params?: any[]): any {
    return params ? this.db.run(sql, params) : this.db.run(sql);
  }

  query(sql: string, params?: any[]): any[] {
    return this.db.query(sql).all(params);
  }

  async getComponentVersion(): Promise<number | null> {
    const rows = this.query('SELECT version FROM component_versions WHERE fqdn = ?', [this.fqdn]);
    return rows.length > 0 ? rows[0].version : null;
  }

  async setComponentVersion(version: number): Promise<void> {
    this.execute('INSERT OR REPLACE INTO component_versions (fqdn, version) VALUES (?, ?)', [this.fqdn, version]);
  }

  async insert(data: Record<string, any>): Promise<number> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${this.getTableName()} (${keys.join(', ')}) VALUES (${placeholders})`;
    const result = this.execute(sql, values);
    return result.lastInsertRowid;
  }

  async update(id: number, data: Record<string, any>): Promise<void> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map(key => `${key} = ?`).join(', ');
    const sql = `UPDATE ${this.getTableName()} SET ${setClause} WHERE id = ?`;
    this.execute(sql, [...values, id]);
  }

  async findById(id: number): Promise<Record<string, any> | null> {
    const rows = this.query(`SELECT * FROM ${this.getTableName()} WHERE id = ?`, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  async findAll(): Promise<Record<string, any>[]> {
    return this.query(`SELECT * FROM ${this.getTableName()}`);
  }

  async delete(id: number): Promise<void> {
    this.execute(`DELETE FROM ${this.getTableName()} WHERE id = ?`, [id]);
  }
}

export class DatabaseManager {
  private globalDB: Database;
  private sessionsDir: string;
  private sessionComponents = new Map<string, HasStorage>();

  constructor(dataDir: string = './data') {
    this.sessionsDir = join(dataDir, 'sessions');
    this.ensureDirectories();
    this.globalDB = new Database(join(dataDir, 'global.db'));
    this.initSharedTables();
  }

  private async ensureDirectories(): Promise<void> {
    await mkdir(join(this.sessionsDir, '..'), { recursive: true });
  }

  private initSharedTables(): void {
    this.globalDB.run(`
      CREATE TABLE IF NOT EXISTS component_versions (
        fqdn TEXT PRIMARY KEY,
        version INTEGER NOT NULL
      )
    `);
  }

  async registerGlobalComponent(component: HasStorage): Promise<void> {
    try {
      const storage = new Storage(this.globalDB, component.getFQDN());
      await component.init(storage);
    } catch (error) {
      console.warn(`Failed to initialize global component ${component.getFQDN()}:`, error);
    }
  }

  async registerSessionComponent(component: HasStorage): Promise<void> {
    this.sessionComponents.set(component.getFQDN(), component);
  }

  // Utility methods
  async listSessions(): Promise<string[]> {
    try {
      const files = await readdir(this.sessionsDir);
      return files
        .filter(file => file.endsWith('.db'))
        .map(file => file.replace('.db', ''));
    } catch {
      return [];
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const dbPath = join(this.sessionsDir, `${sessionId}.db`);
      await unlink(dbPath);
    } catch (error) {
      console.warn(`Failed to delete session ${sessionId}:`, error);
    }
  }

  getGlobalDB(): Database {
    return this.globalDB;
  }

  async getSessionDB(sessionId: string): Promise<Database> {
    const dbPath = join(this.sessionsDir, `${sessionId}.db`);
    await mkdir(this.sessionsDir, { recursive: true });
    const db = new Database(dbPath);
    db.run(`
      CREATE TABLE IF NOT EXISTS component_versions (
        fqdn TEXT PRIMARY KEY,
        version INTEGER NOT NULL
      )
    `);
    return db;
  }
}