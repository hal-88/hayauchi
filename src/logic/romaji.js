// ひらがなの読みを、ローマ字の揺れに対応しながら1文字ずつ判定する。
// 画面には依存しない（node でもテストできる）。

// 1つめが「お手本」として表示されるつづり。2026-11-19 から訓令式寄り＝いちばん短く打てるほう（si・ti・tu・hu・zi・sya・tya。じゃ行は ja のほうが短いので ja）
const BASE = {
  'あ': 'a', 'い': 'i,yi', 'う': 'u,wu,whu', 'え': 'e', 'お': 'o',
  'か': 'ka,ca', 'き': 'ki', 'く': 'ku,cu,qu', 'け': 'ke', 'こ': 'ko,co',
  'さ': 'sa', 'し': 'si,shi,ci', 'す': 'su', 'せ': 'se,ce', 'そ': 'so',
  'た': 'ta', 'ち': 'ti,chi', 'つ': 'tu,tsu', 'て': 'te', 'と': 'to',
  'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
  'は': 'ha', 'ひ': 'hi', 'ふ': 'hu,fu', 'へ': 'he', 'ほ': 'ho',
  'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
  'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
  'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
  'わ': 'wa', 'ゐ': 'wi', 'ゑ': 'we', 'を': 'wo',
  'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
  'ざ': 'za', 'じ': 'zi,ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
  'だ': 'da', 'ぢ': 'di', 'づ': 'du', 'で': 'de', 'ど': 'do',
  'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
  'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
  'ゔ': 'vu',
  'ぁ': 'xa,la', 'ぃ': 'xi,li,xyi,lyi', 'ぅ': 'xu,lu', 'ぇ': 'xe,le,xye,lye', 'ぉ': 'xo,lo',
  'ゃ': 'xya,lya', 'ゅ': 'xyu,lyu', 'ょ': 'xyo,lyo', 'ゎ': 'xwa,lwa',
  'っ': 'xtu,ltu,xtsu,ltsu',
  'ー': '-', '、': ',', '。': '.', '！': '!', '？': '?',

  // 2文字で1つの音
  'しゃ': 'sya,sha', 'しぃ': 'syi', 'しゅ': 'syu,shu', 'しぇ': 'sye,she', 'しょ': 'syo,sho',
  'じゃ': 'ja,zya,jya', 'じぃ': 'zyi,jyi', 'じゅ': 'ju,zyu,jyu', 'じぇ': 'je,zye,jye', 'じょ': 'jo,zyo,jyo',
  'ちゃ': 'tya,cha,cya', 'ちぃ': 'tyi,cyi', 'ちゅ': 'tyu,chu,cyu', 'ちぇ': 'tye,che,cye', 'ちょ': 'tyo,cho,cyo',
  'ふぁ': 'fa,fwa', 'ふぃ': 'fi,fyi', 'ふぇ': 'fe,fye', 'ふぉ': 'fo,fwo', 'ふゅ': 'fyu',
  'てぃ': 'thi', 'てゅ': 'thu', 'でぃ': 'dhi', 'でゅ': 'dhu',
  'とぅ': 'twu', 'どぅ': 'dwu',
  'うぃ': 'wi,whi', 'うぇ': 'we,whe', 'うぉ': 'who', 'いぇ': 'ye',
  'ゔぁ': 'va', 'ゔぃ': 'vi', 'ゔぇ': 've', 'ゔぉ': 'vo',
  'つぁ': 'tsa', 'つぃ': 'tsi', 'つぇ': 'tse', 'つぉ': 'tso',
  'くぁ': 'kwa,qa', 'ぐぁ': 'gwa',
};

const TABLE = {};
for (const [k, v] of Object.entries(BASE)) TABLE[k] = v.split(',');

// きゃ・にゃ などをまとめて作る
const YOON = { 'き': 'k', 'ぎ': 'g', 'に': 'n', 'ひ': 'h', 'び': 'b', 'ぴ': 'p', 'み': 'm', 'り': 'r', 'ぢ': 'd' };
const SMALL = { 'ゃ': 'ya', 'ぃ': 'yi', 'ゅ': 'yu', 'ぇ': 'ye', 'ょ': 'yo' };
for (const [k, c] of Object.entries(YOON)) {
  for (const [s, r] of Object.entries(SMALL)) TABLE[k + s] = [c + r];
}

// 次の音が これで始まるなら「ん」を n 1回にできない
const N_BLOCK = /^[aiueony]/;
// 「っ」で重ねられる子音
const DOUBLE_OK = /^[bcdfghjkmpqrstvwyz]/;

/**
 * 読み kana の pos 文字目から始まる「音のかたまり」の候補。
 * 長い（2文字の）かたまりを先に並べる。
 * @returns {{len:number, romas:string[]}[]}
 */
export function chunkCandidates(kana, pos) {
  const out = [];
  if (pos >= kana.length) return out;
  const c = kana[pos];

  if (c === 'ん') {
    const next = chunkCandidates(kana, pos + 1);
    const nextRomas = next.flatMap((n) => n.romas);
    const singleOk = nextRomas.length > 0 && !nextRomas.some((r) => N_BLOCK.test(r));
    out.push({ len: 1, romas: singleOk ? ['n', 'nn', 'xn'] : ['nn', 'xn'] });
    return out;
  }

  if (c === 'っ') {
    // 次の音の子音を重ねる（った → tta、っち → cchi / tchi）
    for (const n of chunkCandidates(kana, pos + 1)) {
      const dbl = [];
      for (const r of n.romas) {
        if (!DOUBLE_OK.test(r)) continue;
        dbl.push(r[0] + r);
        if (r.startsWith('ch')) dbl.push('t' + r);
      }
      if (dbl.length) out.push({ len: 1 + n.len, romas: dbl });
    }
    out.push({ len: 1, romas: TABLE['っ'] });
    return out;
  }

  const two = kana.slice(pos, pos + 2);
  if (two.length === 2 && TABLE[two]) out.push({ len: 2, romas: TABLE[two] });
  if (TABLE[c]) out.push({ len: 1, romas: TABLE[c] });
  else out.push({ len: 1, romas: [c.toLowerCase()] }); // 表にない文字（英字・数字など）はそのまま
  return out;
}

/** pos から最後までの「お手本」つづり */
function defaultRest(kana, pos) {
  let s = '';
  while (pos < kana.length) {
    const c = chunkCandidates(kana, pos)[0];
    s += c.romas[0];
    pos += c.len;
  }
  return s;
}

export class RomajiMatcher {
  constructor(kana) {
    this.kana = kana;
    this.pos = 0; // 読みの何文字目まで打ち終わったか
    this.buf = ''; // いまの音のかたまりで打った文字
    this.typed = ''; // 正しく打った文字ぜんぶ
  }

  get done() {
    return this.pos >= this.kana.length;
  }

  /**
   * 1キー入力。正しければ true、ミスなら false。
   */
  input(key) {
    if (this.done) return false;
    const ch = key.toLowerCase();
    const cands = chunkCandidates(this.kana, this.pos);
    const next = this.buf + ch;

    const prefixHits = [];
    for (const c of cands) for (const r of c.romas) if (r.startsWith(next)) prefixHits.push(r);

    if (prefixHits.length) {
      this.buf = next;
      this.typed += ch;
      const exact = cands.find((c) => c.romas.includes(next));
      const longer = prefixHits.some((r) => r.length > next.length);
      if (exact && !longer) this._commit(exact.len);
      return true;
    }

    // 「ん」を n 1回で打って、次の音に進んだ場合など
    if (this.buf) {
      const exact = cands.find((c) => c.romas.includes(this.buf));
      if (exact) {
        this._commit(exact.len);
        return this.input(ch);
      }
    }
    return false;
  }

  _commit(len) {
    this.pos += len;
    this.buf = '';
  }

  /** 次に打つべきキー（お手本どおりの場合） */
  get nextKey() {
    return this.rest[0] || '';
  }

  /** まだ打っていない部分のお手本つづり（打った文字に合わせて変わる） */
  get rest() {
    if (this.done) return '';
    const cands = chunkCandidates(this.kana, this.pos);
    for (const c of cands) {
      const r = c.romas.find((x) => x.startsWith(this.buf));
      if (!r) continue;
      if (r === this.buf) {
        // n 1回で止まっている「ん」など：このかたまりは打ち終わり扱いで続きを出す
        return defaultRest(this.kana, this.pos + c.len);
      }
      return r.slice(this.buf.length) + defaultRest(this.kana, this.pos + c.len);
    }
    return defaultRest(this.kana, this.pos);
  }

  /** 読みのうち、打ち終わった文字数（かなの色分け用） */
  get kanaDone() {
    return this.pos;
  }
}

/** お手本どおりのつづり全体 */
export function toRomaji(kana) {
  return defaultRest(kana, 0);
}
