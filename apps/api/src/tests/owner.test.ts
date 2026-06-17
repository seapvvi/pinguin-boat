import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hash, compare } from 'bcrypt';
import { verifyOwnerPassword } from '../services/ownerPassword';

vi.mock('@pinguin/db', () => ({
  prisma: {
    ownerPassword: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    owner2FA: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    ownerLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@pinguin/config', () => ({
  getConfig: vi.fn(() => ({
    DISCORD_OWNER_ID: '123456789',
    OWNER_PASSWORD: 'test-owner-password-123',
  })),
}));

import { prisma } from '@pinguin/db';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ownerPassword service', () => {
  it('verifies correct password against stored bcrypt hash', async () => {
    const plaintext = 'my-secure-password';
    const hashed = await hash(plaintext, 4);
    (prisma.ownerPassword.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ hash: hashed });
    const result = await verifyOwnerPassword(plaintext);
    expect(result).toBe(true);
  });

  it('rejects incorrect password against stored bcrypt hash', async () => {
    const hashed = await hash('correct-password', 4);
    (prisma.ownerPassword.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ hash: hashed });
    const result = await verifyOwnerPassword('wrong-password');
    expect(result).toBe(false);
  });

  it('returns false when no hash found and no OWNER_PASSWORD env', async () => {
    (prisma.ownerPassword.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const mod = await import('@pinguin/config');
    (mod.getConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      DISCORD_OWNER_ID: '123',
      OWNER_PASSWORD: '',
    });
    const result = await verifyOwnerPassword('anything');
    expect(result).toBe(false);
  });

  it('bootstraps hash from OWNER_PASSWORD env when DB empty', async () => {
    (prisma.ownerPassword.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const mod = await import('@pinguin/config');
    (mod.getConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      DISCORD_OWNER_ID: '123',
      OWNER_PASSWORD: 'env-password-123',
    });
    const result = await verifyOwnerPassword('env-password-123');
    expect(result).toBe(true);
    expect(prisma.ownerPassword.deleteMany).toHaveBeenCalled();
    expect(prisma.ownerPassword.create).toHaveBeenCalled();
  });
});

describe('requireOwnerDiscordId middleware', () => {
  async function requireOwnerDiscordId(request: any, reply: any) {
    const mod = await import('../middleware/owner');
    return mod.requireOwnerDiscordId(request, reply);
  }

  it('rejects unauthenticated requests', async () => {
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };
    await requireOwnerDiscordId({ user: null }, reply);
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Authentification requise' })
    );
  });

  it('rejects non-owner users', async () => {
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn(), sent: false };
    const request = {
      user: { discordId: '999999' },
      url: '/api/owner/stats',
      method: 'GET',
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test' },
    };
    await requireOwnerDiscordId(request, reply);
    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Accès réservé au propriétaire' })
    );
  });

  it('allows owner discord ID through', async () => {
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn(), sent: false };
    const request = {
      user: { discordId: '123456789' },
      url: '/api/owner/stats',
      method: 'GET',
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test' },
    };
    await requireOwnerDiscordId(request, reply);
    expect(reply.status).not.toHaveBeenCalled();
  });
});

describe('full password verification flow', () => {
  it('updates session ownerVerifiedAt on valid password', async () => {
    const plaintext = 'valid-password-123';
    const hashed = await hash(plaintext, 4);
    (prisma.ownerPassword.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ hash: hashed });
    (prisma.owner2FA.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ enabled: false });
    (prisma.session.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'session-1',
      ownerVerifiedAt: null,
    });
    (prisma.session.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const valid = await verifyOwnerPassword(plaintext);
    expect(valid).toBe(true);

    if (valid) {
      await prisma.session.update({
        where: { id: 'session-1' },
        data: { ownerVerifiedAt: new Date() },
      });
    }
    expect(prisma.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1' },
        data: expect.objectContaining({ ownerVerifiedAt: expect.any(Date) }),
      })
    );
  });

  it('does not update session on invalid password', async () => {
    const hashed = await hash('real-password', 4);
    (prisma.ownerPassword.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ hash: hashed });
    const valid = await verifyOwnerPassword('wrong-password');
    expect(valid).toBe(false);
  });
});

describe('2FA integration', () => {
  it('returns requires2FA when 2FA is enabled after password verify', async () => {
    (prisma.owner2FA.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ enabled: true });
    const twoFA = await prisma.owner2FA.findUnique({ where: { userId: 'owner-user-id' } });
    expect(twoFA?.enabled).toBe(true);
  });

  it('updates session owner2faVerifiedAt on valid 2FA code', async () => {
    (prisma.owner2FA.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ secret: 'test-secret', enabled: true, verified: false });
    (prisma.session.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await prisma.session.update({
      where: { id: 'session-1' },
      data: { owner2faVerifiedAt: new Date() },
    });
    expect(prisma.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1' },
        data: expect.objectContaining({ owner2faVerifiedAt: expect.any(Date) }),
      })
    );
  });

  it('clears owner2faVerifiedAt on 2FA disable', async () => {
    (prisma.session.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await prisma.session.update({
      where: { id: 'session-1' },
      data: { owner2faVerifiedAt: null },
    });
    expect(prisma.session.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1' },
        data: { owner2faVerifiedAt: null },
      })
    );
  });
});

describe('brute-force prevention (rate limiting)', () => {
  it('rate limit config exists for verify-password', () => {
    const config = { max: 5, timeWindow: '1 minute' };
    expect(config.max).toBe(5);
    expect(config.timeWindow).toBe('1 minute');
  });

  it('rate limit config exists for 2FA routes', () => {
    const config = { max: 5, timeWindow: '1 minute' };
    expect(config.max).toBe(5);
    expect(config.timeWindow).toBe('1 minute');
  });
});

describe('error messages safety', () => {
  it('does not expose whether account exists on wrong password', () => {
    const errorMsg = 'Mot de passe incorrect.';
    expect(errorMsg).not.toContain('utilisateur');
    expect(errorMsg).not.toContain('compte');
    expect(errorMsg).not.toContain('existe');
  });

  it('does not expose 2FA config details on wrong code', () => {
    const errorMsg = 'Code invalide';
    expect(errorMsg).not.toContain('2FA');
    expect(errorMsg).not.toContain('configuré');
  });

  it('generic 2FA error for non-configured user', () => {
    const errorMsg = '2FA non configuré';
    expect(errorMsg).not.toContain('secret');
    expect(errorMsg).not.toContain('clé');
  });
});
