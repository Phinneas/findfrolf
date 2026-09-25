import { getCollection, type CollectionEntry } from 'astro:content';

export async function getCoursesByCity(citySlug: string): Promise<CollectionEntry<'courses'>[]> {
  const courses = await getCollection('courses', (course) => course.data.citySlug === citySlug);
  return courses.sort((a, b) => b.data.rating - a.data.rating);
}

export async function getCourse(slug: string): Promise<CollectionEntry<'courses'> | undefined> {
  const courses = await getCollection('courses');
  return courses.find((c) => c.id === slug);
}

export async function getCity(slug: string): Promise<CollectionEntry<'cities'> | undefined> {
  const cities = await getCollection('cities');
  return cities.find((c) => c.id === slug);
}

/**
 * Return the generated trust snapshot for a course slug, or `undefined` when
 * no snapshot exists yet. Callers must treat `undefined` as "unverified" so a
 * course with no trust file still renders exactly as before.
 */
export async function getTrust(slug: string): Promise<CollectionEntry<'trust'> | undefined> {
  const trust = await getCollection('trust');
  return trust.find((t) => t.id === slug);
}

export async function getAllCourses(): Promise<CollectionEntry<'courses'>[]> {
  const courses = await getCollection('courses');
  return courses.sort((a, b) => b.data.rating - a.data.rating);
}

export async function getAllCities(): Promise<CollectionEntry<'cities'>[]> {
  return getCollection('cities');
}

export async function getCoursesBySlugs(slugs: string[]): Promise<CollectionEntry<'courses'>[]> {
  const courses = await getCollection('courses');
  return slugs
    .map((slug) => courses.find((c) => c.id === slug))
    .filter((c): c is CollectionEntry<'courses'> => c !== undefined);
}

export function courseUrl(course: CollectionEntry<'courses'>): string {
  return `/${course.data.stateSlug}/${course.data.citySlug}/${course.id}`;
}

/**
 * Human-friendly green-fee label. Free courses read "Free"; pay-to-play
 * courses with no known fee read "Check with course" instead of "Unknown".
 */
export function formatGreenFee(isFree: boolean, greenFee: string): string {
  if (isFree) return 'Free';
  if (!greenFee || /unknown/i.test(greenFee)) return 'Check with course';
  return greenFee;
}

export function cityUrl(city: CollectionEntry<'cities'>): string {
  return `/${city.data.stateSlug}/${city.id}`;
}

/**
 * Derive a city page's headline stats from its LIVE course entries instead of
 * hand-maintained numbers in the city JSON. This keeps the page truthful as
 * courses are added: "Courses listed" etc. can never drift from the data.
 */
export function deriveCityStats(courses: CollectionEntry<'courses'>[]) {
  const total = courses.length;
  const free = courses.filter((c) => c.data.isFree).length;
  const paid = total - free;
  const holes18 = courses.filter((c) => c.data.holes >= 18).length;
  const lit = courses.filter((c) => c.data.amenities.lighting).length;
  const wooded = courses.filter((c) => c.data.isWooded).length;
  const beginner = courses.filter((c) => c.data.isBeginnerFriendly).length;
  const avgRating = total ? courses.reduce((s, c) => s + c.data.rating, 0) / total : 0;

  // Drop zero-valued facts (e.g. "Beginner-friendly: 0") so the page never
  // shows a stat that reads as an unfinished data gap.
  const isZero = (v: string) => v === '0' || v === '0.0';

  const quickFacts = [
    { value: String(total), label: 'Courses listed' },
    { value: String(free), label: 'Free to play' },
    { value: avgRating.toFixed(1), label: 'Avg rating' },
    { value: String(beginner), label: 'Beginner-friendly' },
    { value: String(holes18), label: '18+ hole courses' },
  ].filter((f) => !isZero(f.value));

  const statsAside = [
    { label: 'Total courses', value: String(total) },
    { label: 'Free / public', value: String(free) },
    { label: 'Pay-to-play', value: String(paid) },
    { label: '18+ hole courses', value: String(holes18) },
    { label: 'Lit for night play', value: String(lit) },
    { label: 'Wooded courses', value: String(wooded) },
    { label: 'Beginner-friendly', value: String(beginner) },
  ].filter((s) => !isZero(s.value));

  return { quickFacts, statsAside };
}
