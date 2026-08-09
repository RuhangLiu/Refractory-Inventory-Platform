import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, toCsv } from "./csv.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const curatedDir = path.join(rootDir, "data", "curated");
const servingDir = path.join(rootDir, "data", "serving");
const steelPath = path.join(curatedDir, "steel_industry_index.csv");

function seededRandom(seed = 436) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const random = seededRandom();
const round = (value, digits = 0) => Number(value.toFixed(digits));
const pick = (items) => items[Math.floor(random() * items.length)];

const categories = [
  {
    name: "Magnesia Carbon Brick",
    prefix: "MCB",
    products: ["MT-10A", "MT-12B", "Ladle Guard", "Converter 14C", "EAF Sidewall"],
    price: [7.2, 12.8],
    demand: [260, 520]
  },
  {
    name: "High Alumina Brick",
    prefix: "HAB",
    products: ["HA-70", "HA-75", "HA-80", "Checker 65", "Kiln Crown"],
    price: [4.8, 9.4],
    demand: [210, 430]
  },
  {
    name: "Castable",
    prefix: "CAS",
    products: ["Low Cement 70", "Ultra-Low Cement", "Rapid Repair", "Abrasion Guard", "Pumpable 60"],
    price: [680, 1260],
    demand: [34, 90],
    unit: "ton"
  },
  {
    name: "Silica Brick",
    prefix: "SIB",
    products: ["Coke Oven 94", "Glass Crown 96", "Hot Blast 95", "Checker 93", "Silica Special"],
    price: [5.1, 10.5],
    demand: [140, 320]
  },
  {
    name: "Refractory Mortar",
    prefix: "MOR",
    products: ["Air Set 40", "Heat Set 60", "Phosphate Bond", "Silica Mortar", "Magnesia Mortar"],
    price: [420, 840],
    demand: [26, 70],
    unit: "ton"
  },
  {
    name: "Insulation Material",
    prefix: "INS",
    products: ["Ceramic Fiber 1260", "Calcium Silicate", "Insulating Brick 23", "Fiber Module 1400", "Microporous Board"],
    price: [3.8, 18.4],
    demand: [120, 280]
  }
];

const suppliers = [
  "Atlas Minerals",
  "Great Lakes Refractories",
  "Henan Thermal Products",
  "MagTech Materials",
  "Summit Industrial Ceramics",
  "Tianjin Furnace Supply"
];

const warehouses = [
  { warehouse: "Chicago", region: "Midwest", weight: 0.42 },
  { warehouse: "Houston", region: "South", weight: 0.33 },
  { warehouse: "Pittsburgh", region: "Northeast", weight: 0.25 }
];

const products = [];
for (const category of categories) {
  category.products.forEach((productName, index) => {
    const baseline = Math.round(
      category.demand[0] + random() * (category.demand[1] - category.demand[0])
    );
    products.push({
      product_code: `${category.prefix}-${String(index + 1).padStart(3, "0")}`,
      product_name: productName,
      category: category.name,
      supplier: suppliers[(products.length + index) % suppliers.length],
      unit: category.unit || "piece",
      unit_price: round(category.price[0] + random() * (category.price[1] - category.price[0]), 2),
      lead_time_days: Math.round(14 + random() * 48),
      safety_stock: Math.round(baseline * (0.55 + random() * 0.35)),
      monthly_demand_baseline: baseline
    });
  });
}

const inventory = [];
products.forEach((product, productIndex) => {
  warehouses.forEach((location, warehouseIndex) => {
    const safety = Math.max(8, Math.round(product.safety_stock * location.weight));
    const scenario = (productIndex * 3 + warehouseIndex) % 11;
    let currentFactor = 1.3 + random() * 2.1;
    if (scenario === 0) currentFactor = 0;
    else if (scenario <= 2) currentFactor = 0.38 + random() * 0.48;
    else if (scenario === 3) currentFactor = 0.9 + random() * 0.22;
    const current = Math.round(safety * currentFactor);
    const reserved = Math.min(current, Math.round(current * random() * 0.36));
    inventory.push({
      alert_id: `ALT-${product.product_code}-${location.warehouse.toUpperCase().slice(0, 3)}`,
      product_code: product.product_code,
      product_name: product.product_name,
      category: product.category,
      supplier: product.supplier,
      warehouse: location.warehouse,
      region: location.region,
      unit: product.unit,
      current_quantity: current,
      reserved_quantity: reserved,
      available_quantity: current - reserved,
      in_transit_quantity: scenario <= 3 ? Math.round(safety * (0.5 + random())) : 0,
      safety_stock: safety,
      unit_price: product.unit_price,
      lead_time_days: product.lead_time_days,
      last_updated: "2026-07-27T18:00:00Z"
    });
  });
});

const months = [];
const referenceDate = new Date(Date.UTC(2026, 6, 1));
for (let offset = 23; offset >= 0; offset -= 1) {
  months.push(new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - offset, 1)));
}

const transactions = [];
for (const month of months) {
  const seasonal = 1 + 0.16 * Math.sin((month.getUTCMonth() / 12) * Math.PI * 2);
  for (const product of products) {
    for (const location of warehouses) {
      const demand = product.monthly_demand_baseline * location.weight * seasonal;
      const sales = Math.max(0, Math.round(demand * (0.82 + random() * 0.36)));
      const purchase = Math.max(0, Math.round(demand * (0.76 + random() * 0.48)));
      const date = month.toISOString().slice(0, 10);
      transactions.push({
        transaction_id: `SAL-${date}-${product.product_code}-${location.warehouse.slice(0, 3).toUpperCase()}`,
        transaction_date: date,
        transaction_type: "sale",
        product_code: product.product_code,
        warehouse: location.warehouse,
        quantity: sales,
        unit_price: product.unit_price
      });
      transactions.push({
        transaction_id: `PUR-${date}-${product.product_code}-${location.warehouse.slice(0, 3).toUpperCase()}`,
        transaction_date: date,
        transaction_type: "purchase",
        product_code: product.product_code,
        warehouse: location.warehouse,
        quantity: purchase,
        unit_price: product.unit_price
      });
    }
  }
}

let steelRows;
try {
  steelRows = parseCsv(await readFile(steelPath, "utf8")).map((row) => ({
    observation_date: row.observation_date,
    steel_production_index: Number(row.steel_production_index),
    source_series: row.source_series
  }));
} catch (error) {
  if (error.code === "ENOENT") {
    throw new Error("Real industry data is missing. Run `npm run fetch:fred` first.");
  }
  throw error;
}

const industryActual = steelRows.slice(-60);
const recent12 = industryActual.slice(-12);
const prior12 = industryActual.slice(-24, -12);
const yearOverYearGrowth =
  prior12.length === 12
    ? recent12.reduce((sum, row) => sum + row.steel_production_index, 0) /
        prior12.reduce((sum, row) => sum + row.steel_production_index, 0) -
      1
    : 0;
const lastActual = industryActual.at(-1);
const baselineForecast = Array.from({ length: 12 }, (_, index) => {
  const forecastDate = new Date(`${lastActual.observation_date}T00:00:00Z`);
  forecastDate.setUTCMonth(forecastDate.getUTCMonth() + index + 1);
  const seasonalReference = recent12[(index + 1) % 12]?.steel_production_index ?? lastActual.steel_production_index;
  const forecast = seasonalReference * (1 + yearOverYearGrowth * ((index + 1) / 12));
  const spread = forecast * (0.035 + index * 0.0025);
  return {
    observation_date: forecastDate.toISOString().slice(0, 10),
    actual_value: null,
    forecast_value: round(forecast, 4),
    lower_bound: round(forecast - spread, 4),
    upper_bound: round(forecast + spread, 4),
    series_type: "Local baseline preview"
  };
});
const demandSignal = [
  ...industryActual.map((row) => ({
    observation_date: row.observation_date,
    actual_value: row.steel_production_index,
    forecast_value: null,
    lower_bound: null,
    upper_bound: null,
    series_type: "Observed"
  })),
  ...baselineForecast
];

const monthlyActivity = months.map((month) => {
  const key = month.toISOString().slice(0, 7);
  const rows = transactions.filter((row) => row.transaction_date.startsWith(key));
  return {
    month: `${key}-01`,
    sales_quantity: rows
      .filter((row) => row.transaction_type === "sale")
      .reduce((sum, row) => sum + row.quantity, 0),
    purchase_quantity: rows
      .filter((row) => row.transaction_type === "purchase")
      .reduce((sum, row) => sum + row.quantity, 0)
  };
});

await mkdir(curatedDir, { recursive: true });
await mkdir(servingDir, { recursive: true });
await writeFile(path.join(curatedDir, "products.csv"), `${toCsv(products)}\n`, "utf8");
await writeFile(path.join(curatedDir, "inventory.csv"), `${toCsv(inventory)}\n`, "utf8");
await writeFile(path.join(curatedDir, "transactions.csv"), `${toCsv(transactions)}\n`, "utf8");
await writeFile(
  path.join(servingDir, "dashboard.json"),
  `${JSON.stringify(
    {
      generatedAt: "2026-07-27T18:00:00Z",
      mode: "local",
      inventory,
      monthlyActivity,
      demandSignal,
      source: {
        inventory: "Synthetic Kaixiang operational data",
        demandSignal: "Federal Reserve Board via FRED, series IPG3311A2N",
        forecast: "Local seasonal baseline; production target is BigQuery ML ARIMA_PLUS"
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);
await writeFile(path.join(servingDir, "alert-actions.json"), "[]\n", "utf8");

console.log(
  `Generated ${products.length} products, ${inventory.length} inventory rows, and ${transactions.length} transactions.`
);
