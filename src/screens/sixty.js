// 60秒チャレンジ：60秒で いくつ ことばを打てるか。術はなし。
// 記録はクラスのランキング（Firebase の ranking/sixty）と、この端末の自己ベスト
import { RomajiMatcher } from '../logic/romaji.js';
import { pickWords, WORDS } from '../data/words.js';
import { sfx } from '../audio/sfx.js';
import { getEquip, getProfile, getSave, recordSixty } from '../progress/save.js';
import { loadSixty, submitSixty } from '../online/ranking.js';
import { isLocalMode } from '../online/config.js';
import { ninjaSvg } from '../ui/ninjaSvg.js';
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
  shake,
  setupShake,
  timerBag,
} from '../ui/typing.js';

export const SIXTY_MS = 60000;
export const MISS_PENALTY_MS = 500; // まちがえると のこり時間が0.5秒へる
const READY_MS = 3000; // はじまる前の 3・2・1
const RANK_SHOW = 10; // ランキングに出す人数

/** ランキングの表（上から10人。自分が10位より下なら、下に自分の行もつける）。名前が見えるのは自分だけ（ほかの人は ？？？） */
function rankHtml(list) {
  if (!list.length) return '<p class="rank-empty">まだだれも記録がないよ。1番乗りしよう！</p>';
  const row = (r, i) => `
    <li class="rk ${r.mine ? 'me' : ''} ${i < 3 ? `top${i + 1}` : ''}">
      <span class="rk-no">${i + 1}</span>
      ${ninjaSvg(r.ninja, { color: r.color, costume: r.costume, cls: 'rk-ninja' })}
      <b class="rk-name">${r.mine ? esc(r.name) : '？？？'}</b>
      <span class="rk-w">${r.words}<small>こ</small></span>
    </li>`;
  const top = list.slice(0, RANK_SHOW).map(row).join('');
  const mi = list.findIndex((r) => r.mine);
  const extra = mi >= RANK_SHOW ? `<li class="rk-gap">…</li>${row(list[mi], mi)}` : '';
  return `<ol class="rank-list">${top}${extra}</ol>`;
}

const RANK_PANEL = () => `
  <div class="sixty-rank panel">
    <h3>🏆 クラスのランキング</h3>
    <div class="rank-body"><p class="rank-empty">よみこみ中…</p></div>
    ${isLocalMode() ? '<p class="testmode">テストモード：このパソコンの中だけのランキング</p>' : ''}
  </div>`;

/** ランキングを読んで表にする（つながらなければ、そのことを出す）。もどり値はランキング（読めなければ null） */
async function fillRank(el, alive) {
  const body = el.querySelector('.rank-body');
  try {
    const list = await loadSixty(getProfile().name);
    if (alive()) body.innerHTML = rankHtml(list);
    return list;
  } catch (e) {
    if (alive()) body.innerHTML = `<p class="rank-empty">ランキングを読めなかったよ（${esc(e.message || e)}）</p>`;
    return null;
  }
}

/** はじめの画面：ルール・自己ベスト・ランキング。start: true なら すぐ はじめる（もう一回） */
export function showSixty(el, go, { start = false } = {}) {
  if (start) return playSixty(el, go);
  let alive = true;
  const b = getSave().sixty.best;
  el.innerHTML = `
    <section class="sixty panel-page">
      <h2>60秒チャレンジ</h2>
      <div class="sixty-body">
        <div class="sixty-left panel">
          <p class="sixty-lead">60秒で いくつ ことばを打てるかな？</p>
          <ul class="sixty-rules">
            <li>打ち切ったら すぐ つぎのことば</li>
            <li>まちがえると、のこり時間が 0.5秒 へる</li>
            <li>術は使えないよ。打つ速さだけで勝負！</li>
          </ul>
          <div class="my-best"><span>自己ベスト</span><b>${b ? `${b.words}<small>こ</small>` : '<small>まだなし</small>'}</b></div>
          <div class="buttons">
            <button class="btn primary big" type="button" data-act="start">スタート <kbd>Enter</kbd></button>
            <button class="btn" type="button" data-act="back">もどる <kbd>Esc</kbd></button>
          </div>
        </div>
        ${RANK_PANEL()}
      </div>
    </section>
  `;
  el.querySelector('[data-act="start"]').addEventListener('click', () => go(playSixty));
  el.querySelector('[data-act="back"]').addEventListener('click', () => go(showTitle));
  const onKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      go(playSixty);
    } else if (e.key === 'Escape') go(showTitle);
  };
  window.addEventListener('keydown', onKey);
  fillRank(el, () => alive);
  return () => {
    alive = false;
    window.removeEventListener('keydown', onKey);
  };
}

/** 60秒のプレイ */
function playSixty(el, go) {
  el.innerHTML = `
    <section class="play sixty-play" data-nav="off">
      <div class="status">
        <div class="pill timer">のこり <b class="left">60.0</b> 秒</div>
        <div class="pill count">ことば <b class="cnt">0</b> こ</div>
        <div class="pill">ミス <b class="miss">0</b></div>
      </div>
      ${SCROLL_HTML}
      ${IME_WARN_HTML}
      <div class="play-foot"><button class="btn small" type="button" data-act="quit">やめる</button></div>
    </section>
  `;
  const $ = (s) => el.querySelector(s);
  const stage = $('.stage');
  const card = $('.card');
  const leftEl = $('.left');
  const cntEl = $('.cnt');
  const missEl = $('.miss');
  const imeWarn = $('.ime-warn');
  setupShake(card);
  $('[data-act="quit"]').addEventListener('click', () => go(showSixty));

  const eq = getEquip();
  let words = pickWords(WORDS.length);
  let wi = -1;
  let word = null;
  let matcher = null;
  let phase = 'ready'; // ready | typing | result
  let t0 = 0;
  let count = 0;
  let keys = 0;
  let miss = 0;
  let penalty = 0; // まちがえて へった時間
  let endTimer = 0;
  let playedMs = SIXTY_MS; // じっさいに打っていた時間
  let raf = 0;
  let alive = true;
  const timers = timerBag();

  function nextWord() {
    wi++;
    if (wi >= words.length) {
      words = pickWords(WORDS.length); // ぜんぶ出たら まぜなおす
      wi = 0;
    }
    word = words[wi];
    matcher = new RomajiMatcher(word.kana);
    renderWord(stage, word);
    drawProgress(stage, word, matcher);
  }

  function start() {
    phase = 'typing';
    nextWord();
    openScroll(card);
    sfx.scroll();
    t0 = performance.now();
    scheduleEnd(); // 終わりはタイマーで決める（画面の描きかえが止まってもずれない）
    tick();
  }

  // のこり時間（まちがえた分だけへる）
  const leftMs = () => Math.max(0, SIXTY_MS - penalty - (performance.now() - t0));
  function scheduleEnd() {
    clearTimeout(endTimer);
    endTimer = setTimeout(finish, leftMs());
  }

  function tick() {
    if (phase !== 'typing') return;
    const left = leftMs();
    leftEl.textContent = (left / 1000).toFixed(1);
    $('.timer').classList.toggle('hurry', left <= 10000);
    raf = requestAnimationFrame(tick);
  }

  function onClear() {
    count++;
    cntEl.textContent = count;
    const pill = $('.pill.count');
    pill.classList.remove('pop');
    void pill.offsetWidth;
    pill.classList.add('pop');
    sfx.clear();
    nextWord();
  }

  function finish() {
    if (phase !== 'typing') return;
    phase = 'result';
    clearTimeout(endTimer);
    playedMs = performance.now() - t0;
    cancelAnimationFrame(raf);
    sfx.finish();
    showResult();
  }

  function showResult() {
    const prev = getSave().sixty.best;
    const isBest = recordSixty(count, keys);
    const acc = keys + miss ? Math.round((keys / (keys + miss)) * 100) : 100;
    const kps = (keys / Math.max(1, playedMs / 1000)).toFixed(1);
    el.innerHTML = `
      <section class="sixty panel-page result">
        <div class="sixty-body">
          <div class="sixty-left panel">
            <h2>タイムアップ！</h2>
            <div class="sixty-score"><b>${count}</b><small>こ</small></div>
            <p class="best-line">${
              isBest
                ? `<b class="new-best">自己ベスト更新！</b>${prev ? ` これまで ${prev.words}こ` : ''}`
                : `自己ベスト ${prev.words}こ`
            }</p>
            <div class="stats">
              <div class="stat"><span>打ったキー</span><b>${keys}</b></div>
              <div class="stat"><span>1秒に</span><b>${kps}<small>回</small></b></div>
              <div class="stat"><span>ミス</span><b>${miss}<small>回</small></b></div>
              <div class="stat"><span>正確さ</span><b>${acc}<small>%</small></b></div>
            </div>
            <p class="send-msg">ランキングに送っています…</p>
            <div class="buttons">
              <button class="btn primary" type="button" data-act="again">もう一回 <kbd>Enter</kbd></button>
              <button class="btn" type="button" data-act="title">タイトルへ</button>
            </div>
          </div>
          ${RANK_PANEL()}
        </div>
      </section>
    `;
    el.querySelector('[data-act="again"]').addEventListener('click', () => go(showSixty, { start: true }));
    el.querySelector('[data-act="title"]').addEventListener('click', () => go(showTitle));
    const msg = el.querySelector('.send-msg');
    (async () => {
      try {
        const r = await submitSixty(getProfile(), eq, { words: count, keys, miss });
        const list = await fillRank(el, () => alive);
        if (!alive) return;
        const i = list ? list.findIndex((x) => x.mine) : -1;
        msg.innerHTML =
          i >= 0
            ? `${r.saved ? 'ランキングに記録したよ！' : 'ランキングはこれまでの記録のまま。'} いま <b>${i + 1}位</b>（${list.length}人中）`
            : 'ランキングに記録したよ！';
      } catch {
        if (!alive) return;
        msg.textContent = 'つながらなかったので、ランキングには送れなかったよ（自己ベストはこの端末に残っています）';
        fillRank(el, () => alive);
      }
    })();
  }

  function onKey(e) {
    if (phase === 'result') {
      if (e.key === 'Enter') {
        e.preventDefault();
        go(showSixty, { start: true });
      } else if (e.key === 'Escape') go(showTitle);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      go(showSixty);
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') e.preventDefault(); // 術はないけれど、ページが動かないように
    const k = readTypingKey(e);
    if (!k) return;
    if (k.ime) {
      imeWarn.hidden = false;
      return;
    }
    imeWarn.hidden = true;
    if (phase !== 'typing') return;
    e.preventDefault();
    if (matcher.input(k.char)) {
      keys++;
      sfx.type();
      drawProgress(stage, word, matcher);
      spawnAt(eq.effect, stage.querySelector('.romaji .typed'));
      if (matcher.done) onClear();
    } else {
      miss++;
      missEl.textContent = miss;
      sfx.miss();
      shake(card);
      // のこり時間が0.5秒へる
      penalty += MISS_PENALTY_MS;
      const pill = $('.timer');
      pill.querySelector('.minus')?.remove();
      pill.insertAdjacentHTML('beforeend', `<span class="minus">-${MISS_PENALTY_MS / 1000}</span>`);
      leftEl.textContent = (leftMs() / 1000).toFixed(1);
      scheduleEnd();
    }
  }

  window.addEventListener('keydown', onKey);
  // 3・2・1 で はじまる
  for (let i = 0; i < 3; i++) {
    timers.later(() => {
      closeScroll(card, 3 - i, '60秒スタート');
      sfx.count();
    }, (i * READY_MS) / 3);
  }
  timers.later(start, READY_MS);

  return () => {
    alive = false;
    window.removeEventListener('keydown', onKey);
    cancelAnimationFrame(raf);
    clearTimeout(endTimer);
    timers.clear();
  };
}
