import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@pinguin/db';
import { getConfig } from '@pinguin/config';
import { randomUUID } from 'crypto';
import { authenticate } from '../middleware/auth';
import { success, error, getErrorMessage } from '../utils/response';
import * as DiscordService from '../services/discord';

const config = getConfig();
const MAX_ACTIVE_SESSIONS = 10;
const APP_URL = config.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().optional(),
  redirect_uri: z.string().url().optional(),
});

export async function authRoutes(app: FastifyInstance) {
  app.get('/login', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '15 minutes',
      },
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const state = randomUUID();

    reply.setCookie('oauth_state', state, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
    });

    const redirectUri = `${APP_URL}/auth/callback`;

    const url = new URL('https://discord.com/api/oauth2/authorize');
    url.searchParams.set('client_id', config.DISCORD_CLIENT_ID);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'identify email guilds');
    url.searchParams.set('state', state);

    reply.redirect(url.toString());
  });

  app.get('/callback', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '15 minutes',
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = callbackQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send(error('Code d\'autorisation manquant'));
    }

    const storedState = request.cookies?.oauth_state;
    const receivedState = query.data.state;

    if (!storedState || !receivedState || storedState !== receivedState) {
      reply.clearCookie('oauth_state', { path: '/' });
      return reply.status(403).send(error('État de vérification invalide. Veuillez réessayer.'));
    }

    reply.clearCookie('oauth_state', { path: '/' });

    try {
      const redirectUri = query.data.redirect_uri || `${APP_URL}/auth/callback`;
      const tokenData = await DiscordService.exchangeCode(query.data.code, redirectUri);
      const discordUser = await DiscordService.getUser(tokenData.access_token);
      const guilds = await DiscordService.getUserGuilds(tokenData.access_token);

      let user = await prisma.user.findUnique({
        where: { discordId: discordUser.id },
      });

      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            username: discordUser.username,
            avatar: discordUser.avatar,
            email: discordUser.email,
            locale: discordUser.locale || 'fr',
          },
        });
      } else {
        user = await prisma.user.create({
          data: {
            discordId: discordUser.id,
            username: discordUser.username,
            avatar: discordUser.avatar,
            email: discordUser.email,
            locale: discordUser.locale || 'fr',
          },
        });
      }

      await prisma.session.deleteMany({
        where: { userId: user.id, expiresAt: { lt: new Date() } },
      });

      const activeSessions = await prisma.session.count({
        where: { userId: user.id },
      });

      if (activeSessions >= MAX_ACTIVE_SESSIONS) {
        const oldestSessions = await prisma.session.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'asc' },
          take: activeSessions - MAX_ACTIVE_SESSIONS + 1,
          select: { id: true },
        });
        await prisma.session.deleteMany({
          where: { id: { in: oldestSessions.map((s) => s.id) } },
        });
      }

      const sessionToken = randomUUID();
      const sessionId = randomUUID();
      const expiresAt = new Date(Date.now() + config.SESSION_MAX_AGE * 1000);

      await prisma.session.create({
        data: {
          id: sessionId,
          userId: user.id,
          token: sessionToken,
          expiresAt,
        },
      });

      reply.setCookie('session', sessionToken, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: config.SESSION_MAX_AGE,
      });

      const botGuilds = await DiscordService.getBotGuilds();
      const botGuildIds = new Set(botGuilds.map((g: DiscordService.DiscordBotGuild) => g.id));

      const manageableGuilds = guilds
        .filter(
          (g: DiscordService.DiscordGuild) =>
            g.owner === true ||
            DiscordService.canManageGuild(g.permissions)
        )
        .map((g: DiscordService.DiscordGuild) => ({
          id: g.id,
          name: g.name,
          icon: g.icon,
          owner: g.owner,
          permissions: g.permissions,
          botPresent: botGuildIds.has(g.id),
        }));

      await Promise.all(
        manageableGuilds.map((g) =>
          prisma.guild.upsert({
            where: { id: g.id },
            create: {
              id: g.id,
              name: g.name,
              icon: g.icon || null,
              ownerId: g.owner ? discordUser.id : 'unknown',
              memberCount: 0,
              botPresent: g.botPresent,
            },
            update: {
              name: g.name,
              icon: g.icon || null,
              botPresent: g.botPresent,
            },
          })
        )
      );

      await Promise.all(
        manageableGuilds.map((g) =>
          prisma.guildMember.upsert({
            where: { guildId_userId: { guildId: g.id, userId: discordUser.id } },
            create: {
              guildId: g.id,
              userId: discordUser.id,
              permissions: g.permissions,
              isOwner: g.owner,
            },
            update: {
              permissions: g.permissions,
              isOwner: g.owner,
            },
          })
        )
      );

      reply.send(
        success({
          token: sessionToken,
          userId: user.id,
          username: user.username,
          discriminator: '0',
          avatar: user.avatar,
          guilds: manageableGuilds,
        }, 'Connexion réussie')
      );
    } catch (err: unknown) {
      reply.status(401).send(error(getErrorMessage(err) || 'Échec de l\'authentification'));
    }
  });

  app.post('/logout', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user) {
      await prisma.session.delete({
        where: { id: request.user.sessionId },
      });
    }

    reply.clearCookie('session', { path: '/' });
    reply.send(success(null, 'Déconnexion réussie'));
  });

  app.get('/me', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const [user, donor] = await Promise.all([
      prisma.user.findUnique({
        where: { id: request.user!.id },
        select: {
          id: true,
          discordId: true,
          username: true,
          avatar: true,
          email: true,
          locale: true,
          theme: true,
          snowflakes: true,
          createdAt: true,
        },
      }),
      prisma.donor.findUnique({ where: { userId: request.user!.discordId } }),
    ]);

    if (!user) {
      return reply.status(401).send(error('Utilisateur introuvable'));
    }

    reply.send(success({
      id: user.discordId,
      discordId: user.discordId,
      username: user.username,
      avatar: user.avatar,
      email: user.email,
      locale: user.locale,
      theme: user.theme,
      snowflakes: user.snowflakes,
      createdAt: user.createdAt,
      discriminator: '0',
      isOwner: user.discordId === config.DISCORD_OWNER_ID,
      isDonor: !!donor || user.discordId === config.DISCORD_OWNER_ID,
    }));
  });

  app.get('/guilds', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const discordId = request.user!.discordId;

    const [ownedGuilds, memberGuilds] = await Promise.all([
      prisma.guild.findMany({
        where: { ownerId: discordId },
        select: {
          id: true,
          name: true,
          icon: true,
          ownerId: true,
          memberCount: true,
          botPresent: true,
        },
        orderBy: { memberCount: 'desc' },
      }),
      prisma.guildMember.findMany({
        where: { userId: discordId, isOwner: false },
        select: {
          guild: {
            select: {
              id: true,
              name: true,
              icon: true,
              ownerId: true,
              memberCount: true,
              botPresent: true,
            },
          },
          permissions: true,
          isOwner: true,
        },
      }),
    ]);

    const owned = ownedGuilds.map((g) => ({
      ...g,
      permissions: '0',
      owner: true,
    }));

    const member = memberGuilds
      .filter((m) => m.guild !== null)
      .map((m) => ({
        id: m.guild!.id,
        name: m.guild!.name,
        icon: m.guild!.icon,
        ownerId: m.guild!.ownerId,
        memberCount: m.guild!.memberCount,
        botPresent: m.guild!.botPresent,
        permissions: m.permissions,
        owner: false,
      }));

    reply.send(success({ guilds: [...owned, ...member] }));
  });

  app.get('/session', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.id },
      select: {
        id: true,
        discordId: true,
        username: true,
        avatar: true,
        email: true,
        locale: true,
        theme: true,
        snowflakes: true,
      },
    });

    if (!user) {
      return reply.status(401).send(error('Utilisateur introuvable'));
    }

    reply.send(success(user));
  });
}
