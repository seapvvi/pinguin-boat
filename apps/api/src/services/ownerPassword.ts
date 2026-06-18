import { hash, compare } from 'bcrypt';
import { prisma } from '@pinguin/db';
import { getConfig } from '@pinguin/config';

const BCRYPT_ROUNDS = 12;

async function getStoredHash(): Promise<string | null> {
  const row = await prisma.ownerPassword.findFirst({ orderBy: { createdAt: 'desc' } });
  return row?.hash ?? null;
}

async function storeHash(hashValue: string): Promise<void> {
  await prisma.ownerPassword.deleteMany();
  await prisma.ownerPassword.create({ data: { hash: hashValue } });
}

export async function ensureOwnerPasswordHash(): Promise<void> {
  const config = getConfig();

  if (!config.OWNER_PASSWORD) {
    console.warn('[OWNER] OWNER_PASSWORD non configuré');
    return;
  }

  const existing = await getStoredHash();

  if (existing) {
    const match = await compare(config.OWNER_PASSWORD, existing);
    if (match) {
      console.log('[OWNER] Hash mot de passe owner à jour');
      return;
    }
    console.log('[OWNER] Mot de passe modifié — mise à jour du hash');
    const hashed = await hash(config.OWNER_PASSWORD, BCRYPT_ROUNDS);
    await storeHash(hashed);
    console.log('[OWNER] Hash mot de passe owner mis à jour');
    return;
  }

  const hashed = await hash(config.OWNER_PASSWORD, BCRYPT_ROUNDS);
  await storeHash(hashed);
  console.log('[OWNER] Hash mot de passe owner initialisé');
}

export async function verifyOwnerPassword(password: string): Promise<boolean> {
  const stored = await getStoredHash();
  if (!stored) {
    const config = getConfig();
    if (config.OWNER_PASSWORD) {
      const hashed = await hash(config.OWNER_PASSWORD, BCRYPT_ROUNDS);
      await storeHash(hashed);
      return compare(password, hashed);
    }
    return false;
  }
  return compare(password, stored);
}
