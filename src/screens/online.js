// みんなで対戦：部屋を作る／コードで入る／待合室
import { ONLINE, isLocalMode } from '../online/config.js';
import { createRoom, joinRoom, leaveRoom, watchRoom, getDb, sortedMembers, effectiveHost } from '../online/room.js';
import { getProfile, getEquip } from '../progress/save.js';
import { ninjaSvg } from '../ui/ninjaSvg.js';
import { esc } from '../ui/typing.js';
import { sfx } from '../audio/sfx.js';
import { showTitle } from './title.js';
import { showOnlineBattle } from './onlineBattle.js';

const TESTMODE_HTML = () =>
  isLocalMode() ? '<p class="testmode">テストモード：このパソコンの別のタブどうしだけで対戦できます（Firebase の設定まち）</p>' : '';

/** 最初の画面：部屋を作る or 入る */
export function showOnlineMenu(el, go) {
  el.innerHTML = `
    <section class="online-menu panel-page">
      <h2>みんなでたいせん</h2>
      <p class="sub">2〜4人で、同じことばを早く打ち切った人に1点！</p>
      <div class="choice">
        <button class="choice-btn" type="button" data-act="create">
          <span class="big-icon">🏯</span>
          <b>部屋をつくる</b>
          <small>4けたの部屋コードが出るよ。みんなに教えてね</small>
          <kbd>1</kbd>
        </button>
        <button class="choice-btn" type="button" data-act="join">
          <span class="big-icon">🚪</span>
          <b>部屋に入る</b>
          <small>友だちの部屋コードを入れてね</small>
          <kbd>2</kbd>
        </button>
      </div>
      <p class="err" hidden></p>
      ${TESTMODE_HTML()}
      <div class="buttons"><button class="btn" type="button" data-act="back">もどる <kbd>Esc</kbd></button></div>
    </section>
  `;
  const err = el.querySelector('.err');
  let busy = false;

  async function create() {
    if (busy) return;
    busy = true;
    err.hidden = true;
    try {
      const code = await createRoom(getProfile(), getEquip(), ONLINE.targets[0]);
      sfx.go();
      go(showLobby, { code });
    } catch (e) {
      err.textContent = `部屋を作れなかったよ（${e.message || e}）`;
      err.hidden = false;
      busy = false;
    }
  }

  el.querySelector('[data-act="create"]').addEventListener('click', create);
  el.querySelector('[data-act="join"]').addEventListener('click', () => go(showJoin));
  el.querySelector('[data-act="back"]').addEventListener('click', () => go(showTitle));
  const onKey = (e) => {
    if (e.key === '1') create();
    else if (e.key === '2') go(showJoin);
    else if (e.key === 'Escape') go(showTitle);
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}

/** 部屋コードを入れる（キーボードの数字でも、画面のボタンでも） */
export function showJoin(el, go) {
  let code = '';
  el.innerHTML = `
    <section class="join panel-page" data-nav="off">
      <h2>部屋コードを入れてね</h2>
      <div class="code-boxes">${'<span></span>'.repeat(4)}</div>
      <div class="keypad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-n="${n}">${n}</button>`).join('')}
        <button type="button" data-act="del" class="kp-del">けす</button>
        <button type="button" data-n="0">0</button>
        <button type="button" data-act="enter" class="kp-enter">入る</button>
      </div>
      <p class="err" hidden></p>
      ${TESTMODE_HTML()}
      <div class="buttons"><button class="btn" type="button" data-act="back">もどる <kbd>Esc</kbd></button></div>
    </section>
  `;
  const boxes = el.querySelectorAll('.code-boxes span');
  const err = el.querySelector('.err');
  let busy = false;

  function draw() {
    boxes.forEach((b, i) => {
      b.textContent = code[i] || '';
      b.classList.toggle('on', i === code.length);
    });
  }
  function add(n) {
    if (code.length >= 4) return;
    code += n;
    err.hidden = true;
    sfx.click();
    draw();
  }
  function del() {
    code = code.slice(0, -1);
    draw();
  }
  async function enter() {
    if (busy) return;
    if (code.length !== 4) {
      err.textContent = '4けたの数字を入れてね';
      err.hidden = false;
      return;
    }
    busy = true;
    try {
      const r = await joinRoom(code, getProfile(), getEquip());
      if (r.ok) {
        sfx.go();
        go(showLobby, { code });
        return;
      }
      err.textContent = r.reason;
    } catch (e) {
      err.textContent = `つながらなかったよ（${e.message || e}）`;
    }
    err.hidden = false;
    sfx.miss();
    busy = false;
  }

  el.querySelectorAll('[data-n]').forEach((b) => b.addEventListener('click', () => add(b.dataset.n)));
  el.querySelector('[data-act="del"]').addEventListener('click', del);
  el.querySelector('[data-act="enter"]').addEventListener('click', enter);
  el.querySelector('[data-act="back"]').addEventListener('click', () => go(showOnlineMenu));
  const onKey = (e) => {
    if (/^[0-9]$/.test(e.key)) add(e.key);
    else if (e.key === 'Backspace') del();
    else if (e.key === 'Enter') enter();
    else if (e.key === 'Escape') go(showOnlineMenu);
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);
  draw();
  return () => window.removeEventListener('keydown', onKey);
}

/** 待合室：参加者がそろうのを待つ。ホストが先取点をえらんでスタート */
export function showLobby(el, go, { code }) {
  el.innerHTML = `
    <section class="lobby panel-page">
      <div class="lobby-head">
        <div class="room-code"><span>部屋コード</span><b>${esc(code)}</b></div>
        <p class="lobby-msg"></p>
      </div>
      <div class="slots"></div>
      <div class="lobby-target"></div>
      <div class="buttons">
        <button class="btn primary big" type="button" data-act="start" hidden>スタート <kbd>Enter</kbd></button>
        <button class="btn" type="button" data-act="leave">部屋から出る</button>
      </div>
      ${TESTMODE_HTML()}
    </section>
  `;
  const $ = (s) => el.querySelector(s);
  let room = null;
  let myUid = null;
  let stop = null;
  let left = false;
  let starting = false;

  function draw() {
    const members = sortedMembers(room).filter(([, m]) => !m.left);
    const host = effectiveHost(room);
    const iAmHost = host === myUid;
    $('.slots').innerHTML = Array.from({ length: ONLINE.maxPlayers }, (_, i) => {
      const e = members[i];
      if (!e) return `<div class="slot empty"><span>あき</span></div>`;
      const [uid, m] = e;
      return `<div class="slot ${uid === myUid ? 'me' : ''} ${m.online ? '' : 'off'}">
        ${uid === host ? '<em>ホスト</em>' : ''}
        ${ninjaSvg(m.ninja, { color: m.color, costume: m.costume, cls: 'slot-ninja' })}
        <b>${esc(m.name)}</b>
        ${uid === myUid ? '<small>あなた</small>' : m.online ? '' : '<small>通信がきれた</small>'}
      </div>`;
    }).join('');

    const target = room.meta.target;
    if (iAmHost) {
      $('.lobby-target').innerHTML = `<span>なん点とったら勝ち？</span>${ONLINE.targets
        .map((t) => `<button type="button" class="target ${t === target ? 'on' : ''}" data-target="${t}">${t}点先取</button>`)
        .join('')}`;
      $('.lobby-target').querySelectorAll('[data-target]').forEach((b) =>
        b.addEventListener('click', async () => {
          const db = await getDb();
          await db.update(`rooms/${code}/meta`, { target: +b.dataset.target });
          sfx.click();
        })
      );
    } else {
      $('.lobby-target').innerHTML = `<span>ルール</span><b class="target on">${target}点先取</b>`;
    }
    const enough = members.filter(([, m]) => m.online).length >= ONLINE.minPlayers;
    const startBtn = $('[data-act="start"]');
    startBtn.hidden = !iAmHost;
    startBtn.disabled = !enough;
    $('.lobby-msg').textContent = iAmHost
      ? enough
        ? 'そろったら「スタート」を押してね'
        : '部屋コードをみんなに教えてね。2人以上でスタートできるよ'
      : 'ホストがスタートするのを待ってね';
  }

  async function start() {
    const host = effectiveHost(room);
    if (starting || host !== myUid) return;
    if (sortedMembers(room).filter(([, m]) => m.online && !m.left).length < ONLINE.minPlayers) return;
    starting = true;
    const db = await getDb();
    await db.update(`rooms/${code}/meta`, { status: 'playing', host: myUid });
  }

  async function leave() {
    if (left) return;
    left = true;
    stop?.();
    await leaveRoom(code);
    go(showOnlineMenu);
  }

  $('[data-act="start"]').addEventListener('click', start);
  $('[data-act="leave"]').addEventListener('click', leave);
  const onKey = (e) => {
    if (e.key === 'Enter') start();
    else if (e.key === 'Escape') leave();
  };
  window.addEventListener('keydown', onKey);

  (async () => {
    myUid = (await getDb()).uid;
    stop = await watchRoom(code, (r) => {
      if (left) return;
      if (!r) {
        left = true;
        stop?.();
        el.querySelector('.lobby-msg').textContent = '部屋がなくなりました（ホストが出たのかも）';
        el.querySelector('.slots').innerHTML = '';
        el.querySelector('.lobby-target').innerHTML = '';
        $('[data-act="start"]').hidden = true;
        $('[data-act="leave"]').textContent = 'もどる';
        $('[data-act="leave"]').onclick = () => go(showOnlineMenu);
        return;
      }
      const prev = room;
      room = r;
      if (r.meta.status === 'playing') {
        left = true; // この画面の役目はおわり（部屋からは出ない）
        stop?.();
        go(showOnlineBattle, { code });
        return;
      }
      const prevCount = prev ? Object.keys(prev.members || {}).length : 0;
      if (prev && Object.keys(r.members || {}).length > prevCount) sfx.count();
      draw();
    });
  })();

  return () => {
    window.removeEventListener('keydown', onKey);
    if (!left) {
      // 画面がほかに移ったら（タイトルへ など）部屋から出る
      left = true;
      stop?.();
      leaveRoom(code);
    }
  };
}
