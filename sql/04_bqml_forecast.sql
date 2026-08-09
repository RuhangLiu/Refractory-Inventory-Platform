-- AI service: monthly steel activity forecast using BigQuery ML ARIMA_PLUS.
CREATE OR REPLACE MODEL `YOUR_PROJECT_ID.refractory_inventory.steel_demand_forecast`
OPTIONS (
  MODEL_TYPE = 'ARIMA_PLUS',
  TIME_SERIES_TIMESTAMP_COL = 'observation_date',
  TIME_SERIES_DATA_COL = 'steel_production_index',
  DATA_FREQUENCY = 'MONTHLY',
  HORIZON = 12,
  HOLIDAY_REGION = 'US',
  CLEAN_SPIKES_AND_DIPS = TRUE,
  ADJUST_STEP_CHANGES = TRUE
) AS
SELECT
  observation_date,
  steel_production_index
FROM `YOUR_PROJECT_ID.refractory_inventory.steel_industry_index`
WHERE steel_production_index IS NOT NULL;

CREATE OR REPLACE TABLE `YOUR_PROJECT_ID.refractory_inventory.serving_demand_forecast` AS
SELECT
  observation_date,
  steel_production_index AS actual_value,
  CAST(NULL AS FLOAT64) AS forecast_value,
  CAST(NULL AS FLOAT64) AS prediction_interval_lower_bound,
  CAST(NULL AS FLOAT64) AS prediction_interval_upper_bound,
  'Observed' AS series_type
FROM `YOUR_PROJECT_ID.refractory_inventory.steel_industry_index`
WHERE observation_date >= DATE_SUB(
  (SELECT MAX(observation_date) FROM `YOUR_PROJECT_ID.refractory_inventory.steel_industry_index`),
  INTERVAL 59 MONTH
)
UNION ALL
SELECT
  DATE(forecast_timestamp) AS observation_date,
  CAST(NULL AS FLOAT64) AS actual_value,
  forecast_value,
  prediction_interval_lower_bound,
  prediction_interval_upper_bound,
  'BigQuery ML forecast' AS series_type
FROM ML.FORECAST(
  MODEL `YOUR_PROJECT_ID.refractory_inventory.steel_demand_forecast`,
  STRUCT(12 AS horizon, 0.90 AS confidence_level)
);

SELECT *
FROM `YOUR_PROJECT_ID.refractory_inventory.serving_demand_forecast`
ORDER BY observation_date;
