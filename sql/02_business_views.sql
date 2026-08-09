-- Inventory serving view used by the Cloud Run application.
CREATE OR REPLACE VIEW `YOUR_PROJECT_ID.kaixiang_inventory.serving_inventory` AS
SELECT
  i.alert_id,
  i.product_code,
  i.product_name,
  i.category,
  i.supplier,
  i.warehouse,
  i.region,
  i.unit,
  i.current_quantity,
  i.reserved_quantity,
  i.available_quantity,
  i.in_transit_quantity,
  i.safety_stock,
  CAST(i.unit_price AS FLOAT64) AS unit_price,
  i.lead_time_days,
  i.last_updated,
  CASE
    WHEN i.available_quantity = 0 THEN 'Out of stock'
    WHEN i.available_quantity < i.safety_stock * 0.5 THEN 'Critical'
    WHEN i.available_quantity < i.safety_stock THEN 'Low'
    ELSE 'Healthy'
  END AS inventory_status,
  CASE
    WHEN i.available_quantity = 0 THEN 0
    WHEN i.available_quantity < i.safety_stock * 0.5 THEN 1
    WHEN i.available_quantity < i.safety_stock THEN 2
    ELSE 3
  END AS inventory_status_rank,
  GREATEST(
    0,
    CAST(CEIL(i.safety_stock * 1.5 - i.available_quantity - i.in_transit_quantity) AS INT64)
  ) AS suggested_order_quantity,
  CAST(i.current_quantity * i.unit_price AS FLOAT64) AS inventory_value
FROM `YOUR_PROJECT_ID.kaixiang_inventory.inventory` AS i;

-- Business aggregate: monthly sales and purchase quantities.
CREATE OR REPLACE VIEW `YOUR_PROJECT_ID.kaixiang_inventory.monthly_inventory_activity` AS
SELECT
  DATE_TRUNC(transaction_date, MONTH) AS month,
  SUM(IF(transaction_type = 'sale', quantity, 0)) AS sales_quantity,
  SUM(IF(transaction_type = 'purchase', quantity, 0)) AS purchase_quantity
FROM `YOUR_PROJECT_ID.kaixiang_inventory.transactions`
GROUP BY month;

-- Looker Studio-ready KPI aggregate.
CREATE OR REPLACE VIEW `YOUR_PROJECT_ID.kaixiang_inventory.inventory_kpis` AS
SELECT
  warehouse,
  COUNT(*) AS inventory_line_count,
  COUNTIF(inventory_status != 'Healthy') AS action_required_count,
  COUNTIF(inventory_status = 'Out of stock') AS out_of_stock_count,
  SUM(current_quantity) AS current_quantity,
  SUM(available_quantity) AS available_quantity,
  SUM(inventory_value) AS inventory_value,
  SAFE_DIVIDE(COUNTIF(inventory_status = 'Healthy'), COUNT(*)) AS healthy_line_rate
FROM `YOUR_PROJECT_ID.kaixiang_inventory.serving_inventory`
GROUP BY warehouse;
