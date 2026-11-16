// Local check: serve share/public on :5199, then `npx tsx scripts/try.mts out.png`.
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
(globalThis as { require?: unknown }).require = createRequire(import.meta.url);
const { default: og } = await import("../api/og.ts");
const { default: l } = await import("../api/l.ts");
const code = process.argv[3] ?? "OSnKkqyOpqnKeoJcDERVTkdFT04tVEFOSw";
const page = l(new Request(`http://localhost:5199/api/l?code=${code}`));
console.log(page.status);
const img = await og(new Request(`http://localhost:5199/api/og?code=${code}`));
console.log(img.status, img.headers.get("content-type"));
writeFileSync(process.argv[2] ?? "og.png", Buffer.from(await img.arrayBuffer()));
