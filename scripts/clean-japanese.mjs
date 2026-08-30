// Tidies the Jisho pull and tops it up with common katakana loanwords, which the
// "#common #jlpt" search barely returns but which are great duel material.
import { readFile, writeFile } from 'node:fs/promises';
import { toRomaji } from './romaji.mjs';

const P = new URL('../src/content/packs/japanese-vocab.json', import.meta.url);
let rows = JSON.parse(await readFile(P, 'utf8'));

// Jisho sometimes splits a gloss mid-parenthesis, leaving fragments like "familiaris)".
const salvage = (m) => m.replace(/[()]/g, '').trim();
const isJunk = (m) => !m || m.length < 2 || /^[a-z]+\)$/i.test(m) || /^(e\.g|etc|esp)\b/i.test(m);

rows = rows
  .map((r) => ({ ...r, m: [...new Set(r.m.map(salvage).filter((m) => !isJunk(m)))] }))
  .filter((r) => r.m.length)
  // Single kana with no kanji are grammar particles — vague meanings make poor questions.
  .filter((r) => r.kanji || [...r.w].length > 1);

const KATAKANA = [
  ['コーヒー','coffee'],['テレビ','television'],['ラジオ','radio'],['パソコン','personal computer'],
  ['スマホ','smartphone'],['カメラ','camera'],['ノート','notebook'],['ペン','pen'],['ドア','door'],
  ['テーブル','table'],['ベッド','bed'],['ソファ','sofa'],['シャワー','shower'],['トイレ','toilet'],
  ['ホテル','hotel'],['レストラン','restaurant'],['カフェ','cafe'],['スーパー','supermarket'],
  ['コンビニ','convenience store'],['デパート','department store'],['ビル','building'],
  ['アパート','apartment'],['マンション','apartment block'],['エレベーター','elevator'],
  ['エスカレーター','escalator'],['バス','bus'],['タクシー','taxi'],['バイク','motorbike'],
  ['トラック','truck'],['ガソリン','petrol'],['チケット','ticket'],['パスポート','passport'],
  ['カード','card'],['プレゼント','present'],['パーティー','party'],['ゲーム','game'],
  ['アニメ','anime'],['マンガ','manga'],['ドラマ','drama'],['ニュース','news'],['スポーツ','sport'],
  ['サッカー','football'],['テニス','tennis'],['バスケット','basketball'],['ゴルフ','golf'],
  ['スキー','skiing'],['プール','swimming pool'],['ジム','gym'],['チーム','team'],['ボール','ball'],
  ['ケーキ','cake'],['パン','bread'],['チーズ','cheese'],['バター','butter'],['ミルク','milk'],
  ['ジュース','juice'],['ビール','beer'],['ワイン','wine'],['アイスクリーム','ice cream'],
  ['チョコレート','chocolate'],['サラダ','salad'],['スープ','soup'],['カレー','curry'],
  ['ラーメン','ramen'],['ハンバーガー','hamburger'],['ピザ','pizza'],['サンドイッチ','sandwich'],
  ['レモン','lemon'],['バナナ','banana'],['オレンジ','orange'],['トマト','tomato'],
  ['シャツ','shirt'],['ズボン','trousers'],['スカート','skirt'],['コート','coat'],['セーター','sweater'],
  ['ネクタイ','necktie'],['ポケット','pocket'],['ボタン','button'],['スーツ','suit'],
  ['アメリカ','America'],['イギリス','Britain'],['フランス','France'],['ドイツ','Germany'],
  ['マレーシア','Malaysia'],['シンガポール','Singapore'],['タイ','Thailand'],['インド','India'],
  ['エアコン','air conditioner'],['ストーブ','heater'],['ライト','light'],['カレンダー','calendar'],
  ['メール','email'],['インターネット','internet'],['サイト','website'],['アプリ','app'],
  ['データ','data'],['ファイル','file'],['プリンター','printer'],['マウス','mouse'],
  ['アルバイト','part-time job'],['サラリーマン','office worker'],['グループ','group'],
  ['クラス','class'],['テスト','test'],['レポート','report'],['ページ','page'],['ルール','rule'],
  ['スケジュール','schedule'],['サービス','service'],['チャンス','chance'],['アイデア','idea'],
  ['イメージ','image'],['レベル','level'],['スタート','start'],['ゴール','goal'],['スピード','speed'],
  ['ホーム','platform'],['ロビー','lobby'],['フロント','reception'],['キー','key'],
  ['ピアノ','piano'],['ギター','guitar'],['コンサート','concert'],['ダンス','dance'],
  ['クリスマス','Christmas'],['プラン','plan'],['メニュー','menu'],['オーダー','order'],
];

const have = new Set(rows.map((r) => r.w));
let added = 0;
for (const [w, meaning] of KATAKANA) {
  if (have.has(w)) continue;
  rows.push({ w, r: w, ro: toRomaji(w), m: [meaning], lv: 'n5', pos: 'Noun', kanji: false, kata: true });
  added++;
}

await writeFile(P, JSON.stringify(rows, null, 0));
console.log(`vocab: ${rows.length} (katakana added: ${added})`);
console.log('by level:', Object.fromEntries(['n5','n4','n3','n2','n1'].map((l)=>[l,rows.filter(r=>r.lv===l).length])));
