// Curated scene list for the Mimic round.
//
// The names and sources here are written by hand rather than scraped, because
// soundboard titles are a mess ("THIS IS FLIPPING SPARTA!!!11") and the round
// puts the name on screen. The build script only uses `q` to *find* the audio;
// everything the player sees comes from this file.
//
// What makes a good entry: a short, loud, well-known *vocal* line. The scorer
// grades melody and rhythm, so a line with a shape a throat can chase beats a
// flat sound effect. Anything over ~6s gets trimmed at play time.
//
// tier 1 = everyone in the room knows it, 3 = deeper cut.

/** @typedef {{name:string, from:string, emoji:string, q?:string, tier?:1|2|3, en?:string, music?:boolean}} Scene */

/**
 * Anime entries are the *Japanese* line, not the dub.
 *
 * `name` is the romaji of what is actually said, because that is what a player
 * has to reproduce — mimicking "Domain Expansion" gets you nowhere if the clip
 * says "Ryouiki Tenkai". `en` is the English meaning, shown underneath as
 * context. Searching the romaji is also the filter that finds sub audio in the
 * first place: soundboard uploads of Japanese audio are titled in romaji, and
 * uploads of the dub are titled in English.
 *
 * @type {Scene[]}
 */
export const ANIME_SCENES = [
  { name: 'Omae wa mou shindeiru', en: 'You are already dead', from: 'Fist of the North Star', emoji: '☠️', tier: 1 },
  { name: 'Nani?!', en: 'What?!', from: 'Fist of the North Star', emoji: '😱', q: 'nani meme', tier: 1 },
  { name: 'Hokuto Hyakuretsu Ken', en: 'Hundred Crack Fist of the North Star', from: 'Fist of the North Star', emoji: '👊', tier: 2 },
  { name: 'Atatatatata!', en: 'the flurry of punches', from: 'Fist of the North Star', emoji: '💢', q: 'atatata', tier: 2 },

  { name: 'Kamehameha', en: 'Turtle Destruction Wave', from: 'Dragon Ball Z', emoji: '🔵', q: 'goku kamehameha', tier: 1 },
  { name: 'Kamehameha (Gohan)', en: 'the father-son beam', from: 'Dragon Ball Z', emoji: '⚡', q: 'gohan kamehameha', tier: 2 },
  { name: 'Genki Dama', en: 'Spirit Bomb', from: 'Dragon Ball Z', emoji: '🔆', q: 'genki dama', tier: 2 },
  { name: 'Kaioken', en: 'the King of Worlds technique', from: 'Dragon Ball Z', emoji: '🔴', q: 'kaioken', tier: 2 },
  { name: 'Super Saiyan no sakebi', en: 'the transformation scream', from: 'Dragon Ball Z', emoji: '💥', q: 'goku super saiyan', tier: 1 },
  { name: 'Freeza no warai', en: "Frieza's laugh", from: 'Dragon Ball Z', emoji: '👾', q: 'frieza laugh', tier: 2 },

  { name: 'ORA ORA ORA', en: 'Star Platinum’s barrage', from: "JoJo's Bizarre Adventure", emoji: '👊', q: 'ora ora ora', tier: 1 },
  { name: 'MUDA MUDA MUDA', en: 'Useless! Useless!', from: "JoJo's Bizarre Adventure", emoji: '✋', q: 'muda muda muda', tier: 1 },
  { name: 'ZA WARUDO', en: 'The World — time stops', from: "JoJo's Bizarre Adventure", emoji: '⏱️', q: 'za warudo', tier: 1 },
  { name: 'WRYYYYY', en: 'Dio’s cry', from: "JoJo's Bizarre Adventure", emoji: '🧛', q: 'wryyy dio', tier: 2 },
  { name: 'Yare yare daze', en: 'Good grief', from: "JoJo's Bizarre Adventure", emoji: '😑', q: 'yare yare daze', tier: 2 },
  { name: 'Sutaa Purachina', en: 'Star Platinum', from: "JoJo's Bizarre Adventure", emoji: '⭐', q: 'star platinum', tier: 2 },
  { name: 'To Be Continued', en: 'the Roundabout sting', from: "JoJo's Bizarre Adventure", emoji: '➡️', q: 'to be continued roundabout', tier: 1, music: true },

  { name: 'Dattebayo!', en: 'Naruto’s catchphrase', from: 'Naruto', emoji: '🍥', q: 'naruto dattebayo', tier: 1 },
  { name: 'Rasengan', en: 'Spiralling Sphere', from: 'Naruto', emoji: '🌀', q: 'naruto rasengan', tier: 1 },
  { name: 'Chidori', en: 'A Thousand Birds', from: 'Naruto', emoji: '⚡', q: 'chidori', tier: 2 },
  { name: 'Kage Bunshin no Jutsu', en: 'Shadow Clone Technique', from: 'Naruto', emoji: '👥', q: 'kage bunshin no jutsu', tier: 1 },
  { name: 'Sasuke!', en: 'Naruto screaming for Sasuke', from: 'Naruto', emoji: '😭', q: 'naruto sasuke scream', tier: 2 },

  { name: 'Gomu Gomu no Pistol', en: 'Gum-Gum Pistol', from: 'One Piece', emoji: '👒', q: 'gomu gomu no pistol', tier: 1 },
  { name: 'Kaizoku ou ni ore wa naru', en: 'I’m gonna be King of the Pirates', from: 'One Piece', emoji: '🏴‍☠️', q: 'kaizoku ou ni ore wa naru', tier: 1 },
  { name: 'Santouryuu', en: 'Three Sword Style', from: 'One Piece', emoji: '⚔️', q: 'santoryu zoro', tier: 2 },
  { name: 'Gomu Gomu no Gatling', en: 'Gum-Gum Gatling', from: 'One Piece', emoji: '🔫', q: 'gomu gomu no gatling', tier: 2 },

  { name: 'Shinzou wo Sasageyo', en: 'Dedicate your hearts', from: 'Attack on Titan', emoji: '🫡', q: 'shinzou wo sasageyo', tier: 1 },
  { name: 'Tatakae!', en: 'Fight!', from: 'Attack on Titan', emoji: '⚔️', q: 'tatakae', tier: 2 },
  { name: 'Eren no sakebi', en: 'Eren screaming', from: 'Attack on Titan', emoji: '😤', q: 'eren scream', tier: 1 },
  { name: 'Kyojin no houkou', en: 'the Titan roar', from: 'Attack on Titan', emoji: '🗿', q: 'attack on titan titan roar', tier: 2 },

  { name: 'Ryouiki Tenkai', en: 'Domain Expansion', from: 'Jujutsu Kaisen', emoji: '🕳️', q: 'ryouiki tenkai', tier: 1 },
  { name: 'Muryou Kuusho', en: 'Infinite Void', from: 'Jujutsu Kaisen', emoji: '♾️', q: 'muryou kuusho', tier: 1 },
  { name: 'Fukuma Mizushi', en: 'Malevolent Shrine', from: 'Jujutsu Kaisen', emoji: '⛩️', q: 'fukuma mizushi', tier: 1 },
  { name: 'Kyoshiki Murasaki', en: 'Hollow Purple', from: 'Jujutsu Kaisen', emoji: '🟣', q: 'hollow purple gojo', tier: 2 },
  { name: 'Gojo Satoru', en: 'the strongest sorcerer', from: 'Jujutsu Kaisen', emoji: '🕶️', q: 'gojo satoru', tier: 1 },

  { name: 'Plus Ultra!', en: 'said in English in the Japanese track too', from: 'My Hero Academia', emoji: '💪', q: 'plus ultra all might', tier: 1 },
  { name: 'Detroit Smash', en: 'All Might’s finisher', from: 'My Hero Academia', emoji: '👊', q: 'detroit smash', tier: 2 },
  { name: 'Bakugou no sakebi', en: 'Bakugo going off', from: 'My Hero Academia', emoji: '💣', q: 'bakugou', tier: 3 },
  { name: 'Ore ga kita', en: 'I am here', from: 'My Hero Academia', emoji: '🦸', q: 'ore ga kita all might', tier: 2 },

  { name: 'Mizu no Kokyuu', en: 'Water Breathing', from: 'Demon Slayer', emoji: '🌊', q: 'mizu no kokyuu', tier: 1 },
  { name: 'Hinokami Kagura', en: 'Dance of the Fire God', from: 'Demon Slayer', emoji: '🔥', q: 'hinokami kagura', tier: 2 },
  { name: 'Zenitsu no sakebi', en: 'Zenitsu screaming', from: 'Demon Slayer', emoji: '⚡', q: 'zenitsu', tier: 1 },
  { name: 'UMAI!', en: 'Delicious!', from: 'Demon Slayer', emoji: '🍱', q: 'rengoku umai', tier: 2 },
  { name: 'Nezuko', en: 'Nezuko’s muffled voice', from: 'Demon Slayer', emoji: '🎋', q: 'nezuko', tier: 2 },

  { name: 'Bankai', en: 'Final Release', from: 'Bleach', emoji: '🗡️', q: 'bankai ichigo', tier: 1 },
  { name: 'Getsuga Tenshou', en: 'Moon Fang Heaven-Piercer', from: 'Bleach', emoji: '🌙', q: 'getsuga tenshou', tier: 2 },

  { name: 'Keikaku doori', en: 'Just as planned', from: 'Death Note', emoji: '📓', q: 'keikaku doori', tier: 2 },
  { name: 'Yagami Light no warai', en: 'Light’s laugh', from: 'Death Note', emoji: '😈', q: 'light yagami laugh', tier: 1 },

  { name: 'Saitama: OK', en: 'the flattest reply in anime', from: 'One Punch Man', emoji: '👊', q: 'saitama ok', tier: 1 },
  { name: 'Majime ni yaru', en: 'Serious Punch', from: 'One Punch Man', emoji: '💢', q: 'saitama serious punch', tier: 2 },

  { name: 'Waku waku!', en: 'Excited!', from: 'Spy x Family', emoji: '🥜', q: 'anya waku waku', tier: 1 },
  { name: 'Chichi, haha', en: 'Papa, Mama', from: 'Spy x Family', emoji: '👨‍👩‍👧', q: 'anya chichi haha', tier: 3 },

  { name: 'Denji', en: 'the Chainsaw Devil', from: 'Chainsaw Man', emoji: '🪚', q: 'denji chainsaw man', tier: 2 },
  { name: 'Pawaa', en: 'Power the Blood Fiend', from: 'Chainsaw Man', emoji: '🩸', q: 'power chainsaw man', tier: 3 },

  { name: 'Ore wa Meliodas', en: 'the Dragon Sin of Wrath', from: 'Seven Deadly Sins', emoji: '🐗', q: 'meliodas', tier: 3 },
  { name: 'Toukaboukan', en: 'Equivalent Exchange', from: 'Fullmetal Alchemist', emoji: '⚗️', q: 'fullmetal alchemist edward elric', tier: 2 },
  { name: 'Bakuretsu Mahou', en: 'EXPLOSION!', from: 'KonoSuba', emoji: '💥', q: 'megumin explosion', tier: 2 },
  { name: 'Ore wa Aizen', en: 'standing atop the heavens', from: 'Bleach', emoji: '🌸', q: 'aizen', tier: 3 },
  { name: 'Juu oku pasento', en: 'Ten billion percent', from: 'Dr. Stone', emoji: '🧪', q: 'senku dr stone', tier: 3 },
  { name: 'Ore wa tsuyoku naru', en: 'the awakening', from: 'Solo Leveling', emoji: '🌑', q: 'solo leveling arise', tier: 2 },

  { name: 'Pikachu!', en: 'same voice in every language', from: 'Pokémon', emoji: '⚡', q: 'pikachu', tier: 1 },
  { name: 'Tsuki ni kawatte oshioki yo', en: 'In the name of the Moon, I’ll punish you', from: 'Sailor Moon', emoji: '🌙', q: 'tsuki ni kawatte oshioki yo', tier: 2 },
  { name: 'Moon Tiara Action', en: 'the tiara throw', from: 'Sailor Moon', emoji: '👑', q: 'moon tiara action', tier: 3, music: true },

  { name: 'Baka!', en: 'Idiot!', from: 'Anime phrases', emoji: '😤', q: 'baka anime', tier: 1 },
  { name: 'Urusai!', en: 'Shut up!', from: 'Anime phrases', emoji: '🤫', q: 'urusai', tier: 2 },
  { name: 'Yamete kudasai', en: 'Please stop', from: 'Anime phrases', emoji: '🙅', q: 'yamete kudasai', tier: 2 },
  { name: 'Itadakimasu', en: 'Let’s eat', from: 'Anime phrases', emoji: '🍜', q: 'itadakimasu', tier: 3 },
  { name: 'Ara ara', en: 'Oh my, oh my', from: 'Anime phrases', emoji: '💋', q: 'ara ara', tier: 2 },
  { name: 'Nyaa~', en: 'the cat noise', from: 'Anime phrases', emoji: '🐱', q: 'nyaa anime', tier: 2 },
  { name: 'Nani sore', en: 'What is that', from: 'Anime phrases', emoji: '❓', q: 'nani sore', tier: 2 },
  { name: 'Senpai', en: 'Notice me, senpai', from: 'Anime phrases', emoji: '💕', q: 'senpai', tier: 3 },
  { name: 'Kawaii!', en: 'Cute!', from: 'Anime phrases', emoji: '🌸', q: 'kawaii', tier: 2 },
  { name: 'Sugoi!', en: 'Amazing!', from: 'Anime phrases', emoji: '✨', q: 'sugoi', tier: 2 },
  { name: 'Ganbatte!', en: 'Do your best!', from: 'Anime phrases', emoji: '📣', q: 'ganbatte', tier: 3 },
  { name: 'Deja Vu', en: 'the Initial D drift anthem', from: 'Initial D', emoji: '🚗', q: 'deja vu initial d', tier: 1, music: true },
];

/** @type {Scene[]} */
export const MARVEL_SCENES = [
  { name: 'I am Iron Man', from: 'Iron Man', emoji: '🦾', q: 'i am iron man tony stark', tier: 1 },
  { name: 'I love you 3000', from: 'Avengers: Endgame', emoji: '❤️', q: 'i love you 3000', tier: 1 },
  { name: 'Avengers, assemble', from: 'Avengers: Endgame', emoji: '🛡️', q: 'avengers assemble', tier: 1 },
  { name: 'I am inevitable', from: 'Avengers: Endgame', emoji: '💜', q: 'i am inevitable', tier: 1 },
  { name: 'And I... am... Iron Man', from: 'Avengers: Endgame', emoji: '🫰', q: 'and i am iron man snap', tier: 1 },
  { name: 'Perfectly balanced', from: 'Avengers: Infinity War', emoji: '⚖️', q: 'perfectly balanced as all things should be', tier: 1 },
  { name: 'Thanos snap', from: 'Avengers: Infinity War', emoji: '🫰', q: 'thanos snap', tier: 1 },
  { name: 'Mr Stark, I don’t feel so good', from: 'Avengers: Infinity War', emoji: '😰', q: 'i dont feel so good mr stark', tier: 1 },
  { name: 'You should have gone for the head', from: 'Avengers: Infinity War', emoji: '🪓', q: 'you should have gone for the head', tier: 2 },
  { name: 'Get this man a shield', from: 'Avengers: Infinity War', emoji: '🛡️', q: 'get this man a shield', tier: 3 },
  { name: 'Hulk smash', from: 'The Avengers', emoji: '💚', q: 'hulk smash', tier: 1 },
  { name: 'Puny god', from: 'The Avengers', emoji: '🥊', q: 'puny god', tier: 1 },
  { name: 'Language!', from: 'Avengers: Age of Ultron', emoji: '🤐', q: 'captain america language', tier: 2 },
  { name: 'On your left', from: 'Captain America: The Winter Soldier', emoji: '🏃', q: 'on your left', tier: 1 },
  { name: 'I can do this all day', from: 'Captain America: Civil War', emoji: '🛡️', q: 'i can do this all day', tier: 1 },
  { name: 'Avengers... assemble (portals)', from: 'Avengers: Endgame', emoji: '🌀', q: 'endgame portals', tier: 1 },
  { name: 'Wakanda forever', from: 'Black Panther', emoji: '🐆', q: 'wakanda forever', tier: 1 },
  { name: 'I am Groot', from: 'Guardians of the Galaxy', emoji: '🌱', q: 'i am groot', tier: 1 },
  { name: 'We are Groot', from: 'Guardians of the Galaxy', emoji: '🌳', q: 'we are groot', tier: 1 },
  { name: 'Star-Lord', from: 'Guardians of the Galaxy', emoji: '🎧', q: 'star lord who', tier: 2 },
  { name: 'By the Eye of Agamotto', from: 'Doctor Strange', emoji: '🟢', q: 'eye of agamotto', tier: 2 },
  { name: 'Doctor Strange portal', from: 'Doctor Strange', emoji: '✨', q: 'doctor strange portal', tier: 2 },
  { name: 'Loki theme', from: 'Loki', emoji: '👑', q: 'loki theme', tier: 2 },
  { name: 'Loki: I am a god', from: 'The Avengers', emoji: '🗿', q: 'loki i am a god', tier: 2 },
  { name: 'Bring me Thanos', from: 'Avengers: Infinity War', emoji: '⚡', q: 'bring me thanos', tier: 2 },
  { name: 'Thor: Another!', from: 'Thor', emoji: '☕', q: 'thor another', tier: 1 },
  { name: 'He’s a friend from work', from: 'Thor: Ragnarok', emoji: '💚', q: 'friend from work', tier: 1 },
  { name: 'Maximum effort', from: 'Deadpool', emoji: '🔴', q: 'deadpool maximum effort', tier: 1 },
  { name: 'Chimichangas', from: 'Deadpool', emoji: '🌯', q: 'chimichangas', tier: 2 },
  { name: 'With great power', from: 'Spider-Man', emoji: '🕷️', q: 'with great power comes great responsibility', tier: 1 },
  { name: 'Peter tingle', from: 'Spider-Man: Far From Home', emoji: '🕸️', q: 'peter tingle', tier: 2 },
  { name: 'Spider-Man pointing', from: 'Spider-Man', emoji: '👉', q: 'spiderman meme', tier: 2 },
  { name: 'Venom: We are Venom', from: 'Venom', emoji: '🖤', q: 'we are venom', tier: 1 },
  { name: 'Eddie Brock', from: 'Venom', emoji: '👅', q: 'venom eddie', tier: 3 },
  { name: 'Wolverine: Bub', from: 'X-Men', emoji: '🦾', q: 'wolverine snikt', tier: 2 },
  { name: 'Magneto', from: 'X-Men', emoji: '🧲', q: 'magneto', tier: 3 },
  { name: 'X-Men theme', from: 'X-Men', emoji: '❌', q: 'x men theme', tier: 2 },
  { name: 'Excelsior!', from: 'Stan Lee', emoji: '🙌', q: 'stan lee excelsior', tier: 2 },
  { name: 'Marvel intro fanfare', from: 'Marvel Studios', emoji: '🎬', q: 'marvel intro', tier: 1 },
  { name: 'Scarlet Witch: No more mutants', from: 'WandaVision', emoji: '🔴', q: 'no more mutants wanda', tier: 3 },
  { name: 'Vision', from: 'WandaVision', emoji: '💛', q: 'vision wandavision', tier: 3 },
  { name: 'Shuri: What are those', from: 'Black Panther', emoji: '👟', q: 'what are those black panther', tier: 3 },
  { name: 'Nick Fury', from: 'The Avengers', emoji: '👁️', q: 'nick fury', tier: 3 },
  { name: 'Jarvis', from: 'Iron Man', emoji: '🤖', q: 'jarvis iron man', tier: 2 },
  { name: 'Suit up', from: 'Iron Man', emoji: '🧰', q: 'iron man suit up', tier: 2 },
  { name: 'Hawkeye', from: 'The Avengers', emoji: '🏹', q: 'hawkeye arrow', tier: 3 },
  { name: 'Captain America shield throw', from: 'Captain America', emoji: '🛡️', q: 'captain america shield', tier: 2 },
  { name: 'Ant-Man', from: 'Ant-Man', emoji: '🐜', q: 'ant man', tier: 3 },
  { name: 'Thanos: I don’t even know who you are', from: 'Avengers: Infinity War', emoji: '💀', q: 'thanos i dont even know who you are', tier: 3 },
  { name: 'Whatever it takes', from: 'Avengers: Endgame', emoji: '⏳', q: 'whatever it takes', tier: 2 },
];

/** @type {Scene[]} */
export const MOVIE_SCENES = [
  { name: 'THIS IS SPARTA!', from: '300', emoji: '🛡️', q: 'this is sparta', tier: 1 },
  { name: 'Are you not entertained?', from: 'Gladiator', emoji: '🏟️', q: 'are you not entertained', tier: 1 },
  { name: 'FREEDOM!', from: 'Braveheart', emoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', q: 'braveheart freedom', tier: 1 },
  { name: 'May the Force be with you', from: 'Star Wars', emoji: '✨', q: 'may the force be with you', tier: 1 },
  { name: 'I am your father', from: 'The Empire Strikes Back', emoji: '🖤', q: 'i am your father', tier: 1 },
  { name: 'Hello there', from: 'Revenge of the Sith', emoji: '👋', q: 'hello there obi wan', tier: 1 },
  { name: 'General Kenobi!', from: 'Revenge of the Sith', emoji: '🤖', q: 'general kenobi', tier: 1 },
  { name: "It's over Anakin, I have the high ground", from: 'Revenge of the Sith', emoji: '🌋', q: 'i have the high ground', tier: 1 },
  { name: 'The tragedy of Darth Plagueis', from: 'Revenge of the Sith', emoji: '🎭', q: 'tragedy of darth plagueis', tier: 2 },
  { name: 'This is the way', from: 'The Mandalorian', emoji: '🪖', q: 'this is the way', tier: 1 },
  { name: 'Darth Vader breathing', from: 'Star Wars', emoji: '😮‍💨', q: 'darth vader breathing', tier: 1 },
  { name: 'Lightsaber', from: 'Star Wars', emoji: '🗡️', q: 'lightsaber', tier: 1 },
  { name: "I'll be back", from: 'The Terminator', emoji: '🤖', q: 'ill be back terminator', tier: 1 },
  { name: 'Hasta la vista, baby', from: 'Terminator 2', emoji: '🕶️', q: 'hasta la vista baby', tier: 1 },
  { name: 'Get to the choppa!', from: 'Predator', emoji: '🚁', q: 'get to the choppa', tier: 1 },
  { name: 'Yippee-ki-yay', from: 'Die Hard', emoji: '🏢', q: 'yippee ki yay', tier: 2 },
  { name: "You're gonna need a bigger boat", from: 'Jaws', emoji: '🦈', q: 'bigger boat', tier: 1 },
  { name: 'Jaws theme', from: 'Jaws', emoji: '🎼', q: 'jaws theme', tier: 1 },
  { name: "Here's Johnny!", from: 'The Shining', emoji: '🪓', q: 'heres johnny', tier: 1 },
  { name: 'You talkin’ to me?', from: 'Taxi Driver', emoji: '🚕', q: 'you talking to me', tier: 2 },
  { name: 'Say hello to my little friend', from: 'Scarface', emoji: '🔫', q: 'say hello to my little friend', tier: 1 },
  { name: 'Life is like a box of chocolates', from: 'Forrest Gump', emoji: '🍫', q: 'box of chocolates', tier: 1 },
  { name: 'Run, Forrest, run!', from: 'Forrest Gump', emoji: '🏃', q: 'run forrest run', tier: 1 },
  { name: 'My precious', from: 'The Lord of the Rings', emoji: '💍', q: 'my precious gollum', tier: 1 },
  { name: 'You shall not pass!', from: 'The Fellowship of the Ring', emoji: '🧙', q: 'you shall not pass', tier: 1 },
  { name: 'One does not simply', from: 'The Fellowship of the Ring', emoji: '🚶', q: 'one does not simply', tier: 1 },
  { name: 'They’re taking the hobbits to Isengard', from: 'The Lord of the Rings', emoji: '🌲', q: 'taking the hobbits to isengard', tier: 2 },
  { name: 'Why so serious?', from: 'The Dark Knight', emoji: '🃏', q: 'joker why so serious', tier: 1 },
  { name: 'I’m Batman', from: 'Batman', emoji: '🦇', q: 'i am batman', tier: 1 },
  { name: 'Inception BRAAAM', from: 'Inception', emoji: '🎺', q: 'inception braam', tier: 1 },
  { name: 'We need to go deeper', from: 'Inception', emoji: '🌀', q: 'we need to go deeper', tier: 2 },
  { name: 'Wake up, Neo', from: 'The Matrix', emoji: '💊', q: 'wake up neo', tier: 1 },
  { name: 'There is no spoon', from: 'The Matrix', emoji: '🥄', q: 'there is no spoon', tier: 2 },
  { name: 'Dodge this', from: 'The Matrix', emoji: '🕶️', q: 'dodge this matrix', tier: 3 },
  { name: 'Welcome to Jurassic Park', from: 'Jurassic Park', emoji: '🦕', q: 'welcome to jurassic park', tier: 1 },
  { name: 'Life finds a way', from: 'Jurassic Park', emoji: '🧬', q: 'life finds a way', tier: 2 },
  { name: 'T-Rex roar', from: 'Jurassic Park', emoji: '🦖', q: 't rex roar', tier: 1 },
  { name: 'Great Scott!', from: 'Back to the Future', emoji: '⚡', q: 'great scott', tier: 1 },
  { name: 'Where we’re going we don’t need roads', from: 'Back to the Future', emoji: '🚗', q: 'we dont need roads', tier: 2 },
  { name: "I'm gonna make him an offer he can't refuse", from: 'The Godfather', emoji: '🍷', q: 'offer he cant refuse', tier: 1 },
  { name: 'Leave the gun, take the cannoli', from: 'The Godfather', emoji: '🍰', q: 'take the cannoli', tier: 2 },
  { name: 'You can’t handle the truth!', from: 'A Few Good Men', emoji: '⚖️', q: 'you cant handle the truth', tier: 1 },
  { name: 'Show me the money!', from: 'Jerry Maguire', emoji: '💵', q: 'show me the money', tier: 2 },
  { name: 'Houston, we have a problem', from: 'Apollo 13', emoji: '🚀', q: 'houston we have a problem', tier: 1 },
  { name: 'E.T. phone home', from: 'E.T.', emoji: '👽', q: 'et phone home', tier: 1 },
  { name: 'To infinity and beyond!', from: 'Toy Story', emoji: '🚀', q: 'to infinity and beyond', tier: 1 },
  { name: 'Somebody once told me', from: 'Shrek', emoji: '🧅', q: 'somebody once told me', tier: 1 },
  { name: 'Shrek: Get out of my swamp', from: 'Shrek', emoji: '🐸', q: 'get out of my swamp', tier: 1 },
  { name: 'Hakuna Matata', from: 'The Lion King', emoji: '🦁', q: 'hakuna matata', tier: 1 },
  { name: 'Simba: Nants ingonyama', from: 'The Lion King', emoji: '🌅', q: 'lion king circle of life intro', tier: 1 },
  { name: 'Let It Go', from: 'Frozen', emoji: '❄️', q: 'let it go frozen', tier: 1 },
  { name: 'I’m the king of the world!', from: 'Titanic', emoji: '🚢', q: 'king of the world titanic', tier: 1 },
  { name: 'My Heart Will Go On', from: 'Titanic', emoji: '🎻', q: 'my heart will go on flute', tier: 1 },
  { name: 'Nobody puts Baby in a corner', from: 'Dirty Dancing', emoji: '💃', q: 'nobody puts baby in a corner', tier: 2 },
  { name: 'A particular set of skills', from: 'Taken', emoji: '📞', q: 'particular set of skills', tier: 1 },
  { name: 'Wilhelm scream', from: 'Movie sound effects', emoji: '😱', q: 'wilhelm scream', tier: 1 },
  { name: 'You’re a wizard, Harry', from: "Harry Potter and the Philosopher's Stone", emoji: '🧙', q: 'youre a wizard harry', tier: 1 },
  { name: 'Expelliarmus!', from: 'Harry Potter', emoji: '🪄', q: 'expelliarmus', tier: 1 },
  { name: 'Wingardium Leviosa', from: 'Harry Potter', emoji: '🪶', q: 'wingardium leviosa', tier: 1 },
  { name: 'Avada Kedavra', from: 'Harry Potter', emoji: '💀', q: 'avada kedavra', tier: 2 },
  { name: 'Hedwig’s Theme', from: 'Harry Potter', emoji: '🦉', q: 'harry potter theme', tier: 1 },
  { name: 'Why is the rum gone?', from: 'Pirates of the Caribbean', emoji: '🍾', q: 'why is the rum gone', tier: 1 },
  { name: 'Captain Jack Sparrow', from: 'Pirates of the Caribbean', emoji: '🏴‍☠️', q: 'captain jack sparrow', tier: 1 },
  { name: "He's a Pirate", from: 'Pirates of the Caribbean', emoji: '⚓', q: 'hes a pirate theme', tier: 1 },
  { name: 'WITNESS ME!', from: 'Mad Max: Fury Road', emoji: '🔥', q: 'witness me mad max', tier: 2 },
  { name: 'John Wick', from: 'John Wick', emoji: '🐶', q: 'john wick', tier: 2 },
  { name: 'Now I am become Death', from: 'Oppenheimer', emoji: '☢️', q: 'now i am become death', tier: 2 },
  { name: 'The first rule of Fight Club', from: 'Fight Club', emoji: '🥊', q: 'first rule of fight club', tier: 2 },
  { name: 'Ezekiel 25:17', from: 'Pulp Fiction', emoji: '📖', q: 'ezekiel 25 17', tier: 2 },
  { name: 'Royale with cheese', from: 'Pulp Fiction', emoji: '🍔', q: 'royale with cheese', tier: 2 },
  { name: 'Funny how? Like a clown?', from: 'Goodfellas', emoji: '🤡', q: 'funny how im funny', tier: 3 },
  { name: 'Keep the change, ya filthy animal', from: 'Home Alone', emoji: '🎄', q: 'keep the change ya filthy animal', tier: 2 },
  { name: 'Home Alone scream', from: 'Home Alone', emoji: '😲', q: 'home alone scream', tier: 1 },
  { name: 'Wilson!', from: 'Cast Away', emoji: '🏐', q: 'wilson cast away', tier: 2 },
  { name: 'Interstellar docking', from: 'Interstellar', emoji: '🪐', q: 'interstellar docking', tier: 2 },
  { name: 'No time for caution', from: 'Interstellar', emoji: '🎹', q: 'no time for caution', tier: 2 },
  { name: 'Get out: sunken place', from: 'Get Out', emoji: '🫖', q: 'get out sunken place', tier: 3 },
  { name: 'Top Gun: Danger Zone', from: 'Top Gun', emoji: '✈️', q: 'danger zone top gun', tier: 1 },
  { name: 'Rocky theme', from: 'Rocky', emoji: '🥊', q: 'rocky theme', tier: 1 },
  { name: 'Adrian!', from: 'Rocky', emoji: '📣', q: 'yo adrian', tier: 2 },
  { name: 'Mission Impossible theme', from: 'Mission: Impossible', emoji: '🕵️', q: 'mission impossible theme', tier: 1 },
  { name: 'James Bond theme', from: 'James Bond', emoji: '🍸', q: 'james bond theme', tier: 1 },
  { name: 'Bond. James Bond.', from: 'James Bond', emoji: '🎩', q: 'bond james bond', tier: 2 },
  { name: 'Psycho shower', from: 'Psycho', emoji: '🚿', q: 'psycho shower scene', tier: 1 },
  { name: 'Ghostbusters', from: 'Ghostbusters', emoji: '👻', q: 'ghostbusters theme', tier: 1 },
  { name: 'Indiana Jones theme', from: 'Indiana Jones', emoji: '🤠', q: 'indiana jones theme', tier: 1 },
  { name: 'Godzilla roar', from: 'Godzilla', emoji: '🦎', q: 'godzilla roar', tier: 1 },
  { name: 'King Kong', from: 'King Kong', emoji: '🦍', q: 'king kong roar', tier: 3 },
  { name: 'The Good, the Bad and the Ugly', from: 'The Good, the Bad and the Ugly', emoji: '🤠', q: 'the good the bad and the ugly theme', tier: 2 },
  { name: 'Barbie: Hi Barbie', from: 'Barbie', emoji: '💗', q: 'hi barbie', tier: 2 },
  { name: 'Sound of Music: The hills are alive', from: 'The Sound of Music', emoji: '⛰️', q: 'the hills are alive', tier: 2 },
  { name: 'Singin’ in the Rain', from: "Singin' in the Rain", emoji: '☔', q: 'singing in the rain', tier: 2 },
  { name: 'Requiem for a Dream', from: 'Requiem for a Dream', emoji: '🎻', q: 'requiem for a dream', tier: 2 },
  { name: 'Halloween theme', from: 'Halloween', emoji: '🎃', q: 'halloween theme michael myers', tier: 2 },
  { name: 'The Exorcist: Tubular Bells', from: 'The Exorcist', emoji: '🔔', q: 'tubular bells exorcist', tier: 3 },
];

export const SCENE_GROUPS = [
  { cat: 'anime', label: 'Anime scenes', scenes: ANIME_SCENES },
  { cat: 'marvel', label: 'Marvel scenes', scenes: MARVEL_SCENES },
  { cat: 'movie', label: 'Movie scenes', scenes: MOVIE_SCENES },
];
