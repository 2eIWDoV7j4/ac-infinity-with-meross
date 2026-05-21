import fs from 'node:fs/promises';
import path from 'node:path';
import { Logger } from './logger';

export interface BackupOptions {
  sourceDir: string;
  destinationDir: string;
  retention: number;
}

function resolvePath(value: string | undefined, fallback: string): string {
  return path.isAbsolute(value ?? '') ? (value as string) : path.resolve(process.cwd(), value ?? fallback);
}

function parseNumber(envValue: string | undefined, fallback: number): number {
  if (!envValue) return fallback;
  const parsed = Number(envValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function timestampSuffix(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function ensureDirExists(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function copyBackup(logger: Logger, { sourceDir, destinationDir, retention }: BackupOptions): Promise<void> {
  const exists = await fs
    .access(sourceDir)
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    throw new Error(`Homebridge data directory not found at ${sourceDir}.`);
  }

  await ensureDirExists(destinationDir);
  const target = path.join(destinationDir, `homebridge-backup-${timestampSuffix()}`);

  logger.info(`Creating backup from ${sourceDir} to ${target} ...`);
  await fs.cp(sourceDir, target, { recursive: true, errorOnExist: false });
  logger.info('Backup completed.');

  await pruneBackups(logger, destinationDir, retention);
}

async function pruneBackups(logger: Logger, directory: string, retention: number): Promise<void> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const backups = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('homebridge-backup-'))
    .map((entry) => ({
      name: entry.name,
      createdAt: entry.name.replace('homebridge-backup-', '')
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const excess = backups.slice(retention);
  for (const backup of excess) {
    const fullPath = path.join(directory, backup.name);
    logger.info(`Pruning old backup ${fullPath}`);
    await fs.rm(fullPath, { recursive: true, force: true });
  }
}

export async function runBackupFromEnv(logger = new Logger('backup')): Promise<void> {
  const sourceDir = resolvePath(process.env.HOMEBRIDGE_DATA_DIR, 'homebridge');
  const destinationDir = resolvePath(process.env.BACKUP_DIR, 'backups');
  const retention = parseNumber(process.env.BACKUP_RETENTION, 5);
  await copyBackup(logger, { sourceDir, destinationDir, retention });
}

export function scheduleBackupsFromEnv(logger = new Logger('backup')): () => void {
  const intervalMinutes = parseNumber(process.env.BACKUP_INTERVAL_MINUTES, 0);
  if (intervalMinutes <= 0) return () => undefined;

  const intervalMs = intervalMinutes * 60 * 1000;
  logger.info(`Scheduling recurring backups every ${intervalMinutes} minute(s).`);
  const timer = setInterval(async () => {
    try {
      await runBackupFromEnv(logger);
    } catch (error) {
      logger.error('Recurring backup failed:', error);
    }
  }, intervalMs);

  return () => clearInterval(timer);
}

if (require.main === module) {
  const logger = new Logger('backup');
  runBackupFromEnv(logger)
    .then(() => {
      scheduleBackupsFromEnv(logger);
    })
    .catch((error) => {
      logger.error('Backup failed:', error);
      process.exit(1);
    });
}
