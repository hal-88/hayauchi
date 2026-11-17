// 忍者の術の見た目（CPU戦・みんなで対戦で共通）
import { getNinja } from '../data/ninjas.js';
import { esc } from './typing.js';

/** 術のアイコン（使ったらグレー） */
export function jutsuChipHtml(ninjaId, used) {
  const n = getNinja(ninjaId);
  return `<span class="jchip ${used ? 'used' : ''}" style="--jc:${n.color}" title="${esc(n.jutsuInfo.name)}">術</span>`;
}

/** 「◯◯が【術】を使った！」を巻物の上に出す。after＝うしろにつける一言（運試しの結果など） */
export function showJutsuBanner(card, who, jutsuName, mine = false, after = '') {
  const el = document.createElement('div');
  el.className = `jutsu-banner ${mine ? 'mine' : ''}`;
  el.innerHTML = `<b>${esc(who)}</b>が<span>【${esc(jutsuName)}】</span>を使った！${after ? ` <em>${esc(after)}</em>` : ''}`;
  // 同じ問題で何人も使ったら、下にずらして重ならないようにする
  const n = card.querySelectorAll('.jutsu-banner').length;
  el.style.top = `${-6 + n * 46}px`;
  card.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

/** 画面をしばらくぼやけさせる（目くらまし） */
export function blurFor(card, ms) {
  card.classList.add('blurred');
  clearTimeout(card._blurT);
  card._blurT = setTimeout(() => card.classList.remove('blurred'), ms);
}

/** しばらく打てなくする（こおらせ）。打てるようになる時刻（performance.now）を返す */
export function freezeFor(card, ms) {
  card.classList.add('frozen');
  clearTimeout(card._frzT);
  card._frzT = setTimeout(() => card.classList.remove('frozen'), ms);
  return performance.now() + ms;
}

/** ふりがなを消す（かくれみの） */
export function hideKana(card, on) {
  card.classList.toggle('no-kana', on);
}

/** 自分の術の案内（カウントダウン中に光る）。忍者の術＝スペース、忍術＝エンター */
export function jutsuHintHtml(key = 'スペース', cls = 'jh-ninja') {
  return `<div class="jutsu-hint ${cls}"><kbd>${key}</kbd><span class="jh-name"></span><small class="jh-note"></small></div>`;
}

/**
 * 案内の表示を更新
 * @param {'ready'|'wait'|'used'|'blocked'} state ready＝今使える
 */
export function drawJutsuHint(el, jutsuName, state, note = '') {
  el.querySelector('.jh-name').textContent = `【${jutsuName}】`;
  el.querySelector('.jh-note').textContent =
    note || { ready: '今なら使える！', wait: 'カウントダウン中に使えるよ', used: '使った', blocked: '' }[state];
  el.dataset.state = state;
}

/** 術をはなった効果音の代わりのしるし（巻物をひかせる） */
export function flashCard(card) {
  card.classList.remove('jutsu-flash');
  void card.offsetWidth;
  card.classList.add('jutsu-flash');
}

// ---------- 忍術（じゃま）の見た目 ----------
function timedClass(card, cls, ms) {
  card.classList.add(cls);
  clearTimeout(card[`_${cls}T`]);
  card[`_${cls}T`] = setTimeout(() => card.classList.remove(cls), ms);
}
/** 煙玉：下半分がけむりで見えない */
export const smokeFor = (card, ms) => timedClass(card, 'smoked', ms);
/** 揺らし：文字がゆれる */
export const wobbleFor = (card, ms) => timedClass(card, 'wobble', ms);
/** 逆さ：問題が上下さかさま */
export const flipFor = (card, ms) => timedClass(card, 'flipped', ms);

/** 分身：ニセの問題を少しだけ見せる（打ったキーはほんものの問題で判定） */
export function showFake(card, fakeWord, ms) {
  const el = document.createElement('div');
  el.className = 'fake-word';
  el.innerHTML = `<div class="word-text">${esc(fakeWord.text)}</div><div class="word-kana">${esc(fakeWord.kana)}</div>`;
  card.querySelector('.paper').appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/** 助っ人：次に打つキーを大きく光らせる */
export function keyHelp(card, key) {
  card.querySelector('.key-help')?.remove();
  if (!key) return;
  const el = document.createElement('div');
  el.className = 'key-help';
  el.innerHTML = `つぎは <kbd>${esc(key.toUpperCase())}</kbd>`;
  card.querySelector('.paper').appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

/** 予告：これから出る問題の1文字目 */
export function showYokoku(card, ch) {
  card.querySelector('.yokoku')?.remove();
  const el = document.createElement('div');
  el.className = 'yokoku';
  el.innerHTML = `つぎの問題は「<b>${esc(ch)}</b>」から`;
  card.appendChild(el);
}
export function clearYokoku(card) {
  card.querySelector('.yokoku')?.remove();
}
