// The MC/Terraria facts live as tuples next to their image lists; convert to the
// same shape as the hand-written banks.
import { writeFile } from 'node:fs/promises';
import { MC_FACTS } from './sources-minecraft.mjs';
import { TR_FACTS } from './sources-terraria.mjs';

const toRows = (facts) =>
  facts.map(([q, a, c]) => ({ q, a, c, d: 2 })).filter((r) => r.c.includes(r.a));

for (const [name, facts] of [['minecraft', MC_FACTS], ['terraria', TR_FACTS]]) {
  const rows = toRows(facts);
  const dropped = facts.length - rows.length;
  await writeFile(
    new URL(`../src/content/questions/${name}.json`, import.meta.url),
    JSON.stringify(rows, null, 0),
  );
  console.log(`${name}: ${rows.length} questions${dropped ? ` (${dropped} dropped: answer not in choices)` : ''}`);
}
