// 忍術（自分でセットする術）の決まりごと。画面に依存しない。
// 術どうしがぶつかったときの判定は clash.js。
import { NINJAS } from '../data/ninjas.js';
import { getNinjutsu } from '../data/ninjutsu.js';
import { canUseJutsu } from './jutsu.js';

export const NJ_RULES = {
  shunsokuKeys: 3, // 瞬足：最初の3文字（ローマ字）を自動で打つ
  smokeMs: 1500, // 煙玉
  wobbleMs: 2000, // 揺らし
  fakeMs: 500, // 分身
  flipMs: 1000, // 逆さ
  makibishiMs: 500, // まきびし：最初のミスで止まる時間
  kagenuiMs: 1000, // 影縫い：1位の人だけおそく見える
  nidanGraceMs: 3000, // 二段構え：だれかが取ったあと、打ち切るのを待つ時間
};

// 使える発動型の忍術（6-3 で全部そろった）
export const NJ_READY = new Set([
  'shunsoku', 'suketto', 'yokoku', 'shoryaku', 'nidan', 'kakushidama',
  'kekkai', 'kagami',
  'kemuridama', 'makibishi', 'yurashi', 'bunshin', 'sakasa', 'shuriken', 'kagenui', 'gozaru',
  'konoha', 'undameshi', 'shinobiashi', 'fuin', 'utsushimi', 'katanagari',
]);

// 常時型（セットしておくだけ）
export const NJ_PASSIVE = new Set(['tatsujin', 'migawari', 'shingan', 'nintai', 'kishikaisei', 'rengeki', 'manekineko']);

// 常時型の数
export const PASSIVE_RULES = {
  tatsujinWins: 3, // 達人：ノーミスで3問取るたびに +1点
  nintaiLosses: 3, // 忍耐：3問つづけて取られたら、つぎの問題が2秒早く見える
  rengekiWins: 3, // 連撃：3問つづけて取ったら、つぎの問題が1文字少ない
};

/** 忍者の術を1試合に何回使えるか（二刀流なら2回） */
export function ninjaJutsuLimit(ninjutsuId) {
  return ninjutsuId === 'nitoryu' ? 2 : 1;
}

const SMALL = new Set([...'ぁぃぅぇぉゃゅょゎ']);
/** 起死回生の術：問題が少し短くなる（うしろを4分の1ほど） */
export function kishikaiseiKana(kana) {
  const n = kana.length;
  if (n <= 3) return { kana, cut: '' };
  let keep = n - Math.max(1, Math.floor(n / 4));
  while (keep < n && SMALL.has(kana[keep])) keep++;
  if (keep < n && kana[keep - 1] === 'っ') keep++;
  if (keep >= n) return { kana, cut: '' };
  return { kana: kana.slice(0, keep), cut: kana.slice(keep) };
}

/** 連撃の術：問題が1文字少なくなる */
export function rengekiKana(kana) {
  if (kana.length <= 2) return { kana, cut: '' };
  const keep = kana.length - 1;
  if (kana[keep - 1] === 'っ') return { kana, cut: '' }; // 「っ」で終わってしまうときはそのまま
  return { kana: kana.slice(0, keep), cut: kana.slice(keep) };
}

// 相手の画面・打ち方にかかる忍術（じゃま）
export const NJ_ATTACK = new Set(['kemuridama', 'makibishi', 'yurashi', 'bunshin', 'sakasa', 'gozaru']);

/**
 * いまその忍術を発動できるか
 * @returns {{ok:boolean, why?:string}}
 */
export function canUseNinjutsu(id) {
  const j = getNinjutsu(id);
  if (!j) return { ok: false, why: '' };
  if (j.type === 'passive') return { ok: false, why: 'セットしておくだけで効く術' };
  if (j.type === 'special') return { ok: false, why: '忍者の術を2回使える' };
  if (!NJ_READY.has(id)) return { ok: false, why: 'じゅんび中' };
  return { ok: true };
}

/** 省略の術：「っ」と「ー」を打たなくていい */
export function shoryakuKana(kana) {
  const out = kana.replace(/[っー]/g, '');
  return out.length ? out : kana;
}

/** ござるの術：問題の最後に「ござる」がつく */
export function gozaruWord(word) {
  return { ...word, text: `${word.text}ござる`, kana: `${word.kana}ござる` };
}

const EXTRA = [...'あいうえお'];
/** 手裏剣の術：問題が1文字増える */
export function extendWord(word, rng = Math.random) {
  const c = EXTRA[Math.floor(rng() * EXTRA.length)];
  return { ...word, text: `${word.text}${c}`, kana: `${word.kana}${c}` };
}

/** 隠し玉の術：取ったときの得点 0〜3 */
export function kakushidamaPoints(rng = Math.random) {
  return Math.floor(rng() * 4);
}

/** 運試しの術：8人の忍者の術からランダム（逆転の術は負けているときだけ候補） */
export function undameshiPick(myScore, bestOther, rng = Math.random) {
  const ids = NINJAS.map((n) => n.jutsu).filter((id) => canUseJutsu(id, myScore, bestOther).ok);
  return ids[Math.floor(rng() * ids.length)];
}

/** 影縫いの術がかかる人：使った人以外で、いちばん点が多い人（同点なら全員） */
export function kagenuiTargets(scores, userId, order) {
  const others = order.filter((id) => id !== userId);
  if (!others.length) return [];
  const max = Math.max(...others.map((id) => scores[id] || 0));
  return others.filter((id) => (scores[id] || 0) === max);
}

/** 分身の術で見せるニセの問題 */
export function fakeWordFor(word, words, rng = Math.random) {
  const pool = words.filter((w) => w.kana !== word.kana);
  return pool[Math.floor(rng() * pool.length)] || word;
}
