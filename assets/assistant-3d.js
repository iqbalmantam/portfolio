// Panggung 3D: memuat model VRM dengan three.js + three-vrm dan menggerakkannya memakai assistant-motion.js.
// File ini sengaja terpisah. Kalau CDN/WebGL gagal, asisten tetap berfungsi sebagai chat teks.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { createMotion } from './assistant-motion.js';

const FOV = 24;
const FLOOR = 0.1; // posisi lantai: 10% dari bawah area tampilan (selaras dengan CSS .assistant-floor)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function blobShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export async function createStage({ canvas, view, url, onProgress, reduced = false, onPoke, onLost }) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (onLost) onLost(); });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 40);
  const sun = new THREE.DirectionalLight(0xffffff, Math.PI);
  sun.position.set(0.6, 1.2, 1.6).normalize();
  scene.add(sun, new THREE.AmbientLight(0xffffff, 0.35));

  // ---- muat model
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await new Promise((resolve, reject) => {
    loader.load(url, resolve, (ev) => {
      if (onProgress) onProgress(ev.lengthComputable && ev.total ? ev.loaded / ev.total : Math.min(ev.loaded / 23142200, 0.99));
    }, reject);
  });
  const vrm = gltf.userData.vrm;
  if (!vrm) throw new Error('File bukan VRM');
  try { if (VRMUtils.removeUnnecessaryVertices) VRMUtils.removeUnnecessaryVertices(gltf.scene); } catch (e) { /* opsional */ }
  try { if (VRMUtils.removeUnnecessaryJoints) VRMUtils.removeUnnecessaryJoints(gltf.scene); } catch (e) { /* opsional */ }
  if (VRMUtils.rotateVRM0) VRMUtils.rotateVRM0(vrm);
  vrm.scene.traverse((o) => { o.frustumCulled = false; });

  const rig = new THREE.Group();
  rig.add(vrm.scene);
  scene.add(rig);

  vrm.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(vrm.scene);
  vrm.scene.position.y -= box.min.y; // telapak kaki tepat di y = 0
  let H = box.max.y - box.min.y;
  if (!(H > 0.8 && H < 2.8)) H = 1.6;

  const hum = vrm.humanoid;
  const N = (n) => hum.getNormalizedBoneNode(n);
  const Rw = (n) => hum.getRawBoneNode(n);
  const hips = N('hips');
  const hipsRest = hips.position.clone();
  const motion = createMotion({ reduced });
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();

  const sync = () => { hum.update(); vrm.scene.updateMatrixWorld(true); };
  const delta = (tip, ref, comp) => { Rw(tip).getWorldPosition(tmpA); Rw(ref).getWorldPosition(tmpB); return tmpA[comp] - tmpB[comp]; };
  // Cari tanda (+1/-1) agar rotasi positif pada `axis` menggerakkan ujung (tip) searah `want` pada sumbu dunia `comp`.
  function probe(bone, axis, tip, ref, comp, want, fallback) {
    try {
      const n = N(bone);
      if (!n || !Rw(tip) || !Rw(ref)) return fallback;
      const keep = n.rotation[axis];
      n.rotation[axis] = keep + 0.5; sync(); const a = delta(tip, ref, comp);
      n.rotation[axis] = keep - 0.5; sync(); const b = delta(tip, ref, comp);
      n.rotation[axis] = keep; sync();
      if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) < 1e-4) return fallback;
      return (a - b) * want >= 0 ? 1 : -1;
    } catch (e) { return fallback; }
  }

  // Pastikan model menghadap +Z (ke kamera): tangan kiri karakter harus berada di +X.
  sync();
  try {
    if (Rw('leftHand') && Rw('rightHand')) {
      Rw('leftHand').getWorldPosition(tmpA); Rw('rightHand').getWorldPosition(tmpB);
      if (tmpA.x < tmpB.x) { vrm.scene.rotation.y += Math.PI; sync(); }
    }
  } catch (e) { /* abaikan */ }

  const sg = { ab: {}, af: {}, ae: {}, lf: {}, lk: {} };
  for (const [side, nm] of [['L', 'left'], ['R', 'right']]) {
    sg.ab[side] = probe(nm + 'UpperArm', 'z', nm + 'Hand', nm + 'UpperArm', 'y', -1, side === 'L' ? -1 : 1);
    const nUp = N(nm + 'UpperArm');
    if (nUp) nUp.rotation.z = sg.ab[side] * 1.15; // lengan turun dulu sebelum menguji ayunan & siku
    sync();
    sg.af[side] = probe(nm + 'UpperArm', 'x', nm + 'Hand', nm + 'UpperArm', 'z', 1, -1);
    sg.ae[side] = probe(nm + 'LowerArm', 'y', nm + 'Hand', nm + 'LowerArm', 'z', 1, side === 'L' ? -1 : 1);
    sg.lf[side] = probe(nm + 'UpperLeg', 'x', nm + 'Foot', nm + 'UpperLeg', 'z', 1, -1);
    sg.lk[side] = probe(nm + 'LowerLeg', 'x', nm + 'Foot', nm + 'LowerLeg', 'z', -1, 1);
  }
  try {
    const lf = Rw('leftFoot'); const hp = Rw('hips');
    if (lf && hp) { hp.getWorldPosition(tmpA); lf.getWorldPosition(tmpB); motion.setLegLength(tmpA.y - tmpB.y); }
  } catch (e) { /* pakai bawaan */ }

  // ---- ekspresi yang tersedia di model
  const em = vrm.expressionManager;
  const hasExp = {};
  ['happy', 'relaxed', 'sad', 'blink', 'aa', 'ih', 'ou', 'ee', 'oh'].forEach((n) => { hasExp[n] = !!(em && em.getExpression(n)); });
  let surprisedName = null;
  if (em) {
    const keys = Object.keys(em.expressionMap || {});
    surprisedName = em.getExpression('surprised') ? 'surprised' : (keys.find((k) => /surpris/i.test(k)) || null);
  }
  const setExp = (name, v) => { if (em && hasExp[name]) em.setValue(name, clamp(v, 0, 1)); };

  // ---- tatapan mata
  const gaze = new THREE.Object3D();
  scene.add(gaze);
  if (vrm.lookAt) vrm.lookAt.target = gaze;

  // ---- bayangan
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.004;
  shadow.scale.set(0.9, 0.9, 1);
  scene.add(shadow);

  // ---- pose
  const setRot = (name, p, y, r) => { const n = N(name); if (n) n.rotation.set(p, y, r); };
  function applyPose(o) {
    rig.position.set(o.x, o.y, 0);
    rig.rotation.y = o.yaw;
    hips.position.set(hipsRest.x, hipsRest.y - o.hips.drop, hipsRest.z);
    hips.rotation.set(0, o.hips.yaw, o.hips.roll);
    setRot('spine', o.spine.pitch, o.spine.yaw, o.spine.roll);
    setRot('chest', o.chest.pitch, o.chest.yaw, o.chest.roll);
    setRot('neck', o.neck.pitch, o.neck.yaw, o.neck.roll);
    setRot('head', o.head.pitch, o.head.yaw, o.head.roll);
    for (const [side, nm] of [['L', 'left'], ['R', 'right']]) {
      const a = o.arm[side];
      setRot(nm + 'UpperArm', sg.af[side] * a.fwd, 0, sg.ab[side] * a.lower);
      setRot(nm + 'LowerArm', 0, sg.ae[side] * a.elbow, a.wave);
      const l = o.leg[side];
      const up = sg.lf[side] * l.fwd;
      const kn = sg.lk[side] * l.knee;
      setRot(nm + 'UpperLeg', up, 0, 0);
      setRot(nm + 'LowerLeg', kn, 0, 0);
      setRot(nm + 'Foot', -0.8 * (up + kn), 0, 0);
    }
    const e = o.exp;
    setExp('happy', e.happy); setExp('relaxed', e.relaxed); setExp('sad', e.sad); setExp('blink', e.blink);
    setExp('aa', e.aa); setExp('ih', e.ih); setExp('ou', e.ou); setExp('ee', e.ee); setExp('oh', e.oh);
    if (surprisedName && em) em.setValue(surprisedName, clamp(e.surprised, 0, 1));
    shadow.position.x = o.x;
    const sc = 0.9 * (0.6 + 0.4 * o.shadow);
    shadow.scale.set(sc, sc, 1);
    shadow.material.opacity = 0.4 + 0.6 * o.shadow;
  }

  // ---- tata letak kamera & batas jalan
  let compact = false;
  function layout() {
    const w = view.clientWidth; const h = view.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    compact = w < 560;
    const frac = compact ? 0.6 : 0.76;
    const V = H / frac;
    const dist = (V / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const cy = V * (0.5 - FLOOR);
    camera.position.set(0, cy, dist);
    camera.lookAt(0, cy, 0);
    camera.updateProjectionMatrix();
    const halfW = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * dist * camera.aspect;
    const lim = Math.max(0.35, halfW - 0.45);
    motion.setBounds(-lim, lim);
  }
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(view);

  // ---- pointer: mata & kepala mengikuti kursor, klik karakter = interaksi
  const ptr = { x: 0, y: 0, at: 0 };
  const onMove = (e) => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.at = performance.now(); };
  window.addEventListener('pointermove', onMove, { passive: true });
  const proj = new THREE.Vector3();
  function toScreen(x, y, z, rect) {
    proj.set(x, y, z).project(camera);
    return { x: (proj.x * 0.5 + 0.5) * rect.width, y: (-proj.y * 0.5 + 0.5) * rect.height };
  }
  // Posisi karakter dalam piksel relatif terhadap area tampilan.
  function charScreen(rect = canvas.getBoundingClientRect()) {
    const o = motion.out;
    const c = toScreen(o.x, H * 0.5 + o.y, 0, rect);
    const head = toScreen(o.x, H * 0.97 + o.y, 0, rect);
    const side = toScreen(o.x + 0.36, H * 0.5, 0, rect);
    return { x: c.x, headY: head.y, halfW: Math.abs(side.x - c.x), top: head.y, w: rect.width, h: rect.height, compact };
  }
  const onDown = (e) => {
    const r = canvas.getBoundingClientRect();
    const cs = charScreen(r);
    const px = e.clientX - r.left; const py = e.clientY - r.top;
    if (Math.abs(px - cs.x) < cs.halfW * 1.15 && py > cs.top - 10 && py < r.height) { if (onPoke) onPoke(); }
  };
  view.addEventListener('pointerdown', onDown);

  // ---- loop render (berhenti saat tidak terlihat / tab disembunyikan)
  let visible = true;
  let tabVisible = !document.hidden;
  let paused = false;
  let raf = 0;
  let last = performance.now();
  let frameCb = null;
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; kick(); }, { threshold: 0.01 });
  io.observe(view);
  const onVis = () => { tabVisible = !document.hidden; kick(); };
  document.addEventListener('visibilitychange', onVis);

  let lookOverride = null; // {x, y} bila asisten sedang memperhatikan sesuatu (mis. kolom input)
  function step(dt) {
    const rect = canvas.getBoundingClientRect();
    const cs = charScreen(rect);
    if (lookOverride) motion.setLook(lookOverride.x, lookOverride.y);
    else if (performance.now() - ptr.at < 4000) {
      motion.setLook(clamp((ptr.x - rect.left - cs.x) / (cs.w * 0.5), -1.5, 1.5), clamp(-(ptr.y - rect.top - cs.headY) / 350, -1, 1));
    } else motion.setLook(0, 0);
    const o = motion.update(dt);
    applyPose(o);
    const hy = H * 0.93 + o.y;
    gaze.position.set(o.x + motion.S.lookS.x * 1.4, hy + motion.S.lookS.y * 0.7, 3);
    vrm.update(dt);
    renderer.render(scene, camera);
    if (frameCb) frameCb(charScreen(rect));
  }
  function tick(now) {
    raf = 0;
    if (!(visible && tabVisible && !paused)) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    step(dt);
    raf = requestAnimationFrame(tick);
  }
  function kick() {
    if (visible && tabVisible && !paused && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }

  // pose awal sebelum frame pertama supaya tidak sempat terlihat T-pose
  motion.setX(motion.S.bounds[1] + 1.4);
  step(0.016);
  kick();

  return {
    motion, H,
    charScreen,
    onFrame(cb) { frameCb = cb; },
    setLookOverride(v) { lookOverride = v; },
    setPaused(v) { paused = !!v; if (!paused) kick(); },
    get compact() { return compact; },
    dispose() {
      cancelAnimationFrame(raf); raf = 0; paused = true;
      ro.disconnect(); io.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVis);
      view.removeEventListener('pointerdown', onDown);
      try { VRMUtils.deepDispose(vrm.scene); } catch (e) { /* abaikan */ }
      renderer.dispose();
    }
  };
}
