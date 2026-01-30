#!/usr/bin/env bun

import { loadDatabaseConfig, loadMaintenanceConfig } from './config/database.js';
import { DatabaseService } from './services/database.service.js';
import { IndexMaintenanceService } from './services/index-maintenance.service.js';
import { LoggerService } from './services/logger.service.js';
import { DatabaseResult } from './models/types.js';
import { parseCliArguments } from './utils/cli-parser.js';
import { KeyboardHandler } from './utils/keyboard-handler.js';

async function main() {
  const args = process.argv.slice(2);
  const { rebuildOnline, databases: requestedDatabases } = parseCliArguments(args);
  let databasesToProcess: string[] = [];

  const keyboardHandler = new KeyboardHandler();

  try {
    const config = loadDatabaseConfig();
    const maintenanceConfig = loadMaintenanceConfig(rebuildOnline);

    const dbService = new DatabaseService(config);
    const logger = new LoggerService();
    const maintenanceService = new IndexMaintenanceService(dbService, logger, maintenanceConfig);
    keyboardHandler.start();
    keyboardHandler.displayShortcuts();
    maintenanceService.setKeyboardHandler(keyboardHandler);

    await dbService.connect();

    if (requestedDatabases.length === 0) {
      console.log(`🔍 No databases specified. Processing all user databases on server: ${config.server}...`);
      databasesToProcess = await dbService.getDatabaseList();
      console.log(`✅ Found ${databasesToProcess.length} user databases\n`);
    } else {
      databasesToProcess = requestedDatabases;
      console.log(`🎯 Processing ${databasesToProcess.length} specified database(s)\n`);
    }

    const modeText = maintenanceConfig.rebuildOnline ? 'ONLINE' : 'OFFLINE';
    const modeSource = rebuildOnline !== undefined ? '(CLI flag)' : '(default/env)';
    console.log(`⚙️  REBUILD mode: ${modeText} ${modeSource}\n`);

    if (databasesToProcess.length === 0) {
      console.log('⚠️  No databases to process. Exiting.');
      await dbService.close();
      keyboardHandler.stop();
      return;
    }

    const results: DatabaseResult[] = [];

    for (let i = 0; i < databasesToProcess.length; i++) {
      const dbName = databasesToProcess[i];

      await keyboardHandler.waitWhilePaused();

      if (keyboardHandler.shouldSkipCurrentDatabase()) {
        logger.logDatabaseSkipped(dbName, i + 1, databasesToProcess.length);
        results.push({
          databaseName: dbName,
          success: true,
          manuallySkipped: true,
          indexesProcessed: 0,
          indexesRebuilt: 0,
          indexesReorganized: 0,
          indexesSkipped: 0,
          totalDuration: 0,
          errors: [],
        });
        keyboardHandler.clearDatabaseSkip();
        continue;
      }

      logger.logDatabaseStart(dbName, i + 1, databasesToProcess.length);

      try {
        const result = await maintenanceService.processDatabase(dbName);

        if (keyboardHandler.shouldSkipCurrentDatabase()) {
          console.log('\n⏭️  Database processing terminated early by operator');
          result.manuallySkipped = true;
          keyboardHandler.clearDatabaseSkip();
        }

        results.push(result);
        logger.logDatabaseComplete(result);
      } catch (error) {
        console.error(`❌ Failed to process database ${dbName}:`, error);
        results.push({
          databaseName: dbName,
          success: false,
          criticalFailure: true,
          indexesProcessed: 0,
          indexesRebuilt: 0,
          indexesReorganized: 0,
          indexesSkipped: 0,
          totalDuration: 0,
          errors: [String(error)],
        });

        if (keyboardHandler.shouldSkipCurrentDatabase()) {
          keyboardHandler.clearDatabaseSkip();
        }
      }
    }

    logger.logFinalSummary(results);

    await dbService.close();

    keyboardHandler.stop();
    const hasCriticalFailures = results.some(r => r.criticalFailure === true);
    process.exit(hasCriticalFailures ? 1 : 0);

  } catch (error) {
    console.error('💥 Fatal Error:', error);

    keyboardHandler.stop();

    process.exit(1);
  }
}

main();
