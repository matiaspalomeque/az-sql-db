export class KeyboardHandler {
  private enabled: boolean = false;
  private paused: boolean = false;
  private skipDatabase: boolean = false;
  private originalRawMode: boolean = false;
  private boundHandleKeypress = this.handleKeypress.bind(this);
  private boundHandleExit = this.handleExit.bind(this);

  constructor() {
    this.enabled = process.stdin.isTTY === true && process.stdout.isTTY === true;
  }

  start(): void {
    if (!this.enabled) return;

    try {
      this.originalRawMode = process.stdin.isRaw || false;

      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      process.stdin.on('data', this.boundHandleKeypress);

      process.on('SIGINT', this.boundHandleExit);
      process.on('SIGTERM', this.boundHandleExit);
    } catch (error) {
      this.enabled = false;
    }
  }

  stop(): void {
    if (!this.enabled) return;

    try {
      process.stdin.removeListener('data', this.boundHandleKeypress);
      process.removeListener('SIGINT', this.boundHandleExit);
      process.removeListener('SIGTERM', this.boundHandleExit);
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(this.originalRawMode);
      }
      process.stdin.pause();
    } catch (error) {
    }
  }

  private handleKeypress(key: string): void {
    if (!this.enabled) return;

    switch (key.toLowerCase()) {
      case 'd':
        this.skipDatabase = true;
        console.log('\n⏭️  Skip database requested - will skip after current operation completes');
        break;

      case 'p':
        this.paused = !this.paused;
        if (this.paused) {
          console.log('\n⏸️  Paused - Press P to resume');
        } else {
          console.log('\n▶️  Resumed');
        }
        break;

      case 'h':
      case '?':
        this.displayShortcuts();
        break;

      case '\u0003': // Ctrl+C
        this.handleExit();
        break;
    }
  }

  private handleExit(): void {
    console.log('\n\n🛑 Graceful shutdown requested...');
    this.stop();
    process.exit(0);
  }

  isPausedState(): boolean {
    return this.enabled && this.paused;
  }

  shouldSkipCurrentDatabase(): boolean {
    return this.enabled && this.skipDatabase;
  }

  clearDatabaseSkip(): void {
    this.skipDatabase = false;
  }

  async waitWhilePaused(): Promise<void> {
    if (!this.enabled) return;

    while (this.paused) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  displayShortcuts(): void {
    if (!this.enabled) return;

    console.log('\n┌─────────────────────────────────────────────┐');
    console.log('│   🎮 Interactive Controls Available         │');
    console.log('├─────────────────────────────────────────────┤');
    console.log('│   D - Skip current database                 │');
    console.log('│   P - Pause/Resume processing               │');
    console.log('│   H - Show this help                        │');
    console.log('│   Ctrl+C - Graceful exit                    │');
    console.log('└─────────────────────────────────────────────┘\n');
  }
}
