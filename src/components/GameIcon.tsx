// Small item and system icons cut from in-game screenshots (public/art/icons).
export type GameIconName =
  | "rola"
  | "ore"
  | "essence"
  | "sand"
  | "rareSand"
  | "epicSand"
  | "treats"
  | "refinedOre"
  | "primostar"
  | "character"
  | "gear"
  | "skill"
  | "fantomon"
  | "relic";

const FILE: Partial<Record<GameIconName, string>> = { sand: "whiteSand" };

export function GameIcon({ name, size }: { name: GameIconName | string; size?: number }) {
  const file = FILE[name as GameIconName] ?? name;
  return (
    <img
      className="game-icon"
      src={`${import.meta.env.BASE_URL}art/icons/${file}.webp`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      style={size ? { width: size, height: size } : undefined}
      loading="lazy"
      decoding="async"
    />
  );
}
