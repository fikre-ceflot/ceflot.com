import React, { useState, useEffect } from 'react';
import { 
  Package, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  Search, 
  Filter, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  Truck,
  ClipboardList,
  ArrowLeftRight,
  TrendingUp,
  Download
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn, cleanRichText } from '../lib/utils';
import { usePermissions } from '../hooks/usePermissions';
import { exportMaterialList } from '../lib/exportUtils';

interface StockItem {
  id: string;
  material_id: string;
  material_name: string;
  material_code: string;
  category: string;
  unit: string;
  current_balance: number;
  last_updated: string;
}

interface Transaction {
  id: string;
  material_name: string;
  transaction_type: 'in' | 'out' | 'transfer';
  quantity: number;
  reference_type: string;
  reference_id: string;
  notes: string;
  created_at: string;
  created_by_name: string;
}

interface WarehouseManagerProps {
  tenantId: string;
  userRole: any;
  project?: any;
}

export default function WarehouseManager({ tenantId, userRole, project }: WarehouseManagerProps) {
  const { hasCapability } = usePermissions(userRole, tenantId);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'inventory' | 'history'>('inventory');
  const [showTransactionModal, setShowTransactionModal] = useState<'in' | 'out' | 'transfer' | null>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  
  // Form State
  const [formData, setFormData] = useState({
    material_id: '',
    quantity: 0,
    notes: '',
    reference_type: 'manual',
    reference_id: ''
  });

  useEffect(() => {
    loadData();
    loadMaterials();
  }, [tenantId, project?.id]);

  async function loadMaterials() {
    const { data } = await supabase
      .from('materials')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (data) setMaterials(data);
  }

  async function loadData() {
    setLoading(true);
    try {
      // Load Stock
      const { data: stockData, error: stockError } = await supabase
        .from('material_stock')
        .select(`
          *,
          materials (
            name,
            code,
            category,
            unit
          )
        `)
        .eq('tenant_id', tenantId)
        .eq('project_id', project?.id);

      if (stockError) throw stockError;

      const formattedStock = (stockData || []).map(s => ({
        id: s.id,
        material_id: s.material_id,
        material_name: s.materials?.name || 'Unknown',
        material_code: s.materials?.code || 'N/A',
        category: s.materials?.category || 'Uncategorized',
        unit: s.materials?.unit || 'unit',
        current_balance: s.current_balance,
        last_updated: s.last_updated
      }));

      setStock(formattedStock);

      // Load Transactions
      const { data: transData, error: transError } = await supabase
        .from('stock_transactions')
        .select(`
          *,
          materials (name),
          user_profiles:created_by (full_name)
        `)
        .eq('tenant_id', tenantId)
        .eq('project_id', project?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (transError) throw transError;

      const formattedTrans = (transData || []).map(t => ({
        id: t.id,
        material_name: t.materials?.name || 'Unknown',
        transaction_type: t.transaction_type,
        quantity: t.quantity,
        reference_type: t.reference_type,
        reference_id: t.reference_id,
        notes: t.notes,
        created_at: t.created_at,
        created_by_name: t.user_profiles?.full_name || 'System'
      }));

      setTransactions(formattedTrans);
    } catch (err) {
      console.error('Error loading warehouse data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!showTransactionModal || !formData.material_id || formData.quantity <= 0) return;

    try {
      // 1. Create Transaction
      const { error: transError } = await supabase
        .from('stock_transactions')
        .insert({
          tenant_id: tenantId,
          project_id: project?.id,
          material_id: formData.material_id,
          transaction_type: showTransactionModal,
          quantity: formData.quantity,
          reference_type: formData.reference_type,
          reference_id: formData.reference_id || null,
          notes: formData.notes
        });

      if (transError) throw transError;

      // 2. Update Stock Balance
      // Check if stock record exists
      const { data: existingStock } = await supabase
        .from('material_stock')
        .select('*')
        .eq('material_id', formData.material_id)
        .eq('project_id', project?.id)
        .single();

      const adjustment = showTransactionModal === 'in' ? formData.quantity : -formData.quantity;

      if (existingStock) {
        await supabase
          .from('material_stock')
          .update({ 
            current_balance: existingStock.current_balance + adjustment,
            last_updated: new Date().toISOString()
          })
          .eq('id', existingStock.id);
      } else {
        await supabase
          .from('material_stock')
          .insert({
            tenant_id: tenantId,
            project_id: project?.id,
            material_id: formData.material_id,
            current_balance: Math.max(0, adjustment),
            last_updated: new Date().toISOString()
          });
      }

      setShowTransactionModal(null);
      setFormData({ material_id: '', quantity: 0, notes: '', reference_type: 'manual', reference_id: '' });
      loadData();
    } catch (err) {
      console.error('Error processing transaction:', err);
      alert('Failed to process transaction');
    }
  }

  const handleExport = async () => {
    if (!project) return;
    const exportItems = filteredStock.map(s => ({
      code: s.material_code,
      name: s.material_name,
      unit: s.unit,
      base_rate: 0,
      category: s.category
    }));
    await exportMaterialList(project.name, exportItems);
  };

  const filteredStock = stock.filter(s => 
    s.material_name.toLowerCase().includes(search.toLowerCase()) ||
    s.material_code.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    totalItems: stock.length,
    lowStock: stock.filter(s => s.current_balance < 10).length,
    recentMovements: transactions.filter(t => {
      const date = new Date(t.created_at);
      const today = new Date();
      return date.toDateString() === today.toDateString();
    }).length,
    totalValue: stock.reduce((acc, s) => acc + s.current_balance, 0) // Placeholder for actual value
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 ml-[60px]">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8 px-1">
        <div className="flex flex-col gap-0.5 md:mt-auto">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-black text-ghost uppercase tracking-[0.3em]">Inventory & Logistics</span>
          </div>
          <h1 className="text-[19px] font-black tracking-tight text-main -ml-0.5">{project.name}</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-2 text-[10px] font-bold text-ghost">
              <span className="text-primary font-black uppercase tracking-widest decoration-primary/30 underline-offset-4">Warehouse & Stock</span>
              <span className="w-1 h-1 rounded-full bg-border-subtle" />
              <span className="px-1.5 py-0.25 rounded bg-surface-2 border border-border-subtle opacity-80">{stats.totalItems} Tracked Items</span>
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

          <div className="flex items-center gap-4">
            <button
              onClick={handleExport}
              className="btn btn-secondary btn-sm"
            >
              <Package className="w-4 h-4 mr-2" />
              Export List
            </button>
            
            {hasCapability('stock:grn_step1') && (
              <button 
                onClick={() => setShowTransactionModal('in')}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-surface-base font-bold rounded-lg transition-all shadow-lg shadow-primary/10 text-sm"
              >
                <ArrowDownLeft className="w-4 h-4" />
                Stock In / GRN
              </button>
            )}

            {hasCapability('stock:issue') && (
              <button 
                onClick={() => setShowTransactionModal('out')}
                className="flex items-center gap-2 px-4 py-2 bg-surface-2 hover:bg-surface-3 text-main font-bold rounded-lg border border-border-subtle transition-all text-sm"
              >
                <ArrowUpRight className="w-4 h-4" />
                Issue to Site
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface-1 border border-border-subtle p-5 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Active</span>
          </div>
          <div className="text-2xl font-bold text-main">{stats.totalItems}</div>
          <div className="text-xs text-dim mt-1">Total Materials in Stock</div>
        </div>

        <div className="bg-surface-1 border border-border-subtle p-5 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-danger/10 rounded-lg">
              <AlertCircle className="w-5 h-5 text-danger" />
            </div>
            <span className="text-[10px] font-bold text-danger bg-danger/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Alert</span>
          </div>
          <div className="text-2xl font-bold text-main">{stats.lowStock}</div>
          <div className="text-xs text-dim mt-1">Items Below Threshold</div>
        </div>

        <div className="bg-surface-1 border border-border-subtle p-5 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <ArrowLeftRight className="w-5 h-5 text-accent" />
            </div>
            <span className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Today</span>
          </div>
          <div className="text-2xl font-bold text-main">{stats.recentMovements}</div>
          <div className="text-xs text-dim mt-1">Recent Movements</div>
        </div>

        <div className="bg-surface-1 border border-border-subtle p-5 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-warning/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-warning" />
            </div>
            <span className="text-[10px] font-bold text-warning bg-warning/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Trend</span>
          </div>
          <div className="text-2xl font-bold text-main">{stats.totalValue.toLocaleString()}</div>
          <div className="text-xs text-dim mt-1">Total Units in Stock</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-surface-1 border border-border-subtle rounded-xl overflow-hidden flex flex-col">
        {/* Tabs */}
        <div className="flex items-center border-b border-border-subtle px-4">
          <button 
            onClick={() => setActiveTab('inventory')}
            className={cn(
              "px-6 py-4 text-sm font-bold transition-all relative",
              activeTab === 'inventory' ? "text-primary" : "text-dim hover:text-main"
            )}
          >
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Inventory List
            </div>
            {activeTab === 'inventory' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={cn(
              "px-6 py-4 text-sm font-bold transition-all relative",
              activeTab === 'history' ? "text-primary" : "text-dim hover:text-main"
            )}
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Transaction History
            </div>
            {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-surface-2/50">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
            <input 
              type="text"
              placeholder="Search by material, code or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-base border border-border-subtle rounded-lg text-sm text-main focus:outline-none focus:border-primary transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-dim hover:text-main hover:bg-surface-2 rounded-lg transition-all">
              <Filter className="w-4 h-4" />
            </button>
            <button 
              onClick={handleExport}
              className="p-2 text-dim hover:text-main hover:bg-surface-2 rounded-lg transition-all"
              title="Export Material List (SUNSHINE Format)"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'inventory' ? (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-surface-1 z-10">
                <tr className="bg-surface-base border-b border-border-subtle shrink-0">
                  <th className="px-6 py-3 text-[9px] font-mono font-black text-ghost uppercase tracking-widest bg-surface-base border-b border-border-subtle relative group/col">Material</th>
                  <th className="px-6 py-3 text-[9px] font-mono font-black text-ghost uppercase tracking-widest bg-surface-base border-b border-border-subtle relative group/col">Category</th>
                  <th className="px-6 py-3 text-[9px] font-mono font-black text-ghost uppercase tracking-widest text-right bg-surface-base border-b border-border-subtle relative group/col">Balance</th>
                  <th className="px-6 py-3 text-[9px] font-mono font-black text-ghost uppercase tracking-widest bg-surface-base border-b border-border-subtle relative group/col">Last Movement</th>
                  <th className="px-6 py-3 text-[9px] font-mono font-black text-ghost uppercase tracking-widest text-right bg-surface-base border-b border-border-subtle relative group/col">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/30">
                {filteredStock.map((item) => (
                  <tr key={item.id} className="hover:bg-primary/[0.02] border-b border-border-subtle/20 transition-colors group h-auto min-h-[2.5rem]">
                    <td className="px-6 py-3 border-r border-border-subtle/20">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center text-primary font-black text-[10px] font-mono">
                          {item.material_name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-[11px] font-black text-main uppercase leading-tight">{cleanRichText(item.material_name)}</div>
                          <div className="text-[9px] font-black text-ghost font-mono uppercase tracking-widest">{cleanRichText(item.material_code)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 border-r border-border-subtle/20">
                      <span className="text-[9px] font-black text-ghost bg-surface-2 border border-border-subtle px-1.5 py-0.5 rounded uppercase tracking-widest">
                        {cleanRichText(item.category)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right border-r border-border-subtle/20">
                      <div className="text-[11px] font-black text-main font-mono leading-tight">{item.current_balance.toLocaleString()}</div>
                      <div className="text-[9px] text-ghost font-black uppercase tracking-widest">{item.unit}</div>
                    </td>
                    <td className="px-6 py-3 border-r border-border-subtle/20">
                      <div className="text-[10px] font-black text-ghost font-mono">{new Date(item.last_updated).toLocaleDateString()}</div>
                      <div className="text-[9px] text-ghost font-black font-mono opacity-60">{new Date(item.last_updated).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-6 py-3 text-right border-r border-border-subtle/20">
                      {item.current_balance < 10 ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-danger/20 bg-danger/5 text-danger text-[9px] font-black uppercase tracking-widest">
                          Low Stock
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-[9px] font-black uppercase tracking-widest">
                          Healthy
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredStock.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Package className="w-12 h-12 text-border-subtle" />
                        <div className="text-dim text-sm">No materials found in inventory</div>
                        {!search && (
                          <button 
                            onClick={() => setShowTransactionModal('in')}
                            className="text-primary text-xs font-bold hover:underline"
                          >
                            Add your first stock movement
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-surface-1 z-10">
                <tr className="border-b border-border-subtle">
                  <th className="px-6 py-4 text-[10px] font-bold text-dim uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-dim uppercase tracking-widest">Type</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-dim uppercase tracking-widest">Material</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-dim uppercase tracking-widest text-right">Quantity</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-dim uppercase tracking-widest">Reference / Notes</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-dim uppercase tracking-widest">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-xs text-main font-bold">{new Date(t.created_at).toLocaleDateString()}</div>
                      <div className="text-[10px] text-dim">{new Date(t.created_at).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
                        t.transaction_type === 'in' ? "bg-primary/10 text-primary" : 
                        t.transaction_type === 'out' ? "bg-danger/10 text-danger" : 
                        "bg-accent/10 text-accent"
                      )}>
                        {t.transaction_type === 'in' ? <ArrowDownLeft className="w-3 h-3" /> : 
                         t.transaction_type === 'out' ? <ArrowUpRight className="w-3 h-3" /> : 
                         <ArrowLeftRight className="w-3 h-3" />}
                        {t.transaction_type}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-main">{cleanRichText(t.material_name)}</td>
                    <td className="px-6 py-4 text-right font-mono text-sm font-bold text-main">
                      {t.transaction_type === 'out' ? '-' : '+'}{t.quantity.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-dim">{t.reference_type} {t.reference_id ? `(${t.reference_id.substring(0,8)})` : ''}</div>
                      <div className="text-[10px] text-dim italic">{t.notes || 'No notes'}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-dim">{t.created_by_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Transaction Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-surface-base/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 border-b border-border-subtle flex items-center justify-between">
              <h2 className="text-xl font-bold text-main flex items-center gap-3">
                {showTransactionModal === 'in' ? <ArrowDownLeft className="w-5 h-5 text-primary" /> : 
                 showTransactionModal === 'out' ? <ArrowUpRight className="w-5 h-5 text-danger" /> : 
                 <ArrowLeftRight className="w-5 h-5 text-accent" />}
                Stock {showTransactionModal === 'in' ? 'In / GRN' : showTransactionModal === 'out' ? 'Out / Issue' : 'Transfer'}
              </h2>
              <button onClick={() => setShowTransactionModal(null)} className="text-dim hover:text-main transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleTransaction} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-1.5">Material</label>
                <select 
                  required
                  value={formData.material_id}
                  onChange={(e) => setFormData({ ...formData, material_id: e.target.value })}
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-main focus:outline-none focus:border-primary"
                >
                  <option value="" className="bg-surface-1">Select Material...</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id} className="bg-surface-1">{cleanRichText(m.name)} ({cleanRichText(m.unit)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-1.5">Quantity</label>
                <input 
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-main focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-1.5">Reference Type</label>
                <select 
                  value={formData.reference_type}
                  onChange={(e) => setFormData({ ...formData, reference_type: e.target.value })}
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-main focus:outline-none focus:border-primary"
                >
                  <option value="manual" className="bg-surface-1">Manual Entry</option>
                  <option value="po" className="bg-surface-1">Purchase Order (PO)</option>
                  <option value="daily_log" className="bg-surface-1">Daily Progress Log</option>
                  <option value="transfer" className="bg-surface-1">Inter-Project Transfer</option>
                </select>
              </div>

              {formData.reference_type !== 'manual' && (
                <div>
                  <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-1.5">Reference ID / No</label>
                  <input 
                    type="text"
                    placeholder="Enter PO# or Log ID..."
                    value={formData.reference_id}
                    onChange={(e) => setFormData({ ...formData, reference_id: e.target.value })}
                    className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-main focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-1.5">Notes</label>
                <textarea 
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-main focus:outline-none focus:border-primary resize-none"
                  placeholder="Reason for movement..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowTransactionModal(null)}
                  className="flex-1 px-4 py-2.5 bg-surface-2 hover:bg-surface-3 text-main font-bold rounded-lg border border-border-subtle transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-surface-base font-bold rounded-lg transition-all shadow-lg shadow-primary/10"
                >
                  Confirm Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function X(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
