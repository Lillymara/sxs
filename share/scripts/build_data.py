"""Builds the share service's data and art from the main site (run from the repo root after game data changes):

    python share/scripts/build_data.py

Writes share/lib/data.json (skill, class and Fantomon names), copies src/lib/loadout.ts (the link codec)
into share/lib, and converts the art the preview picture needs to PNG in share/public/art (the image
renderer can't read webp). Game art by Boltray Games.
"""
import json, os, shutil

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHARE = os.path.join(ROOT, "share")
ART = os.path.join(ROOT, "public/art")


def png(src, dest, size):
    out = os.path.join(SHARE, "public/art", dest)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im = Image.open(os.path.join(ART, src)).convert("RGBA")
    im.thumbnail((size, size), Image.LANCZOS)
    im.save(out, optimize=True)
    return dest


def main():
    game = json.load(open(os.path.join(ROOT, "public/data/gamedata.json")))
    profiles = json.load(open(os.path.join(ROOT, "src/data/fantomonProfiles.json")))
    D, C = game["loadout"], game["combat"]

    skills = {}
    for sid, s in D["skills"].items():
        if not os.path.exists(os.path.join(ART, f"skills/skill_{sid}.webp")):
            continue
        png(f"skills/skill_{sid}.webp", f"skills/{sid}.png", 112)
        skills[sid] = [s["name"], s.get("quality") or "Blue"]

    classes = {}
    for p in D["professions"]:
        png(f"classes/{p['badge']}.webp", f"classes/{p['badge']}.png", 256)
        classes[p["code"]] = [p["name"], p["badge"]]

    pets = {}
    for f in game["fantomons"]:
        pet = C["pets"].get(str(f["id"]))
        if not pet:
            continue
        icon = (pet.get("forms") or {}).get("Childhood", {}).get("iconId") or f["id"]
        pets[str(f["id"])] = [f["name"], png(f"fantomons/pet_{icon}.webp", f"pets/{f['id']}.png", 320)]
    for pid, prof in profiles.items():
        new = prof.get("new")
        if new:
            pets[pid] = [new["name"], png(new.get("baby") or f"fantomons/pet_{pid}.webp", f"pets/{pid}.png", 320)]

    json.dump({"skills": skills, "classes": classes, "pets": pets}, open(os.path.join(SHARE, "lib/data.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    shutil.copy(os.path.join(ROOT, "src/lib/loadout.ts"), os.path.join(SHARE, "lib/loadout.ts"))
    print(f"{len(skills)} skills, {len(classes)} classes, {len(pets)} Fantomons")


if __name__ == "__main__":
    main()
