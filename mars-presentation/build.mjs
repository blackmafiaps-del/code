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
const RANGES = {
  cyrillic: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116',
  latin: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
};
const FACES = [['Unbounded', 'unbounded', [400, 600, 800]], ['Manrope', 'manrope', [400, 600, 700, 800]], ['JetBrains Mono', 'jetbrains-mono', [500]]];
let fonts = '';
for (const [family, pkg, weights] of FACES) for (const w of weights) for (const sub of ['cyrillic', 'latin']) {
  const b64 = readFileSync(`node_modules/@fontsource/${pkg}/files/${pkg}-${sub}-${w}-normal.woff2`).toString('base64');
  fonts += `@font-face{font-family:'${family}';font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${RANGES[sub]}}\n`;
}
const html = readFileSync('src/template.html', 'utf8').replace('/*FONTS*/', () => fonts).replace('/*BUNDLE*/', () => js);
writeFileSync('mars-deck.html', html);
console.log('bundle', (js.length / 1024).toFixed(0), 'KB; page', (html.length / 1024).toFixed(0), 'KB');
