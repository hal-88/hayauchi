// 部屋（4桁のコード）を作る・入る・出る。部屋のデータの形：
// rooms/{code}/
//   meta    { host, createdAt, status: 'lobby'|'playing'|'done', target }
//   members/{uid} { name, ninja, color, costume, nj, joinedAt, online, left }
//   game    { round, word: {text, kana}, showAt }   … showAt＝巻物が開くサーバー時刻
//   rounds/{n}/winner { uid, ms, at, pts }          … 早い者勝ち（サーバーが先に受けつけた人）
//   rounds/{n}/prog/{uid}  0〜1                      … 打っている進み具合
import { FIREBASE_CONFIG, ONLINE, isLocalMode } from './config.js';
import { createLocalDb } from './localDb.js';

let dbPromise = null;

/** 通信の準備（テストモードか Firebase） */
export function getDb() {
  if (!dbPromise) {
    dbPromise = isLocalMode()
      ? Promise.resolve(createLocalDb())
      : import('./firebaseDb.js').then((m) => m.createFirebaseDb(FIREBASE_CONFIG));
    dbPromise.catch(() => {
      dbPromise = null; // 失敗したら次にもう一度ためせるように
    });
  }
  return dbPromise;
}

const roomPath = (code) => `rooms/${code}`;
const expired = (room, now) => !room?.meta?.createdAt || room.meta.createdAt < now - ONLINE.roomExpireHours * 3600 * 1000;

function memberData(db, profile, equip) {
  return {
    name: profile.name,
    ninja: profile.ninja,
    color: equip.color,
    costume: equip.costume,
    nj: profile.ninjutsu || 'shunsoku', // セットした忍術（二刀流なら忍者の術が2回）
    joinedAt: db.now(),
    online: true,
    left: false,
  };
}

function watchDisconnect(db, code) {
  db.cancelOnDisconnect();
  db.onDisconnectSet(`${roomPath(code)}/members/${db.uid}/online`, false);
}

/** 部屋を作る。もどり値は部屋コード */
export async function createRoom(profile, equip, target) {
  const db = await getDb();
  for (let i = 0; i < 20; i++) {
    const code = String(1000 + Math.floor(Math.random() * 9000));
    const cur = await db.get(roomPath(code));
    if (cur && !expired(cur, db.now())) continue;
    await db.set(roomPath(code), {
      meta: { host: db.uid, createdAt: db.now(), status: 'lobby', target },
      members: { [db.uid]: memberData(db, profile, equip) },
    });
    watchDisconnect(db, code);
    return code;
  }
  throw new Error('部屋コードがいっぱいです。もう一度ためしてね');
}

/** コードで部屋に入る。{ ok:true } か { ok:false, reason } */
export async function joinRoom(code, profile, equip) {
  const db = await getDb();
  const room = await db.get(roomPath(code));
  if (!room || expired(room, db.now())) return { ok: false, reason: 'その部屋は見つからないよ' };
  const mine = room.members?.[db.uid];
  if (room.meta.status !== 'lobby' && !mine) return { ok: false, reason: 'その部屋はもう始まっているよ' };
  const count = Object.values(room.members || {}).filter((m) => !m.left).length;
  if (!mine && count >= ONLINE.maxPlayers) return { ok: false, reason: `その部屋は${ONLINE.maxPlayers}人でいっぱいだよ` };
  await db.set(`${roomPath(code)}/members/${db.uid}`, { ...memberData(db, profile, equip), joinedAt: mine?.joinedAt || db.now() });
  watchDisconnect(db, code);
  return { ok: true };
}

/** 部屋から出る。最後の1人なら部屋ごと消す。ホストが待合室で出たら部屋ごと消す */
export async function leaveRoom(code) {
  const db = await getDb();
  db.cancelOnDisconnect();
  const room = await db.get(roomPath(code));
  if (!room) return;
  const others = Object.entries(room.members || {}).filter(([uid, m]) => uid !== db.uid && m.online && !m.left);
  if (!others.length || (room.meta.status === 'lobby' && room.meta.host === db.uid)) {
    await db.remove(roomPath(code));
  } else if (room.meta.status === 'lobby') {
    await db.remove(`${roomPath(code)}/members/${db.uid}`);
  } else {
    await db.update(`${roomPath(code)}/members/${db.uid}`, { online: false, left: true });
  }
}

/** 部屋の変化を受けとる */
export async function watchRoom(code, cb) {
  const db = await getDb();
  return db.listen(roomPath(code), cb);
}

/** 入った順の参加者（[uid, member] の配列） */
export function sortedMembers(room) {
  return Object.entries(room?.members || {}).sort((a, b) => a[1].joinedAt - b[1].joinedAt);
}

/** 今いる人（オンラインで、出ていない） */
export function activeMembers(room) {
  return sortedMembers(room).filter(([, m]) => m.online && !m.left);
}

/** 今のホスト。ホストが切れていたら、いちばん早く入った人がかわりになる */
export function effectiveHost(room) {
  const h = room?.members?.[room?.meta?.host];
  if (h && h.online && !h.left) return room.meta.host;
  return activeMembers(room)[0]?.[0] || null;
}

/** 点数（rounds の winner から数える） */
export function scoresOf(room) {
  const s = {};
  for (const [uid] of sortedMembers(room)) s[uid] = 0;
  const rounds = Object.entries(room?.rounds || {}).sort((a, b) => +a[0].slice(1) - +b[0].slice(1)); // r1, r2, … の順
  for (const [, r] of rounds) {
    const w = r?.winner;
    if (r?.second?.uid) s[r.second.uid] = (s[r.second.uid] || 0) + (r.second.pts ?? 1); // 二段構えの術：2位でも1点
    if (!w?.uid) continue;
    s[w.uid] = (s[w.uid] || 0) + (w.pts ?? 1) + (w.bonus || 0); // 倍撃の術なら2点・隠し玉なら0〜3点・達人の術の +1
    if (w.steal && s[w.steal] > 0) s[w.steal]--; // 逆転の術：1点うばう
  }
  return s;
}

export function pathOf(code, sub = '') {
  return `${roomPath(code)}${sub ? '/' + sub : ''}`;
}
