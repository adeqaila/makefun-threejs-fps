// audio.js — one job: synthesized sound. No audio files, no network: every sound
// is built from oscillators and filtered noise in the Web Audio API. The context is
// created lazily on the first user gesture; every call is a no-op until then.
let ctx = null;
let master = null;

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  } catch (e) { ctx = null; }
}

function tone(freq, dur, type, vol, slideTo) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(vol || 0.2, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function noiseBurst(dur, vol, freq, q) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = freq || 1200; f.Q.value = q || 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol || 0.3, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0);
}

export const sfx = {
  shot(kind) {
    if (kind === 'breacher') { noiseBurst(0.22, 0.5, 900); tone(90, 0.12, 'sine', 0.4, 40); }
    else if (kind === 'longbow') { noiseBurst(0.3, 0.5, 700); tone(70, 0.25, 'sine', 0.4, 35); }
    else if (kind === 'raptor') { noiseBurst(0.08, 0.3, 2200); tone(180, 0.06, 'square', 0.15, 90); }
    else if (kind === 'vk47') { noiseBurst(0.12, 0.4, 1500); tone(140, 0.08, 'square', 0.2, 60); }
    else { noiseBurst(0.1, 0.35, 1800); tone(200, 0.06, 'square', 0.18, 100); }
  },
  enemyShot(dist) {
    const v = Math.max(0.08, 0.35 - dist * 0.006);
    noiseBurst(0.1, v, 1100);
  },
  reload() { tone(1200, 0.05, 'square', 0.12); setTimeout(() => tone(900, 0.05, 'square', 0.12), 180); },
  dryFire() { tone(1500, 0.03, 'square', 0.1); },
  hit() { tone(2200, 0.05, 'sine', 0.25); },
  kill() { tone(880, 0.08, 'sine', 0.25); setTimeout(() => tone(1320, 0.12, 'sine', 0.25), 90); },
  hurt() { tone(160, 0.15, 'sawtooth', 0.3, 70); },
  plantBeep() { tone(1400, 0.09, 'sine', 0.3); },
  plantDone() { tone(700, 0.15, 'sine', 0.3); setTimeout(() => tone(1050, 0.2, 'sine', 0.3), 140); },
  explosion() { noiseBurst(0.9, 0.7, 400); tone(55, 0.8, 'sine', 0.5, 28); },
  throwPin() { tone(2500, 0.04, 'square', 0.12); },
  buy() { tone(660, 0.07, 'sine', 0.2); setTimeout(() => tone(990, 0.1, 'sine', 0.2), 80); },
  denied() { tone(220, 0.12, 'square', 0.2); },
  roundWin() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'sine', 0.25), i * 130)); },
  roundLose() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'sine', 0.25), i * 140)); },
  click() { tone(1000, 0.04, 'square', 0.1); },
};
