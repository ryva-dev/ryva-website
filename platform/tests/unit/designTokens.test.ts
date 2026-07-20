import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const css = readFileSync(
  new URL("../../apps/web/src/design/tokens.css", import.meta.url),
  "utf8"
);
const typedTokens = readFileSync(
  new URL("../../apps/web/src/design/tokens.ts", import.meta.url),
  "utf8"
);

function token(name: string): string {
  const match = css.match(new RegExp(`${name}:\\s*([^;]+);`));
  assert.ok(match, `Expected ${name} to exist`);
  return match[1]!.trim();
}

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrast(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Ryva design foundations", () => {
  it("keeps every specified normal-text pair at WCAG AA contrast", () => {
    const pairs = [
      ["strong text on canvas", "--color-text-strong", "--color-surface-canvas"],
      ["default text on surface", "--color-text-default", "--color-surface"],
      ["muted text on surface", "--color-text-muted", "--color-surface"],
      ["disabled text on disabled surface", "--color-text-disabled", "--color-surface-disabled"],
      ["white text on accent", "--color-text-on-accent", "--color-accent"],
      ["accent text on subtle accent", "--color-accent-text", "--color-accent-subtle"],
      ["success text", "--color-success", "--color-success-bg"],
      ["warning text", "--color-warning", "--color-warning-bg"],
      ["danger text", "--color-danger", "--color-danger-bg"],
      ["information text", "--color-info", "--color-info-bg"],
      ["neutral state text", "--color-neutral-state", "--color-neutral-state-bg"],
      ["AI label text", "--color-ai", "--color-ai-bg"]
    ] as const;

    for (const [name, foregroundToken, backgroundToken] of pairs) {
      const foreground = token(foregroundToken);
      const background = token(backgroundToken);
      assert.ok(
        contrast(foreground, background) >= 4.5,
        `${name} must meet 4.5:1; received ${contrast(foreground, background).toFixed(2)}:1`
      );
    }
  });

  it("keeps the required CSS contract and typed mirrors in place", () => {
    const required = [
      "--font-family-sans",
      "--font-size-30",
      "--space-9",
      "--size-11",
      "--width-workspace-max",
      "--radius-4",
      "--color-surface-canvas",
      "--color-accent",
      "--color-success",
      "--color-danger",
      "--color-border",
      "--elevation-dialog",
      "--icon-size-default",
      "--control-height-default",
      "--duration-standard",
      "--ease-standard",
      "--focus-ring",
      "--z-modal",
      "--breakpoint-mobile",
      "--layout-page-gutter"
    ];
    for (const token of required) assert.match(css, new RegExp(`${token}:`));
    assert.equal(token("--breakpoint-mobile"), "48rem");
    assert.equal(token("--breakpoint-desktop"), "64rem");
    assert.equal(token("--breakpoint-wide"), "90rem");
    assert.match(typedTokens, /accent:\s*"#285b52"/);
    assert.match(typedTokens, /mobile:\s*768/);
    assert.match(typedTokens, /desktop:\s*1024/);
    assert.match(typedTokens, /wide:\s*1440/);
    assert.match(typedTokens, /focusRing:\s*"0 0 0 2px #ffffff, 0 0 0 4px #3b6e65"/);
  });

  it("contains no gradients, glass effects, or ornamental heavy elevation", () => {
    assert.doesNotMatch(css, /gradient\s*\(/i);
    assert.doesNotMatch(css, /backdrop-filter/i);
    assert.equal(token("--radius-4"), "0.75rem");
    assert.equal(token("--duration-slow"), "240ms");
  });
});
