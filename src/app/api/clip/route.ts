/**
 * Audio relay for the Mimic round.
 *
 * Playing a remote file only needs an <audio> tag, but *scoring* one needs the
 * samples — which means fetch() + decodeAudioData, which means CORS. Neither
 * AnimeThemes nor the soundboard CDN sends an Access-Control-Allow-Origin
 * header, so the browser cannot read them directly however they are requested.
 *
 * This relays those bytes through the app's own origin instead. Nothing is
 * stored: the response is streamed straight through, and the long cache header
 * lets Vercel's edge serve the repeats so the same clip is only pulled once.
 *
 * The host allowlist is what stops this being an open proxy — without it,
 * anyone could point it at an internal address and read the response.
 */

export const runtime = 'nodejs';
// Range requests and the upstream's own caching make this a poor fit for
// prerendering; it has to run per request.
export const dynamic = 'force-dynamic';
// Pulling a few MB from a CDN that is sometimes slow does not fit in the 10s a
// serverless function gets by default.
export const maxDuration = 30;

const ALLOWED_HOSTS = new Set([
  'www.myinstants.com',
  'myinstants.com',
  'a.animethemes.moe',
  'v.animethemes.moe',
]);

// A backstop, not the real limit — what actually gets requested is capped much
// lower by MAX_MIMIC_BYTES in mimic-refs.ts, so a serverless response stays
// well inside the 4.5MB a function is allowed to return.
const MAX_BYTES = 20 * 1024 * 1024;

export async function GET(req: Request): Promise<Response> {
  const target = new URL(req.url).searchParams.get('u');
  if (!target) return new Response('missing ?u', { status: 400 });

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return new Response('bad url', { status: 400 });
  }
  if (url.protocol !== 'https:') return new Response('https only', { status: 400 });
  if (!ALLOWED_HOSTS.has(url.hostname)) return new Response('host not allowed', { status: 403 });

  // Some of these CDNs refuse anything that does not look like a browser, and
  // answer HEAD with a 403 even when GET is fine — so always GET.
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (compatible; QuizArena/1.0)',
    Accept: 'audio/*,video/*;q=0.9,*/*;q=0.8',
  };
  const range = req.headers.get('range');
  if (range) headers.Range = range;

  let upstream: Response;
  try {
    upstream = await fetch(url.toString(), {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
      cache: 'no-store',
    });
  } catch {
    return new Response('upstream unreachable', { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new Response(`upstream ${upstream.status}`, { status: 502 });
  }

  const length = Number(upstream.headers.get('content-length') ?? 0);
  if (length > MAX_BYTES) return new Response('file too large', { status: 413 });

  const out = new Headers();
  out.set('Content-Type', upstream.headers.get('content-type') ?? 'application/octet-stream');
  for (const h of ['content-length', 'content-range', 'accept-ranges']) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  // The upstream files are immutable, so this can be cached hard.
  out.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
  out.set('Access-Control-Allow-Origin', '*');

  return new Response(upstream.body, { status: upstream.status, headers: out });
}
