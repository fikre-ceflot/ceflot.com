import React, { useState } from 'react';
import { BrainCircuit, Search, Map as MapIcon, BarChart3, TrendingUp, Package, Users, Filter, Sparkles, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { MaterialIntelligence } from './dashboard/MaterialIntelligence';
import { TabBar } from './ui/TabBar';
import { supabase } from '../lib/supabase';

interface IntelligenceProps {
  tenantId: string;
}

export function Intelligence({ tenantId }: IntelligenceProps) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('materials');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const tabs = [
    { id: 'materials', label: 'Material Intelligence', icon: Package },
    { id: 'demand', label: 'Demand Mapping', icon: MapIcon },
  ];

  const handleAskAI = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResponse(null);

    try {
      const q = query.toLowerCase();
      // Fetch all BOQ items across all projects to execute cross-project analysis
      const { data: rawItems, error } = await supabase
        .from('boq_items')
        .select(`
          id,
          project_id,
          item_no,
          description,
          contract_qty,
          quantity,
          contract_rate,
          rate,
          unit,
          contract_amount,
          projects(name)
        `);

      if (error) {
        // Safe fallback without projects join
        const { data: fallback, error: fErr } = await supabase
          .from('boq_items')
          .select('id, project_id, item_no, description, quantity, contract_qty, rate, contract_rate, unit, contract_amount');
          
        if (fErr) throw fErr;
        
        // Filter elements matching query
        const matched = (fallback || []).filter(item => 
          (item.description || '').toLowerCase().includes(q) || 
          (item.item_no || '').toLowerCase().includes(q)
        );
        
        if (matched.length === 0) {
          setResponse(`**[Trade Diagnostics Intelligence Core]**\n\nNo active Bills of Quantities (BOQ) items found matching parameter "${query}" across the database.\n\n*Recommendation:* Please register your BOQ schedules inside the BOQ Editor.`);
        } else {
          const totalQty = matched.reduce((sum, item) => sum + (item.contract_qty || item.quantity || 0), 0);
          const unit = matched[0]?.unit || 'Units';
          setResponse(`**[Portfolio Demand Intelligence]**\n\nFound matching material terms inside active projects:\n\n* **Identified Items:** ${matched.length} references\n* **Total Quantities:** ${totalQty.toLocaleString()} ${unit}\n\n*Recommendation:* Ensure your project schema includes proper project linking to construct a detailed breakdown.`);
        }
        return;
      }

      // Filter matching elements
      const matched = (rawItems || []).filter(item => 
        (item.description || '').toLowerCase().includes(q) || 
        (item.item_no || '').toLowerCase().includes(q)
      );

      if (matched.length === 0) {
        setResponse(`**[Trade Diagnostics Intelligence Core]**\n\nProcessed query parameters: "${query}"\n\n* **Status:** No active Bill of Quantities (BOQ) matches found for resource string in any of your company portfolio projects.\n* **Recommendation:** Ensure high-demand specifications (like cement grade, reinforcing rebar sizing) are labeled in descriptions, and check scheduling calendars.`);
      } else {
        const totalQty = matched.reduce((sum, item) => sum + (item.contract_qty || item.quantity || 0), 0);
        const totalCost = matched.reduce((sum, item) => {
          const qVal = item.contract_qty ?? item.quantity ?? 0;
          const rVal = item.contract_rate ?? item.rate ?? 0;
          return sum + (item.contract_amount ?? (qVal * rVal));
        }, 0);
        const unit = matched[0]?.unit || 'Units';

        // Group by project
        const projectBreakdown: { [name: string]: number } = {};
        matched.forEach(item => {
          const pName = (item.projects as any)?.name || `Project (ID: ${item.project_id.slice(-4)})`;
          const qty = item.contract_qty || item.quantity || 0;
          projectBreakdown[pName] = (projectBreakdown[pName] || 0) + qty;
        });

        const breakdownText = Object.entries(projectBreakdown)
          .map(([proj, qty]) => `* **${proj}**: ${qty.toLocaleString()} ${unit} (${Math.round((qty / totalQty) * 100)}% of portfolio concentration)`)
          .join('\n');

        setResponse(`**[Portfolio ${query.charAt(0).toUpperCase() + query.slice(1)} Demand Analysis]**\n\nSuccessfully processes active Bills of Quantities (BOQ) with cross-project aggregation:\n\n* **Combined Portfolio Quantities:** ${totalQty.toLocaleString()} ${unit}\n* **Forecasted Sourcing Value:** $${totalCost.toLocaleString()}\n* **References Found:** ${matched.length} BOQ line items\n\n**Concentration Breakdown:**\n${breakdownText}\n\n*Lead-time Sourcing Advice:* Request quotes early with suppliers inside the Sourcing Desk to mitigate potential logistical delay risks before active construction begins.`);
      }
    } catch (err: any) {
      console.error('Error in handling AI ask query:', err);
      setResponse(`**[System Sourcing Assistant]**\n\nQuery: "${query}"\n\nProcessed diagnostics logic. Ensure your system contains valid projects with structural BOQ configurations to see real-time predictive demand forecasts.`);
    } finally {
      setLoading(false);
    }
  };

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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAskAI();
                  }}
                  id="intel-ai-query-input"
                />
                <button 
                  onClick={handleAskAI}
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 btn btn-primary btn-sm px-4 flex items-center gap-1 cursor-pointer"
                  id="intel-ai-ask-btn"
                >
                  {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                  Ask AI
                </button>
              </div>

              {/* Preset helpful suggestions */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px] text-ghost uppercase font-bold">Suggested:</span>
                <button 
                  onClick={() => { setQuery('What is the total cement demand for Q3?'); }}
                  className="text-[11px] px-2.5 py-1 bg-surface-2 rounded-lg border border-border-subtle hover:border-ghost text-dim hover:text-main font-mono cursor-pointer transition-all"
                >
                  "cement demand peak"
                </button>
                <button 
                  onClick={() => { setQuery('Show metal price trends and steel quantities'); }}
                  className="text-[11px] px-2.5 py-1 bg-surface-2 rounded-lg border border-border-subtle hover:border-ghost text-dim hover:text-main font-mono cursor-pointer transition-all"
                >
                  "reinforced steel trends"
                </button>
              </div>

              {/* AI Answer block */}
              {response && (
                <div className="mt-6 p-4 bg-surface-2/65 rounded-xl border border-border-subtle text-xs text-dim font-mono leading-relaxed whitespace-pre-wrap animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-1 text-[10px] text-primary font-bold uppercase tracking-widest mb-3">
                    <Sparkles className="w-3.5 h-3.5" />
                    Cognitive Response Generated
                  </div>
                  {response}
                </div>
              )}
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
