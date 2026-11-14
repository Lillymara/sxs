// "Install app": adds the site to the home screen. Chrome-based browsers offer a prompt; iPhones and
// iPads need Share → Add to Home Screen. Hidden once the site is running as an installed app.
import { useEffect, useState } from "react";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const standalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(standalone);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;
  return (
    <span className="install-app">
      <button
        type="button"
        className="link-button"
        onClick={async () => {
          if (prompt) {
            await prompt.prompt();
            const { outcome } = await prompt.userChoice;
            if (outcome === "accepted") setInstalled(true);
            setPrompt(null);
          } else setHelp((h) => !h);
        }}
      >
        📲 Install as an app
      </button>
      {help && (
        <span className="install-help">
          {isIos() ? (
            <>
              In Safari, tap <b>Share</b> (the square with an arrow), then <b>Add to Home Screen</b>.
            </>
          ) : (
            <>
              Open your browser's menu (⋮) and choose <b>Install app</b> or <b>Add to Home screen</b>. It then opens like an app and works
              offline.
            </>
          )}
        </span>
      )}
    </span>
  );
}
