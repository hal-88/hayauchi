// 1人用・CPU戦・（のちの）みんなで対戦 で共通の、巻物の出題表示とキー入力

export const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * キー入力を読む。
 * @returns {{ime:true}|{char:string}|null} ime＝日本語入力がオン、char＝打った文字、null＝関係ないキー
 */
export function readTypingKey(e) {
  if (e.isComposing || e.key === 'Process' || e.keyCode === 229) return { ime: true };
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return null;
  if (e.key.length !== 1 || !/[a-zA-Z\-,.!?]/.test(e.key)) return null;
  return { char: e.key };
}

export const IME_WARN_HTML = `<div class="ime-warn" hidden>日本語入力になっているみたい。<b>半角英数</b>にしてね（<kbd>英数</kbd> か <kbd>半角/全角</kbd> キー）</div>`;

/** 巻物。closed のときは軸が真ん中で閉じていて、開くと左右に広がる */
export const SCROLL_HTML = `
  <div class="card scroll closed">
    <div class="paper"><div class="stage"></div></div>
    <div class="rod l"></div><div class="rod r"></div>
    <div class="count-layer"></div>
  </div>`;

/** 巻物を閉じてカウントダウンの数字を出す */
export function closeScroll(card, n, label = 'つぎの問題') {
  card.classList.add('closed');
  card.classList.remove('won', 'lost', 'cleared');
  card.querySelector('.stage').innerHTML = '';
  setCountdown(card, n, label);
}

/** カウントダウンの数字だけ変える（先読みの術で巻物が開いているとき用） */
export function setCountdown(card, n, label = 'つぎの問題') {
  card.querySelector('.count-layer').innerHTML = `<div class="countdown"><span>${n}</span><small>${esc(label)}</small></div>`;
}

/** 巻物を開く（出題）。keepCount＝カウントダウンを残す（先読みの術） */
export function openScroll(card, keepCount = false) {
  if (!keepCount) card.querySelector('.count-layer').innerHTML = '';
  card.classList.remove('closed');
}

/** 出題の中身を stage に描く */
export function renderWord(stage, word) {
  stage.innerHTML = `
    <div class="word-text">${esc(word.text)}</div>
    <div class="word-kana"></div>
    <div class="romaji"></div>
  `;
}

/** 打った所の色分けを更新 */
export function drawProgress(stage, word, matcher) {
  const k = matcher.kanaDone;
  // word.cut＝短縮の術で打たなくてよくなった後ろの部分（うすく表示）
  stage.querySelector('.word-kana').innerHTML =
    `<span class="done">${esc(word.kana.slice(0, k))}</span>${esc(word.kana.slice(k))}` +
    (word.cut ? `<span class="cut">${esc(word.cut)}</span>` : '');
  const rest = matcher.rest;
  stage.querySelector('.romaji').innerHTML =
    `<span class="typed">${esc(matcher.typed)}</span>` +
    (rest ? `<span class="next">${esc(rest[0])}</span><span class="rest">${esc(rest.slice(1))}</span>` : '');
}

/** 取った・クリアのはんこ */
export function stampHtml(text, sub = '', lose = false) {
  return `<div class="clear-badge${lose ? ' lose' : ''}">${esc(text)}${sub ? ` <small>${esc(sub)}</small>` : ''}</div>`;
}

/** ミスしたときにカードを揺らす（animationend で外れる） */
export function shake(card) {
  card.classList.remove('shake');
  void card.offsetWidth; // アニメーションをやり直す
  card.classList.add('shake');
}
export function setupShake(card) {
  card.addEventListener('animationend', (e) => {
    if (e.animationName === 'shake') card.classList.remove('shake');
  });
}

/** ミスしたあと少し止まる（その間に打ったキーは無視）。打てるようになる時刻（performance.now）を返す */
export const MISS_STOP_MS = 300;
export function missStop(card, ms = MISS_STOP_MS) {
  card.classList.add('stopped');
  clearTimeout(card._stopT);
  card._stopT = setTimeout(() => card.classList.remove('stopped'), ms);
  return performance.now() + ms;
}

/** setTimeout をまとめて片づけられるようにする */
export function timerBag() {
  const ids = new Set();
  return {
    later(fn, ms) {
      const id = setTimeout(() => {
        ids.delete(id);
        fn();
      }, ms);
      ids.add(id);
    },
    clear() {
      ids.forEach(clearTimeout);
      ids.clear();
    },
  };
}
