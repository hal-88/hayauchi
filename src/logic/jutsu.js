// 忍者の術（1試合1回・カウントダウン中に X キー）。画面に依存しない決まりごと。
import { NINJAS, getNinja } from '../data/ninjas.js';

export const JUTSU_RULES = {
  previewMs: 2000, // 先読み：2秒早く見える（打てるのはみんなと同じ時刻）
  blurMs: 1000, // 目くらまし：相手の画面が1秒ぼやける
  freezeMs: 1000, // こおらせ：最初の1秒打てない
  missStopMs: 300, // ふだんのルール：ミスすると0.3秒止まる（鉄壁の術なら止まらない）
  lastCallMs: 200, // 出る直前のこの時間は使えない（全員に届くまでのよゆう）
};

// 相手にかかる術
export const ATTACK_JUTSU = new Set(['mekuramashi', 'koorase', 'kakuremi']);

/** 忍者の術のID */
export function jutsuOf(ninjaId) {
  return getNinja(ninjaId).jutsu;
}

/** 術の表示名（IDから） */
export function jutsuName(jutsuId) {
  return NINJAS.find((n) => n.jutsu === jutsuId)?.jutsuInfo.name || jutsuId;
}

/**
 * 今その術を使えるか。逆転の術は負けているときだけ
 * @returns {{ok:boolean, why?:string}}
 */
export function canUseJutsu(jutsuId, myScore, bestOtherScore) {
  if (jutsuId === 'gyakuten' && !(myScore < bestOtherScore)) return { ok: false, why: '負けているときだけ使えるよ' };
  return { ok: true };
}

const SMALL = new Set([...'ぁぃぅぇぉゃゅょゎ']);

/** 短縮の術：読みを半分にする（「きょ」「っ」などの途中で切らない） */
export function shortenKana(kana) {
  const n = kana.length;
  let cut = Math.max(2, Math.ceil(n / 2));
  const fix = () => {
    while (cut < n && SMALL.has(kana[cut])) cut++;
  };
  fix();
  if (cut < n && kana[cut - 1] === 'っ') {
    cut++;
    fix();
  }
  if (cut >= n) return { kana, cut: '' };
  return { kana: kana.slice(0, cut), cut: kana.slice(cut) };
}

/** 逆転の術でうばう相手（自分以外でいちばん点が多い人。同点なら先に並んでいる人） */
export function leaderToSteal(scores, myId, order) {
  let best = null;
  for (const id of order) {
    if (id === myId) continue;
    if (best === null || (scores[id] || 0) > (scores[best] || 0)) best = id;
  }
  return best;
}
