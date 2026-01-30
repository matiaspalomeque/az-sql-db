import sql from 'mssql';
import { DatabaseConfig } from '../models/types.js';

export class DatabaseService {
  private pools: Map<string, sql.ConnectionPool> = new Map();
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    const masterPool = await this.getConnectionPool();
    console.log('👋 Connected to Azure SQL Server');
  }

  private async getConnectionPool(database?: string): Promise<sql.ConnectionPool> {
    const poolKey = database || 'master';

    if (this.pools.has(poolKey)) {
      return this.pools.get(poolKey)!;
    }

    const poolConfig = {
      ...this.config,
      database: database,
    } as sql.config;

    const pool = new sql.ConnectionPool(poolConfig);
    await pool.connect();

    this.pools.set(poolKey, pool);
    return pool;
  }

  async executeQuery<T>(query: string, database?: string): Promise<T[]> {
    const poolKey = database || 'master';

    try {
      const pool = await this.getConnectionPool(database);
      const request = pool.request();
      const result = await request.query(query);
      return result.recordset as T[];
    } catch (error) {
      if (this.isConnectionError(error)) {
        console.log(`    🔄 Connection error detected, removing pool: ${poolKey}`);
        const pool = this.pools.get(poolKey);
        if (pool) {
          try { await pool.close(); } catch {}
          this.pools.delete(poolKey);
        }
      }
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  private isConnectionError(error: any): boolean {
    const errorString = String(error).toLowerCase();
    return /connection|socket|econnreset|timeout/.test(errorString);
  }

  async getDatabaseList(): Promise<string[]> {
    const query = `
      SELECT name
      FROM sys.databases
      WHERE database_id > 4
        AND state_desc = 'ONLINE'
        AND name NOT IN ('master', 'tempdb', 'model', 'msdb')
      ORDER BY name;
    `;

    const results = await this.executeQuery<{ name: string }>(query);
    return results.map(r => r.name);
  }

  async close(): Promise<void> {
    for (const [key, pool] of this.pools.entries()) {
      await pool.close();
    }
    this.pools.clear();
    console.log('\n😴 Closing connections - Done');
  }
}
