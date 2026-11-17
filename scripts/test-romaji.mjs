// ローマ字判定のテスト: node scripts/test-romaji.mjs
import { RomajiMatcher, toRomaji } from '../src/logic/romaji.js';
import { WORDS, SKIPPED } from './words-file.mjs';

let fail = 0;

function typeAll(kana, keys) {
  const m = new RomajiMatcher(kana);
  for (const k of keys) {
    if (!m.input(k)) return { ok: false, at: m.typed + '[' + k + ']' };
  }
  return { ok: m.done, at: m.typed };
}

function ok(kana, keys) {
  const r = typeAll(kana, keys);
  if (!r.ok) {
    fail++;
    console.log(`NG（打てるはず）: ${kana} ← "${keys}"  止まった所: ${r.at}`);
  }
}
function ng(kana, keys) {
  const r = typeAll(kana, keys);
  if (r.ok) {
    fail++;
    console.log(`NG（打てないはず）: ${kana} ← "${keys}"`);
  }
}

// 揺れ
ok('しんぶん', 'shinbunn');
ok('しんぶん', 'sinbunn');
ok('しんぶん', 'shinnbunn');
ok('しんぶん', 'shixnbuxn');
ng('しんぶん', 'shinbun'); // 最後の「ん」は nn
ok('つくえ', 'tsukue');
ok('つくえ', 'tukue');
ok('じしゃく', 'jishaku');
ok('じしゃく', 'zisyaku');
ok('じしゃく', 'jisixyaku');
ok('ちゃいろ', 'chairo');
ok('ちゃいろ', 'tyairo');
ok('ちゃいろ', 'cyairo');
ok('ちゃいろ', 'tixyairo');
ok('じゃんけん', 'jankenn');
ok('じゃんけん', 'zyankenn');
ok('じゃんけん', 'jyannkenn');
ok('ふじさん', 'fujisann');
ok('ふじさん', 'huzisann');
ok('がっこう', 'gakkou');
ok('がっこう', 'gaxtukou');
ok('がっこう', 'galtsukou');
ok('まっちゃ', 'maccha');
ok('まっちゃ', 'matcha');
ok('まっちゃ', 'mattya');
ok('まっちゃ', 'maxtucha');
ok('きっぷ', 'kippu');
ok('ほんや', 'honnya'); // ん＋や は nn
ng('ほんや', 'honya'); // honya は「ほにゃ」
ok('げんいん', 'genninn');
ng('げんいん', 'geninn'); // genin は「げにん」
ok('あんない', 'annnai');
ng('あんない', 'annai'); // ん＋な は nn が必要（annai だと「あんあい」になる）
ok('こんにちは', 'konnnitiha');
ok('ぎゅうにゅう', 'gyuunyuu');
ok('らんどせる', 'randoseru');
ok('のーと', 'no-to');
ok('かんじ', 'kanji');
ok('かんじ', 'kanzi');
ok('てぃっしゅ', 'thisshu');
ok('てぃっしゅ', 'thissyu');
ok('ふぁいる', 'fairu');
ok('ふぁいる', 'fuxairu');
ok('ちょうせん', 'chousenn');
ok('ちょうせん', 'tyousenn');
ok('おべんとう', 'obentou');
ok('くるま', 'curuma');
ng('さくら', 'sakure');

// 単語リスト全部がお手本どおりに打てるか
const seen = new Set();
for (const w of WORDS) {
  if (seen.has(w.kana)) {
    fail++;
    console.log(`NG 重複: ${w.text}（${w.kana}）`);
  }
  seen.add(w.kana);
  if (!/^[ぁ-ゔー]+$/.test(w.kana)) {
    fail++;
    console.log(`NG 読みにひらがな以外: ${w.text}（${w.kana}）`);
  }
  ok(w.kana, toRomaji(w.kana));
}

if (SKIPPED.length) { fail++; console.log('NG words.json で使えない行:', SKIPPED.join(' / ')); }
console.log(fail === 0 ? `OK（単語 ${WORDS.length} 個・揺れテストすべて通過）` : `${fail} 件 NG`);
process.exit(fail ? 1 : 0);
