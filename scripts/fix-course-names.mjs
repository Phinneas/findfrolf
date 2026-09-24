// Normalize concatenated course names (e.g. "BuckSnort" -> "Buck Snort",
// "DiscGolfPark" -> "Disc Golf Park") without touching legitimate proper
// nouns (McCurry, DeBusk, SeaTac, MetCenter, brand names, etc.).
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'src/content/courses');

const replacements = [
  [/DiscGolf/g, 'Disc Golf'],
  [/MultiGolf/g, 'Multi Golf'],
  [/GolfPark/g, 'Golf Park'],
  [/GracePointFellowship/g, 'Grace Point Fellowship'],
  [/BuckSnort/g, 'Buck Snort'],
];

let changed = 0;
const changes = [];

for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
  const p = path.join(DIR, file);
  const raw = fs.readFileSync(p, 'utf8');
  let next = raw;
  for (const [re, sub] of replacements) {
    next = next.replace(re, sub);
  }
  if (next !== raw) {
    // Only rewrite the "name" field, never other prose that may contain
    // these tokens (none should, but be safe).
    const j = JSON.parse(raw);
    let name = j.name;
    for (const [re, sub] of replacements) {
      name = name.replace(re, sub);
    }
    if (name !== j.name) {
      j.name = name;
      fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
      changed += 1;
      changes.push(`${file}: ${j.name}`);
    }
  }
}

console.log(`Normalized ${changed} course name(s):`);
console.log(changes.join('\n') || '(none)');
