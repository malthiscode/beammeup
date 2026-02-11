import { hash, verify, argon2id } from 'argon2';

const ARGON2_OPTIONS = {
  timeCost: parseInt(process.env.ARGON2_TIME_COST || '3', 10),
  memoryCost: parseInt(process.env.ARGON2_MEMORY_COST || '65536', 10),
  parallelism: parseInt(process.env.ARGON2_PARALLELISM || '4', 10),
  type: argon2id as 2, // id variant
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    // verify() only accepts secret in options, not hash parameters
    return await verify(hash, password);
  } catch {
    return false;
  }
}
