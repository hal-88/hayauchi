// 術のぶつかり判定のテスト: node scripts/test-clash.mjs
import { effectiveActs, resolveHits, passivesOn, lastOthersAct } from '../src/logic/clash.js';

let fail = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    fail++;
    console.log(`NG ${name}: ${g} ≠ ${w}`);
  }
};
const all = (me) => (a) => ['A', 'B', 'C'].filter((u) => u !== a.uid);
const ids = (l) => l.map((a) => `${a.uid}:${a.id}`);

// 刀狩り：先に押した刀狩りが、あとの術を消す。先に押された術は残る
{
  const { eff } = effectiveActs([
    { uid: 'B', id: 'bageki', at: 100 },
    { uid: 'A', id: 'katanagari', at: 200 },
    { uid: 'C', id: 'kemuridama', at: 300 },
  ]);
  eq('刀狩り', ids(eff), ['B:bageki', 'A:katanagari']);
  eq('刀狩りで常時型が止まる', [passivesOn(eff, 'A'), passivesOn(eff, 'B')], [true, false]);
}
// 封印：あとから押された封印された人の術は効かない／つぎの問題でも
{
  const r = effectiveActs([
    { uid: 'A', id: 'fuin', at: 100, target: 'B' },
    { uid: 'B', id: 'bageki', at: 200 },
  ]);
  eq('封印（同じ問題）', ids(r.eff), ['A:fuin']);
  const r2 = effectiveActs([{ uid: 'B', id: 'tanshuku', at: 50 }], r.sealed);
  eq('封印（つぎの問題）', ids(r2.eff), []);
  const r3 = effectiveActs([
    { uid: 'B', id: 'bageki', at: 50 },
    { uid: 'A', id: 'fuin', at: 100, target: 'B' },
  ]);
  eq('封印より先に押した術は効く', ids(r3.eff), ['B:bageki', 'A:fuin']);
}
// 結界：先に押せばふせぐ／あとだとふせげない
{
  const { eff } = effectiveActs([
    { uid: 'B', id: 'kekkai', at: 100 },
    { uid: 'A', id: 'kemuridama', at: 200 },
  ]);
  eq('結界が先', ids(resolveHits('B', eff, { targetsOf: all() }).blocked), ['A:kemuridama']);
  const e2 = effectiveActs([
    { uid: 'A', id: 'kemuridama', at: 100 },
    { uid: 'B', id: 'kekkai', at: 200 },
  ]).eff;
  eq('結界があと', ids(resolveHits('B', e2, { targetsOf: all() }).hits), ['A:kemuridama']);
}
// 鏡：先に押せば、使った人にはね返る
{
  const { eff } = effectiveActs([
    { uid: 'B', id: 'kagami', at: 100 },
    { uid: 'A', id: 'sakasa', at: 200 },
  ]);
  eq('鏡：Bにはかからない', ids(resolveHits('B', eff, { targetsOf: all() }).hits), []);
  eq('鏡：Bははね返した', ids(resolveHits('B', eff, { targetsOf: all() }).reflected), ['A:sakasa']);
  eq('鏡：Aにかえってくる', ids(resolveHits('A', eff, { targetsOf: all() }).hits), ['A:sakasa']);
  eq('鏡：Cにはふつうにかかる', ids(resolveHits('C', eff, { targetsOf: all() }).hits), ['A:sakasa']);
}
// 心眼・身代わり
{
  const { eff } = effectiveActs([
    { uid: 'A', id: 'mekuramashi', at: 100 },
    { uid: 'C', id: 'makibishi', at: 200 },
  ]);
  const r = resolveHits('B', eff, { targetsOf: all(), myPassives: new Set(['shingan']) });
  eq('心眼：見えなくする術だけふせぐ', [ids(r.blocked), ids(r.hits)], [['A:mekuramashi'], ['C:makibishi']]);
  const m = resolveHits('B', eff, { targetsOf: all(), myPassives: new Set(['migawari']), migawariLeft: true });
  eq('身代わり：最初の1つだけ', [m.migawari && `${m.migawari.uid}:${m.migawari.id}`, ids(m.hits)], ['A:mekuramashi', ['C:makibishi']]);
}
// 写し身：自分以外が最後に使った術
eq('写し身', lastOthersAct([{ uid: 'A', id: 'bageki', at: 1 }, { uid: 'B', id: 'sakasa', at: 5 }, { uid: 'C', id: 'koorase', at: 3 }], 'C'), 'sakasa');
eq('写し身（だれも使っていない）', lastOthersAct([{ uid: 'C', id: 'bageki', at: 1 }], 'C'), null);

console.log(fail === 0 ? 'OK（術のぶつかり判定）' : `${fail} 件 NG`);
process.exit(fail ? 1 : 0);
