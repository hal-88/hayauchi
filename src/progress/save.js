// 記録はこの端末のブラウザ（localStorage）にだけ保存する
import { NINJAS, STARTER_IDS } from '../data/ninjas.js';
import { ALL_ITEMS, DEFAULT_ITEMS, itemKey, REWARDS } from '../data/rewards.js';
import { NINJUTSU, NINJUTSU_STARTERS, SCROLL_RULES, getNinjutsu } from '../data/ninjutsu.js';

const KEY = 'hayauchi.save';
const listeners = new Set();

function fresh() {
  return {
    v: 1,
    profile: null, // { name, ninja, ninjutsu }
    ninjas: [...STARTER_IDS],
    ninjutsu: [...NINJUTSU_STARTERS], // 覚えた忍術
    scrolls: 0, // 巻物（忍術を覚えるのに使う）
    items: [...DEFAULT_ITEMS],
    equip: { color: 'base', costume: 'none', bg: 'yoru', sound: 'pop', effect: 'spark' },
    cpu: { wins: {}, losses: {} },
    solo: { bestMs: null },
  };
}

let data = fresh();
try {
  const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (raw && raw.v === 1) {
    const f = fresh();
    data = {
      ...f,
      ...raw,
      equip: { ...f.equip, ...raw.equip },
      cpu: { wins: { ...raw.cpu?.wins }, losses: { ...raw.cpu?.losses } },
      solo: { ...f.solo, ...raw.solo },
      ninjas: [...new Set([...f.ninjas, ...(raw.ninjas || [])])],
      items: [...new Set([...f.items, ...(raw.items || [])])],
      ninjutsu: [...new Set([...f.ninjutsu, ...(raw.ninjutsu || [])])],
      scrolls: Number.isFinite(raw.scrolls) ? raw.scrolls : 0,
    };
  }
} catch {
  /* こわれていたら最初から */
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* 保存できない環境でも遊べる */
  }
  listeners.forEach((fn) => fn(data));
}

/** 保存内容が変わったら呼ばれる（ヘッダーや背景の更新用） */
export function onSaveChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getSave = () => data;
export const getProfile = () => data.profile;
export const getEquip = () => data.equip;

export function setProfile(name, ninja) {
  data.profile = { ninjutsu: NINJUTSU_STARTERS[0], ...data.profile, name, ninja };
  persist();
}

// ---------- 忍術と巻物 ----------
export const hasNinjutsu = (id) => data.ninjutsu.includes(id);
export const getScrolls = () => data.scrolls;
/** セットしている忍術のID */
export const getMyNinjutsu = () => (data.profile?.ninjutsu && hasNinjutsu(data.profile.ninjutsu) ? data.profile.ninjutsu : NINJUTSU_STARTERS[0]);

export function setNinjutsu(id) {
  if (!data.profile || !hasNinjutsu(id)) return;
  data.profile.ninjutsu = id;
  persist();
}

function addScrolls(n) {
  data.scrolls = Math.max(0, data.scrolls + n);
}

/**
 * 忍術を覚える（ガチャ）。巻物5本を使う。★60%・★★30%・★★★10%。覚えていた術なら巻物2本もどる
 * @returns {null | {id, rank, dup:boolean}} 巻物が足りなければ null
 */
export function learnNinjutsu(rng = Math.random) {
  if (data.scrolls < SCROLL_RULES.learnCost) return null;
  addScrolls(-SCROLL_RULES.learnCost);
  const r = rng();
  const [p1, p2] = SCROLL_RULES.rates;
  const rank = r < p1 ? 1 : r < p1 + p2 ? 2 : 3;
  const pool = NINJUTSU.filter((j) => j.rank === rank);
  const pick = pool[Math.floor(rng() * pool.length)];
  const dup = hasNinjutsu(pick.id);
  if (dup) addScrolls(SCROLL_RULES.dupRefund);
  else data.ninjutsu.push(pick.id);
  persist();
  return { id: pick.id, rank, dup };
}

/** みんなで対戦の巻物（参加＋1位ボーナス＋招き猫） */
export function recordOnlineMatch(rank) {
  let n = SCROLL_RULES.join;
  if (rank === 1) {
    n += SCROLL_RULES.onlineWin;
    if (getMyNinjutsu() === 'manekineko') n += SCROLL_RULES.manekiWin;
  }
  addScrolls(n);
  persist();
  return n;
}

export const hasNinja = (id) => data.ninjas.includes(id);
export const hasItem = (kind, id) => data.items.includes(itemKey(kind, id));

export function equip(kind, id) {
  if (!hasItem(kind, id)) return;
  data.equip[kind] = id;
  persist();
}

export function cpuWins(level) {
  return data.cpu.wins[level] || 0;
}

/**
 * CPU戦の結果を記録して、巻物とごほうびを決める。
 * 巻物：参加で2本、勝つと＋Lvの数（招き猫の術ならさらに＋2）。
 * ごほうび：Lv2〜5にはじめて勝つ→その忍者が仲間に。それ以外の勝ち→持っていない見た目のごほうびをランダムで1つ。
 * @returns {{scrolls:number, reward: null | {type:'ninja', id} | {type:'item', kind, id} | {type:'complete'}}}
 */
export function recordCpuMatch(level, win, rng = Math.random) {
  const box = win ? data.cpu.wins : data.cpu.losses;
  const before = box[level] || 0;
  box[level] = before + 1;
  let scrolls = SCROLL_RULES.join;
  if (win) scrolls += level + (getMyNinjutsu() === 'manekineko' ? SCROLL_RULES.manekiWin : 0);
  addScrolls(scrolls);
  let reward = null;
  if (win) {
    const n = NINJAS.find((x) => x.unlockLevel === level);
    if (n && before === 0 && !hasNinja(n.id)) {
      data.ninjas.push(n.id);
      reward = { type: 'ninja', id: n.id };
    } else {
      const left = ALL_ITEMS.filter((x) => !hasItem(x.kind, x.id));
      if (left.length) {
        const pick = left[Math.floor(rng() * left.length)];
        data.items.push(itemKey(pick.kind, pick.id));
        reward = { type: 'item', kind: pick.kind, id: pick.id };
      } else {
        reward = { type: 'complete' };
      }
    }
  }
  persist();
  return { scrolls, reward };
}

/** 1人でしゅぎょうの自己ベスト。更新したら true */
export function recordSolo(totalMs) {
  const best = data.solo.bestMs;
  const isBest = best === null || totalMs < best;
  if (isBest) data.solo.bestMs = totalMs;
  persist();
  return isBest;
}

export function collectionCount() {
  const total = Object.values(REWARDS).reduce((a, l) => a + l.length, 0) + NINJAS.length;
  return { have: data.items.length + data.ninjas.length, total };
}

export function ninjutsuCount() {
  return { have: data.ninjutsu.filter((id) => getNinjutsu(id)).length, total: NINJUTSU.length };
}
