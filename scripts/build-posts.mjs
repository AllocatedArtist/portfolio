import { execFileSync } from 'node:child_process';
import { writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';

const SRC = 'posts', OUT = 'src/content/blog';
const pandoc = a => execFileSync('pandoc', a, { encoding: 'utf8', maxBuffer: 32e6 });

mkdirSync(OUT, { recursive: true });

if (!existsSync(SRC)) {
  console.log(`build-posts: no ${SRC}/ directory, nothing to convert.`);
  process.exit(0);
}

const files = readdirSync(SRC).filter(f => f.endsWith('.tex'));
if (files.length === 0) console.log(`build-posts: ${SRC}/ has no .tex files yet.`);

for (const f of files) {
  const src = join(SRC, f), slug = basename(f, '.tex');
  const [title, date] = pandoc([src, '-f', 'latex', '-t', 'plain', '--template=scripts/meta.tpl'])
    .split('\n').map(s => s.trim());
  if (!title) throw new Error(`${src}: missing \\title`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error(`${src}: \\date must be literal YYYY-MM-DD, got "${date}"`);
  const html = pandoc([src, '-f', 'latex', '-t', 'html5', '--mathml', '--shift-heading-level-by=1', '--toc', '--standalone', '--template=scripts/post.tpl']);
  writeFileSync(join(OUT, `${slug}.json`), JSON.stringify({ title, date, html }));
  console.log(`ok ${slug}  ${date}  ${title}`);
}
