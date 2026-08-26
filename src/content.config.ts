import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/* ------------------------------------------------------------------ */
/*  COURSE DATA MODEL                                                  */
/*  Required fields = every course page must have these populated.    */
/*  Enriched fields = top-50 courses get hole-by-hole, reviews, etc.  */
/* ------------------------------------------------------------------ */

const amenitiesSchema = z.object({
  restrooms: z.boolean().default(false),
  parking: z.boolean().default(true),
  water: z.boolean().default(false),
  lighting: z.boolean().default(false),
  proShop: z.boolean().default(false),
  dogFriendly: z.boolean().default(false),
  cartFriendly: z.boolean().default(false),
  handicapAccessible: z.boolean().default(false),
  camping: z.boolean().default(false),
});

const photoSchema = z.object({
  url: z.string(),
  alt: z.string(),
  caption: z.string().optional(),
});

const holeSchema = z.object({
  number: z.number(),
  par: z.number(),
  distance: z.number(),
  character: z.string(),
  difficultyPct: z.number(),
  isSignature: z.boolean().default(false),
});

const reviewSchema = z.object({
  name: z.string(),
  avatar: z.string(),
  verified: z.boolean().default(true),
  stars: z.number(),
  date: z.string(),
  text: z.string(),
});

const tournamentSchema = z.object({
  name: z.string(),
  tier: z.string(),
  date: z.string(),
});

const courses = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/courses' }),
  schema: z.object({
    /* ===== REQUIRED FIELDS (every course) ===== */

    // Identity
    name: z.string(),
    code: z.string(), // internal code, e.g. "TX-1140"
    city: z.string(), // e.g. "Austin"
    state: z.string(), // e.g. "Texas"
    citySlug: z.string(),
    stateSlug: z.string(),
    area: z.string(), // neighborhood or sub-region

    // Location
    location: z.object({
      address: z.string(),
      lat: z.number(),
      lng: z.number(),
    }),

    // Course specs
    holes: z.number(),
    par: z.number(),
    totalFeet: z.number(),
    courseLength: z.enum(['short', 'medium', 'long']), // <5000ft / 5000-7000ft / >7000ft
    difficulty: z.enum(['Easy', 'Moderate', 'Hard', 'Very Hard']),
    difficultyRating: z.number().min(1).max(5), // 1-5 scale

    // Cost
    isFree: z.boolean().default(true),
    greenFee: z.string().default('$0'),

    // External IDs and links
    pdgaCourseId: z.string().nullable().default(null), // PDGA directory ID
    pdgaTier: z.string().nullable().default(null), // highest tier hosted
    websiteUrl: z.string().nullable().default(null),

    // Photos — at least 1 required
    photos: z.array(photoSchema).min(1),
    heroImage: z.string(), // primary hero photo (should match photos[0].url)
    thumbnail: z.string(), // listing thumbnail

    // Ratings
    rating: z.number(), // 0-5 player rating
    reviewCount: z.number(),

    // Tags for filtering
    tags: z.array(z.string()),

    // Amenities (structured booleans for filtering)
    amenities: amenitiesSchema,

    // Metadata
    yearEstablished: z.number().nullable().default(null),
    lastVerified: z.string(), // ISO date, e.g. "2026-07-08"
    courseDesigner: z.string().nullable().default(null),

    // Course details
    teeType: z.string().nullable().default(null), // e.g. "Concrete"
    basketType: z.string().nullable().default(null), // e.g. "DISCatcher Pro"
    elevation: z.string().nullable().default(null), // e.g. "50/50 Flat/Hills"
    foliage: z.string().nullable().default(null), // e.g. "Scattered", "Dense"

    // Editorial description
    aboutParagraphs: z.array(z.string()),

    /* ===== ENRICHED FIELDS (top-50 courses, optional) ===== */

    holeData: z.array(holeSchema).default([]),
    layoutMapUrl: z.string().nullable().default(null),
    signatureHoleDescription: z.string().nullable().default(null),
    localTips: z.string().nullable().default(null),
    reviews: z.array(reviewSchema).default([]),
    tournaments: z.array(tournamentSchema).default([]),
    nearbyCourseSlugs: z.array(z.string()).default([]),

    /* ===== DERIVED FLAGS (for backward compat + quick filtering) ===== */

    isBeginnerFriendly: z.boolean().default(false),
    isWooded: z.boolean().default(false),
    isOpen: z.boolean().default(false),

    /* ===== LEGACY DISPLAY TEXT (optional, for richer UI labels) ===== */

    facts: z
      .object({
        parking: z.string().optional(),
        restrooms: z.string().optional(),
        proShop: z.string().optional(),
        dogs: z.string().optional(),
        baskets: z.string().optional(),
        lighting: z.string().optional(),
        hours: z.string().optional(),
      })
      .optional(),
  }),
});

/* ------------------------------------------------------------------ */
/*  CITY DATA MODEL                                                    */
/* ------------------------------------------------------------------ */

const cities = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/cities' }),
  schema: z.object({
    name: z.string(),
    state: z.string(),
    stateSlug: z.string(),
    heroImage: z.string(),
    heroFlag: z.string(),
    lede: z.string(),
    quickFacts: z.array(
      z.object({
        value: z.string(),
        label: z.string(),
      }),
    ),
    statsAside: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
      }),
    ),
    introParagraphs: z.array(z.string()),
    mapPins: z.array(
      z.object({
        rank: z.number(),
        courseSlug: z.string(),
        x: z.number(),
        y: z.number(),
        isGold: z.boolean().default(false),
      }),
    ),
    bestFor: z.array(
      z.object({
        title: z.string(),
        tag: z.string(),
        courseSlugs: z.array(z.string()),
      }),
    ),
    events: z.array(
      z.object({
        day: z.string(),
        month: z.string(),
        title: z.string(),
        description: z.string(),
        cta: z.string(),
      }),
    ),
    clubs: z.array(
      z.object({
        icon: z.string(),
        name: z.string(),
        meta: z.string(),
      }),
    ),
    areas: z.array(
      z.object({
        count: z.number(),
        name: z.string(),
      }),
    ),
    faqs: z.array(
      z.object({
        question: z.string(),
        answer: z.string(),
      }),
    ),
    nearbyCities: z.array(
      z.object({
        name: z.string(),
        courseCount: z.string(),
        distance: z.string(),
        slug: z.string(),
      }),
    ),
  }),
});

/* ------------------------------------------------------------------ */
/*  BLOG DATA MODEL                                                    */
/* ------------------------------------------------------------------ */

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.string(),
    updatedDate: z.string().optional(),
    author: z.string().default('FindFrolf Team'),
    heroImage: z.string(),
    tags: z.array(z.string()).default([]),
    faqItems: z
      .array(
        z.object({
          question: z.string(),
          answer: z.string(),
        }),
      )
      .optional(),
  }),
});

export const collections = { cities, courses, blog };
