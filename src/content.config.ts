import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.md' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    date: z.coerce.date(),
    blurb: z.string().max(180),
    cover: image(),
    video: z.string().optional(),
    links: z.record(z.string(), z.string().url()).default({}),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    order: z.number().default(999),
  }),
});

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.json' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    // First sentence of the body, derived by scripts/build-posts.mjs.
    // Optional: a post whose opening paragraph is mostly math yields nothing
    // usable, and a missing blurb is a listing without a subtitle, not an error.
    blurb: z.string().max(180).optional(),
    html: z.string(),
    pdf: z.string().optional(),
  }),
});

export const collections = { projects, blog };
