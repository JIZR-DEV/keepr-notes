/*
 * Keepr Notes — build cross-browser.
 * Copia src/ a dist/<target>/ y escribe el manifest.json correcto por navegador.
 * Uso: node build.js            (construye chrome y firefox)
 *      node build.js chrome     (solo uno)
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const srcDir = path.join(root, 'src');
const TARGETS = ['chrome', 'firefox'];

function build(target) {
  const manifestPath = path.join(root, `manifest.${target}.json`);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Falta ${path.basename(manifestPath)}`);
  }
  const outDir = path.join(root, 'dist', target);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.cpSync(srcDir, outDir, { recursive: true });

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`✓ ${target}: dist/${target}`);
}

const arg = process.argv[2];
const targets = arg ? [arg] : TARGETS;
for (const t of targets) {
  if (!TARGETS.includes(t)) throw new Error(`Target desconocido: ${t}`);
  build(t);
}
console.log('Build completo.');
