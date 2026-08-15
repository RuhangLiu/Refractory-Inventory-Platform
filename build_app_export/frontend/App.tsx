import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Overview } from './components/Overview';
import { InventoryTable } from './components/InventoryTable';
import { Alerts } from './components/Alerts';
import { DemandSignal } from './components/DemandSignal';
import { DataLineage } from './components/DataLineage';
import { AIAssistant } from './components/AIAssistant';
import { TabId } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return <Overview />;
      case 'inventory': return <InventoryTable />;
      case 'alerts': return <Alerts />;
      case 'demand': return <DemandSignal />;
      case 'lineage': return <DataLineage />;
      case 'assistant': return <AIAssistant />;
      default: return <Overview />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 overflow-hidden selection:bg-blue-500/30">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none"></div>
        
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 z-10">
          <div className="max-w-7xl mx-auto h-full">
            {renderContent()}
          </div>
        </div>

        <footer className="border-t border-slate-800/50 bg-slate-900/50 backdrop-blur-md p-3 text-center z-20">
          <p className="text-xs text-slate-500 font-medium tracking-wide">
            Synthetic operational data for academic demonstration.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default App;
