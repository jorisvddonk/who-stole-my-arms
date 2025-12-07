export interface HasStorage {
  getFQDN(): string;
  init(storage: Storage): Promise<void>;
}

export interface Storage {
  getTableName(): string;
  getDB(): any;
  getSessionId(): string | undefined;
  execute(sql: string, params?: any[]): any;
  query(sql: string, params?: any[]): any[];
  getComponentVersion(): Promise<number | null>;
  setComponentVersion(version: number): Promise<void>;
  insert(data: Record<string, any>, id?: string): Promise<string>;
  update(id: string, data: Record<string, any>): Promise<void>;
  findById(id: string): Promise<Record<string, any> | null>;
  findAll(): Promise<Record<string, any>[]>;
  delete(id: string): Promise<void>;
}