// テストモードの通信（Firebase の代わり）。
// 同じパソコン・同じブラウザの別のタブどうしで、データを共有する（localStorage と BroadcastChannel）。
// firebaseDb.js と同じ形で使える。

const KEY = 'hayauchi-localdb-v1';
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('hayauchi-localdb') : null;

const split = (path) => path.split('/').filter(Boolean);

function readTree() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function getAt(tree, path) {
  let cur = tree;
  for (const k of split(path)) {
    if (cur == null || typeof cur !== 'object') return null;
    cur = cur[k];
  }
  return cur === undefined ? null : cur;
}

function setAt(tree, path, value) {
  const keys = split(path);
  let cur = tree;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  const last = keys[keys.length - 1];
  if (value === null || value === undefined) delete cur[last];
  else cur[last] = JSON.parse(JSON.stringify(value));
  return tree;
}

export function createLocalDb() {
  let uid = null;
  try {
    uid = sessionStorage.getItem('hayauchi-local-uid');
    if (!uid) {
      uid = 'u' + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('hayauchi-local-uid', uid);
    }
  } catch {
    uid = 'u' + Math.random().toString(36).slice(2, 10);
  }

  const listeners = new Set(); // { path, cb, last }
  const disconnectOps = [];

  function notify() {
    const tree = readTree();
    for (const l of listeners) {
      const v = getAt(tree, l.path);
      const s = JSON.stringify(v);
      if (s !== l.last) {
        l.last = s;
        l.cb(v);
      }
    }
  }

  function write(mutate) {
    const tree = readTree();
    mutate(tree);
    try {
      localStorage.setItem(KEY, JSON.stringify(tree));
    } catch {
      /* いっぱいのときは無視 */
    }
    channel?.postMessage('changed');
    setTimeout(notify, 0); // 書いた人にも届く（Firebase と同じ）
  }

  channel?.addEventListener('message', notify);
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) notify();
  });
  window.addEventListener('pagehide', () => {
    for (const op of disconnectOps) write((t) => setAt(t, op.path, op.value));
  });

  return {
    kind: 'local',
    uid,
    async get(path) {
      return getAt(readTree(), path);
    },
    async set(path, value) {
      write((t) => setAt(t, path, value));
    },
    async update(path, obj) {
      write((t) => {
        for (const [k, v] of Object.entries(obj)) setAt(t, `${path}/${k}`, v);
      });
    },
    async remove(path) {
      write((t) => setAt(t, path, null));
    },
    /** 早い者勝ち：path が空っぽのときだけ value を書く。書けたら true */
    async claim(path, value) {
      if (getAt(readTree(), path) != null) return false;
      write((t) => setAt(t, path, value));
      return true;
    },
    /** path の値が変わるたびに cb(value)。もどり値でやめる */
    listen(path, cb) {
      const l = { path, cb, last: undefined };
      listeners.add(l);
      setTimeout(notify, 0);
      return () => listeners.delete(l);
    },
    /** 通信が切れたら（タブを閉じたら）path に value を書く */
    onDisconnectSet(path, value) {
      disconnectOps.push({ path, value });
    },
    cancelOnDisconnect() {
      disconnectOps.length = 0;
    },
    /** サーバーの時刻（テストモードはこのパソコンの時計） */
    now: () => Date.now(),
  };
}
