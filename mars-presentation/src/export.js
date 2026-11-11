// Export: renders each slide at 1920×1080 (3D canvases included) and hands the file
// to the viewer through the artifact's `downloads` capability.
import { toCanvas } from 'html-to-image';

export const FORMATS = [
  { id: 'pdf', label: 'PDF', hint: 'Усі 8 слайдів, для друку і пересилання', ext: '.pdf' },
  { id: 'pptx', label: 'PowerPoint', hint: 'Усі слайди картинками, 16:9', ext: '.pptx' },
  { id: 'png', label: 'Картинка слайда', hint: 'Поточний слайд у PNG, 1920×1080', ext: '.png' },
  { id: 'html', label: 'Інтерактивний файл', hint: 'Уся презентація з 3D і анімацією, працює офлайн', ext: '.html' },
];

const frames = (n = 2) => new Promise((res) => { const f = () => (n-- <= 0 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
const N_LAST = (count, n) => (n === count - 1 ? n : -1);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function shoot(stage) {
  await frames(3);
  return toCanvas(stage, {
    width: 1920, height: 1080, canvasWidth: 1920, canvasHeight: 1080, pixelRatio: 1,
    backgroundColor: '#0B0710', cacheBust: false,
    filter: (node) => !(node.classList && node.classList.contains('no-export')),
  });
}

// Visit slides one by one; `show(n)` switches the deck, then the scene settles before the shot.
export async function captureAll(stage, show, count, onProgress) {
  const shots = [];
  for (let n = 0; n < count; n++) {
    onProgress(n);
    show(n);
    await wait(n === 0 || n === N_LAST(count, n) ? 1800 : 1300);
    shots.push(await shoot(stage));
  }
  onProgress(count);
  return shots;
}

const toBlob = (canvas, type, q) => new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('empty'))), type, q));

export async function buildPdf(shots) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1920, 1080], hotfixes: ['px_scaling'], compress: true });
  shots.forEach((c, i) => {
    if (i) pdf.addPage([1920, 1080], 'landscape');
    pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 1920, 1080, undefined, 'FAST');
  });
  pdf.setProperties({ title: 'Марс — Червона планета' });
  return pdf.output('blob');
}

export async function buildPptx(shots, titles) {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = 'Марс — Червона планета';
  shots.forEach((c, i) => {
    const s = pptx.addSlide();
    s.background = { color: '0B0710' };
    s.addImage({ data: c.toDataURL('image/jpeg', 0.92), x: 0, y: 0, w: 13.333, h: 7.5, altText: titles[i] });
    s.addNotes(titles[i]);
  });
  return pptx.write({ outputType: 'blob' });
}

export const buildPng = (canvas) => toBlob(canvas, 'image/png');

// A standalone copy of this page: the same styles, fonts, glass filter and app bundle.
export function buildHtml() {
  const css = document.getElementById('deck-css');
  const svg = document.getElementById('deck-svg');
  const glass = document.getElementById('deck-glass');
  const app = document.getElementById('deck-app');
  if (!css || !svg || !glass || !app) throw new Error('missing page parts');
  return '<!doctype html><html lang="uk"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + '<title>Марс — Червона планета</title>' + css.outerHTML + '</head><body>'
    + svg.outerHTML + '<div id="root"></div>'
    + '<script>' + glass.textContent + '</scr' + 'ipt>'
    + '<script type="module">' + app.textContent + '</scr' + 'ipt></body></html>';
}
