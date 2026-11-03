/**
 * Markdown plugin (Sätteri mdast pipeline): replaces {{stats:...}} tokens in
 * post body text with live values computed from the course data
 * (see src/lib/stats.ts).
 *
 * Lets .md posts reference directory counts (e.g. {{stats:totalCourses}},
 * {{stats:city:denver}}) instead of hardcoded numbers that go stale.
 * Unknown tokens throw and fail the build.
 *
 * Registered via `markdown.processor: satteri({ mdastPlugins: [...] })`
 * in astro.config.mjs.
 */

import { defineMdastPlugin } from 'satteri';
import { interpolateStats } from './stats';

export const statsPlugin = defineMdastPlugin({
  name: 'findfrolf-stats',
  text(node, ctx) {
    if (!node.value.includes('{{stats:')) return;
    ctx.setProperty(node, 'value', interpolateStats(node.value));
  },
});
