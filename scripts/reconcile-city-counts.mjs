// Reconcile stale editorial course counts in city JSONs (lede, intro, FAQ)
// with the live course data, so pages no longer claim "4 courses are live"
// when dozens are actually mapped.
import fs from 'node:fs';
import path from 'node:path';

const CDIR = path.join(process.cwd(), 'src/content/cities');
const COURSES_DIR = path.join(process.cwd(), 'src/content/courses');

const courses = fs
  .readdirSync(COURSES_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(COURSES_DIR, f), 'utf8')));

const metroLabels = {
  atlanta: 'Atlanta metro',
  austin: 'greater Austin metro',
  charlotte: 'Charlotte metro',
  chicago: 'Chicago metro and its suburbs',
  cincinnati: 'Cincinnati metro',
  'dallas-fort-worth': 'DFW metro',
  denver: 'Denver metro',
  houston: 'Houston metro',
  'kansas-city': 'Kansas City metro',
  'minneapolis-st-paul': 'Twin Cities metro',
  nashville: 'Nashville metro',
  phoenix: 'Phoenix metro',
  portland: 'Portland metro',
  raleigh: 'Raleigh–Durham area',
  seattle: 'Seattle metro',
};

function freePhrase(name, live, free, paid) {
  if (paid === 0) return `All of ${name}'s mapped courses are free to play.`;
  const adv = free / live >= 0.9 ? 'Nearly all' : 'Most';
  return `${adv} of ${name}'s ${live} mapped courses are free to play — ${paid} are pay-to-play.`;
}

// Explicit replacements for lede / intro / best-beginner phrases that don't
// fit the generic patterns below.
const explicit = [
  ["Atlanta's four published courses cover every level.", "Atlanta's courses cover every level."],
  ['The Austin metro is home to 47 courses', 'The Austin metro is home to 51 courses'],
  ["Charlotte's five published courses are all free and all seriously good.", "Charlotte's courses are seriously good, and most of them are free."],
  ['All five of our published courses are free, and the variety is the point:', "Most of Charlotte's mapped courses are free, and the variety is the point:"],
  ['rounds out the published five with', 'rounds out the lineup with'],
  ['the friendliest of the published trio', 'one of the friendliest published courses'],
  ['the friendliest of the published five', 'one of the friendliest published courses'],
  ['the most approachable of the published trio', 'one of the most approachable published courses'],
  ['None of the published three are beginner-friendly', 'Most Cincinnati-area courses skew toward serious players'],
];

const applyExplicit = (s) => explicit.reduce((acc, [from, to]) => acc.replaceAll(from, to), s);

let changed = 0;

for (const file of fs.readdirSync(CDIR).filter((f) => f.endsWith('.json'))) {
  const slug = file.replace(/\.json$/, '');
  const p = path.join(CDIR, file);
  const c = JSON.parse(fs.readFileSync(p, 'utf8'));

  const live = courses.filter((x) => x.citySlug === slug).length;
  const free = courses.filter((x) => x.citySlug === slug && x.isFree).length;
  const paid = live - free;
  if (live === 0) continue;

  let dirty = false;

  c.lede = applyExplicit(c.lede);

  c.introParagraphs = c.introParagraphs.map((para) => {
    let next = para.replace(
      /All (?:four|five|three) of our published [^.]+? are free\./,
      freePhrase(c.name, live, free, paid),
    );
    next = applyExplicit(next);
    if (next !== para) dirty = true;
    return next;
  });

  c.faqs = c.faqs.map((fq) => {
    let answer = fq.answer;
    if (/how many/i.test(fq.question)) {
      answer = `There are <b>${live} courses</b> across the ${metroLabels[slug]}, mapped and live on FindFrolf, with more added every week.`;
    } else if (/free\?/i.test(fq.question)) {
      answer =
        paid === 0
          ? `Yes — every one of the ${live} mapped courses is free to play.`
          : `Most are. ${free} of the ${live} mapped courses are free to play, and ${paid} are pay-to-play. Check each course page for its current green fee.`;
    } else {
      answer = applyExplicit(answer);
    }
    if (answer !== fq.answer) dirty = true;
    return { ...fq, answer };
  });

  if (dirty) {
    fs.writeFileSync(p, JSON.stringify(c, null, 2) + '\n');
    changed += 1;
    console.log(`${c.name}: ${live} live, ${free} free, ${paid} paid`);
  }
}

console.log(`\nUpdated ${changed} city file(s).`);
