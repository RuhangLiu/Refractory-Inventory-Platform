import { BigQuery } from "@google-cloud/bigquery";

export const PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT || "refractory-inventory-platform";
export const DATA_LOCATION = process.env.BIGQUERY_LOCATION || "us-central1";
export const SOURCE_VIEW =
  "refractory-inventory-platform.kaixiang_inventory.serving_inventory";

const PRODUCT_CODE_PATTERN = /^[A-Za-z]{3}-\d{3}$/;
const ALLOWED_WAREHOUSES = new Set(["Chicago", "Houston", "Pittsburgh"]);
const MAXIMUM_BYTES_BILLED = "100000000";

export const INVENTORY_SQL = `
  SELECT
    product_code,
    product_name,
    warehouse,
    current_quantity,
    reserved_quantity,
    available_quantity,
    in_transit_quantity,
    safety_stock,
    supplier,
    lead_time_days,
    unit_price,
    last_updated,
    inventory_status,
    suggested_order_quantity,
    inventory_value
  FROM \`${SOURCE_VIEW}\`
  WHERE product_code = @product_code
    AND warehouse = @warehouse
  LIMIT 1
`;

function normalizeInputs(productCode, warehouse) {
  const normalizedProductCode = String(productCode || "").trim().toUpperCase();
  const normalizedWarehouse = String(warehouse || "").trim();

  if (!PRODUCT_CODE_PATTERN.test(normalizedProductCode)) {
    throw new Error(
      "product_code must use the synthetic inventory format AAA-000."
    );
  }
  if (!ALLOWED_WAREHOUSES.has(normalizedWarehouse)) {
    throw new Error(
      "warehouse must be one of Chicago, Houston, or Pittsburgh."
    );
  }

  return {
    productCode: normalizedProductCode,
    warehouse: normalizedWarehouse
  };
}

function toJsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

export async function getInventorySnapshot(
  { product_code: productCode, warehouse },
  { bigQueryClient = new BigQuery({ projectId: PROJECT_ID }) } = {}
) {
  const normalized = normalizeInputs(productCode, warehouse);
  const [rows] = await bigQueryClient.query({
    query: INVENTORY_SQL,
    params: {
      product_code: normalized.productCode,
      warehouse: normalized.warehouse
    },
    types: {
      product_code: "STRING",
      warehouse: "STRING"
    },
    location: DATA_LOCATION,
    useLegacySql: false,
    maximumBytesBilled: MAXIMUM_BYTES_BILLED
  });

  return {
    source_view: SOURCE_VIEW,
    query_mode: "fixed-parameterized-read-only",
    row_count: rows.length,
    records: toJsonSafe(rows)
  };
}
