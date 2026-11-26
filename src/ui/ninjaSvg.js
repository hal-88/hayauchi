// オリジナルの忍者をシンプルなSVGで描く（既存キャラクターは使わない）
import { getNinja } from '../data/ninjas.js';
import { getItem } from '../data/rewards.js';

const SKIN = '#f3d2b3';
const INK = '#1d1d2b';
const PLATE = '#dfe4ec';

// 額の鉄板（はちがね）に描くしるし。中心 (60,39)
function symbol(kind, c) {
  switch (kind) {
    case 'wind':
      return `<path d="M53 41.5 q1-7 7.5-6.5 q5 .5 4.5 4.5 q-.5 3-3.5 2.5 M55 44.5 h9" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>`;
    case 'bolt':
      return `<polygon points="62,32.5 55,40.5 59.5,40.5 57,46 65.5,37.5 61,37.5 63.5,32.5" fill="${c}"/>`;
    case 'fire':
      return `<path d="M60 32.5 c5 4 6 8 4.5 10.5 c-1.2 2.3-3 3-4.5 3 c-3 0-5-2-5-4.8 c0-2.2 1.3-3.6 2.3-4.6 c.2 1.8 1 2.8 2 3.1 c-.6-2.8.2-5.2.7-7.2z" fill="${c}"/>`;
    case 'iron':
      return `<polygon points="60,33 65.5,36 65.5,42 60,45 54.5,42 54.5,36" fill="none" stroke="${c}" stroke-width="2.2"/><circle cx="60" cy="39" r="1.8" fill="${c}"/>`;
    case 'shadow':
      return `<circle cx="60" cy="39" r="5.5" fill="none" stroke="${c}" stroke-width="2"/><path d="M60 33.5 a5.5 5.5 0 0 1 0 11z" fill="${c}"/>`;
    case 'ice':
      return `<g stroke="${c}" stroke-width="2" stroke-linecap="round"><line x1="60" y1="33" x2="60" y2="45"/><line x1="54.8" y1="36" x2="65.2" y2="42"/><line x1="54.8" y1="42" x2="65.2" y2="36"/></g>`;
    case 'mist':
      return `<g fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"><path d="M53 35.5 q3.5-2 7 0 t7 0"/><path d="M53 39.5 q3.5-2 7 0 t7 0"/><path d="M53 43.5 q3.5-2 7 0 t7 0"/></g>`;
    case 'dragon': // とぐろを巻いた龍（頭と角）
      return `<path d="M64.5 34.5 q-6-2.5-9 1.5 q-2.5 3.5 1 5.5 q3.5 2 5.5-.5 q2-2.5-1-3.5 q-2-.5-2.5 1.2 M56 41.5 q-2.5 3.5 1.5 5 q5 1.5 8-2.5" fill="none" stroke="${c}" stroke-width="1.9" stroke-linecap="round"/><path d="M64.5 34.5 l2-2.4 M64.8 35.2 l2.8-.6" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/><circle cx="63.6" cy="35.8" r=".9" fill="${c}"/>`;
    case 'moon':
      return `<circle cx="60" cy="39" r="5.6" fill="${c}"/><circle cx="62.6" cy="37.4" r="4.6" fill="${PLATE}"/>`;
    default:
      return '';
  }
}

function eyes(kind) {
  const hl = (x) => `<circle cx="${x + 1.3}" cy="57.6" r="1.2" fill="#fff"/>`;
  switch (kind) {
    case 'sharp':
      return `<path d="M42 56 l11 2.5 l-1 4 l-9-1.5z M78 56 l-11 2.5 l1 4 l9-1.5z" fill="${INK}"/>`;
    case 'fierce':
      return `<circle cx="48" cy="60" r="4.2" fill="${INK}"/><circle cx="72" cy="60" r="4.2" fill="${INK}"/>${hl(47)}${hl(71)}
        <path d="M41 52 l12 4 M79 52 l-12 4" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    case 'flat':
      return `<rect x="42" y="57" width="12" height="4.5" rx="2" fill="${INK}"/><rect x="66" y="57" width="12" height="4.5" rx="2" fill="${INK}"/>`;
    case 'narrow':
      return `<path d="M42 59 q6-4 12 0 q-6 2-12 0z M66 59 q6-4 12 0 q-6 2-12 0z" fill="${INK}"/>`;
    case 'sleepy':
      return `<path d="M42 58 q6 5 12 0 M66 58 q6 5 12 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    case 'calm':
      return `<path d="M42 61 q6-6 12 0 M66 61 q6-6 12 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    default: // round
      return `<circle cx="48" cy="59" r="4.6" fill="${INK}"/><circle cx="72" cy="59" r="4.6" fill="${INK}"/>${hl(47)}${hl(71)}`;
  }
}

/**
 * @param {string} ninjaId
 * @param {{color?:string, costume?:string, cls?:string, title?:string}} opt color/costume はごほうびのID
 */
export function ninjaSvg(ninjaId, opt = {}) {
  const n = getNinja(ninjaId);
  const colorItem = opt.color && opt.color !== 'base' ? getItem('color', opt.color) : null;
  const body = colorItem?.value || n.color;
  const costume = opt.costume || 'none';
  const cls = opt.cls ? ` class="${opt.cls}"` : '';
  const title = opt.title ? `<title>${opt.title}</title>` : '';

  const back =
    costume === 'katana'
      ? `<g transform="rotate(-35 60 90)"><rect x="55.5" y="20" width="9" height="90" rx="3" fill="#3a2e28"/><rect x="51" y="20" width="18" height="5" rx="2" fill="#c9a24a"/><rect x="56.5" y="-2" width="7" height="23" rx="2" fill="#7a2d2d"/><path d="M57 2 l6 4 M57 8 l6 4 M57 14 l6 4" stroke="#e8d3a0" stroke-width="1.4"/></g>`
      : '';

  const front = {
    scarf: `<path d="M34 84 q26 12 52 0 l1 9 q-27 12 -54 0z" fill="#d6402b"/><path d="M38 90 q-14 8 -22 22 l8 2 q6-12 18-18z" fill="#b8321f"/>`,
    kasa: `<path d="M10 36 L60 4 L110 36 Q60 44 10 36z" fill="#d9b56b" stroke="#a8843e" stroke-width="2"/><path d="M60 4 L60 38" stroke="#a8843e" stroke-width="1.5"/>`,
    kitsune: `<g transform="rotate(-18 30 30)"><path d="M18 22 l4-10 l6 8 h6 l6-8 l4 10 q2 14 -13 20 q-15-6 -13-20z" fill="#fff" stroke="#c9c9c9"/><path d="M23 26 l5 2 M41 26 l-5 2" stroke="#d6402b" stroke-width="2.4" stroke-linecap="round"/><circle cx="32" cy="35" r="1.6" fill="#d6402b"/></g>`,
    kanzashi: `<g transform="translate(88 22)"><line x1="0" y1="0" x2="-10" y2="14" stroke="#a8843e" stroke-width="2"/>${[0, 72, 144, 216, 288]
      .map((a) => `<circle cx="${(Math.cos((a * Math.PI) / 180) * 5).toFixed(1)}" cy="${(Math.sin((a * Math.PI) / 180) * 5).toFixed(1)}" r="4" fill="#f59fbd"/>`)
      .join('')}<circle r="2.6" fill="#ffd34d"/></g>`,
  }[costume] || '';

  return `<svg${cls} viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg" role="img">${title}
    <ellipse cx="60" cy="143" rx="32" ry="5" fill="#000" opacity="0.18"/>
    ${back}
    <rect x="44" y="120" width="12" height="22" rx="5" fill="#26242f"/>
    <rect x="64" y="120" width="12" height="22" rx="5" fill="#26242f"/>
    <path d="M36 92 Q60 84 84 92 L90 128 Q60 137 30 128 Z" fill="${body}"/>
    <path d="M60 88 L60 130" stroke="#000" stroke-opacity="0.12" stroke-width="2"/>
    <rect x="32" y="112" width="56" height="7" rx="3" fill="${n.accent}"/>
    <circle cx="29" cy="108" r="9" fill="${body}"/><circle cx="91" cy="108" r="9" fill="${body}"/>
    <circle cx="27" cy="114" r="5.5" fill="#26242f"/><circle cx="93" cy="114" r="5.5" fill="#26242f"/>
    <path d="M92 38 q18 -6 24 4 q-12 -2 -20 6z M92 44 q16 2 20 12 q-10 -6 -20 -4z" fill="${n.accent}"/>
    <circle cx="60" cy="56" r="36" fill="${body}"/>
    <path d="M30 70 Q60 86 90 70" stroke="#000" stroke-opacity="0.12" stroke-width="2" fill="none"/>
    <rect x="31" y="48" width="58" height="22" rx="11" fill="${SKIN}"/>
    ${eyes(n.eye)}
    <rect x="25" y="33" width="70" height="11" rx="4" fill="${n.accent}"/>
    <rect x="47.5" y="30.5" width="25" height="17" rx="3.5" fill="${PLATE}" stroke="#8a93a3" stroke-width="1.5"/>
    ${symbol(n.symbol, n.color)}
    ${front}
  </svg>`;
}
