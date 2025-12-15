/**
 * Interface for components that require storage functionality.
 */
export interface HasStorage {
  /** Gets the fully qualified domain name for storage isolation */
  getFQDN(): string;
  /** Initializes the component with storage access */
  init(storage: Storage): Promise<void>;
}

/**
 * Interface for database storage operations with session isolation.
 */
export interface Storage {
  /** Gets the table name for this storage instance */
  getTableName(): string;
  /** Gets the underlying database connection */
  getDB(): any;
  /** Gets the current session ID, if any */
  getSessionId(): string | undefined;
  /** Executes raw SQL with optional parameters */
  execute(sql: string, params?: any[]): any;
  /** Executes a SELECT query and returns results */
  query(sql: string, params?: any[]): any[];
  /** Gets the version of the component's data schema */
  getComponentVersion(): Promise<number | null>;
  /** Sets the version of the component's data schema */
  setComponentVersion(version: number): Promise<void>;
  /** Inserts a new record and returns its ID */
  insert(data: Record<string, any>, id?: string): Promise<string>;
  /** Updates an existing record by ID */
  update(id: string, data: Record<string, any>): Promise<void>;
  /** Finds a record by ID */
  findById(id: string): Promise<Record<string, any> | null>;
  /** Finds all records in the table */
  findAll(): Promise<Record<string, any>[]>;
  /** Deletes a record by ID */
  delete(id: string): Promise<void>;
}

