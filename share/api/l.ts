// l.lmthings.com/<code>: a tiny page whose preview tags (title, description, picture) describe the
// loadout, so Discord and other apps show the build. People are sent straight on to the site.
import { SITE, viewOf } from "../lib/view";

export const config = { runtime: "edge" };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export default function handler(req: Request): Response {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? "";
  const v = viewOf(code);
  const target = v ? `${SITE}/l/${code}` : `${SITE}/loadouts`;
  if (!v) return Response.redirect(target, 302);

  const names = (xs: ({ name: string } | null)[], sep: string) => xs.map((x) => x?.name ?? "—").join(sep);
  const title = `${v.title} · ${v.className}`;
  const desc = [`Techniques: ${names(v.skills, " › ")}`, `Charms: ${names(v.charms, " · ")}`, v.pet ? `Fantomon: ${v.pet.name}` : "", v.notes]
    .filter(Boolean)
    .join("\n");
  const image = `${url.origin}/og/${code}.png`;
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SxS Tools · Loadouts">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url.origin + "/" + code)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#e6a072">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body><script>location.replace(${JSON.stringify(target)})</script>
<p><a href="${esc(target)}">Open this loadout on SxS Tools</a></p></body></html>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600, s-maxage=31536000, immutable" },
  });
}
