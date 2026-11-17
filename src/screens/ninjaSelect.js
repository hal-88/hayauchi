// 忍者えらび＋ニックネーム（本名は入れない）
import { NINJAS } from '../data/ninjas.js';
import { getProfile, getEquip, hasNinja, setProfile } from '../progress/save.js';
import { ninjaSvg } from '../ui/ninjaSvg.js';
import { esc } from '../ui/typing.js';
import { sfx } from '../audio/sfx.js';
import { showTitle } from './title.js';
import { showNinjutsuSelect } from './ninjutsuSelect.js';

const NAME_MAX = 8;

export function showNinjaSelect(el, go, { first = false } = {}) {
  const p = getProfile();
  const eq = getEquip();
  let sel = p?.ninja || NINJAS[0].id;

  el.innerHTML = `
    <section class="select panel-page">
      <h2>${first ? 'きみの忍者をえらぼう' : '忍者をえらぶ'}</h2>
      <div class="select-body">
        <div class="ninja-grid">
          ${NINJAS.map(
            (n) => `
            <button type="button" class="ninja-card ${hasNinja(n.id) ? '' : 'locked'}" data-id="${n.id}" style="--nc:${n.color}">
              ${ninjaSvg(n.id, { cls: `card-ninja ${hasNinja(n.id) ? '' : 'silhouette'}` })}
              <span class="nc-name">${hasNinja(n.id) ? esc(n.name) : '？？？'}</span>
              ${hasNinja(n.id) ? '' : `<span class="nc-lock">CPU Lv${n.unlockLevel}に勝つと仲間に</span>`}
            </button>`
          ).join('')}
        </div>
        <div class="detail panel">
          <div class="detail-art"></div>
          <div class="detail-name"></div>
          <div class="jutsu">
            <div class="jutsu-name"></div>
            <div class="jutsu-desc"></div>
          </div>
          <label class="name-field">
            <span>ニックネーム <small>（${NAME_MAX}文字まで）</small></span>
            <input type="text" maxlength="${NAME_MAX}" autocomplete="off" placeholder="例：はやて" value="${esc(p?.name || '')}" />
          </label>
          <p class="name-note">⚠ 本名（ほんとうの名前）は入れないでね</p>
          <div class="buttons">
            <button class="btn primary" type="button" data-act="ok">これで決定 <kbd>Enter</kbd></button>
            ${first ? '' : '<button class="btn" type="button" data-act="back">もどる <kbd>Esc</kbd></button>'}
          </div>
          <p class="err" hidden></p>
        </div>
      </div>
    </section>
  `;

  const input = el.querySelector('input');
  const okBtn = el.querySelector('[data-act="ok"]');
  const err = el.querySelector('.err');

  function draw() {
    const n = NINJAS.find((x) => x.id === sel);
    const owned = hasNinja(sel);
    el.querySelectorAll('.ninja-card').forEach((b) => b.classList.toggle('on', b.dataset.id === sel));
    el.querySelector('.detail-art').innerHTML = ninjaSvg(sel, {
      color: owned ? eq.color : 'base',
      costume: owned ? eq.costume : 'none',
      cls: `detail-ninja ${owned ? '' : 'silhouette'}`,
    });
    el.querySelector('.detail-name').textContent = owned ? n.name : '？？？の忍';
    el.querySelector('.jutsu-name').textContent = owned ? `【${n.jutsuInfo.name}】` : '【？？？の術】';
    el.querySelector('.jutsu-desc').textContent = owned ? n.jutsuInfo.desc : `CPU Lv${n.unlockLevel} にはじめて勝つと仲間になるよ`;
    okBtn.disabled = !owned;
    err.hidden = true;
  }

  function submit() {
    const name = input.value.trim().replace(/\s+/g, ' ');
    if (!hasNinja(sel)) return;
    if (!name) {
      err.textContent = 'ニックネームを入れてね';
      err.hidden = false;
      input.focus();
      return;
    }
    setProfile(name.slice(0, NAME_MAX), sel);
    sfx.finish();
    // はじめての人は、つぎに忍術を1つセットする
    if (first) go(showNinjutsuSelect, { first: true });
    else go(showTitle);
  }

  el.querySelectorAll('.ninja-card').forEach((b) =>
    b.addEventListener('click', () => {
      sel = b.dataset.id;
      sfx.click();
      draw();
    })
  );
  okBtn.addEventListener('click', submit);
  el.querySelector('[data-act="back"]')?.addEventListener('click', () => go(showTitle));

  const onKey = (e) => {
    if (e.isComposing || e.keyCode === 229) return; // 日本語入力の変換中の Enter は決定にしない
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape' && !first) {
      go(showTitle);
    }
  };
  window.addEventListener('keydown', onKey);
  draw();
  if (!p) input.focus();
  return () => window.removeEventListener('keydown', onKey);
}
