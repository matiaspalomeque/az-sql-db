import { DatabaseResult, MaintenanceAction } from '../models/types.js';

export class LoggerService {
  private startTime: number = Date.now();

  logDatabaseStart(dbName: string, current: number, total: number): void {
    console.log('\n' + '='.repeat(80));
    console.log(`🔄 Processing Database: ${dbName} (${current}/${total})`);
    console.log('='.repeat(80));
    console.log(`🔍 [${dbName}] Analyzing indexes...`);
  }

  logIndexInfo(
    tableName: string,
    indexName: string,
    schemaName: string,
    fragmentation: number
  ): void {
    console.log(`  Table: ${schemaName}.${tableName} | Index: ${indexName} | Fragmentation: ${fragmentation.toFixed(2)}%`);
  }

  logAction(action: MaintenanceAction, fragmentation: number): void {
    let reason = '';
    let icon = '';
    if (action === MaintenanceAction.REBUILD) {
      reason = 'fragmentation >= 30%';
      icon = '🔨';
    } else if (action === MaintenanceAction.REORGANIZE) {
      reason = 'fragmentation 10-30%';
      icon = '🔧';
    } else {
      reason = 'fragmentation < 10%';
      icon = '⏭️';
    }
    console.log(`    ${icon} Action: ${action} (${reason})`);
  }

  logSuccess(action: MaintenanceAction, duration: number, retryAttempts?: number): void {
    const actionText = action === MaintenanceAction.REBUILD ? 'Rebuilt' : 'Reorganized';
    const retryText = retryAttempts && retryAttempts > 1 ? ` (${retryAttempts} attempts)` : '';
    console.log(`    ✅ ${actionText} in ${duration.toFixed(2)}s${retryText}`);
  }

  logThrottleDelay(action: string, delayMs: number): void {
    console.log(`    ⏱️  DTU throttle delay: ${delayMs}ms (after ${action})`);
  }

  logStatisticsUpdate(duration: number): void {
    console.log(`    📊 Statistics updated in ${duration.toFixed(2)}s`);
  }

  logSkipped(): void {
    console.log(`    ⏭️  Skipped (fragmentation below threshold)`);
  }

  logDatabaseSkipped(dbName: string, current: number, total: number): void {
    console.log('\n' + '='.repeat(80));
    console.log(`⏭️  Skipping Database: ${dbName} (${current}/${total}) - Manually skipped by operator`);
    console.log('='.repeat(80));
  }

  logFreeProcCache(duration: number): void {
    console.log(`    🧹 Procedure cache cleared (DBCC FREEPROCCACHE) in ${duration.toFixed(2)}s`);
  }

  logError(error: string): void {
    console.log(`    ❌ Error: ${error}`);
  }

  logDatabaseComplete(result: DatabaseResult): void {
    const icon = result.criticalFailure ? '❌' :
                 result.errors.length > 0 ? '⚠️' :
                 result.manuallySkipped ? '⏭️' : '✅';
    const status = result.criticalFailure ? 'FAILED' :
                   result.manuallySkipped ? 'Terminated Early' : 'Done';
    console.log(`\n${icon} [${result.databaseName}] ${status}`);

    let summaryLine = `  ⏱️  Duration: ${result.totalDuration.toFixed(2)}s | ` +
      `Processed: ${result.indexesProcessed} | ` +
      `Rebuilt: ${result.indexesRebuilt} | ` +
      `Reorganized: ${result.indexesReorganized} | ` +
      `Skipped: ${result.indexesSkipped}`;

    console.log(summaryLine);

    if (result.errors.length > 0 && !result.criticalFailure) {
      console.log(`  ⚠️  Partial failures: ${result.errors.length} index error(s) (processing continued)`);
    } else if (result.errors.length > 0) {
      console.log(`  ❌ Errors: ${result.errors.length}`);
    }
  }

  logFinalSummary(results: DatabaseResult[]): void {
    const totalDuration = results.reduce((sum, r) => sum + r.totalDuration, 0);
    const successfulDbs = results.filter(r => !r.criticalFailure && !r.manuallySkipped).length;
    const failedDbs = results.filter(r => r.criticalFailure).length;
    const manuallySkippedDbs = results.filter(r => r.manuallySkipped).length;
    const totalIndexErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    const totalIndexes = results.reduce((sum, r) => sum + r.indexesProcessed, 0);
    const totalRebuilt = results.reduce((sum, r) => sum + r.indexesRebuilt, 0);
    const totalReorganized = results.reduce((sum, r) => sum + r.indexesReorganized, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.indexesSkipped, 0);

    console.log('\n' + '='.repeat(80));
    console.log('📋 FINAL SUMMARY');
    console.log('='.repeat(80));

    let dbSummary = `🗄️  Total Databases: ${results.length} (${successfulDbs} processed`;
    if (manuallySkippedDbs > 0) {
      dbSummary += `, ${manuallySkippedDbs} manually skipped`;
    }
    if (failedDbs > 0) {
      dbSummary += `, ${failedDbs} failed`;
    }
    dbSummary += ')';
    console.log(dbSummary);

    console.log(`📑 Total Indexes: ${totalIndexes} (${totalRebuilt} rebuilt, ${totalReorganized} reorganized, ${totalSkipped} skipped)`);

    if (totalIndexErrors > 0) {
      console.log(`⚠️  Index Errors: ${totalIndexErrors} (partial failures, processing continued)`);
    }
    console.log(`⏱️  Total Duration: ${this.formatDuration(totalDuration)}`);
    console.log(`${failedDbs === 0 ? '✅ Status: SUCCESS' : '❌ Status: CRITICAL FAILURES'}`);
  }

  private formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }
}
