import { prisma } from '../index.js';
import { createHash } from 'crypto';
import { writeFile, mkdir, unlink, readdir, stat } from 'fs/promises';
import { dirname, join } from 'path';
import AdmZip from 'adm-zip';
import { readConfigFile } from './config.js';

const CONFIG_PATH = process.env.BEAMMP_CONFIG_PATH || '/beammp/ServerConfig.toml';
const RESOURCES_PATH = process.env.BEAMMP_RESOURCES_PATH || '';
const MAX_ZIP_SIZE = parseInt(process.env.MAX_MOD_SIZE || '2048') * 1024 * 1024; // 2048MB default
const MAP_SCAN_TIMEOUT_MS = parseInt(process.env.MAP_SCAN_TIMEOUT_MS || '60000', 10);
const MAP_SCAN_MAX_ZIP_MB = parseInt(process.env.MAP_SCAN_MAX_ZIP_MB || '2048', 10);
const MAP_SCAN_MAX_ENTRIES = parseInt(process.env.MAP_SCAN_MAX_ENTRIES || '10000', 10);
const NO_MAP_MARKER = '__NO_MAPS__';

const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timeoutId: NodeJS.Timeout | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const resolveResourcesPath = (resourceFolder: string): string => {
  if (RESOURCES_PATH) {
    return RESOURCES_PATH;
  }

  return join(dirname(CONFIG_PATH), resourceFolder);
};

// Try to resolve mod path from config
async function getModsDirectory(): Promise<string> {
  try {
    const config = await readConfigFile();
    const resourceFolder = config.General?.ResourceFolder || 'Resources';
    const resourcesPath = resolveResourcesPath(resourceFolder);
    return join(resourcesPath, 'Client');
  } catch {
    const fallbackResources = RESOURCES_PATH || join(dirname(CONFIG_PATH), 'Resources');
    return join(fallbackResources, 'Client');
  }
}

type ModFileMeta = {
  filename: string;
  size: number;
  mtime: Date;
  mtimeMs: number;
};

const extractMapPathsFromZip = (zip: AdmZip): string[] => {
  const maps = new Set<string>();
  const entries = zip.getEntries().slice(0, MAP_SCAN_MAX_ENTRIES);

  for (const entry of entries) {
    const normalized = entry.entryName.replace(/\\/g, '/').replace(/^\/+/, '');
    const match = normalized.match(/^levels\/([^/]+)\/info\.json$/i);
    if (!match) {
      continue;
    }

    const mapName = match[1].trim();
    if (!mapName || mapName.includes('..')) {
      continue;
    }

    maps.add(`/levels/${mapName}/info.json`);
  }

  return Array.from(maps);
};

const getModFileMetas = async (): Promise<ModFileMeta[]> => {
  const modsDir = await getModsDirectory();
  const entries = await withTimeout(
    readdir(modsDir, { withFileTypes: true }),
    MAP_SCAN_TIMEOUT_MS,
    'Reading mods directory'
  );

  const metas: ModFileMeta[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.zip')) {
      continue;
    }

    const filePath = join(modsDir, entry.name);
    try {
      const fileStat = await withTimeout(stat(filePath), MAP_SCAN_TIMEOUT_MS, 'Stat mod file');
      metas.push({
        filename: entry.name,
        size: fileStat.size,
        mtime: fileStat.mtime,
        mtimeMs: fileStat.mtimeMs,
      });
    } catch (error) {
      console.warn('[mods] Failed to stat mod file:', entry.name);
    }
  }

  return metas;
};

const buildMetaKey = (meta: ModFileMeta): string => {
  return `${meta.filename}:${meta.size}:${Math.round(meta.mtimeMs)}`;
};

export async function uploadMod(
  buffer: Buffer,
  filename: string,
  userId: string
): Promise<{ id: string; filename: string; originalName: string; sha256: string }> {
  // Validate file size
  if (buffer.length > MAX_ZIP_SIZE) {
    throw new Error(`File too large (max ${MAX_ZIP_SIZE / 1024 / 1024}MB)`);
  }

  // Validate ZIP file and prevent zip-slip
  let mapPaths: string[] = [];
  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    for (const entry of entries) {
      // Prevent zip-slip attacks
      if (entry.entryName.includes('..') || entry.entryName.startsWith('/')) {
        throw new Error('Invalid zip file structure');
      }
    }

    mapPaths = extractMapPathsFromZip(zip);
  } catch (error) {
    throw new Error('Invalid ZIP file');
  }

  // Compute SHA256
  const sha256 = createHash('sha256').update(buffer).digest('hex');

  // Generate safe filename
  const storedFilename = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '')}`;
  const modsDir = await getModsDirectory();
  const filepath = join(modsDir, storedFilename);

  // Ensure directory exists
  await mkdir(modsDir, { recursive: true });

  // Write file
  await writeFile(filepath, buffer);

  // Record in database
  const mod = await prisma.modFile.create({
    data: {
      filename: storedFilename,
      originalName: filename,
      size: buffer.length,
      sha256,
      uploadedBy: userId,
    },
  });

  // Cache map entries for this mod
  if (mapPaths.length === 0) {
    mapPaths = [NO_MAP_MARKER];
  }

  if (mapPaths.length > 0) {
    try {
      const fileStat = await stat(filepath);
      await prisma.modMapIndex.deleteMany({
        where: { modFilename: storedFilename },
      });
      await prisma.modMapIndex.createMany({
        data: mapPaths.map((mapPath) => ({
          modFilename: storedFilename,
          modSize: fileStat.size,
          modMtime: fileStat.mtime,
          mapPath,
        })),
      });
    } catch (error) {
      console.warn('[mods] Failed to cache map entries for mod:', storedFilename, error);
    }
  }

  return {
    id: mod.id,
    filename: mod.filename,
    originalName: mod.originalName,
    sha256: mod.sha256,
  };
}

export async function deleteMod(id: string): Promise<{ filename: string } | null> {
  const mod = await prisma.modFile.findUnique({ where: { id } });

  if (!mod) {
    return null;
  }

  try {
    const modsDir = await getModsDirectory();
    const filepath = join(modsDir, mod.filename);
    await unlink(filepath);
  } catch (error) {
    console.error('Failed to delete mod file:', error);
    // Continue with database deletion even if file delete fails
  }

  await prisma.modFile.delete({ where: { id } });
  await prisma.modMapIndex.deleteMany({ where: { modFilename: mod.filename } });

  return { filename: mod.filename };
}

export async function listMods(): Promise<
  Array<{
    id: string;
    originalName: string;
    size: number;
    sha256: string;
    uploadedAt: Date;
    uploadedBy: { id: string; username: string } | null;
  }>
> {
  const mods = await prisma.modFile.findMany({
    select: {
      id: true,
      originalName: true,
      size: true,
      sha256: true,
      uploadedAt: true,
      uploadedByUser: {
        select: {
          id: true,
          username: true,
        },
      },
    },
    orderBy: { uploadedAt: 'desc' },
  });

  return mods.map((mod) => ({
    id: mod.id,
    originalName: mod.originalName,
    size: mod.size,
    sha256: mod.sha256,
    uploadedAt: mod.uploadedAt,
    uploadedBy: mod.uploadedByUser,
  }));
}

export async function listModMaps(): Promise<{
  maps: Array<{ value: string; label: string | null; source: 'mod' }>;
  timedOut: boolean;
  scannedFiles: number;
  skippedLarge: number;
}> {
  const start = Date.now();
  const maps = new Set<string>();
  let timedOut = false;
  let scannedFiles = 0;
  let skippedLarge = 0;

  let metas: ModFileMeta[] = [];
  try {
    metas = await getModFileMetas();
  } catch (error) {
    console.warn('[mods] Failed to read mods directory for scan:', error);
    return {
      maps: [],
      timedOut: false,
      scannedFiles: 0,
      skippedLarge: 0,
    };
  }

  const filenames = metas.map((meta) => meta.filename);
  if (filenames.length === 0) {
    await prisma.modMapIndex.deleteMany();
    return {
      maps: [],
      timedOut: false,
      scannedFiles: 0,
      skippedLarge: 0,
    };
  }

  // Clean up cache entries for deleted files
  await prisma.modMapIndex.deleteMany({
    where: { modFilename: { notIn: filenames } },
  });

  const cachedEntries = await prisma.modMapIndex.findMany({
    where: { modFilename: { in: filenames } },
  });

  const cacheByKey = new Map<string, string[]>();
  for (const entry of cachedEntries) {
    const key = `${entry.modFilename}:${entry.modSize}:${new Date(entry.modMtime).getTime()}`;
    const existing = cacheByKey.get(key) || [];
    existing.push(entry.mapPath);
    cacheByKey.set(key, existing);
  }

  const modsDir = await getModsDirectory();
  for (const meta of metas) {
    if (Date.now() - start > MAP_SCAN_TIMEOUT_MS) {
      timedOut = true;
      break;
    }

    const cacheKey = buildMetaKey(meta);
    const cachedMaps = cacheByKey.get(cacheKey);
    if (cachedMaps && cachedMaps.length > 0) {
      cachedMaps.forEach((mapPath) => {
        if (mapPath !== NO_MAP_MARKER) {
          maps.add(mapPath);
        }
      });
      continue;
    }

    if (meta.size > MAP_SCAN_MAX_ZIP_MB * 1024 * 1024) {
      skippedLarge += 1;
      continue;
    }

    const filePath = join(modsDir, meta.filename);
    try {
      const zip = new AdmZip(filePath);
      let mapPaths = extractMapPathsFromZip(zip);
      scannedFiles += 1;

      if (mapPaths.length === 0) {
        mapPaths = [NO_MAP_MARKER];
      }

      if (mapPaths.length > 0) {
        await prisma.modMapIndex.deleteMany({
          where: { modFilename: meta.filename },
        });
        await prisma.modMapIndex.createMany({
          data: mapPaths.map((mapPath) => ({
            modFilename: meta.filename,
            modSize: meta.size,
            modMtime: meta.mtime,
            mapPath,
          })),
        });
        mapPaths.forEach((mapPath) => {
          if (mapPath !== NO_MAP_MARKER) {
            maps.add(mapPath);
          }
        });
      }
    } catch (error) {
      console.warn('[mods] Failed to scan mod zip for maps:', meta.filename);
    }
  }

  console.log('[mods] Map scan complete:', {
    mapsFound: maps.size,
    scannedFiles,
    skippedLarge,
    timedOut,
    duration: `${Date.now() - start}ms`,
    cachedFiles: filenames.length - scannedFiles,
  });

  const mapValues = Array.from(maps).sort((a, b) => a.localeCompare(b));
  const labels = await prisma.mapLabel.findMany({
    where: { mapPath: { in: mapValues } },
  });
  const labelMap = new Map(labels.map((entry) => [entry.mapPath, entry.label]));

  return {
    maps: mapValues.map((value) => ({
      value,
      label: labelMap.get(value) || null,
      source: 'mod' as const,
    })),
    timedOut,
    scannedFiles,
    skippedLarge,
  };
}

export async function upsertMapLabel(mapPath: string, label: string): Promise<{ mapPath: string; label: string }> {
  const normalized = mapPath.trim();
  const cleanedLabel = label.trim();

  if (!normalized || !normalized.startsWith('/levels/')) {
    throw new Error('Invalid map path');
  }
  if (!cleanedLabel || cleanedLabel.length > 80) {
    throw new Error('Invalid map label');
  }

  const updated = await prisma.mapLabel.upsert({
    where: { mapPath: normalized },
    create: { mapPath: normalized, label: cleanedLabel },
    update: { label: cleanedLabel },
  });

  return { mapPath: updated.mapPath, label: updated.label };
}
