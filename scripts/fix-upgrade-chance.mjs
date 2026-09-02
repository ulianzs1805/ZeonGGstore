import fs from "node:fs";

const path = "src/app/upgrade/page.tsx";
const source = fs.readFileSync(path, "utf8");

let fixed = source
  .replace(/const MIN_CHANCE = 25;/g, "const MIN_CHANCE = 0.01;")
  .replace(/Math\.max\(MIN_CHANCE,\s*Math\.min\(100,\s*target > 0 \? \(input \/ target\) \* 100 : MIN_CHANCE\)\)/g, "Math.min(100, target > 0 ? (input / target) * 100 : 0)")
  .replace(/target > 0 \? \(input \/ target\) \* 100 : MIN_CHANCE/g, "target > 0 ? (input / target) * 100 : 0")
  .replace(/\{shownChance\.toFixed\(1\)\}%/g, "{shownChance < 1 ? shownChance.toFixed(2) : shownChance < 10 ? shownChance.toFixed(1) : shownChance.toFixed(0)}%")
  .replace(/const winDegrees = Math\.max\(90,\s*Math\.min\(360,\s*shownChance \* 3\.6\)\);/g, "const winDegrees = Math.min(360, Math.max(0, shownChance) * 3.6);");

if (!fixed.includes("const MIN_CHANCE = 0.01;")) {
  fixed = fixed.replace(/const chanceFor = \([^\n]+\) => [^;]+;/, "const MIN_CHANCE = 0.01;\nconst chanceFor = (input: number, target: number) => Math.min(100, target > 0 ? (input / target) * 100 : 0);");
}

// HARD RULE: the orange success sector is exactly the calculated chance.
// 1% chance = 3.6deg, 0.69% chance = 2.484deg. Never impose a visual floor.

if (fixed !== source) {
  fs.writeFileSync(path, fixed);
  console.log("Upgrade chance guard applied: exact chance now drives the wheel sector.");
} else {
  const valid = source.includes("const MIN_CHANCE = 0.01;") && source.includes("target > 0 ? (input / target) * 100 : 0");
  if (!valid) throw new Error("Upgrade chance guard: expected chance formula was not found");
  console.log("Upgrade chance already precise; no changes needed.");
}
