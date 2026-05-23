import { z } from 'zod';

export const discordIdSchema = z
  .string()
  .regex(/^\d{17,20}$/, 'ID Discord invalide');

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadécimale invalide');

export const durationSchema = z
  .number()
  .int()
  .positive('La durée doit être positive')
  .max(31536000, 'La durée ne peut pas dépasser 1 an');

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const reasonSchema = z
  .string()
  .min(1, 'La raison est requise')
  .max(1000, 'La raison ne peut pas dépasser 1000 caractères');
