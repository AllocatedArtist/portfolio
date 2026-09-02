import { defineCollection, reference } from 'astro:content';
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
    // Describe what the image shows. Omit it and the cover is treated as
    // decorative (alt=""), which is correct when it adds nothing beyond the
    // title already above it.
    coverAlt: z.string().optional(),
    // Bare 11-char YouTube ID, not a URL and not a self-hosted file. Rejecting
    // a pasted URL here is deliberate: it fails at build with a clear message
    // rather than rendering a broken iframe.
    video: z
      .string()
      .regex(/^[A-Za-z0-9_-]{11}$/, 'video must be a bare YouTube ID, not a URL')
      .optional(),
    // External destinations only: repo, demo, paper. Values must be absolute
    // URLs. Internal cross-links go through `post` below, which is validated
    // against the collection and gets the deploy base applied at render.
    links: z.record(z.string(), z.string().url()).default({}),
    // Slug of the post that writes this project up. reference() fails the
    // build if the post does not exist, so a renamed post cannot leave a
    // dangling link. The reverse link on the post page is derived from this,
    // so the relationship is declared once.
    post: reference('posts').optional(),
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
