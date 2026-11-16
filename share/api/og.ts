// l.lmthings.com/og/<code>.png: the loadout as a picture, laid out like the game's Skill screen.
// Game art by Boltray Games; font Plus Jakarta Sans (OFL).
import { ImageResponse } from "@vercel/og";
import { viewOf, type Slot } from "../lib/view";

export const config = { runtime: "edge" };

type Style = Record<string, string | number>;
type Node = { type: string; props: Record<string, unknown> } | string | null;
const h = (type: string, style: Style, children: Node | Node[] = null, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style, children, ...extra },
});
const RING: Record<string, string> = { Blue: "#4ea8ff", Purple: "#b06cff", Orange: "#ff9b3d" };

let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 700 | 800; style: "normal" }[]> | null = null;
const loadFonts = (origin: string) =>
  (fonts ??= Promise.all(
    ([700, 800] as const).map(async (weight) => ({
      name: "Jakarta",
      data: await fetch(`${origin}/fonts/PlusJakartaSans-${weight}.ttf`).then((r) => r.arrayBuffer()),
      weight,
      style: "normal" as const,
    })),
  ));

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const v = viewOf(url.searchParams.get("code") ?? "");
  const art = (p: string) => `${url.origin}/art/${p}`;
  if (!v) return new Response("Not a loadout", { status: 404 });

  const slot = (s: Slot | null, side: "left" | "right", n?: number): Node => {
    const icon = h(
      "div",
      { display: "flex", position: "relative", width: 104, height: 104, borderRadius: 52, padding: 6, background: s ? RING[s.quality] ?? RING.Blue : "rgba(255,255,255,0.4)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" },
      [
        s
          ? h("img", { width: 92, height: 92, borderRadius: 46, background: "#2a2a2a" }, null, { src: art(s.art), width: 92, height: 92 })
          : h("div", { width: 92, height: 92, borderRadius: 46, border: "4px dashed #fff" }),
        n !== undefined
          ? h("div", { position: "absolute", top: -4, left: -4, width: 36, height: 36, borderRadius: 18, background: "#e0475a", border: "3px solid #fff", color: "#fff", fontSize: 20, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }, String(n))
          : null,
      ],
    );
    const label = h(
      "div",
      { display: "flex", maxWidth: 250, padding: "6px 14px", borderRadius: 12, background: "rgba(20,22,30,0.68)", color: s ? "#fff" : "rgba(255,255,255,0.7)", fontSize: 24, fontWeight: 700 },
      s?.name ?? "—",
    );
    return h("div", { display: "flex", alignItems: "center", gap: 14, flexDirection: side === "left" ? "row" : "row-reverse" }, [icon, label]);
  };

  const col = (items: (Slot | null)[], side: "left" | "right") =>
    h("div", { display: "flex", flexDirection: "column", gap: 22, alignItems: side === "left" ? "flex-start" : "flex-end" }, [
      h("div", { display: "flex", fontSize: 17, fontWeight: 800, letterSpacing: 2, color: "rgba(20,22,30,0.7)" }, side === "left" ? "TECHNIQUES" : "CHARMS"),
      ...items.map((s, i) => slot(s, side, side === "left" ? i + 1 : undefined)),
    ]);

  const root = h(
    "div",
    {
      width: 1200, height: 630, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", fontFamily: "Jakarta", padding: "24px 36px",
      backgroundImage: "linear-gradient(180deg, #8ec5ef 0%, #c4e3f6 45%, #d9eedc 68%, #8fc46c 100%)",
    },
    [
      h("img", { position: "absolute", left: 470, top: 120, width: 260, height: 260, opacity: 0.28 }, null, { src: art(v.badge), width: 260, height: 260 }),
      h("div", { display: "flex", padding: "8px 32px", borderRadius: 18, background: "rgba(255,255,255,0.93)", color: "#222", fontSize: 36, fontWeight: 800, letterSpacing: 1 }, v.title.toUpperCase().slice(0, 32)),
      h("div", { display: "flex", width: "100%", flex: 1, justifyContent: "space-between", alignItems: "center", marginTop: 6 }, [
        col(v.skills, "left"),
        h("div", { display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }, [
          v.pet ? h("img", { width: 250, height: 250, objectFit: "contain" }, null, { src: art(v.pet.art), width: 250, height: 250 }) : h("div", { width: 250, height: 250 }),
          h("div", { display: "flex", padding: "6px 22px", borderRadius: 22, background: "rgba(255,255,255,0.9)", color: "#2a2a2a", fontSize: 24, fontWeight: 800 }, v.pet ? `${v.className} · ${v.pet.name}` : v.className),
        ]),
        col(v.charms, "right"),
      ]),
      h("div", { display: "flex", fontSize: 20, fontWeight: 700, color: "rgba(20,22,30,0.75)" }, "sxs.lmthings.com · Loadouts"),
    ],
  );

  return new ImageResponse(root as never, {
    width: 1200,
    height: 630,
    fonts: await loadFonts(url.origin),
    headers: { "cache-control": "public, max-age=86400, s-maxage=31536000, immutable" },
  });
}
