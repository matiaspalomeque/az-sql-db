export interface DatabaseConfig {
  server: string;
  user: string;
  password: string;
  port: number;
  database?: string;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
    connectionTimeout: number;
    requestTimeout: number;
  };
}

export interface IndexInfo {
  databaseName: string;
  schemaName: string;
  tableName: string;
  indexName: string;
  fragmentationPercent: number;
  pageCount: number;
}

export enum MaintenanceAction {
  REBUILD = 'REBUILD',
  REORGANIZE = 'REORGANIZE',
  SKIP = 'SKIP'
}

export interface MaintenanceResult {
  action: MaintenanceAction;
  success: boolean;
  duration: number;
  error?: string;
  retryAttempts?: number;
  wasRetried?: boolean;
}

export interface DatabaseResult {
  databaseName: string;
  success: boolean;
  indexesProcessed: number;
  indexesRebuilt: number;
  indexesReorganized: number;
  indexesSkipped: number;
  totalDuration: number;
  errors: string[];
  criticalFailure?: boolean;
  manuallySkipped?: boolean;
}
