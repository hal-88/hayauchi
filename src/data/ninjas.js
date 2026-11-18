// 忍者8人。starter＝最初から使える、unlockLevel＝CPU戦でそのLvにはじめて勝つと仲間になる
// jutsu＝忍者の術のID（src/logic/jutsu.js で効果を決める）、jutsuInfo＝表示用の名前と説明
export const NINJAS = [
  {
    id: 'kaze', name: '風の忍', color: '#2f8f5b', accent: '#9fe0b0', eye: 'round', symbol: 'wind', starter: true,
    jutsu: 'sakiyomi', jutsuInfo: { name: '先読みの術', desc: 'その問題が2秒早く見える' },
  },
  {
    id: 'kaminari', name: '雷の忍', color: '#d49a00', accent: '#fff07a', eye: 'sharp', symbol: 'bolt', starter: true,
    jutsu: 'tanshuku', jutsuInfo: { name: '短縮の術', desc: 'その問題の文字数が半分になる' },
  },
  {
    id: 'honoo', name: '炎の忍', color: '#cf3b27', accent: '#ffb259', eye: 'fierce', symbol: 'fire', starter: true,
    jutsu: 'bageki', jutsuInfo: { name: '倍撃の術', desc: 'その問題を取ったら2点' },
  },
  {
    id: 'tetsu', name: '鉄の忍', color: '#5f6b7a', accent: '#c9d3df', eye: 'flat', symbol: 'iron', starter: true,
    jutsu: 'teppeki', jutsuInfo: { name: '鉄壁の術', desc: 'その問題を相手に取られても、相手に点が入らない' },
  },
  {
    id: 'kage', name: '影の忍', color: '#2a2838', accent: '#8f7bd6', eye: 'narrow', symbol: 'shadow', unlockLevel: 2,
    jutsu: 'mekuramashi', jutsuInfo: { name: '目くらましの術', desc: 'その問題の間、相手の画面が1秒ぼやける' },
  },
  {
    id: 'koori', name: '氷の忍', color: '#3d9bd1', accent: '#d8f3ff', eye: 'round', symbol: 'ice', unlockLevel: 3,
    jutsu: 'koorase', jutsuInfo: { name: 'こおらせの術', desc: 'その問題の最初の1秒、相手が打てなくなる' },
  },
  {
    id: 'kiri', name: '霧の忍', color: '#8793a6', accent: '#eef2f7', eye: 'sleepy', symbol: 'mist', unlockLevel: 4,
    jutsu: 'kakuremi', jutsuInfo: { name: 'かくれみの術', desc: 'その問題の間、相手の画面からふりがなが消える' },
  },
  {
    id: 'tsuki', name: '月の忍', color: '#3f3577', accent: '#f2cf5b', eye: 'calm', symbol: 'moon', unlockLevel: 5,
    jutsu: 'gyakuten', jutsuInfo: { name: '逆転の術', desc: '負けているときだけ使える。その問題を取ったら1位の人から1点うばう' },
  },
];

export const STARTER_IDS = NINJAS.filter((n) => n.starter).map((n) => n.id);

export function getNinja(id) {
  return NINJAS.find((n) => n.id === id) || NINJAS[0];
}

/** CPU戦の相手。Lv2〜5は、勝つと仲間になる忍者。Lv1は最初の4人からランダム */
export function cpuNinjaFor(level, rng = Math.random) {
  const n = NINJAS.find((x) => x.unlockLevel === level);
  if (n) return n;
  const starters = NINJAS.filter((x) => x.starter);
  return starters[Math.floor(rng() * starters.length)];
}
