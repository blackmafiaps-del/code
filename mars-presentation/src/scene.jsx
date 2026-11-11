// 3D scene built with React Three Fiber: one persistent Mars that "magic-moves"
// between slides on a spring, plus the Sun/Earth orbit system and the two moons.
import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const NOISE = /* glsl */ `
float h(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<6;i++){s+=a*n(p);p*=2.03;a*=.5;}return s;}`;

const VERT = /* glsl */ `
varying vec3 vObj; varying vec3 vN; varying vec3 vW;
void main(){vObj=normalize(position);vN=normalize(mat3(modelMatrix)*normal);
vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;

const MARS_FRAG = /* glsl */ `
uniform vec3 uLight; varying vec3 vObj; varying vec3 vN; varying vec3 vW;
${NOISE}
void main(){
  vec3 p=vObj; float f=fbm(p*2.2+3.), k=fbm(p*6.+f*2.);
  vec3 c=mix(vec3(.80,.33,.15),vec3(.36,.12,.06),smoothstep(.42,.62,f));
  c=mix(c,vec3(.95,.60,.34),smoothstep(.52,.78,k)*.45);
  float crater=smoothstep(.62,.66,fbm(p*14.))*.18; c*=1.-crater;
  c=mix(c,vec3(.97,.94,.90),smoothstep(.86,.93,abs(p.y)+(k-.5)*.16));
  vec3 V=normalize(cameraPosition-vW); vec3 L=normalize(uLight);
  float di=max(dot(vN,L),0.), rim=pow(1.-max(dot(vN,V),0.),3.);
  c=c*(.035+1.15*di)+vec3(1.,.45,.25)*rim*(.55*di+.04);
  gl_FragColor=vec4(pow(c,vec3(1./1.05)),1.);
}`;

const ROCK_FRAG = /* glsl */ `
uniform vec3 uLight; uniform vec3 uA; uniform vec3 uB; uniform float uOpacity; uniform float uOcean;
varying vec3 vObj; varying vec3 vN; varying vec3 vW;
${NOISE}
void main(){float f=fbm(vObj*3.+7.);vec3 c=mix(uA,uB,smoothstep(.4,.6,f));
if(uOcean>.5){c=mix(vec3(.10,.30,.70),vec3(.30,.55,.30),step(.52,f));c=mix(c,vec3(.95),smoothstep(.62,.7,fbm(vObj*5.)));}
float di=max(dot(vN,normalize(uLight-vW)),0.);
gl_FragColor=vec4(c*(.06+1.1*di),uOpacity);}`;

// Animate UI-style spring (stiffness/damping, mass 1): a little overshoot, then settles.
const K = 120, D = 18.5;
function springTo(s, target, dt) {
  const steps = Math.ceil(dt / 0.012), h = dt / steps;
  for (let k = 0; k < steps; k++) springStep(s, target, h);
}
function springStep(s, target, dt) {
  for (let i = 0; i < s.x.length; i++) {
    const a = K * (target[i] - s.x[i]) - D * s.v[i];
    s.v[i] += a * dt;
    s.x[i] += s.v[i] * dt;
  }
}

const SUN = new THREE.Vector3(2.0, -0.15, 0);
const ORBIT_TILT = new THREE.Euler(-1.12, 0, 0.12);
const tmp = new THREE.Vector3();

function orbitPoint(r, a, center, euler, out) {
  out.set(Math.cos(a) * r, Math.sin(a) * r, 0).applyEuler(euler).add(center);
  return out;
}

// Per-slide pose of Mars: [x, y, z, scale]. Slide 3 follows its orbit.
function marsPose(slide, t, out) {
  switch (slide) {
    case 0: return [2.2, -0.1, 0, 1.6];
    case 1: case 3: case 6: return [3.0, 1.4, 0, 0.45];
    case 2: orbitPoint(1.52, t * (6.2832 / 18.8) + 2.2, SUN, ORBIT_TILT, out); return [out.x, out.y, out.z, 0.11];
    case 4: return [0, -3.38, 0, 2.3];
    case 5: return [2.05, -0.05, 0, 0.27];
    default: return [2.35, 0.45, 0, 1.25];
  }
}

function useRockMaterial(a, b, ocean = 0) {
  return useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: ROCK_FRAG, transparent: true,
    uniforms: { uLight: { value: new THREE.Vector3() }, uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) }, uOpacity: { value: 0 }, uOcean: { value: ocean } },
  }), [a, b, ocean]);
}

function lumpy(detail, seed) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = 1 + 0.18 * Math.sin(v.x * 3 + seed) * Math.cos(v.y * 2.3 - seed) + 0.08 * Math.sin(v.z * 7 + seed * 2);
    v.multiplyScalar(d); p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function ring(r, segments = 160) {
  const pts = [];
  for (let i = 0; i <= segments; i++) { const a = (i / segments) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

function Stars() {
  const geo = useMemo(() => {
    const n = 1400, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 30 + Math.random() * 10, s = Math.sqrt(1 - u * u);
      a.set([Math.cos(th) * s * r, u * r, -Math.abs(Math.sin(th) * s * r) - 6], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); return g;
  }, []);
  const ref = useRef();
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.z += dt * 0.004; });
  return <points ref={ref} geometry={geo}><pointsMaterial color="#F6EDE4" size={0.09} sizeAttenuation transparent opacity={0.75} depthWrite={false} /></points>;
}

function World({ slide, reduced }) {
  const mars = useRef(), spin = useRef(), atmo = useRef();
  const sunGroup = useRef(), earth = useRef(), moons = useRef(), phobos = useRef(), deimos = useRef();
  const lineMats = useRef([]);
  const state = useRef({ s: null, t: 0, vis: { orbit: 0, moons: 0 } });
  const light = useMemo(() => new THREE.Vector3(-0.6, 0.45, 0.65), []);

  const marsMat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: MARS_FRAG, uniforms: { uLight: { value: light } } }), [light]);
  const earthMat = useRockMaterial('#2a5db0', '#3c7a3a', 1);
  const phobosMat = useRockMaterial('#7a6a62', '#3e3430');
  const deimosMat = useRockMaterial('#8c7c72', '#4a3e38');
  const phobosGeo = useMemo(() => lumpy(3, 1.7), []);
  const deimosGeo = useMemo(() => lumpy(3, 4.2), []);
  const rings = useMemo(() => ({ earth: ring(1), mars: ring(1.52), phobos: ring(1), deimos: ring(1) }), []);
  const sphere = useMemo(() => new THREE.SphereGeometry(1, 96, 64), []);
  // Atmosphere: a camera-facing halo that peaks right at the limb (planet edge = 0.8 of the sprite radius).
  const haze = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const x = c.getContext('2d'), g = x.createRadialGradient(256, 256, 0, 256, 256, 256);
    g.addColorStop(0, 'rgba(255,110,60,0)'); g.addColorStop(0.76, 'rgba(255,110,60,0)'); g.addColorStop(0.795, 'rgba(255,120,70,0.95)');
    g.addColorStop(0.83, 'rgba(255,100,50,0.45)'); g.addColorStop(0.9, 'rgba(255,80,40,0.12)'); g.addColorStop(1, 'rgba(255,80,40,0)');
    x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);
  const glow = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,220,150,0.8)'); g.addColorStop(0.45, 'rgba(255,140,60,0.18)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.25);
    const st = state.current;
    st.t += reduced ? 0 : dt;
    const pose = marsPose(slide, st.t, tmp);
    if (!st.s) st.s = { x: [...pose], v: [0, 0, 0, 0] };
    if (reduced) st.s.x = [...pose]; else springTo(st.s, pose, dt);
    const [x, y, z, s] = st.s.x;
    mars.current.position.set(x, y, z);
    mars.current.scale.setScalar(Math.max(s, 0.01));
    spin.current.rotation.y += reduced ? 0 : dt * 0.12;

    // Visibility of the orbit system and the moons fades with the slide.
    const fade = (key, on) => { st.vis[key] = reduced ? (on ? 1 : 0) : st.vis[key] + ((on ? 1 : 0) - st.vis[key]) * (1 - Math.exp(-dt * 5)); return st.vis[key]; };
    const ov = fade('orbit', slide === 2), mv = fade('moons', slide === 5);

    // Light: from the Sun on the orbit slide, from the upper left otherwise.
    const target = slide === 2 ? tmp.copy(SUN).sub(mars.current.position).normalize() : tmp.set(-0.6, 0.45, 0.65).normalize();
    light.lerp(target, reduced ? 1 : 1 - Math.exp(-dt * 4)).normalize();
    if (atmo.current) atmo.current.material.opacity += ((slide === 4 ? 1 : 0.75) - atmo.current.material.opacity) * (reduced ? 1 : 1 - Math.exp(-dt * 4));

    sunGroup.current.visible = ov > 0.01;
    sunGroup.current.scale.setScalar(0.6 + 0.4 * ov);
    sunGroup.current.children.forEach((c) => { if (c.material && 'opacity' in c.material) c.material.opacity = ov * (c.userData.o ?? 1); });
    orbitPoint(1.0, st.t * (6.2832 / 10) + 0.4, SUN, ORBIT_TILT, earth.current.position);
    earthMat.uniforms.uOpacity.value = ov; earthMat.uniforms.uLight.value.copy(SUN);

    moons.current.visible = mv > 0.01;
    moons.current.position.copy(mars.current.position);
    const r = Math.max(s, 0.01);
    phobos.current.position.set(Math.cos(st.t * 1.26) * 2.76 * r, Math.sin(st.t * 1.26) * 2.76 * r, 0);
    deimos.current.position.set(Math.cos(st.t * 0.316 + 2) * 6.9 * r, Math.sin(st.t * 0.316 + 2) * 6.9 * r, 0);
    phobos.current.rotation.x += dt * 0.4; deimos.current.rotation.y += dt * 0.3;
    phobos.current.parent.children.forEach((c) => { if (c.isLine) { c.scale.setScalar(c.userData.r * r); c.material.opacity = 0.32 * mv; } });
    [phobosMat, deimosMat].forEach((m) => { m.uniforms.uOpacity.value = mv; m.uniforms.uLight.value.set(-30, 20, 30); });
    lineMats.current.forEach((m) => { m.opacity = 0.3 * ov; });
  });

  return (
    <>
      <Stars />
      <group ref={sunGroup}>
        <mesh position={SUN} userData={{ o: 1 }}><sphereGeometry args={[0.2, 48, 32]} /><meshBasicMaterial color="#FFE3A3" transparent /></mesh>
        <sprite position={SUN} scale={1.6} userData={{ o: 0.9 }}><spriteMaterial map={glow} color="#FFB45A" transparent blending={THREE.AdditiveBlending} depthWrite={false} /></sprite>
        <group position={SUN} rotation={ORBIT_TILT}>
          <line geometry={rings.earth}><lineBasicMaterial ref={(m) => (lineMats.current[0] = m)} color="#9CC8FF" transparent /></line>
          <line geometry={rings.mars}><lineBasicMaterial ref={(m) => (lineMats.current[1] = m)} color="#FFB08A" transparent /></line>
        </group>
        <mesh ref={earth} geometry={sphere} scale={0.1} material={earthMat} />
      </group>
      <group ref={moons} rotation={[-1.2, 0.15, 0.2]}>
        <group>
          <line geometry={rings.phobos} userData={{ r: 2.76 }}><lineBasicMaterial color="#F6EDE4" transparent /></line>
          <line geometry={rings.deimos} userData={{ r: 6.9 }}><lineBasicMaterial color="#F6EDE4" transparent /></line>
          <mesh ref={phobos} geometry={phobosGeo} scale={[0.075, 0.055, 0.05]} material={phobosMat} />
          <mesh ref={deimos} geometry={deimosGeo} scale={[0.05, 0.04, 0.035]} material={deimosMat} />
        </group>
      </group>
      <group ref={mars}>
        <group rotation={[0, 0, 0.44]}>
          <mesh ref={spin} geometry={sphere} material={marsMat} />
        </group>
        <sprite ref={atmo} scale={2.5}><spriteMaterial map={haze} transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} /></sprite>
      </group>
    </>
  );
}

export default function MarsScene({ slide, reduced, dpr }) {
  return (
    <Canvas
      className="scene"
      dpr={dpr}
      resize={{ offsetSize: true }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      camera={{ position: [0, 0, 6], fov: 40 }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <World slide={slide} reduced={reduced} />
    </Canvas>
  );
}
