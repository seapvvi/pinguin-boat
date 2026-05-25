import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@pinguin/db';
import { getConfig } from '@pinguin/config';
import { randomUUID } from 'crypto';
import { authenticate } from '../middleware/auth';
import { success, error } from '../utils/response';
import * as DiscordService from '../services/discord';

const config = getConfig();

export async function authRoutes(app: FastifyInstance) {
  app.get('/login', async (_request: FastifyRequest, reply: FastifyReply) => {
    const url = new URL('https://discord.com/api/oauth2/authorize');
    url.searchParams.set('client_id', config.DISCORD_CLIENT_ID);
    url.searchParams.set('redirect_uri', config.NEXT_PUBLIC_DISCORD_REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'identify email guilds');
    url.searchParams.set('prompt', 'none');

    reply.redirect(url.toString());
  });

  const callbackQuerySchema = z.object({
    code: z.string().min(1),
    state: z.string().optional(),
  });

  app.get('/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = callbackQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send(error('Code d\'autorisation manquant'));
    }

    try {
      const tokenData = await DiscordService.exchangeCode(query.data.code);
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

      const sessionToken = randomUUID();
      const expiresAt = new Date(
        Date.now() + config.SESSION_MAX_AGE * 1000
      );

      await prisma.session.create({
        data: {
          id: randomUUID(),
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
      const botGuildIds = new Set(botGuilds.map((g: any) => g.id));

      const manageableGuilds = guilds
        .filter(
          (g: any) =>
            g.owner === true ||
            DiscordService.canManageGuild(g.permissions)
        )
        .map((g: any) => ({
          id: g.id,
          name: g.name,
          icon: g.icon,
          owner: g.owner,
          permissions: g.permissions,
          botPresent: botGuildIds.has(g.id),
        }));

      const dbGuildIds = new Set(
        (await prisma.guild.findMany({ select: { id: true } })).map((g) => g.id)
      );

      for (const g of manageableGuilds) {
        if (!dbGuildIds.has(g.id)) {
          await prisma.guild.create({
            data: {
              id: g.id,
              name: g.name,
              icon: g.icon || null,
              ownerId: discordUser.id,
              memberCount: 0,
              botPresent: g.botPresent,
            },
          });
        } else {
          await prisma.guild.update({
            where: { id: g.id },
            data: {
              name: g.name,
              icon: g.icon || null,
              botPresent: g.botPresent,
            },
          });
        }
      }

      reply.send(
        success({
          token: sessionToken,
          userId: user.id,
          username: user.username,
          avatar: user.avatar,
          guilds: manageableGuilds,
        }, 'Connexion réussie')
      );
    } catch (err: any) {
      reply.status(401).send(error(err.message || 'Échec de l\'authentification'));
    }
  });

  app.post('/logout', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user) {
      await prisma.session.deleteMany({
        where: { userId: request.user.id },
      });
    }

    reply.clearCookie('session', { path: '/' });
    reply.send(success(null, 'Déconnexion réussie'));
  });

  app.get('/me', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
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
        createdAt: true,
      },
    });

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
    }));
  });

  app.get('/guilds', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userGuilds = await prisma.guild.findMany({
      where: { ownerId: request.user!.discordId },
      select: {
        id: true,
        name: true,
        icon: true,
        ownerId: true,
        memberCount: true,
        botPresent: true,
      },
      orderBy: { memberCount: 'desc' },
    });

    const ownedGuilds = userGuilds.map((g) => ({
      ...g,
      permissions: '0',
      owner: g.ownerId === request.user!.discordId,
    }));

    reply.send(success({ guilds: ownedGuilds }));
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
