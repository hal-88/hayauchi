// 忍術（30個）。試合前に1つセットする。
// rank：1＝★下忍 2＝★★中忍 3＝★★★上忍（派手さ・おもしろさの目安。強さには差をつけない）
// type：active＝発動（カウントダウン中にエンター・1試合1回）、passive＝常時（セットしておくだけ）、special＝二刀流
// starter：最初から覚えている
// 効果の中身は 6-2（発動型）・6-3（常時型と、術どうしがからむもの）で作る
export const NINJUTSU_CATS = [
  { id: 'seme', label: '攻め', color: '#cf3b27' },
  { id: 'mamori', label: '守り', color: '#2f6fb0' },
  { id: 'jama', label: 'じゃま', color: '#7a4bb0' },
  { id: 'toku', label: '特殊', color: '#2f8f5b' },
];

const L = (cat, rows) =>
  rows.map(([id, name, rank, type, desc, starter]) => ({ id, name, rank, type, desc, cat, starter: !!starter }));

export const NINJUTSU = [
  ...L('seme', [
    ['shunsoku', '瞬足の術', 1, 'active', 'その問題の最初の3文字が自動で入力される', true],
    ['suketto', '助っ人の術', 1, 'active', 'その問題でミスしたら、次に打つキーが光って教えてくれる', true],
    ['yokoku', '予告の術', 1, 'active', '次の問題の1文字目だけ先に見える'],
    ['shoryaku', '省略の術', 1, 'active', 'その問題は「っ」と「ー」を打たなくていい'],
    ['nidan', '二段構えの術', 2, 'active', 'その問題で2位でも1点もらえる'],
    ['tatsujin', '達人の術', 2, 'passive', 'ノーミスで3問取ると、1点ボーナス'],
    ['kakushidama', '隠し玉の術', 3, 'active', 'その問題を取ったときの得点が0〜3点のランダムになる'],
  ]),
  ...L('mamori', [
    ['kekkai', '結界の術', 1, 'active', 'その問題の間、相手のじゃま術が全部効かない', true],
    ['migawari', '身代わりの術', 1, 'passive', '最初に受けたじゃま術を1回だけ無効にする'],
    ['shingan', '心眼の術', 2, 'passive', '「見えなくする術」（目くらまし・かくれみの・煙玉・分身・逆さ）がずっと効かない'],
    ['kagami', '鏡の術', 3, 'active', 'その問題で受けたじゃま術を、使った相手にはね返す'],
  ]),
  ...L('jama', [
    ['kemuridama', '煙玉の術', 1, 'active', '相手の画面の下半分が1.5秒けむりで見えない'],
    ['makibishi', 'まきびしの術', 1, 'active', 'その問題で相手が最初にミスしたら、0.5秒止まる'],
    ['yurashi', '揺らしの術', 1, 'active', '相手の画面の文字が2秒ゆれる'],
    ['bunshin', '分身の術', 2, 'active', '相手の画面にニセの問題が0.5秒出る'],
    ['sakasa', '逆さの術', 2, 'active', '相手の画面の問題が1秒だけ上下さかさまになる'],
    ['shuriken', '手裏剣の術', 2, 'active', 'その問題を取ったら、2位の人の次の問題が1文字増える'],
    ['kagenui', '影縫いの術', 2, 'active', 'その問題は、1位の人だけ1秒おそく見える'],
    ['gozaru', 'ござるの術', 3, 'active', '相手の問題の最後に「ござる」がつく'],
  ]),
  ...L('toku', [
    ['nintai', '忍耐の術', 1, 'passive', '3問連続で取られると、次の問題が2秒早く見える'],
    ['kishikaisei', '起死回生の術', 1, 'passive', '相手があと1点で勝ちになったら、自分の問題が少し短くなる'],
    ['konoha', '木の葉隠れの術', 1, 'active', 'その問題は、自分がどこまで打ったか相手から見えない'],
    ['rengeki', '連撃の術', 2, 'passive', '3問連続で取ると、次の問題が1文字少なくなる'],
    ['undameshi', '運試しの術', 2, 'active', '9人の忍者の術のどれかがランダムで発動する'],
    ['shinobiashi', '忍び足の術', 2, 'active', 'その問題では、術を使ったことが相手に表示されない'],
    ['manekineko', '招き猫の術', 2, 'passive', '試合に勝つと、もらえる巻物が多くなる'],
    ['nitoryu', '二刀流の術', 3, 'special', '自分の忍者の術をもう1回使える（忍者の術を2回使えるようになる）'],
    ['fuin', '封印の術', 3, 'active', '1位の人がまだ使っていない術（忍者の術・忍術とも）を、この試合では使えなくする'],
    ['utsushimi', '写し身の術', 3, 'active', '直前に相手が使った術をまねして使う。まだ誰も使っていなければ発動できない'],
    ['katanagari', '刀狩りの術', 3, 'active', 'その問題の間、自分以外の全員の術（常時型もふくむ）が効かなくなる'],
  ]),
];

export const NINJUTSU_STARTERS = NINJUTSU.filter((j) => j.starter).map((j) => j.id);

export const getNinjutsu = (id) => NINJUTSU.find((j) => j.id === id) || null;

export const stars = (rank) => '★'.repeat(rank);
export const rankName = (rank) => ['', '下忍', '中忍', '上忍'][rank];
export const typeLabel = (type) => ({ active: '発動', passive: '常時', special: '―' })[type];
export const catOf = (id) => NINJUTSU_CATS.find((c) => c.id === id);

// 巻物の決まり
export const SCROLL_RULES = {
  learnCost: 5, // 忍術を覚える1回
  learn10Cost: 50, // 10連（10回分）
  learn10Count: 10,
  learn10Min: 2, // 10連は ★★以上が1つ確定
  dupRefund: 2, // もう覚えていた術が出たらもどる
  join: 2, // 対戦に参加
  onlineWin: 3, // みんなで対戦の1位
  manekiWin: 2, // 招き猫の術で勝ったとき
  sixtyPer: 10, // 60秒チャレンジ：打てたことば10こごとに1本
  sixtyMax: 4, // 60秒チャレンジで（自己ベストの分をのぞいて）もらえるのは4本まで
  heikeClear: 2, // 平家物語チャレンジを最後まで打ち切った
  bestBonus: 2, // 60秒・平家物語で自己ベストを更新した
  rates: [0.6, 0.3, 0.1], // ★・★★・★★★ の出る確率
};
