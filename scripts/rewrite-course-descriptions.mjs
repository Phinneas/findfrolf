// Rewrite the auto-scraped "sourced from UDisc" course descriptions into
// original editorial copy, generated from each course's real data (holes,
// par, length, difficulty, cost, tags, amenities). Leaves the ~65 already-
// handwritten ("rich") course descriptions untouched.
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'src/content/courses');

const fmt = (n) => Number(n).toLocaleString('en-US');

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const pick = (arr, seed) => arr[seed % arr.length];

// "a 9-hole" vs "an 18-hole" (8, 11, 18 begin with a vowel sound).
const art = (holes) => ([8, 11, 18].includes(holes) ? 'an' : 'a');

function lengthClause(c) {
  const ft = fmt(c.totalFeet);
  const opts = {
    short: [`It's a short, ${ft}-foot layout`, `A quick ${ft}-foot round`, `It plays a compact ${ft} feet`],
    medium: [`It plays ${ft} feet`, `It runs ${ft} feet`, `The layout stretches ${ft} feet`],
    long: [`It stretches ${ft} feet`, `It runs a long ${ft} feet`, `The layout reaches ${ft} feet`],
  };
  return pick(opts[c.courseLength] || opts.medium, hash(c.code));
}

function difficultyPhrase(c) {
  const opts = {
    Easy: [`It's a friendly, low-pressure round`, `A gentle, approachable round`, `An easy-going round for all arms`],
    Moderate: [`It's a fair test for most players`, `A balanced test that rewards smart lines`, `A solid mid-level round`],
    Hard: [`It's a serious test that punishes loose shots`, `A demanding round for confident players`, `A tough test that keeps you honest`],
    'Very Hard': [`It's a demanding layout for experienced arms`, `A bruising round built for big arms`, `A relentless test for advanced players`],
  };
  return pick(opts[c.difficulty] || opts.Moderate, hash(c.code + 'd'));
}

function terrainPhrase(c) {
  const tags = (c.tags || []).map((t) => t.toLowerCase());
  const has = (re) => tags.some((t) => re.test(t));
  const opts = [];
  if (has(/wood|tree|pine|cedar|forest|narrow|corridor|technical|heavily/)) {
    opts.push(` with tree-lined fairways that reward controlled lines`, ` through the trees, where line-shaping matters more than raw distance`, ` with wooded corridors that demand accuracy off the tee`);
  }
  if (has(/open|wide|flat|park-style|former landfill/)) {
    opts.push(` with open fairways and room to let the disc fly`, ` on open ground with few obstacles between you and the basket`, ` across open, forgiving fairways`);
  }
  if (has(/hill|elevation|mountain|rolling|hill country/)) {
    opts.push(` with rolling elevation that adds some climb`, ` across rolling terrain that keeps the legs honest`, ` with real elevation change on several holes`);
  }
  if (has(/water|creek|pond|marsh|lake|carry/)) {
    opts.push(` with a few water carries that keep you honest`, ` where water comes into play and punishes a greedy line`, ` with creek crossings that demand a confident throw`);
  }
  if (opts.length === 0) {
    if (has(/long|big-arm|distance/)) {
      opts.push(` with real length on the drive holes`, ` where the longest holes let big arms air it out`);
    } else if (has(/short/) || c.holes <= 9) {
      opts.push(` with short, gettable holes throughout`, ` where most holes are short and gettable`);
    } else {
      opts.push(``, ``);
    }
  }
  return pick(opts, hash(c.code + 't'));
}

function costPhrase(c) {
  const fee = String(c.greenFee || '');
  if (c.isFree) {
    return pick([`It's free to play.`, `Play is free.`, `There's no green fee.`], hash(c.code + 'c'));
  }
  if (/unknown/i.test(fee)) return `It's pay-to-play — check with the course for current green fees.`;
  if (/pay to play/i.test(fee)) return `It's pay-to-play.`;
  return `Green fees run ${fee}.`;
}

function buildParagraphs(c) {
  const p1 = `${c.name} is ${art(c.holes)} ${c.holes}-hole course in ${c.area}, ${c.state}. ${lengthClause(c)} at par ${c.par}.`;
  const p2 = `${difficultyPhrase(c)}${terrainPhrase(c)}. ${costPhrase(c)}`;
  return [p1, p2];
}

const isScraped = (c) =>
  Array.isArray(c.aboutParagraphs) &&
  c.aboutParagraphs.length === 1 &&
  /udisc|sourced from/i.test(c.aboutParagraphs.join(' '));

let rewritten = 0;
const samples = [];

for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
  const p = path.join(DIR, file);
  const c = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!isScraped(c)) continue;

  const before = c.aboutParagraphs.join(' ');
  c.aboutParagraphs = buildParagraphs(c);
  fs.writeFileSync(p, JSON.stringify(c, null, 2) + '\n');
  rewritten += 1;

  if (samples.length < 12) {
    samples.push(`\n### ${c.name} (${c.code})\nBEFORE: ${before}\nAFTER : ${c.aboutParagraphs.join(' ')}`);
  }
}

console.log(`Rewrote ${rewritten} scraped course description(s).`);
console.log(samples.join('\n'));
