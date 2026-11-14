// Clean page addresses (sxs.lmthings.com/planner) instead of #/planner, so pages can be told apart in
// analytics and read well when shared. Old #/… links still work: they're rewritten on arrival.

const EVENT = "lm:navigate";

/** The page id from the address: "/planner" -> "planner", "/" -> "". */
export function currentPath(): string {
  return window.location.pathname.replace(/^\/+|\/+$/g, "").split("/")[0] ?? "";
}

/** Rewrites an old #/page?x address to /page?x (keeping any query), without adding history. */
export function upgradeHashRoute(): void {
  const hash = window.location.hash;
  if (!hash.startsWith("#/")) return;
  const [route, query] = hash.slice(2).split("?");
  const path = `/${route.replace(/^\/+/, "")}`;
  history.replaceState(null, "", `${path}${query ? `?${query}` : ""}`);
}

export function navigate(href: string): void {
  if (href === window.location.pathname + window.location.search) return;
  history.pushState(null, "", href);
  window.dispatchEvent(new Event(EVENT));
}

/** Calls `onChange` whenever the page changes: links, back/forward, or an old #/ link. */
export function listen(onChange: () => void): () => void {
  const onHash = () => {
    upgradeHashRoute();
    onChange();
  };
  // Same-site links are handled here instead of reloading the page.
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.("a");
    if (!a || a.target || a.hasAttribute("download")) return;
    const href = a.getAttribute("href") ?? "";
    if (!href.startsWith("/") || href.startsWith("//")) return;
    // Files (icons, art, data) open normally.
    if (/\.[a-z0-9]{2,5}([?#]|$)/i.test(href)) return;
    e.preventDefault();
    navigate(href);
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("popstate", onChange);
  window.addEventListener("hashchange", onHash);
  document.addEventListener("click", onClick);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("hashchange", onHash);
    document.removeEventListener("click", onClick);
  };
}
