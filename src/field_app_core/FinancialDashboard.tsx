import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart as PieChartIcon, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Layers,
  Briefcase
} from 'lucide-react';
import { cn } from './utils';

interface FinancialDashboardProps {
  projectId: string;
}

export function FinancialDashboard({ projectId }: FinancialDashboardProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFinancialData();
  }, [projectId]);

  async function loadFinancialData() {
    setLoading(true);
    try {
      const { data: summary, error } = await supabase
        .from('v_project_financial_summary')
        .select('*')
        .eq('project_id', projectId)
        .single();

      if (error) {
        if (error.message?.includes('v_project_financial_summary') || error.message?.includes('does not exist')) {
          console.warn('View v_project_financial_summary missing, using fallback aggregation');
          await loadFinancialDataFallback();
          return;
        }
        throw error;
      }
      setData(summary);
    } catch (e: any) {
      console.error('Error loading financial summary:', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadFinancialDataFallback() {
    try {
      const [
        { data: project },
        { data: boq },
        { data: actuals },
        { data: subcontractors },
        { data: variations }
      ] = await Promise.all([
        supabase.from('projects').select('id, name').eq('id', projectId).single(),
        supabase.from('boq_items').select('quantity, rate, contract_qty, contract_rate, contract_amount, surveyed_qty').eq('project_id', projectId),
        supabase.from('daily_progress').select('actual_total_cost').eq('project_id', projectId).eq('status', 'reviewed'),
        supabase.from('payment_certificates').select('gross_amount').eq('project_id', projectId).in('status', ['certified', 'paid']),
        supabase.from('variations').select('estimated_cost').eq('project_id', projectId).eq('status', 'approved')
      ]);

      if (!project) return;

      const p_boq = boq?.reduce((sum, b) => {
        const qty = b.contract_qty ?? b.quantity ?? 0;
        const rate = b.contract_rate ?? b.rate ?? 0;
        let amount = b.contract_amount ?? (qty * rate);
        
        // If contract is 0 but surveyed is > 0, include in total using contract_rate
        if (qty === 0 && (b.surveyed_qty || 0) > 0) {
          amount = (b.surveyed_qty || 0) * rate;
        }
        
        return sum + amount;
      }, 0) || 0;
      const p_actuals = actuals?.reduce((sum, a) => sum + (a.actual_total_cost || 0), 0) || 0;
      const p_sub = subcontractors?.reduce((sum, s) => sum + (s.gross_amount || 0), 0) || 0;
      const p_vars = variations?.reduce((sum, v) => sum + (v.estimated_cost || 0), 0) || 0;

      setData({
        project_id: project.id,
        project_name: project.name,
        original_budget: p_boq,
        approved_variations: p_vars,
        revised_budget: p_boq + p_vars,
        actual_cost_to_date: p_actuals,
        subcontractor_certified_to_date: p_sub,
        total_expenditure: p_actuals + p_sub,
        budget_utilization_pct: (p_boq + p_vars) > 0 ? ((p_actuals + p_sub) / (p_boq + p_vars)) * 100 : 0
      });
    } catch (e: any) {
      console.error('Fallback aggregation failed:', e.message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-surface-1 border border-border-subtle rounded-xl p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-warning opacity-20 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-main">Financial Data Unavailable</h3>
        <p className="text-sm text-[#a3abb8] mt-2">Could not load financial summary for this project. Ensure all migrations are applied.</p>
      </div>
    );
  }

  const chartData = [
    { name: 'Original Budget', value: data.original_budget, color: 'var(--color-ghost)' },
    { name: 'Revised Budget', value: data.revised_budget, color: 'var(--color-info)' },
    { name: 'Total Expenditure', value: data.total_expenditure, color: data.total_expenditure > data.revised_budget ? 'var(--color-error)' : 'var(--color-primary)' }
  ];

  const expenditureBreakdown = [
    { name: 'Site Actuals', value: data.actual_cost_to_date, color: 'var(--color-primary)' },
    { name: 'Subcontractors', value: data.subcontractor_certified_to_date, color: 'var(--color-warning)' }
  ];

  return (
    <div className="flex flex-col gap-6 text-main">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-main">Project Financial Dashboard</h2>
          <p className="text-sm text-dim">Real-time budget tracking and expenditure analysis</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 border border-border-subtle rounded-lg">
          <Target className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-main">Utilization: {data.budget_utilization_pct.toFixed(1)}%</span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Revised Budget', value: data.revised_budget, icon: Briefcase, color: 'text-info', trend: 'Total including variations' },
          { label: 'Total Expenditure', value: data.total_expenditure, icon: DollarSign, color: 'text-primary', trend: 'Actuals + Certified' },
          { label: 'Approved Variations', value: data.approved_variations, icon: Layers, color: 'text-warning', trend: 'Additional scope' },
          { label: 'Remaining Budget', value: data.revised_budget - data.total_expenditure, icon: TrendingUp, color: 'text-dim', trend: 'Available funds' },
        ].map((stat, i) => (
          <div key={i} className="bg-surface-1 border border-border-subtle rounded-xl p-5 flex flex-col gap-3 transition-colors hover:bg-surface-2/50 group">
            <div className="flex items-center justify-between">
              <div className={cn("w-10 h-10 rounded-lg bg-surface-base flex items-center justify-center transition-transform group-hover:scale-110", stat.color)}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div className="text-[10px] font-bold text-dim uppercase tracking-wider">{stat.label}</div>
            </div>
            <div>
              <div className="text-2xl font-mono font-bold text-main">${stat.value.toLocaleString()}</div>
              <div className="text-[10px] text-ghost mt-1">{stat.trend}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Budget vs Expenditure Chart */}
        <div className="lg:col-span-2 bg-surface-1 border border-border-subtle rounded-xl p-6">
          <h3 className="text-sm font-bold text-main mb-6">Budget Comparison</h3>
          <div className="h-80">
            <ResponsiveContainer width="99%" height="100%" minWidth={0}>
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="var(--color-dim)" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="var(--color-dim)" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  cursor={{ fill: 'var(--color-main)', opacity: 0.05 }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={60}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expenditure Breakdown */}
        <div className="bg-surface-1 border border-border-subtle rounded-xl p-6 flex flex-col min-h-0 overflow-hidden">
          <h3 className="text-sm font-bold text-main mb-6">Expenditure Mix</h3>
          <div className="h-64 relative flex-shrink-0">
            <ResponsiveContainer width="99%" height="100%" minWidth={0}>
              <PieChart>
                <Pie
                  data={expenditureBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {expenditureBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-[10px] font-bold text-dim uppercase tracking-wider">Total</div>
              <div className="text-lg font-mono font-bold text-main">${(data.total_expenditure / 1000).toFixed(1)}k</div>
            </div>
          </div>
          <div className="flex flex-col gap-3 mt-4 overflow-y-auto">
            {expenditureBreakdown.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-dim">{item.name}</span>
                </div>
                <span className="text-xs font-mono font-bold text-main">${item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Financial Health Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-1 border border-border-subtle rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <PieChartIcon className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold text-main">Budget Status</h3>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                <span className="text-dim">Budget Consumed</span>
                <span className={cn(data.budget_utilization_pct > 90 ? "text-error" : "text-primary")}>
                  {data.budget_utilization_pct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-surface-2 rounded-full overflow-hidden border border-border-subtle">
                <div 
                  className={cn("h-full transition-all duration-500", data.budget_utilization_pct > 90 ? "bg-error" : "bg-primary")}
                  style={{ width: `${Math.min(data.budget_utilization_pct, 100)}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-dim leading-relaxed">
              {data.budget_utilization_pct > 100 
                ? "Warning: Project has exceeded the revised budget. Immediate financial review required."
                : data.budget_utilization_pct > 80
                ? "Caution: Budget utilization is high. Monitor upcoming expenditures closely."
                : "Project is currently within budget parameters."}
            </p>
          </div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-xl p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <ArrowUpRight className="w-5 h-5 text-info" />
            <h3 className="text-sm font-bold text-main">Variation Impact</h3>
          </div>
          <div className="flex items-center justify-between p-4 bg-surface-2 rounded-xl border border-border-subtle">
            <div>
              <div className="text-[10px] font-bold text-dim uppercase tracking-wider">Budget Variance</div>
              <div className="text-lg font-mono font-bold text-info">
                +${data.approved_variations.toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-dim uppercase tracking-wider">Impact on Original</div>
              <div className="text-sm font-mono font-bold text-main">
                {((data.approved_variations / data.original_budget) * 100).toFixed(1)}% Increase
              </div>
            </div>
          </div>
          <p className="text-xs text-dim leading-relaxed">
            Variations represent changes to the original scope. A high variation percentage may indicate scope creep or initial estimation gaps.
          </p>
        </div>
      </div>
    </div>
  );
}
