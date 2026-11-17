// 巻物と忍術の見た目
import { getScrolls } from '../progress/save.js';
import { catOf, stars, typeLabel } from '../data/ninjutsu.js';
import { esc } from './typing.js';

/** 小さい巻物の絵 */
export const SCROLL_ICON = `<svg class="scroll-icon" viewBox="0 0 40 24" aria-hidden="true"><rect x="5" y="4" width="30" height="16" rx="2" fill="#f8f1df" stroke="#c9a24a" stroke-width="1.5"/><rect x="2" y="2" width="5" height="20" rx="2.5" fill="#8a5a2b"/><rect x="33" y="2" width="5" height="20" rx="2.5" fill="#8a5a2b"/><rect x="5" y="10" width="30" height="4" fill="#d6402b"/></svg>`;

/** 結果画面の「巻物 +n本」 */
export function scrollGainHtml(n) {
  return `<div class="scroll-gain">${SCROLL_ICON}<b>巻物 +${n}本</b><small>いま ${getScrolls()}本</small></div>`;
}

/** 忍術のはんこ（名前の1文字目を、種類の色で） */
export function ninjutsuSealHtml(j, cls = '') {
  const c = catOf(j.cat);
  return `<span class="nj-seal ${cls}" style="--nc:${c.color}">${esc(j.name[0])}</span>`;
}

/** 忍術の小さい札 */
export function ninjutsuTagsHtml(j) {
  const c = catOf(j.cat);
  return `<span class="nj-tags"><span class="nj-stars">${stars(j.rank)}</span><span class="nj-cat" style="--nc:${c.color}">${c.label}</span><span class="nj-type">${typeLabel(j.type)}</span></span>`;
}
