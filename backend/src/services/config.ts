import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import * as TOML from 'toml';
import { randomBytes } from 'crypto';

const CONFIG_PATH = process.env.BEAMMP_CONFIG_PATH || '/beammp/ServerConfig.toml';
const BACKUPS_DIR = process.env.BACKUPS_DIR || '/app/data/config-backups';

// Ensure backups directory exists
await mkdir(BACKUPS_DIR, { recursive: true });

export interface BeamMPConfig {
  General: {
    Port: number;
    AllowGuests: boolean;
    LogChat: boolean;
    Debug: boolean;
    IP: string;
    Private: boolean;
    InformationPacket: number;
    Name: string;
    Tags: string[];
    MaxCars: number;
    MaxPlayers: number;
    Map: string;
    Description: string;
    ResourceFolder: string;
    AuthKey?: string;
  };
  Misc: {
    ImScaredOfUpdates: boolean;
    UpdateReminderTime: number;
  };
}

export async function readConfigFile(): Promise<BeamMPConfig> {
  try {
    const content = await readFile(CONFIG_PATH, 'utf-8');
    const config = TOML.parse(content);
    return config as BeamMPConfig;
  } catch (error) {
    console.error('Failed to read config file:', error);
    throw new Error('Failed to read server config');
  }
}

export async function writeConfigFile(config: BeamMPConfig): Promise<void> {
  try {
    const content = TOML.stringify(config as any);

    // Atomic write: write to temp file first, then rename
    const tempPath = `${CONFIG_PATH}.${randomBytes(8).toString('hex')}`;
    await writeFile(tempPath, content, 'utf-8');

    // Rename is atomic on most filesystems
    const fs = await import('fs');
    fs.renameSync(tempPath, CONFIG_PATH);
  } catch (error) {
    console.error('Failed to write config file:', error);
    throw new Error('Failed to write server config');
  }
}

export async function backupConfigFile(config: BeamMPConfig): Promise<string> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.toml`;
    const backupPath = join(BACKUPS_DIR, filename);

    const content = TOML.stringify(config as any);
    await writeFile(backupPath, content, 'utf-8');

    return filename;
  } catch (error) {
    console.error('Failed to backup config:', error);
    throw new Error('Failed to backup config');
  }
}

export async function listBackups(): Promise<
  Array<{ filename: string; createdAt: Date; size: number }>
> {
  try {
    const { readdirSync, statSync } = await import('fs');
    const files = readdirSync(BACKUPS_DIR);

    return files
      .filter((f) => f.endsWith('.toml'))
      .map((filename) => {
        const stat = statSync(join(BACKUPS_DIR, filename));
        const timestamp = filename.replace('backup-', '').replace('.toml', '');
        const createdAt = new Date(timestamp.replace(/-([^-])$/, ':$1'));

        return {
          filename,
          createdAt,
          size: stat.size,
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    console.error('Failed to list backups:', error);
    return [];
  }
}
export interface ValidationError {
  field: string;
  message: string;
}

export function validateConfig(config: BeamMPConfig): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate Port
  if (config.General?.Port) {
    const port = config.General.Port;
    if (typeof port !== 'number' || port < 1024 || port > 65535) {
      errors.push({
        field: 'General.Port',
        message: 'Port must be a number between 1024 and 65535',
      });
    }
  }

  // Validate UpdateReminderTime
  if (config.Misc?.UpdateReminderTime !== undefined) {
    const timeStr = String(config.Misc.UpdateReminderTime);
    if (!/^\d+(\.\d+)?(s|min|h|d)$/.test(timeStr)) {
      errors.push({
        field: 'Misc.UpdateReminderTime',
        message: 'UpdateReminderTime must match format: number + unit (s, min, h, d)',
      });
    }
  }

  // Validate Tags (normalize whitespace)
  if (config.General?.Tags && Array.isArray(config.General.Tags)) {
    config.General.Tags = config.General.Tags.map((tag) =>
      tag.trim().replace(/\s+/g, ' ')
    );
  }

  // Validate Map (allow any string, but document BeamMP convention)
  if (config.General?.Map && typeof config.General.Map !== 'string') {
    errors.push({
      field: 'General.Map',
      message: 'Map must be a string (recommended format: /levels/mapname/info.json)',
    });
  }

  // Validate Name and Description exist
  if (!config.General?.Name) {
    errors.push({
      field: 'General.Name',
      message: 'Server name is required',
    });
  }

  return errors;
}