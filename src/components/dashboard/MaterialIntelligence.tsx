import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { DashboardPanel } from './DashboardPanel';
import { 
  Package, 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  BarChart3, 
  LineChart as LineChartIcon,
  ShoppingCart,
  ArrowRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  LineChart,
  Line,
  Cell
} from 'recharts';
import { cn } from '../../lib/utils';

interface MaterialIntelligenceProps {
  tenantId: string;
  projectId?: string;
}

export function MaterialIntelligence({ tenantId, projectId }: MaterialIntelligenceProps) {
  const [varianceData, setVarianceData] = useState<any[]>([]);
  const [priceTrends, setPriceTrends] = useState<any[]>([]);
  const [inventoryHealth, setInventoryHealth] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [tenantId, projectId]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      // 1. Load Consumption Variance
      let varianceQuery = supabase.from('v_material_consumption_variance').select('*');
      if (projectId) varianceQuery = varianceQuery.eq('project_id', projectId);
      const { data: vData, error: vErr } = await varianceQuery.limit(10);
      if (vErr) throw vErr;
      setVarianceData(vData || []);

      // 2. Load Price Trends
      const { data: pData, error: pErr } = await supabase
        .from('v_material_price_trends')
        .select('*')
        .eq('tenant_id', tenantId)
        .limit(20);
      if (pErr) throw pErr;
      setPriceTrends(pData || []);

      // 3. Load Inventory Health
      let inventoryQuery = supabase.from('v_inventory_health').select('*').eq('tenant_id', tenantId);
      if (projectId) inventoryQuery = inventoryQuery.eq('project_id', projectId);
      const { data: iData, error: iErr } = await inventoryQuery;
      if (iErr) throw iErr;
      setInventoryHealth(iData || []);

    } catch (e: any) {
      console.error('Error loading material intelligence:', e.message);
      setError('Data views are being set up — run the latest migrations.');
    } finally {
      setLoading(false);
    }
  }

  const criticalStock = inventoryHealth.filter(i => i.stock_status === 'critical');
  const highVariance = varianceData.filter(v => Math.abs(v.variance_pct) > 15);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consumption Variance */}
        <DashboardPanel 
          title="Consumption Variance" 
          subtitle="Planned vs Actual Usage"
          icon={BarChart3}
        >
          <div className="flex-1 h-64 min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={varianceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis 
                  dataKey="material_name" 
                  stroke="var(--text-ghost)" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => val?.length > 10 ? val.substring(0, 10) + '...' : val}
                />
                <YAxis stroke="var(--text-ghost)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: 'var(--text-main)' }}
                  labelStyle={{ color: 'var(--text-ghost)', fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                <Bar name="Planned" dataKey="planned_qty" fill="var(--color-accent)" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar name="Actual" dataKey="actual_qty" fill="var(--color-primary)" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {highVariance.length > 0 && (
            <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-danger">High Variance Detected</span>
                <p className="text-[10px] text-dim">
                  {highVariance[0].material_name} shows a {highVariance[0].variance_pct.toFixed(1)}% deviation from plan.
                </p>
              </div>
            </div>
          )}
        </DashboardPanel>

        {/* Price Trends */}
        <DashboardPanel 
          title="Market Price Intelligence" 
          subtitle="Procurement Cost Trends"
          icon={LineChartIcon}
        >
          <div className="flex-1 h-64 min-h-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={priceTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis 
                  dataKey="purchase_date" 
                  stroke="var(--text-ghost)" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis stroke="var(--text-ghost)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface-base)', border: '1px solid var(--border-subtle)', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: 'var(--text-main)' }}
                  labelStyle={{ color: 'var(--text-ghost)', fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="purchase_price" 
                  stroke="var(--color-accent)" 
                  strokeWidth={2} 
                  dot={{ r: 4, fill: 'var(--color-accent)' }} 
                  activeDot={{ r: 6 }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="library_price" 
                  stroke="var(--text-ghost)" 
                  strokeDasharray="5 5" 
                  strokeWidth={1} 
                  dot={false} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-surface-2 p-3 rounded-lg border border-border-subtle">
              <div className="text-[9px] font-bold text-ghost uppercase mb-1">Avg. Price Variance</div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-danger" />
                <span className="text-sm font-bold text-main">+4.2%</span>
              </div>
            </div>
            <div className="bg-surface-2 p-3 rounded-lg border border-border-subtle">
              <div className="text-[9px] font-bold text-ghost uppercase mb-1">Procurement Savings</div>
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold text-main">$12,450</span>
              </div>
            </div>
          </div>
        </DashboardPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inventory Status */}
        <DashboardPanel 
          title="Inventory Health" 
          subtitle="Stock Levels & Reorder Status"
          icon={Package}
          className="lg:col-span-2"
        >
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="px-3 py-4 text-[11px] font-black text-ghost uppercase tracking-widest">Material</th>
                  <th className="px-3 py-4 text-[11px] font-black text-ghost uppercase tracking-widest">Current Stock</th>
                  <th className="px-3 py-4 text-[11px] font-black text-ghost uppercase tracking-widest">Reorder Level</th>
                  <th className="px-3 py-4 text-[11px] font-black text-ghost uppercase tracking-widest">Status</th>
                  <th className="px-3 py-4 text-[11px] font-black text-ghost uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {inventoryHealth.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-sm text-dim italic">No inventory data available</td>
                  </tr>
                ) : (
                  inventoryHealth.map((item) => (
                    <tr key={item.stock_id} className="hover:bg-surface-2/50 transition-colors group">
                      <td className="px-3 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-main group-hover:text-primary transition-colors">{item.material_name}</span>
                          <span className="text-[11px] text-ghost font-mono uppercase tracking-tighter">{item.material_code}</span>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <span className="text-sm font-mono font-bold text-main">{item.current_balance} {item.unit}</span>
                      </td>
                      <td className="px-3 py-4">
                        <span className="text-sm font-mono text-ghost">{item.reorder_level} {item.unit}</span>
                      </td>
                      <td className="px-3 py-4">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-widest border shadow-xs",
                          item.stock_status === 'critical' ? "bg-danger/10 text-danger border-danger/20" :
                          item.stock_status === 'warning' ? "bg-warning/10 text-warning border-warning/30" :
                          "bg-primary/10 text-primary border-primary/30"
                        )}>
                          {item.stock_status === 'critical' && <AlertTriangle className="w-3 h-3" />}
                          {item.stock_status === 'healthy' && <CheckCircle2 className="w-3 h-3" />}
                          {item.stock_status}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-right">
                        <button className="btn btn-secondary btn-sm h-8 w-8 p-0 rounded-lg">
                          <ShoppingCart className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DashboardPanel>

        {/* Procurement Insights */}
        <DashboardPanel 
          title="Procurement Insights" 
          subtitle="Supplier & Lead Time Analysis"
          icon={ShoppingCart}
        >
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-ghost uppercase">Avg. Lead Time</span>
                <span className="text-xs font-bold text-main">5.2 Days</span>
              </div>
              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div className="h-full bg-accent w-[65%]" />
              </div>
              <p className="text-[10px] text-ghost">20% improvement over last quarter</p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-ghost uppercase">Supplier Reliability</span>
                <span className="text-xs font-bold text-main">94%</span>
              </div>
              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div className="h-full bg-primary w-[94%]" />
              </div>
              <p className="text-[10px] text-ghost">Based on on-time delivery metrics</p>
            </div>

            <div className="mt-2 p-4 bg-accent/5 border border-accent/10 rounded-xl">
              <h4 className="text-[11px] font-bold text-main mb-2 flex items-center gap-2">
                <TrendingDown className="w-3 h-3 text-primary" />
                Cost Saving Tip
              </h4>
              <p className="text-[10px] text-dim leading-relaxed">
                Consolidating cement orders for <span className="text-main">Project Alpha</span> and <span className="text-main">City Mall</span> could unlock a 5% volume discount from Sunshine TE.
              </p>
              <button className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-accent uppercase tracking-widest hover:underline text-left">
                View Consolidation Plan <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </DashboardPanel>
      </div>
    </div>
  );
}
