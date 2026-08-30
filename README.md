# Quiz Arena

A two-team quiz game show you can play online with your friends, plus a
separate head-to-head Japanese quiz. Built in the style of the Beta Squad /
Chunkz / Niko challenge videos — buzzers, pixel reveals, anime openings, rapid
fire and a final wager.

Everyone plays on their own phone or laptop: the questions, pictures, timer and
scores all appear on each player's screen, and they buzz or answer by tapping.
You host it from your own screen.

---

## Getting it online (Vercel)

You need a free GitHub account and a free Vercel account.

**1. Put the code on GitHub**

```bash
git init && git add -A && git commit -m "Quiz Arena"
```

Then create an empty repo on github.com and push to it:

```bash
git remote add origin https://github.com/YOUR-USERNAME/quiz-arena.git && git push -u origin main
```

**2. Deploy**

Go to [vercel.com/new](https://vercel.com/new), sign in with GitHub, pick the
repo, and press **Deploy**. Everything is detected automatically — there are no
environment variables and no database to set up.

You get a URL like `https://quiz-arena-yourname.vercel.app`. That is the link
you send your friends. Every future `git push` redeploys it.

---

## How to run a game night

Open your Vercel link, choose **Team Battle**, name the two teams, pick your
topics and rounds, then hit start.

### Playing online (everyone on their own device)

This is the main way to play — nobody has to share a screen.

1. **One person opens the game** on a laptop and starts it. Their browser runs
   the game, so this tab has to stay open for the whole session.
2. Press the **🌐 Play online** chip in the top corner. It shows a four-letter
   room code and a join link.
3. **Everyone else opens `your-url.vercel.app/play`** on their own phone or
   laptop, types the code, enters their name and picks a team.

From then on the whole game appears on every player's screen — the question, the
picture sharpening, the timer, the live scores — and they answer by tapping their
own device. Buzzes and answers land back on the host's screen instantly.

> How it works: the players' devices connect directly to the host's browser over
> WebRTC. There is no server, no database and nothing stored anywhere, which is
> why this costs nothing to run. A few very restrictive networks block direct
> connections; if someone cannot get in, the game still works on one shared
> screen.

### Playing in one room

If you are all together, skip the room entirely. Put the laptop on the TV:
**Team A buzzes with the `A` key, Team B with `L`**, or tap the two big buzzers
on a touchscreen.

### Your controls as host

| Key | Does |
| --- | --- |
| `A` / `L` | Team A / Team B buzz |
| `Y` / `N` | Mark the buzzing team right or wrong |
| `H` | Show the hint |
| `Space` | Show the answer, then move to the next question |
| `Enter` | Start the round |
| `M` | Mute / unmute everything |
| `[` / `]` | Volume down / up |

There are on-screen buttons for all of it, plus **+5 / −5** next to each team so
you can award or dock points for anything you like, and **Skip round** if a round
is not landing.

### Volume

The speaker button in the top corner is on every screen, including mid-round.
It has two sliders: one for everything, and one for just the beeps and buzzers —
so you can keep the anime openings loud without the countdown ticks cutting
through the room. Both are saved in the browser, so the level survives a reload.

It covers every sound the game makes: interface effects, the openings and
endings, Mimic references, and voice takes on playback. The one thing it does
not touch is the reference render the Mimic scorer grades against, which is
computed offline and never played — putting the volume slider in front of that
would make how loud your laptop is part of the scoring.

### Game length

**Questions per round** goes up to **100**, so an openings-only marathon is a
single round of 100 tracks rather than a dozen short ones. The game never
repeats a question inside a round, and it caps at however many exist for that
round type (199 openings, 158 endings, 89 voice prompts).

### Playing with no host

Pick **🤖 No host needed** during setup. Every question becomes four options, the
screen scores it and moves on by itself, and nobody has to adjudicate. Online,
each player just taps their answer; on one screen, **Team A uses keys `1`–`4` and
Team B uses `7`–`0`**. Whoever locks the right answer first gets a speed bonus.

One browser still has to run the game even in this mode — whoever opens the room
can play along like everyone else.

## The rounds

| Round | How it plays |
| --- | --- |
| 🔔 **Buzzer Battle** | You read the question, first team to buzz answers. Get it wrong and it opens up for the steal. |
| 🖼️ **Pixel Reveal** | A picture starts as an unreadable blur and sharpens second by second. Buzz early — the sooner you buzz, the more it is worth. |
| 🎧 **Name That Opening** | A real anime opening plays. Buzz the moment you recognise it. Openings only — 199 tracks. |
| 🌙 **Name That Ending** | The same, but ending themes — usually the harder half. 158 tracks. |
| 🎤 **Voice Battle** | Both teams perform the same character. Record the takes, play them back, and the room votes on who nailed it. |
| 🔊 **Mimic** | One sound, one shot each. Copy an anime line, a movie quote or an opening — the screen scores melody and rhythm, then spins a sabotage wheel. |
| ⚡ **Rapid Fire** | One team, sixty seconds, as many as they can get. Then the other team. |
| ⛓️ **The Chain** | Every correct answer doubles the pot — 5, 10, 20, 40, 80… Bank it, or lose the lot on one wrong answer. |
| 🎯 **Lock It In** | Four options, both teams lock an answer, the screen scores it. |
| 💰 **Final Wager** | Both teams bet points *before* seeing the question. Win the bet or lose it. |

Topics: **Anime · Minecraft · Terraria · Marvel · General Knowledge · Hit Songs
(English, Japanese and Malay) · Malaysia**. Turn any of them on or off.

---

## Where the music comes from

The opening and ending tracks are streamed from **[AnimeThemes.moe](https://animethemes.moe)**,
a community-run archive of anime OP/ED themes with a free public API. Nothing is
copied into this project — the build script asks their API which themes each
anime has and stores the resulting URLs, so the audio streams from their servers
at play time.

The build works in three passes:

1. Pull the ~300 most popular anime from **AniList** (which also supplies the
   character art and cover images).
2. Look each one up on AnimeThemes and keep every OP/ED that has a playable
   file, capped at three per series so one long-running show cannot dominate.
3. Find the **audio-only** file for each theme. AnimeThemes publishes the themes
   as video, and those are enormous — 45MB on average, up to 62MB — while the
   same theme as audio is around 3MB. The rounds only ever play the sound, so
   streaming the video was costing roughly **fourteen times** the bytes for
   nothing, which on a slow connection meant a ten-second wait before a track
   started. 275 of the 357 themes have one; the rest keep the video.

The player offers both, smallest first, and the browser plays the first source
it understands — the audio-only files are Ogg Vorbis, which Safari will not
play, so listing both means most browsers get the small file and Safari still
gets a round.

**Tracks load ahead of the round, not one at a time.** Once the first track is
playing, the player keeps pulling down the ones after it and holds up to twelve
ready — so a round of 3, 5 or 10 is fully loaded before the first song ends, and
a 50 or 100 track marathon simply stays a dozen ahead for the whole game. Only
the very first track of a round waits for anything. The screen shows how many
are ready underneath the equaliser.

They are fed in a few at a time rather than all at once, which sounds like the
slower option and is not: start thirteen downloads together and the browser
spreads the connection evenly across all of them, so the track you need next is
no further along than the one twelve questions away. Three at a time finishes
them in the order they are needed. Twelve ready costs about 20MB of buffer.

> These files are served `no-cache`, so the browser will not reuse a downloaded
> track between elements — which is why the next track is warmed in the element
> that will actually play it, rather than being fetched and thrown away.

Each track is tagged `OP` or `ED`, which is what keeps the two rounds separate —
the openings round draws only from `OP`, the endings round only from `ED`.

The Mimic round's scene clips come from **[myinstants.com](https://www.myinstants.com)**,
a soundboard site with a free JSON API. The names and sources you see on screen
are written by hand in `scripts/sources-scenes.mjs` — the API is only used to
*find* a clip for each one, because soundboard titles are unusable as questions.

Matching is deliberately strict, and an entry that finds nothing good is dropped
rather than filled with the nearest thing. A candidate has to carry at least
half the words of the phrase being searched for, *including* a long distinctive
one — without that rule "mizu no kokyuu" matched a Naruto water-clone clip on
the word "mizu", and shortened fallback queries pulled back a Futurama line for
Edward Elric and a Star Wars line for Power. Themes and remixes are rejected
unless the entry is flagged `music: true`.

To refresh or expand the library:

```bash
npm run content && node scripts/clean-content.mjs
```

```bash
npm run content:scenes
```

Raise `PAGES` or the `targets` slice in `scripts/build-content.mjs` to pull in
more series, or add entries to `scripts/sources-scenes.mjs` for more scenes.
`npm run content:scenes anime` rebuilds just one group.

### Why Mimic needs a small server route

Playing remote audio only needs an `<audio>` tag, but *scoring* against it needs
the actual samples — which means `fetch` + `decodeAudioData`, which needs a CORS
header. Neither AnimeThemes nor the soundboard CDN sends one, so the browser
cannot read those files directly however they are requested.

`/api/clip` relays those bytes through the app's own origin. Nothing is stored:
the response is streamed straight through, and a long cache header lets Vercel's
edge serve the repeats. It only accepts an allowlist of hosts, which is what
keeps it from being an open proxy. This is the one place media touches the
server — images and the openings round still hotlink straight from source.

A Vercel function may only return about 4.5MB and gets 10 seconds by default, so
the route asks for 30 and anything over 4MB is kept out of the Mimic pool
entirely. That is why 263 of the 275 themes with an audio-only file are offered
as Mimic references rather than all of them — better to drop a long one at build
time than have it fail mid-round. Those themes still play normally in the
openings round, which streams the original file and never touches this route.

---

## 🇯🇵 Japanese Quiz

A separate mode from the main menu — one screen, two players, no host.
**Player 1 uses `1`–`4`, Player 2 uses `7`–`0`.**

Five question types, any of which you can switch off:

- **Japanese → English** — read the word, pick the meaning
- **English → Japanese** — pick the right word for the English
- **Reading** — how is this kanji actually read?
- **Kana** — hiragana and katakana, one character at a time
- **Type the romaji** — spell the reading out; players take alternate turns

Pick any mix of JLPT levels from **N5 to N1**. Answering faster is worth more,
and consecutive correct answers build a streak.

---

## 🔊 About Mimic

Everyone hears the same sound. Each team gets **one shot** at copying it — no
retries, no editing — and the screen scores the take out of 100.

**It grades melody and rhythm, not your voice.** Pitch is measured relative to
your own median and loudness relative to your own peak, so a deep voice and a
high voice tracing the same shape score the same, and a cheap microphone is not
a handicap. Getting the tune right is worth more than getting the timing right,
but a take with the right notes in the wrong places still loses to one that
lands them properly.

After both takes, the wheel picks a team and a sabotage — their next playback
comes back drowning in echo, sped up like a chipmunk, distorted, chopped to
pieces, or replaced by a raspberry.

### What it can ask you to copy

| Source | What it is |
| --- | --- |
| 🎛️ **Synth sounds** | 40 built-in animals, machines and melodies |
| ⛩️ **Anime scenes** | 67 real lines, **Japanese audio only** — *Omae wa mou shindeiru*, *Ryouiki Tenkai*, *Kamehameha* |
| 🦸 **Marvel scenes** | 50 MCU moments — *I am Iron Man*, *I love you 3000*, *Wakanda forever* |
| 🎬 **Movie scenes** | 95 lines everyone can quote — *THIS IS SPARTA*, *You shall not pass*, *Why so serious* |
| 🎧 **Anime openings** | 263 real OP/ED tracks — it finds the sung hook for you rather than starting on the intro |
| ✂️ **My clips** | Anything you cut yourself |

Turn each of them on or off in setup. All of them play by exactly the same
rules — same countdown, same one shot, same scoring, same wheel.

**Anime scenes are the sub, not the dub.** Entries are listed by the Japanese
line in romaji — *Ryouiki Tenkai*, not *Domain Expansion* — because the romaji
is what you actually have to reproduce; the English meaning sits underneath with
the series. This is also how the build finds Japanese audio in the first place:
uploads of the Japanese track are titled in romaji and uploads of the dub are
titled in English, so searching the romaji selects for the sub. Anything whose
title or filename carries a dub marker (`dub`, `abridged`, `english`, and the
other language names) is rejected outright rather than merely marked down.

### ✂️ Clip Studio

Setup has a **Clip Studio** button for cutting your own references.

1. Drop in an audio or video file (mp3, m4a, wav, webm, mp4) — or open one of
   the built-in scenes and re-cut it.
2. It opens on the most singable stretch it can find rather than at zero. Drag
   the waveform to move the window, or press **✨ Find the good bit** again.
3. Trim to anywhere between **2 and 6 seconds** and preview it.
4. Name it, give it an icon, save.

Saved clips appear in the Mimic round under **My clips**. They live in
IndexedDB in that browser — they survive reloads, nothing is uploaded, and they
do not follow you to another device. The window is cut and converted to WAV at
save time, so playback never has to seek or re-decode the original file.

## 🎤 About Voice Battle

Each prompt is a character plus a direction for how to play it — *"Gojo Satoru:
playful, smug, sing-song, like you already won and find it funny"*. Both teams
perform the same one.

You can record each take with the device's microphone and play them back, and
there is a small stats line under each (length, average loudness, how much the
loudness varies). **Those stats are flavour, not a verdict** — deciding who did
a voice better is a matter of taste, so the round is settled by a vote. Playing
online, everyone votes from their own device and the tally appears live on the
host screen.

Recording needs microphone permission and an `https` connection, which your
Vercel URL is. If someone declines the prompt, the round still works — perform
out loud and vote.

---

## What is in the box

Around **4,000** playable items:

| | |
| --- | --- |
| Written questions | 320 across 7 topics |
| Voice Battle prompts | 89 characters to perform |
| Anime characters | 400 |
| Anime titles | 300 |
| Anime openings | 199 playable tracks |
| Anime endings | 158 playable tracks |
| Minecraft items, blocks & mobs | 260 |
| Terraria weapons, bosses, NPCs & gear | 285 |
| Malaysian landmarks, food & culture | 55 |
| Japanese vocabulary | 2,100 words + 92 kana |
| Mimic synth sounds | 40 |
| Mimic scene clips | 212 (67 anime in Japanese, 50 Marvel, 95 movie) |
| Openings usable as Mimic references | 263 |

Pictures and music are loaded straight from the sites they come from
(AniList, AnimeThemes, the Minecraft and Terraria wikis, Wikipedia) rather than
copied into this project, so the repo stays small and nothing copyrighted is
redistributed.

---

## Running it on your own machine

```bash
npm install && npm run dev
```

Then open http://localhost:3000.

### Rebuilding the content packs

The packs are already built and committed — you only need this if you want to
refresh them or add more:

```bash
npm run content          # re-scrape everything (takes a few minutes)
node scripts/clean-content.mjs
```

### Checking the Mimic scorer

The scoring engine is pure functions over `Float32Array`, so it is tested
outside the browser against synthetic takes whose right answer is known by
construction:

```bash
npm test
```

It asserts that the same shape traced in a different register scores the same,
that each way of getting it wrong stays clearly separated, that a one-note
reference still scores a perfect copy 100, and that a reference with music under
it can still tell a right take from a wrong one.

To add your own questions, edit the JSON files in `src/content/questions/` —
each entry is `{"q": "...", "a": "...", "c": ["four", "options", "incl", "answer"], "h": "hint"}`.
The answer must be one of the four options.

To change which items appear in the Minecraft or Terraria rounds, edit the name
lists in `scripts/sources-minecraft.mjs` and `scripts/sources-terraria.mjs`, then
re-run the content build.
