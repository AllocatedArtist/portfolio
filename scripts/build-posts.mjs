import { execFileSync } from 'node:child_process';
import { writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';

const SRC = 'posts', OUT = 'src/content/blog';
const pandoc = a => execFileSync('pandoc', a, { encoding: 'utf8', maxBuffer: 32e6 });

/**
 * Blurb for listing pages: the first sentence of the post body.
 *
 * Derived here rather than at render time so it is stored once in the JSON
 * and every consumer sees the same string.
 *
 * The TOC nav is removed first: scripts/post.tpl puts a <p>Contents</p>
 * inside it, which would otherwise be the first paragraph found. MathML
 * is dropped rather than flattened: stripping its tags would concatenate
 * every <mi>/<mo> into noise like "Loofrpwiwo". A first sentence that leans
 * on an equation is a poor teaser anyway, so if that leaves the text too
 * short we return nothing and the listing simply shows no blurb.
 */
const MAX_BLURB = 180;
const MIN_BLURB = 24;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function blurbFrom(html) {
  const body = html.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  const para = body.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!para) return undefined;

  const text = para[1]
    .replace(/<math[\s\S]*?<\/math>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&(\w+);/g, (m, name) => ENTITIES[name] ?? m)
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length < MIN_BLURB) return undefined;

  // First terminator followed by whitespace or end of string, so decimals
  // and "1.5x" do not split the sentence early.
  const match = text.match(/^[\s\S]*?[.!?](?=\s|$)/);
  let out = (match ? match[0] : text).trim();

  if (out.length > MAX_BLURB) {
    // Cut on a word boundary, then close with a real ellipsis (U+2026),
    // which is in the font subset.
    out = out.slice(0, MAX_BLURB - 1).replace(/\s+\S*$/, '') + '\u2026';
  }
  return out;
}

mkdirSync(OUT, { recursive: true });

if (!existsSync(SRC)) {
  console.log(`build-posts: no ${SRC}/ directory, nothing to convert.`);
  process.exit(0);
}

const files = readdirSync(SRC).filter(f => f.endsWith('.tex'));
if (files.length === 0) console.log(`build-posts: ${SRC}/ has no .tex files yet.`);

for (const f of files) {
  const src = join(SRC, f), slug = basename(f, '.tex');
  // --wrap=none is load-bearing: the plain writer wraps at 72 columns by
  // default, so a long \title or \subtitle would spill onto the next line
  // and shift every field below it.
  const [title, date, subtitle = ''] = pandoc(
    [src, '-f', 'latex', '-t', 'plain', '--wrap=none', '--template=scripts/meta.tpl'])
    .split('\n').map(s => s.trim());
  if (!title) throw new Error(`${src}: missing \\title`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error(`${src}: \\date must be literal YYYY-MM-DD, got "${date}"`);
  if (subtitle.length > MAX_BLURB)
    throw new Error(`${src}: \\subtitle is ${subtitle.length} chars, max ${MAX_BLURB}`);
  const html = pandoc([src, '-f', 'latex', '-t', 'html5', '--mathml', '--shift-heading-level-by=1', '--toc', '--standalone', '--template=scripts/post.tpl']);
  // An explicit \subtitle wins; the first sentence is the fallback so posts
  // written before this existed still get a listing subtitle.
  const blurb = subtitle || blurbFrom(html);
  const source = subtitle ? 'subtitle' : blurb ? 'first sentence' : 'none';
  writeFileSync(join(OUT, `${slug}.json`), JSON.stringify({ title, date, blurb, html }));
  console.log(`ok ${slug}  ${date}  ${title}  (blurb: ${source})`);
}
