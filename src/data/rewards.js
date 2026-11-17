// 見た目と音のごほうび（強さには関係しない）。def＝最初から持っている
export const REWARD_KINDS = [
  { kind: 'color', label: '色ちがい' },
  { kind: 'costume', label: '衣装' },
  { kind: 'bg', label: '背景' },
  { kind: 'sound', label: 'タイピング音' },
  { kind: 'effect', label: 'エフェクト' },
];

export const REWARDS = {
  color: [
    { id: 'base', name: 'いつもの色', def: true },
    { id: 'beni', name: '紅（べに）', value: '#c8323c' },
    { id: 'ai', name: '藍（あい）', value: '#2d4a8a' },
    { id: 'wakatake', name: '若竹（わかたけ）', value: '#5a9e4b' },
    { id: 'kin', name: '金（きん）', value: '#c99a2e' },
    { id: 'sumi', name: '墨（すみ）', value: '#33333d' },
    { id: 'sakura', name: '桜（さくら）', value: '#e07fa3' },
    { id: 'murasaki', name: '紫（むらさき）', value: '#6c4a9c' },
  ],
  costume: [
    { id: 'none', name: 'なし', def: true },
    { id: 'scarf', name: '赤いマフラー' },
    { id: 'kasa', name: '旅の笠（かさ）' },
    { id: 'kitsune', name: 'きつねのお面' },
    { id: 'katana', name: '背中の刀' },
    { id: 'kanzashi', name: '花のかんざし' },
  ],
  bg: [
    { id: 'yoru', name: '夜の里', def: true },
    { id: 'chikurin', name: '竹林' },
    { id: 'shiro', name: '月夜の城' },
    { id: 'yuuyake', name: '夕焼けの屋根' },
    { id: 'yuki', name: '雪の里' },
    { id: 'sakura', name: '桜の里' },
  ],
  sound: [
    { id: 'pop', name: 'ポン', def: true },
    { id: 'taiko', name: '太鼓（たいこ）' },
    { id: 'suzu', name: '鈴（すず）' },
    { id: 'shuriken', name: '手裏剣（しゅりけん）' },
    { id: 'mokkin', name: '木琴（もっきん）' },
    { id: 'hyoushigi', name: '拍子木（ひょうしぎ）' },
  ],
  effect: [
    { id: 'spark', name: 'きらり', def: true },
    { id: 'shuriken', name: '手裏剣' },
    { id: 'petal', name: '花びら' },
    { id: 'smoke', name: 'けむり玉' },
    { id: 'bolt', name: 'いなずま' },
    { id: 'star', name: 'ほし' },
  ],
};

export const itemKey = (kind, id) => `${kind}:${id}`;

export const DEFAULT_ITEMS = Object.entries(REWARDS).flatMap(([kind, list]) =>
  list.filter((x) => x.def).map((x) => itemKey(kind, x.id))
);

export const ALL_ITEMS = Object.entries(REWARDS).flatMap(([kind, list]) => list.map((x) => ({ kind, ...x })));

export function getItem(kind, id) {
  return (REWARDS[kind] || []).find((x) => x.id === id) || REWARDS[kind][0];
}

export function kindLabel(kind) {
  return REWARD_KINDS.find((k) => k.kind === kind)?.label || kind;
}
