export class Logger {
  constructor(private readonly prefix = 'automation') {}

  info(message: string, ...extra: unknown[]): void {
    console.log(this.format('INFO', message), ...extra);
  }

  warn(message: string, ...extra: unknown[]): void {
    console.warn(this.format('WARN', message), ...extra);
  }

  error(message: string, ...extra: unknown[]): void {
    console.error(this.format('ERROR', message), ...extra);
  }

  private format(level: 'INFO' | 'WARN' | 'ERROR', message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${this.prefix}] [${level}] ${message}`;
  }
}
