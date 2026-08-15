import React from 'react';
import { TrendingUp, Info } from 'lucide-react';
import { Card, CardHeader } from './ui/Card';
import { DEMAND_SIGNAL_DATA } from '../constants';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const DemandSignal: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Demand Signal Analysis</h2>
        <p className="text-slate-400 text-sm mt-1">AI-driven forecasting incorporating external market indicators.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        <Card className="lg:col-span-3 flex flex-col h-full">
          <CardHeader 
            title="Refractory Demand Forecast" 
            subtitle="Actual vs. Predicted Volume (Index: 100 = 2022 Baseline)" 
          />
          <div className="flex-1 min-h-0 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={DEMAND_SIGNAL_DATA} margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin - 10', 'dataMax + 10']} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9', borderRadius: '0.5rem' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                
                {/* Prediction Interval Area */}
                <Area 
                  type="monotone" 
                  dataKey="upperBound" 
                  stroke="none" 
                  fill="#3b82f6" 
                  fillOpacity={0.1} 
                  name="Prediction Interval"
                />
                <Area 
                  type="monotone" 
                  dataKey="lowerBound" 
                  stroke="none" 
                  fill="#0f172a" // Match background to hide the bottom part of the area
                  fillOpacity={1} 
                  legendType="none"
                  tooltipType="none"
                />

                {/* Forecast Line */}
                <Line 
                  type="monotone" 
                  dataKey="forecast" 
                  stroke="#3b82f6" 
                  strokeWidth={2} 
                  strokeDasharray="5 5" 
                  name="Forecast" 
                  dot={false}
                  activeDot={{ r: 6, fill: '#3b82f6', stroke: '#0f172a', strokeWidth: 2 }}
                />
                
                {/* Actual Line */}
                <Line 
                  type="monotone" 
                  dataKey="actual" 
                  stroke="#10b981" 
                  strokeWidth={3} 
                  name="Actual Demand" 
                  dot={{ r: 4, fill: '#10b981', stroke: '#0f172a', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#10b981', stroke: '#0f172a', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg mt-1">
                <TrendingUp className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-200">External Steel Demand Index</h3>
                <p className="text-3xl font-bold text-slate-100 mt-2">-0.9% <span className="text-sm font-normal text-slate-500">MoM</span></p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800">
              <p className="text-sm text-slate-400 leading-relaxed">
                The forecast model incorporates the Global Steel Production Index. A recent slight contraction (-0.9%) in automotive steel orders has softened the Q3 forecast for high-alumina refractories.
              </p>
            </div>
          </Card>

          <Card className="bg-blue-900/10 border-blue-500/20">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-blue-300">Model Confidence</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Prediction intervals (shaded area) represent a 90% confidence level. Volatility in raw material supply chains slightly widens the interval for Q4 2024.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
