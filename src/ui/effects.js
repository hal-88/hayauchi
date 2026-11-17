// 打ったときのエフェクト（ごほうび）。画面いちばん上の #fx に小さい部品を飛ばす

let layer = null;
function getLayer() {
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'fx';
    document.body.appendChild(layer);
  }
  return layer;
}

const SHURIKEN = `<svg viewBox="-10 -10 20 20"><path d="M0-9 L2-2 L9 0 L2 2 L0 9 L-2 2 L-9 0 L-2-2z" fill="#4a5160"/><circle r="2" fill="#dfe4ec"/></svg>`;
const STAR = `<svg viewBox="-10 -10 20 20"><path d="M0-9 L2.6-2.8 L9-2.8 L3.8 1.2 L5.6 8 L0 4 L-5.6 8 L-3.8 1.2 L-9-2.8 L-2.6-2.8z" fill="#ffd34d"/></svg>`;
const BOLT = `<svg viewBox="0 0 20 30"><polygon points="12,0 2,16 9,16 6,30 18,11 11,11 15,0" fill="#ffe04a" stroke="#c99a00" stroke-width="1"/></svg>`;
const PETAL = `<svg viewBox="0 0 20 20"><path d="M10 1 C16 6 16 14 10 19 C4 14 4 6 10 1z" fill="#f7a8c4"/></svg>`;

function part(html, cls, x, y, dx, dy, extra = {}) {
  const el = document.createElement('div');
  el.className = `fx ${cls}`;
  el.innerHTML = html;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.setProperty('--dx', `${dx}px`);
  el.style.setProperty('--dy', `${dy}px`);
  for (const [k, v] of Object.entries(extra)) el.style.setProperty(k, v);
  getLayer().appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

const rnd = (a, b) => a + Math.random() * (b - a);

const EFFECTS = {
  spark(x, y) {
    for (let i = 0; i < 4; i++) {
      const a = rnd(0, Math.PI * 2);
      part('', 'fx-dot', x, y, Math.cos(a) * rnd(14, 26), Math.sin(a) * rnd(14, 26));
    }
  },
  shuriken(x, y) {
    part(SHURIKEN, 'fx-spin', x, y, rnd(40, 70), rnd(-60, -30));
  },
  petal(x, y) {
    for (let i = 0; i < 3; i++) part(PETAL, 'fx-fall', x, y, rnd(-30, 30), rnd(20, 50), { '--r': `${rnd(-180, 180)}deg` });
  },
  smoke(x, y) {
    part('', 'fx-smoke', x, y, rnd(-6, 6), rnd(-24, -14));
  },
  bolt(x, y) {
    part(BOLT, 'fx-bolt', x, y - 26, 0, 0);
  },
  star(x, y) {
    for (let i = 0; i < 3; i++) {
      const a = rnd(-Math.PI, 0);
      part(STAR, 'fx-star', x, y, Math.cos(a) * rnd(20, 40), Math.sin(a) * rnd(20, 40));
    }
  },
};

/** 画面上の (x, y) にエフェクトを出す */
export function spawnEffect(id, x, y) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  (EFFECTS[id] || EFFECTS.spark)(x, y);
}

/** 要素の右はしの真ん中に出す */
export function spawnAt(id, el) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  spawnEffect(id, r.right, r.top + r.height / 2);
}
