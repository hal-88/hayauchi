// 効果音（音ファイルなし・WebAudio で合成）

const KEY = 'hayauchi.settings';
let ctx = null;
let noiseBuf = null;
let typeSound = 'pop';
const settings = { muted: false, volume: 0.6 };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}'));
} catch {
  /* 保存できない環境でも動く */
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* noop */
  }
}

/** キー入力やクリックのあとに呼ぶ（ブラウザは操作前に音を出させない） */
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export const isMuted = () => settings.muted;
export function setMuted(m) {
  settings.muted = m;
  save();
}
export const getVolume = () => settings.volume;
export function setVolume(v) {
  settings.volume = Math.min(1, Math.max(0, v));
  save();
}
/** タイピング音（ごほうび）をえらぶ */
export function setTypeSound(id) {
  typeSound = id;
}

const silent = () => !ctx || settings.muted || settings.volume <= 0;

function tone({ freq, freqEnd, dur = 0.06, type = 'square', gain = 0.15, delay = 0, attack = 0.005 }) {
  if (silent()) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const v = gain * settings.volume;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.1, gain = 0.2, freq = 2000, freqEnd, q = 1, delay = 0 }) {
  if (silent()) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = ctx.createGain();
  const v = gain * settings.volume;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t);
  src.stop(t + dur + 0.02);
}

const PENTA = [784, 880, 1047, 1175, 1319];
const TYPE_SOUNDS = {
  pop: () => tone({ freq: 1400 + Math.random() * 200, dur: 0.03, type: 'triangle', gain: 0.18 }),
  taiko: () => {
    tone({ freq: 150, freqEnd: 70, dur: 0.12, type: 'sine', gain: 0.5 });
    noise({ dur: 0.03, gain: 0.08, freq: 900 });
  },
  suzu: () => {
    const f = 2600 + Math.random() * 300;
    tone({ freq: f, dur: 0.18, type: 'sine', gain: 0.1 });
    tone({ freq: f * 1.5, dur: 0.12, type: 'sine', gain: 0.05 });
  },
  shuriken: () => noise({ dur: 0.08, gain: 0.25, freq: 5000, freqEnd: 1500, q: 2 }),
  mokkin: () => tone({ freq: PENTA[Math.floor(Math.random() * PENTA.length)], dur: 0.1, type: 'sine', gain: 0.28 }),
  hyoushigi: () => {
    tone({ freq: 2100, dur: 0.025, type: 'square', gain: 0.1 });
    noise({ dur: 0.025, gain: 0.2, freq: 2500, q: 4 });
  },
};

export const sfx = {
  type() {
    (TYPE_SOUNDS[typeSound] || TYPE_SOUNDS.pop)();
  },
  /** ごほうびの蔵での試し聞き */
  preview(id) {
    const f = TYPE_SOUNDS[id] || TYPE_SOUNDS.pop;
    [0, 110, 220].forEach((ms) => setTimeout(f, ms));
  },
  miss() {
    tone({ freq: 180, freqEnd: 120, dur: 0.14, type: 'sawtooth', gain: 0.12 });
  },
  scroll() {
    noise({ dur: 0.22, gain: 0.18, freq: 700, freqEnd: 2600, q: 0.8 });
  },
  clear() {
    tone({ freq: 880, dur: 0.08, type: 'triangle', gain: 0.2 });
    tone({ freq: 1320, dur: 0.14, type: 'triangle', gain: 0.2, delay: 0.07 });
  },
  count() {
    tone({ freq: 660, dur: 0.08, type: 'sine', gain: 0.22 });
  },
  go() {
    tone({ freq: 990, dur: 0.16, type: 'sine', gain: 0.25 });
  },
  lose() {
    tone({ freq: 520, freqEnd: 330, dur: 0.22, type: 'triangle', gain: 0.18 });
  },
  matchLose() {
    [440, 392, 330].forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'triangle', gain: 0.18, delay: i * 0.16 }));
  },
  finish() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.18, type: 'triangle', gain: 0.2, delay: i * 0.09 }));
  },
  reward() {
    [784, 988, 1175, 1568].forEach((f, i) => tone({ freq: f, dur: 0.25, type: 'sine', gain: 0.2, delay: 0.3 + i * 0.08 }));
  },
  /** 術をはなった（mine＝自分） */
  jutsu(mine) {
    noise({ dur: 0.18, gain: 0.16, freq: 1200, freqEnd: 4000, q: 1.5 });
    const base = mine ? 660 : 440;
    [1, 1.5, 2].forEach((m, i) => tone({ freq: base * m, dur: 0.16, type: 'triangle', gain: 0.18, delay: 0.05 + i * 0.07 }));
  },
  freeze() {
    tone({ freq: 2400, freqEnd: 1200, dur: 0.25, type: 'sine', gain: 0.12 });
  },
  /** 手裏剣が刺さる「カッ」 */
  thunk() {
    noise({ dur: 0.05, gain: 0.35, freq: 3200, q: 3 });
    tone({ freq: 240, freqEnd: 120, dur: 0.09, type: 'triangle', gain: 0.25 });
  },
  click() {
    tone({ freq: 900, dur: 0.04, type: 'triangle', gain: 0.12 });
  },
};
