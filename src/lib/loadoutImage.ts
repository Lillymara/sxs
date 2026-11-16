// Draws a loadout as a picture (PNG) to paste into Discord, laid out like the game's Skill screen:
// techniques down the left, charms down the right, the Fantomon in the middle, the name on top.
// Everything is drawn in the browser from the site's own art, so nothing is uploaded anywhere.

export interface ImageSlot {
  name: string;
  /** Path under public/art. */
  art: string;
  quality?: string;
}

export interface LoadoutPicture {
  title: string;
  className: string;
  badge: string;
  skills: (ImageSlot | null)[];
  charms: (ImageSlot | null)[];
  pet: ImageSlot | null;
  url: string;
}

const W = 1200;
const H = 675;
const RING: Record<string, string> = { Blue: "#4ea8ff", Purple: "#b06cff", Orange: "#ff9b3d" };
const BASE = import.meta.env.BASE_URL;

function load(path: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `${BASE}art/${path}`;
  });
}

/** Text cut to fit `max` pixels, with an ellipsis. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export async function drawLoadout(p: LoadoutPicture): Promise<Blob> {
  await document.fonts?.ready;
  const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const [badge, pet, ...icons] = await Promise.all([
    load(p.badge),
    p.pet ? load(p.pet.art) : Promise.resolve(null),
    ...[...p.skills, ...p.charms].map((s) => (s ? load(s.art) : Promise.resolve(null))),
  ]);

  // Sky and meadow.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#8ec5ef");
  sky.addColorStop(0.45, "#c4e3f6");
  sky.addColorStop(0.68, "#d9eedc");
  sky.addColorStop(1, "#8fc46c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H, 40, W / 2, H, 520);
  glow.addColorStop(0, "rgba(120,180,90,0.55)");
  glow.addColorStop(1, "rgba(120,180,90,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Class emblem, faded, behind the Fantomon.
  if (badge) {
    ctx.globalAlpha = 0.28;
    ctx.drawImage(badge, W / 2 - 130, 110, 260, 260);
    ctx.globalAlpha = 1;
  }

  // Name banner.
  ctx.font = `800 34px ${font}`;
  const title = fit(ctx, (p.title || `${p.className} loadout`).toUpperCase(), 560);
  const tw = ctx.measureText(title).width + 64;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  pill(ctx, (W - tw) / 2, 26, tw, 58, 18);
  ctx.fill();
  ctx.fillStyle = "#222";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title, W / 2, 56);

  // Fantomon and class name.
  if (pet) {
    const s = Math.min(270 / pet.width, 270 / pet.height);
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(pet, W / 2 - (pet.width * s) / 2, 380 - pet.height * s, pet.width * s, pet.height * s);
    ctx.shadowColor = "transparent";
  }
  ctx.font = `800 24px ${font}`;
  const sub = p.pet ? `${p.className} · ${p.pet.name}` : p.className;
  const sw = ctx.measureText(sub).width + 40;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  pill(ctx, (W - sw) / 2, 400, sw, 44, 22);
  ctx.fill();
  ctx.fillStyle = "#2a2a2a";
  ctx.fillText(sub, W / 2, 423);

  // Slots: techniques left (numbered), charms right.
  const R = 50;
  const ys = [160, 285, 410, 535];
  const slot = (s: ImageSlot | null, img: HTMLImageElement | null, cx: number, cy: number, side: "left" | "right", n?: number) => {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = s ? RING[s.quality ?? "Blue"] ?? RING.Blue : "rgba(255,255,255,0.35)";
    ctx.fill();
    ctx.restore();
    if (s) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R - 6, 0, Math.PI * 2);
      ctx.fillStyle = "#2a2a2a";
      ctx.fill();
      ctx.clip();
      if (img) ctx.drawImage(img, cx - R + 6, cy - R + 6, (R - 6) * 2, (R - 6) * 2);
      ctx.restore();
    } else {
      ctx.setLineDash([8, 7]);
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.arc(cx, cy, R - 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (n !== undefined) {
      ctx.beginPath();
      ctx.arc(cx - R + 8, cy - R + 8, 17, 0, Math.PI * 2);
      ctx.fillStyle = "#e0475a";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = `800 19px ${font}`;
      ctx.textAlign = "center";
      ctx.fillText(String(n), cx - R + 8, cy - R + 9);
    }
    // Name tag beside the icon.
    ctx.font = `700 24px ${font}`;
    const label = fit(ctx, s?.name ?? "—", 250);
    const lw = ctx.measureText(label).width + 28;
    const lx = side === "left" ? cx + R + 14 : cx - R - 14 - lw;
    ctx.fillStyle = "rgba(20,22,30,0.66)";
    pill(ctx, lx, cy - 21, lw, 42, 12);
    ctx.fill();
    ctx.fillStyle = s ? "#fff" : "rgba(255,255,255,0.7)";
    ctx.textAlign = "left";
    ctx.fillText(label, lx + 14, cy + 1);
  };
  p.skills.forEach((s, i) => slot(s, icons[i], 90, ys[i], "left", i + 1));
  p.charms.forEach((s, i) => slot(s, icons[p.skills.length + i], W - 90, ys[i], "right"));

  // Labels and footer.
  ctx.font = `800 17px ${font}`;
  ctx.fillStyle = "rgba(20,22,30,0.7)";
  ctx.textAlign = "left";
  ctx.fillText("TECHNIQUES", 40, 96);
  ctx.textAlign = "right";
  ctx.fillText("CHARMS", W - 40, 96);
  ctx.font = `700 20px ${font}`;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(20,22,30,0.75)";
  ctx.fillText(p.url.replace(/^https?:\/\//, ""), W / 2, H - 26);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't draw the picture"))), "image/png"));
}
