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
  const existing = await getStoredHash();
  if (existing) return;

  if (!config.OWNER_PASSWORD) {
    console.warn('[OwnerPassword] OWNER_PASSWORD non configuré');
    return;
  }

  console.warn('[OwnerPassword] Aucun hash trouvé en base — hachage du mot de passe .env...');
  const hashed = await hash(config.OWNER_PASSWORD, BCRYPT_ROUNDS);
  await storeHash(hashed);
  console.warn('[OwnerPassword] Hash stocké avec succès. Vous pouvez supprimer OWNER_PASSWORD du .env si souhaité.');
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
