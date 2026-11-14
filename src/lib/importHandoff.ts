// Moving from the old github.io addresses: those pages forward here with the player's saved data
// in the link's #fragment (never sent to any server), e.g. #/planner?lmimport=<base64url JSON>.
// Only this site's own keys are taken, and only where this browser has nothing saved yet.

const PARAM = "lmimport";

function decode(b64url: string): Record<string, string> | null {
  try {
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

/** Saves handed-over data, then removes it from the address bar. Returns how many keys were saved. */
export function importHandoff(): number {
  const hash = window.location.hash;
  const i = hash.indexOf(`${PARAM}=`);
  if (i < 0) return 0;
  const value = hash.slice(i + PARAM.length + 1).split("&")[0];
  const data = decode(value);
  let saved = 0;
  if (data) {
    for (const [key, v] of Object.entries(data)) {
      if (!key.startsWith("sxs.") || typeof v !== "string") continue;
      try {
        if (localStorage.getItem(key) === null) {
          localStorage.setItem(key, v);
          saved++;
        }
      } catch {
        // Storage unavailable: nothing to save into.
      }
    }
  }
  // Drop the data from the URL (and history), keeping the page it pointed to.
  const route = hash.slice(0, i).replace(/[?&]$/, "") || "#/";
  history.replaceState(null, "", `${window.location.pathname}${window.location.search}${route}`);
  return saved;
}
