import React, { useState } from 'react';
import { BrainCircuit, Search, Map as MapIcon, BarChart3, TrendingUp, Package, Users, Filter, Sparkles, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { MaterialIntelligence } from './dashboard/MaterialIntelligence';
import { TabBar } from './ui/TabBar';

interface IntelligenceProps {
  tenantId: string;
}

export function Intelligence({ tenantId }: IntelligenceProps) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('materials');

  const tabs = [
    { id: 'materials', label: 'Material Intelligence', icon: Package },
    { id: 'demand', label: 'Demand Mapping', icon: MapIcon },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black tracking-tight text-main">Portfolio Intelligence</h1>
          <p className="text-sm text-dim max-w-lg leading-relaxed">
            Cross-project resource demand mapping and predictive analytics using standard trade benchmarks.
          </p>
        </div>
        <TabBar 
          tabs={tabs} 
          activeTab={activeTab} 
          onChange={setActiveTab} 
        />
      </div>

      {activeTab === 'materials' ? (
        <MaterialIntelligence tenantId={tenantId} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* AI Query Box */}
            <div className="bg-surface-1 border border-primary/20 rounded-2xl p-6 shadow-xl shadow-primary/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-main">Interactive Demand Query</h3>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dim" />
                <input 
                  type="text"
                  placeholder="e.g., 'What is the total cement demand for all projects in Q3?'"
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl py-4 pl-12 pr-4 text-sm outline-none focus:border-primary transition-all text-main"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 btn btn-primary btn-sm px-4">
                  Ask AI
                </button>
              </div>
            </div>

            {/* Demand Map Placeholder */}
            <div className="card-default p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-main">Resource Demand Map</h3>
                <div className="flex bg-surface-2 rounded-xl p-1 border border-border-subtle">
                  <button className="px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-widest bg-surface-3 text-primary">Heatmap</button>
                  <button className="px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-widest text-ghost">Timeline</button>
                </div>
              </div>
              <div className="aspect-video bg-surface-2 rounded-xl border border-border-subtle flex items-center justify-center relative overflow-hidden">
                 <MapIcon className="w-16 h-16 text-border-subtle" />
                 <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-xs text-ghost font-mono">Interactive Map Loading...</div>
                 </div>
                 <div className="absolute top-1/4 left-1/3 w-4 h-4 bg-danger rounded-full animate-ping opacity-50" />
                 <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-primary rounded-full animate-ping opacity-50" />
                 <div className="absolute bottom-1/3 right-1/4 w-5 h-5 bg-accent rounded-full animate-ping opacity-50" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="card-default p-6">
              <h3 className="text-sm font-bold text-main mb-4">Portfolio Insights</h3>
              <div className="flex flex-col gap-4">
                 <div className="p-4 bg-surface-2 rounded-xl border border-border-subtle">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span className="text-xs font-black uppercase text-main">Material Price Trend</span>
                    </div>
                    <p className="text-sm text-dim leading-relaxed">Steel reinforcement prices expected to rise by 8% in the next 30 days based on global market data.</p>
                 </div>
                 <div className="p-4 bg-surface-2 rounded-xl border border-border-subtle">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-danger" />
                      <span className="text-xs font-black uppercase text-main">Critical Shortage Risk</span>
                    </div>
                    <p className="text-sm text-dim leading-relaxed">Project Alpha and Project Gamma both require high-grade cement in Week 14. Potential supply conflict detected.</p>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
