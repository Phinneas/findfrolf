// Cloudflare Pages middleware: send www.findfrolf.com (and any non-canonical
// host attached to this Pages project) to the bare domain with a 301, keeping
// the path and query string. Every other request passes straight through to the
// static assets.
//
// `wrangler pages deploy dist` picks this up automatically from ./functions.
// Alternative with zero Function invocations: a Cloudflare Redirect Rule on the
// zone (Rules → Redirect Rules → "Redirect from WWW to root"). If you add that
// rule, this file can be deleted.

const CANONICAL_HOST = 'findfrolf.com';

export const onRequest = async (context: {
  request: Request;
  next: () => Promise<Response>;
}): Promise<Response> => {
  const url = new URL(context.request.url);
  if (url.hostname === `www.${CANONICAL_HOST}`) {
    url.hostname = CANONICAL_HOST;
    url.protocol = 'https:';
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
};
