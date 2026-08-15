import React, { useState, useMemo } from 'react';
import { Search, Filter, ArrowUpDown } from 'lucide-react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { INVENTORY_DATA, WAREHOUSES } from '../constants';

export const InventoryTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [warehouseFilter, setWarehouseFilter] = useState('All Warehouses');

  const filteredData = useMemo(() => {
    return INVENTORY_DATA.filter(item => {
      const matchesSearch = item.product.toLowerCase().includes(searchTerm.toLowerCase()) || item.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      const matchesWarehouse = warehouseFilter === 'All Warehouses' || item.warehouse === warehouseFilter;
      return matchesSearch && matchesStatus && matchesWarehouse;
    });
  }, [searchTerm, statusFilter, warehouseFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Healthy': return <Badge variant="success">Healthy</Badge>;
      case 'Low Stock': return <Badge variant="warning">Low Stock</Badge>;
      case 'Critical': return <Badge variant="danger">Critical</Badge>;
      case 'Stockout': return <Badge variant="danger" className="animate-pulse">Stockout</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Inventory Control</h2>
          <p className="text-slate-400 text-sm mt-1">Manage and monitor refractory stock levels across locations.</p>
        </div>
        <div className="text-xs text-slate-500 italic">
          * Synthetic operational data for demonstration
        </div>
      </div>

      <Card className="flex-1 flex flex-col min-h-0" noPadding>
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900/50">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search product or ID..." 
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select 
                className="bg-transparent text-sm text-slate-300 focus:outline-none cursor-pointer"
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
              >
                {WAREHOUSES.map(wh => <option key={wh} value={wh} className="bg-slate-900">{wh}</option>)}
              </select>
            </div>
            <select 
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All" className="bg-slate-900">All Statuses</option>
              <option value="Healthy" className="bg-slate-900">Healthy</option>
              <option value="Low Stock" className="bg-slate-900">Low Stock</option>
              <option value="Critical" className="bg-slate-900">Critical</option>
              <option value="Stockout" className="bg-slate-900">Stockout</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-950/50 sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th className="px-6 py-3 font-medium text-slate-400 border-b border-slate-800">Product ID</th>
                <th className="px-6 py-3 font-medium text-slate-400 border-b border-slate-800">Product Name</th>
                <th className="px-6 py-3 font-medium text-slate-400 border-b border-slate-800">Warehouse</th>
                <th className="px-6 py-3 font-medium text-slate-400 border-b border-slate-800 text-right">On Hand</th>
                <th className="px-6 py-3 font-medium text-slate-400 border-b border-slate-800 text-right">Reserved</th>
                <th className="px-6 py-3 font-medium text-slate-400 border-b border-slate-800 text-right">Available</th>
                <th className="px-6 py-3 font-medium text-slate-400 border-b border-slate-800 text-right">Safety Stock</th>
                <th className="px-6 py-3 font-medium text-slate-400 border-b border-slate-800 text-center">Status</th>
                <th className="px-6 py-3 font-medium text-slate-400 border-b border-slate-800 text-right">Rec. Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredData.length > 0 ? (
                filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{item.id}</td>
                    <td className="px-6 py-4 font-medium text-slate-200">{item.product}</td>
                    <td className="px-6 py-4 text-slate-400">{item.warehouse}</td>
                    <td className="px-6 py-4 text-right text-slate-300">{item.onHand.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-slate-400">{item.reserved.toLocaleString()}</td>
                    <td className={`px-6 py-4 text-right font-medium ${item.available < item.safetyStock ? 'text-rose-400' : 'text-slate-200'}`}>
                      {item.available.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500">{item.safetyStock.toLocaleString()}</td>
                    <td className="px-6 py-4 text-center">{getStatusBadge(item.status)}</td>
                    <td className="px-6 py-4 text-right">
                      {item.recommendedOrder > 0 ? (
                        <span className="text-blue-400 font-medium">+{item.recommendedOrder}</span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    No inventory items found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
