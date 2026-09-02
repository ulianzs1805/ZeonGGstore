import fs from "node:fs";

const path = "src/app/upgrade/page.tsx";
const source = fs.readFileSync(path, "utf8");

let fixed = source
  .replace(/const MIN_CHANCE = 25;/g, "const MIN_CHANCE = 0.01;")
  .replace(/Math\.max\(MIN_CHANCE,\s*Math\.min\(100,\s*target > 0 \? \(input \/ target\) \* 100 : MIN_CHANCE\)\)/g, "Math.min(100, target > 0 ? (input / target) * 100 : 0)")
  .replace(/target > 0 \? \(input \/ target\) \* 100 : MIN_CHANCE/g, "target > 0 ? (input / target) * 100 : 0")
  .replace(/\{shownChance\.toFixed\(1\)\}%/g, "{shownChance < 1 ? shownChance.toFixed(2) : shownChance < 10 ? shownChance.toFixed(1) : shownChance.toFixed(0)}%");

if (!fixed.includes("const MIN_CHANCE = 0.01;")) {
  fixed = fixed.replace(/const chanceFor = \([^\n]+\) => [^;]+;/, "const MIN_CHANCE = 0.01;\nconst chanceFor = (input: number, target: number) => Math.min(100, target > 0 ? (input / target) * 100 : 0);");
}

// HARD RULE: the orange upgrade-success bar must represent the exact calculated
// chance. Never use a fixed 25% visual width or cap the bar at 25%.
// The same `shownChance` value shown to the user is the source of truth.
const orangeTagPattern = /<([A-Za-z][A-Za-z0-9]*)\b(?=[^>]*className=(?:\"|')(?=[^\"']*(?:orange|amber))[^\"']*(?:\"|'))(?=[^>]*style=\{\{)[^>]*>/g;
fixed = fixed.replace(orangeTagPattern, (tag) => {
  if (!/width\s*:/.test(tag)) return tag;
  return tag.replace(/width\s*:\s*[^,}]+/g, "width: `${Math.max(0, Math.min(100, shownChance))}%`");
});

// Cover bars whose color is supplied as a Tailwind arbitrary value instead of
// an `orange` class, while only touching tags that also expose an inline width.
const orangeStyleTagPattern = /<([A-Za-z][A-Za-z0-9]*)\b(?=[^>]*style=\{\{)[^>]*>/g;
fixed = fixed.replace(orangeStyleTagPattern, (tag) => {
  if (!/width\s*:/.test(tag)) return tag;
  if (!/(?:f97316|fb923c|f59e0b|orange-)/i.test(tag)) return tag;
  return tag.replace(/width\s*:\s*[^,}]+/g, "width: `${Math.max(0, Math.min(100, shownChance))}%`");
});

if (fixed !== source) {
  fs.writeFileSync(path, fixed);
  console.log("Upgrade chance guard applied: exact calculated chance now drives the orange bar.");
} else {
  const valid = source.includes("const MIN_CHANCE = 0.01;") && source.includes("target > 0 ? (input / target) * 100 : 0");
  if (!valid) throw new Error("Upgrade chance guard: expected chance formula was not found");
  console.log("Upgrade chance already precise; no changes needed.");
}
