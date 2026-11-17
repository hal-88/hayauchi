// Firebase Realtime Database の通信。localDb.js と同じ形で使える。
// Firebase のプログラムは大きいので、みんなで対戦を使うときだけ読みこむ。

export async function createFirebaseDb(config) {
  const [{ initializeApp }, dbMod, authMod] = await Promise.all([
    import('firebase/app'),
    import('firebase/database'),
    import('firebase/auth'),
  ]);
  const { getDatabase, ref, get, set, update, remove, onValue, onDisconnect, runTransaction } = dbMod;
  const { getAuth, signInAnonymously, onAuthStateChanged, setPersistence, browserSessionPersistence } = authMod;

  const app = initializeApp(config);
  const db = getDatabase(app);
  const auth = getAuth(app);
  // テスト用：URL に ?sep をつけると、タブごとに別の人になる（同じパソコンで2人分ためすため）
  if (new URLSearchParams(location.search).has('sep')) await setPersistence(auth, browserSessionPersistence);

  // 名前もメールもいらない「匿名ログイン」。データベースのルールで「ログインした人だけ」にするため
  const uid = await new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(auth, (user) => {
      if (user) {
        stop();
        resolve(user.uid);
      }
    });
    signInAnonymously(auth).catch(reject);
  });

  // サーバーとの時計のずれ（問題を出す時刻を全員でそろえるため）
  let offset = 0;
  onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
    offset = snap.val() || 0;
  });

  const disconnectRefs = [];
  const clean = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

  return {
    kind: 'firebase',
    uid,
    async get(path) {
      const snap = await get(ref(db, path));
      return snap.exists() ? snap.val() : null;
    },
    set: (path, value) => set(ref(db, path), clean(value)),
    update: (path, obj) => update(ref(db, path), clean(obj)),
    remove: (path) => remove(ref(db, path)),
    /** 早い者勝ち：path が空っぽのときだけ value を書く。サーバーが先に受けつけた1人だけ true */
    async claim(path, value) {
      try {
        const res = await runTransaction(ref(db, path), (cur) => (cur == null ? clean(value) : undefined), { applyLocally: false });
        return res.committed;
      } catch {
        return false; // ルールでことわられた（もうだれかが書いた など）
      }
    },
    listen(path, cb) {
      return onValue(ref(db, path), (snap) => cb(snap.exists() ? snap.val() : null));
    },
    onDisconnectSet(path, value) {
      const od = onDisconnect(ref(db, path));
      od.set(value);
      disconnectRefs.push(od);
    },
    cancelOnDisconnect() {
      for (const od of disconnectRefs) od.cancel();
      disconnectRefs.length = 0;
    },
    now: () => Date.now() + offset,
  };
}
