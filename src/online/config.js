// みんなで対戦（オンライン）の設定

// Firebase の設定。Firebase コンソールの「プロジェクトの設定 → マイアプリ」に出る firebaseConfig をここに貼る。
// null のあいだは「テストモード」（同じパソコン・同じブラウザの別のタブどうしだけで対戦できる）。
// ※ この値はパスワードではなく、公開して使うもの。安全は database.rules.json のルールで守る。
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBdHHnDyuJ3u_pSqZJf829DhMbCDqpsslY',
  authDomain: 'hayauchi-battle.firebaseapp.com',
  databaseURL: 'https://hayauchi-battle-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'hayauchi-battle',
  storageBucket: 'hayauchi-battle.firebasestorage.app',
  messagingSenderId: '596669780164',
  appId: '1:596669780164:web:aa2e9c0b8616a91999b991',
};

export const ONLINE = {
  minPlayers: 2,
  maxPlayers: 4,
  targets: [5, 10],
  roomExpireHours: 6, // これより古い部屋は、同じコードで作りなおせる
  revealBufferMs: 400, // 次の問題の時刻を決めるとき、全員に届くまでのよゆう
  roundEndMs: 1800, // 1問おわってから次のカウントダウンまで
  roundTimeoutMs: 30000, // だれも打ち切れなかったら、この時間で次の問題へ
  progressEveryMs: 150, // 打っている進み具合を送る間かく
  removeRoomAfterMs: 8000, // 試合が終わってから部屋のデータを消すまで
};

/** テストモードか（設定がない、または URL に ?local） */
export function isLocalMode() {
  return !FIREBASE_CONFIG || new URLSearchParams(location.search).has('local');
}
