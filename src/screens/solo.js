// ひとりでしゅぎょう：10問。1問ごとに「3秒カウントダウン → 巻物が開いて出題 → 打ち切ったら次へ」
import { RomajiMatcher } from '../logic/romaji.js';
import { pickWords } from '../data/words.js';
import { sfx } from '../audio/sfx.js';
import { getEquip, getSave, recordSolo } from '../progress/save.js';
import { spawnAt } from '../ui/effects.js';
import { showTitle } from './title.js';
import {
  esc,
  readTypingKey,
  IME_WARN_HTML,
  SCROLL_HTML,
  closeScroll,
  openScroll,
  renderWord,
  drawProgress,
  stampHtml,
  shake,
  setupShake,
  missStop,
  timerBag,
} from '../ui/typing.js';

const QUESTIONS = 10;
export const COUNTDOWN_MS = 3000; // ひとりでしゅぎょうのカウントダウン
export const BATTLE_COUNTDOWN_MS = 5000; // CPU戦・みんなで対戦のカウントダウン（術を使えるのはこの間）
const AFTER_CLEAR_MS = 800;

export function showSolo(el, go) {
  el.innerHTML = `
    <section class="play">
      <div class="status">
        <div class="pill">問題 <b class="q-no">1</b> / ${QUESTIONS}</div>
        <div class="pill">ミス <b class="miss">0</b></div>
        <div class="pill timer"><b class="time">0.00</b> 秒</div>
      </div>
      ${SCROLL_HTML}
      ${IME_WARN_HTML}
      <div class="play-foot"><button class="btn small" type="button" data-act="quit">やめる</button></div>
    </section>
  `;
  el.querySelector('[data-act="quit"]').addEventListener('click', () => go(showTitle));

  const $ = (s) => el.querySelector(s);
  const stage = $('.stage');
  const card = $('.card');
  const qNoEl = $('.q-no');
  const missEl = $('.miss');
  const timeEl = $('.time');
  const imeWarn = $('.ime-warn');
  setupShake(card);

  const words = pickWords(QUESTIONS);
  const results = []; // { text, kana, ms, miss }
  let idx = -1;
  let phase = 'idle'; // countdown | typing | cleared | result
  let matcher = null;
  let t0 = 0;
  let wordMiss = 0;
  let totalMiss = 0;
  let totalKeys = 0;
  let raf = 0;
  let stopUntil = 0; // ミスしたあと止まっている間
  const timers = timerBag();

  function nextRound() {
    idx++;
    if (idx >= words.length) return showResult();
    phase = 'countdown';
    qNoEl.textContent = idx + 1;
    timeEl.textContent = '0.00';
    const steps = 3;
    for (let i = 0; i < steps; i++) {
      timers.later(() => {
        closeScroll(card, steps - i);
        sfx.count();
      }, (i * COUNTDOWN_MS) / steps);
    }
    timers.later(showWord, COUNTDOWN_MS);
  }

  function showWord() {
    const w = words[idx];
    matcher = new RomajiMatcher(w.kana);
    wordMiss = 0;
    phase = 'typing';
    renderWord(stage, w);
    drawProgress(stage, w, matcher);
    openScroll(card);
    sfx.scroll();
    t0 = performance.now();
    tick();
  }

  function tick() {
    if (phase !== 'typing') return;
    timeEl.textContent = ((performance.now() - t0) / 1000).toFixed(2);
    raf = requestAnimationFrame(tick);
  }

  function onMiss() {
    wordMiss++;
    totalMiss++;
    missEl.textContent = totalMiss;
    sfx.miss();
    shake(card);
    stopUntil = missStop(card);
  }

  function onClear() {
    const ms = performance.now() - t0;
    cancelAnimationFrame(raf);
    phase = 'cleared';
    const w = words[idx];
    results.push({ text: w.text, kana: w.kana, ms, miss: wordMiss });
    timeEl.textContent = (ms / 1000).toFixed(2);
    card.classList.add('cleared');
    stage.insertAdjacentHTML('beforeend', stampHtml('クリア', `${(ms / 1000).toFixed(2)}秒`));
    sfx.clear();
    timers.later(nextRound, AFTER_CLEAR_MS);
  }

  function showResult() {
    phase = 'result';
    sfx.finish();
    const totalMs = results.reduce((a, r) => a + r.ms, 0);
    const prevBest = getSave().solo.bestMs;
    const isBest = recordSolo(totalMs);
    const acc = totalKeys + totalMiss ? Math.round((totalKeys / (totalKeys + totalMiss)) * 100) : 100;
    const kps = totalMs ? (totalKeys / (totalMs / 1000)).toFixed(1) : '0';
    const best = results.reduce((a, r) => (r.ms < a.ms ? r : a), results[0]);
    el.innerHTML = `
      <section class="result panel-page">
        <div class="result-grid">
          <div class="result-left">
            <h2>しゅぎょう完了！</h2>
            <p class="best-line">${
              isBest
                ? `<b class="new-best">自己ベスト更新！</b>${prevBest !== null ? ` これまで ${(prevBest / 1000).toFixed(2)}秒` : ''}`
                : `自己ベスト ${(prevBest / 1000).toFixed(2)}秒`
            }</p>
            <div class="stats two">
              <div class="stat"><span>合計タイム</span><b>${(totalMs / 1000).toFixed(2)}<small>秒</small></b></div>
              <div class="stat"><span>1秒に打った数</span><b>${kps}<small>回</small></b></div>
              <div class="stat"><span>ミス</span><b>${totalMiss}<small>回</small></b></div>
              <div class="stat"><span>正確さ</span><b>${acc}<small>%</small></b></div>
            </div>
          </div>
          <div class="result-right">
            <div class="log-legend"><span><i style="background:var(--shu)"></i>いちばん速い</span></div>
            <div class="log-grid">
              ${results
                .map(
                  (r) => `<div class="lg ${r === best ? 'best me' : ''}"><b>${esc(r.text)}</b><span>${(r.ms / 1000).toFixed(2)}秒${r.miss ? ` ×${r.miss}` : ''}</span></div>`
                )
                .join('')}
            </div>
            <div class="buttons">
              <button class="btn primary" type="button" data-act="again">もう一回 <kbd>Enter</kbd></button>
              <button class="btn" type="button" data-act="title">タイトルへ</button>
            </div>
          </div>
        </div>
      </section>
    `;
    el.querySelector('[data-act="again"]').addEventListener('click', () => go(showSolo));
    el.querySelector('[data-act="title"]').addEventListener('click', () => go(showTitle));
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      go(showTitle);
      return;
    }
    if (phase === 'result') {
      if (e.key === 'Enter') {
        e.preventDefault();
        go(showSolo);
      }
      return;
    }
    if (e.key === ' ') e.preventDefault(); // スペースはのちに術用。ページが動かないように
    const k = readTypingKey(e);
    if (!k) return;
    if (k.ime) {
      imeWarn.hidden = false;
      return;
    }
    imeWarn.hidden = true;
    if (phase !== 'typing') return;

    e.preventDefault();
    if (performance.now() < stopUntil) return;
    if (matcher.input(k.char)) {
      totalKeys++;
      sfx.type();
      drawProgress(stage, words[idx], matcher);
      spawnAt(getEquip().effect, stage.querySelector('.romaji .typed'));
      if (matcher.done) onClear();
    } else {
      onMiss();
    }
  }

  window.addEventListener('keydown', onKey);
  nextRound();

  return () => {
    window.removeEventListener('keydown', onKey);
    cancelAnimationFrame(raf);
    timers.clear();
  };
}
