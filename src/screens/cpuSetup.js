// CPU戦の準備：レベル（1〜5）と先取点（5/10）をえらぶ
import { CPU_LEVELS, averageSeconds } from '../logic/cpu.js';
import { toRomaji } from '../logic/romaji.js';
import { WORDS } from '../data/words.js';
import { showTitle } from './title.js';
import { showCpuBattle } from './cpuBattle.js';
import { NINJAS, cpuNinjaFor } from '../data/ninjas.js';
import { hasNinja, cpuWins } from '../progress/save.js';
import { ninjaSvg } from '../ui/ninjaSvg.js';
import { esc } from '../ui/typing.js';

const KEY = 'hayauchi.cpuSetup';
const TARGETS = [5, 10];

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { level: CPU_LEVELS[s.level - 1] ? s.level : 2, target: TARGETS.includes(s.target) ? s.target : 5 };
  } catch {
    return { level: 2, target: 5 };
  }
}
function save(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

// ことばのローマ字の平均の長さ（words.json を読みこんだあとに計算する）
const avgLen = () => WORDS.reduce((a, w) => a + toRomaji(w.kana).length, 0) / WORDS.length;

// はじめて勝つと仲間になる忍者がいるレベルに印をつける
function unlockBadge(level) {
  const n = NINJAS.find((x) => x.unlockLevel === level);
  if (n && !hasNinja(n.id)) return '<span class="badge">勝つと仲間に！</span>';
  if (cpuWins(level) > 0) return `<span class="badge done">${cpuWins(level)}勝</span>`;
  return '';
}

export function showCpuSetup(el, go, preset) {
  const s = { ...load(), ...(preset || {}) };
  const AVG = avgLen();
  // 相手の忍者（Lv1 は毎回ランダム）
  const foes = {};
  for (const L of CPU_LEVELS) foes[L.level] = cpuNinjaFor(L.level);

  el.innerHTML = `
    <section class="setup panel-page" data-nav="own">
      <h2>CPUとたいせん</h2>
      <div class="setup-block">
        <div class="setup-label">CPUのつよさ <span><kbd>←</kbd><kbd>→</kbd></span></div>
        <div class="levels">
          ${CPU_LEVELS.map(
            (L) => `
            <button type="button" class="level" data-level="${L.level}">
              ${ninjaSvg(foes[L.level].id, { cls: 'foe' })}
              ${unlockBadge(L.level)}
              <span class="lv">Lv${L.level}</span>
              <span class="foe-name">${esc(foes[L.level].name)}</span>
              <span class="lv-name">${L.name}</span>
              <span class="stars">${'★'.repeat(L.level)}${'☆'.repeat(5 - L.level)}</span>
              <span class="lv-sec">1問 約${averageSeconds(L.level, AVG).toFixed(1)}秒</span>
            </button>`
          ).join('')}
        </div>
      </div>
      <div class="setup-block">
        <div class="setup-label">なん点とったら勝ち？ <span><kbd>↑</kbd><kbd>↓</kbd></span></div>
        <div class="targets">
          ${TARGETS.map((t) => `<button type="button" class="target" data-target="${t}">${t}点先取</button>`).join('')}
        </div>
      </div>
      <div class="buttons">
        <button class="btn primary big" type="button" data-act="start">スタート <kbd>Enter</kbd></button>
        <button class="btn" type="button" data-act="back">もどる <kbd>Esc</kbd></button>
      </div>
    </section>
  `;

  function draw() {
    el.querySelectorAll('.level').forEach((b) => b.classList.toggle('on', +b.dataset.level === s.level));
    el.querySelectorAll('.target').forEach((b) => b.classList.toggle('on', +b.dataset.target === s.target));
  }
  draw();

  const start = () => {
    save(s);
    go(showCpuBattle, { level: s.level, target: s.target, foe: foes[s.level].id });
  };

  el.querySelectorAll('.level').forEach((b) =>
    b.addEventListener('click', () => {
      s.level = +b.dataset.level;
      draw();
    })
  );
  el.querySelectorAll('.target').forEach((b) =>
    b.addEventListener('click', () => {
      s.target = +b.dataset.target;
      draw();
    })
  );
  el.querySelector('[data-act="start"]').addEventListener('click', start);
  el.querySelector('[data-act="back"]').addEventListener('click', () => go(showTitle));

  const onKey = (e) => {
    if (e.key === 'ArrowLeft') s.level = Math.max(1, s.level - 1);
    else if (e.key === 'ArrowRight') s.level = Math.min(5, s.level + 1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') s.target = s.target === 5 ? 10 : 5;
    else if (/^[1-5]$/.test(e.key)) s.level = +e.key;
    else if (e.key === 'Enter') return e.preventDefault(), start();
    else if (e.key === 'Escape') return go(showTitle);
    else return;
    e.preventDefault();
    draw();
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
