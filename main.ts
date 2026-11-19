// Vice Cover Studio — the entrypoint for gta6-cover-art-01 (Node 22, stdlib only).
//
// The app itself is the static files under app/: a multi-panel cover maker
// (six layouts, five colour grades, per-panel crop and zoom, editable
// caption, PNG export in 1080x1080, 1080x1350 and 1920x1080) that runs fully
// offline in a desktop browser. This program hands it in: it copies app/
// and screenshots/ from beside this file into /output and writes
// /output/dossier.json, the summary the judge reads, using the vendored
// make.fun library. It does nothing else, and it writes the same bytes on
// every run — run it twice into two directories and the trees compare equal.
//
// Serve the app locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The scorer's caps (reference/gate.json). Only text_max_bytes shapes the
// bytes; the rest refuse an entry the scorer would refuse: more than 4
// screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of
// app files in all; or a path under app/ over 1000 bytes.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function countAppFiles(dir) {
  let total = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    total += statSync(path).isDirectory() ? countAppFiles(path) : 1;
  }
  return total;
}

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

// Fail loudly, before writing anything, when the entry is missing a piece
// the scorer would refuse — a half-copied /output must never look complete.
const appDir = join(here, 'app');
if (!existsSync(join(appDir, 'index.html'))) {
  throw new Error('app/index.html is missing; refusing to hand in an empty app');
}
const shotDir = join(here, 'screenshots');
if (!existsSync(shotDir) || readdirSync(shotDir).length === 0) {
  throw new Error('screenshots/ is empty; the entry needs 3 or 4 screenshots');
}
if (countAppFiles(appDir) > CAPS.app_max_files) {
  throw new Error(`app/ holds more than ${CAPS.app_max_files} files`);
}

mkdirSync(out, { recursive: true });
copyTree(appDir, join(out, 'app'));
if (existsSync(shotDir)) copyTree(shotDir, join(out, 'screenshots'));

const dossierPath = join(out, 'dossier.json');
writeFileSync(dossierPath, buildDossier(out, CAPS));
console.log(`handed in ${countAppFiles(join(out, 'app'))} app files + dossier.json (${statSync(dossierPath).size} bytes) to ${out}`);
