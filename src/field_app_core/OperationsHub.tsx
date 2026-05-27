import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Users, 
  Package, 
  Bell, 
  Gauge, 
  Activity as ActivityIcon, 
  ShieldAlert, 
  BarChart3, 
  Wallet, 
  TrendingDown, 
  ArrowRight,
  AlertTriangle,
  FileCheck,
  MessageSquare,
  Download,
  Activity,
  CreditCard,
  PieChart,
  HardHat,
  MonitorCheck,
  RefreshCw,
  Edit3,
  Terminal,
  Search,
  Database,
  Smartphone
} from 'lucide-react';
import { Project, BOQItem } from './types';
import { cn, cleanRichText } from './utils';
import { SubcontractorProgress } from './SubcontractorProgress';
import { PaymentCertificateManager } from './PaymentCertificateManager';
import { FinancialDashboard } from './FinancialDashboard';
import { SiteApp } from './SiteApp';
import { TabBar } from './TabBar';

interface OperationsHubProps {
  project: Project;
  tenantId: string;
}

export function OperationsHub({ project, tenantId }: OperationsHubProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'execution' | 'analytics' | 'subcontractors' | 'risks' | 'site_control' | 'payments' | 'financials'>('overview');
  const [boqItems, setBoqItems] = useState<BOQItem[]>([]);
  const [dailyCosts, setDailyCosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadActualData();
  }, [project.id]);

  const loadActualData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('boq_items')
        .select('*')
        .eq('project_id', project.id)
        .order('item_no');
      
      if (error) throw error;
      setBoqItems(data || []);

      const { data: costData } = await supabase
        .from('v_daily_progress_costs')
        .select('*')
        .eq('project_id', project.id);
      
      if (costData) setDailyCosts(costData);
    } catch (e) {
      console.error('Error loading operations data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOverride = async (itemId: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('boq_items')
        .update(updates)
        .eq('id', itemId);
      
      if (error) throw error;
      
      // Log the override
      await supabase.from('boq_progress_overrides').insert([{
        project_id: project.id,
        boq_item_id: itemId,
        tenant_id: tenantId,
        new_quantity: updates.actual_qty,
        new_progress_pct: updates.progress_pct,
        override_reason: 'Manual management override',
        override_by: (await supabase.auth.getUser()).data.user?.id
      }]);

      loadActualData();
      alert('BOQ item updated successfully.');
    } catch (e: any) {
      alert('Error updating BOQ item: ' + e.message);
    }
  };

  const renderExecutionControls = () => {
    const filteredItems = boqItems.filter(item => 
      (cleanRichText(item.description)).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.item_no || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-main flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Execution Controls
            </h2>
            <p className="text-xs text-ghost">Manual override of site data quantities and progress</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
            <input 
              type="text"
              placeholder="Search Item No or description..."
              className="bg-surface-1 border border-border-subtle rounded-xl py-2 pl-9 pr-4 text-xs outline-none focus:border-primary w-full md:w-64 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-2 border-b border-border-subtle">
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-ghost">Item No</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-ghost">Description</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-ghost text-right">Contract Qty</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-ghost text-right">Actual Qty</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-ghost text-center">Progress %</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-ghost text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-white/[0.01] transition-colors group">
                    <td className="px-4 py-4 text-xs font-mono text-main">{item.item_no}</td>
                    <td className="px-4 py-4">
                      <div className="text-xs font-bold text-main">{cleanRichText(item.description)}</div>
                      <div className="text-[10px] text-ghost truncate max-w-xs">{item.section_group}</div>
                    </td>
                    <td className="px-4 py-4 text-xs font-mono text-main text-right">{item.contract_qty} {cleanRichText(item.unit)}</td>
                    <td className="px-4 py-4 text-right">
                      <input 
                        type="number"
                        defaultValue={item.actual_qty || 0}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (val !== item.actual_qty) {
                            handleOverride(item.id, { 
                              actual_qty: val,
                              progress_pct: (item.contract_qty || 1) > 0 ? (val / item.contract_qty) * 100 : 0
                            });
                          }
                        }}
                        className="bg-surface-base border border-border-subtle rounded px-2 py-1 text-xs font-mono text-main w-24 text-right outline-none focus:border-primary"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <input 
                          type="number"
                          defaultValue={Math.round(item.progress_pct || 0)}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value);
                            if (val !== item.progress_pct) {
                              handleOverride(item.id, { 
                                progress_pct: val,
                                actual_qty: ((item.contract_qty || 0) * val) / 100
                              });
                            }
                          }}
                          className="bg-surface-base border border-border-subtle rounded px-2 py-1 text-xs font-mono text-main w-16 text-center outline-none focus:border-primary"
                        />
                        <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden min-w-[60px]">
                           <div className="h-full bg-primary" style={{ width: `${item.progress_pct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button className="p-1.5 text-ghost hover:text-primary transition-all">
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
          <Terminal className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-primary">Override Governance</span>
            <p className="text-[11px] text-primary/70 leading-relaxed">
              Manual overrides are logged with the executor ID and timestamp. Direct BOQ manipulation should only be performed during network isolation or to correct known survey invalidities.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const evm = useMemo(() => {
    const now = new Date();
    const bac = boqItems.reduce((acc, item) => acc + (item.contract_amount || 0), 0) || project.contract_value || 0;
    
    const ev = boqItems.reduce((acc, item) => {
      const progress = item.progress_pct || 0;
      return acc + ((item.contract_amount || 0) * (progress / 100));
    }, 0);

    const pv = boqItems.reduce((acc, item) => {
      if (item.planned_end_date && new Date(item.planned_end_date) <= now) {
        return acc + (item.contract_amount || 0);
      }
      return acc;
    }, 0);

    const ac = dailyCosts.reduce((acc, log) => acc + (log.current_total_cost || log.actual_total_cost || 0), 0);

    const cpi = ac > 0 ? ev / ac : 1;
    const spi = pv > 0 ? ev / pv : 1;
    const eac = cpi > 0 ? bac / cpi : bac;
    const vac = bac - eac;

    return { bac, ev, pv, ac, cpi, spi, eac, vac };
  }, [boqItems, dailyCosts, project.contract_value]);

  const fmt = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const renderOverallHealth = () => {
    const criticalAlerts = dailyCosts.filter(l => l.issues).length;
    const scheduleHealth = evm.spi >= 1 ? 'Healthy' : evm.spi > 0.85 ? 'Warning' : 'Critical';
    const financeHealth = evm.cpi >= 1 ? 'Within Budget' : evm.cpi > 0.9 ? 'Minor Overrun' : 'Critical Breach';

    return (
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={cn(
            "p-6 rounded-2xl border-2 flex flex-col gap-4",
            scheduleHealth === 'Healthy' ? "bg-primary/5 border-primary/20" : scheduleHealth === 'Warning' ? "bg-warning/5 border-warning/20" : "bg-danger/5 border-danger/20"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-ghost">Schedule Health</span>
              <TrendingUp className={cn("w-5 h-5", scheduleHealth === 'Healthy' ? "text-primary" : scheduleHealth === 'Warning' ? "text-warning" : "text-danger")} />
            </div>
            <div className="text-2xl font-bold text-main">{scheduleHealth}</div>
            <p className="text-[11px] text-ghost leading-relaxed">Project is currently tracking at {Math.round(evm.spi * 100)}% efficiency vs baseline schedule.</p>
          </div>

          <div className={cn(
            "p-6 rounded-2xl border-2 flex flex-col gap-4",
            evm.cpi >= 1 ? "bg-primary/5 border-primary/20" : evm.cpi > 0.9 ? "bg-warning/5 border-warning/20" : "bg-danger/5 border-danger/20"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-ghost">Financial Health</span>
              <Wallet className={cn("w-5 h-5", evm.cpi >= 1 ? "text-primary" : evm.cpi > 0.9 ? "text-warning" : "text-danger")} />
            </div>
            <div className="text-2xl font-bold text-main">{financeHealth}</div>
            <p className="text-[11px] text-ghost leading-relaxed">Current cost efficiency is {Math.round(evm.cpi * 100)}%. Estimated VAC is {fmt(evm.vac)}.</p>
          </div>

          <div className={cn(
            "p-6 rounded-2xl border-2 flex flex-col gap-4",
            criticalAlerts === 0 ? "bg-primary/5 border-primary/20" : "bg-danger/5 border-danger/20"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-ghost">Security & Risk</span>
              <ShieldAlert className={cn("w-5 h-5", criticalAlerts === 0 ? "text-primary" : "text-danger")} />
            </div>
            <div className="text-2xl font-bold text-main">{criticalAlerts} Active Alerts</div>
            <p className="text-[11px] text-ghost leading-relaxed">Site incidents and unresolved coordination risks detected in monitoring feeds.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6">
            <h3 className="text-sm font-bold text-main mb-6">Execution Adherence Breakdown</h3>
            <div className="space-y-6">
               {[
                 { label: 'BOQ Quantities', val: (evm.ev / evm.bac) * 100, color: 'bg-primary' },
                 { label: 'Time Elapsed', val: 45, color: 'bg-accent' },
                 { label: 'Budget Utilization', val: (evm.ac / evm.bac) * 100, color: 'bg-warning' }
               ].map(stat => (
                 <div key={stat.label} className="space-y-2">
                   <div className="flex justify-between text-xs font-bold">
                     <span className="text-ghost">{stat.label}</span>
                     <span className="text-main">{Math.round(stat.val)}%</span>
                   </div>
                   <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                     <div className={cn("h-full", stat.color)} style={{ width: `${stat.val}%` }} />
                   </div>
                 </div>
               ))}
            </div>
          </div>
          <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-main mb-2">Operation Highlights</h3>
            <div className="flex-1 flex flex-col gap-3">
              <div className="p-3 rounded-xl bg-surface-2 border border-border-subtle flex items-center gap-3">
                <FileCheck className="w-4 h-4 text-primary" />
                <span className="text-xs text-main">Valuations matched with site actuals</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-2 border border-border-subtle flex items-center gap-3">
                <Users className="w-4 h-4 text-accent" />
                <span className="text-xs text-main">Subcontractor evaluation scores: 85% Average</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-2 border border-border-subtle flex items-center gap-3">
                <Package className="w-4 h-4 text-warning" />
                <span className="text-xs text-main">Materials inventory: Critical items at 100% capacity</span>
              </div>
            </div>
            <button onClick={() => setActiveTab('analytics')} className="btn btn-ghost btn-sm w-full font-mono text-[10px] uppercase tracking-widest text-primary">View Full Analytics Pipeline</button>
          </div>
        </div>
      </div>
    );
  };

  const renderDetailedAnalytics = () => {
    return (
      <div className="flex flex-col gap-8 animate-in fade-in duration-500">
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-sm font-bold text-main">Performance Indices (CPI & SPI)</h3>
                  <p className="text-[10px] text-ghost mt-1 uppercase tracking-widest">Calculated earned value trends</p>
                </div>
                <div className="flex gap-4">
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-ghost uppercase block">Current CPI</span>
                    <span className={cn("text-xl font-black", evm.cpi >= 1 ? "text-primary" : "text-danger")}>{evm.cpi.toFixed(3)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-ghost uppercase block">Current SPI</span>
                    <span className={cn("text-xl font-black", evm.spi >= 1 ? "text-primary" : "text-warning")}>{evm.spi.toFixed(3)}</span>
                  </div>
                </div>
              </div>
              
              <div className="h-64 flex items-end gap-3 px-4">
                {/* Mock chart bars for trends */}
                {[0.8, 0.9, 0.85, 1.1, 1.05, 0.95, evm.cpi].map((val, idx) => (
                  <div key={idx} className="flex-1 flex flex-col gap-1 items-center">
                    <div className="w-full bg-primary/20 rounded-t-sm" style={{ height: `${val * 100}px` }} />
                    <div className="w-full bg-accent/20 rounded-t-sm" style={{ height: `${(val - 0.1) * 100}px` }} />
                    <span className="text-[8px] text-ghost mt-2 font-mono">W{idx+1}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-primary/40 rounded-sm" />
                  <span className="text-[10px] text-ghost font-bold uppercase tracking-tighter">Cost Efficiency</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-accent/40 rounded-sm" />
                  <span className="text-[10px] text-ghost font-bold uppercase tracking-tighter">Schedule Sync</span>
                </div>
              </div>
            </div>

            <div className="bg-surface-1 border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 bg-surface-2 border-b border-border-subtle">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-main">Profit & Loss Simulation (P&L)</h3>
                </div>
                <div className="p-6">
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                     <div className="flex flex-col gap-1">
                       <span className="text-[10px] text-ghost font-mono uppercase">Revenue (Earned)</span>
                       <span className="text-lg font-bold text-main">{fmt(evm.ev)}</span>
                     </div>
                     <div className="flex flex-col gap-1">
                       <span className="text-[10px] text-ghost font-mono uppercase">Direct Costs</span>
                       <span className="text-lg font-bold text-danger">{fmt(evm.ac)}</span>
                     </div>
                     <div className="flex flex-col gap-1">
                       <span className="text-[10px] text-ghost font-mono uppercase">Gross Margin</span>
                       <span className={cn("text-lg font-bold", (evm.ev - evm.ac) < 0 ? "text-danger" : "text-primary")}>
                         {fmt(evm.ev - evm.ac)}
                       </span>
                     </div>
                     <div className="flex flex-col gap-1">
                       <span className="text-[10px] text-ghost font-mono uppercase">Margin %</span>
                       <span className={cn("text-lg font-bold", (evm.ev - evm.ac) < 0 ? "text-danger" : "text-primary")}>
                         {evm.ev > 0 ? (((evm.ev - evm.ac) / evm.ev) * 100).toFixed(1) : 0}%
                       </span>
                     </div>
                   </div>
                </div>
            </div>
          </div>

          <div className="space-y-6">
             <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-ghost mb-6">Earned Value Primitives</h3>
                <div className="space-y-5">
                   {[
                     { label: 'PV (Planned Value)', val: evm.pv, desc: 'What we should have done by today' },
                     { label: 'EV (Earned Value)', val: evm.ev, desc: 'Value of work actually completed' },
                     { label: 'AC (Actual Cost)', val: evm.ac, desc: 'Total cost incurred to date' },
                     { label: 'BAC (Budget baseline)', val: evm.bac, desc: 'Total original project budget' }
                   ].map(item => (
                     <div key={item.label} className="flex flex-col gap-1 border-b border-border-subtle pb-3 last:border-0 last:pb-0">
                       <div className="flex justify-between items-center">
                         <span className="text-xs font-bold text-main">{item.label}</span>
                         <span className="text-xs font-mono font-bold text-ghost">{fmt(item.val)}</span>
                       </div>
                       <p className="text-[9px] text-ghost italic">{item.desc}</p>
                     </div>
                   ))}
                </div>
             </div>

             <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6 bg-gradient-to-br from-primary/5 to-transparent">
               <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-4">Forecasting Radar</h3>
               <div className="space-y-4">
                 <div className="p-3 bg-surface-base/50 rounded-xl border border-primary/10">
                    <span className="text-[10px] uppercase font-bold text-primary block mb-1">EAC (Projected Total)</span>
                    <div className="text-2xl font-black text-main font-mono">{fmt(evm.eac)}</div>
                    <p className="text-[10px] text-ghost mt-2">Based on current performance trends (CPI factor)</p>
                 </div>
                 <div className="p-3 bg-surface-base/50 rounded-xl border border-primary/10">
                    <span className="text-[10px] uppercase font-bold text-primary block mb-1">VAC (Estimated Variance)</span>
                    <div className={cn("text-2xl font-black font-mono", evm.vac >= 0 ? "text-primary" : "text-danger")}>
                      {evm.vac >= 0 ? '+' : ''}{fmt(evm.vac)}
                    </div>
                    <p className="text-[10px] text-ghost mt-2">Expected total {evm.vac >= 0 ? 'saving' : 'loss'} at handover</p>
                 </div>
               </div>
             </div>
          </div>
        </section>
      </div>
    );
  };

  const renderSubcontractorsSection = () => {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-main flex items-center gap-2">
              <Users className="w-5 h-5 text-accent" />
              Subcontractor Lifecycle Hub
            </h2>
            <p className="text-xs text-ghost">Execution tracking, evaluation matrix and resource efficiency</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-surface-1 border border-border-subtle rounded-xl p-5">
              <div className="text-[10px] font-black uppercase text-ghost mb-4 tracking-widest">Active Capacity</div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-main">84%</span>
                <span className="text-[10px] text-primary font-bold mb-1 uppercase">+4% vs LW</span>
              </div>
              <div className="h-1.5 bg-surface-2 rounded-full mt-4 overflow-hidden">
                <div className="h-full bg-primary" style={{ width: '84%' }} />
              </div>
           </div>
           <div className="bg-surface-1 border border-border-subtle rounded-xl p-5">
              <div className="text-[10px] font-black uppercase text-ghost mb-4 tracking-widest">Idle Labor Hours</div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-danger">124h</span>
                <span className="text-[10px] text-danger font-bold mb-1 uppercase">Attention</span>
              </div>
              <div className="h-1.5 bg-surface-2 rounded-full mt-4 overflow-hidden">
                <div className="h-full bg-danger" style={{ width: '25%' }} />
              </div>
           </div>
           <div className="bg-surface-1 border border-border-subtle rounded-xl p-5">
              <div className="text-[10px] font-black uppercase text-ghost mb-4 tracking-widest">Quality Audit Score</div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-primary">4.2</span>
                <span className="text-[10px] text-ghost font-bold mb-1 uppercase">/ 5.0</span>
              </div>
              <div className="h-1.5 bg-surface-2 rounded-full mt-4 overflow-hidden">
                <div className="h-full bg-primary" style={{ width: '84%' }} />
              </div>
           </div>
        </div>

        <SubcontractorProgress projectId={project.id} />
      </div>
    );
  };

  const renderRisks = () => {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-main flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-danger" />
              Project Risk Feed
            </h2>
            <p className="text-xs text-ghost">Real-time threat detection from site and environmental factors</p>
          </div>
          <button className="btn btn-primary btn-sm rounded-xl">Register New Risk</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
           <div className="lg:col-span-1 space-y-4">
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5">
                 <h3 className="text-xs font-bold text-ghost uppercase tracking-widest mb-6">Risk Heatmap</h3>
                 <div className="aspect-square bg-surface-2 rounded-lg border border-border-subtle relative overflow-hidden flex flex-col items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-danger/10" />
                    <div className="text-center font-mono font-black text-main z-10">
                      <div className="text-3xl">ZONE C</div>
                      <div className="text-[10px] text-danger mt-1 uppercase">Active Incidents</div>
                    </div>
                 </div>
                 <div className="mt-4 grid grid-cols-2 gap-2">
                   <div className="p-2 rounded bg-danger/10 border border-danger/20 text-[10px] font-bold text-danger text-center">HIGH: 4</div>
                   <div className="p-2 rounded bg-warning/10 border border-warning/20 text-[10px] font-bold text-warning text-center">MED: 12</div>
                 </div>
              </div>
           </div>
           
           <div className="lg:col-span-3 space-y-4">
              {dailyCosts.filter(l => l.issues).length === 0 ? (
                <div className="py-32 text-center bg-surface-1 border border-dashed border-border-subtle rounded-2xl">
                   <MonitorCheck className="w-12 h-12 text-border-subtle mx-auto mb-4" />
                   <h3 className="text-base font-bold text-main">Zero Active Site Risks</h3>
                   <p className="text-xs text-ghost mt-2">Project perimeter and execution controls show no anomalies.</p>
                </div>
              ) : dailyCosts.filter(l => l.issues).map((issue, idx) => (
                <div key={idx} className="bg-surface-1 border border-border-subtle rounded-2xl p-5 flex items-start gap-5 hover:border-danger/30 transition-all">
                   <div className="w-12 h-12 rounded-2xl bg-danger/10 flex items-center justify-center shrink-0 text-danger">
                      <AlertTriangle className="w-6 h-6" />
                   </div>
                   <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                         <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black uppercase tracking-widest text-danger">Site Incident</span>
                           <span className="w-1 h-1 rounded-full bg-border-subtle" />
                           <span className="text-[10px] font-mono text-ghost">{issue.report_date}</span>
                         </div>
                         <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-2 border border-border-subtle text-[9px] font-bold text-ghost">
                           UNRESOLVED
                         </div>
                      </div>
                      <h4 className="text-sm font-bold text-main mb-1">Execution Delay Detected</h4>
                      <p className="text-xs text-dim leading-relaxed mb-4">{issue.issues}</p>
                      <div className="flex items-center gap-4 border-t border-border-subtle pt-4 mt-4">
                         <button className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Acknowledge</button>
                         <button className="text-[10px] font-black uppercase tracking-widest text-ghost hover:text-main">Assigned to PM</button>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    );
  };

  const renderSiteControl = () => {
    return (
      <div className="flex flex-col gap-10 animate-in fade-in duration-500">
        {/* Site App Office Access - Integrated Control */}
        <section className="bg-surface-1 border border-border-subtle rounded-3xl overflow-hidden shadow-xl">
           <div className="p-4 bg-surface-2 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-bold text-main">Live Site App Control (Office Access)</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] font-bold text-ghost uppercase tracking-widest">Active Remote Link</span>
              </div>
           </div>
           <div className="p-6">
              <SiteApp project={project} tenantId={tenantId} />
           </div>
        </section>

        {/* APK Deployment & Distribution */}
        <section className="bg-surface-1 border border-border-subtle rounded-3xl p-10 flex flex-col lg:flex-row items-center gap-12 text-center lg:text-left relative overflow-hidden bg-gradient-to-br from-primary/5 to-transparent">
          <div className="absolute top-0 right-0 p-12 opacity-5">
             <Smartphone className="w-64 h-64 text-primary" />
          </div>
          
          <div className="relative z-10 flex-1 space-y-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest">
                Latest Build: PrecisionSite_v2.4.1.apk
              </div>
              <h2 className="text-4xl font-black text-main tracking-tight leading-none">Field Deployment Hub</h2>
              <p className="text-dim text-lg max-w-lg leading-relaxed">
                Download the enterprise binary for local site teams. Supports full offline quantity surveying and labor logging.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
               <button 
                 onClick={() => {
                   const link = document.createElement('a');
                   link.href = '#';
                   link.download = `PrecisionSite_v2.4.1_${project.id}.apk`;
                   alert('Step 1: Upload your APK binary to Supabase Storage or your preferred CDN.\nStep 2: Update the link.href in this component to point to the secure URL.\nStep 3: Ensure the build signature MD5 matches your local build.');
                 }}
                 className="btn btn-primary h-14 px-10 rounded-2xl text-base font-bold shadow-xl shadow-primary/20 flex items-center gap-3 transition-transform hover:scale-[1.02]"
               >
                 <Download className="w-6 h-6" />
                 Download Production APK
               </button>
               <div className="text-left py-2 px-4 border-l border-border-subtle">
                 <div className="text-[10px] text-ghost font-bold uppercase tracking-widest">Build Signature</div>
                 <code className="text-[10px] text-main font-mono">MD5: AF8E...3B71</code>
               </div>
            </div>

            <div className="bg-surface-2 p-6 rounded-2xl border border-border-subtle">
               <h4 className="text-[11px] font-black uppercase tracking-widest text-main mb-4">APK Build & Distribution Guide</h4>
               <div className="space-y-4">
                 <div className="bg-surface-base p-4 rounded-xl border border-border-subtle">
                    <h5 className="text-[10px] font-black text-primary uppercase mb-2">Step 1: PWA Verification</h5>
                    <p className="text-[10px] text-dim leading-relaxed">Ensure <code className="bg-surface-2 px-1">manifest.json</code> and icons are present in <code className="bg-surface-2 px-1">/public</code>. This allows the app to be "installed" directly from the browser on Android/iOS without an APK.</p>
                 </div>
                 
                 <div className="bg-surface-base p-4 rounded-xl border border-border-subtle">
                    <h5 className="text-[10px] font-black text-accent uppercase mb-2">Step 2: Generate APK via Capacitor</h5>
                    <div className="space-y-1.5 font-mono text-[9px] text-main">
                       <div>1. npm install @capacitor/core @capacitor/cli</div>
                       <div>2. npx cap init "PrecisionSite" "com.ceflot.field"</div>
                       <div>3. npm run build</div>
                       <div>4. npx cap add android</div>
                       <div>5. npx cap copy</div>
                       <div>6. npx cap open android (Android Studio)</div>
                    </div>
                 </div>

                 <div className="bg-surface-base p-4 rounded-xl border border-border-subtle">
                    <h5 className="text-[10px] font-black text-warning uppercase mb-2">Step 3: Host on Supabase Storage</h5>
                    <p className="text-[10px] text-dim leading-relaxed">In your Supabase Dashboard, create a public bucket <code className="bg-surface-2 px-1">site-binaries</code>. Upload your signed and aligned <code className="bg-surface-2 px-1">.apk</code>. Copy the Public URL.</p>
                 </div>

                 <div className="bg-surface-base p-4 rounded-xl border border-border-subtle">
                    <h5 className="text-[10px] font-black text-main uppercase mb-2">Step 4: Update Download Link</h5>
                    <p className="text-[10px] text-dim leading-relaxed">Edit <code className="bg-surface-2 px-1">OperationsHub.tsx</code> line 591 and replace <code className="bg-surface-2 px-1">"#"</code> with your copied URL. Site teams can then download via the button above.</p>
                 </div>
               </div>
            </div>
          </div>

          <div className="w-full lg:w-72 bg-surface-2 rounded-2xl border border-border-subtle p-6 space-y-6 shadow-lg shadow-black/10">
             <h4 className="text-xs font-black uppercase tracking-widest text-ghost text-center border-b border-border-subtle pb-4">Onboarding Parameters</h4>
             <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                   <label className="text-[10px] font-bold text-ghost uppercase tracking-tighter">Tenant Hub ID</label>
                   <input type="text" readOnly value={tenantId} className="w-full bg-surface-base border border-border-subtle rounded-lg p-2.5 text-[10px] font-mono text-dim select-all" />
                </div>
                <div className="flex flex-col gap-1.5">
                   <label className="text-[10px] font-bold text-ghost uppercase tracking-tighter">Project Node</label>
                   <input type="text" readOnly value={project.id} className="w-full bg-surface-base border border-border-subtle rounded-lg p-2.5 text-[10px] font-mono text-dim select-all" />
                </div>
                <div className="flex flex-col gap-1.5">
                   <label className="text-[10px] font-bold text-ghost uppercase tracking-tighter">API Endpoint</label>
                   <input type="text" readOnly value="https://api.v2.construction.hub" className="w-full bg-surface-base border border-border-subtle rounded-lg p-2.5 text-[10px] font-mono text-dim select-all" />
                </div>
             </div>
             <p className="text-[9px] text-ghost text-center leading-tight">Teams must scan these or paste them into the app login screen for biometric auth activation.</p>
          </div>
        </section>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black tracking-tight text-main">Operations Control</h1>
            <div className="px-2 py-0.5 rounded bg-surface-2 border border-border-subtle text-[11px] font-bold font-mono text-ghost uppercase">
              Live Hub
            </div>
          </div>
          <p className="text-sm text-dim max-w-lg leading-relaxed">
            Real-time oversight, earned value metrics, and site execution monitoring for {project.name}.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <TabBar 
            tabs={[
              { id: 'overview', label: 'Overall Health', icon: Gauge },
              { id: 'execution', label: 'Execution Controls', icon: Database },
              { id: 'analytics', label: 'EVM & Analytics', icon: BarChart3 },
              { id: 'subcontractors', label: 'Subcontractors', icon: Users },
              { id: 'risks', label: 'Risk Feed', icon: ShieldAlert },
              { id: 'site_control', label: 'Site App Control', icon: Smartphone },
              { id: 'payments', label: 'Payments', icon: CreditCard },
              { id: 'financials', label: 'Financial Reports', icon: PieChart }
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
          
          <div className="h-8 w-px bg-border-subtle mx-2" />
          
          <button onClick={loadActualData} className="btn btn-secondary btn-sm h-10 w-10 p-0 rounded-xl">
             <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </header>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : activeTab === 'overview' ? (
        renderOverallHealth()
      ) : activeTab === 'execution' ? (
        renderExecutionControls()
      ) : activeTab === 'analytics' ? (
        renderDetailedAnalytics()
      ) : activeTab === 'subcontractors' ? (
        renderSubcontractorsSection()
      ) : activeTab === 'risks' ? (
        renderRisks()
      ) : activeTab === 'site_control' ? (
        renderSiteControl()
      ) : activeTab === 'payments' ? (
        <PaymentCertificateManager projectId={project.id} tenantId={tenantId} />
      ) : activeTab === 'financials' ? (
        <FinancialDashboard projectId={project.id} />
      ) : null}
    </div>
  );
}
