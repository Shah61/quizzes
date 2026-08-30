// Small shared helpers for the content build: polite fetching, retries, concurrency.
const UA = 'QuizArenaContentBuilder/1.0 (personal party-quiz project)';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function getJSON(url, { retries = 3, headers = {} } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      if (attempt === retries) return null;
      await sleep(1200 * (attempt + 1));
    }
  }
  return null;
}

export async function postJSON(url, body, { retries = 4 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      if (attempt === retries) return null;
      await sleep(2000 * (attempt + 1));
    }
  }
  return null;
}

// Run tasks with a bounded number in flight so we stay inside API rate limits.
export async function pool(items, limit, worker) {
  const results = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

// MediaWiki lets us resolve up to 50 File: titles per call, so batch them.
export async function resolveWikiImages(apiBase, fileTitles, width = 512) {
  const out = new Map();
  for (let i = 0; i < fileTitles.length; i += 40) {
    const batch = fileTitles.slice(i, i + 40);
    const titles = batch.map((t) => `File:${t}`).join('|');
    const url =
      `${apiBase}?action=query&format=json&prop=imageinfo&iiprop=url` +
      `&iiurlwidth=${width}&titles=${encodeURIComponent(titles)}`;
    const data = await getJSON(url);
    const pages = data?.query?.pages ?? {};
    for (const page of Object.values(pages)) {
      if (page.missing !== undefined) continue;
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const name = String(page.title).replace(/^File:/, '').replace(/\.(png|jpg|jpeg|gif)$/i, '');
      // thumburl keeps payloads small; fall back to the original for tiny sprites.
      out.set(name, (info.thumburl || info.url).split('?')[0]);
    }
    await sleep(150);
  }
  return out;
}
