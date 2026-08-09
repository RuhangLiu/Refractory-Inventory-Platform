# Data Dictionary

## `products`

One row per refractory product.

| Field | Type | Definition |
| --- | --- | --- |
| `product_code` | STRING | Stable product identifier |
| `product_name` | STRING | Human-readable material name |
| `category` | STRING | Refractory material category |
| `supplier` | STRING | Synthetic preferred supplier |
| `unit` | STRING | Inventory unit (`piece` or `ton`) |
| `unit_price` | NUMERIC | Synthetic unit price in USD |
| `lead_time_days` | INTEGER | Synthetic replenishment lead time |
| `safety_stock` | INTEGER | Network-level reference safety stock |
| `monthly_demand_baseline` | INTEGER | Synthetic demand-generation input |

## `inventory`

One row per product and warehouse.

| Field | Type | Definition |
| --- | --- | --- |
| `alert_id` | STRING | Stable identifier for the product-warehouse alert |
| `product_code` | STRING | Joins to `products` |
| `warehouse` | STRING | Chicago, Houston, or Pittsburgh |
| `current_quantity` | INTEGER | Physical on-hand stock |
| `reserved_quantity` | INTEGER | Stock allocated to existing orders |
| `available_quantity` | INTEGER | Current minus reserved quantity |
| `in_transit_quantity` | INTEGER | Confirmed incoming stock |
| `safety_stock` | INTEGER | Warehouse-specific safety threshold |
| `unit_price` | NUMERIC | Synthetic price used for inventory value |
| `last_updated` | TIMESTAMP | Data freshness timestamp |

Derived fields:

- `inventory_status`: Out of stock, Critical, Low, or Healthy.
- `suggested_order_quantity`: `max(0, ceil(1.5 × safety_stock - available - in_transit))`.
- `inventory_value`: `current_quantity × unit_price`.

## `transactions`

One row per synthetic product, warehouse, month, and transaction type.

| Field | Type | Definition |
| --- | --- | --- |
| `transaction_id` | STRING | Stable generated transaction identifier |
| `transaction_date` | DATE | First day of the modeled month |
| `transaction_type` | STRING | `sale` or `purchase` |
| `product_code` | STRING | Joins to `products` |
| `warehouse` | STRING | Transaction warehouse |
| `quantity` | INTEGER | Units sold or purchased |
| `unit_price` | NUMERIC | Synthetic unit price in USD |

## `steel_industry_index`

Real public data from the Federal Reserve Board, distributed through FRED series `IPG3311A2N`.

| Field | Type | Definition |
| --- | --- | --- |
| `observation_date` | DATE | Monthly observation date |
| `steel_production_index` | FLOAT | Industrial production index, 2017 = 100 |
| `source_series` | STRING | FRED series identifier |

The series is an external planning signal. It is not presented as Kaixiang sales or as a causal product-level forecast.
