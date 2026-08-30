'use client';

import { useCallback, useRef, useState } from 'react';

/** Rough numbers about a take, shown as flavour — not a judgement of quality. */
export interface TakeStats {
  seconds: number;
  /** Average loudness, 0-100. */
  energy: number;
  /** Loudest moment, 0-100. */
  peak: number;
  /** How much the loudness varies — a proxy for dramatic range, 0-100. */
  range: number;
}

export interface Take {
  url: string;
  blob: Blob;
  stats: TakeStats;
}

/** Returned when the microphone could not be opened at all. */
export const NO_MIC = 'no-mic' as const;
export type RecordResult = Take | typeof NO_MIC | null;

/** Browsers disagree on container support; take the first one that works. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

async function analyse(blob: Blob): Promise<TakeStats> {
  const fallback: TakeStats = { seconds: 0, energy: 0, peak: 0, range: 0 };
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return fallback;
    const ctx = new Ctor();
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const data = buf.getChannelData(0);

    // Loudness per ~50ms window, so we can report an average and a spread.
    const win = Math.max(1, Math.floor(buf.sampleRate * 0.05));
    const windows: number[] = [];
    let peak = 0;
    for (let i = 0; i < data.length; i += win) {
      let sum = 0;
      const end = Math.min(i + win, data.length);
      for (let j = i; j < end; j++) {
        const v = Math.abs(data[j]);
        sum += v * v;
        if (v > peak) peak = v;
      }
      windows.push(Math.sqrt(sum / (end - i)));
    }
    void ctx.close();

    const loud = windows.filter((w) => w > 0.01);
    const mean = loud.length ? loud.reduce((a, b) => a + b, 0) / loud.length : 0;
    const max = loud.length ? Math.max(...loud) : 0;
    const min = loud.length ? Math.min(...loud) : 0;

    const scale = (v: number) => Math.round(Math.min(100, v * 260));
    return {
      seconds: Math.round(buf.duration * 10) / 10,
      energy: scale(mean),
      peak: scale(peak),
      range: scale(max - min),
    };
  } catch {
    return fallback;
  }
}

export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveRef = useRef<((t: RecordResult) => void) | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    recRef.current?.state === 'recording' && recRef.current.stop();
  }, []);

  const start = useCallback(async (): Promise<RecordResult> => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recRef.current = rec;
      chunksRef.current = [];

      const done = new Promise<RecordResult>((resolve) => { resolveRef.current = resolve; });

      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: mimeType ?? 'audio/webm' });
        const take: Take | null = blob.size
          ? { url: URL.createObjectURL(blob), blob, stats: await analyse(blob) }
          : null;
        resolveRef.current?.(take);
        resolveRef.current = null;
      };

      rec.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      return done;
    } catch {
      // Almost always a denied permission prompt, or an insecure origin.
      setError('No microphone access — check the browser permission prompt.');
      setRecording(false);
      return NO_MIC;
    }
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    recRef.current = null;
    setRecording(false);
  }, []);

  return { start, stop, cancel, recording, elapsed, error };
}

/** Microphone capture needs a secure context — https, or localhost in dev. */
export const canRecord = () =>
  typeof window !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  typeof MediaRecorder !== 'undefined' &&
  window.isSecureContext;
