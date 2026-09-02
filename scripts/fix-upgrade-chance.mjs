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

// HARD RULE: the orange success bar must use the exact calculated chance.
const orangeTagPattern = /<([A-Za-z][A-Za-z0-9]*)\b(?=[^>]*className=(?:\"|')(?=[^\"']*(?:orange|amber))[^\"']*(?:\"|'))(?=[^>]*style=\{\{)[^>]*>/g;
fixed = fixed.replace(orangeTagPattern, (tag) => {
  if (!/width\s*:/.test(tag)) return tag;
  return tag.replace(/width\s*:\s*[^,}]+/g, "width: `${Math.max(0, Math.min(100, shownChance))}%`");
});

const orangeStyleTagPattern = /<([A-Za-z][A-Za-z0-9]*)\b(?=[^>]*style=\{\{)[^>]*>/g;
fixed = fixed.replace(orangeStyleTagPattern, (tag) => {
  if (!/width\s*:/.test(tag)) return tag;
  if (!/(?:f97316|fb923c|f59e0b|orange-)/i.test(tag)) return tag;
  return tag.replace(/width\s*:\s*[^,}]+/g, "width: `${Math.max(0, Math.min(100, shownChance))}%`");
});

if (fixed !== source) {
  fs.writeFileSync(path, fixed);
  console.log("Upgrade chance guard applied.");
} else {
  const valid = source.includes("const MIN_CHANCE = 0.01;") && source.includes("target > 0 ? (input / target) * 100 : 0");
  if (!valid) throw new Error("Upgrade chance guard: expected chance formula was not found");
}

// Temporary diagnostic for the CI run: capture every width expression and the
// nearby chance/bar markup so the exact visual source can be fixed safely.
const hits = [];
for (const match of fixed.matchAll(/.{0,500}(?:shownChance|chanceFor|width\s*:|orange|amber).{0,700}/g)) {
  hits.push(match[0]);
}
fs.writeFileSync("upgrade-bar-diagnostic.txt", hits.slice(0, 80).join("\n--- HIT ---\n"));
