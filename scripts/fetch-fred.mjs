import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rawDir = path.join(rootDir, "data", "raw", "fred");
const curatedDir = path.join(rootDir, "data", "curated");
const sourceUrl = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=IPG3311A2N";

const response = await fetch(sourceUrl, {
  headers: { "User-Agent": "Refractory-Inventory-Platform/1.0" }
});
if (!response.ok) {
  throw new Error(`FRED download failed: ${response.status} ${response.statusText}`);
}

const rawCsv = await response.text();
const rows = rawCsv
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => line.split(","))
  .filter(([date, value]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Number(value)));

if (rows.length < 100) {
  throw new Error(`Expected at least 100 valid FRED observations; received ${rows.length}.`);
}

await mkdir(rawDir, { recursive: true });
await mkdir(curatedDir, { recursive: true });
await writeFile(path.join(rawDir, "IPG3311A2N.csv"), rawCsv, "utf8");

const curatedCsv = [
  "observation_date,steel_production_index,source_series",
  ...rows.map(([date, value]) => `${date},${Number(value).toFixed(4)},IPG3311A2N`)
].join("\n");
await writeFile(
  path.join(curatedDir, "steel_industry_index.csv"),
  `${curatedCsv}\n`,
  "utf8"
);

console.log(
  `Downloaded ${rows.length} monthly observations from FRED series IPG3311A2N.`
);
