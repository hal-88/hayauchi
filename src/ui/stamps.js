// スタンプメッセージ：カウントダウン中に F G H J K L で送る（決まった6つだけ。自由な文は送れない）
import { esc } from './typing.js';

export const STAMPS = [
  { key: 'F', icon: '👋', text: 'よろしく！' },
  { key: 'G', icon: '🔥', text: '負けないぞ！' },
  { key: 'H', icon: '⚡', text: 'いくぞ！' },
  { key: 'J', icon: '👏', text: 'すごい！' },
  { key: 'K', icon: '💪', text: 'ドンマイ！' },
  { key: 'L', icon: '🙏', text: 'ありがとう！' },
];
export const STAMP_COOLDOWN_MS = 1200; // 続けて送れるまでの間（連打で画面がうまらないように）
const SHOW_MS = 2200;

/** 押したキーがスタンプなら 0〜5、ちがえば -1 */
export function stampIndexOf(e) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.key.length !== 1) return -1;
  return STAMPS.findIndex((s) => s.key === e.key.toUpperCase());
}

/** カウントダウン中に巻物の下に出す、キーの案内 */
export function stampBarHtml() {
  return `<div class="stamp-bar">${STAMPS.map((s) => `<span><kbd>${s.key}</kbd>${s.icon}${esc(s.text)}</span>`).join('')}</div>`;
}

const shown = new Map(); // だれ → いま出ているふきだし

/** anchor（その人のアイコン）のすぐ下に、ふきだしを出す。who が同じなら前のふきだしは消す */
export function showStamp(anchor, idx, who = 'me') {
  const s = STAMPS[idx];
  if (!anchor || !s) return;
  const r = anchor.getBoundingClientRect();
  const b = document.createElement('div');
  b.className = 'stamp-bubble';
  b.innerHTML = `<span class="sb-icon">${s.icon}</span>${esc(s.text)}`;
  b.style.left = `${Math.min(Math.max(r.left + r.width / 2, 90), window.innerWidth - 90)}px`;
  b.style.top = `${r.bottom}px`;
  shown.get(who)?.remove();
  shown.set(who, b);
  document.body.appendChild(b);
  setTimeout(() => {
    b.remove();
    if (shown.get(who) === b) shown.delete(who);
  }, SHOW_MS);
}

/** 画面を出るときに、残っているふきだしを消す */
export function clearStamps() {
  for (const b of shown.values()) b.remove();
  shown.clear();
}
