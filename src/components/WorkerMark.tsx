import { useMemo } from "react";

// Curated gradient pairs — premium, distinct, readable on the cool-neutral base.
const PALETTES: Array<[string, string]> = [
  ["#FF9E6D", "#D6366F"], // coral → magenta
  ["#5BC8AF", "#2374AB"], // mint → ocean
  ["#8B7CF6", "#2B3FE4"], // violet → indigo
  ["#F2B84B", "#D65A5A"], // amber → clay
  ["#7CC3F6", "#5B4FC8"], // sky → iris
  ["#6FD6B0", "#0E9E82"], // jade family
  ["#F7A072", "#B5476B"], // apricot → plum
  ["#9AD0EC", "#3A6EA5"], // powder → steel
];

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export type WorkerMarkProps = {
  seed: string;
  size?: number;
  active?: boolean;
  className?: string;
};

/**
 * A generative identity mark for a worker. Deterministic from `seed` (slug or
 * name), so the same worker always renders the same gradient + accent. When
 * `active`, it "breathes" to signal the worker is on the clock.
 */
export function WorkerMark({ seed, size = 40, active = false, className }: WorkerMarkProps) {
  const [c1, c2] = useMemo(() => PALETTES[hashString(seed) % PALETTES.length], [seed]);

  return (
    <span
      className={`worker-mark${active ? " is-active" : ""}${className ? ` ${className}` : ""}`}
      style={
        {
          width: size,
          height: size,
          "--m1": c1,
          "--m2": c2,
        } as React.CSSProperties
      }
      aria-hidden="true"
    />
  );
}
