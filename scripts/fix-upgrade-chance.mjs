import fs from "node:fs";

const path = "src/app/upgrade/page.tsx";
const source = fs.readFileSync(path, "utf8");

const fixed = source
  .replace(/const MIN_CHANCE = 25;/, "const MIN_CHANCE = 0.01;")
  .replace(/target > 0 \? \(input \/ target\) \* 100 : MIN_CHANCE/, "target > 0 ? (input / target) * 100 : MIN_CHANCE")
  .replace(/\{shownChance\.toFixed\(1\)\}%/, "{shownChance < 1 ? shownChance.toFixed(2) : shownChance.toFixed(1)}%");

if (fixed === source) {
  if (!source.includes("const MIN_CHANCE = 0.01;") && !source.includes("shownChance < 1 ? shownChance.toFixed(2) : shownChance.toFixed(1)")) {
    throw new Error("Upgrade chance guard: expected chance formula or display was not found");
  }
  process.exit(0);
}

fs.writeFileSync(path, fixed);
console.log("Upgrade chance guard applied: precise low-percentage display enabled.");
