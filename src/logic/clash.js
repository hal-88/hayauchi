// 術どうしがぶつかったときの判定（6-3）。画面に依存しない。
// 決まり：**先に押した（先に発動した）ほうが優先**。
//
// act（その問題で使われた術1つ）＝ { uid, id, at, target? }
//   uid … 使った人、id … 効き目の術ID（運試し・写し身は出た術／まねした術のID）、at … 押した時刻、target … 封印の相手
//
// - 刀狩り：使った人より「あと」に押された、ほかの人の術は全部効かない。ほかの人の常時型もその問題は効かない
// - 封印：使った人より「あと」に押された、封印された人の術は効かない（つぎの問題からは使えない）
// - 結界：自分より「あと」に押された、自分へのじゃま術は効かない
// - 鏡：自分より「あと」に押された、自分へのじゃま術は、使った人にはね返る
// - 心眼（常時）：見えなくする術はずっと効かない
// - 身代わり（常時）：最初に受けたじゃま術を1回だけ無効

// じゃま術（相手にかかる術）
export const JAMA = new Set([
  'mekuramashi', 'koorase', 'kakuremi', // 忍者の術
  'kemuridama', 'makibishi', 'yurashi', 'bunshin', 'sakasa', 'gozaru', 'kagenui', 'shuriken', 'jousha', // 忍術
]);
// 見えなくする術（心眼で効かない）
export const BLIND = new Set(['mekuramashi', 'kakuremi', 'kemuridama', 'bunshin', 'sakasa']);

/**
 * 効いている術だけを残す（刀狩り・封印で消えたものを取りのぞく）
 * @param {object[]} acts この問題の術
 * @param {Set<string>} sealedBefore 前の問題までに封印された人
 * @returns {{eff: object[], sealed: Set<string>}} sealed＝この問題のあとで封印されている人
 */
export function effectiveActs(acts, sealedBefore = new Set()) {
  const sorted = [...acts].sort((a, b) => a.at - b.at);
  const eff = [];
  const guards = []; // 効いている刀狩り
  const sealed = new Set(sealedBefore);
  for (const a of sorted) {
    if (sealed.has(a.uid)) continue; // 封印されている
    if (guards.some((k) => k.uid !== a.uid)) continue; // 先に刀狩りされている
    eff.push(a);
    if (a.id === 'katanagari') guards.push(a);
    if (a.id === 'fuin' && a.target) sealed.add(a.target);
  }
  return { eff, sealed };
}

/** その人の常時型が、この問題で効くか（ほかの人の刀狩りが効いていたらダメ） */
export function passivesOn(eff, uid) {
  return !eff.some((a) => a.id === 'katanagari' && a.uid !== uid);
}

/**
 * 自分（me）にかかるじゃま術を決める
 * @param {object} o
 * @param {(a:object)=>string[]} o.targetsOf じゃま術 a がだれにかかるか
 * @param {Set<string>} o.myPassives 自分の常時型（この問題で効くものだけ）
 * @param {boolean} o.migawariLeft 身代わりがまだ残っている
 * @returns {{hits:object[], blocked:object[], reflected:object[], migawari:object|null}}
 *   hits＝かかる術、blocked＝ふせいだ術、reflected＝はね返した術（使った人にかかる）、migawari＝身代わりで消した術
 */
export function resolveHits(me, eff, { targetsOf, myPassives = new Set(), migawariLeft = false }) {
  const myKekkai = eff.find((a) => a.uid === me && a.id === 'kekkai');
  const myKagami = eff.find((a) => a.uid === me && a.id === 'kagami');
  const out = { hits: [], blocked: [], reflected: [], migawari: null };
  let migawari = migawariLeft;

  const take = (a) => {
    if (myKekkai && myKekkai.at < a.at) return out.blocked.push(a);
    if (myPassives.has('shingan') && BLIND.has(a.id)) return out.blocked.push(a);
    if (migawari && myPassives.has('migawari')) {
      migawari = false;
      out.migawari = a;
      return;
    }
    out.hits.push(a);
  };

  // ほかの人から自分へのじゃま術
  for (const a of eff) {
    if (a.uid === me || !JAMA.has(a.id) || !targetsOf(a).includes(me)) continue;
    if (myKagami && myKagami.at < a.at) {
      out.reflected.push(a); // 使った人にはね返す
      continue;
    }
    take(a);
  }
  // 自分が使ったじゃま術が、相手の鏡ではね返ってきた
  for (const a of eff) {
    if (a.uid !== me || !JAMA.has(a.id)) continue;
    const back = targetsOf(a).some((t) => {
      if (t === me) return false;
      const k = eff.find((x) => x.uid === t && x.id === 'kagami');
      return k && k.at < a.at;
    });
    if (back) take({ ...a, reflectedBack: true });
  }
  return out;
}

/** 写し身の術でまねする術：自分以外が最後に使った術（効き目の術ID）。なければ null */
export function lastOthersAct(allActs, me) {
  let last = null;
  for (const a of allActs) {
    if (a.uid === me) continue;
    if (!last || a.at > last.at) last = a;
  }
  return last?.id || null;
}
