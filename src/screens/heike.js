// 平家物語チャレンジ：「祇園精舎の鐘の声…」から「ひとえに風の前の塵に同じ」までを何秒で打ち切れるか。術はなし。
// まちがえると +0.5秒。巻物を巻きとるように、打ったところが左へ流れていく。
// 記録はクラスのランキング（Firebase の ranking/heike）と、この端末の自己ベスト
// 2026-11-28 ゆぐ：平家物語チャレンジを平家物語チャレンジに置きかえた
import { RomajiMatcher } from '../logic/romaji.js';
import { HEIKE } from '../data/heike.js';
import { sfx } from '../audio/sfx.js';
import { awardHeike, getEquip, getProfile, getSave, recordHeike, grantNinjutsu, hasNinjutsu, setNinjutsu } from '../progress/save.js';
import { getNinjutsu } from '../data/ninjutsu.js';
import { ninjutsuSealHtml } from '../ui/scrollUi.js';
import { scrollGainHtml } from '../ui/scrollUi.js';
import { loadHeike, submitHeike } from '../online/ranking.js';
import { spawnAt } from '../ui/effects.js';
import { shareButtonHtml, setupShare, closeSharePanel } from '../ui/share.js';
import { rankHtml, RANK_PANEL } from './sixty.js';
import { showTitle } from './title.js';
import { esc, readTypingKey, IME_WARN_HTML, SCROLL_HTML, closeScroll, openScroll, shake, setupShake, timerBag } from '../ui/typing.js';

export const HEIKE_MISS_MS = 500; // まちがえると +0.5秒
export const BIWA_MS = 60000; // これより速く打ち切ると、琵琶法師から【盛者必衰の術】を授かる
const BIWA_NJ = 'jousha';
const READY_MS = 3000; // はじまる前の 3・2・1
const ANCHOR = 0.36; // 次に打つ文字を、紙の左から この割合の所に置く

const FULL = HEIKE.map((p) => p.kana).join('');
const STARTS = HEIKE.reduce((a, p) => [...a, a[a.length - 1] + p.kana.length], [0]); // 区切りの始まり（読みの何文字目）。最後は全体の長さ
const TAIL = STARTS.map((s) => new RomajiMatcher(FULL.slice(s)).rest); // その区切りから最後までの お手本
const MODEL = HEIKE.map((_, i) => TAIL[i].slice(0, TAIL[i].length - TAIL[i + 1].length)); // 区切りごとのお手本

const sec = (ms) => (ms / 1000).toFixed(2);
const timeHtml = (r) => `${sec(r.ms)}<small>秒</small>`;

async function fillRank(el, alive) {
  const body = el.querySelector('.rank-body');
  try {
    const list = await loadHeike(getProfile().name);
    if (alive()) body.innerHTML = rankHtml(list, timeHtml);
    return list;
  } catch (e) {
    if (alive()) body.innerHTML = `<p class="rank-empty">ランキングを読めなかったよ（${esc(e.message || e)}）</p>`;
    return null;
  }
}

/** はじめの画面：ルール・自己ベスト・ランキング。start: true なら すぐ はじめる（もう一回） */
export function showHeike(el, go, { start = false } = {}) {
  if (start) return playHeike(el, go);
  let alive = true;
  const b = getSave().heike.best;
  el.innerHTML = `
    <section class="sixty heike panel-page">
      <h2>平家物語チャレンジ</h2>
      <div class="sixty-body">
        <div class="sixty-left panel">
          <p class="sixty-lead">「祇園精舎の鐘の声、諸行無常の響きあり…」<br />「ひとえに風の前の塵に同じ」まで、何秒で打てるかな？</p>
          <ul class="sixty-rules">
            <li>巻物を巻きとるように、打ったところが左へ流れていく</li>
            <li>まちがえると、タイムに +0.5秒</li>
            <li>術は使えないよ。打つ速さだけで勝負！</li>
            <li>結果は クラスのランキングに 登録されるよ</li>
            <li>巻物：打ち切ったら2本、自己ベストで さらに2本</li>
            <li class="biwa-rule">${hasNinjutsu(BIWA_NJ) ? '🎶 琵琶法師から【盛者必衰の術】を授かった！' : '🎶 60秒を切ると、琵琶法師から ひみつの忍術を授かる…'}</li>
          </ul>
          <div class="my-best"><span>自己ベスト</span><b>${b ? timeHtml(b) : '<small>まだなし</small>'}</b></div>
          <div class="buttons">
            <button class="btn primary big" type="button" data-act="start">スタート <kbd>Enter</kbd></button>
            <button class="btn" type="button" data-act="back">もどる <kbd>Esc</kbd></button>
          </div>
        </div>
        ${RANK_PANEL()}
      </div>
    </section>
  `;
  el.querySelector('[data-act="start"]').addEventListener('click', () => go(playHeike));
  el.querySelector('[data-act="back"]').addEventListener('click', () => go(showTitle));
  const onKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      go(playHeike);
    } else if (e.key === 'Escape') go(showTitle);
  };
  window.addEventListener('keydown', onKey);
  fillRank(el, () => alive);
  return () => {
    alive = false;
    window.removeEventListener('keydown', onKey);
  };
}

/** 平家物語のプレイ */
function playHeike(el, go) {
  el.innerHTML = `
    <section class="play heike-play" data-nav="off">
      <div class="status">
        <div class="pill timer">タイム <b class="time">0.00</b> 秒</div>
        <div class="pill">ミス <b class="miss">0</b><small class="plus-note">（+0.5秒ずつ）</small></div>
        <div class="pill">のこり <b class="rest-n">${HEIKE.length}</b> かたまり</div>
      </div>
      ${SCROLL_HTML}
      <div class="jg-bar"><i></i></div>
      ${IME_WARN_HTML}
      <div class="play-foot"><button class="btn small" type="button" data-act="quit">やめる</button></div>
    </section>
  `;
  const $ = (s) => el.querySelector(s);
  const card = $('.card');
  const stage = $('.stage');
  const timeEl = $('.time');
  const missEl = $('.miss');
  const restEl = $('.rest-n');
  const bar = $('.jg-bar i');
  const imeWarn = $('.ime-warn');
  setupShake(card);
  $('[data-act="quit"]').addEventListener('click', () => go(showHeike));

  const eq = getEquip();
  const matcher = new RomajiMatcher(FULL);
  const split = [0]; // 区切りごとに、打ったローマ字の何文字目から始まったか
  let cur = 0; // いま打っている区切り
  let phase = 'ready'; // ready | typing | result
  let t0 = 0;
  let keys = 0;
  let miss = 0;
  let totalMs = 0;
  let raf = 0;
  let alive = true;
  const timers = timerBag();

  stage.innerHTML = '<div class="jg-track"></div>';
  const track = stage.querySelector('.jg-track');

  /** 区切りを並べて描く（打ったところ・いまの区切り・これから） */
  function draw() {
    const rest = matcher.rest;
    const nextTail = TAIL[cur + 1] || '';
    const curRest = rest.slice(0, Math.max(0, rest.length - nextTail.length));
    // 区切りの最後の「ん」を n 1回だけ打ったところ：この区切りは打ち終わりとして、次の区切りの1文字目を光らせる
    const pend = !matcher.done && curRest === '';
    track.innerHTML = HEIKE.map(({ text, kana }, i) => {
      const kj = `<div class="kj">${esc(text)}</div>`; // 漢字まじりの文
      if (i < cur) {
        return `<div class="jg-p done">${kj}<div class="k">${esc(kana)}</div><div class="r">${esc(matcher.typed.slice(split[i], split[i + 1]))}</div></div>`;
      }
      if (i === cur) {
        const kd = pend ? kana.length : matcher.pos - STARTS[i];
        const typed = matcher.typed.slice(split[i]);
        return `<div class="jg-p cur">${kj}<div class="k"><span class="d">${esc(kana.slice(0, kd))}</span>${esc(kana.slice(kd))}</div><div class="r"><span class="t">${esc(typed)}</span><span class="next">${esc(curRest[0] || '')}</span>${esc(curRest.slice(1))}</div></div>`;
      }
      if (pend && i === cur + 1) {
        return `<div class="jg-p">${kj}<div class="k">${esc(kana)}</div><div class="r"><span class="next">${esc(MODEL[i][0])}</span>${esc(MODEL[i].slice(1))}</div></div>`;
      }
      return `<div class="jg-p">${kj}<div class="k">${esc(kana)}</div><div class="r">${esc(MODEL[i])}</div></div>`;
    }).join('');
    place();
    const p = matcher.pos / FULL.length;
    card.style.setProperty('--p', p.toFixed(3));
    bar.style.width = `${(p * 100).toFixed(1)}%`;
    restEl.textContent = HEIKE.length - cur - (matcher.done ? 1 : 0);
  }

  /** 次に打つ文字が、紙の左から36%の所にくるように流す */
  function place() {
    const next = track.querySelector('.next:not(:empty)') || track.querySelector('.cur .next') || track.querySelector('.cur .r');
    if (!next) return;
    const tr = track.getBoundingClientRect();
    const x = next.getBoundingClientRect().left - tr.left; // 流す前の位置（transform は両方にかかるので差でよい）
    track.style.transform = `translateX(${(stage.clientWidth * ANCHOR - x).toFixed(1)}px)`;
  }

  /** 区切りをこえたか（「ん」を n 1回で打つと、次の区切りの1文字目と一度に進むことがある） */
  function advance() {
    while (cur < HEIKE.length - 1 && matcher.pos >= STARTS[cur + 1]) {
      cur++;
      split[cur] = matcher.typed.length - matcher.buf.length; // いまの区切りで打ち始めた所
      sfx.click();
    }
  }

  const nowMs = () => performance.now() - t0 + miss * HEIKE_MISS_MS;

  function tick() {
    if (phase !== 'typing') return;
    timeEl.textContent = sec(nowMs());
    raf = requestAnimationFrame(tick);
  }

  function start() {
    phase = 'typing';
    openScroll(card);
    sfx.scroll();
    draw();
    t0 = performance.now();
    tick();
  }

  function finish() {
    phase = 'result';
    totalMs = Math.round(nowMs());
    cancelAnimationFrame(raf);
    timeEl.textContent = sec(totalMs);
    split[HEIKE.length] = matcher.typed.length;
    cur = HEIKE.length; // ぜんぶ打ち終わり
    sfx.finish();
    timers.later(showResult, 900); // 巻き終わったところを少し見せる
  }

  let shareFn = null;
  function showResult() {
    const prev = getSave().heike.best;
    const isBest = recordHeike(totalMs, miss);
    const scrolls = awardHeike(isBest);
    const gotBiwa = totalMs < BIWA_MS && grantNinjutsu(BIWA_NJ); // 60秒を切ったら、はじめての1回だけ授かる
    const biwa = getNinjutsu(BIWA_NJ);
    const acc = keys + miss ? Math.round((keys / (keys + miss)) * 100) : 100;
    const rawMs = totalMs - miss * HEIKE_MISS_MS;
    const kps = (keys / Math.max(1, rawMs / 1000)).toFixed(1);
    el.innerHTML = `
      <section class="sixty heike panel-page result">
        <div class="sixty-body">
          <div class="sixty-left panel">
            <h2>平家物語の冒頭を 打ち切った！</h2>
            <div class="sixty-score"><b>${sec(totalMs)}</b><small>秒</small></div>
            <p class="best-line">${
              isBest
                ? `<b class="new-best">自己ベスト更新！</b>${prev ? ` これまで ${sec(prev.ms)}秒` : ''}`
                : `自己ベスト ${sec(prev.ms)}秒`
            }</p>
            ${scrollGainHtml(scrolls)}
            ${
              gotBiwa
                ? `<div class="biwa-gift">${ninjutsuSealHtml(biwa)}<div><b>🎶 琵琶法師から【${esc(biwa.name)}】を授かった！</b><small>${esc(biwa.desc)}</small></div><button class="btn small" type="button" data-act="set-biwa">セットする</button></div>`
                : ''
            }
            <div class="stats">
              <div class="stat"><span>打ったタイム</span><b>${sec(rawMs)}<small>秒</small></b></div>
              <div class="stat"><span>ミス（+0.5秒）</span><b>${miss}<small>回</small></b></div>
              <div class="stat"><span>1秒に</span><b>${kps}<small>回</small></b></div>
              <div class="stat"><span>正確さ</span><b>${acc}<small>%</small></b></div>
            </div>
            <p class="send-msg">ランキングに送っています…</p>
          </div>
          ${RANK_PANEL()}
        </div>
        <div class="buttons result-foot">
          <button class="btn primary" type="button" data-act="again">もう一回 <kbd>Enter</kbd></button>
          ${shareButtonHtml()}
          <button class="btn" type="button" data-act="title">タイトルへ</button>
        </div>
      </section>
    `;
    el.querySelector('[data-act="again"]').addEventListener('click', () => go(showHeike, { start: true }));
    el.querySelector('[data-act="title"]').addEventListener('click', () => go(showTitle));
    el.querySelector('[data-act="set-biwa"]')?.addEventListener('click', (e) => {
      setNinjutsu(BIWA_NJ);
      sfx.finish();
      e.currentTarget.textContent = 'セットした！';
      e.currentTarget.disabled = true;
    });
    const p = getProfile();
    shareFn = setupShare(
      el,
      {
        mode: '平家物語チャレンジ',
        headline: `${sec(totalMs)}秒`,
        sub: isBest ? '自己ベスト更新！' : '冒頭を最後まで打ち切った！',
        lines: [`ミス${miss}回（+${(miss * HEIKE_MISS_MS) / 1000}秒）・1秒に${kps}回・正確さ ${acc}%`],
        name: p.name,
        ninja: p.ninja,
        color: eq.color,
        costume: eq.costume,
      },
      `はやうち忍者の 平家物語チャレンジを ${sec(totalMs)}秒で 打ち切った！${isBest ? '（自己ベスト）' : ''}`
    );
    const msg = el.querySelector('.send-msg');
    (async () => {
      try {
        const r = await submitHeike(getProfile(), eq, { ms: totalMs, miss });
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
      if (!el.querySelector('.result')) return; // 巻き終わりを見せている間
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        shareFn?.();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        go(showHeike, { start: true });
      } else if (e.key === 'Escape') go(showTitle);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      go(showHeike);
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') e.preventDefault();
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
      advance();
      if (matcher.done) {
        draw();
        finish();
        return;
      }
      draw();
      spawnAt(eq.effect, track.querySelector('.cur .r .t'));
    } else {
      miss++;
      missEl.textContent = miss;
      sfx.miss();
      shake(card);
      const pill = $('.timer');
      pill.querySelector('.minus')?.remove();
      pill.insertAdjacentHTML('beforeend', `<span class="minus">+${HEIKE_MISS_MS / 1000}</span>`);
      timeEl.textContent = sec(nowMs());
    }
  }

  const onResize = () => phase !== 'result' && place();
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  draw(); // 巻物の中に、はじめの所を用意しておく
  for (let i = 0; i < 3; i++) {
    timers.later(() => {
      closeScroll(card, 3 - i, '平家物語スタート');
      stage.appendChild(track); // closeScroll が中を消すので、もどす
      sfx.count();
    }, (i * READY_MS) / 3);
  }
  timers.later(start, READY_MS);

  return () => {
    alive = false;
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    closeSharePanel();
    cancelAnimationFrame(raf);
    timers.clear();
  };
}
