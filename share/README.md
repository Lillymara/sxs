# l.lmthings.com — loadout link previews

A small Vercel project (root directory `share/` of this repo). For a loadout link `l.lmthings.com/<code>`:

- `api/l.ts` returns a page whose preview tags describe the build, so Discord and other apps show its
  name, skills and a picture, then sends people on to `sxs.lmthings.com/l/<code>`.
- `api/og.ts` draws the picture (`/og/<code>.png`), laid out like the game's Skill screen.

`<code>` is the same short code the site makes (src/lib/loadout.ts), so nothing is stored anywhere.

After game data or the link format changes, from the repo root:

    python share/scripts/build_data.py

Game art by Boltray Games. Font: Plus Jakarta Sans (SIL Open Font License).

Live at https://l.lmthings.com (Vercel project sxs-share, root directory share/). Redeploys on pushes that change share/.
