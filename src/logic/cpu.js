// CPUの打ち方。出題の瞬間に「何ミリ秒後に何文字目を打つか」を前もって決める。
// 画面に依存しない（scripts/cpu-speed.mjs で速さを確認できる）。

// kps＝1秒に打つ数、react＝打ち始めるまで、miss＝1キーごとにミスして止まる確率
export const CPU_LEVELS = [
  { level: 1, name: 'のんびり', kps: 0.9, react: 1500, miss: 0.12 },
  { level: 2, name: 'ふつう', kps: 1.4, react: 1200, miss: 0.08 },
  { level: 3, name: 'はやい', kps: 2.3, react: 950, miss: 0.06 },
  { level: 4, name: 'すごい', kps: 3.4, react: 750, miss: 0.04 },
  { level: 5, name: 'マスター', kps: 5.0, react: 550, miss: 0.02 },
];

const MISS_PAUSE = [250, 500]; // ミスしたときに止まる時間（ミリ秒）

/**
 * @param {string} romaji 打つつづり
 * @param {number} level 1〜5
 * @param {{reactScale?:number, noMissPause?:boolean, delay?:number}} opt 術の効果
 *   reactScale＝打ち始めるまでの時間の倍率（先読み）、noMissPause＝ミスで止まらない（鉄壁）、delay＝打ち始めがおそくなる（相手の術）
 * @returns {{times:number[], finishMs:number, misses:number}} times[i]＝i+1文字目を打ち終わる時刻
 */
export function planCpu(romaji, level, rng = Math.random, opt = {}) {
  const L = CPU_LEVELS[Math.min(Math.max(level, 1), 5) - 1];
  let t = L.react * (0.8 + rng() * 0.4) * (opt.reactScale ?? 1) + (opt.delay || 0);
  const times = [];
  let misses = 0;
  for (let i = 0; i < romaji.length; i++) {
    t += (1000 / L.kps) * (0.6 + rng() * 0.8);
    if (rng() < L.miss && !opt.noMissPause) {
      misses++;
      t += MISS_PAUSE[0] + rng() * (MISS_PAUSE[1] - MISS_PAUSE[0]);
    }
    times.push(Math.round(t));
  }
  return { times, finishMs: times[times.length - 1] || 0, misses };
}

/** 時刻 ms までに打ち終わった文字数 */
export function typedCountAt(plan, ms) {
  let n = 0;
  while (n < plan.times.length && plan.times[n] <= ms) n++;
  return n;
}

/** 1問あたりのだいたいの秒数（選択画面の目安表示用） */
export function averageSeconds(level, avgLen) {
  const L = CPU_LEVELS[level - 1];
  const pause = L.miss * avgLen * ((MISS_PAUSE[0] + MISS_PAUSE[1]) / 2);
  return (L.react + (avgLen * 1000) / L.kps + pause) / 1000;
}
