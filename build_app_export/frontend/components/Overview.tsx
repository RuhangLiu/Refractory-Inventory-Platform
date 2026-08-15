import React, { useState } from 'react';
import { DollarSign, Package, AlertTriangle, CheckCircle, TrendingDown, Filter, Bot } from 'lucide-react';
import { Card, CardHeader } from './ui/Card';
import { WAREHOUSES, SALES_PURCHASES_DATA } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const Overview: React.FC = () => {
  const [selectedWarehouse, setSelectedWarehouse] = useState(WAREHOUSES[0]);

  const kpis = [
    { label: 'Inventory Value', value: '$730.1K', icon: DollarSign, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Available Stock', value: '6,237', icon: Package, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Items Requiring Action', value: '32', icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    { label: 'Healthy Inventory Lines', value: '64%', icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'External Demand Signal', value: '-0.9%', icon: TrendingDown, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Overview</h2>
          <p className="text-slate-400 text-sm mt-1">High-level metrics and inventory performance.</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select 
            className="bg-transparent text-sm text-slate-200 focus:outline-none cursor-pointer"
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
          >
            {WAREHOUSES.map(wh => <option key={wh} value={wh} className="bg-slate-900">{wh}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <Card key={idx} className="flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-lg ${kpi.bg}`}>
                  <Icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-100">{kpi.value}</p>
                <p className="text-sm text-slate-400 mt-1 font-medium">{kpi.label}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 h-[400px] flex flex-col">
          <CardHeader title="Monthly Sales vs Purchases" subtitle="Volume in USD ($)" />
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={SALES_PURCHASES_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9' }}
                  itemStyle={{ color: '#e2e8f0' }}
                  cursor={{fill: '#1e293b', opacity: 0.4}}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="sales" name="Sales" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="purchases" name="Purchases" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="Quick Actions" />
          <div className="space-y-3 flex-1">
            <button className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-800 hover:border-blue-500/50 hover:bg-blue-500/5 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-md group-hover:bg-blue-500/20 transition-colors">
                  <Package className="w-4 h-4 text-slate-300 group-hover:text-blue-400" />
                </div>
                <span className="text-sm font-medium text-slate-300 group-hover:text-slate-100">Review Critical Stock</span>
              </div>
              <span className="text-xs bg-rose-500/20 text-rose-400 px-2 py-1 rounded-full">2 Items</span>
            </button>
            <button className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-800 hover:border-blue-500/50 hover:bg-blue-500/5 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-md group-hover:bg-blue-500/20 transition-colors">
                  <TrendingDown className="w-4 h-4 text-slate-300 group-hover:text-blue-400" />
                </div>
                <span className="text-sm font-medium text-slate-300 group-hover:text-slate-100">Analyze Demand Drop</span>
              </div>
            </button>
             <button className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-800 hover:border-blue-500/50 hover:bg-blue-500/5 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-md group-hover:bg-blue-500/20 transition-colors">
                  <Bot className="w-4 h-4 text-slate-300 group-hover:text-blue-400" />
                </div>
                <span className="text-sm font-medium text-slate-300 group-hover:text-slate-100">Ask AI Assistant</span>
              </div>
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};
