// The logo, drawn in the current theme's accent colours (it follows the colour menu).
import { useId } from "react";
import { logoSvg } from "../lib/logo";

export function Logo({ size = 34, className = "brand-mark" }: { size?: number; className?: string }) {
  // Each copy needs its own gradient id; useId's colons aren't safe inside url(#…).
  const id = `logo${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <span
      className={`logo ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: logoSvg("var(--accent)", "var(--accent-2)", id) }}
    />
  );
}
