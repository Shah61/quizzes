'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Category, GameConfig, RoundKind, Team } from '@/game/types';
import { CATEGORY_EMOJI, CATEGORY_LABEL, ROUND_INFO, SOLO_ROUNDS, TEAM_COLOURS } from '@/game/types';
import { categorySize, clearMimicCache } from '@/game/content';
import { listClips } from '@/game/mimic-clips';
import {
  ALL_MIMIC_SOURCES, MIMIC_SOURCE_INFO, setCustomRefs, sourceSize, type MimicSourceId,
} from '@/game/mimic-refs';
import { sfx } from '@/game/sfx';

const ALL_CATEGORIES: Category[] = ['anime', 'minecraft', 'terraria', 'marvel', 'general', 'songs', 'malaysia'];
const ALL_ROUNDS: RoundKind[] = ['buzz', 'reveal', 'opening', 'ending', 'mimic', 'voice', 'rapid', 'chain', 'mcq', 'wager'];

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
  const allowed = (r: RoundKind) => (solo ? SOLO_ROUNDS.includes(r) : true);
  const effectiveRounds = rounds.filter(allowed);
  // Picking Mimic with nothing to mimic would build an empty round.
  const mimicReady = !mimicOn || mimicTotal > 0;
  const ready = categories.length > 0 && effectiveRounds.length > 0 && nameA.trim()
    && (solo || nameB.trim()) && mimicReady;

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
    onStart({ teams, categories, rounds: chosen, hosted, solo, questionsPerRound: perRound, mimicSources });
  };

  return (
    <div className="shell">
      <div className="wrap">
        <div className="topbar">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
          <h2 className="display" style={{ fontSize: '1.5rem' }}>{solo ? 'Set up your solo run' : 'Set up the game'}</h2>
        </div>

        <div className="setup-grid" style={{ paddingTop: 22 }}>
          {/* ------------------------------------------------ teams */}
          <section className="panel panel-lg" style={{ padding: 24 }}>
            <p className="label" style={{ marginBottom: 16 }}>{solo ? 'You' : 'The two teams'}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 22 }}>
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
          <section className="panel panel-lg" style={{ padding: 24, display: solo ? 'none' : undefined }}>
            <p className="label" style={{ marginBottom: 14 }}>Who runs the game?</p>
            <div className="seg" role="group">
              <button data-on={hosted} onClick={() => { sfx.select(); setHosted(true); }}>🎙️ I am the host</button>
              <button data-on={!hosted} onClick={() => { sfx.select(); setHosted(false); }}>🤖 No host needed</button>
            </div>
            <p className="muted" style={{ marginTop: 14, fontSize: '0.9em', maxWidth: '62ch' }}>
              {hosted
                ? 'You get the full control bar: mark answers right or wrong, drop hints, award or remove points, pause the clock and skip anything you do not like.'
                : 'Every round becomes multiple choice and the screen scores it — buzzers, rapid fire, the chain and the wager included. Team A answers with keys 1–4, Team B with 7–0, or just tap.'}
            </p>
          </section>

          {/* ------------------------------------------------ categories */}
          <section className="panel panel-lg" style={{ padding: 24 }}>
            <div className="row wrap-w gap-sm" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
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

          {/* ------------------------------------------------ rounds */}
          <section className="panel panel-lg" style={{ padding: 24 }}>
            <p className="label" style={{ marginBottom: 6 }}>Rounds &amp; running order</p>
            <p className="muted" style={{ fontSize: '0.88em', marginBottom: 16 }}>
              {solo
                ? 'Pick the rounds you want. They play in this order. Voice Battle needs two teams and a vote, so it sits this one out.'
                : hosted
                  ? 'Pick the rounds you want. They play in this order.'
                  : 'Pick the rounds you want — the screen runs and scores all of them.'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 10 }}>
              {ALL_ROUNDS.map((r) => {
                const info = ROUND_INFO[r];
                const usable = allowed(r);
                const on = rounds.includes(r) && usable;
                return (
                  <button
                    key={r}
                    className="choice"
                    data-state={on ? 'correct' : usable ? undefined : 'muted'}
                    disabled={!usable}
                    onClick={() => toggle(r, setRounds)}
                    style={{ alignItems: 'flex-start', textAlign: 'left' }}
                  >
                    <span className="choice-key">{info.emoji}</span>
                    <span>
                      <strong style={{ display: 'block' }}>{info.title}</strong>
                      <span className="muted" style={{ fontSize: '0.82em', fontWeight: 400 }}>{info.blurb}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ------------------------------------------------ mimic sources */}
          {mimicOn && (
            <section className="panel panel-lg" style={{ padding: 24 }}>
              <div className="row wrap-w gap-sm" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <p className="label">🔊 What the Mimic round plays</p>
                <button className="btn btn-ghost btn-sm" onClick={() => { sfx.select(); onStudio(); }}>
                  ✂️ Clip Studio
                </button>
              </div>
              <p className="muted" style={{ fontSize: '0.88em', marginBottom: 16 }}>
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

          {/* ------------------------------------------------ length */}
          <section className="panel panel-lg" style={{ padding: 24 }}>
            <p className="label" style={{ marginBottom: 14 }}>Questions per round</p>
            <div className="seg">
              {[3, 5, 10, 20, 50, 100].map((n) => (
                <button key={n} data-on={perRound === n} onClick={() => { sfx.select(); setPerRound(n); }}>{n}</button>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 12, fontSize: '0.9em' }}>
              About {Math.max(1, Math.round((effectiveRounds.length * perRound * 40) / 60))} minutes
              across {effectiveRounds.length} round{effectiveRounds.length === 1 ? '' : 's'}.
            </p>
          </section>

          <button className="btn btn-primary btn-lg" onClick={start} disabled={!ready} style={{ justifySelf: 'center', marginTop: 8 }}>
            {solo ? 'Start playing →' : 'Start the show →'}
          </button>
          {!ready && (
            <p className="muted" style={{ textAlign: 'center', fontSize: '0.88em' }}>
              {!mimicReady
                ? 'The Mimic round needs at least one sound source.'
                : 'Pick at least one topic and one round to continue.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
