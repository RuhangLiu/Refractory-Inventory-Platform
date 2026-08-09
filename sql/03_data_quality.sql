-- Meaningful data-quality query required by the assignment.
CREATE OR REPLACE VIEW `YOUR_PROJECT_ID.kaixiang_inventory.data_quality_results` AS
SELECT
  'duplicate_product_codes' AS check_name,
  COUNT(*) AS failing_row_count,
  'Product code must be unique.' AS rule_description
FROM (
  SELECT product_code
  FROM `YOUR_PROJECT_ID.kaixiang_inventory.products`
  GROUP BY product_code
  HAVING COUNT(*) > 1
)
UNION ALL
SELECT
  'duplicate_inventory_keys',
  COUNT(*),
  'Product and warehouse must uniquely identify an inventory line.'
FROM (
  SELECT product_code, warehouse
  FROM `YOUR_PROJECT_ID.kaixiang_inventory.inventory`
  GROUP BY product_code, warehouse
  HAVING COUNT(*) > 1
)
UNION ALL
SELECT
  'available_quantity_reconciliation',
  COUNTIF(available_quantity != current_quantity - reserved_quantity),
  'Available quantity must equal current quantity minus reserved quantity.'
FROM `YOUR_PROJECT_ID.kaixiang_inventory.inventory`
UNION ALL
SELECT
  'negative_quantities',
  COUNTIF(
    current_quantity < 0
    OR reserved_quantity < 0
    OR available_quantity < 0
    OR in_transit_quantity < 0
    OR safety_stock < 0
  ),
  'Inventory quantities cannot be negative.'
FROM `YOUR_PROJECT_ID.kaixiang_inventory.inventory`
UNION ALL
SELECT
  'unknown_transaction_products',
  COUNTIF(p.product_code IS NULL),
  'Every transaction product code must exist in the product master.'
FROM `YOUR_PROJECT_ID.kaixiang_inventory.transactions` AS t
LEFT JOIN `YOUR_PROJECT_ID.kaixiang_inventory.products` AS p
  USING (product_code);

-- Expected result: every failing_row_count equals zero.
SELECT *
FROM `YOUR_PROJECT_ID.kaixiang_inventory.data_quality_results`
ORDER BY check_name;
