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

export function cityUrl(city: CollectionEntry<'cities'>): string {
  return `/${city.data.stateSlug}/${city.id}`;
}
