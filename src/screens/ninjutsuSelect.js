// 忍術をセットする（試合前に1つ）
import { NINJUTSU, NINJUTSU_CATS, getNinjutsu, stars } from '../data/ninjutsu.js';
import { hasNinjutsu, getMyNinjutsu, setNinjutsu, ninjutsuCount, getScrolls } from '../progress/save.js';
import { ninjutsuSealHtml, ninjutsuTagsHtml, SCROLL_ICON } from '../ui/scrollUi.js';
import { esc } from '../ui/typing.js';
import { sfx } from '../audio/sfx.js';
import { showTitle } from './title.js';
import { showLearn } from './learn.js';

export function showNinjutsuSelect(el, go, { first = false } = {}) {
  let sel = getMyNinjutsu();
  const cc = ninjutsuCount();

  el.innerHTML = `
    <section class="nj-select panel-page" data-nav="own">
      <h2>${first ? '忍術を1つセットしよう' : '忍術をセットする'} <small class="count">覚えた忍術 ${cc.have} / ${cc.total}</small></h2>
      <div class="nj-body">
        <div class="nj-cols">
          ${NINJUTSU_CATS.map(
            (c) => `
            <div class="nj-col">
              <div class="nj-col-head" style="--nc:${c.color}">${c.label}</div>
              ${NINJUTSU.filter((j) => j.cat === c.id)
                .map(
                  (j) => `<button type="button" class="nj-item ${hasNinjutsu(j.id) ? '' : 'locked'}" data-id="${j.id}">
                    ${hasNinjutsu(j.id) ? ninjutsuSealHtml(j) : '<span class="nj-seal unknown">？</span>'}
                    <span class="nj-name">${hasNinjutsu(j.id) ? esc(j.name) : '？？？'}</span>
                    <span class="nj-st">${stars(j.rank)}</span>
                  </button>`
                )
                .join('')}
            </div>`
          ).join('')}
        </div>
        <div class="nj-detail panel"></div>
      </div>
      <p class="keys-hint"><kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> で忍術をえらぶ ・ <kbd>Enter</kbd> でセット</p>
      <div class="buttons">
        <button class="btn primary" type="button" data-act="ok">これをセット <kbd>Enter</kbd></button>
        <button class="btn" type="button" data-act="learn"><kbd>6</kbd> ${SCROLL_ICON} 忍術を覚える <small>巻物${getScrolls()}本</small></button>
        ${first ? '' : '<button class="btn" type="button" data-act="back">もどる <kbd>Esc</kbd></button>'}
      </div>
    </section>
  `;
  const $ = (s) => el.querySelector(s);

  function draw() {
    const j = getNinjutsu(sel);
    const owned = hasNinjutsu(sel);
    el.querySelectorAll('.nj-item').forEach((b) => {
      b.classList.toggle('on', b.dataset.id === sel);
      b.classList.toggle('set', b.dataset.id === getMyNinjutsu());
    });
    $('.nj-detail').innerHTML = owned
      ? `${ninjutsuSealHtml(j, 'big')}
         <div class="nj-d-name">${esc(j.name)}</div>
         ${ninjutsuTagsHtml(j)}
         <p class="nj-d-desc">${esc(j.desc)}</p>
         ${sel === getMyNinjutsu() ? '<p class="nj-d-set">いまセット中</p>' : ''}`
      : `<span class="nj-seal big unknown">？</span>
         <div class="nj-d-name">？？？</div>
         <span class="nj-tags"><span class="nj-stars">${stars(j.rank)}</span></span>
         <p class="nj-d-desc">「忍術を覚える」で手に入るよ</p>`;
    $('[data-act="ok"]').disabled = !owned;
  }

  function ok() {
    if (!hasNinjutsu(sel)) return;
    setNinjutsu(sel);
    sfx.finish();
    go(showTitle);
  }

  el.querySelectorAll('.nj-item').forEach((b) =>
    b.addEventListener('click', () => {
      sel = b.dataset.id;
      sfx.click();
      draw();
    })
  );
  $('[data-act="ok"]').addEventListener('click', ok);
  $('[data-act="learn"]').addEventListener('click', () => go(showLearn));
  $('[data-act="back"]')?.addEventListener('click', () => go(showTitle));
  // 十字キー：↑↓ で同じ列の中、←→ でとなりの列（攻め・守り・じゃま・特殊）
  const cols = NINJUTSU_CATS.map((c) => NINJUTSU.filter((j) => j.cat === c.id).map((j) => j.id));
  function move(key) {
    const ci = cols.findIndex((col) => col.includes(sel));
    const ri = cols[ci].indexOf(sel);
    let nc = ci;
    let nr = ri;
    if (key === 'ArrowUp') nr = Math.max(0, ri - 1);
    if (key === 'ArrowDown') nr = Math.min(cols[ci].length - 1, ri + 1);
    if (key === 'ArrowLeft') nc = Math.max(0, ci - 1);
    if (key === 'ArrowRight') nc = Math.min(cols.length - 1, ci + 1);
    nr = Math.min(nr, cols[nc].length - 1);
    const next = cols[nc][nr];
    if (next === sel) return;
    sel = next;
    sfx.click();
    draw();
  }
  const onKey = (e) => {
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      move(e.key);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      ok();
    } else if (e.key === '6') go(showLearn);
    else if (e.key === 'Escape' && !first) go(showTitle);
  };
  window.addEventListener('keydown', onKey);
  draw();
  return () => window.removeEventListener('keydown', onKey);
}
