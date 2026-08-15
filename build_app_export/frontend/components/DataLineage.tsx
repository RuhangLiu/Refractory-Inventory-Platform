import React from 'react';
import { Database, Cloud, Server, Bot, MonitorPlay, ArrowRight, FileText, Layers } from 'lucide-react';
import { Card } from './ui/Card';

export const DataLineage: React.FC = () => {
  const Node = ({ icon: Icon, title, subtitle, colorClass }: { icon: any, title: string, subtitle: string, colorClass: string }) => (
    <div className={`flex flex-col items-center p-4 rounded-xl border bg-slate-900 w-48 text-center relative z-10 shadow-lg ${colorClass}`}>
      <div className={`p-3 rounded-full mb-3 bg-slate-950 border ${colorClass.replace('border-', 'border-').replace('hover:border-', '')}`}>
        <Icon className={`w-6 h-6 ${colorClass.includes('blue') ? 'text-blue-400' : colorClass.includes('emerald') ? 'text-emerald-400' : colorClass.includes('purple') ? 'text-purple-400' : 'text-amber-400'}`} />
      </div>
      <h3 className="font-semibold text-slate-200 text-sm">{title}</h3>
      <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">System Architecture & Data Lineage</h2>
        <p className="text-slate-400 text-sm mt-1">End-to-end flow from raw data ingestion to AI-assisted serving.</p>
      </div>

      <Card className="flex-1 flex items-center justify-center overflow-x-auto p-8 relative">
        {/* Background Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20"></div>

        <div className="flex items-center gap-4 md:gap-8 min-w-max relative">
          
          {/* Storage Layer */}
          <div className="flex flex-col gap-8 relative">
            <Node 
              icon={Cloud} 
              title="GCS Raw Zone" 
              subtitle="ERP Dumps, IoT Logs" 
              colorClass="border-slate-700 hover:border-slate-500"
            />
            <Node 
              icon={Layers} 
              title="GCS Curated Zone" 
              subtitle="Cleaned Parquet Files" 
              colorClass="border-slate-700 hover:border-slate-500"
            />
            {/* Connecting line for storage */}
            <div className="absolute left-1/2 top-[100px] bottom-[100px] w-px bg-slate-700 -z-10"></div>
          </div>

          <ArrowRight className="w-6 h-6 text-slate-600 animate-pulse" />

          {/* Data Warehouse */}
          <Node 
            icon={Database} 
            title="BigQuery" 
            subtitle="Enterprise Data Warehouse" 
            colorClass="border-blue-500/30 hover:border-blue-500 shadow-blue-900/20"
          />

          <ArrowRight className="w-6 h-6 text-slate-600 animate-pulse" />

          {/* AI/Logic Layer */}
          <div className="flex flex-col gap-8 relative">
            <Node 
              icon={Server} 
              title="MCP Tools" 
              subtitle="Inventory API, Order Exec" 
              colorClass="border-emerald-500/30 hover:border-emerald-500 shadow-emerald-900/20"
            />
            <Node 
              icon={FileText} 
              title="RAG Policy Corpus" 
              subtitle="Vector DB (Policies)" 
              colorClass="border-emerald-500/30 hover:border-emerald-500 shadow-emerald-900/20"
            />
             {/* Connecting line to Agent */}
             <div className="absolute right-[-2rem] top-1/2 w-8 h-px bg-slate-700 -z-10"></div>
             <div className="absolute right-[-2rem] top-[25%] bottom-[25%] w-px bg-slate-700 -z-10"></div>
          </div>

          <div className="w-8"></div> {/* Spacer for the complex routing above */}

          {/* Agent Studio */}
          <Node 
            icon={Bot} 
            title="Agent Studio" 
            subtitle="Orchestration & LLM" 
            colorClass="border-purple-500/30 hover:border-purple-500 shadow-purple-900/20"
          />

          <ArrowRight className="w-6 h-6 text-slate-600 animate-pulse" />

          {/* Serving App */}
          <Node 
            icon={MonitorPlay} 
            title="Serving Application" 
            subtitle="React UI (This App)" 
            colorClass="border-amber-500/30 hover:border-amber-500 shadow-amber-900/20"
          />

        </div>
      </Card>
    </div>
  );
};
