import fs from "node:fs";

const path = "src/app/upgrade/page.tsx";
const source = fs.readFileSync(path, "utf8");

const fixed = source.replace(/const MIN_CHANCE = 25;/, "const MIN_CHANCE = 0.01;");

if (fixed === source) {
  if (!source.includes("const MIN_CHANCE = 0.01;")) {
    throw new Error("Upgrade chance guard: expected MIN_CHANCE declaration was not found");
  }
  process.exit(0);
}

fs.writeFileSync(path, fixed);
console.log("Upgrade chance guard applied: minimum chance is 0.01%.");
