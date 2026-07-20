import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const guardedDirectories = [
  join(root, "apps/web/src/design-system"),
  join(root, "apps/web/src/redesign")
];
const guardedExtensions = new Set([".css", ".ts", ".tsx"]);
const prohibited = [
  { name: "raw hex color", pattern: /#[\da-f]{3,8}\b/gi },
  { name: "raw rgb/hsl color", pattern: /\b(?:rgb|rgba|hsl|hsla)\s*\(/gi },
  { name: "raw pixel/rem/em value", pattern: /(?<![\w-])(?:\d*\.)?\d+(?:px|rem|em)\b/gi },
  { name: "gradient", pattern: /\b(?:linear|radial|conic)-gradient\s*\(/gi },
  { name: "glass backdrop filter", pattern: /\bbackdrop-filter\s*:/gi }
];

function collect(directory, files = []) {
  if (!existsSync(directory)) return files;
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) collect(path, files);
    else if (guardedExtensions.has(extname(path))) files.push(path);
  }
  return files;
}

const violations = [];
for (const file of guardedDirectories.flatMap((directory) => collect(directory))) {
  const content = readFileSync(file, "utf8");
  for (const rule of prohibited) {
    for (const match of content.matchAll(rule.pattern)) {
      if (
        rule.name === "raw pixel/rem/em value" &&
        ["48rem", "64rem", "90rem"].includes(match[0])
      ) continue;
      const before = content.slice(0, match.index);
      const line = before.split("\n").length;
      violations.push(`${relative(root, file)}:${line} ${rule.name}: ${match[0]}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Redesign files must consume approved design tokens:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log("Design token policy passed.");
}
