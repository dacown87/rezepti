/**
 * Database interface for platform-agnostic database operations
 * This allows switching between better-sqlite3 (Node.js) and expo-sqlite (React Native)
 * 
 * Note: Full implementations are created when needed for mobile support
 */

export interface DatabaseConnection {
  /** Initialize database connection */
  connect(): Promise<void>;
  
  /** Close database connection */
  close(): Promise<void>;
  
  /** Execute SQL query without returning results */
  exec(sql: string): Promise<void>;
  
  /** Prepare a SQL statement */
  prepare(sql: string): DatabaseStatement;
  
  /** Run a query and get all results */
  all<T = Record<string, unknown>>(sql: string, params?: any[]): Promise<T[]>;
  
  /** Run a query and get first result */
  get<T = Record<string, unknown>>(sql: string, params?: any[]): Promise<T | null>;
  
  /** Run insert/update/delete and get last inserted ID */
  run(sql: string, params?: any[]): Promise<{ lastInsertRowid: number }>;
}

export interface DatabaseStatement {
  /** Execute statement without returning results */
  run(params?: any[]): Promise<void>;
  
  /** Execute statement and get all results */
  all<T = Record<string, unknown>>(params?: any[]): Promise<T[]>;
  
  /** Execute statement and get first result */
  get<T = Record<string, unknown>>(params?: any[]): Promise<T | null>;
}

/**
 * Database factory placeholder
 * Actual implementations will be added when needed for mobile
 */
export class DatabaseFactory {
  static async createNodeDatabase(path: string): Promise<DatabaseConnection> {
    // Use better-sqlite3 directly for now
    // When mobile support is needed, create proper abstraction
    throw new Error("Use db.ts or db-react.ts for database operations");
  }
  
  static async createReactNativeDatabase(name: string): Promise<DatabaseConnection> {
    throw new Error("React Native database not implemented yet");
  }
}