// 忍術を覚える（ガチャ）：巻物5本で1回。
// レア度の色の巻物が回転しながら飛んできて → 光って → はじけて巻物が開き、術の名前と★が出てくる
import { SCROLL_RULES, getNinjutsu, rankName, stars } from '../data/ninjutsu.js';
import { getScrolls, learnNinjutsu, setNinjutsu, ninjutsuCount } from '../progress/save.js';
import { ninjutsuSealHtml, ninjutsuTagsHtml, SCROLL_ICON } from '../ui/scrollUi.js';
import { SCROLL_HTML, esc, timerBag } from '../ui/typing.js';
import { sfx } from '../audio/sfx.js';
import { showTitle } from './title.js';
import { showNinjutsuSelect } from './ninjutsuSelect.js';

const FLY_MS = 900; // 飛んでくる
const GLOW_MS = [0, 700, 900, 1300]; // 光っている時間（レア度ごと。★★★は長め）
const BURST_MS = 300; // はじける

/** 巻いた巻物（横から見た形）。rank 0＝ふつうの色（まだ引いていないとき） */
function rolledHtml(rank, cls = '') {
  return `<div class="rolled r${rank} ${cls}">
    ${rank === 3 ? '<span class="rl-rays"></span>' : ''}
    <span class="rl-knob l"></span><span class="rl-body"><span class="rl-gloss"></span><span class="rl-band"></span><span class="rl-cap l"></span><span class="rl-cap r"></span></span><span class="rl-knob r"></span>
  </div>`;
}

export function showLearn(el, go) {
  el.innerHTML = `
    <section class="learn panel-page">
      <h2>忍術を覚える</h2>
      <p class="sub">巻物${SCROLL_RULES.learnCost}本で1回。★ 60%・★★ 30%・★★★ 10%。覚えていた術が出たら巻物${SCROLL_RULES.dupRefund}本もどるよ</p>
      <div class="learn-top">
        <div class="have">${SCROLL_ICON}<b class="n-scrolls"></b><span>本</span></div>
        <div class="have nj">覚えた忍術 <b class="n-nj"></b></div>
      </div>
      <div class="learn-stage">
        ${SCROLL_HTML}
        <div class="fly-layer"></div>
      </div>
      <p class="learn-msg"></p>
      <div class="buttons">
        <button class="btn primary big" type="button" data-act="learn">巻物${SCROLL_RULES.learnCost}本で覚える <kbd>Enter</kbd></button>
        <button class="btn" type="button" data-act="set" hidden>この忍術をセット</button>
        <button class="btn" type="button" data-act="back">もどる <kbd>Esc</kbd></button>
      </div>
    </section>
  `;
  const $ = (s) => el.querySelector(s);
  const card = $('.card');
  const stage = $('.stage');
  const fly = $('.fly-layer');
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
    $('.learn-msg').textContent = '';
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

  $('[data-act="learn"]').addEventListener('click', learn);
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
    } else if (e.key === 'Escape') go(showTitle);
  };
  window.addEventListener('keydown', onKey);
  drawCounts();
  return () => {
    window.removeEventListener('keydown', onKey);
    timers.clear();
  };
}
