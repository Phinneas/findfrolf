// Assign each course a branded illustration variant based on its terrain
// tags, replacing the shared "photo coming soon" placeholder. Also cleans the
// "photo coming soon"/"placeholder" alt/caption copy on the (unrendered)
// photos array for correctness.
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'src/content/courses');

function variantFor(c) {
  const tags = (c.tags || []).map((t) => t.toLowerCase());
  const has = (re) => tags.some((t) => re.test(t));
  const desert = ['az', 'nv', 'nm'].includes(c.stateSlug) || has(/desert|mesquite/);
  const wooded = has(/wood|tree|pine|cedar|forest|narrow|corridor|technical|heavily/);
  const open = has(/open|wide|flat/);

  if (desert) return 'course-desert.svg';
  if (wooded && open) return 'course-placeholder.svg'; // mixed
  if (wooded) return 'course-wooded.svg';
  if (open) return 'course-open.svg';
  return 'course-placeholder.svg';
}

let changed = 0;
const tally = {};

for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
  const p = path.join(DIR, file);
  const c = JSON.parse(fs.readFileSync(p, 'utf8'));

  const variant = variantFor(c);
  const url = `/images/${variant}`;
  tally[variant] = (tally[variant] || 0) + 1;

  let dirty = false;
  if (c.heroImage !== url) {
    c.heroImage = url;
    dirty = true;
  }
  if (c.thumbnail !== url) {
    c.thumbnail = url;
    dirty = true;
  }
  if (Array.isArray(c.photos) && c.photos[0]) {
    if (c.photos[0].url !== url) {
      c.photos[0].url = url;
      dirty = true;
    }
    const cleanAlt = `${c.name} disc golf course`;
    if (c.photos[0].alt !== cleanAlt) {
      c.photos[0].alt = cleanAlt;
      dirty = true;
    }
    if (c.photos[0].caption) {
      delete c.photos[0].caption;
      dirty = true;
    }
  }

  if (dirty) {
    fs.writeFileSync(p, JSON.stringify(c, null, 2) + '\n');
    changed += 1;
  }
}

console.log(`Updated images on ${changed} course(s):`);
console.log(tally);
