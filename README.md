# Azure SQL Database Index Maintenance Tool

A Bun TypeScript application that performs intelligent index maintenance on Azure SQL Server databases. The tool analyzes fragmentation levels and automatically determines the best maintenance action for each index.

## Features

- **Intelligent Maintenance**: Automatically determines the best action based on fragmentation levels
  - REBUILD for heavily fragmented indexes (≥30%)
  - REORGANIZE for moderately fragmented indexes (10-30%)
  - SKIP for healthy indexes (<10%)
- **Interactive Keyboard Controls**: Real-time control during long-running operations
  - Skip entire database mid-operation with a single keypress
  - Pause and resume processing on demand
  - Automatically disables in non-interactive environments (pipes, cron, Docker)
- **Flexible Execution**: Process all databases or specify specific ones
- **Online/Offline Modes**: Control rebuild behavior to minimize downtime
- **Sequential Processing**: Processes databases one at a time for controlled resource usage
- **Error Resilience**: Continues processing even when individual operations fail
- **Detailed Logging**: Real-time progress tracking with timing information
- **Retry Logic**: Automatic retry with exponential backoff for transient failures
- **DTU Throttling**: Configurable delays between operations to manage resource consumption

## Prerequisites

- [Bun](https://bun.sh) runtime installed (v1.0 or higher)
- Access to Azure SQL Server with appropriate permissions:
  - `VIEW DATABASE STATE` - To query index fragmentation
  - `ALTER` permissions on indexes - To rebuild/reorganize indexes
  - `UPDATE STATISTICS` permissions - To update statistics after maintenance

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd az-sql-db
```

2. Install dependencies:
```bash
bun install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Update `.env` with your Azure SQL Server credentials:
```env
DB_SERVER=your-server.database.windows.net
DB_USER=your-username
DB_PASSWORD=your-password
DB_PORT=1433
DB_ENCRYPT=true
DB_CONNECTION_TIMEOUT=30000
DB_REQUEST_TIMEOUT=300000
```

## Usage

### Basic Commands

#### Process All Databases
Process all user databases on the server (excludes system databases):
```bash
bun run start
```

#### Process Specific Databases
Process only specified databases:
```bash
# Single database
bun run start ProductionDB

# Multiple databases
bun run start ProductionDB StagingDB DevelopmentDB
```

### Advanced Options

#### Rebuild Mode: Online vs Offline

**Online Mode** (default) - Allows concurrent access during rebuild:
```bash
bun run start --online
bun run start --online ProductionDB StagingDB
```

**Offline Mode** - Faster but locks tables during rebuild:
```bash
bun run start --offline
bun run start --offline ProductionDB
```

> **Note**: The default mode is ONLINE, which can be changed via the `INDEX_REBUILD_ONLINE` environment variable. CLI flags override the environment setting.

### Interactive Keyboard Controls

When running in an interactive terminal (TTY), you can control execution with keyboard shortcuts:

| Key | Action | Description |
|-----|--------|-------------|
| `d` | Skip Database | Skip to the next database (waits for current operation to complete) |
| `p` | Pause/Resume | Toggle pause state - press once to pause, again to resume |
| `h` or `?` | Help | Display keyboard shortcuts |
| `Ctrl+C` | Exit | Gracefully exit and restore terminal state |

**Features:**
- Manually skipped databases are tracked separately in the final summary
- Operations complete safely before skipping (never interrupts mid-rebuild/reorganize)
- Automatically disables in non-interactive environments (piped output, background jobs, cron)

**Example:**
```bash
# Run interactively with keyboard controls
bun run start ProductionDB

# Keyboard controls automatically disabled when piping output
bun run start ProductionDB > maintenance.log
```

### All Usage Scenarios

| Scenario | Command | Description |
|----------|---------|-------------|
| Process all databases (online mode) | `bun run start` | Default behavior with online rebuilds |
| Process all databases (offline mode) | `bun run start --offline` | All databases with offline rebuilds |
| Process all databases (explicit online) | `bun run start --online` | Force online mode via CLI |
| Process one database | `bun run start MyDatabase` | Single database with default mode |
| Process multiple databases | `bun run start DB1 DB2 DB3` | Multiple databases with default mode |
| Process one database (online) | `bun run start --online MyDatabase` | Single database with online rebuilds |
| Process one database (offline) | `bun run start --offline MyDatabase` | Single database with offline rebuilds |
| Process multiple databases (online) | `bun run start --online DB1 DB2` | Multiple databases with online rebuilds |
| Process multiple databases (offline) | `bun run start --offline DB1 DB2` | Multiple databases with offline rebuilds |

### Configuration Options

All configuration is managed through environment variables in the `.env` file:

#### Database Connection
```env
DB_SERVER=your-server.database.windows.net   # Required: Azure SQL Server hostname
DB_USER=your-username                        # Required: SQL authentication username
DB_PASSWORD=your-password                    # Required: SQL authentication password
DB_PORT=1433                                 # Optional: SQL Server port (default: 1433)
DB_ENCRYPT=true                              # Optional: Use encrypted connection (default: false)
DB_CONNECTION_TIMEOUT=30000                  # Optional: Connection timeout in ms (default: 30000)
DB_REQUEST_TIMEOUT=300000                    # Optional: Query timeout in ms (default: 300000)
```

#### Maintenance Behavior
```env
# Index rebuild mode (true = ONLINE, false = OFFLINE)
INDEX_REBUILD_ONLINE=true                    # Default: true

# DTU throttling delays (milliseconds)
INDEX_REBUILD_DELAY_MS=2000                  # Delay after REBUILD operations (default: 2000)
INDEX_REORGANIZE_DELAY_MS=500                # Delay after REORGANIZE operations (default: 500)

# Retry configuration with exponential backoff
RETRY_MAX_ATTEMPTS=3                         # Maximum retry attempts (default: 3)
RETRY_BASE_DELAY_MS=1000                     # Base delay for retries (default: 1000)
RETRY_MAX_DELAY_MS=30000                     # Maximum retry delay cap (default: 30000)
```

## Output Example

```
┌─────────────────────────────────────────────────────────┐
│             🎮 KEYBOARD SHORTCUTS                       │
├─────────────────────────────────────────────────────────┤
│  [d]        Skip current database                       │
│  [p]        Pause/Resume processing                     │
│  [h] or [?] Show this help                              │
│  [Ctrl+C]   Graceful exit                               │
└─────────────────────────────────────────────────────────┘

🔍 No databases specified. Processing all user databases on server: myserver.database.windows.net...
✅ Found 3 user databases

⚙️  REBUILD mode: ONLINE (default/env)

================================================================================
Processing Database: ProductionDB (1/3)
================================================================================
[ProductionDB] Analyzing indexes...
  Table: dbo.Orders | Index: IX_OrderDate | Fragmentation: 45.67%
    → Action: REBUILD (fragmentation >= 30%)
    ✓ Rebuilt in 2.34s
    ✓ Statistics updated in 0.45s

  Table: dbo.Customers | Index: IX_CustomerName | Fragmentation: 18.23%
    → Action: REORGANIZE (fragmentation 10-30%)
    ✓ Reorganized in 0.87s
    ✓ Statistics updated in 0.21s

  Table: dbo.Products | Index: IX_ProductCode | Fragmentation: 7.12%
    → Action: SKIP (fragmentation < 10%)

[ProductionDB] Complete
  Duration: 45.67s | Processed: 24 | Rebuilt: 8 | Reorganized: 11 | Skipped: 5

================================================================================
FINAL SUMMARY
================================================================================
Total Databases: 3 (3 processed)
Total Indexes: 72 (24 rebuilt, 31 reorganized, 17 skipped)
Total Duration: 2m 34s
Status: SUCCESS ✓
```

## How It Works

### Fragmentation Analysis
The tool queries `sys.dm_db_index_physical_stats` to analyze index fragmentation and applies the following logic:

- **Fragmentation ≥ 30%** → `ALTER INDEX ... REBUILD`
- **Fragmentation 10-30%** → `ALTER INDEX ... REORGANIZE`
- **Fragmentation < 10%** → Skip (index is healthy)

### Index Selection Criteria
Only processes indexes that meet these criteria:
- `page_count > 100` (excludes small indexes)
- `index_id > 0` (excludes heaps)
- `is_ms_shipped = 0` (user tables only)
- Non-NULL index names

### Statistics Update
After each rebuild or reorganize operation, statistics are updated with `FULLSCAN` to ensure optimal query performance.

## Verification

After running the tool, verify results with these SQL queries:

### Check Fragmentation Levels
```sql
SELECT
    i.name AS IndexName,
    ips.avg_fragmentation_in_percent AS Fragmentation
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') AS ips
INNER JOIN sys.indexes AS i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE ips.index_id > 0
ORDER BY ips.avg_fragmentation_in_percent DESC;
```

### Check Statistics Update Dates
```sql
SELECT
    t.name AS TableName,
    i.name AS IndexName,
    STATS_DATE(i.object_id, i.index_id) AS LastUpdated
FROM sys.indexes AS i
INNER JOIN sys.tables AS t ON i.object_id = t.object_id
WHERE i.index_id > 0
ORDER BY STATS_DATE(i.object_id, i.index_id) DESC;
```

## Project Structure

```
az-sql-db/
├── src/
│   ├── index.ts                           # Main entry point & CLI orchestration
│   ├── config/
│   │   └── database.ts                    # Configuration loader
│   ├── services/
│   │   ├── database.service.ts            # Connection pool management & queries
│   │   ├── index-maintenance.service.ts   # Core maintenance logic
│   │   └── logger.service.ts              # Progress logging & formatting
│   ├── models/
│   │   └── types.ts                       # TypeScript interfaces & enums
│   └── utils/
│       ├── cli-parser.ts                  # CLI argument parser
│       ├── delay.ts                       # Throttling utilities
│       ├── keyboard-handler.ts            # Interactive keyboard controls
│       ├── retry.ts                       # Retry logic with backoff
│       └── sql-queries.ts                 # SQL query templates
├── .env                                   # Environment variables (git-ignored)
├── .env.example                           # Template for environment setup
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Exit Codes

- **0**: All databases processed successfully (individual index failures are logged but don't fail the process)
- **1**: One or more databases failed to process (critical failures)

## Security Notes

- Never commit the `.env` file (already in `.gitignore`)
- Uses encrypted connections to Azure SQL Server (`DB_ENCRYPT=true`)
- Parameterized queries prevent SQL injection
- Database user requires specific permissions (see Prerequisites)

## Troubleshooting

### Connection Issues
- Verify server name includes `.database.windows.net`
- Check firewall rules allow your IP address
- Ensure `DB_ENCRYPT=true` for Azure SQL Database

### Permission Errors
Ensure the SQL user has the required permissions:
```sql
GRANT VIEW DATABASE STATE TO [your-username];
GRANT ALTER ON SCHEMA::dbo TO [your-username];
GRANT UPDATE STATISTICS TO [your-username];
```

### Timeout Errors
Increase timeout values in `.env` for large databases:
```env
DB_CONNECTION_TIMEOUT=60000
DB_REQUEST_TIMEOUT=600000
```

### DTU Throttling
If you encounter DTU limit errors, increase delays:
```env
INDEX_REBUILD_DELAY_MS=5000
INDEX_REORGANIZE_DELAY_MS=2000
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT
