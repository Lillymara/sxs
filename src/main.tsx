import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./i18n";
import "./styles.css";
import { initTheme } from "./lib/theme";
import { importHandoff } from "./lib/importHandoff";
import { upgradeHashRoute } from "./lib/router";

// Saved data handed over from the old github.io address (before anything reads storage).
importHandoff();
// Old #/page links become /page.
upgradeHashRoute();
// Apply the saved colors before first paint so the page doesn't flash the default.
initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);

// Offline support and "install as an app", on the live site only.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`/sw.js?v=${__BUILD_ID__}`, { scope: "/" }).catch(() => {
      // Without it the site still works; it just won't open offline.
    });
  });
}

// Cloudflare Web Analytics: cookieless page-view counts, nothing personal. Only on the live site;
// "spa" counts each page as players move around (/planner, /timer, ...).
if (import.meta.env.PROD && window.location.hostname === "sxs.lmthings.com") {
  const beacon = document.createElement("script");
  beacon.defer = true;
  beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
  beacon.dataset.cfBeacon = JSON.stringify({ token: "b41fb304857e4207a544089fd070a0d5", spa: true });
  document.body.appendChild(beacon);
}
