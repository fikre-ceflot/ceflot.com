import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { DashboardPanel } from './DashboardPanel';
import { 
  BarChart3, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText, 
  DollarSign,
  ArrowUpRight,
  Camera,
  Download,
  GitBranch as GitBranchIcon
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip
} from 'recharts';
import { cn } from '../../lib/utils';

interface ClientPortalProps {
  tenantId: string;
  projectId?: string;
}

export function ClientPortal({ tenantId, projectId }: ClientPortalProps) {
  const [summary, setSummary] = useState<any>(null);
  const [variations, setVariations] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [tenantId, projectId]);

  async function loadData() {
    setLoading(true);
    try {
      // 1. Load Client Project Overview
      let overviewQuery = supabase.from('v_client_project_overview').select('*');
      if (projectId) {
        overviewQuery = overviewQuery.eq('project_id', projectId);
      }
      const { data: oData, error: oError } = await overviewQuery.maybeSingle();
      if (oError) throw oError;
      setSummary(oData);

      // 2. Load Variations
      let varQuery = supabase.from('variations').select('*').eq('tenant_id', tenantId);
      if (projectId) varQuery = varQuery.eq('project_id', projectId);
      const { data: vData } = await varQuery.order('created_at', { ascending: false }).limit(5);
      setVariations(vData || []);

      // 3. Load Certificates
      let certQuery = supabase.from('client_certificates').select('*').eq('tenant_id', tenantId);
      if (projectId) certQuery = certQuery.eq('project_id', projectId);
      const { data: cData } = await certQuery.order('period_end', { ascending: false }).limit(5);
      setCertificates(cData || []);

    } catch (e: any) {
      console.error('Error loading client portal data:', e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-dim">Loading Client Portal...</div>;
  if (!summary) return <div className="p-8 text-center text-dim">No project data found.</div>;

  const progressData = [
    { name: 'Completed', value: summary.progress_pct },
    { name: 'Remaining', value: 100 - summary.progress_pct }
  ];

  const COLORS = ['var(--color-primary)', 'var(--color-surface-2)'];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-main">Client Portal</h1>
          <p className="text-sm text-ghost">Real-time project oversight and financial transparency</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-surface-1 border border-border-subtle rounded-xl flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-bold text-main uppercase tracking-widest">Live Sync</span>
          </div>
        </div>
      </div>

      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-1 border border-border-subtle p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Active</span>
          </div>
          <div className="text-[10px] font-bold text-dim uppercase tracking-widest mb-1">Contract Value</div>
          <div className="text-xl font-black text-main">${summary.revised_contract_value.toLocaleString()}</div>
          <div className="mt-2 text-[10px] text-dim">Incl. ${summary.approved_variations_value.toLocaleString()} variations</div>
        </div>

        <div className="bg-surface-1 border border-border-subtle p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold text-main">{summary.progress_pct.toFixed(1)}%</div>
          </div>
          <div className="text-[10px] font-bold text-dim uppercase tracking-widest mb-1">Physical Progress</div>
          <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-primary" style={{ width: `${summary.progress_pct}%` }} />
          </div>
          <div className="mt-2 text-[10px] text-dim">Based on site execution</div>
        </div>

        <div className="bg-surface-1 border border-border-subtle p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center text-warning">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="text-[10px] font-bold text-dim uppercase tracking-widest mb-1">Certified to Date</div>
          <div className="text-xl font-black text-main">${summary.amount_certified.toLocaleString()}</div>
          <div className="mt-2 text-[10px] text-dim">{summary.revised_contract_value > 0 ? ((summary.amount_certified / summary.revised_contract_value) * 100).toFixed(1) : 0}% of contract</div>
        </div>

        <div className="bg-surface-1 border border-border-subtle p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center text-accent-blue">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-[10px] font-bold text-dim uppercase tracking-widest mb-1">Paid to Date</div>
          <div className="text-xl font-black text-main">${summary.amount_paid.toLocaleString()}</div>
          <div className="mt-2 text-[10px] text-dim">${(summary.amount_certified - summary.amount_paid).toLocaleString()} outstanding</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress Visualization */}
        <DashboardPanel 
          title="Project Execution" 
          subtitle="Physical vs Financial Progress"
          icon={BarChart3}
        >
          <div className="h-64 flex items-center justify-center relative">
            <ResponsiveContainer width="99%" height="100%" minWidth={0}>
              <PieChart>
                <Pie
                  data={progressData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {progressData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-black text-main">{summary.progress_pct.toFixed(0)}%</span>
              <span className="text-[10px] text-dim uppercase font-bold">Complete</span>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-dim">Scheduled Finish</span>
              <span className="text-main font-bold">Oct 24, 2026</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-dim">Days Elapsed</span>
              <span className="text-main font-bold">142 / 365</span>
            </div>
          </div>
        </DashboardPanel>

        {/* Financial History */}
        <DashboardPanel 
          title="Payment Certificates" 
          subtitle="Recent Billing History"
          icon={FileText}
          className="lg:col-span-2"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="px-2 py-3 text-[10px] font-bold text-dim uppercase tracking-wider">Ref No</th>
                  <th className="px-2 py-3 text-[10px] font-bold text-dim uppercase tracking-wider">Period End</th>
                  <th className="px-2 py-3 text-[10px] font-bold text-dim uppercase tracking-wider">Gross Amount</th>
                  <th className="px-2 py-3 text-[10px] font-bold text-dim uppercase tracking-wider">Status</th>
                  <th className="px-2 py-3 text-[10px] font-bold text-dim uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {certificates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-8 text-center text-xs text-dim italic">No certificates issued yet</td>
                  </tr>
                ) : (
                  certificates.map((cert) => (
                    <tr key={cert.id} className="hover:bg-surface-2/50 transition-colors">
                      <td className="px-2 py-3">
                        <span className="text-xs font-bold text-main">{cert.certificate_no}</span>
                      </td>
                      <td className="px-2 py-3">
                        <span className="text-xs text-dim">{new Date(cert.period_end).toLocaleDateString()}</span>
                      </td>
                      <td className="px-2 py-3">
                        <span className="text-xs font-mono text-main">${cert.gross_amount.toLocaleString()}</span>
                      </td>
                      <td className="px-2 py-3">
                        <div className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
                          cert.status === 'paid' ? "bg-primary/10 text-primary border-primary/20" :
                          cert.status === 'certified' ? "bg-accent/10 text-accent border-accent/20" :
                          "bg-warning/10 text-warning border-warning/20"
                        )}>
                          {cert.status}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <button className="p-1.5 text-accent hover:bg-accent/10 rounded-lg transition-all">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DashboardPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Variations */}
        <DashboardPanel 
          title="Contract Variations" 
          subtitle="Approved Changes to Scope"
          icon={GitBranchIcon}
        >
          <div className="flex flex-col gap-3">
            {variations.length === 0 ? (
              <div className="py-8 text-center text-xs text-dim italic">No variations recorded</div>
            ) : (
              variations.map((v) => (
                <div key={v.id} className="p-3 bg-surface-2 border border-border-subtle rounded-xl flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-main">{v.title}</span>
                    <span className="text-[10px] text-dim">{v.reference_no}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-mono text-main">${v.estimated_cost.toLocaleString()}</span>
                    <div className={cn(
                      "text-[9px] font-bold uppercase",
                      v.status === 'approved' ? "text-primary" : "text-warning"
                    )}>
                      {v.status}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DashboardPanel>

        {/* Site Updates */}
        <DashboardPanel 
          title="Site Updates" 
          subtitle="Latest Progress Photos & Reports"
          icon={Camera}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="aspect-video bg-surface-2 rounded-xl border border-border-subtle flex items-center justify-center relative overflow-hidden group cursor-pointer">
              <img 
                src="https://picsum.photos/seed/construction1/400/300" 
                alt="Site view" 
                className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-[9px] text-white font-bold">Foundation Pour</div>
            </div>
            <div className="aspect-video bg-surface-2 rounded-xl border border-border-subtle flex items-center justify-center relative overflow-hidden group cursor-pointer">
              <img 
                src="https://picsum.photos/seed/construction2/400/300" 
                alt="Site view" 
                className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-[9px] text-white font-bold">Steel Fixing</div>
            </div>
          </div>
          <div className="mt-4 p-4 bg-surface-2 border border-border-subtle rounded-xl">
             <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-accent" />
                <span className="text-xs font-bold text-main">Latest Site Note</span>
             </div>
             <p className="text-[11px] text-ghost italic leading-relaxed">
               "Foundation pour for Sector A completed successfully. Steel fixing for Sector B columns in progress. Weather conditions favorable."
             </p>
             <div className="mt-2 text-[9px] text-dim text-right">— Site Manager, 2 hours ago</div>
          </div>
        </DashboardPanel>
      </div>
    </div>
  );
}
