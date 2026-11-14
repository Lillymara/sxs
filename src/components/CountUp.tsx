// Numbers that roll to their new value when they change ("6h 46m" -> "6h 12m", "+154" -> "+162").
// Only when the text keeps the same shape; otherwise it just swaps. Respects reduced motion.
import { useEffect, useRef, useState } from "react";

const NUM = /\d[\d,]*(?:\.\d+)?/g;
const shape = (t: string) => t.replace(NUM, "#");
const nums = (t: string) => (t.match(NUM) ?? []).map((n) => Number(n.replace(/,/g, "")));
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Writes `values` back into `template`'s numbers, keeping each number's decimals and thousands commas. */
function fill(template: string, values: number[]): string {
  let i = 0;
  return template.replace(NUM, (n) => {
    const v = values[i++];
    const decimals = n.includes(".") ? n.split(".")[1].length : 0;
    const fixed = v.toFixed(decimals);
    if (!n.includes(",")) return fixed;
    const [whole, frac] = fixed.split(".");
    return Number(whole).toLocaleString("en-US") + (frac ? `.${frac}` : "");
  });
}

export function CountUp({ text, ms = 450 }: { text: string; ms?: number }) {
  const [shown, setShown] = useState(text);
  const prev = useRef(text);

  useEffect(() => {
    const from = prev.current;
    prev.current = text;
    if (from === text || shape(from) !== shape(text) || reduced()) {
      setShown(text);
      return;
    }
    const a = nums(from), b = nums(text);
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(k >= 1 ? text : fill(text, b.map((v, i) => a[i] + (v - a[i]) * e)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, ms]);

  return <>{shown}</>;
}
