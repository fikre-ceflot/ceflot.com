import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ShoppingCart, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Search,
  Plus,
  FileText,
  Truck,
  DollarSign,
  LayoutDashboard,
  ClipboardList
} from 'lucide-react';
import { cn, cleanRichText } from '../lib/utils';
import PurchaseOrderManager from './PurchaseOrderManager';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface ProcurementDashboardProps {
  project: any;
  tenantId: string;
}

export default function ProcurementDashboard({ project, tenantId }: ProcurementDashboardProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pos'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSpend: 0,
    pendingPOs: 0,
    activeSuppliers: 0,
    deliveryRate: 0
  });

  const [spendByCategory, setSpendByCategory] = useState([
    { name: 'Aggregates', value: 45000 },
    { name: 'Cement', value: 32000 },
    { name: 'Steel', value: 28000 },
    { name: 'Timber', value: 12000 },
    { name: 'MEP', value: 18000 }
  ]);

  const [recentPOs, setRecentPOs] = useState([
    { id: 'PO-2024-001', supplier: 'Nile Aggregates', date: '2024-03-15', amount: 12500, status: 'approved' },
    { id: 'PO-2024-002', supplier: 'Bamburi Cement', date: '2024-03-14', amount: 8400, status: 'pending' },
    { id: 'PO-2024-003', supplier: 'Juba Steel', date: '2024-03-12', amount: 15600, status: 'delivered' },
    { id: 'PO-2024-004', supplier: 'Timber World', date: '2024-03-10', amount: 3200, status: 'rejected' }
  ]);

  useEffect(() => {
    // Mock loading delay
    const timer = setTimeout(() => {
      setLoading(false);
      setStats({
        totalSpend: 135400,
        pendingPOs: 5,
        activeSuppliers: 12,
        deliveryRate: 94
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [project.id]);

  const COLORS = ['var(--color-primary)', 'var(--color-accent)', 'var(--color-accent-hover)', 'var(--color-warning)', 'var(--color-danger)'];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-border-subtle border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-sm text-ghost">Loading procurement data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-8">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8 px-1">
        <div className="flex flex-col gap-0.5 md:mt-auto">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-black text-ghost uppercase tracking-[0.3em]">Supply Chain</span>
          </div>
          <h1 className="text-[19px] font-black tracking-tight text-main -ml-0.5">{cleanRichText(project.name)}</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-2 text-[10px] font-bold text-ghost">
              <span className="text-primary font-black uppercase tracking-widest decoration-primary/30 underline-offset-4">Procurement Hub</span>
              <span className="w-1 h-1 rounded-full bg-border-subtle" />
              <span className="px-1.5 py-0.25 rounded bg-surface-2 border border-border-subtle opacity-80">{stats.activeSuppliers} Suppliers</span>
            </div>
            <div className="h-1 w-1 rounded-full bg-border-subtle" />
            <span className="text-[10px] font-bold text-dim uppercase tracking-wider">{project.status || 'Active'}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-5">
          <div className="flex flex-col items-end min-w-[120px]">
            <span className="text-[8px] font-bold text-ghost uppercase tracking-[0.2em] mb-1 opacity-60">Reference ID</span>
            <div className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center w-full">
              <span className="text-xs font-black text-primary tracking-widest">{project.project_code}</span>
            </div>
          </div>

          <div className="flex items-center justify-between bg-surface-1 border border-border-subtle p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all",
                activeTab === 'dashboard' 
                  ? "bg-primary text-surface-base shadow-lg" 
                  : "text-ghost hover:text-main"
              )}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('pos')}
              className={cn(
                "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all",
                activeTab === 'pos' 
                  ? "bg-primary text-surface-base shadow-lg" 
                  : "text-ghost hover:text-main"
              )}
            >
              <ClipboardList className="w-4 h-4" />
              Purchase Orders
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'dashboard' ? (
          <div className="space-y-6 animate-in fade-in duration-500 overflow-y-auto h-full pr-2 custom-scrollbar">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-ghost uppercase tracking-widest">Total Spend</span>
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
                <div className="text-2xl font-bold text-main">${stats.totalSpend.toLocaleString()}</div>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-primary">
                  <ArrowUpRight className="w-3 h-3" />
                  <span>12% vs last month</span>
                </div>
              </div>

              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-ghost uppercase tracking-widest">Pending POs</span>
                  <Clock className="w-4 h-4 text-warning" />
                </div>
                <div className="text-2xl font-bold text-main">{stats.pendingPOs}</div>
                <div className="text-[10px] text-ghost mt-1">Awaiting approval</div>
              </div>

              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-ghost uppercase tracking-widest">Active Suppliers</span>
                  <Truck className="w-4 h-4 text-accent" />
                </div>
                <div className="text-2xl font-bold text-main">{stats.activeSuppliers}</div>
                <div className="text-[10px] text-ghost mt-1">On this project</div>
              </div>

              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-ghost uppercase tracking-widest">Delivery Rate</span>
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                </div>
                <div className="text-2xl font-bold text-main">{stats.deliveryRate}%</div>
                <div className="text-[10px] text-ghost mt-1">On-time performance</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Spend Chart */}
              <div className="lg:col-span-2 bg-surface-1 border border-border-subtle rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-bold text-main">Spend by Category</h3>
                  <button className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">View Report</button>
                </div>
                <div className="h-[300px]">
                  <ResponsiveContainer width="99%" height="100%" minWidth={0}>
                    <BarChart data={spendByCategory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke="var(--color-ghost)" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="var(--color-ghost)" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(value) => `$${value/1000}k`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', borderRadius: '8px', fontSize: '12px' }}
                        itemStyle={{ color: 'var(--color-text-main)' }}
                      />
                      <Bar dataKey="value" fill="var(--color-primary)" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Supplier Distribution */}
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-6">
                <h3 className="text-sm font-bold text-main mb-6">Supplier Distribution</h3>
                <div className="h-[240px]">
                  <ResponsiveContainer width="99%" height="100%" minWidth={0}>
                    <PieChart>
                      <Pie
                        data={spendByCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {spendByCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-border-subtle)', borderRadius: '8px', fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-4">
                  {spendByCategory.map((cat, i) => (
                    <div key={cat.name} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-ghost">{cat.name}</span>
                      </div>
                      <span className="text-main font-bold">{Math.round((cat.value / stats.totalSpend) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden">
              <div className="p-6 border-b border-border-subtle flex items-center justify-between">
                <h3 className="text-sm font-bold text-main">Recent Purchase Orders</h3>
                <button 
                  onClick={() => setActiveTab('pos')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-primary/20 transition-all"
                >
                  <Plus className="w-3 h-3" />
                  New PO
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-base border-b border-border-subtle">
                      <th className="px-6 py-3 text-[10px] font-mono text-ghost uppercase tracking-widest">PO Number</th>
                      <th className="px-6 py-3 text-[10px] font-mono text-ghost uppercase tracking-widest">Supplier</th>
                      <th className="px-6 py-3 text-[10px] font-mono text-ghost uppercase tracking-widest">Date</th>
                      <th className="px-6 py-3 text-[10px] font-mono text-ghost uppercase tracking-widest text-right">Amount</th>
                      <th className="px-6 py-3 text-[10px] font-mono text-ghost uppercase tracking-widest">Status</th>
                      <th className="px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {recentPOs.map((po) => (
                      <tr key={po.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-accent font-mono">{po.id}</td>
                        <td className="px-6 py-4 text-xs text-main font-medium">{cleanRichText(po.supplier)}</td>
                        <td className="px-6 py-4 text-xs text-ghost">{po.date}</td>
                        <td className="px-6 py-4 text-xs text-primary font-mono text-right font-bold">${po.amount.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider border",
                            po.status === 'approved' ? "bg-primary/5 text-primary border-primary/20" :
                            po.status === 'pending' ? "bg-warning/5 text-warning border-warning/20" :
                            po.status === 'delivered' ? "bg-accent/5 text-accent border-accent/20" :
                            "bg-danger/5 text-danger border-danger/20"
                          )}>
                            {po.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="p-1.5 text-ghost hover:text-main transition-colors">
                            <FileText className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <PurchaseOrderManager project={project} tenantId={tenantId} />
        )}
      </div>
    </div>
  );
}
