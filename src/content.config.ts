import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { texLoader } from './loaders/tex';
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

const posts = defineCollection({
  // src/content/posts/*.tex is the source of truth, sitting alongside the
  // markdown projects. No generated JSON, no prebuild step.
  loader: texLoader({ dir: 'src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    // First sentence of the body, derived by scripts/build-posts.mjs.
    // Optional: a post whose opening paragraph is mostly math yields nothing
    // usable, and a missing blurb is a listing without a subtitle, not an error.
    blurb: z.string().max(180).optional(),
    // The converted HTML lives on `rendered`, not in data, so posts render
    // with render(entry) and <Content /> just like the markdown projects do.
    pdf: z.string().optional(),
  }),
});

export const collections = { projects, posts };
