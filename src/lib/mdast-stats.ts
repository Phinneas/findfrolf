/**
 * Markdown plugin (Sätteri mdast pipeline): replaces {{stats:...}} tokens in
 * post body text with live values computed from the course data
 * (see src/lib/stats.ts).
 *
 * Lets .md posts reference directory counts (e.g. {{stats:totalCourses}},
 * {{stats:city:denver}}) instead of hardcoded numbers that go stale.
 * Unknown tokens throw and fail the build.
 *
 * Tokens are resolved at the block level (paragraph / heading) by slicing the
 * ORIGINAL source text and re-parsing it with the numbers substituted. That
 * sidesteps the remark-directive feature (enabled for the :::datashows box),
 * which splits a token like `{{stats:city:denver}}` into a text node
 * (`{{stats:city`), a text-directive node (`denver`), and a trailing text node
 * (`}}`) — so a plain per-text-node replacement can never see the whole token.
 * The source slice still contains the token intact, so both the colon form
 * (`{{stats:city:denver}}`) and the dot form (`{{stats:city.denver}}`) work.
 *
 * Registered via `markdown.processor: satteri({ mdastPlugins: [...] })`
 * in astro.config.mjs.
 */

import { defineMdastPlugin } from 'satteri';
import { interpolateStats } from './stats';

function resolveStatsBlock(node: { position?: { start: { offset?: number }; end: { offset?: number } } }, ctx: { source: string; replaceNode: (n: unknown, v: unknown) => void }) {
  const pos = node.position;
  if (!pos || pos.start.offset == null || pos.end.offset == null) return;
  const raw = ctx.source.slice(pos.start.offset, pos.end.offset);
  if (!raw.includes('{{stats')) return;
  ctx.replaceNode(node, { raw: interpolateStats(raw) });
}

export const statsPlugin = defineMdastPlugin({
  name: 'findfrolf-stats',
  // Inline tokens always live inside a paragraph or heading. listItem,
  // blockquote, and tableCell content is wrapped in a paragraph by the parser,
  // so those cases are covered here too.
  paragraph(node, ctx) {
    resolveStatsBlock(node as never, ctx as never);
  },
  heading(node, ctx) {
    resolveStatsBlock(node as never, ctx as never);
  },
});
