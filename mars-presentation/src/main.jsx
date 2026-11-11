import { Component, Suspense, createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react';
import { LiquidMetal } from '@paper-design/shaders-react';
import MarsScene from './scene.jsx';
import { FORMATS, captureAll, shoot, buildPdf, buildPptx, buildPng, buildHtml } from './export.js';

const Capture = createContext(false);
const TITLES = ['Марс — Червона планета', 'Марс у цифрах', 'Четверта від Сонця', 'Планета рекордів', 'Тонка холодна оболонка', 'Фобос і Деймос', 'Шлях до Марса', 'Марс — наступний крок людства'];

const N = 8;
const reducedQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

// ShaderGradient look per slide: the background itself transforms with the deck.
const GRADIENTS = [
  { color1: '#7a1f0c', color2: '#2a0d12', color3: '#0b0710', rotationZ: 50, positionX: -1.4, cAzimuthAngle: 180, cPolarAngle: 90 },
  { color1: '#5a1810', color2: '#1d0b14', color3: '#0b0710', rotationZ: 120, positionX: 0.6, cAzimuthAngle: 190, cPolarAngle: 80 },
  { color1: '#4a2a08', color2: '#160a12', color3: '#0b0710', rotationZ: 200, positionX: 1.4, cAzimuthAngle: 170, cPolarAngle: 95 },
  { color1: '#8a2e12', color2: '#2e1412', color3: '#120a0e', rotationZ: 30, positionX: -0.6, cAzimuthAngle: 185, cPolarAngle: 85 },
  { color1: '#a4401c', color2: '#3a1410', color3: '#0b0710', rotationZ: 90, positionX: 0, cAzimuthAngle: 180, cPolarAngle: 110 },
  { color1: '#3a1a2a', color2: '#140a14', color3: '#0b0710', rotationZ: 160, positionX: 1.0, cAzimuthAngle: 175, cPolarAngle: 85 },
  { color1: '#5a2010', color2: '#1a0c12', color3: '#0b0710', rotationZ: 260, positionX: -1.0, cAzimuthAngle: 180, cPolarAngle: 90 },
  { color1: '#c2431f', color2: '#4a160e', color3: '#140a0e', rotationZ: 50, positionX: -1.4, cAzimuthAngle: 180, cPolarAngle: 90 },
];

class Guard extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback ?? null : this.props.children; }
}

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

// Liquid metal wordmark (Paper Shaders, the engine behind paper-design/liquid-logo):
// the word is drawn into a transparent PNG and the shader turns its shape into metal.
function MetalWord({ text, width, height, weight = 800, active }) {
  const capture = useContext(Capture);
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    const font = `${weight} 400px Unbounded, "Arial Black", Arial, sans-serif`;
    const draw = () => {
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      ctx.font = font;
      const w = Math.ceil(ctx.measureText(text).width) + 80;
      c.width = w; c.height = 520;
      ctx.font = font; ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      ctx.fillText(text, w / 2, 270);
      if (alive) setSrc(c.toDataURL('image/png'));
    };
    (document.fonts?.load(font) ?? Promise.resolve()).then(draw, draw);
    return () => { alive = false; };
  }, [text, weight]);
  return (
    <div className="metal" style={{ width, height }} role="img" aria-label={text}>
      {src && (
        <LiquidMetal
          image={src}
          colorBack="#00000000"
          colorTint="#FFB08A"
          repetition={4}
          softness={0.45}
          shiftRed={0.3}
          shiftBlue={0.3}
          distortion={0.1}
          contour={0.4}
          angle={70}
          speed={active && !reducedQuery?.matches && !capture ? 0.6 : 0}
          webGlContextAttributes={{ preserveDrawingBuffer: true }}
          scale={1}
          fit="contain"
          style={{ width: '100%', height: '100%' }}
        />
      )}
    </div>
  );
}

// Counter that counts up when its slide opens (Animate UI's CountingNumber idea).
function Count({ to, decimals = 0, active, suffix = '' }) {
  const capture = useContext(Capture);
  const [v, setV] = useState(to);
  useEffect(() => {
    if (!active || reducedQuery?.matches || capture) { setV(to); return; }
    let raf, t0;
    const dur = 1400, ease = (x) => 1 - Math.pow(1 - x, 4);
    const tick = (t) => { t0 ??= t; const k = Math.min((t - t0 - 250) / dur, 1); setV(to * ease(Math.max(k, 0))); if (k < 1) raf = requestAnimationFrame(tick); };
    setV(0); raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, to, capture]);
  const s = v.toLocaleString('uk-UA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return <span className="num">{s}{suffix}</span>;
}

const R = ({ i, as: Tag = 'div', className = '', children, ...rest }) => (
  <Tag className={`r ${className}`} style={{ '--i': i, ...(rest.style || {}) }} {...rest}>{children}</Tag>
);

function Slides({ slide }) {
  const on = (n) => slide === n;
  return (
    <>
      <section className={`slide s-cover ${on(0) ? 'on' : ''}`} aria-hidden={!on(0)}>
        <R i={0} as="p" className="eyebrow">Астрономія · Сонячна система</R>
        <div className="grow" />
        <R i={1} className="metal-wrap"><MetalWord text="МАРС" width={980} height={330} active={on(0)} /></R>
        <R i={2} as="p" className="sub">Червона планета</R>
        <R i={3} as="p" className="lead">Четверта планета від Сонця і найближча мета космічних мандрівок людства</R>
        <R i={4} as="p" className="hint"><kbd>→</kbd> або пробіл, щоб почати</R>
      </section>

      <section className={`slide ${on(1) ? 'on' : ''}`} aria-hidden={!on(1)}>
        <R i={0} as="p" className="eyebrow">Паспорт планети</R>
        <R i={1} as="h2">Марс у цифрах</R>
        <div className="grid3">
          {[
            [<><Count to={6779} active={on(1)} /> км</>, 'діаметр — приблизно половина земного'],
            [<><Count to={687} active={on(1)} /> діб</>, 'триває марсіанський рік — майже два земні'],
            [<><Count to={24.6} decimals={1} active={on(1)} /> год</>, 'марсіанська доба, або сол: 24 год 37 хв'],
            [<><Count to={38} active={on(1)} />&nbsp;%</>, 'сили тяжіння Землі: прискорення 3,72 м/с²'],
            [<>−<Count to={63} active={on(1)} />&nbsp;°C</>, 'середня температура на поверхні'],
            [<><Count to={2} active={on(1)} /></>, 'природні супутники — Фобос і Деймос'],
          ].map(([big, small], k) => (
            <R i={2 + k} key={k} className="glass stat">
              <p className="big">{big}</p>
              <p className="small">{small}</p>
            </R>
          ))}
        </div>
      </section>

      <section className={`slide ${on(2) ? 'on' : ''}`} aria-hidden={!on(2)}>
        <R i={0} as="p" className="eyebrow">Орбіта</R>
        <R i={1} as="h2">Четверта від Сонця</R>
        <div className="facts">
          {[
            ['228 млн км', 'середня відстань до Сонця, або 1,52 астрономічної одиниці'],
            ['24 км/с', 'орбітальна швидкість — повільніше, ніж у Землі (30 км/с)'],
            ['25,2°', 'нахил осі обертання, тому на Марсі теж змінюються пори року'],
            ['26 місяців', 'минає між протистояннями, коли Земля і Марс найближчі'],
          ].map(([a, b], k) => (
            <R i={2 + k} key={k} className="fact"><h3>{a}</h3><p>{b}</p></R>
          ))}
        </div>
        <R i={6} className="legend">
          <span><i style={{ background: 'var(--sun)' }} />Сонце</span>
          <span><i style={{ background: 'var(--earth)' }} />Земля</span>
          <span><i style={{ background: 'var(--accent)' }} />Марс</span>
          <span className="muted">Відстані й періоди в масштабі, розміри планет збільшено</span>
        </R>
      </section>

      <section className={`slide ${on(3) ? 'on' : ''}`} aria-hidden={!on(3)}>
        <R i={0} as="p" className="eyebrow">Поверхня</R>
        <R i={1} as="h2">Планета рекордів</R>
        <R i={2} className="peaks">
          <svg viewBox="0 0 760 440" width="760" height="440" role="img" aria-label="Порівняння висот: Олімп 21,9 км, Еверест 8,8 км">
            <defs>
              <linearGradient id="om" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FF7A45" /><stop offset="1" stopColor="#8E2E18" /></linearGradient>
              <linearGradient id="ev" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#DCE9F5" /><stop offset="1" stopColor="#5D7186" /></linearGradient>
            </defs>
            {[0, 5, 10, 15, 20].map((km) => (
              <g key={km}><line x1="0" x2="760" y1={420 - km * 17.8} y2={420 - km * 17.8} stroke="#F6EDE4" strokeOpacity={km ? 0.08 : 0.4} /></g>
            ))}
            <path className="grow-up" d="M0 420 Q150 80 240 30 L300 30 Q390 80 540 420 Z" fill="url(#om)" />
            <path className="grow-up" d="M240 30 Q270 52 300 30 Z" fill="#5A1C0E" />
            <path className="grow-up d2" d="M580 420 L665 263 L750 420 Z" fill="url(#ev)" />
          </svg>
          <div className="peak-labels"><span>Олімп, Марс — <b>21,9 км</b></span><span>Еверест — <b>8,8 км</b></span></div>
          <p className="muted">Висоти в одному масштабі, ширину показано умовно</p>
        </R>
        <div className="stack">
          {[
            ['Гора Олімп', 'Найвищий вулкан Сонячної системи: близько 22 км заввишки і 600 км завширшки.'],
            ['Долини Марінер', 'Система каньйонів завдовжки понад 4000 км і до 7 км завглибшки.'],
            ['Полярні шапки', 'Водяний лід і замерзлий вуглекислий газ: узимку шапки ростуть, улітку зменшуються.'],
          ].map(([a, b], k) => (
            <R i={3 + k} key={k} className="glass card"><h3>{a}</h3><p>{b}</p></R>
          ))}
        </div>
      </section>

      <section className={`slide ${on(4) ? 'on' : ''}`} aria-hidden={!on(4)}>
        <R i={0} as="p" className="eyebrow">Атмосфера і клімат</R>
        <R i={1} as="h2">Тонка холодна оболонка</R>
        <div className="atmo">
          <R i={2} className="co2">
            <p className="huge"><Count to={95} active={on(4)} />&nbsp;%</p>
            <p className="lead2">атмосфери Марса — вуглекислий газ</p>
            <div className="bar"><i style={{ flex: 95, background: 'var(--accent)' }} /><i style={{ flex: 2.8, background: 'var(--fg)' }} /><i style={{ flex: 2, background: 'var(--earth)' }} /></div>
            <div className="legend small-legend">
              <span><i style={{ background: 'var(--accent)' }} />CO₂ 95 %</span>
              <span><i style={{ background: 'var(--fg)' }} />Азот 2,8 %</span>
              <span><i style={{ background: 'var(--earth)' }} />Аргон 2 %</span>
            </div>
          </R>
          {[
            ['Тиск — 0,6 % земного', 'Атмосфера дуже розріджена, тому рідка вода на поверхні довго не існує.'],
            ['Від −153 до +20 °C', 'Тонка атмосфера погано втримує тепло, тож перепади температур величезні.'],
            ['Пилові бурі', 'Іноді охоплюють усю планету й тривають тижнями, закриваючи Сонце.'],
          ].map(([a, b], k) => (
            <R i={3 + k} key={k} className="glass card"><h3>{a}</h3><p>{b}</p></R>
          ))}
        </div>
      </section>

      <section className={`slide ${on(5) ? 'on' : ''}`} aria-hidden={!on(5)}>
        <R i={0} as="p" className="eyebrow">Супутники</R>
        <R i={1} as="h2">Фобос і Деймос</R>
        <div className="moons">
          <R i={2} className="glass card"><h3>Фобос — «Страх»</h3><p>Близько 22 км у поперечнику. Облітає Марс за 7 год 39 хв — швидше, ніж планета обертається навколо осі.</p></R>
          <R i={3} className="glass card"><h3>Деймос — «Жах»</h3><p>Близько 12 км у поперечнику. Менший і віддаленіший: один оберт триває 30,3 години.</p></R>
        </div>
        <div className="grow" />
        <R i={4} as="p" className="note">Обидва супутники відкрив американський астроном Асаф Голл у 1877 році. Орбіти в масштабі, розміри супутників збільшено.</R>
      </section>

      <section className={`slide ${on(6) ? 'on' : ''}`} aria-hidden={!on(6)}>
        <R i={0} as="p" className="eyebrow">Дослідження</R>
        <R i={1} as="h2">Шлях до Марса</R>
        <div className="timeline">
          <div className="line" />
          {[
            ['1965', 'Mariner 4', 'Перші знімки Марса зблизька'],
            ['1976', 'Viking 1', 'Перша тривала робота на поверхні'],
            ['1997', 'Sojourner', 'Перший марсохід в історії'],
            ['2004', 'Opportunity', 'Разом зі Spirit знайшов сліди давньої води'],
            ['2012', 'Curiosity', 'Вивчає кратер Ґейл і давній клімат'],
            ['2021', 'Perseverance', 'З ним прибув гелікоптер Ingenuity'],
          ].map(([y, n, d], k) => (
            <R i={2 + k} key={k} className="ms"><i className="dot" /><p className="year">{y}</p><h3>{n}</h3><p>{d}</p></R>
          ))}
        </div>
        <div className="grow" />
        <R i={8} as="p" className="note wide">Наступна мета — доставити зразки марсіанських порід на Землю і підготувати політ людини.</R>
      </section>

      <section className={`slide s-outro ${on(7) ? 'on' : ''}`} aria-hidden={!on(7)}>
        <R i={0} as="p" className="eyebrow">Висновок</R>
        <R i={1} as="h1">Марс — наступний крок людства</R>
        <div className="grow" />
        <div className="cols">
          {[
            ['Вода', 'Колись тут текли ріки, а сьогодні вода збереглася у вигляді льоду.'],
            ['Життя', 'Марсоходи шукають у породах сліди давніх мікроорганізмів.'],
            ['Людина', 'Космічні агентства готуються до перших пілотованих польотів.'],
          ].map(([a, b], k) => (
            <R i={2 + k} key={k} className="glass card"><h3>{a}</h3><p>{b}</p></R>
          ))}
        </div>
        <R i={5} className="thanks"><MetalWord text="Дякую!" width={520} height={120} active={on(7)} /></R>
      </section>
    </>
  );
}

function useStageScale() {
  const [s, setS] = useState(1);
  useLayoutEffect(() => {
    const f = () => setS(Math.min(innerWidth / 1920, innerHeight / 1080));
    f(); addEventListener('resize', f); return () => removeEventListener('resize', f);
  }, []);
  return s;
}

function readHash() {
  const m = /^#slide-(\d+)$/.exec(location.hash);
  return m ? Math.min(Math.max(+m[1] - 1, 0), N - 1) : 0;
}

function App() {
  const [slide, setSlide] = useState(readHash);
  const [reduced, setReduced] = useState(!!reducedQuery?.matches);
  const scale = useStageScale();
  const gl = useRef(hasWebGL()).current;
  const touch = useRef(null);
  const stage = useRef(null);
  const [downloads, setDownloads] = useState(null);
  const [menu, setMenu] = useState(false);
  const [job, setJob] = useState(null); // { label, done, total }
  const [toast, setToast] = useState(null);
  const capturing = !!job;

  useEffect(() => {
    let alive = true;
    window.claude?.use?.('downloads').then((d) => { if (alive) setDownloads(d); }, () => {});
    return () => { alive = false; };
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); }, [toast]);

  const runExport = async (f) => {
    setMenu(false);
    const back = slide;
    try {
      let data;
      if (f.id === 'html') data = buildHtml();
      else if (f.id === 'png') {
        setJob({ label: 'Готую картинку слайда', done: 0, total: 1 });
        await new Promise((r) => setTimeout(r, 700));
        data = await buildPng(await shoot(stage.current));
      } else {
        setJob({ label: `Готую ${f.label}`, done: 0, total: N });
        const shots = await captureAll(stage.current, setSlide, N, (done) => setJob((j) => j && { ...j, done }));
        data = f.id === 'pdf' ? await buildPdf(shots) : await buildPptx(shots, TITLES);
      }
      setJob(null); setSlide(back);
      const name = f.id === 'png' ? `Марс — слайд ${back + 1}.png` : `Марс — Червона планета${f.ext}`;
      await downloads.save({ filename: name, data });
      setToast(`Збережено: ${name}`);
    } catch (e) {
      setJob(null); setSlide(back);
      const code = e && e.code;
      if (code === 'declined') setToast('Збереження скасовано');
      else if (code === 'rate_limited') setToast('Зачекайте, вікно збереження вже відкрите');
      else if (code === 'too_large') setToast('Файл завеликий для цього місця');
      else setToast('Не вдалося зберегти файл тут. Спробуйте інший формат.');
    }
  };

  const busy = useRef(false); busy.current = !!job;
  const go = useCallback((d) => { if (!busy.current) setSlide((s) => Math.min(Math.max(s + d, 0), N - 1)); }, []);
  useEffect(() => { const h = `#slide-${slide + 1}`; if (location.hash !== h) history.replaceState(null, '', h); }, [slide]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setMenu(false); return; }
      if (document.activeElement?.closest?.('.exp')) return;
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); go(1); }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (e.key === 'Home') setSlide(0);
      else if (e.key === 'End') setSlide(N - 1);
      else if (e.key === 'f') document.documentElement.requestFullscreen?.().catch(() => {});
    };
    const onHash = () => setSlide(readHash());
    const onRM = () => setReduced(!!reducedQuery?.matches);
    addEventListener('keydown', onKey); addEventListener('hashchange', onHash); reducedQuery?.addEventListener?.('change', onRM);
    return () => { removeEventListener('keydown', onKey); removeEventListener('hashchange', onHash); reducedQuery?.removeEventListener?.('change', onRM); };
  }, [go]);

  const dpr = Math.min(Math.max(scale * (window.devicePixelRatio || 1), 0.6), 1.75);
  const g = GRADIENTS[slide];

  return (
    <Capture.Provider value={capturing}>
    <div
      className={`viewport${capturing ? ' capturing' : ''}`}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - (touch.current ?? 0); if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }}
    >
      <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <div className="frame" ref={stage}>
        <div className="bg-fallback" />
        {gl && (
          <Guard>
            <div className="gradient">
              <ShaderGradientCanvas pixelDensity={0.6} fov={45} pointerEvents="none" lazyLoad={false} preserveDrawingBuffer style={{ position: 'absolute', inset: 0 }}>
                <ShaderGradient
                  control="props" type="waterPlane" animate={reduced ? 'off' : 'on'}
                  uSpeed={0.12} uStrength={1.6} uDensity={1.3} uFrequency={5.5} uAmplitude={1}
                  brightness={0.9} grain="off" lightType="3d" reflection={0.1}
                  cDistance={3.6} cameraZoom={1} positionY={0} positionZ={0} rotationX={0} rotationY={10}
                  enableTransition
                  {...g}
                />
              </ShaderGradientCanvas>
            </div>
          </Guard>
        )}
        <div className="vignette" />
        {gl ? (
          <Guard fallback={<div className="css-mars" data-slide={slide} />}>
            <Suspense fallback={null}><MarsScene slide={slide} reduced={reduced || capturing} dpr={capturing ? 1 : dpr} /></Suspense>
          </Guard>
        ) : <div className="css-mars" data-slide={slide} />}
        <Slides slide={slide} />
        <footer className="foot">
          <span>Марс · Астрономія</span>
          <div className="nav">
            {downloads && (
              <div className="exp no-export">
                <button type="button" className="glass exp-btn" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu((m) => !m)} disabled={capturing}>Експорт <span aria-hidden="true">↓</span></button>
                {menu && (
                  <div className="glass exp-menu" role="menu">
                    {FORMATS.map((f) => (
                      <button key={f.id} type="button" role="menuitem" onClick={() => runExport(f)}><b>{f.label}</b><small>{f.hint}</small><em>{f.ext}</em></button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button type="button" className="glass pill no-export" onClick={() => go(-1)} disabled={slide === 0} aria-label="Попередній слайд">←</button>
            <span className="count"><b>{String(slide + 1).padStart(2, '0')}</b> / {String(N).padStart(2, '0')}</span>
            <button type="button" className="glass pill no-export" onClick={() => go(1)} disabled={slide === N - 1} aria-label="Наступний слайд">→</button>
          </div>
        </footer>
        {job && (
          <div className="veil no-export" role="status" aria-live="polite">
            <div className="glass">
              <p>{job.label}… {job.total > 1 ? `${Math.min(job.done + 1, job.total)} / ${job.total}` : ''}</p>
              <div className="track"><i style={{ transform: `scaleX(${job.total ? job.done / job.total : 0})` }} /></div>
            </div>
          </div>
        )}
        {toast && <div className="toast glass no-export" role="status">{toast}</div>}
        <div className="progress no-export" aria-hidden="true"><i style={{ transform: `scaleX(${(slide + 1) / N})` }} /></div>
      </div>
      </div>
    </div>
    </Capture.Provider>
  );
}

createRoot(document.getElementById('root')).render(<App />);
