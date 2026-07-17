import { z } from 'zod';
import { defineRepository } from './repository';

export const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** May contain {{variables}} substituted at insertion time (M6). */
  content: z.string(),
  favorite: z.boolean(),
  createdAt: z.number(),
  /** false for the read-only starter templates shipped with the extension */
  userOwned: z.boolean(),
});

export type Template = z.output<typeof templateSchema>;

const templatesStateSchema = z.object({
  templates: z.array(templateSchema),
});

export const templatesRepo = defineRepository({
  key: 'templates',
  version: 1,
  schema: templatesStateSchema,
  defaults: { templates: [] },
});
