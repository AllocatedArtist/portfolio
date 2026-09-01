import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import type { Loader, LoaderContext } from "astro/loaders";

const run = promisify(execFile);

/**
 * Content loader for LaTeX writeups.
 *
 * `src/content/posts/*.tex` is the collection source directly, alongside the
 * markdown in `src/content/projects/`. There is no generated JSON
 * intermediate, no prebuild step, and nothing to gitignore: Astro calls this
 * during `astro build` and, in dev, re-runs a single file whenever it is
 * saved.
 *
 * Two pandoc passes per file, same as before:
 *   1. metadata, via scripts/meta.tpl  -> title, date, subtitle
 *   2. body, via scripts/post.tpl      -> table of contents + MathML html
 *
 * pandoc must be on PATH. CI installs it in .github/workflows/deploy.yml.
 */

const MAX_BLURB = 180;
const MIN_BLURB = 24;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * Fallback blurb: the first sentence of the body, used when a post has no
 * explicit \subtitle.
 *
 * The TOC nav is stripped first, since scripts/post.tpl puts a <p>Contents</p>
 * inside it. MathML is dropped rather than flattened, because stripping its
 * tags would concatenate every <mi>/<mo> into noise.
 */
function firstSentence(html: string): string | undefined {
  const body = html.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  const para = body.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!para) return undefined;

  const text = para[1]
    .replace(/<math[\s\S]*?<\/math>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&(\w+);/g, (m, name: string) => ENTITIES[name] ?? m)
    .replace(/\s+/g, " ")
    .trim();

  if (text.length < MIN_BLURB) return undefined;

  // Terminator followed by whitespace or end, so "16.5" does not split early.
  const match = text.match(/^[\s\S]*?[.!?](?=\s|$)/);
  let out = (match ? match[0] : text).trim();

  if (out.length > MAX_BLURB) {
    out = out.slice(0, MAX_BLURB - 1).replace(/\s+\S*$/, "") + "…";
  }
  return out;
}

interface PostData extends Record<string, unknown> {
  title: string;
  date: string;
  blurb?: string;
}

interface Converted {
  data: PostData;
  html: string;
  headings: Array<{ depth: number; slug: string; text: string }>;
  warnings: string;
}

/**
 * Headings for `rendered.metadata`, so `render(entry)` returns them alongside
 * Content. pandoc already emits a table of contents into the body, but having
 * these means a page can build its own without re-parsing the HTML.
 */
function extractHeadings(html: string) {
  const out: Array<{ depth: number; slug: string; text: string }> = [];
  const re = /<h([1-6])[^>]*\sid="([^"]*)"[^>]*>([\s\S]*?)<\/h\1>/gi;
  for (const m of html.matchAll(re)) {
    out.push({
      depth: Number(m[1]),
      slug: m[2],
      text: m[3].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
    });
  }
  return out;
}

async function convert(file: string, root: string): Promise<Converted> {
  const pandoc = (args: string[]) =>
    run("pandoc", args, { maxBuffer: 32e6, cwd: root });

  // --wrap=none is load-bearing: the plain writer wraps at 72 columns, so a
  // long \title or \subtitle would spill onto the next line and shift every
  // field below it.
  //
  // This pass's stderr is deliberately discarded. The plain writer cannot
  // render math and warns once per expression, which on a maths-heavy post is
  // dozens of warnings about output we throw away except for three lines.
  // Only the body pass below can produce a warning worth reading.
  const meta = await pandoc([
    file, "-f", "latex", "-t", "plain", "--wrap=none",
    "--template=scripts/meta.tpl",
  ]);

  const [title, date, subtitle = ""] = meta.stdout.split("\n").map((s) => s.trim());

  if (!title) throw new Error(`${file}: missing \\title`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // \date{\today} resolves to the build date and silently reorders the blog.
    throw new Error(`${file}: \\date must be literal YYYY-MM-DD, got "${date}"`);
  }
  if (subtitle.length > MAX_BLURB) {
    throw new Error(`${file}: \\subtitle is ${subtitle.length} chars, max ${MAX_BLURB}`);
  }

  const body = await pandoc([
    file, "-f", "latex", "-t", "html5", "--mathml",
    "--shift-heading-level-by=1",
    "--toc", "--standalone", "--template=scripts/post.tpl",
  ]);

  return {
    data: {
      title,
      date,
      blurb: subtitle || firstSentence(body.stdout),
    },
    html: body.stdout,
    headings: extractHeadings(body.stdout),
    // Only the body pass can produce a warning worth reading.
    warnings: body.stderr.trim(),
  };
}

export interface TexLoaderOptions {
  /** Directory of .tex files, relative to the project root. */
  dir?: string;
  /**
   * Directory under public/ holding post figures. A relative <img src> in the
   * pandoc output is rewritten to `<base>/<figures>/<src>`.
   */
  figures?: string;
}

/**
 * Rewrite relative figure paths to absolute, base-prefixed URLs.
 *
 * pandoc emits whatever path the .tex wrote, verbatim: it does not resolve
 * \graphicspath. A bare `src="pbr/lobe.png"` would otherwise resolve against
 * the current page URL, so it would break differently on /posts/x/ than on a
 * listing page, and would miss the /portfolio deploy base entirely.
 *
 * Absolute paths and full URLs are left alone.
 */
function rewriteFigures(html: string, base: string, figures: string): string {
  const prefix = `${base.replace(/\/+$/, "")}/${figures.replace(/^\/+|\/+$/g, "")}`;
  return html.replace(
    /(<img\b[^>]*?\ssrc=")([^"]+)(")/gi,
    (whole, head: string, src: string, tail: string) => {
      if (/^([a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(src)) return whole;
      return `${head}${prefix}/${src.replace(/^\.\//, "")}${tail}`;
    },
  );
}

export function texLoader({
  dir = "src/content/posts",
  figures = "figures",
}: TexLoaderOptions = {}): Loader {
  return {
    name: "tex-loader",

    async load({ store, logger, watcher, parseData, generateDigest, config }: LoaderContext) {
      const root = fileURLToPath(config.root);
      const srcDir = resolve(root, dir);

      /**
       * @param strict throw on bad metadata (build) vs log and keep the last
       *   good entry (dev watch). You save half-written files constantly while
       *   writing; that must not take down the dev server.
       */
      async function sync(file: string, strict: boolean): Promise<void> {
        const id = basename(file, ".tex");
        const abs = join(srcDir, `${id}.tex`);

        try {
          const source = await readFile(abs, "utf-8");
          const digest = generateDigest(source);
          if (store.get(id)?.digest === digest) return;

          const { data: raw, html: rawHtml, headings, warnings } = await convert(
            join(dir, `${id}.tex`), root);

          const html = rewriteFigures(rawHtml, config.base ?? "/", figures);

          if (warnings) {
            // Almost always "Could not convert TeX math", which pandoc renders
            // as literal source rather than failing. Silent otherwise.
            logger.warn(`${id}.tex\n${warnings}`);
          }

          const data = await parseData({ id, data: raw, filePath: abs });

          // `rendered` is what makes render(entry) return a <Content /> the
          // same way a markdown entry does. The HTML deliberately does not
          // live in `data`: it would double the store size and invite pages
          // to reach for set:html instead.
          store.set({
            id,
            data,
            digest,
            filePath: join(dir, `${id}.tex`),
            rendered: { html, metadata: { headings } },
          });
        } catch (error) {
          if (strict) throw error;
          logger.error(`${id}.tex: ${(error as Error).message}`);
        }
      }

      // Known trap: an empty content directory is not tracked by git, so a
      // fresh clone may not have it at all. That is a normal state, not an
      // error, and must not fail the build.
      if (!existsSync(srcDir)) {
        logger.info(`No ${dir}/ directory, nothing to convert.`);
        store.clear();
        return;
      }

      const files = (await readdir(srcDir)).filter((f) => f.endsWith(".tex"));

      store.clear();
      for (const file of files) await sync(file, true);
      logger.info(`Converted ${files.length} post${files.length === 1 ? "" : "s"}.`);

      // watcher is only present in dev.
      if (!watcher) return;

      watcher.add(srcDir);

      const onChange = (path: string) => {
        if (!path.endsWith(".tex") || !path.startsWith(srcDir)) return;
        logger.info(`Rebuilding ${basename(path)}`);
        void sync(path, false);
      };

      watcher.on("add", onChange);
      watcher.on("change", onChange);
      watcher.on("unlink", (path: string) => {
        if (!path.endsWith(".tex") || !path.startsWith(srcDir)) return;
        store.delete(basename(path, ".tex"));
        logger.info(`Removed ${basename(path)}`);
      });
    },
  };
}
