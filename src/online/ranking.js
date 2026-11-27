// 60秒チャレンジのランキング（クラスみんなで競う）。Firebase の ranking/sixty に1人1つ、いちばんよい記録だけ置く。
// 同じ iPad を何人かで使っても分かれるように、キーは「この端末のID＋ニックネーム」。
import { getDb } from './room.js';

const PATH = 'ranking/sixty';
const WAIT_MS = 8000; // つながらないときは あきらめる

/** ニックネームを短い文字に（Firebase のキーに使えない文字があるため） */
function nameCode(name) {
  let h = 5381;
  for (const c of String(name)) h = ((h * 33) ^ c.codePointAt(0)) >>> 0;
  return h.toString(36);
}

const withTimeout = (p) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('時間切れ')), WAIT_MS))]);

/** よい記録か：ことばの数が多いほう、同じなら正しく打ったキーが多いほう */
export const better = (a, b) => !b || a.words > b.words || (a.words === b.words && a.keys > b.keys);

/** ランキングを、よい順に。{ key, name, ninja, color, costume, words, keys, mine } の配列（mine＝今のニックネームの自分） */
export async function loadSixty(myName) {
  const db = await withTimeout(getDb());
  const all = (await withTimeout(db.get(PATH))) || {};
  const myKey = `${db.uid}_${nameCode(myName)}`;
  return Object.entries(all)
    .map(([key, v]) => ({ key, ...v, mine: key === myKey }))
    .filter((v) => Number.isFinite(v.words) && v.name)
    .sort((a, b) => b.words - a.words || b.keys - a.keys || a.at - b.at);
}

/** 記録を送る（前の記録よりよいときだけ書きかえる）。もどり値は { key, saved } */
export async function submitSixty(profile, equip, rec) {
  const db = await withTimeout(getDb());
  const key = `${db.uid}_${nameCode(profile.name)}`;
  const cur = await withTimeout(db.get(`${PATH}/${key}`));
  if (!better(rec, cur)) return { key, saved: false };
  await withTimeout(
    db.set(`${PATH}/${key}`, {
      name: profile.name,
      ninja: profile.ninja,
      color: equip.color,
      costume: equip.costume,
      words: rec.words,
      keys: rec.keys,
      miss: rec.miss,
      at: db.now(),
    })
  );
  return { key, saved: true };
}

// ---------- 平家物語チャレンジ（ranking/heike）：タイムが短いほどよい ----------
const JG_PATH = 'ranking/heike';

/** よい記録か：タイム（ミスの +0.5秒こみ）が短いほう */
export const betterHeike = (a, b) => !b || a.ms < b.ms;

/** 平家物語のランキングを、速い順に。{ key, name, ninja, color, costume, ms, miss, mine } の配列 */
export async function loadHeike(myName) {
  const db = await withTimeout(getDb());
  const all = (await withTimeout(db.get(JG_PATH))) || {};
  const myKey = `${db.uid}_${nameCode(myName)}`;
  return Object.entries(all)
    .map(([key, v]) => ({ key, ...v, mine: key === myKey }))
    .filter((v) => Number.isFinite(v.ms) && v.name)
    .sort((a, b) => a.ms - b.ms || a.at - b.at);
}

/** 平家物語の記録を送る（前より速いときだけ書きかえる）。もどり値は { key, saved } */
export async function submitHeike(profile, equip, rec) {
  const db = await withTimeout(getDb());
  const key = `${db.uid}_${nameCode(profile.name)}`;
  const cur = await withTimeout(db.get(`${JG_PATH}/${key}`));
  if (!betterHeike(rec, cur)) return { key, saved: false };
  await withTimeout(
    db.set(`${JG_PATH}/${key}`, {
      name: profile.name,
      ninja: profile.ninja,
      color: equip.color,
      costume: equip.costume,
      ms: rec.ms,
      miss: rec.miss,
      at: db.now(),
    })
  );
  return { key, saved: true };
}
