import { prisma } from '../index.js';
import { createHash } from 'crypto';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import AdmZip from 'adm-zip';
import { readConfigFile } from './config.js';

let MODS_DIR = process.env.BEAMMP_RESOURCES_PATH || '/beammp/Resources/Client';
const MAX_ZIP_SIZE = parseInt(process.env.MAX_MOD_SIZE || '500') * 1024 * 1024; // 500MB default

// Ensure mods directory exists
await mkdir(MODS_DIR, { recursive: true });

// Try to resolve mod path from config
async function getModsDirectory(): Promise<string> {
  try {
    const config = await readConfigFile();
    const resourceFolder = config.General?.ResourceFolder || 'Resources';
    return `/beammp/${resourceFolder}/Client`;
  } catch {
    return MODS_DIR;
  }
}

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
  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    for (const entry of entries) {
      // Prevent zip-slip attacks
      if (entry.entryName.includes('..') || entry.entryName.startsWith('/')) {
        throw new Error('Invalid zip file structure');
      }
    }
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
