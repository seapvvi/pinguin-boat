import { defineConfig } from '@prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasourceUrl: process.env.DATABASE_URL,
});
