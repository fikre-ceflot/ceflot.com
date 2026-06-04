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
  Download,
  Building2,
  X,
  Clock,
  Check
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
  material_id: string;
  transaction_type: 'in' | 'out' | 'transfer';
  quantity: number;
  reference_type: string;
  reference_id: string;
  notes: string;
  created_at: string;
  created_by_name: string;
  project_id?: string | null;
}

interface PendingTransfer {
  id: string;
  material_id: string;
  material_name: string;
  material_code: string;
  unit: string;
  quantity: number;
  from: 'central';
  to_project_id: string;
  to_project_name: string;
  created_at: string;
  created_by: string;
  status: 'pending' | 'received';
}

interface WarehouseManagerProps {
  tenantId: string;
  userRole: any;
  project?: any;
}

export default function WarehouseManager({ tenantId, userRole, project }: WarehouseManagerProps) {
  const { hasCapability } = usePermissions(userRole, tenantId);
  const [projectsList, setProjectsList] = useState<any[]>([]);
  
  // Dual-level scope: 'central' or a specific project ID
  const [selectedProjectId, setSelectedProjectId] = useState<string>('central');
  
  const [stock, setStock] = useState<StockItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'inventory' | 'history' | 'transfers'>('inventory');
  
  const [showTransactionModal, setShowTransactionModal] = useState<'in' | 'out' | 'transfer' | null>(null);
  const [materials, setMaterials] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    material_id: '',
    quantity: 0,
    notes: '',
    reference_type: 'manual',
    reference_id: '',
    target_project_id: ''
  });

  // Load all projects for dual-level filtering
  useEffect(() => {
    async function fetchProjects() {
      try {
        const { data } = await supabase
          .from('projects')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('name');
        if (data) {
          setProjectsList(data);
        }
      } catch (err) {
        console.error('Error fetching projects list:', err);
      }
    }
    fetchProjects();
  }, [tenantId]);

  // Set default initial scope based on active project selection
  useEffect(() => {
    if (project?.id) {
      setSelectedProjectId(project.id);
    } else {
      setSelectedProjectId('central');
    }
  }, [project?.id]);

  useEffect(() => {
    loadData();
    loadMaterials();
    loadPendingTransfers();
  }, [tenantId, selectedProjectId]);

  async function loadMaterials() {
    const { data } = await supabase
      .from('materials')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (data) setMaterials(data);
  }

  // Persistent pending transfers cache using LocalStorage
  function loadPendingTransfers() {
    const cached = localStorage.getItem(`ceflot_pending_transfers_${tenantId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setPendingTransfers(parsed);
      } catch (e) {
        console.error(e);
      }
    } else {
      // Seed initial dummy in-transit items if none exist to illustrate the pipeline
      const seed: PendingTransfer[] = [
        {
          id: 'TRF-0912',
          material_id: 'seed-1',
          material_name: 'High-Yield Steel Deformed Rebars 12mm',
          material_code: 'MAT-STL-12',
          unit: 'Tons',
          quantity: 5,
          from: 'central',
          to_project_id: projectsList[0]?.id || 'dummy-p-1',
          to_project_name: projectsList[0]?.name || 'Site Block Alpha',
          created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
          created_by: 'Central Dispatcher',
          status: 'pending'
        }
      ];
      setPendingTransfers(seed);
      localStorage.setItem(`ceflot_pending_transfers_${tenantId}`, JSON.stringify(seed));
    }
  }

  const savePendingTransfers = (updatedList: PendingTransfer[]) => {
    setPendingTransfers(updatedList);
    localStorage.setItem(`ceflot_pending_transfers_${tenantId}`, JSON.stringify(updatedList));
  };

  async function loadData() {
    setLoading(true);
    try {
      // Load Stock: If selectedProjectId is 'central', we filter where project_id IS NULL.
      // Otherwise we filter by selectedProjectId.
      let query = supabase
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
        .eq('tenant_id', tenantId);

      if (selectedProjectId === 'central') {
        query = query.is('project_id', null);
      } else {
        query = query.eq('project_id', selectedProjectId);
      }

      const { data: stockData, error: stockError } = await query;
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
      let transQuery = supabase
        .from('stock_transactions')
        .select(`
          *,
          materials (name),
          user_profiles:created_by (full_name)
        `)
        .eq('tenant_id', tenantId);

      if (selectedProjectId === 'central') {
        transQuery = transQuery.is('project_id', null);
      } else {
        transQuery = transQuery.eq('project_id', selectedProjectId);
      }

      const { data: transData, error: transError } = await transQuery
        .order('created_at', { ascending: false })
        .limit(50);

      if (transError) throw transError;

      const formattedTrans = (transData || []).map(t => ({
        id: t.id,
        material_id: t.material_id,
        material_name: t.materials?.name || 'Unknown',
        transaction_type: t.transaction_type,
        quantity: t.quantity,
        reference_type: t.reference_type,
        reference_id: t.reference_id,
        notes: t.notes,
        created_at: t.created_at,
        created_by_name: t.user_profiles?.full_name || 'System',
        project_id: t.project_id
      }));

      setTransactions(formattedTrans);
    } catch (err) {
      console.error('Error loading warehouse data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Handle GRN Step 1 (In/Central Add) or Store Issues
  async function handleTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!showTransactionModal || !formData.material_id || formData.quantity <= 0) return;

    try {
      const selectedMaterial = materials.find(m => m.id === formData.material_id);
      const isCentral = selectedProjectId === 'central';
      const actualProjectId = isCentral ? null : selectedProjectId;

      if (showTransactionModal === 'transfer') {
        // Inter-store site transfer initiator
        if (!formData.target_project_id) {
          alert('Please pick a destination site store!');
          return;
        }
        if (formData.target_project_id === selectedProjectId) {
          alert('Cannot transfer to the same store!');
          return;
        }

        // Verify we have sufficient balance in sender hub
        const senderStock = stock.find(s => s.material_id === formData.material_id);
        if (!senderStock || senderStock.current_balance < formData.quantity) {
          alert(`Insufficient balance! Available stock level is: ${senderStock?.current_balance || 0}`);
          return;
        }

        // Subtract quantity from sender central stock immediately
        const { data: existingSenderStock } = await supabase
          .from('material_stock')
          .select('*')
          .eq('material_id', formData.material_id)
          .eq('project_id', actualProjectId)
          .maybeSingle();

        if (existingSenderStock) {
          await supabase
            .from('material_stock')
            .update({
              current_balance: Math.max(0, existingSenderStock.current_balance - formData.quantity),
              last_updated: new Date().toISOString()
            })
            .eq('id', existingSenderStock.id);
        }

        const targetProj = projectsList.find(p => p.id === formData.target_project_id);

        // Record central-out dispatch log
        await supabase.from('stock_transactions').insert({
          tenant_id: tenantId,
          project_id: actualProjectId,
          material_id: formData.material_id,
          transaction_type: 'out',
          quantity: formData.quantity,
          reference_type: 'transfer_dispatch',
          reference_id: `TRF-${Math.floor(1000 + Math.random()*9000)}`,
          notes: `Dispatched to site store: ${targetProj?.name || 'Site Store'}. Awaiting receipt validation.`
        });

        // Register in-transit record
        const newTransfer: PendingTransfer = {
          id: `TRF-${Math.floor(1000 + Math.random() * 9000)}`,
          material_id: formData.material_id,
          material_name: selectedMaterial?.name || 'Unknown Item',
          material_code: selectedMaterial?.code || 'N/A',
          unit: selectedMaterial?.unit || 'unit',
          quantity: formData.quantity,
          from: 'central',
          to_project_id: formData.target_project_id,
          to_project_name: targetProj?.name || 'Site Store',
          created_at: new Date().toISOString(),
          created_by: 'Central Hub Dispatcher',
          status: 'pending'
        };

        savePendingTransfers([...pendingTransfers, newTransfer]);
        alert(`Transfer package ${newTransfer.id} dispatched! Site store manager must approve (GRN Step 2) to complete.`);
      } else {
        // Standard Stock In / Issue Out (Step 1 GRN)
        const { error: transError } = await supabase
          .from('stock_transactions')
          .insert({
            tenant_id: tenantId,
            project_id: actualProjectId,
            material_id: formData.material_id,
            transaction_type: showTransactionModal,
            quantity: formData.quantity,
            reference_type: formData.reference_type,
            reference_id: formData.reference_id || null,
            notes: formData.notes
          });

        if (transError) throw transError;

        // Find existing stock level
        const { data: existingStock } = await supabase
          .from('material_stock')
          .select('*')
          .eq('material_id', formData.material_id)
          .eq('project_id', actualProjectId)
          .maybeSingle();

        const adjustment = showTransactionModal === 'in' ? formData.quantity : -formData.quantity;

        if (existingStock) {
          await supabase
            .from('material_stock')
            .update({ 
              current_balance: Math.max(0, existingStock.current_balance + adjustment),
              last_updated: new Date().toISOString()
            })
            .eq('id', existingStock.id);
        } else {
          await supabase
            .from('material_stock')
            .insert({
              tenant_id: tenantId,
              project_id: actualProjectId,
              material_id: formData.material_id,
              current_balance: Math.max(0, adjustment),
              last_updated: new Date().toISOString()
            });
        }
        alert(`Stock movement recorded successfully!`);
      }

      setShowTransactionModal(null);
      setFormData({ material_id: '', quantity: 0, notes: '', reference_type: 'manual', reference_id: '', target_project_id: '' });
      loadData();
    } catch (err) {
      console.error('Error processing transaction:', err);
      alert('Failed to process transaction');
    }
  }

  // Handle GRN Step 2 Receipt Verification/Audit at specific Site store
  async function handleConfirmReceipt(transfer: PendingTransfer) {
    if (!hasCapability('stock:grn_step2')) {
      alert("Missing permission: 'stock:grn_step2' capability is required to audit and confirm store receipts.");
      return;
    }

    try {
      // 1. Create Stock In / GRN Step 2 Transaction for Site Store
      await supabase.from('stock_transactions').insert({
        tenant_id: tenantId,
        project_id: transfer.to_project_id,
        material_id: transfer.material_id,
        transaction_type: 'in',
        quantity: transfer.quantity,
        reference_type: 'grn_step2_verified',
        reference_id: transfer.id,
        notes: `Validated receipt from Nairobi Central Hub. (Audit Ref: ${transfer.id}).`
      });

      // 2. Add Balance to Target Site Store
      const { data: existingSiteStock } = await supabase
        .from('material_stock')
        .select('*')
        .eq('material_id', transfer.material_id)
        .eq('project_id', transfer.to_project_id)
        .maybeSingle();

      if (existingSiteStock) {
        await supabase
          .from('material_stock')
          .update({
            current_balance: existingSiteStock.current_balance + transfer.quantity,
            last_updated: new Date().toISOString()
          })
          .eq('id', existingSiteStock.id);
      } else {
        await supabase
          .from('material_stock')
          .insert({
            tenant_id: tenantId,
            project_id: transfer.to_project_id,
            material_id: transfer.material_id,
            current_balance: transfer.quantity,
            last_updated: new Date().toISOString()
          });
      }

      // 3. Mark transfer as completed (remove from pending stream)
      const remaining = pendingTransfers.filter(t => t.id !== transfer.id);
      savePendingTransfers(remaining);
      
      alert(`GRN Step 2 Confirmed! Added ${transfer.quantity} ${transfer.unit} to local store balance.`);
      loadData();
    } catch (err) {
      console.error('Error in GRN Step 2:', err);
      alert('Failed to complete GRN Step 2 verification.');
    }
  }

  const handleExport = async () => {
    const isCentral = selectedProjectId === 'central';
    const siteName = isCentral ? "Central Nairobi Sourcing Hub" : projectsList.find(p => p.id === selectedProjectId)?.name || "Site Store";
    const exportItems = filteredStock.map(s => ({
      code: s.material_code,
      name: s.material_name,
      unit: s.unit,
      base_rate: 0,
      category: s.category
    }));
    await exportMaterialList(siteName, exportItems);
  };

  const filteredStock = stock.filter(s => 
    s.material_name.toLowerCase().includes(search.toLowerCase()) ||
    s.material_code.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  const activeSiteStore = selectedProjectId === 'central' ? null : projectsList.find(p => p.id === selectedProjectId);
  const activePendingReceiptsCount = pendingTransfers.filter(t => t.to_project_id === selectedProjectId).length;

  const stats = {
    totalItems: stock.length,
    lowStock: stock.filter(s => s.current_balance < 10).length,
    recentMovements: transactions.filter(t => {
      const date = new Date(t.created_at);
      const today = new Date();
      return date.toDateString() === today.toDateString();
    }).length,
    totalValue: stock.reduce((acc, s) => acc + s.current_balance, 0)
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8 px-1">
        <div className="flex flex-col gap-0.5 md:mt-auto">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-semibold text-ghost uppercase tracking-[0.2em]">Supply Chain Operations</span>
          </div>
          
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-main tracking-tight select-none">Supply Hub Control</h1>
            
            {/* Real-time Store Selector Toggle */}
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-surface-2 border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-primary font-bold focus:outline-none"
            >
              <option value="central" className="font-bold">🏢 Central Supply Hub</option>
              {projectsList.map(proj => (
                <option key={proj.id} value={proj.id}>🏗️ Store: {cleanRichText(proj.name)} ({proj.project_code})</option>
              ))}
            </select>
          </div>

          <p className="text-xs text-dim mt-2 leading-relaxed">
            {selectedProjectId === 'central' 
              ? 'Nairobi global central catalog depot. Feed site stores, approve incoming PO dispatches, and trigger initial supply procurement.'
              : `Site storage control for: ${activeSiteStore ? activeSiteStore.name : 'Unknownsite'}. Local logs, transfers, and receipts confirmation.`}
          </p>

          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-2 text-[10px] font-medium text-ghost">
              <span className="text-accent font-semibold uppercase tracking-wider">Inventory View</span>
              <span className="w-1 h-1 rounded-full bg-border-subtle" />
              <span className="px-1.5 py-0.25 rounded bg-surface-2 border border-border-subtle opacity-80">{stats.totalItems} Active Types</span>
            </div>
            {selectedProjectId !== 'central' && (
              <>
                <div className="h-1 w-1 rounded-full bg-border-subtle" />
                <span className="bg-primary/15 text-primary text-[9px] px-2 py-0.5 border border-primary/20 rounded font-semibold font-mono">
                  SITE ID: {activeSiteStore?.project_code || 'LOCAL_STORE'}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 ml-auto flex-wrap">
          {/* Dynamic Helpful Information Card (Aligned Right) */}
          <div className="flex flex-col gap-1 text-right border-r border-border-subtle pr-4 h-10 justify-center">
            <div className="text-[10px] font-semibold text-ghost uppercase tracking-wider font-mono">SUPPLY CHAIN CONTROL</div>
            <div className="flex items-center gap-2 justify-end">
              <span className="px-1.5 py-0.25 rounded bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[9px] font-semibold text-[var(--color-primary)] select-none uppercase tracking-wider font-mono">SYNCHRONIZED</span>
              <div className="h-1 w-1 rounded-full bg-border-subtle" />
              <span className="text-[9px] font-medium text-dim uppercase tracking-wider font-mono">Hub: {selectedProjectId.toUpperCase()} | {stats.totalItems} Categories</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleExport}
              className="btn btn-secondary btn-sm"
              title="Export Inventory Catalog"
            >
              <Package className="w-4 h-4 mr-2" />
              Export
            </button>
            
            {hasCapability('stock:grn_step1') && (
              <button 
                onClick={() => setShowTransactionModal('in')}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-surface-base font-bold rounded-lg transition-all shadow-lg shadow-primary/10 text-xs"
              >
                <ArrowDownLeft className="w-4 h-4" />
                Stock In / GRN
              </button>
            )}

            {selectedProjectId === 'central' && hasCapability('stock:issue') && (
              <button 
                onClick={() => setShowTransactionModal('transfer')}
                className="flex items-center gap-2 px-4 py-2 bg-accent hover:brightness-110 text-white font-bold rounded-lg transition-all text-xs shadow-lg shadow-accent/10"
              >
                <ArrowLeftRight className="w-4 h-4" />
                Issue to Site
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Sitelist receipt pipeline alerts info block */}
      {selectedProjectId !== 'central' && activePendingReceiptsCount > 0 && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-amber-300 uppercase">Incoming Dispatch Transit Alert</h4>
              <p className="text-[10px] text-amber-200/80 leading-normal mt-0.5">There {activePendingReceiptsCount === 1 ? 'is' : 'are'} {activePendingReceiptsCount} pending supply haul{activePendingReceiptsCount === 1 ? '' : 's'} waiting for local site receipt confirmation (GRN Step 2).</p>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab('transfers')}
            className="text-[10px] font-black uppercase text-amber-400 border border-amber-400/30 px-3 py-1.5 rounded-xl hover:bg-amber-400/20 transition-all"
          >
            Go To Audit Desk
          </button>
        </div>
      )}

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
          <div className="text-xs text-dim mt-1">Loaded catalog items in store</div>
        </div>

        <div className="bg-surface-1 border border-border-subtle p-5 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-danger/10 rounded-lg">
              <AlertCircle className="w-5 h-5 text-danger" />
            </div>
            <span className="text-[10px] font-bold text-danger bg-danger/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Alert</span>
          </div>
          <div className="text-2xl font-bold text-main">{stats.lowStock}</div>
          <div className="text-xs text-dim mt-1">Materials below safety safety buffer</div>
        </div>

        <div className="bg-surface-1 border border-border-subtle p-5 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <ArrowLeftRight className="w-5 h-5 text-accent" />
            </div>
            <span className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Today</span>
          </div>
          <div className="text-2xl font-bold text-main">{stats.recentMovements}</div>
          <div className="text-xs text-dim mt-1">Transaction audit events</div>
        </div>

        <div className="bg-surface-1 border border-border-subtle p-5 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-warning/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-warning" />
            </div>
            <span className="text-[10px] font-bold text-warning bg-warning/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Trend</span>
          </div>
          <div className="text-2xl font-bold text-main">{stats.totalValue.toLocaleString()}</div>
          <div className="text-xs text-dim mt-1">Accumulated units in current store</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-surface-1 border border-border-subtle rounded-xl overflow-hidden flex flex-col">
        {/* Tabs */}
        <div className="flex items-center border-b border-border-subtle px-4 bg-surface-2/40">
          <button 
            onClick={() => setActiveTab('inventory')}
            className={cn(
              "px-6 py-4 text-sm font-bold transition-all relative",
              activeTab === 'inventory' ? "text-primary" : "text-dim hover:text-main"
            )}
          >
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Local Inventory Catalog
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
              Store Audit Ledger
            </div>
            {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>

          {selectedProjectId !== 'central' && (
            <button 
              onClick={() => setActiveTab('transfers')}
              className={cn(
                "px-6 py-4 text-sm font-bold transition-all relative",
                activeTab === 'transfers' ? "text-primary" : "text-dim hover:text-main"
              )}
            >
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Receipt Audit Desk
                {activePendingReceiptsCount > 0 && (
                  <span className="bg-amber-500 text-[10px] text-black font-black px-1.5 py-0.5 rounded-full">
                    {activePendingReceiptsCount}
                  </span>
                )}
              </div>
              {activeTab === 'transfers' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          )}
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-surface-2/50">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
            <input 
              type="text"
              placeholder="Search store inventory..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-base border border-border-subtle rounded-lg text-sm text-main focus:outline-none focus:border-primary transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-dim hover:text-main hover:bg-surface-2 rounded-lg transition-all border border-border-subtle bg-surface-2">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dynamic Inner Workspace Rendering */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="py-24 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
              <div className="text-dim text-xs font-mono">Loading Depot catalog...</div>
            </div>
          ) : activeTab === 'inventory' ? (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-surface-1 z-10 select-none">
                <tr className="bg-surface-base border-b border-border-subtle shrink-0">
                  <th className="px-6 py-3 text-[9px] font-mono font-black text-ghost uppercase tracking-widest bg-surface-base border-b border-border-subtle">Material</th>
                  <th className="px-6 py-3 text-[9px] font-mono font-black text-ghost uppercase tracking-widest bg-surface-base border-b border-border-subtle">Category</th>
                  <th className="px-6 py-3 text-[9px] font-mono font-black text-ghost uppercase tracking-widest text-right bg-surface-base border-b border-border-subtle">Safelimit Balance</th>
                  <th className="px-6 py-3 text-[9px] font-mono font-black text-ghost uppercase tracking-widest bg-surface-base border-b border-border-subtle">Last Movement</th>
                  <th className="px-6 py-3 text-[9px] font-mono font-black text-ghost uppercase tracking-widest text-right bg-surface-base border-b border-border-subtle">Status</th>
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
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-danger/20 bg-danger/5 text-danger text-[9px] font-black uppercase tracking-widest animate-pulse">
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
                        <div className="text-dim text-sm">No materials found in local catalog list.</div>
                        {hasCapability('stock:grn_step1') && (
                          <button 
                            onClick={() => setShowTransactionModal('in')}
                            className="text-primary text-xs font-bold hover:underline"
                          >
                            Perform first Stock In / GRN
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : activeTab === 'history' ? (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-surface-1 z-10">
                <tr className="border-b border-border-subtle">
                  <th className="px-6 py-4 text-[10px] font-bold text-dim uppercase tracking-widest">Date/Timestamp</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-dim uppercase tracking-widest">Movement Scope</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-dim uppercase tracking-widest">Material Item</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-dim uppercase tracking-widest text-right">Quantity level</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-dim uppercase tracking-widest">Verified Ref No</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-dim uppercase tracking-widest">Storeman Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-xs text-main font-bold font-mono">{new Date(t.created_at).toLocaleDateString()}</div>
                      <div className="text-[10px] text-dim font-mono">{new Date(t.created_at).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
                        t.transaction_type === 'in' ? "bg-primary/10 text-primary border border-primary/20" : 
                        t.transaction_type === 'out' ? "bg-danger/10 text-danger border border-danger/20" : 
                        "bg-accent/10 text-accent border border-accent/20"
                      )}>
                        {t.transaction_type === 'in' ? <ArrowDownLeft className="w-3 h-3" /> : 
                         t.transaction_type === 'out' ? <ArrowUpRight className="w-3 h-3" /> : 
                         <ArrowLeftRight className="w-3 h-3" />}
                        {t.transaction_type}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-main uppercase">{cleanRichText(t.material_name)}</td>
                    <td className="px-6 py-4 text-right font-mono text-sm font-bold text-main">
                      {t.transaction_type === 'out' ? '-' : '+'}{t.quantity.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-dim font-mono tracking-wider">{t.reference_type} {t.reference_id ? `(${t.reference_id.substring(0,8)})` : ''}</div>
                      <div className="text-[10px] text-dim italic">{t.notes || 'No verified logs'}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-dim">{t.created_by_name}</td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-dim text-xs">No audited transactions logs registered in this stock depot node.</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            // Tab 3: Receipt Audit Desk (Site Store)
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div>
                  <h3 className="text-sm font-black text-main uppercase">Haul Terminal Audit Receipts</h3>
                  <p className="text-xs text-ghost leading-normal mt-0.5">Dual-factor central warehouse stock release system. Confirm arrival and verify specs to adjust local stock (GRN Step 2).</p>
                </div>
              </div>

              <div className="space-y-4">
                {pendingTransfers.filter(t => t.to_project_id === selectedProjectId).map(trf => (
                  <div key={trf.id} className="bg-surface-2/60 border border-border-subtle p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-amber-400/20 transition-all">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-amber-400/10 rounded-xl text-amber-400">
                        <Truck className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono bg-surface-3 border border-border-subtle px-1.5 py-0.5 rounded font-black text-main">
                            {trf.id}
                          </span>
                          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest animate-pulse flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Dispatch In Transit
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-main uppercase">{trf.material_name}</h4>
                        <div className="text-[10px] text-dim flex items-center gap-2 font-mono">
                          <span>Dispatched Qty: <strong className="text-main font-extrabold">{trf.quantity} {trf.unit}</strong></span>
                          <span>•</span>
                          <span>By: {trf.created_by}</span>
                          <span>•</span>
                          <span>{new Date(trf.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {hasCapability('stock:grn_step2') ? (
                        <button
                          onClick={() => handleConfirmReceipt(trf)}
                          className="bg-primary hover:bg-primary/95 text-surface-base font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow"
                        >
                          <Check className="w-4 h-4" /> Verify Spec & Receive (GRN Step 2)
                        </button>
                      ) : (
                        <span className="text-[10px] text-dim font-bold font-mono">Requires stock:grn_step2 role</span>
                      )}
                    </div>
                  </div>
                ))}

                {pendingTransfers.filter(t => t.to_project_id === selectedProjectId).length === 0 && (
                  <div className="py-12 border-2 border-dashed border-border-subtle rounded-3xl flex flex-col items-center justify-center text-center text-dim bg-surface-2/10">
                    <CheckCircle2 className="w-10 h-10 text-primary opacity-30 mb-3 animate-bounce" />
                    <h4 className="text-xs font-black text-main uppercase">In-Transit Pipeline Clear</h4>
                    <p className="text-[10px] text-ghost leading-normal max-w-sm mt-1">There are no material dispatches from the central depot that are currently pending validation for this site store.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transaction Modal (Add / Transfer / Out) */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-surface-base/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 border-b border-border-subtle flex items-center justify-between bg-surface-2/30">
              <h2 className="text-xl font-bold text-main flex items-center gap-3 select-none">
                {showTransactionModal === 'in' ? <ArrowDownLeft className="w-5 h-5 text-primary" /> : 
                 showTransactionModal === 'out' ? <ArrowUpRight className="w-5 h-5 text-danger" /> : 
                 <ArrowLeftRight className="w-5 h-5 text-accent" />}
                Depot {showTransactionModal === 'in' ? 'GRN Intake Step 1' : showTransactionModal === 'out' ? 'Store Issue' : 'Site Store Dispatch'}
              </h2>
              <button onClick={() => setShowTransactionModal(null)} className="text-dim hover:text-main transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleTransaction} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-1.5">Stock Item Spec</label>
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
                <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-1.5">Registered Quantity</label>
                <input 
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={formData.quantity || ''}
                  onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-main focus:outline-none focus:border-primary"
                />
              </div>

              {showTransactionModal === 'transfer' ? (
                <div>
                  <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-1.5">Target Destination Site Store</label>
                  <select 
                    required
                    value={formData.target_project_id}
                    onChange={(e) => setFormData({ ...formData, target_project_id: e.target.value })}
                    className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-main focus:outline-none focus:border-primary"
                  >
                    <option value="" className="bg-surface-1">Pick project Site store...</option>
                    {projectsList.map(p => (
                      <option key={p.id} value={p.id} className="bg-surface-1">{cleanRichText(p.name)} Store ({p.project_code})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-1.5">Verification Ref Type</label>
                    <select 
                      value={formData.reference_type}
                      onChange={(e) => setFormData({ ...formData, reference_type: e.target.value })}
                      className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-main focus:outline-none focus:border-primary"
                    >
                      <option value="manual" className="bg-surface-1">Manual Entry Log</option>
                      <option value="po" className="bg-surface-1">Purchase Order (PO) Invoice</option>
                      <option value="daily_log" className="bg-surface-1">Daily Supervisor Intake</option>
                      <option value="transfer" className="bg-surface-1">Store Transfer Receipt</option>
                    </select>
                  </div>

                  {formData.reference_type !== 'manual' && (
                    <div>
                      <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-1.5">Verified Audit No / ID</label>
                      <input 
                        type="text"
                        placeholder="Log reference, order, or ticket no..."
                        value={formData.reference_id}
                        onChange={(e) => setFormData({ ...formData, reference_id: e.target.value })}
                        className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-main focus:outline-none focus:border-primary"
                      />
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-1.5">Verbal Notes / Log statement</label>
                <textarea 
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm text-main focus:outline-none focus:border-primary resize-none"
                  placeholder="Record reasons for dispatch/reception audit..."
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
                  className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-surface-base font-black rounded-lg transition-all shadow-lg shadow-primary/10"
                >
                  Confirm Audited Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
