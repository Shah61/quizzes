'use client';

/**
 * Clip Studio — cut your own Mimic references.
 *
 * Drop in a file (or open one of the built-in scenes), scrub to the moment you
 * want, trim it to a window between two and six seconds, and save it. Saved
 * clips go into IndexedDB in this browser and then behave exactly like any
 * other Mimic reference: same countdown, same one shot, same scoring.
 *
 * The window is cut and encoded at save time rather than at play time, so the
 * round never has to seek, re-trim, or hope the browser can still decode a
 * .mov container three weeks later.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  audioCtx, decodeFile, decodeUrl, encodeWav, sliceBuffer, forgetRef, toAnalysisSamples,
  ANALYSIS_RATE, CLIP_MIN, CLIP_MAX, clampClipLength,
} from '@/game/mimic-audio';
import { pickBestWindow } from '@/game/mimic-dsp';
import { masterGain } from '@/game/volume';
import { clipId, deleteClip, listClips, saveClip, type ClipMeta } from '@/game/mimic-clips';
import { refsFor, setCustomRefs, type MimicRef, type MimicSourceId, MIMIC_SOURCE_INFO } from '@/game/mimic-refs';
import { sfx } from '@/game/sfx';

const ACCEPT = 'audio/*,video/*,.mp3,.m4a,.wav,.webm,.mp4,.ogg,.aac,.flac,.mov';
const EMOJI_CHOICES = ['🎬', '⚔️', '🦸', '🔊', '😱', '💥', '🎤', '🐉', '👊', '🌀', '🎵', '⭐'];
/** Buckets across the waveform. Enough detail to aim with, cheap enough to redraw on every drag. */
const PEAKS = 1400;

interface Loaded {
  buffer: AudioBuffer;
  peaks: Float32Array;
  label: string;
  suggestedName: string;
  emoji: string;
}

/** Min/max envelope per bucket, so quiet detail does not vanish at this width. */
function computePeaks(buffer: AudioBuffer): Float32Array {
  const channels = buffer.numberOfChannels;
  const len = buffer.length;
  const out = new Float32Array(PEAKS);
  const per = Math.max(1, Math.floor(len / PEAKS));
  for (let b = 0; b < PEAKS; b++) {
    const start = b * per;
    const end = Math.min(len, start + per);
    let peak = 0;
    for (let c = 0; c < channels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = start; i < end; i += 2) {
        const v = Math.abs(data[i]);
        if (v > peak) peak = v;
      }
    }
    out[b] = peak;
  }
  let max = 0;
  for (const v of out) if (v > max) max = v;
  if (max > 0) for (let i = 0; i < out.length; i++) out[i] /= max;
  return out;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function ClipStudio({ onBack }: { onBack: () => void }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [start, setStart] = useState(0);
  const [length, setLength] = useState(4);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🎬');
  const [saved, setSaved] = useState<ClipMeta[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [browse, setBrowse] = useState<MimicSourceId | null>(null);
  const [filter, setFilter] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const draggingRef = useRef(false);

  const duration = loaded?.buffer.duration ?? 0;
  const maxStart = Math.max(0, duration - length);

  /* -------------------------------------------------------- saved clips */

  const refresh = useCallback(async () => {
    try {
      const clips = await listClips();
      setSaved(clips);
      setCustomRefs(clips);
    } catch {
      setError('This browser will not let the game store clips (private windows often block it).');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  /* ------------------------------------------------------------ loading */

  const stopPreview = useCallback(() => {
    try { sourceRef.current?.stop(); } catch { /* already finished */ }
    sourceRef.current = null;
    setPlaying(false);
  }, []);

  const adopt = useCallback((buffer: AudioBuffer, label: string, suggestedName: string, withEmoji: string) => {
    const peaks = computePeaks(buffer);
    setLoaded({ buffer, peaks, label, suggestedName, emoji: withEmoji });
    setName(suggestedName);
    setEmoji(withEmoji);

    // Open on the best stretch rather than at zero: for anything longer than a
    // few seconds the front of the file is usually the least useful part.
    const want = clampClipLength(Math.min(4, buffer.duration));
    setLength(want);
    setStart(buffer.duration > want
      ? pickBestWindow(toAnalysisSamples(buffer), ANALYSIS_RATE, want)
      : 0);
  }, []);

  const importFiles = useCallback(async (files: FileList | File[]) => {
    const file = Array.from(files)[0];
    if (!file) return;
    stopPreview();
    setError(null);
    setBusy(`Decoding ${file.name}…`);
    try {
      const buffer = await decodeFile(file);
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      adopt(buffer, file.name, base.slice(0, 40) || 'My clip', '🎬');
      sfx.select();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That file could not be read.');
    } finally {
      setBusy(null);
    }
  }, [adopt, stopPreview]);

  const openRef = useCallback(async (ref: MimicRef) => {
    if (!ref.url) return;
    stopPreview();
    setError(null);
    setBusy(`Loading ${ref.name}…`);
    try {
      const buffer = await decodeUrl(ref.url);
      adopt(buffer, ref.from ?? ref.name, ref.name, ref.emoji);
      setBrowse(null);
      sfx.select();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That clip could not be loaded.');
    } finally {
      setBusy(null);
    }
  }, [adopt, stopPreview]);

  /* ------------------------------------------------------------ preview */

  const preview = useCallback(() => {
    if (!loaded) return;
    stopPreview();
    const ctx = audioCtx();
    const src = ctx.createBufferSource();
    src.buffer = sliceBuffer(loaded.buffer, start, length);
    src.connect(masterGain(ctx));
    src.onended = () => { sourceRef.current = null; setPlaying(false); };
    src.start();
    sourceRef.current = src;
    setPlaying(true);
  }, [loaded, start, length, stopPreview]);

  useEffect(() => stopPreview, [stopPreview]);

  /* ------------------------------------------------------------- canvas */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loaded) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const g = canvas.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    const mid = h / 2;
    const selFrom = (start / duration) * w;
    const selTo = ((start + length) / duration) * w;

    // Selected span lit, the rest dimmed — the window is the point of the view.
    g.fillStyle = 'rgba(124, 92, 255, 0.16)';
    g.fillRect(selFrom, 0, Math.max(1, selTo - selFrom), h);

    for (let i = 0; i < PEAKS; i++) {
      const x = (i / PEAKS) * w;
      const inSel = x >= selFrom && x <= selTo;
      const amp = loaded.peaks[i] * (h / 2 - 3);
      g.fillStyle = inSel ? '#22d3ee' : 'rgba(255,255,255,0.19)';
      g.fillRect(x, mid - amp, Math.max(1, w / PEAKS), Math.max(1, amp * 2));
    }

    g.strokeStyle = '#7c5cff';
    g.lineWidth = 2;
    for (const x of [selFrom, selTo]) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
  }, [loaded, start, length, duration]);

  const aimAt = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !duration) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    // Grab the centre of the window, which is what the pointer feels like it holds.
    setStart(Math.max(0, Math.min(maxStart, ratio * duration - length / 2)));
  }, [duration, length, maxStart]);

  /* --------------------------------------------------------------- save */

  const save = useCallback(async () => {
    if (!loaded) return;
    stopPreview();
    setBusy('Saving…');
    setError(null);
    try {
      const clipped = sliceBuffer(loaded.buffer, start, length);
      const id = clipId();
      await saveClip({
        id,
        name: name.trim().slice(0, 48) || 'Untitled clip',
        emoji: emoji.trim().slice(0, 4) || '🎬',
        from: loaded.label,
        seconds: Math.round(clipped.duration * 100) / 100,
        createdAt: Date.now(),
        blob: encodeWav(clipped),
      });
      forgetRef(id);
      await refresh();
      sfx.correct();
      setLoaded(null);
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The clip could not be saved.');
    } finally {
      setBusy(null);
    }
  }, [loaded, start, length, name, emoji, refresh, stopPreview]);

  const remove = useCallback(async (id: string) => {
    await deleteClip(id);
    forgetRef(id);
    await refresh();
    sfx.wrong();
  }, [refresh]);

  const playSaved = useCallback(async (meta: ClipMeta) => {
    stopPreview();
    const { getClip } = await import('@/game/mimic-clips');
    const row = await getClip(meta.id);
    if (!row) return;
    const ctx = audioCtx();
    const buffer = await ctx.decodeAudioData(await row.blob.arrayBuffer());
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(masterGain(ctx));
    src.onended = () => { sourceRef.current = null; setPlaying(false); };
    src.start();
    sourceRef.current = src;
    setPlaying(true);
  }, [stopPreview]);

  /* ------------------------------------------------------------- browse */

  const browseList = useMemo(() => {
    if (!browse) return [];
    const q = filter.trim().toLowerCase();
    return refsFor([browse])
      .filter((r) => !q || r.name.toLowerCase().includes(q) || (r.from ?? '').toLowerCase().includes(q))
      .slice(0, 160);
  }, [browse, filter]);

  /* -------------------------------------------------------------- views */

  return (
    <div className="shell">
      <div className="wrap">
        <div className="topbar">
          <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
          <h2 className="display" style={{ fontSize: '1.5rem' }}>✂️ Clip Studio</h2>
        </div>

        <div className="stack gap" style={{ paddingTop: 22, gap: 18 }}>
          <p className="muted" style={{ fontSize: '0.92em', maxWidth: '70ch' }}>
            Cut your own sounds for the Mimic round. Import a file from this device, or
            open one of the built-in scenes and re-cut it. Clips are saved in this
            browser only — nothing is uploaded.
          </p>

          {error && (
            <div className="panel" style={{ padding: 14, borderColor: 'rgba(255,77,106,0.4)' }}>
              <p style={{ color: 'var(--bad)', fontSize: '0.9em' }}>{error}</p>
            </div>
          )}

          {/* ------------------------------------------------ import */}
          {!loaded && (
            <section className="panel panel-lg" style={{ padding: 24 }}>
              <p className="label" style={{ marginBottom: 14 }}>Start from</p>
              <div
                className="clip-drop"
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                onDrop={(e) => { e.preventDefault(); void importFiles(e.dataTransfer.files); }}
                onClick={() => fileRef.current?.click()}
              >
                <span className="clip-drop-emoji">🎧</span>
                <strong>Drop an audio or video file here</strong>
                <span className="muted" style={{ fontSize: '0.86em' }}>
                  or click to pick one — mp3, m4a, wav, webm, mp4
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPT}
                  hidden
                  onChange={(e) => { if (e.target.files) void importFiles(e.target.files); e.target.value = ''; }}
                />
              </div>

              <p className="label" style={{ margin: '20px 0 10px' }}>Or re-cut a built-in scene</p>
              <div className="row wrap-w gap-sm">
                {(['anime', 'marvel', 'movie', 'openings'] as MimicSourceId[]).map((s) => (
                  <button key={s} className="chip" data-on={browse === s}
                    onClick={() => { sfx.select(); setBrowse(browse === s ? null : s); setFilter(''); }}>
                    <span>{MIMIC_SOURCE_INFO[s].emoji}</span>
                    <span>{MIMIC_SOURCE_INFO[s].label}</span>
                  </button>
                ))}
              </div>

              {browse && (
                <div className="stack" style={{ gap: 10, marginTop: 14 }}>
                  <input
                    className="input"
                    placeholder="Search…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                  <div className="clip-browse">
                    {browseList.map((r) => (
                      <button key={r.id} className="clip-browse-row" onClick={() => void openRef(r)}>
                        <span className="clip-row-emoji">{r.emoji}</span>
                        <span className="clip-row-text">
                          <strong>{r.name}</strong>
                          {r.from && <span className="muted">{r.from}</span>}
                        </span>
                      </button>
                    ))}
                    {!browseList.length && <p className="dim" style={{ padding: 12, fontSize: '0.88em' }}>Nothing matches that.</p>}
                  </div>
                </div>
              )}
            </section>
          )}

          {busy && <p className="muted" style={{ fontSize: '0.9em' }}>{busy}</p>}

          {/* ------------------------------------------------ editor */}
          {loaded && (
            <section className="panel panel-lg" style={{ padding: 24 }}>
              <div className="row gap-sm wrap-w" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
                <p className="label">{loaded.label}</p>
                <button className="btn btn-ghost btn-sm" onClick={() => { stopPreview(); setLoaded(null); }}>
                  Pick something else
                </button>
              </div>

              <canvas
                ref={canvasRef}
                className="clip-wave"
                onPointerDown={(e) => {
                  draggingRef.current = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  aimAt(e.clientX);
                }}
                onPointerMove={(e) => { if (draggingRef.current) aimAt(e.clientX); }}
                onPointerUp={(e) => {
                  draggingRef.current = false;
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }}
              />
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
                <span className="dim" style={{ fontSize: '0.78em' }}>0:00</span>
                <span className="muted tabular" style={{ fontSize: '0.82em' }}>
                  {fmt(start)} → {fmt(start + length)}
                </span>
                <span className="dim" style={{ fontSize: '0.78em' }}>{fmt(duration)}</span>
              </div>

              <div className="clip-controls">
                <label className="field" style={{ gap: 6 }}>
                  <span className="label">Start · {start.toFixed(2)}s</span>
                  <input
                    type="range" min={0} max={Math.max(0.01, maxStart)} step={0.01}
                    value={Math.min(start, maxStart)}
                    onChange={(e) => setStart(Number(e.target.value))}
                  />
                </label>
                <label className="field" style={{ gap: 6 }}>
                  <span className="label">Length · {length.toFixed(1)}s</span>
                  <input
                    type="range" min={CLIP_MIN} max={CLIP_MAX} step={0.1}
                    value={length}
                    onChange={(e) => {
                      const next = clampClipLength(Number(e.target.value));
                      setLength(next);
                      setStart((s) => Math.max(0, Math.min(s, duration - next)));
                    }}
                  />
                </label>
              </div>

              <div className="row gap-sm wrap-w" style={{ marginTop: 14 }}>
                <button className="btn" onClick={playing ? stopPreview : preview}>
                  {playing ? '■ Stop' : '▶ Preview the window'}
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    setStart(pickBestWindow(toAnalysisSamples(loaded.buffer), ANALYSIS_RATE, Math.min(length, duration)));
                    sfx.select();
                  }}
                >
                  ✨ Find the good bit
                </button>
              </div>

              <div className="clip-meta">
                <label className="field" style={{ flex: '1 1 220px' }}>
                  <span className="label">Name it</span>
                  <input className="input" value={name} maxLength={48}
                    onChange={(e) => setName(e.target.value)} placeholder="What is this clip?" />
                </label>
                <div className="field">
                  <span className="label">Icon</span>
                  <div className="row gap-sm wrap-w" style={{ maxWidth: 260 }}>
                    {EMOJI_CHOICES.map((e) => (
                      <button key={e} className="clip-emoji" data-on={emoji === e}
                        onClick={() => setEmoji(e)}>{e}</button>
                    ))}
                  </div>
                </div>
              </div>

              <button className="btn btn-primary btn-lg" style={{ marginTop: 18 }}
                disabled={!!busy} onClick={() => void save()}>
                Save this clip →
              </button>
            </section>
          )}

          {/* ------------------------------------------------ saved */}
          <section className="panel panel-lg" style={{ padding: 24 }}>
            <div className="row wrap-w gap-sm" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
              <p className="label">Your clips</p>
              <span className="chip-count">{saved.length} saved</span>
            </div>
            {!saved.length && (
              <p className="dim" style={{ fontSize: '0.9em' }}>
                Nothing saved yet. Anything you cut here shows up in the Mimic round
                under <b>My clips</b>.
              </p>
            )}
            <div className="clip-list">
              {saved.map((c) => (
                <div key={c.id} className="clip-saved">
                  <span className="clip-row-emoji">{c.emoji}</span>
                  <span className="clip-row-text">
                    <strong>{c.name}</strong>
                    <span className="muted">{c.from} · {c.seconds.toFixed(1)}s</span>
                  </span>
                  <button className="btn btn-sm" onClick={() => void playSaved(c)}>▶</button>
                  <button className="btn btn-sm btn-bad" onClick={() => void remove(c.id)}>Delete</button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
