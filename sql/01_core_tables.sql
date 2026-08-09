-- Replace YOUR_PROJECT_ID before running, or use scripts/deploy-gcp.sh.
CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.refractory_inventory.alert_actions` (
  alert_id STRING NOT NULL,
  product_code STRING NOT NULL,
  warehouse STRING NOT NULL,
  status STRING NOT NULL,
  acknowledged_by STRING NOT NULL,
  acknowledged_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(acknowledged_at)
CLUSTER BY warehouse, product_code;
