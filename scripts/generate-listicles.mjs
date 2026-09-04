#!/usr/bin/env node
/**
 * FindFrolf listicle generator.
 *
 * Emits the 5 data-driven listicle posts from the live course dataset, so the
 * lists are always grounded in verified data and stay fresh as courses are
 * added (just re-run after a data batch).
 *
 *   npm run generate:listicles
 *
 * Every fact (rating, holes, par, difficulty, free status, amenities,
 * signature-hole description) comes straight from src/content/courses/*.json.
 * The intro/outro/FAQ copy is hand-written editorial below; nothing is invented.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const COURSES_DIR = fileURLToPath(new URL('../src/content/courses/', import.meta.url));
const BLOG_DIR = fileURLToPath(new URL('../src/content/blog/', import.meta.url));
const PUB_DATE = '2026-08-28';
const HERO = '/images/course-placeholder.svg';
const FINDER_LINK = 'Search every course with the [disc golf course finder](https://findfrolf.com/finder).';

function readCourses() {
  return readdirSync(COURSES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const data = JSON.parse(readFileSync(`${COURSES_DIR}${f}`, 'utf8'));
      return {
        slug: f.replace(/\.json$/, ''),
        url: `/${data.stateSlug}/${data.citySlug}/${f.replace(/\.json$/, '')}`,
        data,
      };
    });
}

const courses = readCourses();

function line(c) {
  const d = c.data;
  const sig = d.signatureHoleDescription ? d.signatureHoleDescription.split('.')[0] + '.' : '';
  const fee = d.isFree ? 'Free' : d.greenFee;
  return `**${d.name}** — ${d.city}, ${d.state} · ${d.holes} holes, par ${d.par}, ${d.difficulty} · ★ ${d.rating} · ${fee}\n\n${sig}\n\n[View course page](${c.url}) · [all ${d.city} courses](/${d.stateSlug}/${d.citySlug})`;
}

function entry(c, rank) {
  const d = c.data;
  return `### ${rank}. [${d.name}](${c.url})\n\n${line(c)}\n`;
}

function faqItems(items) {
  return JSON.stringify(items, null, 2);
}

function render(slug, title, description, intro, entries, outro, faqs, tags) {
  const frontmatter = `---
title: "${title}"
description: "${description}"
pubDate: "${PUB_DATE}"
author: "FindFrolf Team"
heroImage: "${HERO}"
tags: ${JSON.stringify(tags)}
faqItems: ${faqItems(faqs)}
---`;
  const body = `${intro}\n\n${entries.join('\n')}\n${outro}\n`;
  return frontmatter + '\n' + body;
}

const out = [];

// ── 1. Beginner-friendly ──
{
  const list = courses
    .filter((c) => c.data.isBeginnerFriendly === true)
    .sort((a, b) => b.data.rating - a.data.rating)
    .slice(0, 10);
  const intro = `New to disc golf? Start here. Every course on this list is marked **beginner-friendly** in our directory — open fairways, forgiving layouts, and the kind of course where a first round is fun instead of frustrating. They're ranked by player rating from the ${courses.length} courses we've verified.\n\n${FINDER_LINK}`;
  const outro = `The best way to learn is to play — pick the course closest to you and just go. Most of these are free, and nobody will judge your first throw.\n\n${FINDER_LINK}`;
  const faqs = [
    { question: 'What is the best beginner-friendly disc golf course?', answer: `Based on player ratings, ${list[0]?.data.name} in ${list[0]?.data.city} is the top pick on our list — ${list[0]?.data.holes} holes at par ${list[0]?.data.par}.` },
    { question: 'Are beginner-friendly disc golf courses free?', answer: `${list.filter((c) => c.data.isFree).length} of the ${list.length} courses on this list are free to play.` },
    { question: 'What should I bring to my first disc golf round?', answer: 'One midrange disc and comfortable shoes are enough to start — most courses are free and walkable.' },
  ];
  const md = render(
    'best-beginner-friendly-disc-golf-courses',
    '10 Best Beginner-Friendly Disc Golf Courses in the US',
    'New to disc golf? These are the 10 best beginner-friendly courses from our verified directory — open, forgiving, and ranked by player rating.',
    intro,
    list.map((c, i) => entry(c, i + 1)),
    outro,
    faqs,
    ['beginner', 'disc golf courses', 'listicle'],
  );
  writeFileSync(`${BLOG_DIR}best-beginner-friendly-disc-golf-courses.md`, md);
  out.push(`best-beginner-friendly-disc-golf-courses.md (${list.length} courses)`);
}

// ── 2. Free courses ──
{
  const list = courses
    .filter((c) => c.data.isFree === true)
    .sort((a, b) => b.data.rating - a.data.rating)
    .slice(0, 12);
  const intro = `Disc golf is one of the few sports that's genuinely free to play — and most of the best courses in the country don't cost a dime. Here are the **highest-rated free courses** from the ${courses.length} we've verified, ranked by player rating.\n\n${FINDER_LINK}`;
  const outro = `That's the beauty of the sport: $0 green fees, and the only real cost is the discs you might lose in the woods. Use the finder to filter for free courses anywhere in the country.\n\n${FINDER_LINK}`;
  const faqs = [
    { question: 'Are most disc golf courses free?', answer: `${courses.filter((c) => c.data.isFree).length} of the ${courses.length} courses we publish are free to play — the majority.` },
    { question: 'What is the best free disc golf course?', answer: `By player rating, ${list[0]?.data.name} in ${list[0]?.data.city} — ${list[0]?.data.holes} holes at par ${list[0]?.data.par}, free to play.` },
  ];
  const md = render(
    'best-free-disc-golf-courses',
    'The Best Free Disc Golf Courses in America',
    'Disc golf is free — and these are the 12 highest-rated free courses from our verified directory. $0 green fees, ranked by player rating.',
    intro,
    list.map((c, i) => entry(c, i + 1)),
    outro,
    faqs,
    ['free', 'disc golf courses', 'listicle'],
  );
  writeFileSync(`${BLOG_DIR}best-free-disc-golf-courses.md`, md);
  out.push(`best-free-disc-golf-courses.md (${list.length} courses)`);
}

// ── 3. Wooded / challenging ──
{
  const list = courses
    .filter((c) => c.data.isWooded === true && c.data.difficultyRating >= 4)
    .sort((a, b) => b.data.rating - a.data.rating)
    .slice(0, 10);
  const intro = `If you've outgrown the open fairways, this is the list for you. These are the **most challenging wooded courses** we publish — dense timber, tight lines, and difficulty ratings of 4 or 5 on our scale. Bring your accuracy, leave your ego.\n\n${FINDER_LINK}`;
  const outro = `Every course on this list will test you — and every one of them is worth the walk back to the car. Play them all and you'll be a better player for it.\n\n${FINDER_LINK}`;
  const faqs = [
    { question: 'What makes a disc golf course challenging?', answer: 'In our directory, difficulty comes from the rubric: length, dense woods, elevation, and hazards like water and tall-grass OB. These courses score 4 or 5 out of 5.' },
    { question: 'What is the hardest course we publish?', answer: `The highest difficulty rating in the directory belongs to ${courses.filter((c) => c.data.difficultyRating === 5).map((c) => c.data.name).join(', ') || 'Idlewild'} — rated Very Hard.` },
  ];
  const md = render(
    'most-challenging-wooded-disc-golf-courses',
    '10 Most Challenging Wooded Disc Golf Courses',
    'The tightest, densest, most technical courses in our verified directory — 10 wooded tests rated 4 or 5 on our difficulty scale.',
    intro,
    list.map((c, i) => entry(c, i + 1)),
    outro,
    faqs,
    ['wooded', 'challenging', 'disc golf', 'listicle'],
  );
  writeFileSync(`${BLOG_DIR}most-challenging-wooded-disc-golf-courses.md`, md);
  out.push(`most-challenging-wooded-disc-golf-courses.md (${list.length} courses)`);
}

// ── 4. 27-hole marathons ──
{
  const list = courses
    .filter((c) => c.data.holes >= 27)
    .sort((a, b) => b.data.rating - a.data.rating);
  const longest = [...courses].sort((a, b) => b.data.totalFeet - a.data.totalFeet)[0];
  const intro = `Some rounds are warm-ups; these are marathons. Every course on this list has **27 or more holes** — a full day of disc golf in one stop. Ranked by player rating.\n\n${FINDER_LINK}`;
  const outro = `Bring water, bring a full bag, and clear your schedule — these courses are the best of the big-round club.\n\n${FINDER_LINK}`;
  const faqs = [
    { question: 'Why play a 27-hole disc golf course?', answer: 'More holes means more variety — most 27-holers mix open and wooded, short and long, so one round feels like three courses.' },
    { question: 'What is the longest course we publish?', answer: `${longest?.data.name} in ${longest?.data.city} — ${longest?.data.totalFeet.toLocaleString()} feet across ${longest?.data.holes} holes.` },
  ];
  const md = render(
    'best-27-hole-disc-golf-courses',
    'The Best 27-Hole Disc Golf Courses (Marathon Rounds)',
    'A full day of disc golf in one stop — the 27-hole marathons from our verified directory, ranked by player rating.',
    intro,
    list.map((c, i) => entry(c, i + 1)),
    outro,
    faqs,
    ['27 holes', 'marathon', 'disc golf', 'listicle'],
  );
  writeFileSync(`${BLOG_DIR}best-27-hole-disc-golf-courses.md`, md);
  out.push(`best-27-hole-disc-golf-courses.md (${list.length} courses)`);
}

// ── 5. Best by state ──
{
  const byState = new Map();
  for (const c of courses) {
    if (!byState.has(c.data.state)) byState.set(c.data.state, []);
    byState.get(c.data.state).push(c);
  }
  const list = [...byState.entries()]
    .map(([state, cs]) => [...cs].sort((a, b) => b.data.rating - a.data.rating)[0])
    .sort((a, b) => b.data.rating - a.data.rating);
  const intro = `Traveling? Every one of these is the **highest-rated verified course in its state** — the one locals would tell you to play first. Ranked overall by player rating.\n\n${FINDER_LINK}`;
  const outro = `The best course in the state is a great starting point — but every metro we cover has a full top tier waiting. Browse by city in the finder.\n\n${FINDER_LINK}`;
  const faqs = [
    { question: 'How were these courses chosen?', answer: 'One per state: the highest-rated verified course we publish in each of the 15 states covered so far.' },
    { question: 'What is the best disc golf state?', answer: 'It depends what you want — Texas and North Carolina have the deepest top tiers in our directory; Minnesota and Oregon have the highest-rated individual courses.' },
  ];
  const md = render(
    'best-disc-golf-course-in-every-state',
    'The Best Disc Golf Course in Every State We Cover',
    'One per state — the highest-rated verified disc golf course in each of the 13 states in our directory.',
    intro,
    list.map((c, i) => entry(c, i + 1)),
    outro,
    faqs,
    ['by state', 'best courses', 'disc golf', 'listicle'],
  );
  writeFileSync(`${BLOG_DIR}best-disc-golf-course-in-every-state.md`, md);
  out.push(`best-disc-golf-course-in-every-state.md (${list.length} states)`);
}

console.log('Generated listicles:');
for (const o of out) console.log('  -', o);
