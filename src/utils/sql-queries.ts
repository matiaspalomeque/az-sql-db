export const SQL_QUERIES = {
  GET_USER_DATABASES: `
    SELECT name
    FROM sys.databases
    WHERE database_id > 4
      AND state_desc = 'ONLINE'
      AND name NOT IN ('master', 'tempdb', 'model', 'msdb')
    ORDER BY name;
  `,

  GET_FRAGMENTED_INDEXES: `
    SELECT
      s.name AS SchemaName,
      t.name AS TableName,
      i.name AS IndexName,
      ips.avg_fragmentation_in_percent AS FragmentationPercent,
      ips.page_count AS PageCount
    FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') AS ips
    INNER JOIN sys.indexes AS i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
    INNER JOIN sys.tables AS t ON i.object_id = t.object_id
    INNER JOIN sys.schemas AS s ON t.schema_id = s.schema_id
    WHERE ips.index_id > 0
      AND ips.page_count > 100
      AND t.is_ms_shipped = 0
      AND i.name IS NOT NULL
    ORDER BY ips.avg_fragmentation_in_percent DESC;
  `,

  REBUILD_INDEX: (schemaName: string, tableName: string, indexName: string, online: boolean = true): string =>
    `ALTER INDEX [${indexName}] ON [${schemaName}].[${tableName}] REBUILD WITH (ONLINE = ${online ? 'ON' : 'OFF'});`,

  REORGANIZE_INDEX: (schemaName: string, tableName: string, indexName: string): string =>
    `ALTER INDEX [${indexName}] ON [${schemaName}].[${tableName}] REORGANIZE;`,

  UPDATE_STATISTICS: (schemaName: string, tableName: string, indexName: string): string =>
    `UPDATE STATISTICS [${schemaName}].[${tableName}] [${indexName}] WITH FULLSCAN;`,
};
