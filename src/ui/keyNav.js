// キーボードだけで操作できるようにする：十字キーで画面のボタンを選び、Enter（かスペース）で押す。
// 画面ごとに <section data-nav="..."> で決める
//   なし（auto）… 十字キーで近くのボタンへ移る（タイトル・蔵・結果画面・待合室 など）
//   own          … 画面が自分で十字キーを使う（忍者えらび・忍術えらび・CPU戦の準備）
//   off          … 十字キーは使わない（対戦中・部屋コード入力）

const FOCUSABLE = 'button:not([disabled]), [tabindex]:not([tabindex="-1"])';
// 上のバーの ミュート・音量 も十字キーでえらべる
const HEADER = '.topbar .mute, .topbar .vol:not([disabled])';

function visible(el) {
  return !el.hidden && el.offsetParent !== null && el.getClientRects().length > 0;
}

function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
}

/** 方向キーで、いちばん近いボタンを選ぶ */
function nextInDirection(list, cur, key) {
  const c = centerOf(cur);
  let best = null;
  let bestScore = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const p = centerOf(el);
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    let main;
    let side;
    if (key === 'ArrowRight') [main, side] = [dx, dy];
    else if (key === 'ArrowLeft') [main, side] = [-dx, dy];
    else if (key === 'ArrowDown') [main, side] = [dy, dx];
    else [main, side] = [-dy, dx];
    if (main <= 4) continue; // その方向にない
    const score = main + Math.abs(side) * 2.2; // 同じ列・行を優先
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

/**
 * @param {HTMLElement} screenEl 画面が入る要素（#screen）
 */
export function setupKeyNav(screenEl) {
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.isComposing || e.keyCode === 229) return; // 日本語入力の変換中は使わない
      const sec = screenEl.querySelector(':scope > section');
      const mode = sec?.dataset.nav || 'auto';
      if (mode !== 'auto') return;
      const ae = document.activeElement;
      const inHeader = ae?.matches?.(HEADER);
      // 音量バーをえらんでいるときは ←→ で音量を変える（ふつうの動き）
      if (inHeader && ae.classList.contains('vol') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
      const focusedBtn = ae && ((screenEl.contains(ae) && ae.matches(FOCUSABLE) && ae.tagName !== 'INPUT') || inHeader) ? ae : null;

      // 選んでいるボタンで Enter・スペース → そのボタンを押す（画面の「Enter で〇〇」より優先）
      if ((e.key === 'Enter' || e.key === ' ') && focusedBtn && focusedBtn.tagName === 'BUTTON') {
        e.stopPropagation();
        return; // ボタンがふつうに押される
      }
      if (!e.key.startsWith('Arrow')) return;
      const list = [...screenEl.querySelectorAll(FOCUSABLE), ...document.querySelectorAll(HEADER)].filter(
        (el) => visible(el) && !(el.tagName === 'INPUT' && el.type !== 'range')
      );
      if (!list.length) return;
      e.preventDefault();
      e.stopPropagation();
      if (!focusedBtn) {
        // はじめは、いまえらばれているもの（そうび中・選択中）→ 目立つボタン → 先頭 の順で
        const start =
          list.find((el) => el.classList.contains('on') && !el.classList.contains('tab')) ||
          list.find((el) => el.classList.contains('primary')) ||
          list[0];
        start.focus();
        return;
      }
      const next = nextInDirection(list, focusedBtn, e.key);
      if (next) {
        next.focus();
        next.scrollIntoView?.({ block: 'nearest' });
      }
    },
    true // 画面のキー操作より先に見る
  );
}
