// Copies the static assets that `output: "standalone"` omits into the
// standalone folder so `node .next/standalone/server.js` serves everything.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const standalone = join(root, '.next', 'standalone');

if (!existsSync(standalone)) {
  console.error('No .next/standalone found — run `next build` first.');
  process.exit(1);
}

// The standalone server resolves static assets relative to .next/standalone/.next
mkdirSync(join(standalone, '.next'), { recursive: true });

if (existsSync(join(root, 'public'))) {
  cpSync(join(root, 'public'), join(standalone, 'public'), {
    recursive: true,
    force: true,
  });
}

cpSync(
  join(root, '.next', 'static'),
  join(standalone, '.next', 'static'),
  { recursive: true, force: true }
);

console.log('Copied public/ and .next/static/ into .next/standalone/');
