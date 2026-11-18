// 忍術を覚える（ガチャ）：巻物5本で1回。10連は巻物50本で10回（★★以上が1つ確定）。
// レア度の色の巻物が回転しながら飛んできて → 光って → はじけて巻物が開き、術の名前と★が出てくる
import { SCROLL_RULES, getNinjutsu, rankName, stars } from '../data/ninjutsu.js';
import { getScrolls, learnNinjutsu, learnNinjutsu10, setNinjutsu, ninjutsuCount } from '../progress/save.js';
import { ninjutsuSealHtml, ninjutsuTagsHtml, SCROLL_ICON } from '../ui/scrollUi.js';
import { SCROLL_HTML, esc, timerBag } from '../ui/typing.js';
import { sfx } from '../audio/sfx.js';
import { showTitle } from './title.js';
import { showNinjutsuSelect } from './ninjutsuSelect.js';

const FLY_MS = 900; // 飛んでくる
const GLOW_MS = [0, 700, 900, 1300]; // 光っている時間（レア度ごと。★★★は長め）
const BURST_MS = 300; // はじける
const STEP_MS = 140; // 10連：1つずつ出てくる間

/**
 * 半分ひらいた巻物（オリジナルのSVG）。少しななめに傾いていて、
 * 切り口が見えるのは手前（下）のはしだけ。上のはしは軸先が奥からのぞく。
 * 布の色はレア度で変わる（rank 0＝まだ引いていないときの緑）
 */
const ROLLED_SVG = `
  <svg class="rl-svg" viewBox="0 0 260 230" aria-hidden="true">
    <g transform="rotate(-20 130 115)">
      <!-- 上の軸先（筒の奥からのぞく） -->
      <rect class="sv-knob" x="64" y="10" width="24" height="22" rx="8"/>
      <!-- 広げた紙：布のふち＋紙 -->
      <path class="sv-fab-d" d="M96 34 H212 Q226 36 228 50 L232 172 Q232 186 218 188 H96 Z"/>
      <path class="sv-fab" d="M96 30 H208 Q222 32 224 46 L228 168 Q228 182 214 184 H96 Z"/>
      <path class="sv-paper" d="M112 46 H204 Q210 46 210 52 L213 164 Q213 170 207 170 H112 Z"/>
      <rect x="112" y="46" width="16" height="124" fill="#000" opacity="0.08"/>
      <!-- 筆の字 -->
      <path class="sv-ink" d="M192 60 q-7 9 0 17 t0 17 t0 16"/>
      <path class="sv-ink" d="M192 128 q-6 8 0 15"/>
      <path class="sv-ink" d="M170 64 q-6 8 0 15 t0 15"/>
      <path class="sv-ink" d="M170 116 q-6 9 0 17 t0 17"/>
      <path class="sv-ink" d="M148 70 q-6 9 0 17 t0 17 t0 15"/>
      <!-- 巻いてある筒 -->
      <path class="sv-fab" d="M44 44 Q44 26 76 26 Q108 26 108 44 V176 H44 Z"/>
      <rect class="sv-fab-l" x="54" y="34" width="12" height="138" rx="6" opacity="0.55"/>
      <rect class="sv-fab-d" x="92" y="36" width="12" height="138" rx="6" opacity="0.5"/>
      <!-- 手前の切り口：外の布、うずまきの紙 -->
      <ellipse class="sv-fab-l" cx="76" cy="176" rx="32" ry="13"/>
      <ellipse class="sv-paper" cx="76" cy="176" rx="25" ry="9.5"/>
      <ellipse class="sv-ring" cx="76" cy="176" rx="19" ry="7"/>
      <ellipse class="sv-ring" cx="76" cy="176" rx="13" ry="4.8"/>
      <!-- 手前の軸先 -->
      <rect class="sv-knob" x="66" y="172" width="20" height="20" rx="5"/>
      <ellipse class="sv-knob-end" cx="76" cy="192" rx="10" ry="4.5"/>
    </g>
  </svg>`;

function rolledHtml(rank, cls = '') {
  return `<div class="rolled r${rank} ${cls}">
    ${rank === 3 ? '<span class="rl-rays"></span>' : ''}
    ${ROLLED_SVG}
  </div>`;
}

export function showLearn(el, go) {
  el.innerHTML = `
    <section class="learn panel-page">
      <h2>忍術を覚える</h2>
      <p class="sub">巻物${SCROLL_RULES.learnCost}本で1回。★ 60%・★★ 30%・★★★ 10%。覚えていた術が出たら巻物${SCROLL_RULES.dupRefund}本もどるよ。10連は★★以上が1つ確定！</p>
      <div class="learn-top">
        <div class="have">${SCROLL_ICON}<b class="n-scrolls"></b><span>本</span></div>
        <div class="have nj">覚えた忍術 <b class="n-nj"></b></div>
      </div>
      <div class="learn-stage">
        ${SCROLL_HTML}
        <div class="fly-layer"></div>
        <div class="learn10" hidden></div>
      </div>
      <p class="learn-msg"></p>
      <div class="buttons">
        <button class="btn primary big" type="button" data-act="learn">巻物${SCROLL_RULES.learnCost}本で1回 <kbd>Enter</kbd></button>
        <button class="btn big ten-btn" type="button" data-act="learn10">10連 巻物${SCROLL_RULES.learn10Cost}本 <kbd>0</kbd></button>
        <button class="btn" type="button" data-act="nj" hidden>忍術をえらぶ</button>
        <button class="btn" type="button" data-act="set" hidden>この忍術をセット</button>
        <button class="btn" type="button" data-act="back">もどる <kbd>Esc</kbd></button>
      </div>
    </section>
  `;
  const $ = (s) => el.querySelector(s);
  const card = $('.card');
  const stage = $('.stage');
  const fly = $('.fly-layer');
  const ten = $('.learn10');
  const timers = timerBag();
  let busy = false;
  let last = null;

  // まだ引いていないとき：ふつうの色の巻物がふわふわ浮かんでいる
  card.classList.add('veiled');
  fly.innerHTML = rolledHtml(0, 'idle');

  function drawCounts() {
    const s = getScrolls();
    $('.n-scrolls').textContent = s;
    const cc = ninjutsuCount();
    $('.n-nj').textContent = `${cc.have} / ${cc.total}`;
    $('[data-act="learn"]').disabled = s < SCROLL_RULES.learnCost || busy;
    $('[data-act="learn10"]').disabled = s < SCROLL_RULES.learn10Cost || busy;
    if (!busy && s < SCROLL_RULES.learnCost && !last) {
      $('.learn-msg').textContent = `巻物が足りないよ（あと${SCROLL_RULES.learnCost - s}本）。CPU戦やみんなで対戦でもらえるよ`;
    }
  }

  function learn() {
    if (busy || getScrolls() < SCROLL_RULES.learnCost) return;
    const r = learnNinjutsu();
    if (!r) return;
    busy = true;
    last = r;
    const j = getNinjutsu(r.id);
    $('[data-act="set"]').hidden = true;
    $('[data-act="nj"]').hidden = true;
    $('.learn-msg').textContent = '';
    ten.hidden = true;
    drawCounts();

    // 前の結果をしまう
    card.classList.add('veiled', 'closed');
    card.classList.remove('rank-1', 'rank-2', 'rank-3');
    stage.innerHTML = '';

    // 1) 回転しながら飛んでくる
    fly.innerHTML = rolledHtml(r.rank, 'fly');
    sfx.scroll();
    // 2) 光る
    timers.later(() => {
      fly.querySelector('.rolled')?.classList.add('glow');
      sfx.count();
      timers.later(() => sfx.count(), GLOW_MS[r.rank] / 2);
      if (r.rank === 3) timers.later(() => sfx.reward(), 200);
    }, FLY_MS);
    // 3) はじけて、巻物が開く
    timers.later(() => {
      fly.querySelector('.rolled')?.classList.add('burst');
      fly.insertAdjacentHTML('beforeend', `<div class="learn-flash r${r.rank}"></div>`);
      stage.innerHTML = `
        <div class="learn-result">
          ${ninjutsuSealHtml(j, 'big')}
          <div class="lr-stars r${r.rank}">${stars(r.rank)} <small>${rankName(r.rank)}</small></div>
          <div class="lr-name">${esc(j.name)}</div>
          ${ninjutsuTagsHtml(j)}
          <div class="lr-desc">${esc(j.desc)}</div>
        </div>
        <div class="clear-badge ${r.dup ? 'lose' : ''}">${r.dup ? `覚えていた… 巻物${SCROLL_RULES.dupRefund}本もどった` : '新しく覚えた！'}</div>`;
      card.classList.add(`rank-${r.rank}`);
      card.classList.remove('veiled');
      timers.later(() => card.classList.remove('closed'), 40); // 閉じた巻物がいったん見えてから開く
      sfx.scroll();
      if (!r.dup) {
        r.rank === 3 ? sfx.reward() : sfx.finish();
        $('[data-act="set"]').hidden = false;
      } else {
        sfx.clear();
      }
      timers.later(() => {
        fly.innerHTML = '';
        busy = false;
        drawCounts();
      }, BURST_MS + 200);
    }, FLY_MS + GLOW_MS[r.rank]);
  }

  // ---------- 10連 ----------
  function learn10() {
    if (busy || getScrolls() < SCROLL_RULES.learn10Cost) return;
    const list = learnNinjutsu10();
    if (!list) return;
    busy = true;
    last = null;
    const top = Math.max(...list.map((r) => r.rank));
    $('[data-act="set"]').hidden = true;
    $('[data-act="nj"]').hidden = true;
    $('.learn-msg').textContent = '';
    drawCounts();
    card.classList.add('veiled', 'closed');
    card.classList.remove('rank-1', 'rank-2', 'rank-3');
    stage.innerHTML = '';
    ten.hidden = true;
    ten.innerHTML = '';

    // いちばんよいレア度の色の巻物が飛んできて → 光って → はじける
    fly.innerHTML = rolledHtml(top, 'fly');
    sfx.scroll();
    timers.later(() => {
      fly.querySelector('.rolled')?.classList.add('glow');
      sfx.count();
      timers.later(() => sfx.count(), GLOW_MS[top] / 2);
      if (top === 3) timers.later(() => sfx.reward(), 200);
    }, FLY_MS);
    timers.later(() => {
      fly.querySelector('.rolled')?.classList.add('burst');
      fly.insertAdjacentHTML('beforeend', `<div class="learn-flash r${top}"></div>`);
      // 10こ並べて、ひとつずつ出す
      ten.innerHTML = list
        .map((r, i) => {
          const j = getNinjutsu(r.id);
          return `<div class="t10 r${r.rank} ${r.dup ? 'dup' : 'new'}" style="--d:${i * STEP_MS}ms">
            ${ninjutsuSealHtml(j)}
            <span class="t10-st">${stars(r.rank)}</span>
            <b>${esc(j.name)}</b>
            <em>${r.dup ? `+${SCROLL_RULES.dupRefund}本` : 'NEW!'}</em>
          </div>`;
        })
        .join('');
      ten.hidden = false;
      list.forEach((r, i) => timers.later(() => (r.rank === 3 ? sfx.reward() : r.dup ? sfx.type() : sfx.count()), i * STEP_MS));
      timers.later(() => {
        fly.innerHTML = '';
        const nNew = list.filter((r) => !r.dup).length;
        const nDup = list.length - nNew;
        $('.learn-msg').textContent = `新しく覚えた：${nNew}こ ／ 覚えていた：${nDup}こ${nDup ? `（巻物${nDup * SCROLL_RULES.dupRefund}本もどった）` : ''}`;
        if (nNew) $('[data-act="nj"]').hidden = false;
        nNew ? sfx.finish() : sfx.clear();
        busy = false;
        drawCounts();
      }, list.length * STEP_MS + 300);
    }, FLY_MS + GLOW_MS[top]);
  }

  $('[data-act="learn"]').addEventListener('click', learn);
  $('[data-act="learn10"]').addEventListener('click', learn10);
  $('[data-act="nj"]').addEventListener('click', () => go(showNinjutsuSelect));
  $('[data-act="set"]').addEventListener('click', () => {
    if (!last) return;
    setNinjutsu(last.id);
    sfx.click();
    go(showNinjutsuSelect);
  });
  $('[data-act="back"]').addEventListener('click', () => go(showTitle));
  const onKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      learn();
    } else if (e.key === '0') {
      e.preventDefault();
      learn10();
    } else if (e.key === 'Escape') go(showTitle);
  };
  window.addEventListener('keydown', onKey);
  drawCounts();
  return () => {
    window.removeEventListener('keydown', onKey);
    timers.clear();
  };
}
