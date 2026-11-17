// main.ts — IRONHOLD entrypoint (Node 22, standard library only).
// Copies game/ and screenshots/ from this repository to the output directory and
// writes /output/dossier.json with buildDossier from vendor/makefun-threejs.ts.
// The output directory is $MAKEFUN_OUTPUT_DIR, or /output when it is unset.
// Runs twice must write the same bytes: the copy is a plain file copy and
// buildDossier is deterministic, so the dossier matches byte for byte.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const gameOut = join(out, 'game');
const shotsOut = join(out, 'screenshots');
rmSync(gameOut, { recursive: true, force: true });
rmSync(shotsOut, { recursive: true, force: true });
rmSync(join(out, 'dossier.json'), { force: true });
mkdirSync(gameOut, { recursive: true });
mkdirSync(shotsOut, { recursive: true });

cpSync(join(root, 'game'), gameOut, { recursive: true });
cpSync(join(root, 'screenshots'), shotsOut, { recursive: true });

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(out, 'dossier.json'), dossier);

console.log(`IRONHOLD: wrote ${join(out, 'dossier.json')} (${dossier.length} bytes)`);
