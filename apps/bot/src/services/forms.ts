import { prisma } from '@pinguin/db';

const cache = new Map<string, { data: any; at: number }>();
const CACHE_MS = 30_000;

export async function getFormSettings(guildId: string) {
  const c = cache.get(guildId);
  if (c && Date.now() - c.at < CACHE_MS) return c.data;
  
  let settings = await prisma.formSettings.findUnique({
    where: { guildId },
    include: { templates: true },
  });
  
  if (!settings) {
    settings = await prisma.formSettings.create({
      data: { 
        guildId,
        enabled: false,
      },
      include: { templates: true },
    });
  }
  
  cache.set(guildId, { data: settings, at: Date.now() });
  return settings;
}

export function invalidateFormCache(guildId: string): void {
  cache.delete(guildId);
}

export async function isFormsActive(guildId: string): Promise<boolean> {
  const settings = await getFormSettings(guildId);
  if (!settings.enabled) return false;
  return !!settings.channelId;
}

export async function setFormChannel(
  guildId: string,
  channelId: string | null,
  logChannelId: string | null = null
) {
  invalidateFormCache(guildId);
  
  return await prisma.formSettings.upsert({
    where: { guildId },
    update: { 
      channelId,
      logChannel: logChannelId,
      enabled: !!channelId,
    },
    create: { 
      guildId,
      channelId,
      logChannel: logChannelId,
      enabled: !!channelId,
    },
  });
}

export async function createFormTemplate(
  guildId: string,
  name: string,
  description: string | null,
  fields: any[]
) {
  invalidateFormCache(guildId);
  
  return await prisma.formTemplate.create({
    data: {
      guildId,
      name,
      description,
      fields: JSON.stringify(fields),
      enabled: true,
    },
  });
}

export async function getFormTemplate(templateId: string) {
  return await prisma.formTemplate.findUnique({
    where: { id: templateId },
  });
}

export async function getEnabledTemplates(guildId: string) {
  return await prisma.formTemplate.findMany({
    where: { 
      guildId,
      enabled: true,
    },
  });
}

export async function updateFormTemplate(
  templateId: string,
  updates: {
    name?: string;
    description?: string;
    fields?: any[];
    enabled?: boolean;
  }
) {
  const template = await prisma.formTemplate.findUnique({
    where: { id: templateId },
  });
  
  if (!template) return null;
  
  invalidateFormCache(template.guildId);
  
  const data: any = {};
  if (updates.name !== undefined) data.name = updates.name;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.fields !== undefined) data.fields = JSON.stringify(updates.fields);
  if (updates.enabled !== undefined) data.enabled = updates.enabled;
  
  return await prisma.formTemplate.update({
    where: { id: templateId },
    data,
  });
}

export async function deleteFormTemplate(templateId: string) {
  const template = await prisma.formTemplate.findUnique({
    where: { id: templateId },
  });
  
  if (template) {
    invalidateFormCache(template.guildId);
  }
  
  return await prisma.formTemplate.delete({
    where: { id: templateId },
  });
}

export async function createFormSubmission(
  guildId: string,
  templateId: string,
  userId: string,
  responses: any[]
) {
  return await prisma.formSubmission.create({
    data: {
      guildId,
      templateId,
      userId,
      responses: JSON.stringify(responses),
      status: 'pending',
    },
  });
}

export async function getFormSubmission(submissionId: string) {
  return await prisma.formSubmission.findUnique({
    where: { id: submissionId },
  });
}

export async function getPendingSubmissions(guildId: string) {
  return await prisma.formSubmission.findMany({
    where: { 
      guildId,
      status: 'pending',
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function updateFormSubmission(
  submissionId: string,
  updates: {
    status?: string;
    reviewedBy?: string;
    reviewedAt?: Date;
  }
) {
  return await prisma.formSubmission.update({
    where: { id: submissionId },
    data: updates,
  });
}