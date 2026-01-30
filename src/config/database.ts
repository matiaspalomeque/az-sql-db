import { DatabaseConfig } from '../models/types.js';

export interface MaintenanceConfig {
  rebuildDelayMs: number;
  reorganizeDelayMs: number;
  retryMaxAttempts: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  rebuildOnline: boolean;
}

export function loadMaintenanceConfig(cliOverride?: boolean): MaintenanceConfig {
  // Priority: CLI flag > env var > default true
  const envValue = process.env.INDEX_REBUILD_ONLINE?.toLowerCase();
  const rebuildOnline = cliOverride !== undefined
    ? cliOverride
    : envValue === 'false' ? false : true;

  return {
    rebuildDelayMs: parseInt(process.env.INDEX_REBUILD_DELAY_MS || '2000', 10),
    reorganizeDelayMs: parseInt(process.env.INDEX_REORGANIZE_DELAY_MS || '500', 10),
    retryMaxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || '3', 10),
    retryBaseDelayMs: parseInt(process.env.RETRY_BASE_DELAY_MS || '1000', 10),
    retryMaxDelayMs: parseInt(process.env.RETRY_MAX_DELAY_MS || '30000', 10),
    rebuildOnline,
  };
}

export function loadDatabaseConfig(): DatabaseConfig {
  const requiredEnvVars = ['DB_SERVER', 'DB_USER', 'DB_PASSWORD'];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  return {
    server: process.env.DB_SERVER!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    port: parseInt(process.env.DB_PORT || '1433', 10),
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: false,
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000', 10),
      requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT || '300000', 10),
    },
  };
}
