import { DatabaseService } from './database.service.js';
import { LoggerService } from './logger.service.js';
import { IndexInfo, MaintenanceAction, MaintenanceResult, DatabaseResult } from '../models/types.js';
import { MaintenanceConfig } from '../config/database.js';
import { SQL_QUERIES } from '../utils/sql-queries.js';
import { delay } from '../utils/delay.js';
import { retryWithBackoff } from '../utils/retry.js';
import { KeyboardHandler } from '../utils/keyboard-handler.js';

export class IndexMaintenanceService {
  private keyboardHandler?: KeyboardHandler;

  constructor(
    private dbService: DatabaseService,
    private logger: LoggerService,
    private maintenanceConfig: MaintenanceConfig
  ) {}

  setKeyboardHandler(handler: KeyboardHandler): void {
    this.keyboardHandler = handler;
  }

  async processDatabase(dbName: string): Promise<DatabaseResult> {
    const startTime = Date.now();
    const result: DatabaseResult = {
      databaseName: dbName,
      success: true,
      indexesProcessed: 0,
      indexesRebuilt: 0,
      indexesReorganized: 0,
      indexesSkipped: 0,
      totalDuration: 0,
      errors: [],
    };

    try {
      const indexes = await this.getFragmentedIndexes(dbName);

      for (const index of indexes) {
        await this.keyboardHandler?.waitWhilePaused();

        if (this.keyboardHandler?.shouldSkipCurrentDatabase()) {
          console.log('    ⏭️  Database skip requested - stopping index processing');
          break;
        }

        result.indexesProcessed++;

        this.logger.logIndexInfo(
          index.tableName,
          index.indexName,
          index.schemaName,
          index.fragmentationPercent
        );

        const action = this.determineAction(index.fragmentationPercent);
        this.logger.logAction(action, index.fragmentationPercent);

        if (action === MaintenanceAction.SKIP) {
          this.logger.logSkipped();
          result.indexesSkipped++;
          continue;
        }

        try {
          const maintenanceResult = await this.performMaintenance(index, action);

          if (maintenanceResult.success) {
            if (action === MaintenanceAction.REBUILD) {
              result.indexesRebuilt++;
            } else if (action === MaintenanceAction.REORGANIZE) {
              result.indexesReorganized++;
            }
            this.logger.logSuccess(action, maintenanceResult.duration, maintenanceResult.retryAttempts);

            if (this.keyboardHandler?.shouldSkipCurrentDatabase()) {
              console.log('    ⏭️  Database skip requested - stopping index processing');
              break;
            }

            // Update statistics
            const statsStartTime = Date.now();
            await this.updateStatistics(index);
            const statsDuration = (Date.now() - statsStartTime) / 1000;
            this.logger.logStatisticsUpdate(statsDuration);

            if (this.keyboardHandler?.shouldSkipCurrentDatabase()) {
              console.log('    ⏭️  Database skip requested - stopping index processing');
              break;
            }

            // DTU throttling delay
            if (action === MaintenanceAction.REBUILD) {
              await delay(this.maintenanceConfig.rebuildDelayMs);
              this.logger.logThrottleDelay('REBUILD', this.maintenanceConfig.rebuildDelayMs);
            } else if (action === MaintenanceAction.REORGANIZE) {
              await delay(this.maintenanceConfig.reorganizeDelayMs);
              this.logger.logThrottleDelay('REORGANIZE', this.maintenanceConfig.reorganizeDelayMs);
            }
          } else {
            result.errors.push(maintenanceResult.error || 'Unknown error');
            this.logger.logError(maintenanceResult.error || 'Unknown error');
          }
        } catch (error) {
          const errorMsg = `${index.schemaName}.${index.tableName}.${index.indexName}: ${error}`;
          result.errors.push(errorMsg);
          this.logger.logError(String(error));
        }
      }
    } catch (error) {
      result.success = false;
      result.criticalFailure = true;
      result.errors.push(`Database processing failed: ${error}`);
      this.logger.logError(`Database processing failed: ${error}`);
    }

    result.totalDuration = (Date.now() - startTime) / 1000;
    return result;
  }

  private async getFragmentedIndexes(dbName: string): Promise<IndexInfo[]> {
    interface QueryResult {
      SchemaName: string;
      TableName: string;
      IndexName: string;
      FragmentationPercent: number;
      PageCount: number;
    }

    const results = await this.dbService.executeQuery<QueryResult>(
      SQL_QUERIES.GET_FRAGMENTED_INDEXES,
      dbName
    );

    return results.map(r => ({
      databaseName: dbName,
      schemaName: r.SchemaName,
      tableName: r.TableName,
      indexName: r.IndexName,
      fragmentationPercent: r.FragmentationPercent,
      pageCount: r.PageCount,
    }));
  }

  private determineAction(fragmentation: number): MaintenanceAction {
    if (fragmentation >= 30) {
      return MaintenanceAction.REBUILD;
    } else if (fragmentation >= 10) {
      return MaintenanceAction.REORGANIZE;
    } else {
      return MaintenanceAction.SKIP;
    }
  }

  private async performMaintenance(
    index: IndexInfo,
    action: MaintenanceAction
  ): Promise<MaintenanceResult> {
    const startTime = Date.now();

    try {
      let query: string;

      if (action === MaintenanceAction.REBUILD) {
        query = SQL_QUERIES.REBUILD_INDEX(
          index.schemaName,
          index.tableName,
          index.indexName,
          this.maintenanceConfig.rebuildOnline
        );
      } else if (action === MaintenanceAction.REORGANIZE) {
        query = SQL_QUERIES.REORGANIZE_INDEX(
          index.schemaName,
          index.tableName,
          index.indexName
        );
      } else {
        return {
          action,
          success: true,
          duration: 0,
        };
      }

      const { attempts } = await retryWithBackoff(
        () => this.dbService.executeQuery(query, index.databaseName),
        {
          maxAttempts: this.maintenanceConfig.retryMaxAttempts,
          baseDelayMs: this.maintenanceConfig.retryBaseDelayMs,
          maxDelayMs: this.maintenanceConfig.retryMaxDelayMs,
        }
      );

      return {
        action,
        success: true,
        duration: (Date.now() - startTime) / 1000,
        retryAttempts: attempts,
        wasRetried: attempts > 1,
      };
    } catch (error) {
      return {
        action,
        success: false,
        duration: (Date.now() - startTime) / 1000,
        error: String(error),
      };
    }
  }

  private async updateStatistics(index: IndexInfo): Promise<void> {
    const query = SQL_QUERIES.UPDATE_STATISTICS(
      index.schemaName,
      index.tableName,
      index.indexName
    );

    await retryWithBackoff(
      () => this.dbService.executeQuery(query, index.databaseName),
      {
        maxAttempts: this.maintenanceConfig.retryMaxAttempts,
        baseDelayMs: this.maintenanceConfig.retryBaseDelayMs,
        maxDelayMs: this.maintenanceConfig.retryMaxDelayMs,
      }
    );
  }
}
