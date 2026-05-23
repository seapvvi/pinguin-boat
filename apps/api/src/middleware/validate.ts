import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodSchema } from 'zod';

type ValidationTarget = 'body' | 'params' | 'query';

export function validate(
  schema: ZodSchema,
  target: ValidationTarget = 'body'
) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const data = request[target];
    const result = schema.safeParse(data);

    if (!result.success) {
      const errors = result.error.flatten();
      reply.status(400).send({
        success: false,
        error: 'Données invalides',
        details: errors.fieldErrors,
      });
      return;
    }

    if (target === 'body') {
      (request as any).body = result.data;
    } else if (target === 'params') {
      (request as any).params = result.data;
    } else if (target === 'query') {
      (request as any).query = result.data;
    }
  };
}

export function validateBody(schema: ZodSchema) {
  return validate(schema, 'body');
}

export function validateParams(schema: ZodSchema) {
  return validate(schema, 'params');
}

export function validateQuery(schema: ZodSchema) {
  return validate(schema, 'query');
}
