export type TabId = 'overview' | 'inventory' | 'alerts' | 'demand' | 'lineage' | 'assistant';

export interface InventoryItem {
  id: string;
  product: string;
  warehouse: string;
  onHand: number;
  reserved: number;
  available: number;
  safetyStock: number;
  status: 'Healthy' | 'Low Stock' | 'Critical' | 'Stockout';
  recommendedOrder: number;
}

export interface Alert {
  id: string;
  itemId: string;
  product: string;
  type: 'Stockout' | 'Critical' | 'Low Stock';
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface ChartDataPoint {
  month: string;
  sales: number;
  purchases: number;
}

export interface DemandDataPoint {
  date: string;
  actual: number | null;
  forecast: number;
  lowerBound: number;
  upperBound: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: { id: string; text: string; url?: string }[];
  toolTrace?: { name: string; status: 'running' | 'success' | 'error'; details: string }[];
}
