// 出題することば。ほんものは public/words.json（先生が GitHub の画面で直せる）。
// 起動するときに読みこむ。読めなかったときだけ、下の予備のことばを使う。

// 予備（words.json がこわれていたとき・読めなかったとき用）
const FALLBACK = `
地図,ちず
宇宙,うちゅう
図書館,としょかん
給食,きゅうしょく
算数,さんすう
音楽,おんがく
運動会,うんどうかい
修学旅行,しゅうがくりょこう
鉛筆,えんぴつ
新幹線,しんかんせん
自転車,じてんしゃ
地球,ちきゅう
夏休み,なつやすみ
宿題,しゅくだい
友達,ともだち
教室,きょうしつ
体育館,たいいくかん
動物園,どうぶつえん
実験,じっけん
富士山,ふじさん
挑戦,ちょうせん
発表,はっぴょう
冒険,ぼうけん
宝物,たからもの
雪合戦,ゆきがっせん
天体観測,てんたいかんそく
恐竜,きょうりゅう
牛乳,ぎゅうにゅう
本屋,ほんや
サッカー,さっかー
`
  .trim()
  .split('\n')
  .map((line) => {
    const [text, kana] = line.split(',');
    return { text, kana };
  });

const KANA_OK = /^[ぁ-ゔー]+$/;

/**
 * words.json の中身を読みとる（ことば・よみ のチェックもする）
 * @returns {{words:{text:string,kana:string}[], skipped:string[]}}
 */
export function parseWordsJson(json) {
  const list = Array.isArray(json) ? json : json?.['ことば'];
  if (!Array.isArray(list)) throw new Error('「ことば」のリストが見つからない');
  const words = [];
  const skipped = [];
  const seen = new Set();
  for (const item of list) {
    const text = String(item?.['ことば'] ?? item?.text ?? '').trim();
    const kana = String(item?.['よみ'] ?? item?.kana ?? '').trim();
    if (!text || !KANA_OK.test(kana)) {
      skipped.push(`${text || '？'}（${kana || 'よみなし'}）`);
      continue;
    }
    if (seen.has(kana)) continue; // 同じよみは1つだけ
    seen.add(kana);
    words.push({ text, kana });
  }
  return { words, skipped };
}

export let WORDS = FALLBACK;
/** 読みこみの結果（タイトル画面でお知らせを出すため） */
export const wordsStatus = { source: 'fallback', count: FALLBACK.length, skipped: [], error: null };

/** public/words.json を読みこむ（起動時に1回） */
export async function loadWords() {
  try {
    const res = await fetch('./words.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`words.json が見つからない（${res.status}）`);
    const { words, skipped } = parseWordsJson(await res.json());
    if (words.length < 10) throw new Error('使えることばが10個より少ない');
    WORDS = words;
    Object.assign(wordsStatus, { source: 'json', count: words.length, skipped, error: null });
  } catch (e) {
    WORDS = FALLBACK;
    Object.assign(wordsStatus, { source: 'fallback', count: FALLBACK.length, skipped: [], error: e.message || String(e) });
    console.warn('words.json を読めなかったので予備のことばを使います:', e);
  }
  return wordsStatus;
}

/** かぶらないように n 問えらぶ */
export function pickWords(n, rng = Math.random) {
  const a = WORDS.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
