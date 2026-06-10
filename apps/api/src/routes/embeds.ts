import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma, parseEmbedFields, serializeEmbedFields } from '@pinguin/db';
import { authenticate } from '../middleware/auth';
import { requireGuildAdmin } from '../middleware/guild-auth';
import { validateParams, validateBody } from '../middleware/validate';
import { success, error, sanitizeError } from '../utils/response';
import { sendChannelMessage } from '../services/discord';

const guildIdSchema = z.object({ guildId: z.string().min(1) });
const embedIdSchema = z.object({ guildId: z.string().min(1), id: z.string().min(1) });

const embedFieldSchema = z.object({
  name: z.string(),
  value: z.string(),
  inline: z.boolean().default(false),
});

const createEmbedSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  title: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  color: z.string().default('#5865F2'),
  fields: z.array(embedFieldSchema).default([]),
  footer: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  thumbnail: z.string().optional().nullable(),
  authorName: z.string().optional().nullable(),
  authorIcon: z.string().optional().nullable(),
  timestamp: z.boolean().default(true),
});

const updateEmbedSchema = createEmbedSchema.partial();

const sendEmbedSchema = z.object({
  channelId: z.string().min(1, 'Salon requis'),
  embed: z.object({
    title: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    color: z.string().default('#5865F2'),
    fields: z.array(embedFieldSchema).default([]),
    footer: z.string().optional().nullable(),
    image: z.string().optional().nullable(),
    thumbnail: z.string().optional().nullable(),
    authorName: z.string().optional().nullable(),
    authorIcon: z.string().optional().nullable(),
    timestamp: z.boolean().default(true),
  }),
});

function hexToDecimal(hex: string): number {
  const cleaned = hex.replace('#', '');
  return parseInt(cleaned, 16) || 0x5865F2;
}

function embedDataToDiscordPayload(data: z.infer<typeof sendEmbedSchema>['embed']) {
  const payload: Record<string, unknown> = {
    title: data.title ?? undefined,
    description: data.description ?? undefined,
    color: hexToDecimal(data.color),
    fields: data.fields.map((f) => ({ name: f.name, value: f.value, inline: f.inline })),
    footer: data.footer ? { text: data.footer } : undefined,
    image: data.image ? { url: data.image } : undefined,
    thumbnail: data.thumbnail ? { url: data.thumbnail } : undefined,
    author: data.authorName ? { name: data.authorName, icon_url: data.authorIcon ?? undefined } : undefined,
    timestamp: data.timestamp ? new Date().toISOString() : undefined,
  };
  Object.keys(payload).forEach((k) => { if (payload[k] === undefined) delete payload[k]; });
  return payload;
}

export async function embedRoutes(app: FastifyInstance) {
  // GET /guilds/:guildId/embeds — liste des templates
  app.get('/:guildId/embeds', {
    preHandler: [authenticate, validateParams(guildIdSchema)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const embeds = await prisma.savedEmbed.findMany({
        where: { guildId },
        orderBy: { createdAt: 'desc' },
      });
      const mapped = embeds.map((e) => ({
        id: e.id,
        name: e.name,
        title: e.title,
        description: e.description,
        color: e.color,
        fields: parseEmbedFields(e.fields),
        footer: e.footer,
        image: e.image,
        thumbnail: e.thumbnail,
        authorName: e.authorName,
        authorIcon: e.authorIcon,
        timestamp: e.timestamp,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));
      reply.send(success({ embeds: mapped }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  // POST /guilds/:guildId/embeds — création
  app.post('/:guildId/embeds', {
    preHandler: [authenticate, requireGuildAdmin, validateParams(guildIdSchema), validateBody(createEmbedSchema)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as z.infer<typeof createEmbedSchema>;
      const embed = await prisma.savedEmbed.create({
        data: {
          guildId,
          name: body.name,
          title: body.title ?? null,
          description: body.description ?? null,
          color: body.color,
          fields: serializeEmbedFields(body.fields ?? []),
          footer: body.footer ?? null,
          image: body.image ?? null,
          thumbnail: body.thumbnail ?? null,
          authorName: body.authorName ?? null,
          authorIcon: body.authorIcon ?? null,
          timestamp: body.timestamp,
        },
      });
      reply.status(201).send(success({
        id: embed.id,
        name: embed.name,
        title: embed.title,
        description: embed.description,
        color: embed.color,
        fields: parseEmbedFields(embed.fields),
        footer: embed.footer,
        image: embed.image,
        thumbnail: embed.thumbnail,
        authorName: embed.authorName,
        authorIcon: embed.authorIcon,
        timestamp: embed.timestamp,
        createdAt: embed.createdAt,
        updatedAt: embed.updatedAt,
      }, 'Embed créé'));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  // PUT /guilds/:guildId/embeds/:id — mise à jour
  app.put('/:guildId/embeds/:id', {
    preHandler: [authenticate, requireGuildAdmin, validateParams(embedIdSchema), validateBody(updateEmbedSchema)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const existing = await prisma.savedEmbed.findFirst({ where: { id, guildId } });
      if (!existing) {
        return reply.status(404).send(error('Embed introuvable'));
      }
      const body = request.body as z.infer<typeof updateEmbedSchema>;
      const data: Record<string, unknown> = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.title !== undefined) data.title = body.title ?? null;
      if (body.description !== undefined) data.description = body.description ?? null;
      if (body.color !== undefined) data.color = body.color;
      if (body.fields !== undefined) data.fields = serializeEmbedFields(body.fields ?? []);
      if (body.footer !== undefined) data.footer = body.footer ?? null;
      if (body.image !== undefined) data.image = body.image ?? null;
      if (body.thumbnail !== undefined) data.thumbnail = body.thumbnail ?? null;
      if (body.authorName !== undefined) data.authorName = body.authorName ?? null;
      if (body.authorIcon !== undefined) data.authorIcon = body.authorIcon ?? null;
      if (body.timestamp !== undefined) data.timestamp = body.timestamp;

      const embed = await prisma.savedEmbed.update({
        where: { id },
        data,
      });
      reply.send(success({
        id: embed.id,
        name: embed.name,
        title: embed.title,
        description: embed.description,
        color: embed.color,
        fields: parseEmbedFields(embed.fields),
        footer: embed.footer,
        image: embed.image,
        thumbnail: embed.thumbnail,
        authorName: embed.authorName,
        authorIcon: embed.authorIcon,
        timestamp: embed.timestamp,
        createdAt: embed.createdAt,
        updatedAt: embed.updatedAt,
      }, 'Embed mis à jour'));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  // DELETE /guilds/:guildId/embeds/:id — suppression
  app.delete('/:guildId/embeds/:id', {
    preHandler: [authenticate, requireGuildAdmin, validateParams(embedIdSchema)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const existing = await prisma.savedEmbed.findFirst({ where: { id, guildId } });
      if (!existing) {
        return reply.status(404).send(error('Embed introuvable'));
      }
      await prisma.savedEmbed.delete({ where: { id } });
      reply.send(success(null, 'Embed supprimé'));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  // POST /guilds/:guildId/embeds/:id/send — envoi dans un salon Discord
  app.post('/:guildId/embeds/:id/send', {
    preHandler: [authenticate, requireGuildAdmin, validateParams(embedIdSchema), validateBody(sendEmbedSchema)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const body = request.body as z.infer<typeof sendEmbedSchema>;

      const existing = await prisma.savedEmbed.findFirst({ where: { id, guildId } });
      if (!existing) {
        return reply.status(404).send(error('Embed introuvable'));
      }

      const discordPayload = embedDataToDiscordPayload(body.embed);
      await sendChannelMessage(body.channelId, { embeds: [discordPayload] });

      reply.send(success(null, 'Embed envoyé sur Discord'));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });
}
