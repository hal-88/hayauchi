// CPUの速さの確認: node scripts/cpu-speed.mjs
import { planCpu, CPU_LEVELS, averageSeconds } from '../src/logic/cpu.js';
import { toRomaji } from '../src/logic/romaji.js';
import { WORDS, SKIPPED } from './words-file.mjs';

const lens = WORDS.map((w) => toRomaji(w.kana).length);
const avgLen = lens.reduce((a, b) => a + b, 0) / lens.length;
console.log(`単語 ${WORDS.length} 個・ローマ字の平均 ${avgLen.toFixed(1)} 文字（最短 ${Math.min(...lens)}・最長 ${Math.max(...lens)}）`);

for (const L of CPU_LEVELS) {
  const ts = [];
  for (let k = 0; k < 20; k++) for (const w of WORDS) ts.push(planCpu(toRomaji(w.kana), L.level).finishMs / 1000);
  ts.sort((a, b) => a - b);
  const avg = ts.reduce((a, b) => a + b, 0) / ts.length;
  const p = (q) => ts[Math.floor(ts.length * q)].toFixed(2);
  console.log(
    `Lv${L.level} ${L.name.padEnd(4, '　')} 平均 ${avg.toFixed(2)}秒（目安表示 ${averageSeconds(L.level, avgLen).toFixed(1)}）  速い1割 ${p(0.1)} / 遅い1割 ${p(0.9)}`
  );
}
