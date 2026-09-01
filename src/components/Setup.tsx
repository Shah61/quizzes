'use client';

/**
 * Setting the game up.
 *
 * Same anatomy as the home screen — ground, rail, top bar, the figure standing
 * behind it — with the form itself in glass cards that scroll under a fixed
 * header. Two columns once there is room, because a twelve-round line-up and
 * thirteen topics in one column is a mile of scrolling.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AnswerMode, Category, GameConfig, RoundKind, Team } from '@/game/types';
import { CATEGORY_EMOJI, CATEGORY_LABEL, ROUND_INFO, SOLO_ROUNDS, TEAM_COLOURS } from '@/game/types';
import { categorySize, clearMimicCache, preloadQuestions, questionsReady } from '@/game/content';
import { listClips } from '@/game/mimic-clips';
import {
  ALL_MIMIC_SOURCES, MIMIC_SOURCE_INFO, setCustomRefs, sourceSize, type MimicSourceId,
} from '@/game/mimic-refs';
import { sfx } from '@/game/sfx';
import { hasStreetView } from '@/game/maps';
import { ROUND_THEME } from '@/game/theme';
import { Cta, Hud, Rail, Screen, Wordmark, type RailItem } from './Shell';

const ALL_CATEGORIES: Category[] = [
  'anime', 'minecraft', 'terraria', 'marvel', 'general', 'songs', 'malaysia',
  'film', 'games', 'science', 'history', 'geography', 'sport',
];
const ALL_ROUNDS: RoundKind[] = ['buzz', 'reveal', 'opening', 'ending', 'mimic', 'voice', 'geo', 'street', 'rapid', 'chain', 'mcq', 'wager'];

export default function Setup({ onStart, onBack, onStudio, solo = false }: {
  onStart: (c: GameConfig) => void;
  onBack: () => void;
  onStudio: () => void;
  /** One player against the questions — no second team, no host. */
  solo?: boolean;
}) {
  const [nameA, setNameA] = useState(solo ? 'You' : 'Team Red');
  const [nameB, setNameB] = useState('Team Blue');
  const [colourA, setColourA] = useState(TEAM_COLOURS[1]);
  const [colourB, setColourB] = useState(TEAM_COLOURS[0]);
  // A solo game has nobody to host it and nobody to host it for.
  const [hosted, setHosted] = useState(!solo);
  const [categories, setCategories] = useState<Category[]>(ALL_CATEGORIES);
  const [rounds, setRounds] = useState<RoundKind[]>(['buzz', 'reveal', 'opening', 'rapid', 'chain', 'wager']);
  const [perRound, setPerRound] = useState(5);
  const [mimicSources, setMimicSources] = useState<MimicSourceId[]>(['synth', 'anime', 'marvel', 'movie']);
  const [answerMode, setAnswerMode] = useState<AnswerMode>('choices');
  // The question bank is a separate chunk; fetch it while topics are picked.
  const [banksIn, setBanksIn] = useState(questionsReady());
  useEffect(() => { void preloadQuestions().then(() => setBanksIn(true)); }, []);
  // Bumped when the saved clips are re-read, so the counts below refresh.
  const [clipTick, setClipTick] = useState(0);

  // Clips live in IndexedDB, so the reference registry has to be told about them
  // before anything can count or play them.
  const loadClips = useCallback(async () => {
    try {
      setCustomRefs(await listClips());
      clearMimicCache();
      setClipTick((n) => n + 1);
    } catch {
      // No clip store in this browser — the other sources still work.
    }
  }, []);
  useEffect(() => { void loadClips(); }, [loadClips]);

  const sizes = useMemo(
    () => Object.fromEntries(ALL_CATEGORIES.map((c) => [c, categorySize(c)])) as Record<Category, number>,
    [],
  );
  void banksIn; // the counts come from the manifest, but re-render when it lands

  const mimicSizes = useMemo(
    () => Object.fromEntries(ALL_MIMIC_SOURCES.map((s) => [s, sourceSize(s)])) as Record<MimicSourceId, number>,
    // clipTick is the dependency that matters: sourceSize('custom') reads the registry.
    [clipTick],
  );
  const mimicOn = rounds.includes('mimic');
  const mimicTotal = mimicSources.reduce((n, s) => n + mimicSizes[s], 0);

  // Functional update: reading the current array from the closure loses toggles
  // when several are clicked before React re-renders.
  const toggle = <T,>(value: T, set: React.Dispatch<React.SetStateAction<T[]>>) => {
    sfx.select();
    set((list) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]));
  };

  // Every round scores itself now, so the only filter left is solo: Voice
  // Battle is two teams performing and the room voting between them, which does
  // not reduce to one player.
  const allowed = (r: RoundKind) => {
    // Street View needs a Google Maps key; without one it would be a blank box.
    if (r === 'street' && !hasStreetView()) return false;
    return solo ? SOLO_ROUNDS.includes(r) : true;
  };
  const effectiveRounds = rounds.filter(allowed);
  // Picking Mimic with nothing to mimic would build an empty round.
  const mimicReady = !mimicOn || mimicTotal > 0;
  const ready = categories.length > 0 && effectiveRounds.length > 0 && nameA.trim()
    && (solo || nameB.trim()) && mimicReady && banksIn;

  const start = () => {
    if (!ready) return;
    sfx.start();
    const teams: [Team, Team] = [
      { id: 'a', name: nameA.trim() || (solo ? 'You' : 'Team A'), colour: colourA, score: 0 },
      // Solo still carries a second team so the shape of the config never
      // changes; playingTeams() is what decides who is actually in the game.
      { id: 'b', name: nameB.trim() || 'Team B', colour: colourB, score: 0 },
    ];
    const chosen = effectiveRounds.length ? effectiveRounds : (['mcq'] as RoundKind[]);
    onStart({ teams, categories, rounds: chosen, hosted, solo, answerMode, questionsPerRound: perRound, mimicSources });
  };

  const rails: RailItem[] = [
    { key: 'back', icon: 'back', label: 'Back to the menu', onGo: () => { sfx.select(); onBack(); } },
    { key: 'setup', icon: solo ? 'target' : 'swords', label: solo ? 'Set your run up' : 'Set the game up' },
    { key: 'studio', icon: 'scissors', label: 'Clip Studio', onGo: () => { sfx.select(); onStudio(); } },
  ];

  const minutes = Math.max(1, Math.round((effectiveRounds.length * perRound * 40) / 60));

  return (
    <Screen>
      <Hud>
        <Wordmark jp={solo ? 'ソロラン' : 'アリーナ'} en={solo ? 'Solo run' : 'Arena'} />
        <div className="hud-right">
          <span className="hud-pill">{categories.length} topics</span>
          <span className="hud-pill">{effectiveRounds.length} rounds · ~{minutes} min</span>
        </div>
      </Hud>

      <Rail items={rails} active="setup" />

      <div className="screen-main">
        <div className="sheet">
          <div className="sheet-head">
            <h1 className="sheet-title">{solo ? 'Your solo run' : 'Set up the show'}</h1>
            <p className="sheet-lede">
              {solo
                ? 'Pick your topics and the rounds you want. Everything is scored on screen.'
                : 'Two teams, your topics, your running order. The rounds play in the order you pick them.'}
            </p>
          </div>

          <div className="sheet-body">
            {/* ---------------------------------------------------- teams */}
            <section className="card panel">
              <div className="card-head">
                <p className="label">{solo ? 'You' : 'The two teams'}</p>
              </div>
              <div className="grid-auto">
                {([
                  { name: nameA, setName: setNameA, colour: colourA, setColour: setColourA, side: 'A' },
                  ...(solo ? [] : [{ name: nameB, setName: setNameB, colour: colourB, setColour: setColourB, side: 'B' }]),
                ]).map((t) => (
                  <div key={t.side} className="field">
                    <span className="label">{solo ? 'Your name' : `Team ${t.side}`}</span>
                    <input
                      className="input"
                      value={t.name}
                      maxLength={22}
                      onChange={(e) => t.setName(e.target.value)}
                      style={{ borderColor: t.colour, fontWeight: 700 }}
                    />
                    <div className="swatches">
                      {TEAM_COLOURS.map((c) => (
                        <button
                          key={c}
                          className="swatch"
                          style={{ background: c }}
                          data-on={t.colour === c}
                          aria-label={`Colour ${c}`}
                          onClick={() => { sfx.select(); t.setColour(c); }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ------------------------------------------------ host mode */}
            {!solo && (
              <section className="card panel">
                <div className="card-head"><p className="label">Who runs the game?</p></div>
                <div className="seg" role="group">
                  <button data-on={hosted} onClick={() => { sfx.select(); setHosted(true); }}>🎙️ I am the host</button>
                  <button data-on={!hosted} onClick={() => { sfx.select(); setHosted(false); }}>🤖 No host needed</button>
                </div>
                <p className="card-note" style={{ marginTop: 14 }}>
                  {hosted
                    ? 'You get the full control bar: mark answers right or wrong, drop hints, award or remove points, pause the clock and skip anything you do not like.'
                    : 'Every round becomes multiple choice and the screen scores it — buzzers, rapid fire, the chain and the wager included. Team A answers with keys 1–4, Team B with 7–0, or just tap.'}
                </p>
              </section>
            )}

            {/* ----------------------------------------------- categories */}
            <section className="card panel span-2">
              <div className="card-head">
                <p className="label">Topics</p>
                <button className="btn btn-ghost btn-sm"
                  onClick={() => { sfx.select(); setCategories(categories.length === ALL_CATEGORIES.length ? [] : ALL_CATEGORIES); }}>
                  {categories.length === ALL_CATEGORIES.length ? 'Clear all' : 'Select all'}
                </button>
              </div>
              <div className="row wrap-w gap-sm">
                {ALL_CATEGORIES.map((c) => (
                  <button key={c} className="chip" data-on={categories.includes(c)}
                    onClick={() => toggle(c, setCategories)}>
                    <span>{CATEGORY_EMOJI[c]}</span>
                    <span>{CATEGORY_LABEL[c]}</span>
                    <span className="chip-count">{sizes[c]}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* --------------------------------------------------- rounds */}
            <section className="card panel span-2">
              <div className="card-head">
                <p className="label">Rounds &amp; running order</p>
                <span className="chip-count">{effectiveRounds.length} picked</span>
              </div>
              <p className="card-note" style={{ marginBottom: 16 }}>
                {solo
                  ? 'Pick the rounds you want. They play in this order. Voice Battle needs two teams and a vote, so it sits this one out.'
                  : hosted
                    ? 'Pick the rounds you want. They play in this order.'
                    : 'Pick the rounds you want — the screen runs and scores all of them.'}
              </p>
              <div className="grid-auto">
                {ALL_ROUNDS.map((r) => {
                  const info = ROUND_INFO[r];
                  const usable = allowed(r);
                  const on = rounds.includes(r) && usable;
                  return (
                    <button
                      key={r}
                      className="round-choice"
                      data-on={on}
                      disabled={!usable}
                      onClick={() => toggle(r, setRounds)}
                      // Each card wears the round's own colour and face, so the
                      // running order reads as a line-up rather than a list.
                      style={{
                        ['--accent' as string]: ROUND_THEME[r].accent,
                        ['--accent-2' as string]: ROUND_THEME[r].accent2,
                        ['--round-font' as string]: ROUND_THEME[r].font,
                      }}
                    >
                      <span className="round-choice-emoji">{info.emoji}</span>
                      <span className="grow">
                        <strong className="round-choice-title">{info.title}</strong>
                        <span className="round-choice-blurb">{info.blurb}</span>
                        {/* A greyed-out card with no reason given is just baffling —
                            say what is missing and where to fix it. */}
                        {!usable && (
                          <span className="round-why">
                            {r === 'street'
                              ? 'Needs a Google Maps key with the Maps Embed API enabled — see .env.example'
                              : 'Needs two teams, so it sits out a solo run'}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* -------------------------------------------- mimic sources */}
            {mimicOn && (
              <section className="card panel span-2">
                <div className="card-head">
                  <p className="label">🔊 What the Mimic round plays</p>
                  <button className="btn btn-ghost btn-sm" onClick={() => { sfx.select(); onStudio(); }}>
                    ✂️ Clip Studio
                  </button>
                </div>
                <p className="card-note" style={{ marginBottom: 16 }}>
                  Real scene audio and anime openings work exactly like the built-in sounds —
                  same countdown, one shot each, same scoring. Cut your own in the Clip Studio.
                </p>
                <div className="row wrap-w gap-sm">
                  {ALL_MIMIC_SOURCES.map((s) => {
                    const info = MIMIC_SOURCE_INFO[s];
                    const empty = mimicSizes[s] === 0;
                    return (
                      <button key={s} className="chip" data-on={mimicSources.includes(s) && !empty}
                        disabled={empty}
                        title={empty ? 'Nothing here yet' : info.blurb}
                        onClick={() => toggle(s, setMimicSources)}>
                        <span>{info.emoji}</span>
                        <span>{info.label}</span>
                        <span className="chip-count">{mimicSizes[s]}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="dim" style={{ fontSize: '0.85em', marginTop: 12 }}>
                  {mimicTotal > 0
                    ? `${mimicTotal.toLocaleString()} sounds in the pool.`
                    : 'Pick at least one source, or the round has nothing to play.'}
                </p>
              </section>
            )}

            {/* ---------------------------------------------- answer mode */}
            <section className="card panel">
              <div className="card-head"><p className="label">How answers are given</p></div>
              <div className="seg" role="group">
                <button data-on={answerMode === 'choices'} onClick={() => { sfx.select(); setAnswerMode('choices'); }}>
                  🔘 Four options
                </button>
                <button data-on={answerMode === 'typed'} onClick={() => { sfx.select(); setAnswerMode('typed'); }}>
                  ⌨️ Type it out
                </button>
              </div>
              <p className="card-note" style={{ marginTop: 14 }}>
                {answerMode === 'choices'
                  ? 'Tap or key one of four. Friendly, fast, and everyone can join in.'
                  : 'No options — produce the answer from nothing, for half as many points again. Spelling, spacing and word order are forgiven, so “shingeki” takes Attack on Titan.'}
              </p>
            </section>

            {/* --------------------------------------------------- length */}
            <section className="card panel">
              <div className="card-head"><p className="label">Questions per round</p></div>
              <div className="seg">
                {[3, 5, 10, 20, 50, 100].map((n) => (
                  <button key={n} data-on={perRound === n} onClick={() => { sfx.select(); setPerRound(n); }}>{n}</button>
                ))}
              </div>
              <p className="card-note" style={{ marginTop: 14 }}>
                About {minutes} minutes across {effectiveRounds.length} round{effectiveRounds.length === 1 ? '' : 's'}.
              </p>
            </section>

            <div className="sheet-footer span-2">
              <Cta className="btn-lg" onClick={start} disabled={!ready} arrow="→">
                {solo ? 'Start playing' : 'Start the show'}
              </Cta>
              {!ready && (
                <p className="muted" style={{ textAlign: 'center', fontSize: '0.88em' }}>
                  {!banksIn
                    ? 'Fetching the question bank…'
                    : !mimicReady
                      ? 'The Mimic round needs at least one sound source.'
                      : 'Pick at least one topic and one round to continue.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}
