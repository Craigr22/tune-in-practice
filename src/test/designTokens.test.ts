import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Tailwind wraps its colour tokens in hsl(), so each one must be defined as
 * bare "H S% L%" channels. A hex value compiles to hsl(#FFFFFF) — invalid CSS
 * the browser silently drops — which is how bg-card came to render transparent
 * and every default border invisible. The brand palette is hex and shares two
 * of these names, hence the --ui-* namespace.
 */
const root = resolve(__dirname, "../..");
const config = readFileSync(resolve(root, "tailwind.config.ts"), "utf8");
const css = readFileSync(resolve(root, "src/index.css"), "utf8");

const wrapped = [...config.matchAll(/hsl\(var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]);
const declared = new Map<string, string>();
for (const m of css.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gm)) {
  if (!declared.has(m[1])) declared.set(m[1], m[2].split("/*")[0].trim());
}
const CHANNELS = /^[\d.]+\s+[\d.]+%\s+[\d.]+%$/;

describe("design tokens", () => {
  it("wraps at least the core shadcn colours", () => {
    expect(wrapped).toContain("--ui-card");
    expect(wrapped).toContain("--ui-border");
    expect(wrapped.length).toBeGreaterThan(20);
  });

  it.each([...new Set(wrapped)])("%s is declared as HSL channels", (token) => {
    const value = declared.get(token);
    expect(value, `${token} is wrapped in hsl() but never declared`).toBeDefined();
    expect(value, `${token} is "${value}" — hsl() needs "H S% L%"`).toMatch(CHANNELS);
  });

  it("keeps the brand palette out of the hsl-wrapped set", () => {
    // --card and --border are hex and used directly as var(--card); wrapping
    // either in hsl() is the bug this suite exists to catch.
    expect(wrapped).not.toContain("--card");
    expect(wrapped).not.toContain("--border");
    expect(declared.get("--card")).toMatch(/^#/);
    expect(declared.get("--border")).toMatch(/^#/);
  });

  it("gives a default border colour that is actually visible", () => {
    const rule = css.match(/\*\s*\{\s*border-color:\s*([^;]+);/)?.[1]?.trim();
    expect(rule).toBeDefined();
    expect(rule, "a zero alpha here makes every plain `border` invisible").not.toMatch(/\/\s*0\s*\)/);
  });
});
