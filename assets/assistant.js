// Orkestrator asisten virtual: kolom tanya, gelembung ucapan, sinkron bibir, dan pemuatan karakter 3D.
// Urutan kerja: teks/chat selalu aktif lebih dulu, lalu karakter 3D dimuat sebagai peningkatan (progressive enhancement).
import { createBrain } from './assistant-brain.js';

const P = window.portfolio;
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const store = {
  get(k) { try { return localStorage.getItem('asst.' + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('asst.' + k, v); } catch (e) { /* abaikan */ } }
};

function init() {
  const el = {
    view: $('assistant-view'), canvas: $('assistant-canvas'), bubble: $('assistant-bubble'), text: $('assistant-text'),
    chips: $('assistant-chips'), live: $('assistant-live'), form: $('assistant-form'), input: $('search-input'),
    load: $('assistant-load'), loadTxt: $('assistant-load-text'), loadBar: $('assistant-load-bar'),
    enable: $('assistant-enable'), sound: $('assistant-sound'), roam: $('assistant-roam'),
    close: $('assistant-bubble-close'), suggest: $('assistant-suggest')
  };
  if (!el.view || !el.input || !el.bubble) return;

  const wa = (document.querySelector('a[href^="https://wa.me/"]') || {}).href || '';
  const brain = createBrain(P.apps, { ownerName: 'Iqbal Mantam', contactUrl: wa });
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const VRM_URL = new URL('./assistant.vrm', import.meta.url).href;

  let stage = null;
  let lastAppId = null;
  let typeTimer = 0;
  let calmTimer = 0;
  let thinkTimer = 0;
  let tips = 0;
  let lastActivity = Date.now();
  let viewVisible = true;
  let soundOn = store.get('sound') === '1';
  let roamOn = store.get('roam') !== '0' && !reduced;
  let greeted = false;

  const motion = () => (stage ? stage.motion : null);
  const touch = () => { lastActivity = Date.now(); };

  // ---------- suara (opsional, Web Speech API)
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  const hasVoice = () => !!synth && synth.getVoices().some((v) => /^id/i.test(v.lang));
  function speak(text) {
    if (!soundOn || !synth || !hasVoice()) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/["“”]/g, ''));
    u.lang = 'id-ID';
    u.rate = 1.05;
    u.pitch = 1.15;
    const v = synth.getVoices().find((x) => /^id/i.test(x.lang));
    if (v) u.voice = v;
    synth.speak(u);
  }
  function paintToggles() {
    el.sound.setAttribute('aria-pressed', String(soundOn));
    el.sound.querySelector('[data-on]').hidden = !soundOn;
    el.sound.querySelector('[data-off]').hidden = soundOn;
    el.roam.setAttribute('aria-pressed', String(roamOn));
    el.roam.querySelector('span').textContent = roamOn ? 'Jalan-jalan' : 'Diam';
  }

  // ---------- gelembung ucapan
  function placeBubble(cs) {
    if (el.bubble.hidden || !cs) return;
    el.view.classList.toggle('is-compact', !!cs.compact);
    if (cs.compact) { el.bubble.style.left = ''; return; }
    const bw = el.bubble.offsetWidth;
    const gap = cs.halfW * 1.15 + 14;
    const onLeft = cs.x >= cs.w * 0.5;
    const left = clamp(onLeft ? cs.x - gap - bw : cs.x + gap, 8, Math.max(8, cs.w - bw - 8));
    el.bubble.style.left = left.toFixed(1) + 'px';
    el.bubble.dataset.tail = onLeft ? 'right' : 'left';
  }

  function renderChips(list) {
    el.chips.textContent = '';
    list.forEach((c) => {
      const node = document.createElement(c.href ? 'a' : 'button');
      node.className = 'assistant-chip';
      node.textContent = c.label;
      if (c.href) { node.href = c.href; node.target = '_blank'; node.rel = 'noopener noreferrer'; } else { node.type = 'button'; node.addEventListener('click', () => { touch(); c.fn(); }); }
      el.chips.appendChild(node);
    });
    el.chips.hidden = !list.length;
  }

  function chipsFor(r) {
    const list = [];
    const app = r.openId ? P.apps.find((a) => a.id === r.openId) : null;
    if (app) {
      list.push({ label: 'Lihat detail', fn: () => P.openModal(app.id) });
      list.push({ label: 'Buka aplikasi', href: app.url });
    }
    if (r.apps && r.apps.length && r.filter) list.push({ label: 'Lihat hasil ↓', fn: () => P.scrollToResults() });
    if (r.categories) r.categories.forEach((c) => list.push({ label: c, fn: () => { P.clearAssistant(); P.selectCategory(c); P.scrollToResults(); } }));
    (r.chips || []).forEach((c) => list.push(c));
    return list;
  }

  function stopTalking() {
    clearTimeout(typeTimer); clearTimeout(calmTimer);
    if (synth) synth.cancel();
    const m = motion();
    if (m) m.setTalking(false);
  }

  function say(r, opts = {}) {
    stopTalking();
    const m = motion();
    const text = r.text;
    el.live.textContent = text;
    el.bubble.hidden = false;
    el.bubble.classList.remove('is-thinking');
    el.text.textContent = '';
    el.text.setAttribute('aria-hidden', 'true');
    renderChips([]);
    const hold = Math.max(2.5, text.length / 22);
    if (m) {
      m.setEngaged(true);
      m.setMood(r.mood || 'smile', hold + 1.5);
      if (r.act !== 'walk') m.stopWalking();
      if (r.act === 'walk') m.walkTo(pick([-1, 1]) * (0.5 + Math.random() * 0.8) * Math.max(0.5, m.S.bounds[1]));
      else if (r.act) m.play(r.act, { force: true });
      m.setTalking(true);
    }
    if (opts.speak !== false) speak(text);

    const cps = clamp(text.length / 4, 26, 62);
    let i = 0;
    const finish = () => {
      el.text.textContent = text;
      el.text.removeAttribute('aria-hidden');
      renderChips(opts.noChips ? [] : chipsFor(r));
      if (m) {
        m.setTalking(false);
        calmTimer = setTimeout(() => m.setEngaged(false), opts.keepEngaged ? 9000 : 4500);
      }
    };
    el.bubble.onclick = (ev) => { if (ev.target.closest('a,button')) return; if (i < text.length) { i = text.length; clearTimeout(typeTimer); finish(); } };
    const stepType = () => {
      if (i >= text.length) { finish(); return; }
      const ch = text[i];
      i += 1;
      el.text.textContent = text.slice(0, i);
      if (m) m.viseme(ch);
      typeTimer = setTimeout(stepType, 1000 / cps + (/[.,!?;:]/.test(ch) ? 90 : 0));
    };
    stepType();
  }

  function thinking(then) {
    stopTalking();
    el.bubble.hidden = false;
    el.bubble.classList.add('is-thinking');
    el.text.textContent = '…';
    renderChips([]);
    const m = motion();
    if (m) { m.setEngaged(true); m.stopWalking(); m.setMood('think', 1.2); m.play('think', { force: true }); }
    clearTimeout(thinkTimer);
    thinkTimer = setTimeout(then, reduced ? 150 : 650);
  }

  // ---------- tanya jawab
  function ask(q) {
    touch();
    greeted = true; // jangan menimpa jawaban dengan sapaan pembuka
    const r = brain.ask(q, { lastAppId });
    el.input.value = '';
    if (!q.trim()) { say(r, { noChips: true }); return; }
    thinking(() => {
      if (r.apps && r.apps.length && r.filter) P.setAssistantResults(r.apps, q);
      else if (r.notFound) P.clearAssistant();
      if (r.openId) lastAppId = r.openId;
      else if (r.apps && r.apps.length === 1) lastAppId = r.apps[0];
      say(r, { keepEngaged: true });
    });
  }

  el.form.addEventListener('submit', (e) => { e.preventDefault(); ask(el.input.value); });
  el.input.addEventListener('focus', () => { touch(); if (stage) stage.setLookOverride({ x: 0, y: -0.9 }); });
  el.input.addEventListener('blur', () => { if (stage) stage.setLookOverride(null); });
  el.input.addEventListener('input', touch);
  window.addEventListener('pointerdown', touch, { passive: true });
  el.bubble.addEventListener('pointerenter', () => { clearTimeout(calmTimer); const m = motion(); if (m) { m.setEngaged(true); m.stopWalking(); } });
  el.bubble.addEventListener('pointerleave', () => { clearTimeout(calmTimer); calmTimer = setTimeout(() => { const m = motion(); if (m) m.setEngaged(false); }, 4000); });
  el.close.addEventListener('click', () => { stopTalking(); el.bubble.hidden = true; const m = motion(); if (m) m.setEngaged(false); });

  el.suggest.textContent = '';
  brain.suggestions().forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'assistant-suggest-chip'; b.textContent = s;
    b.addEventListener('click', () => { el.input.value = s; ask(s); });
    el.suggest.appendChild(b);
  });

  el.sound.addEventListener('click', () => {
    if (!soundOn && !hasVoice()) { say({ text: 'Perangkat ini belum punya suara Bahasa Indonesia, jadi saya bicara lewat teks saja ya.', mood: 'sorry' }, { speak: false }); return; }
    soundOn = !soundOn; store.set('sound', soundOn ? '1' : '0'); paintToggles();
    if (soundOn) speak('Suara aktif. Halo!'); else if (synth) synth.cancel();
  });
  el.roam.addEventListener('click', () => {
    roamOn = !roamOn; store.set('roam', roamOn ? '1' : '0'); paintToggles();
    const m = motion(); if (m) m.setRoaming(roamOn);
  });
  if (synth) synth.addEventListener('voiceschanged', () => {});
  document.addEventListener('visibilitychange', () => { if (document.hidden && synth) synth.cancel(); });
  paintToggles();

  // ---------- pemuatan karakter 3D
  const pokes = ['Hehe, geli! Ada yang bisa saya bantu?', 'Hup! Mau cari aplikasi apa?', 'Eh, kok dicolek? Ayo tanya sesuatu.', 'Iya iya, saya di sini. Coba ketik pertanyaan di bawah.'];
  function onPoke() {
    touch();
    const m = motion();
    if (m) m.play(Math.random() < 0.5 ? 'jump' : 'spin', { force: true });
    say({ text: pick(pokes), mood: 'joy' }, { noChips: true });
  }

  function entrance() {
    const m = motion();
    if (!m) return;
    m.setEngaged(true);
    if (roamOn && !reduced) m.walkTo(m.S.bounds[1] * 0.35);
    else m.setX(0);
    const wait = setInterval(() => {
      if (m.isBusy()) return;
      clearInterval(wait);
      if (!greeted) { greeted = true; say({ text: brain.greeting(), mood: 'joy', act: 'wave' }, { speak: false, keepEngaged: false }); } else m.play('wave');
      m.setRoaming(roamOn);
    }, 120);
  }

  async function startStage() {
    el.enable.hidden = true;
    el.load.hidden = false;
    el.loadTxt.textContent = 'Memuat asisten 3D…';
    try {
      const mod = await import('./assistant-3d.js');
      stage = await mod.createStage({
        canvas: el.canvas, view: el.view, url: VRM_URL, reduced, onPoke,
        onProgress: (p) => { const pc = Math.round(p * 100); el.loadTxt.textContent = 'Memuat asisten 3D… ' + pc + '%'; el.loadBar.style.width = pc + '%'; },
        onLost: () => { el.view.classList.remove('has-3d'); el.view.classList.add('no-3d'); }
      });
      el.view.classList.add('has-3d');
      el.load.hidden = true;
      stage.onFrame(placeBubble);
      stage.motion.setRoaming(roamOn);
      stage.motion.setEngaged(true);
      entrance();
    } catch (err) {
      console.warn('Asisten 3D tidak aktif, memakai mode teks:', err);
      el.load.hidden = true;
      el.view.classList.add('no-3d');
    }
  }

  el.enable.addEventListener('click', startStage);

  // peringatan ringan agar hemat kuota: model ±23 MB
  const conn = navigator.connection || {};
  const heavy = conn.saveData || /(^|-)(2g|3g)$/.test(conn.effectiveType || '') || (navigator.deviceMemory && navigator.deviceMemory <= 2);
  const hasGL = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();

  // sapaan teks langsung muncul agar halaman tidak terasa kosong selagi model dimuat
  say({ text: brain.greeting(), mood: 'joy' }, { speak: false, noChips: false });
  if (!hasGL) el.view.classList.add('no-3d');
  else if (heavy) { el.enable.hidden = false; el.view.classList.add('no-3d'); }
  else {
    const go = () => startStage();
    const whenIdle = () => (window.requestIdleCallback ? window.requestIdleCallback(go, { timeout: 2000 }) : setTimeout(go, 300));
    if (document.readyState === 'complete') whenIdle();
    else window.addEventListener('load', whenIdle, { once: true });
  }

  // ---------- penarik perhatian: sesekali mengingatkan bila pengunjung diam
  const io = new IntersectionObserver((es) => { viewVisible = es[0].isIntersecting; }, { threshold: 0.4 });
  io.observe(el.view);
  setInterval(() => {
    if (document.hidden || !viewVisible || tips >= 3 || Date.now() - lastActivity < 24000) return;
    if (document.activeElement === el.input) return;
    tips += 1;
    lastActivity = Date.now();
    const s = pick(brain.suggestions().slice(0, 5));
    const m = motion();
    say({ text: pick(['Bingung mau mulai dari mana? Coba tanya: "' + s + '".', 'Psst, saya bisa carikan aplikasi yang pas. Contohnya: "' + s + '".', 'Hai, masih di sini? Ketik "' + s + '" di kolom bawah ya.']), mood: 'smile', act: m ? pick(['wave', 'hop', 'jump']) : null }, { speak: false, noChips: true });
  }, 6000);
}

if (P && P.apps) init();
