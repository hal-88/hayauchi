// 背景（ごほうび）。画面いちばん後ろの #bg に SVG の景色を描く

const W = 1200;
const H = 800;
const rand = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

function stars(n, seed, color = '#fff') {
  const r = rand(seed);
  return Array.from({ length: n }, () => `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H * 0.55).toFixed(0)}" r="${(r() * 1.8 + 0.4).toFixed(1)}" fill="${color}" opacity="${(r() * 0.6 + 0.3).toFixed(2)}"/>`).join('');
}

function roofs(y, color, seed) {
  const r = rand(seed);
  let s = '';
  for (let x = -40; x < W + 40; ) {
    const w = 140 + r() * 120;
    const h = 50 + r() * 60;
    const top = y - h;
    s += `<path d="M${x} ${y} L${x + 10} ${top + 22} Q${x + w / 2} ${top - 8} ${x + w - 10} ${top + 22} L${x + w} ${y} Z" fill="${color}"/>`;
    s += `<rect x="${x + 18}" y="${top + 22}" width="${w - 36}" height="${y - top}" fill="${color}"/>`;
    x += w - 10;
  }
  return s;
}

function castle(cx, base, c) {
  return `<g fill="${c}">
    <rect x="${cx - 150}" y="${base - 70}" width="300" height="70"/>
    <path d="M${cx - 190} ${base - 70} Q${cx} ${base - 120} ${cx + 190} ${base - 70}z"/>
    <rect x="${cx - 110}" y="${base - 150}" width="220" height="80"/>
    <path d="M${cx - 150} ${base - 150} Q${cx} ${base - 200} ${cx + 150} ${base - 150}z"/>
    <rect x="${cx - 70}" y="${base - 220}" width="140" height="70"/>
    <path d="M${cx - 105} ${base - 220} Q${cx} ${base - 275} ${cx + 105} ${base - 220}z"/>
  </g>`;
}

const SCENES = {
  yoru: () => `
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#151a38"/><stop offset="1" stop-color="#3a3f73"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    ${stars(70, 7)}
    <circle cx="960" cy="150" r="60" fill="#fff4cf"/>
    <path d="M0 ${H} L0 600 Q300 540 600 600 T1200 580 L1200 ${H}z" fill="#232750"/>
    ${roofs(H, '#1a1d3c', 3)}`,
  chikurin: () => {
    const r = rand(11);
    let bamboo = '';
    for (let i = 0; i < 22; i++) {
      const x = r() * W;
      const w = 14 + r() * 18;
      const c = ['#2f6b3a', '#3e8a4a', '#24552e'][i % 3];
      bamboo += `<rect x="${x}" y="0" width="${w}" height="${H}" fill="${c}" opacity="${0.55 + r() * 0.45}"/>`;
      for (let y = 60 + r() * 80; y < H; y += 110 + r() * 40) bamboo += `<rect x="${x - 2}" y="${y}" width="${w + 4}" height="5" rx="2" fill="#1d4224" opacity="0.7"/>`;
    }
    return `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9efc9"/><stop offset="1" stop-color="#7fb77a"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#g)"/>${bamboo}`;
  },
  shiro: () => `
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1033"/><stop offset="1" stop-color="#4b2f6b"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    ${stars(50, 21)}
    <circle cx="600" cy="300" r="190" fill="#ffe9a8" opacity="0.95"/>
    ${castle(600, 640, '#140a24')}
    <path d="M0 ${H} L0 640 L1200 640 L1200 ${H}z" fill="#140a24"/>`,
  yuuyake: () => `
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb36b"/><stop offset=".6" stop-color="#ff7a59"/><stop offset="1" stop-color="#8d3b5a"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <circle cx="300" cy="420" r="110" fill="#ffe08a" opacity="0.9"/>
    ${roofs(H - 90, '#7a2e48', 5)}
    ${roofs(H, '#4a1a33', 9)}`,
  yuki: () => {
    const r = rand(31);
    const flakes = Array.from({ length: 90 }, () => `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H).toFixed(0)}" r="${(r() * 3 + 1).toFixed(1)}" fill="#fff" opacity="${(r() * 0.5 + 0.5).toFixed(2)}"/>`).join('');
    return `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9cc3e6"/><stop offset="1" stop-color="#e8f3fb"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#g)"/>
      <path d="M0 ${H} L0 560 Q250 470 520 560 T1200 520 L1200 ${H}z" fill="#f7fbff"/>
      ${roofs(H, '#6d86a3', 13)}
      <path d="M0 ${H} L0 690 Q600 650 1200 690 L1200 ${H}z" fill="#ffffff"/>${flakes}`;
  },
  sakura: () => {
    const r = rand(41);
    const petals = Array.from({ length: 60 }, () => {
      const x = (r() * W).toFixed(0);
      const y = (r() * H).toFixed(0);
      return `<ellipse cx="${x}" cy="${y}" rx="6" ry="3.5" transform="rotate(${(r() * 180).toFixed(0)} ${x} ${y})" fill="#f7a8c4" opacity="${(r() * 0.5 + 0.5).toFixed(2)}"/>`;
    }).join('');
    const blossoms = Array.from({ length: 26 }, (_, i) => `<circle cx="${(i * 50 + r() * 30).toFixed(0)}" cy="${(r() * 120 + 20).toFixed(0)}" r="${(r() * 40 + 50).toFixed(0)}" fill="${i % 2 ? '#f5b6cc' : '#f9cadb'}"/>`).join('');
    return `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde6ee"/><stop offset="1" stop-color="#f3b9cd"/></linearGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#g)"/>${blossoms}
      ${roofs(H, '#8a4a63', 17)}${petals}`;
  },
};

// 背景が明るいか（文字色の調整用）
const LIGHT = new Set(['chikurin', 'yuki', 'sakura']);

export function bgSvg(id) {
  const key = SCENES[id] ? id : 'yoru';
  const inner = SCENES[key]().replace('id="g"', `id="g-${key}"`).replace('url(#g)', `url(#g-${key})`);
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

export function applyBackground(id) {
  let el = document.getElementById('bg');
  if (!el) {
    el = document.createElement('div');
    el.id = 'bg';
    document.body.prepend(el);
  }
  if (el.dataset.id === id) return;
  el.dataset.id = id;
  el.innerHTML = bgSvg(id);
  document.body.classList.toggle('bg-light', LIGHT.has(id));
}
