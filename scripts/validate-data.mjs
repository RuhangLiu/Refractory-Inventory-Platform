import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readCsv = async (name) =>
  parseCsv(await readFile(path.join(rootDir, "data", "curated", name), "utf8"));

const [products, inventory, transactions, industry] = await Promise.all([
  readCsv("products.csv"),
  readCsv("inventory.csv"),
  readCsv("transactions.csv"),
  readCsv("steel_industry_index.csv")
]);

const errors = [];
const productCodes = new Set(products.map((row) => row.product_code));
const inventoryKeys = new Set();

for (const row of inventory) {
  const key = `${row.product_code}|${row.warehouse}`;
  if (inventoryKeys.has(key)) errors.push(`Duplicate inventory key: ${key}`);
  inventoryKeys.add(key);
  if (!productCodes.has(row.product_code)) errors.push(`Unknown product: ${row.product_code}`);
  for (const field of [
    "current_quantity",
    "reserved_quantity",
    "available_quantity",
    "in_transit_quantity",
    "safety_stock",
    "unit_price"
  ]) {
    if (!Number.isFinite(Number(row[field])) || Number(row[field]) < 0) {
      errors.push(`Invalid ${field} for ${key}`);
    }
  }
  if (Number(row.available_quantity) !== Number(row.current_quantity) - Number(row.reserved_quantity)) {
    errors.push(`Available quantity does not reconcile for ${key}`);
  }
}

for (const row of transactions) {
  if (!productCodes.has(row.product_code)) errors.push(`Unknown transaction product: ${row.product_code}`);
  if (!["sale", "purchase"].includes(row.transaction_type)) {
    errors.push(`Invalid transaction type: ${row.transaction_type}`);
  }
  if (!Number.isFinite(Number(row.quantity)) || Number(row.quantity) < 0) {
    errors.push(`Invalid transaction quantity: ${row.transaction_id}`);
  }
}

if (industry.length < 100) errors.push("Industry dataset has fewer than 100 observations.");
if (new Set(industry.map((row) => row.observation_date)).size !== industry.length) {
  errors.push("Industry dataset contains duplicate dates.");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Data validation passed: ${products.length} products, ${inventory.length} inventory rows, ${transactions.length} transactions, ${industry.length} real industry observations.`
  );
}
