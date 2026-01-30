export interface ParsedArgs {
  rebuildOnline: boolean | undefined;
  databases: string[];
}

export function parseCliArguments(args: string[]): ParsedArgs {
  let rebuildOnline: boolean | undefined = undefined;
  const databases: string[] = [];
  let hasOnlineFlag = false;
  let hasOfflineFlag = false;

  for (const arg of args) {
    const lowerArg = arg.toLowerCase();

    if (lowerArg === '--online') {
      hasOnlineFlag = true;
      rebuildOnline = true;
    } else if (lowerArg === '--offline') {
      hasOfflineFlag = true;
      rebuildOnline = false;
    } else if (!arg.startsWith('--')) {
      databases.push(arg);
    }
  }
  if (hasOnlineFlag && hasOfflineFlag) {
    throw new Error('Cannot specify both --online and --offline flags');
  }

  return {
    rebuildOnline,
    databases,
  };
}
