import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { alphaTab } from '@coderline/alphatab-vite';

// Dev-only: the page's "Send to Claude" button POSTs captures (WAV + JSON)
// here and they land in <repo>/captures for offline analysis. The dev
// server listens on localhost only; nothing leaves the machine.
const captureDir = resolve(import.meta.dirname, '../captures');
const capture: Plugin = {
  name: 'phreakguitar-capture',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__capture', (req, res) => {
      const file = new URL(req.url ?? '/', 'http://localhost').searchParams.get('file') ?? '';
      if (req.method !== 'POST' || !/^[\w.-]+\.(wav|json)$/.test(file)) {
        res.statusCode = 400;
        res.end('POST /__capture?file=<name>.wav|json');
        return;
      }
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        mkdirSync(captureDir, { recursive: true });
        writeFileSync(join(captureDir, file), Buffer.concat(chunks));
        res.end('saved');
      });
    });
  },
};

// Dev-only: the player's own IR folder (the same one the native plugin
// scans), listed at /__irs and served at /__irs/<file>.
// ~/Music/PhreakGuitar/<sub>, or the old ~/Music/PhreakRig/<sub> if that's
// where the files are.
const musicDir = (sub: string) => {
  const dir = join(homedir(), 'Music', 'PhreakGuitar', sub);
  const old = join(homedir(), 'Music', 'PhreakRig', sub);
  try { statSync(dir); return dir; } catch { /* not there */ }
  try { statSync(old); return old; } catch { return dir; }
};
const irDir = musicDir('IRs');
const userIRs: Plugin = {
  name: 'phreakguitar-user-irs',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__irs', (req, res) => {
      const name = decodeURIComponent((req.url ?? '/').replace(/^\//, '').split('?')[0]);
      try {
        if (!name) {
          const files = readdirSync(irDir).filter((f) => /\.wav$/i.test(f)).sort();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(files));
          return;
        }
        res.setHeader('Content-Type', 'audio/wav');
        res.end(readFileSync(join(irDir, basename(name)))); // basename: no escaping the folder
      } catch {
        res.statusCode = name ? 404 : 200;
        res.end(name ? 'not found' : '[]');
      }
    });
  },
};

// Dev-only: tab files (Guitar Pro, MusicXML) the player has downloaded,
// from ~/Music/PhreakGuitar/Tabs and ~/Downloads, newest first, listed at
// /__tabs and served at /__tabs/<folder>/<file>. Only those file types are
// listed or served; nothing is fetched from anywhere.
const tabDirs: Record<string, string> = {
  tabs: musicDir('Tabs'),
  downloads: join(homedir(), 'Downloads'),
};
const tabFile = /\.(gp|gp3|gp4|gp5|gpx|gp7|musicxml|mxl|xml)$/i;
// A plain .xml is only a tab if it's MusicXML (Downloads holds all sorts).
function isTab(path: string): boolean {
  if (!/\.xml$/i.test(path)) return true;
  try {
    return /<score-(partwise|timewise)\b/.test(readFileSync(path).subarray(0, 4096).toString('utf8'));
  } catch {
    return false;
  }
}
const userTabs: Plugin = {
  name: 'phreakguitar-user-tabs',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__tabs', (req, res) => {
      const parts = decodeURIComponent((req.url ?? '/').split('?')[0]).split('/').filter(Boolean);
      try {
        if (parts.length === 0) {
          const list = Object.entries(tabDirs).flatMap(([folder, dir]) => {
            try {
              return readdirSync(dir).filter((f) => tabFile.test(f) && isTab(join(dir, f)))
                .map((name) => ({ folder, name, modified: statSync(join(dir, name)).mtimeMs }));
            } catch {
              return [];
            }
          });
          list.sort((a, b) => b.modified - a.modified);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(list));
          return;
        }
        const [folder, name] = parts;
        const dir = tabDirs[folder];
        if (!dir || !name || !tabFile.test(name) || !isTab(join(dir, basename(name)))) throw new Error('no');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.end(readFileSync(join(dir, basename(name))));
      } catch {
        res.statusCode = parts.length ? 404 : 200;
        res.end(parts.length ? 'not found' : '[]');
      }
    });
  },
};

export default defineConfig({
  plugins: [capture, userIRs, userTabs, alphaTab()],
  // Built-in IRs are imported straight from ../resources/irs.
  server: { fs: { allow: ['..'] } },
  // The AudioWorklet is bundled as an ES-module "worker" entry.
  worker: { format: 'es' },
  // alphaTab is ~1.2 MB but loads only when Tabs opens.
  build: { target: 'es2022', chunkSizeWarningLimit: 2500 },
});
