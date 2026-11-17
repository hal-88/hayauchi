// ごほうびの蔵：集めた見た目・音を見て、そうびする
import { REWARD_KINDS, REWARDS } from '../data/rewards.js';
import { NINJAS } from '../data/ninjas.js';
import { getProfile, getEquip, hasItem, hasNinja, equip, collectionCount } from '../progress/save.js';
import { ninjaSvg } from '../ui/ninjaSvg.js';
import { bgSvg } from '../ui/backgrounds.js';
import { spawnAt, spawnEffect } from '../ui/effects.js';
import { esc, readTypingKey } from '../ui/typing.js';
import { sfx } from '../audio/sfx.js';
import { showTitle } from './title.js';

const ICON = {
  sound: { pop: '♪', taiko: '🥁', suzu: '🔔', shuriken: '✦', mokkin: '🎵', hyoushigi: '🪵' },
  effect: { spark: '✨', shuriken: '✦', petal: '🌸', smoke: '💨', bolt: '⚡', star: '⭐' },
};

/** ごほうび1つの見本（小さい絵） */
export function itemThumb(kind, id, ninjaId) {
  const eq = getEquip();
  if (kind === 'color') return ninjaSvg(ninjaId, { color: id, costume: eq.costume, cls: 'thumb-ninja' });
  if (kind === 'costume') return ninjaSvg(ninjaId, { color: eq.color, costume: id, cls: 'thumb-ninja' });
  if (kind === 'bg') return `<div class="thumb-bg">${bgSvg(id)}</div>`;
  return `<div class="thumb-icon">${ICON[kind]?.[id] || '？'}</div>`;
}

export function showKura(el, go) {
  let tab = 'color';
  const p = getProfile();

  el.innerHTML = `
    <section class="kura panel-page">
      <h2>ごほうびの蔵 <small class="count"></small></h2>
      <div class="kura-body">
        <div class="kura-preview panel">
          <div class="kp-art"></div>
          <p class="kp-hint">ここでキーを打つと、音とエフェクトをためせるよ</p>
          <div class="kp-try"></div>
          <div class="kp-ninjas"></div>
        </div>
        <div class="kura-main">
          <div class="tabs">
            ${REWARD_KINDS.map((k) => `<button type="button" class="tab" data-kind="${k.kind}">${k.label}</button>`).join('')}
          </div>
          <div class="items"></div>
          <p class="note">ごほうびは CPU戦 で勝つと1つもらえます（Lv2〜5 にはじめて勝ったときは 忍者が仲間に）。見た目と音だけで、強さはかわりません。</p>
        </div>
      </div>
      <div class="buttons"><button class="btn" type="button" data-act="back">もどる <kbd>Esc</kbd></button></div>
    </section>
  `;

  const $ = (s) => el.querySelector(s);

  function drawPreview() {
    const eq = getEquip();
    $('.kp-art').innerHTML = `<div class="kp-bg">${bgSvg(eq.bg)}</div>${ninjaSvg(p.ninja, { color: eq.color, costume: eq.costume, cls: 'kp-ninja' })}`;
    const cc = collectionCount();
    $('.count').textContent = `${cc.have} / ${cc.total}`;
    $('.kp-ninjas').innerHTML =
      `<div class="kp-label">仲間の忍者 ${NINJAS.filter((n) => hasNinja(n.id)).length} / ${NINJAS.length}</div>` +
      `<div class="kp-row">${NINJAS.map((n) => ninjaSvg(n.id, { cls: `tiny ${hasNinja(n.id) ? '' : 'silhouette'}`, title: hasNinja(n.id) ? n.name : '？？？' })).join('')}</div>`;
  }

  function drawItems() {
    const eq = getEquip();
    el.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.kind === tab));
    $('.items').innerHTML = REWARDS[tab]
      .map((it) => {
        const owned = hasItem(tab, it.id);
        const on = eq[tab] === it.id;
        if (!owned) return `<div class="item locked"><div class="thumb-icon">？</div><span>まだ</span></div>`;
        return `<button type="button" class="item ${on ? 'on' : ''}" data-id="${it.id}">
          ${itemThumb(tab, it.id, p.ninja)}
          <span>${esc(it.name)}</span>
          ${on ? '<em>そうび中</em>' : ''}
        </button>`;
      })
      .join('');
    el.querySelectorAll('.item[data-id]').forEach((b) =>
      b.addEventListener('click', () => {
        equip(tab, b.dataset.id);
        if (tab === 'sound') sfx.preview(b.dataset.id);
        else sfx.click();
        if (tab === 'effect') {
          const r = b.getBoundingClientRect();
          for (let i = 0; i < 3; i++) setTimeout(() => spawnEffect(b.dataset.id, r.left + r.width / 2, r.top + 30), i * 120);
        }
        drawItems();
        drawPreview();
      })
    );
  }

  el.querySelectorAll('.tab').forEach((b) =>
    b.addEventListener('click', () => {
      tab = b.dataset.kind;
      drawItems();
    })
  );
  $('[data-act="back"]').addEventListener('click', () => go(showTitle));

  // ためし打ち
  let tried = '';
  const onKey = (e) => {
    if (e.key === 'Escape') return go(showTitle);
    const k = readTypingKey(e);
    if (!k?.char) return;
    e.preventDefault();
    tried = (tried + k.char.toLowerCase()).slice(-16);
    $('.kp-try').innerHTML = `<span>${esc(tried)}</span>`;
    sfx.type();
    spawnAt(getEquip().effect, $('.kp-try span'));
  };
  window.addEventListener('keydown', onKey);

  drawPreview();
  drawItems();
  return () => window.removeEventListener('keydown', onKey);
}
