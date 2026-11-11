import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const r = await build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  jsx: 'automatic',
  write: false,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.js': 'jsx' },
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const html = readFileSync('src/template.html', 'utf8').replace('/*BUNDLE*/', () => js);
writeFileSync('mars-deck.html', html);
console.log('bundle', (js.length / 1024).toFixed(0), 'KB; page', (html.length / 1024).toFixed(0), 'KB');
