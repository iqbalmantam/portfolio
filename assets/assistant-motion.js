// Mesin gerak prosedural untuk karakter VRM (tanpa dependensi, bisa diuji di Node).
// Output berupa sudut "semantik" (mis. lengan turun, kaki maju). Lapisan 3D yang menerjemahkannya
// ke rotasi tulang, supaya tanda arah sumbu bisa dikalibrasi otomatis per model.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const smooth = (t) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };
const rnd = (a, b) => a + Math.random() * (b - a);
// Amplop 0..1..0: naik di awal, tahan, turun di akhir.
const env = (u, a = 0.15, b = 0.2) => smooth(u / a) * smooth((1 - u) / b);

const ARM_DOWN = 1.15; // sudut lengan turun dari posisi T-pose (rad)

export const ACTION_DUR = {
  jump: 1.0, hop: 1.25, spin: 1.3, cheer: 1.3, wave: 2.5, bow: 1.6, nod: 1.1,
  think: 2.3, stretch: 2.8, look: 2.6, smile: 2.4
};

const MOODS = {
  neutral: { happy: 0, relaxed: 0.12, sad: 0, surprised: 0 },
  smile: { happy: 0.22, relaxed: 0.7, sad: 0, surprised: 0 },
  joy: { happy: 0.85, relaxed: 0.2, sad: 0, surprised: 0 },
  think: { happy: 0, relaxed: 0, sad: 0.14, surprised: 0 },
  sorry: { happy: 0, relaxed: 0, sad: 0.7, surprised: 0 },
  surprised: { happy: 0, relaxed: 0, sad: 0, surprised: 1 }
};

const VOWEL = { a: 'aa', i: 'ih', u: 'ou', e: 'ee', o: 'oh' };

export function createMotion(opts = {}) {
  let reduced = !!opts.reduced;
  const S = {
    t: 0, x: 0, y: 0, yaw: 0, phase: 0, speed: 0, dir: 1, walkTarget: null, run: false,
    act: null, queue: [], idle: 2.5, engaged: false, talking: false, roam: true,
    look: { x: 0, y: 0 }, lookS: { x: 0, y: 0 }, bounds: [-1, 1], legLen: 0.82,
    mood: 'neutral', moodHold: 0, blinkAt: 2.2, blinkT: -1, doubleBlink: false
  };
  const W = {
    raiseL: 0, raiseR: 0, wave: 0, crouch: 0, tuck: 0, bow: 0, tilt: 0, hy: 0, hp: 0, think: 0,
    talk: 0, stretch: 0, happy: 0, relaxed: 0.12, sad: 0, surprised: 0, aa: 0, ih: 0, ou: 0, ee: 0, oh: 0
  };
  const mouthT = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };

  const out = {
    x: 0, y: 0, yaw: 0, shadow: 1, moving: false,
    hips: { drop: 0, yaw: 0, roll: 0 }, spine: { pitch: 0, yaw: 0, roll: 0 }, chest: { pitch: 0, yaw: 0, roll: 0 },
    neck: { pitch: 0, yaw: 0, roll: 0 }, head: { pitch: 0, yaw: 0, roll: 0 },
    arm: { L: { lower: 0, fwd: 0, elbow: 0, wave: 0 }, R: { lower: 0, fwd: 0, elbow: 0, wave: 0 } },
    leg: { L: { fwd: 0, knee: 0 }, R: { fwd: 0, knee: 0 } },
    exp: { happy: 0, relaxed: 0, sad: 0, surprised: 0, blink: 0, aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 }
  };

  // ---- Aksi: tiap aksi menulis target ke T (dan R untuk gerak udara/putar) berdasarkan progres u 0..1
  const jumpArc = (u, R, T, h, spin) => {
    // 0-0.2 jongkok, 0.2-0.82 melayang, 0.82-1 mendarat
    if (u < 0.2) { T.crouch = smooth(u / 0.2); return; }
    if (u < 0.82) {
      const a = (u - 0.2) / 0.62;
      R.air = h * 4 * a * (1 - a);
      T.tuck = Math.sin(Math.PI * a);
      if (spin) R.spin = TAU * smooth(a);
      return;
    }
    T.crouch = 0.7 * (1 - smooth((u - 0.82) / 0.18));
    if (spin) R.spin = TAU;
  };
  const ACTIONS = {
    jump: (u, T, R) => { jumpArc(u, R, T, 0.4); T.raiseL = T.raiseR = 0.55 * Math.sin(Math.PI * clamp((u - 0.15) / 0.7, 0, 1)); T.mood = 'joy'; },
    spin: (u, T, R) => { jumpArc(u, R, T, 0.3, true); T.raiseL = T.raiseR = 0.4 * Math.sin(Math.PI * clamp((u - 0.15) / 0.7, 0, 1)); T.mood = 'joy'; },
    cheer: (u, T, R) => { jumpArc(u, R, T, 0.42); T.raiseL = T.raiseR = env(u, 0.12, 0.2); T.mood = 'joy'; },
    hop: (u, T, R) => {
      const k = u < 0.5 ? u / 0.5 : (u - 0.5) / 0.5;
      R.air = 0.13 * 4 * k * (1 - k);
      T.tuck = 0.7 * Math.sin(Math.PI * k);
      T.crouch = 0.25 * (1 - Math.sin(Math.PI * k));
      T.mood = 'joy';
    },
    wave: (u, T) => { const e = env(u, 0.14, 0.18); T.raiseR = 0.78 * e; T.wave = e; T.tilt = 0.1 * e; T.mood = 'joy'; },
    bow: (u, T) => {
      const e = u < 0.35 ? smooth(u / 0.35) : u < 0.62 ? 1 : smooth((1 - u) / 0.38);
      T.bow = e; T.hp = 0.2 * e; T.mood = 'smile';
    },
    nod: (u, T) => { T.hp = 0.3 * Math.sin(u * TAU * 2) * env(u, 0.1, 0.2); T.mood = 'smile'; },
    think: (u, T) => { const e = env(u, 0.2, 0.2); T.tilt = 0.18 * e; T.hy = 0.28 * e; T.hp = -0.1 * e; T.think = e; T.mood = 'think'; },
    stretch: (u, T) => { const e = env(u, 0.25, 0.25); T.raiseL = T.raiseR = e; T.stretch = e; T.hp = -0.15 * e; T.mood = 'smile'; },
    look: (u, T) => { const e = env(u, 0.15, 0.15); T.hy = 0.6 * Math.sin(u * TAU) * e; T.hp = -0.05 * e; },
    smile: (u, T) => { const e = env(u, 0.2, 0.3); T.tilt = 0.08 * e; T.mood = 'smile'; T.moodAmt = e; }
  };
  const AIRBORNE = new Set(['jump', 'spin', 'cheer', 'hop']);

  function remap(name) {
    if (!reduced) return name;
    if (AIRBORNE.has(name)) return 'nod';
    if (name === 'stretch' || name === 'look') return 'smile';
    return name;
  }

  function play(name, o = {}) {
    name = remap(name);
    if (!ACTIONS[name]) return;
    const next = { name, t: 0, dur: ACTION_DUR[name] || 1.5, force: !!o.force };
    if (S.act && (AIRBORNE.has(S.act.name) || !o.force)) {
      if (S.queue.length < 2) S.queue.push(next);
      return;
    }
    S.act = next;
    S.walkTarget = null;
  }

  function walkTo(x, o = {}) {
    if (reduced) return;
    S.walkTarget = clamp(x, S.bounds[0], S.bounds[1]);
    S.run = !!o.run;
  }

  function autonomy() {
    S.idle = rnd(2.2, 5.5);
    const options = reduced ? [['smile', 55], ['look', 45]] : [
      ['walk', 38], ['jump', 12], ['wave', 9], ['spin', 5], ['stretch', 8], ['look', 10], ['hop', 7], ['smile', 10], ['bow', 2]
    ];
    let total = 0; options.forEach((o) => { total += o[1]; });
    let r = Math.random() * total;
    let choice = options[0][0];
    for (const [n, w] of options) { r -= w; if (r <= 0) { choice = n; break; } }
    if (choice === 'walk') {
      const [a, b] = S.bounds;
      let x = rnd(a, b);
      if (Math.abs(x - S.x) < 0.5) x = clamp(S.x + (S.x > 0 ? -1 : 1) * rnd(0.6, 1.2), a, b);
      walkTo(x, { run: Math.random() < 0.15 });
    } else play(choice);
  }

  function setMood(name, hold = 2.2) { if (MOODS[name]) { S.mood = name; S.moodHold = hold; } }

  function viseme(ch) {
    const c = String(ch || '').toLowerCase();
    mouthT.aa = mouthT.ih = mouthT.ou = mouthT.ee = mouthT.oh = 0;
    if (VOWEL[c]) mouthT[VOWEL[c]] = c === 'a' ? 0.85 : 0.7;
    else if (/[a-z]/.test(c) && !'mbp'.includes(c)) mouthT.aa = 0.22;
  }

  function update(dt) {
    dt = clamp(dt, 0, 0.05);
    S.t += dt;
    const T = {
      raiseL: 0, raiseR: 0, wave: 0, crouch: 0, tuck: 0, bow: 0, tilt: 0, hy: 0, hp: 0, think: 0,
      stretch: 0, talk: S.talking ? 1 : 0, mood: null, moodAmt: 1
    };
    const R = { air: 0, spin: 0 };

    // aksi berjalan
    if (S.act) {
      const a = S.act;
      a.t += dt;
      ACTIONS[a.name](Math.min(a.t / a.dur, 1), T, R);
      if (a.t >= a.dur) {
        S.act = null;
        S.idle = rnd(1.6, 4.2);
        const nxt = S.queue.shift();
        if (nxt) { S.act = nxt; S.walkTarget = null; }
      }
    }
    S.y = R.air;

    // berjalan
    let desired = 0;
    if (!S.act && S.walkTarget != null) {
      const dx = S.walkTarget - S.x;
      if (Math.abs(dx) < 0.02) S.walkTarget = null;
      else { S.dir = Math.sign(dx); desired = (S.run ? 1.9 : 0.95) * Math.min(1, Math.max(0.25, Math.abs(dx) / 0.4)); }
    }
    S.speed = damp(S.speed, desired, 7, dt);
    if (S.speed > 0.02) {
      let step = S.speed * dt;
      if (S.walkTarget != null) step = Math.min(step, Math.abs(S.walkTarget - S.x));
      S.x = clamp(S.x + S.dir * step, S.bounds[0] - 2, S.bounds[1] + 2);
      S.phase += (dt * S.speed / 1.1) * TAU;
    } else if (S.speed <= 0.02) {
      // berhenti: pelan-pelan ke fase netral supaya kaki sejajar
      S.phase = damp(S.phase % TAU, Math.round((S.phase % TAU) / Math.PI) * Math.PI, 8, dt);
    }
    const gait = clamp(S.speed / 0.95, 0, 2.1);
    const g1 = Math.min(gait, 1);
    const gr = Math.max(gait - 1, 0);
    const moving = gait > 0.12;

    // arah badan
    const yawT = moving ? S.dir * (S.run ? 0.9 : 1.05) : 0;
    S.yaw = damp(S.yaw, yawT, moving ? 7 : 5, dt);

    // otomatisasi saat diam
    if (!S.act && S.walkTarget == null && !S.engaged && S.roam && S.speed < 0.05) {
      S.idle -= dt;
      if (S.idle <= 0) autonomy();
    }

    // mood
    if (S.moodHold > 0) { S.moodHold -= dt; if (S.moodHold <= 0) S.mood = 'neutral'; }
    const moodName = T.mood && !S.talking ? T.mood : S.mood;
    const mt = MOODS[moodName] || MOODS.neutral;
    const mAmt = T.mood && !S.talking && moodName !== S.mood ? T.moodAmt : 1;
    const talkMood = S.talking ? { happy: 0.3, relaxed: 0.45 } : null;
    const tgtHappy = talkMood ? Math.max(talkMood.happy, mt.happy * 0.6) : mt.happy * mAmt;
    const tgtRelaxed = talkMood ? talkMood.relaxed : (MOODS.neutral.relaxed + (mt.relaxed - MOODS.neutral.relaxed) * mAmt);

    // haluskan target ke W
    const rate = { crouch: 16, tuck: 14, raiseL: 9, raiseR: 9, wave: 9, bow: 10, tilt: 6, hy: 6, hp: 10, think: 6, talk: 5, stretch: 6 };
    for (const k in rate) W[k] = damp(W[k], T[k] || 0, rate[k], dt);
    W.happy = damp(W.happy, tgtHappy, 6, dt);
    W.relaxed = damp(W.relaxed, tgtRelaxed, 6, dt);
    W.sad = damp(W.sad, mt.sad, 6, dt);
    W.surprised = damp(W.surprised, mt.surprised, 8, dt);
    for (const k in mouthT) { W[k] = damp(W[k], mouthT[k], 24, dt); mouthT[k] = damp(mouthT[k], 0, 9, dt); }

    // pandangan
    S.lookS.x = damp(S.lookS.x, S.look.x, 6, dt);
    S.lookS.y = damp(S.lookS.y, S.look.y, 6, dt);

    // kedip
    let blink = 0;
    if (S.blinkT >= 0) {
      S.blinkT += dt;
      const p = S.blinkT / 0.15;
      blink = p < 1 ? Math.sin(p * Math.PI) : 0;
      if (p >= 1) {
        S.blinkT = -1;
        S.blinkAt = S.t + (S.doubleBlink ? 0.12 : rnd(2, 6));
        S.doubleBlink = false;
      }
    } else if (S.t >= S.blinkAt) { S.blinkT = 0; S.doubleBlink = Math.random() < 0.15; }

    // ---- rakit pose
    const t = S.t;
    const sp = Math.sin(S.phase);
    const cp = Math.cos(S.phase);
    const A = 0.46 * g1 + 0.2 * gr;
    const swing = 0.5 * g1 + 0.25 * gr;
    const alpha = W.crouch * 0.75;
    const breath = Math.sin(t * 1.8);
    const raiseOf = (r) => clamp(r, 0, 1);

    out.x = S.x; out.y = S.y; out.moving = moving;
    out.yaw = S.yaw + R.spin;
    out.shadow = 1 - clamp(S.y / 0.55, 0, 0.65);

    // kaki
    const kneeL = gait * (0.12 + 0.62 * Math.max(0, cp)) + 2 * alpha + W.tuck * 0.95;
    const kneeR = gait * (0.12 + 0.62 * Math.max(0, -cp)) + 2 * alpha + W.tuck * 0.95;
    out.leg.L.fwd = A * sp + alpha + W.tuck * 0.5;
    out.leg.R.fwd = -A * sp + alpha + W.tuck * 0.5;
    out.leg.L.knee = kneeL;
    out.leg.R.knee = kneeR;

    // pinggul
    const bob = -0.014 * gait * (0.5 + 0.5 * Math.cos(2 * S.phase));
    out.hips.drop = S.legLen * (1 - Math.cos(alpha)) - bob + 0.004 * breath;
    out.hips.yaw = 0.12 * g1 * sp;
    out.hips.roll = 0.03 * g1 * sp + 0.012 * Math.sin(t * 0.6);

    // badan
    const lean = (0.03 + 0.12 * gr) * g1 + 0.02 * W.crouch;
    out.spine.pitch = lean + W.bow * 0.62 - W.stretch * 0.1 + 0.006 * breath;
    out.spine.yaw = -0.1 * g1 * sp;
    out.spine.roll = -0.5 * out.hips.roll;
    out.chest.pitch = W.bow * 0.2 + 0.014 * breath;
    out.chest.yaw = -0.06 * g1 * sp;
    out.chest.roll = 0;

    // kepala & leher: ikuti arah pandang, kompensasi putaran badan supaya wajah tetap menghadap penonton
    const lookYaw = clamp(S.lookS.x * 0.6, -0.6, 0.6);
    const lookPitch = clamp(-S.lookS.y * 0.4, -0.35, 0.35);
    const headYaw = clamp(lookYaw - 0.6 * S.yaw + W.hy, -1.0, 1.0);
    const talkBob = 0.045 * Math.sin(t * 5.3) * W.talk;
    const headPitch = lookPitch + W.hp + talkBob + 0.012 * Math.sin(t * 1.1) - 0.03 * g1;
    out.neck.yaw = headYaw * 0.4; out.head.yaw = headYaw * 0.6 + 0.05 * Math.sin(t * 2.2) * W.talk;
    out.neck.pitch = headPitch * 0.35; out.head.pitch = headPitch * 0.65;
    out.neck.roll = W.tilt * 0.4; out.head.roll = W.tilt * 0.6;

    // lengan
    const armFor = (side) => {
      const isR = side === 'R';
      const raise = raiseOf(isR ? W.raiseR : W.raiseL);
      const sgn = isR ? 1 : -1;
      const swingFwd = (isR ? 1 : -1) * swing * sp * (1 - raise);
      const talkPh = isR ? 0 : 1.7;
      let lower = ARM_DOWN - (ARM_DOWN + 1.25) * raise - 0.16 * W.talk - 0.15 * W.bow;
      let fwd = swingFwd + 0.25 * W.bow + 0.12 * W.talk * Math.sin(t * 2.6 + talkPh);
      let elbow = 0.12 + 0.45 * g1 + 0.3 * gr + W.talk * (0.5 + 0.22 * Math.sin(t * 3.1 + talkPh)) + 0.9 * (isR ? W.wave : 0);
      let wave = isR ? W.wave * 0.5 * Math.sin(t * 12) : 0;
      if (isR && W.think > 0.001) {
        const k = W.think;
        lower = lower * (1 - k) + 0.55 * k;
        fwd = fwd * (1 - k) + 0.7 * k;
        elbow = elbow * (1 - k) + 1.45 * k;
      }
      elbow *= 1 - 0.8 * W.stretch;
      out.arm[side].lower = lower + 0.02 * Math.sin(t * 1.3 + sgn);
      out.arm[side].fwd = fwd;
      out.arm[side].elbow = elbow;
      out.arm[side].wave = wave;
    };
    armFor('L'); armFor('R');

    // ekspresi
    const e = out.exp;
    e.happy = W.happy; e.relaxed = W.relaxed; e.sad = W.sad; e.surprised = W.surprised;
    e.blink = blink * (1 - 0.6 * W.happy);
    e.aa = W.aa; e.ih = W.ih; e.ou = W.ou; e.ee = W.ee; e.oh = W.oh;
    return out;
  }

  return {
    S, out, update, play, walkTo, setMood, viseme,
    setLook(x, y) { S.look.x = clamp(x, -1.5, 1.5); S.look.y = clamp(y, -1.5, 1.5); },
    setTalking(v) { S.talking = !!v; },
    setEngaged(v) { S.engaged = !!v; if (!v) S.idle = Math.max(S.idle, 2.5); },
    stopWalking() { S.walkTarget = null; S.run = false; },
    setRoaming(v) { S.roam = !!v; if (!v) S.walkTarget = null; },
    setReduced(v) { reduced = !!v; },
    setBounds(a, b) { S.bounds = [a, b]; S.x = clamp(S.x, a - 2, b + 2); },
    setLegLength(v) { if (v > 0.3 && v < 1.5) S.legLen = v; },
    setX(x) { S.x = x; },
    isBusy() { return !!S.act || S.walkTarget != null; },
    get x() { return S.x; }
  };
}
