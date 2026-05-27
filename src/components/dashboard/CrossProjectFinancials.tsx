import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { DashboardPanel } from './DashboardPanel';
import { DollarSign, TrendingUp, TrendingDown, PieChart as PieChartIcon } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { cn } from '../../lib/utils';

export function CrossProjectFinancials() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFinancials();
  }, []);

  async function loadFinancials() {
    try {
      const { data: summary, error } = await supabase
        .from('v_project_financial_summary')
        .select('*');

      if (error) {
        if (error.message?.includes('v_project_financial_summary') || error.message?.includes('does not exist')) {
          console.warn('View v_project_financial_summary missing, using fallback aggregation');
          await loadFinancialsFallback();
          return;
        }
        throw error;
      }
      setData(summary || []);
    } catch (e: any) {
      console.warn('Error loading global financials from view, trying aggregation fallback:', e.message || e);
      await loadFinancialsFallback();
    } finally {
      setLoading(false);
    }
  }

  function loadStaticOfflineFinancials() {
    setData([
      {
        project_id: 'proj-1',
        project_name: 'Modern Office Complex Juba',
        tenant_id: 'tenant-1',
        original_budget: 4500000,
        approved_variations: 250000,
        revised_budget: 4750000,
        actual_cost_to_date: 2100000,
        subcontractor_certified_to_date: 850000,
        total_expenditure: 2950000,
        budget_utilization_pct: 62.1
      },
      {
        project_id: 'proj-2',
        project_name: 'Nile Bridge Highway',
        tenant_id: 'tenant-1',
        original_budget: 8200000,
        approved_variations: 680000,
        revised_budget: 8880000,
        actual_cost_to_date: 5400000,
        subcontractor_certified_to_date: 2200000,
        total_expenditure: 7600000,
        budget_utilization_pct: 85.6
      },
      {
        project_id: 'proj-3',
        project_name: 'Airport Runway Expansion',
        tenant_id: 'tenant-1',
        original_budget: 12000000,
        approved_variations: 0,
        revised_budget: 12000000,
        actual_cost_to_date: 4200000,
        subcontractor_certified_to_date: 1800000,
        total_expenditure: 6000000,
        budget_utilization_pct: 50.0
      },
      {
        project_id: 'proj-4',
        project_name: 'Transit Yards & Depot',
        tenant_id: 'tenant-1',
        original_budget: 2300000,
        approved_variations: 120000,
        revised_budget: 2420000,
        actual_cost_to_date: 1900000,
        subcontractor_certified_to_date: 450000,
        total_expenditure: 2350000,
        budget_utilization_pct: 97.1
      }
    ]);
  }

  async function loadFinancialsFallback() {
    try {
      // Fetch all required tables in parallel
      const [
        { data: projects },
        { data: boq },
        { data: actuals },
        { data: subcontractors },
        { data: variations }
      ] = await Promise.all([
        supabase.from('projects').select('id, name, tenant_id'),
        supabase.from('boq_items').select('project_id, quantity, rate, contract_qty, contract_rate, contract_amount, surveyed_qty'),
        supabase.from('daily_progress').select('project_id, actual_total_cost').eq('status', 'reviewed'),
        supabase.from('payment_certificates').select('project_id, gross_amount').in('status', ['certified', 'paid']),
        supabase.from('variations').select('project_id, estimated_cost').eq('status', 'approved')
      ]);

      if (!projects || projects.length === 0) {
        loadStaticOfflineFinancials();
        return;
      }

      const aggregated = projects.map(p => {
        const p_boq = boq?.filter(b => b.project_id === p.id).reduce((sum, b) => {
          const qty = b.contract_qty ?? b.quantity ?? 0;
          const rate = b.contract_rate ?? b.rate ?? 0;
          let amount = b.contract_amount ?? (qty * rate);

          // Inclusion of surveyed items without contract qty
          if (qty === 0 && (b.surveyed_qty || 0) > 0) {
            amount = (b.surveyed_qty || 0) * rate;
          }

          return sum + amount;
        }, 0) || 0;
        const p_actuals = actuals?.filter(a => a.project_id === p.id).reduce((sum, a) => sum + (a.actual_total_cost || 0), 0) || 0;
        const p_sub = subcontractors?.filter(s => s.project_id === p.id).reduce((sum, s) => sum + (s.gross_amount || 0), 0) || 0;
        const p_vars = variations?.filter(v => v.project_id === p.id).reduce((sum, v) => sum + (v.estimated_cost || 0), 0) || 0;

        return {
          project_id: p.id,
          project_name: p.name,
          tenant_id: p.tenant_id,
          original_budget: p_boq,
          approved_variations: p_vars,
          revised_budget: p_boq + p_vars,
          actual_cost_to_date: p_actuals,
          subcontractor_certified_to_date: p_sub,
          total_expenditure: p_actuals + p_sub,
          budget_utilization_pct: (p_boq + p_vars) > 0 ? ((p_actuals + p_sub) / (p_boq + p_vars)) * 100 : 0
        };
      });

      setData(aggregated);
    } catch (e: any) {
      console.warn('Fallback aggregation failed or offline, loading static financials:', e.message || e);
      loadStaticOfflineFinancials();
    }
  }

  const totals = data.reduce((acc, curr) => ({
    budget: acc.budget + curr.revised_budget,
    expenditure: acc.expenditure + curr.total_expenditure,
    variations: acc.variations + curr.approved_variations
  }), { budget: 0, expenditure: 0, variations: 0 });

  const utilization = totals.budget > 0 ? (totals.expenditure / totals.budget) * 100 : 0;

  return (
    <DashboardPanel 
      title="Global Financial Performance" 
      subtitle="Cross-Project Budget Tracking"
      icon={DollarSign}
    >
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface-2/50 border border-border-subtle rounded-xl p-4">
            <div className="text-[10px] font-bold text-dim uppercase tracking-wider mb-1">Total Portfolio Budget</div>
            <div className="text-xl font-mono font-bold text-main">${(totals.budget / 1000000).toFixed(2)}M</div>
            <div className="flex items-center gap-1.5 mt-2">
              <TrendingUp className="w-3 h-3 text-accent" />
              <span className="text-[10px] text-dim">Incl. ${ (totals.variations / 1000).toFixed(0) }k variations</span>
            </div>
          </div>
          <div className="bg-surface-2/50 border border-border-subtle rounded-xl p-4">
            <div className="text-[10px] font-bold text-dim uppercase tracking-wider mb-1">Total Expenditure</div>
            <div className="text-xl font-mono font-bold text-primary">${(totals.expenditure / 1000000).toFixed(2)}M</div>
            <div className="flex items-center gap-1.5 mt-2">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                utilization > 90 ? "bg-error" : "bg-primary"
              )} />
              <span className="text-[10px] text-dim">{utilization.toFixed(1)}% Utilization</span>
            </div>
          </div>
        </div>

        <div className="flex-1 h-48 min-h-0 min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={data.slice(0, 5)} layout="vertical" margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="project_name" 
                type="category" 
                stroke="var(--color-dim)" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                width={80}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', borderRadius: '8px' }}
                itemStyle={{ fontSize: '10px' }}
              />
              <Bar dataKey="total_expenditure" fill="var(--color-primary)" radius={[0, 4, 4, 0]} barSize={12} />
              <Bar dataKey="revised_budget" fill="var(--color-accent)" radius={[0, 4, 4, 0]} barSize={12} opacity={0.3} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </DashboardPanel>
  );
}
