"""Import Fantomon and companion extras from purrwikimania.com (game data and art by Boltray Games;
Purrwikimania credits the game's owners, and the site owner OK'd using it with credit).

Run with a Python that has beautifulsoup4 and opencv-python-headless:
    python scripts/import_purrwikimania.py <pets.html> <npcs.html>

Writes:
  src/data/fantomonProfiles.json   role, movement, shards, Fantasmia, skill icons for every Fantomon,
                                   plus full records for Fantomons the client data doesn't have yet
  src/data/companionsExtra.json    companions the client data doesn't have yet, in companions.json's shape
  src/data/giftItems.json          the gift items behind each favourite-gift category
  public/art/...                   the art those reference (webp)
"""
import json, os, re, sys, urllib.request

import cv2
import numpy as np
from bs4 import BeautifulSoup

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://www.purrwikimania.com/"
UA = {"User-Agent": "Mozilla/5.0 (SxS Tools importer)"}


def clean(t):
    return re.sub(r"\s+", " ", t or "").strip()


def fetch_webp(src, dest, size=None):
    """Download an image and save it as webp (optionally fitting it in size×size)."""
    out = os.path.join(ROOT, "public/art", dest)
    if os.path.exists(out):
        return dest
    os.makedirs(os.path.dirname(out), exist_ok=True)
    data = urllib.request.urlopen(urllib.request.Request(BASE + src, headers=UA), timeout=30).read()
    im = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_UNCHANGED)
    if im is None:
        raise RuntimeError(f"not an image: {src}")
    if size:
        h, w = im.shape[:2]
        s = min(1, size / max(h, w))
        if s < 1:
            im = cv2.resize(im, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(out, im, [cv2.IMWRITE_WEBP_QUALITY, 88])
    return dest


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


# ---------- Fantomons ----------

def parse_fantasmia(text):
    m = {k: int(v) for k, v in re.findall(r"(Energy Cap|Initial Energy|Recovery per Turn|Recovery per DMG): (\d+)", text)}
    note = text.split("·")[-1].strip()
    if not m:
        return None
    return {"cap": m.get("Energy Cap"), "initial": m.get("Initial Energy"), "perTurn": m.get("Recovery per Turn"), "perDmg": m.get("Recovery per DMG"), "note": note}


def import_pets(path, client_ids, new_ids):
    s = BeautifulSoup(open(path, encoding="utf-8").read(), "html.parser")
    out = {}
    for a in s.find_all("article", class_="pet"):
        pid = int(a["id"].split("-")[1])
        head = a.find(class_="pethead")
        facts = {clean(dt.text): clean(dt.find_next_sibling("dd").text) for dt in head.find("dl").find_all("dt")}
        imgs = {(i.get("class") or [""])[0]: i["src"] for i in head.find_all("img")}
        rec = {"role": facts.get("Role"), "moves": facts.get("Moves")}
        m = re.search(r"×(\d+)", facts.get("Shard", ""))
        if m:
            rec["shardsToSummon"] = int(m.group(1))
        if "Battle base" in facts:
            rec["battleBase"] = {k: int(v) for k, v in re.findall(r"(HP|ATK|DEF|SPD) (\d+)%", facts["Battle base"])}
        skills = {"support": [], "field": None, "battle": []}
        for ph in a.find_all(class_="phase"):
            title = clean("".join(ph.find("h4").find_all(string=True, recursive=False)))
            hint = clean(ph.find("h4").find(class_="hint").text) if ph.find("h4").find(class_="hint") else ""
            if title.startswith("Adult"):
                m = re.search(r"Lv (\d+)", hint)
                if m:
                    rec["adultLevel"] = int(m.group(1))
            group = "support" if title.startswith("Support") else None
            for el in ph.children:
                n = getattr(el, "name", None)
                if n == "h5":
                    t = clean(el.text).lower()
                    group = "field" if t.startswith("field") else "battle" if t.startswith("battle") else group
                elif n == "div" and "petskill" in (el.get("class") or []):
                    body = el.find("div") or el
                    img = el.find("img")
                    tags = [clean(x) for x in clean(body.find(class_="hint").text).split("·")] if body.find(class_="hint") else []
                    sk = {"name": clean(body.find("b").text), "tags": tags, "description": clean(body.find("p").text)}
                    if img and "petskills/" in img["src"]:
                        sk["icon"] = fetch_webp(img["src"], f"fantomons/skills/{slug(sk['name'])}.webp", 96)
                    if el.get("data-skill"):
                        d = json.loads(el["data-skill"])
                        sk["values"] = {k: d[k] for k in ("ranks", "vals", "lmult", "lgroup", "labels", "pct", "order", "pair", "lkey", "origRank") if k in d}
                    if group == "field":
                        for p in body.find_all("p", class_="sk-flat"):
                            f = parse_fantasmia(clean(p.text))
                            if f:
                                rec["fantasmia"] = f
                        skills["field"] = {"name": sk["name"], "description": sk["description"]}
                    elif group:
                        skills[group].append(sk)
        rec["skills"] = skills
        if pid in new_ids:
            # Full record for a Fantomon the client data doesn't have yet.
            rec["new"] = {
                "name": clean(head.find("h3").text),
                "baby": fetch_webp(imgs["baby"], f"fantomons/pet_{pid}.webp", 512) if imgs.get("baby") else None,
                "adult": fetch_webp(imgs["adult"], f"fantomons/pet_{pid + 100}.webp", 512) if imgs.get("adult") else None,
            }
        elif pid not in client_ids:
            continue
        out[pid] = rec
    return out


# ---------- Companions ----------

GIFT = {"Commodity": "Furniture", "Valuables": "Jewelry", "Flower": "Flowers", "Book": "Books"}


def import_companions(path, ours):
    s = BeautifulSoup(open(path, encoding="utf-8").read(), "html.parser")
    kingdoms = {k["map"]: k["name"] for k in json.loads(s.find(id="cm_data").text)["kingdoms"]}
    by_id = {c["id"]: c for c in ours}
    gifts, new = {}, []
    for a in s.find_all("article", class_="nc"):
        cid = int(a["data-id"])
        rows = {clean(r.find(class_="nc-k").find(string=True)): r for r in a.find_all(class_="nc-row")}
        if "Gifts" in rows:
            for gg in rows["Gifts"].find_all(class_="nc-gg"):
                like = gg.find(class_="nc-like")
                if not like:
                    continue
                cat = GIFT.get(a.get("data-like"), a.get("data-like"))
                imgs = gg.find_all("img")
                if len(gifts.get(cat, [])) >= len(imgs):
                    continue  # keep the fullest list seen for the category
                items = []
                for im in imgs:
                    name = re.sub(r"\s*\(.*\)$", "", im.get("alt") or "")
                    items.append({"name": name, "icon": fetch_webp(im["src"], f"gifts/{slug(name)}.webp", 96)})
                gifts[cat] = items
        if cid in by_id:
            continue
        grants = {sp["data-k"]: sp.find("b").text for sp in a.find_all(class_="nc-s")}
        tags = [clean(t.text) for t in a.find_all(class_="nc-tag")]
        new.append({
            "id": cid,
            "name": clean(a.find("h3").text),
            "nativeClass": tags[0] if tags else "",
            "gift": GIFT.get(a.get("data-like"), a.get("data-like")),
            "region": kingdoms.get(int(a["data-map"])) if (a.get("data-map") or "").isdigit() else None,
            "grants": grants,
            "unlockNeeds": [int(x) for x in re.findall(r"needs (\d+)", clean(rows["Unlock"].text))] if "Unlock" in rows else [],
            "journal": next((im.get("title") for im in rows["Unlock"].find_all("img")), None) if "Unlock" in rows else None,
            "icon": fetch_webp(a.find("img", class_="nc-face")["src"], f"companions/icon_{cid}.webp", 256),
        })
    return gifts, new


KEYS = {
    "Attack": "ATK", "MaxHp": "HP", "Defence": "DEF", "Speed": "SPD",
    "BaseAttackPercent": "ATK %", "BaseMaxHpPercent": "HP %", "BaseDefencePercent": "DEF %", "BaseSpeedPercent": "SPD %",
    "CritRatePercent": "Crit Rate", "CritAvoidPercent": "Crit RES", "BlockPercent": "Block Rate", "BlockAvoidPercent": "Accuracy",
    "DmgAddPercent": "DMG Boost", "DmgReducePercent": "DMG RES", "CureAddPercent": "Healing Boost",
    "TravelNpcBaseRewardAddPercent": "Travel Reward Bonus", "TravelNpcExtraRewardAddProbability": "Travel Extra Reward Chance",
}


def to_companion(raw, ours):
    """companions.json shape. Friendship curves follow a fixed template per bonus set, so the level-by-level
    curve comes from a client companion whose max-level bonuses are identical."""
    final = {KEYS.get(k, k): float(v.replace(",", "").replace("+", "").replace("%", "")) for k, v in raw["grants"].items()}
    twin = next((c for c in ours if {k: float(v) for k, v in c["curve"][-1].items()} == final), None)
    needs = raw["unlockNeeds"]
    return {
        "id": raw["id"],
        "name": raw["name"],
        "premium": final.get("ATK", 0) in (5617, 5820),
        "catalog": "World",
        "nativeClass": raw["nativeClass"],
        "recommended": twin["recommended"] if twin else [],
        "recommendationReason": twin.get("recommendationReason") if twin else None,
        "gift": raw["gift"],
        "region": raw["region"],
        "availability": "Global client",
        "unlock": {"label": f"Collect {needs[0]} × {raw['journal']}" if needs and raw["journal"] and raw["journal"] != "their journal" else
                   f"Collect {needs[0]} × their journal" if needs else "No journal needed", "sources": []},
        # Without a twin only the max-level bonuses are known.
        "maxLevel": twin["maxLevel"] if twin else 100,
        "curve": twin["curve"] if twin else [final],
        "exp": twin["exp"] if twin else [],
        **({} if twin else {"maxOnly": True}),
        "figure": False,
        "source": "purrwikimania",
    }


def main():
    pets_html, npcs_html = sys.argv[1], sys.argv[2]
    game = json.load(open(os.path.join(ROOT, "public/data/gamedata.json")))
    client_ids = {f["id"] for f in game["fantomons"]}
    # Fantomons the client data lacks. Yoldra (1619) is left out: no art, and it only assists Ymir.
    new_ids = {1620, 1622}
    pets = import_pets(pets_html, client_ids, new_ids)
    json.dump(pets, open(os.path.join(ROOT, "src/data/fantomonProfiles.json"), "w"), ensure_ascii=False, separators=(",", ":"))

    ours = json.load(open(os.path.join(ROOT, "src/data/companions.json")))
    gifts, new = import_companions(npcs_html, ours)
    json.dump(gifts, open(os.path.join(ROOT, "src/data/giftItems.json"), "w"), ensure_ascii=False, indent=1)
    extra = [to_companion(r, ours) for r in new]
    json.dump(extra, open(os.path.join(ROOT, "src/data/companionsExtra.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"{len(pets)} Fantomon profiles ({len(new_ids)} new), {len(new)} new companions, {len(gifts)} gift categories")


if __name__ == "__main__":
    main()
