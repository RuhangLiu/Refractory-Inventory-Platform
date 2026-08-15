import { InventoryItem, Alert, ChartDataPoint, DemandDataPoint } from './types';

export const WAREHOUSES = ['All Warehouses', 'WH-North (Chicago)', 'WH-South (Houston)', 'WH-East (Newark)'];

export const INVENTORY_DATA: InventoryItem[] = [
  { id: 'ITM-1001', product: 'High-Alumina Brick HA-70', warehouse: 'WH-North (Chicago)', onHand: 1250, reserved: 200, available: 1050, safetyStock: 500, status: 'Healthy', recommendedOrder: 0 },
  { id: 'ITM-1002', product: 'Magnesia-Carbon Brick MC-15', warehouse: 'WH-South (Houston)', onHand: 320, reserved: 300, available: 20, safetyStock: 400, status: 'Critical', recommendedOrder: 800 },
  { id: 'ITM-1003', product: 'Silica Brick SB-95', warehouse: 'WH-East (Newark)', onHand: 0, reserved: 0, available: 0, safetyStock: 150, status: 'Stockout', recommendedOrder: 300 },
  { id: 'ITM-1004', product: 'Fireclay Brick FC-40', warehouse: 'WH-North (Chicago)', onHand: 850, reserved: 100, available: 750, safetyStock: 800, status: 'Low Stock', recommendedOrder: 250 },
  { id: 'ITM-1005', product: 'Insulating Firebrick IFB-23', warehouse: 'WH-South (Houston)', onHand: 2100, reserved: 500, available: 1600, safetyStock: 1000, status: 'Healthy', recommendedOrder: 0 },
  { id: 'ITM-1006', product: 'Castable Refractory CR-60', warehouse: 'WH-East (Newark)', onHand: 450, reserved: 400, available: 50, safetyStock: 300, status: 'Critical', recommendedOrder: 500 },
  { id: 'ITM-1007', product: 'Plastic Refractory PR-80', warehouse: 'WH-North (Chicago)', onHand: 150, reserved: 150, available: 0, safetyStock: 200, status: 'Stockout', recommendedOrder: 400 },
  { id: 'ITM-1008', product: 'Ceramic Fiber Blanket CFB-1', warehouse: 'WH-South (Houston)', onHand: 900, reserved: 50, available: 850, safetyStock: 400, status: 'Healthy', recommendedOrder: 0 },
  { id: 'ITM-1009', product: 'Zirconia Brick ZB-99', warehouse: 'WH-East (Newark)', onHand: 120, reserved: 20, available: 100, safetyStock: 150, status: 'Low Stock', recommendedOrder: 100 },
  { id: 'ITM-1010', product: 'Silicon Carbide Brick SiC-90', warehouse: 'WH-North (Chicago)', onHand: 560, reserved: 100, available: 460, safetyStock: 300, status: 'Healthy', recommendedOrder: 0 },
];

export const ALERTS_DATA: Alert[] = [
  { id: 'ALT-001', itemId: 'ITM-1003', product: 'Silica Brick SB-95', type: 'Stockout', message: 'Zero available stock. Production line 3 at risk.', timestamp: '10 mins ago', acknowledged: false },
  { id: 'ALT-002', itemId: 'ITM-1007', product: 'Plastic Refractory PR-80', type: 'Stockout', message: 'All on-hand stock is reserved. Cannot fulfill new orders.', timestamp: '1 hour ago', acknowledged: false },
  { id: 'ALT-003', itemId: 'ITM-1002', product: 'Magnesia-Carbon Brick MC-15', type: 'Critical', message: 'Available stock (20) is 95% below safety stock (400).', timestamp: '3 hours ago', acknowledged: false },
  { id: 'ALT-004', itemId: 'ITM-1006', product: 'Castable Refractory CR-60', type: 'Critical', message: 'High reservation volume depleting available stock rapidly.', timestamp: '5 hours ago', acknowledged: true },
  { id: 'ALT-005', itemId: 'ITM-1004', product: 'Fireclay Brick FC-40', type: 'Low Stock', message: 'Available stock dipped below safety threshold.', timestamp: '1 day ago', acknowledged: true },
];

export const SALES_PURCHASES_DATA: ChartDataPoint[] = [
  { month: 'Jan', sales: 45000, purchases: 38000 },
  { month: 'Feb', sales: 52000, purchases: 41000 },
  { month: 'Mar', sales: 48000, purchases: 55000 },
  { month: 'Apr', sales: 61000, purchases: 48000 },
  { month: 'May', sales: 59000, purchases: 52000 },
  { month: 'Jun', sales: 65000, purchases: 60000 },
];

export const DEMAND_SIGNAL_DATA: DemandDataPoint[] = [
  { date: '2023-Q1', actual: 120, forecast: 115, lowerBound: 105, upperBound: 125 },
  { date: '2023-Q2', actual: 135, forecast: 130, lowerBound: 120, upperBound: 140 },
  { date: '2023-Q3', actual: 128, forecast: 135, lowerBound: 125, upperBound: 145 },
  { date: '2023-Q4', actual: 142, forecast: 140, lowerBound: 130, upperBound: 150 },
  { date: '2024-Q1', actual: 138, forecast: 145, lowerBound: 135, upperBound: 155 },
  { date: '2024-Q2', actual: null, forecast: 152, lowerBound: 140, upperBound: 164 },
  { date: '2024-Q3', actual: null, forecast: 158, lowerBound: 145, upperBound: 171 },
  { date: '2024-Q4', actual: null, forecast: 165, lowerBound: 150, upperBound: 180 },
];
