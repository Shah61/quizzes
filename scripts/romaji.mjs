// Hepburn-style kana -> romaji. Written for the typing round, so it produces what a
// learner would actually type on a keyboard ("n" for ん, doubled consonants for っ).

const BASE = {
  あ:'a',い:'i',う:'u',え:'e',お:'o',
  か:'ka',き:'ki',く:'ku',け:'ke',こ:'ko',
  が:'ga',ぎ:'gi',ぐ:'gu',げ:'ge',ご:'go',
  さ:'sa',し:'shi',す:'su',せ:'se',そ:'so',
  ざ:'za',じ:'ji',ず:'zu',ぜ:'ze',ぞ:'zo',
  た:'ta',ち:'chi',つ:'tsu',て:'te',と:'to',
  だ:'da',ぢ:'ji',づ:'zu',で:'de',ど:'do',
  な:'na',に:'ni',ぬ:'nu',ね:'ne',の:'no',
  は:'ha',ひ:'hi',ふ:'fu',へ:'he',ほ:'ho',
  ば:'ba',び:'bi',ぶ:'bu',べ:'be',ぼ:'bo',
  ぱ:'pa',ぴ:'pi',ぷ:'pu',ぺ:'pe',ぽ:'po',
  ま:'ma',み:'mi',む:'mu',め:'me',も:'mo',
  や:'ya',ゆ:'yu',よ:'yo',
  ら:'ra',り:'ri',る:'ru',れ:'re',ろ:'ro',
  わ:'wa',ゐ:'wi',ゑ:'we',を:'wo',ん:'n',
  ゔ:'vu',
};

const DIGRAPH = {
  きゃ:'kya',きゅ:'kyu',きょ:'kyo', ぎゃ:'gya',ぎゅ:'gyu',ぎょ:'gyo',
  しゃ:'sha',しゅ:'shu',しょ:'sho', じゃ:'ja',じゅ:'ju',じょ:'jo',
  ちゃ:'cha',ちゅ:'chu',ちょ:'cho', ぢゃ:'ja',ぢゅ:'ju',ぢょ:'jo',
  にゃ:'nya',にゅ:'nyu',にょ:'nyo', ひゃ:'hya',ひゅ:'hyu',ひょ:'hyo',
  びゃ:'bya',びゅ:'byu',びょ:'byo', ぴゃ:'pya',ぴゅ:'pyu',ぴょ:'pyo',
  みゃ:'mya',みゅ:'myu',みょ:'myo', りゃ:'rya',りゅ:'ryu',りょ:'ryo',
  // Sounds used mainly in loanwords.
  ふぁ:'fa',ふぃ:'fi',ふぇ:'fe',ふぉ:'fo', うぃ:'wi',うぇ:'we',うぉ:'wo',
  ゔぁ:'va',ゔぃ:'vi',ゔぇ:'ve',ゔぉ:'vo', てぃ:'ti',でぃ:'di',とぅ:'tu',どぅ:'du',
  しぇ:'she',じぇ:'je',ちぇ:'che', つぁ:'tsa',つぃ:'tsi',つぇ:'tse',つぉ:'tso',
  きぇ:'kye',ひぇ:'hye',
};

// Katakana shares a layout with hiragana 0x60 above it.
const toHiragana = (s) =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

export function toRomaji(input) {
  const kana = toHiragana(String(input));
  let out = '';
  for (let i = 0; i < kana.length; i++) {
    const pair = kana.slice(i, i + 2);
    if (DIGRAPH[pair]) { out += DIGRAPH[pair]; i++; continue; }

    const ch = kana[i];
    if (ch === 'っ') {
      // Small tsu doubles the consonant that follows it.
      const nextPair = kana.slice(i + 1, i + 3);
      const next = DIGRAPH[nextPair] ?? BASE[kana[i + 1]];
      if (next) out += next[0] === 'c' ? 't' : next[0]; // っち -> tchi
      continue;
    }
    if (ch === 'ー') { out += out.slice(-1) || ''; continue; } // long vowel mark
    if (BASE[ch]) { out += BASE[ch]; continue; }
    if (/[a-zA-Z0-9]/.test(ch)) { out += ch; continue; }
    // Anything left (kanji, punctuation) has no reading of its own — skip it.
  }
  return out;
}

// Is the string made only of kana? Used to decide whether a "reading" question makes sense.
export const isKanaOnly = (s) => /^[぀-ゟ゠-ヿーー\s]+$/.test(String(s));
export const hasKanji = (s) => /[一-鿿]/.test(String(s));
