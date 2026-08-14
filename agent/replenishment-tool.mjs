import { readFile } from "node:fs/promises";

const dashboardUrl = new URL("../data/serving/dashboard.json", import.meta.url);

export function inventoryStatus(row) {
  if (Number(row.available_quantity) === 0) return "Out of stock";
  if (Number(row.available_quantity) < Number(row.safety_stock) * 0.5) return "Critical";
  if (Number(row.available_quantity) < Number(row.safety_stock)) return "Low";
  return "Healthy";
}

export function suggestedOrder(row) {
  return Math.max(
    0,
    Math.ceil(
      Number(row.safety_stock) * 1.5 -
        Number(row.available_quantity) -
        Number(row.in_transit_quantity)
    )
  );
}

function quantityLabel(value, unit) {
  return `${value} ${value === 1 ? unit : `${unit}s`}`;
}

export async function loadInventoryRows() {
  const dashboard = JSON.parse(await readFile(dashboardUrl, "utf8"));
  return dashboard.inventory;
}

export async function recommendReplenishment(
  { productCode, warehouse },
  { inventoryRows } = {}
) {
  const code = String(productCode || "").trim().toUpperCase();
  const location = String(warehouse || "").trim().toLowerCase();
  if (!code || !location) {
    throw new Error("productCode and warehouse are required.");
  }

  const rows = inventoryRows || (await loadInventoryRows());
  const row = rows.find(
    (item) =>
      String(item.product_code).toUpperCase() === code &&
      String(item.warehouse).toLowerCase() === location
  );
  if (!row) {
    const warehouses = [
      ...new Set(
        rows
          .filter((item) => String(item.product_code).toUpperCase() === code)
          .map((item) => item.warehouse)
      )
    ];
    const suffix = warehouses.length
      ? ` Available warehouses for ${code}: ${warehouses.join(", ")}.`
      : ` Product ${code} was not found.`;
    throw new Error(`No inventory row matched ${code} at ${warehouse}.${suffix}`);
  }

  const recommendation = {
    product_code: row.product_code,
    product_name: row.product_name,
    warehouse: row.warehouse,
    supplier: row.supplier,
    unit: row.unit,
    status: inventoryStatus(row),
    current_quantity: Number(row.current_quantity),
    reserved_quantity: Number(row.reserved_quantity),
    available_quantity: Number(row.available_quantity),
    safety_stock: Number(row.safety_stock),
    in_transit_quantity: Number(row.in_transit_quantity),
    suggested_order_quantity: suggestedOrder(row),
    lead_time_days: Number(row.lead_time_days),
    recommendation_only: true,
    human_approval_required: true,
    source: "data/curated/inventory.csv"
  };

  recommendation.rationale =
    recommendation.suggested_order_quantity > 0
      ? `Available stock is ${quantityLabel(recommendation.available_quantity, recommendation.unit)}; the planning target is 150% of safety stock after confirmed in-transit inventory.`
      : "Available and in-transit inventory already cover the planning target; no replenishment is suggested.";

  return recommendation;
}
