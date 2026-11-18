// 結果のシェア：結果画面が出たときに「結果カード」の画像を作っておき、ボタン（か S キー）で
// iPad の共有シート（AirDrop・写真に保存・ほかのアプリ）を開く。共有できないブラウザでは、画像を大きく見せて保存できるようにする。
import { ninjaSvg } from './ninjaSvg.js';
import { esc } from './typing.js';

const W = 1200;
const H = 630;
const SITE = 'https://hal-88.github.io/hayauchi/';
const ROUND = '"M PLUS Rounded 1c", sans-serif';
const BRUSH = '"Yuji Syuku", serif';

export const shareButtonHtml = () =>
  '<button class="btn share-btn" type="button" data-act="share"><kbd>S</kbd> 結果をシェア</button>';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 横はばに入るように文字を小さくして書く */
function fitText(ctx, text, x, y, maxW, size, weight, family) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    s -= 2;
  } while (ctx.measureText(text).width > maxW && s > 12);
  ctx.fillText(text, x, y);
}

/**
 * 結果カードの画像を作る
 * @param {{mode:string, headline:string, sub?:string, lines?:string[], name:string, ninja:string, color?:string, costume?:string, win?:boolean}} d
 * @returns {Promise<{file: File, url: string}>}
 */
export async function makeShareCard(d) {
  const all = [d.mode, d.headline, d.sub, ...(d.lines || []), d.name, 'はやうち忍者'].filter(Boolean).join('');
  try {
    await Promise.all([
      document.fonts.load(`400 80px ${BRUSH}`, all),
      document.fonts.load(`800 40px ${ROUND}`, all),
      document.fonts.load(`700 28px ${ROUND}`, all),
    ]);
  } catch {
    /* 字体が読めなくても、ふつうの字で書く */
  }
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');

  // 夜空
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1c2547');
  g.addColorStop(1, '#3a3f6e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 40; i++) {
    const x = (i * 197) % W;
    const y = (i * 89) % (H * 0.5);
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.fillStyle = '#f4e7b5';
  ctx.beginPath();
  ctx.arc(W - 120, 92, 52, 0, Math.PI * 2);
  ctx.fill();

  // 紙のパネル
  roundRect(ctx, 40, 40, W - 80, H - 80, 28);
  ctx.fillStyle = '#fbf4e4';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#d8c39a';
  ctx.stroke();

  // 看板
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#241f19';
  ctx.font = `400 46px ${BRUSH}`;
  ctx.fillText('はやうち', 84, 118);
  const wHaya = ctx.measureText('はやうち').width;
  ctx.fillStyle = '#d6402b';
  ctx.fillText('忍者', 84 + wHaya + 6, 118);

  // モード（右上の札）
  ctx.font = `700 26px ${ROUND}`;
  const mw = ctx.measureText(d.mode).width + 40;
  roundRect(ctx, W - 84 - mw, 80, mw, 48, 24);
  ctx.fillStyle = '#d6402b';
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(d.mode, W - 84 - mw / 2, 113);
  ctx.textAlign = 'left';

  // 忍者
  try {
    const svg = ninjaSvg(d.ninja, { color: d.color, costume: d.costume }).replace('<svg', '<svg width="240" height="300"');
    const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    ctx.drawImage(img, 96, 170, 240, 300);
  } catch {
    /* 絵が描けなくても文字だけでつくる */
  }
  ctx.fillStyle = '#241f19';
  ctx.textAlign = 'center';
  fitText(ctx, d.name, 216, 520, 260, 30, 800, ROUND);
  ctx.textAlign = 'left';

  // 結果
  const x0 = 400;
  const maxW = W - 84 - x0;
  ctx.fillStyle = d.win === false ? '#3b5a8a' : '#d6402b';
  fitText(ctx, d.headline, x0, 285, maxW, 110, 400, BRUSH);
  if (d.sub) {
    ctx.fillStyle = '#241f19';
    fitText(ctx, d.sub, x0, 350, maxW, 40, 800, ROUND);
  }
  ctx.fillStyle = '#5b5346';
  (d.lines || []).slice(0, 3).forEach((t, i) => fitText(ctx, t, x0, 410 + i * 44, maxW, 28, 700, ROUND));

  // 下：日付とサイト
  const day = new Date();
  ctx.fillStyle = '#8a7f6c';
  ctx.font = `700 22px ${ROUND}`;
  ctx.fillText(`${day.getFullYear()}/${day.getMonth() + 1}/${day.getDate()}`, x0, H - 74);
  ctx.textAlign = 'right';
  ctx.fillText(SITE.replace('https://', ''), W - 84, H - 74);
  ctx.textAlign = 'left';

  const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
  const file = new File([blob], 'hayauchi-ninja.png', { type: 'image/png' });
  return { file, url: URL.createObjectURL(blob) };
}

/** 共有できないときの画面：画像を大きく出して、保存ボタン（iPad は画像の長おしでも保存できる） */
function showSharePanel(card, text) {
  document.querySelector('.share-overlay')?.remove();
  const ov = document.createElement('div');
  ov.className = 'share-overlay';
  ov.innerHTML = `
    <div class="share-box panel">
      <img src="${card.url}" alt="結果カード" />
      <p>${esc(text)}</p>
      <div class="buttons">
        <a class="btn primary" href="${card.url}" download="hayauchi-ninja.png">画像を保存</a>
        <button class="btn" type="button" data-act="close">とじる <kbd>Esc</kbd></button>
      </div>
    </div>`;
  const close = () => {
    ov.remove();
    window.removeEventListener('keydown', onKey, true);
  };
  const onKey = (e) => {
    if (!ov.isConnected) return window.removeEventListener('keydown', onKey, true); // 画面がかわって消えていた
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };
  ov.querySelector('[data-act="close"]').addEventListener('click', close);
  ov.addEventListener('click', (e) => e.target === ov && close());
  window.addEventListener('keydown', onKey, true);
  document.body.appendChild(ov);
}

/**
 * 結果画面にシェアをつける。画像はすぐ作りはじめる（押したときにすぐ共有シートを出すため）
 * @returns {() => void} シェアする（ボタン・S キー から呼ぶ）
 */
export function setupShare(root, data, text) {
  const ready = makeShareCard(data).catch(() => null);
  let card = null;
  ready.then((c) => (card = c));
  const fullText = `${text}\n${SITE}`;
  const btn = root.querySelector('[data-act="share"]');
  async function share() {
    const c = card || (await ready);
    if (!c) return;
    const payload = { files: [c.file], text: fullText, title: 'はやうち忍者' };
    if (navigator.canShare?.(payload)) {
      try {
        await navigator.share(payload);
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return; // 自分でとじた
      }
    }
    showSharePanel(c, fullText);
  }
  btn?.addEventListener('click', share);
  return share;
}

/** 画面を出るときに、開いたままのシェア画面を消す */
export function closeSharePanel() {
  document.querySelector('.share-overlay')?.remove();
}
