import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { initTheme } from "./lib/theme";

// Apply the saved colors before first paint so the page doesn't flash the default.
initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support and "install as an app", on the live site only.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`./sw.js?v=${__BUILD_ID__}`).catch(() => {
      // Without it the site still works; it just won't open offline.
    });
  });
}
