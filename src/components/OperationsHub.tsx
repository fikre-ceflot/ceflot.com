import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
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
  Edit2,
  Loader2,
  Save,
  Terminal,
  Search,
  Database,
  Smartphone,
  ChevronRight,
  X,
  FileText,
  Trash2,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  Lock,
  Info,
  Wrench
} from 'lucide-react';
import { Project, BOQItem } from '../types';
import { cn, cleanRichText } from '../lib/utils';
import { SubcontractorProgress } from './SubcontractorProgress';
import { PaymentCertificateManager } from './PaymentCertificateManager';
import { FinancialDashboard } from './FinancialDashboard';
import { SiteApp } from './SiteApp';
import { TabBar } from './ui/TabBar';
import { recalculateBOQTreeProgress } from '../services/recalculateProgress';
import { DailyResourceLogger } from './DailyResourceLogger';
import { BOQItemEditDrawer } from './BOQItemEditDrawer';

interface OperationsHubProps {
  project: Project;
  tenantId: string;
}

export function OperationsHub({ project, tenantId }: OperationsHubProps) {
  const [activeTab, setActiveTab] = useState<'site_health' | 'daily_controls' | 'field_app' | 'subcon_progress'>('site_health');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set([
    'item_no',
    'description',
    'weightage',
    'contract_qty',
    'actual_qty',
    'progress',
    'actions'
  ]));
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  const COLUMN_LABELS = {
    item_no: 'Item No',
    description: 'Description',
    weightage: 'Weight & Value',
    contract_qty: 'Contract Qty',
    actual_qty: 'Actual Qty',
    progress: 'Progress %',
    actions: 'Actions'
  };

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('toggle-focus-mode', { detail: isFullscreen }));
  }, [isFullscreen]);

  const [colWidths, setColWidths] = useState({
    item_no: '100px',
    description: '350px',
    weightage: '150px',
    contract_qty: '120px',
    actual_qty: '120px',
    progress: '180px',
    actions: '100px'
  });

  const handleResize = (colId: string, newWidth: number) => {
    setColWidths(prev => ({
      ...prev,
      [colId]: `${Math.max(50, newWidth)}px`
    }));
  };

  const startResize = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.pageX;
    const startWidth = parseInt(colWidths[col as keyof typeof colWidths]);
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.pageX - startX;
      handleResize(col, startWidth + delta);
    };
    
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };
  const [boqItems, setBoqItems] = useState<BOQItem[]>([]);
  const [dailyCosts, setDailyCosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [activeReportTab, setActiveReportTab] = useState<'total' | 'activity_log'>('total');
  const [reportActivities, setReportActivities] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  
  // Edit Management
  const [isMassEdit, setIsMassEdit] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { actual_qty?: number; progress_pct?: number }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [drawerBoqItem, setDrawerBoqItem] = useState<any | null>(null);

  // Resources Editing Modal State
  const [editingProgressId, setEditingProgressId] = useState<string | null>(null);
  const [editingProgressDate, setEditingProgressDate] = useState<string>('');
  
  // State for choosing from multiple dates for a specific BOQ item
  const [boqResourcePickerItem, setBoqResourcePickerItem] = useState<any | null>(null);

  const toggleDate = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const toggleItem = (itemNo: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemNo)) next.delete(itemNo);
      else next.add(itemNo);
      return next;
    });
  };

  const itemsWithChildren = useMemo(() => {
    const set = new Set<string>();
    boqItems.forEach(item => {
      if (!item.item_no) return;
      const parts = item.item_no.split('.');
      if (parts.length > 1) {
        // Add all parent levels
        for (let i = 1; i < parts.length; i++) {
          set.add(parts.slice(0, i).join('.'));
        }
      }
    });
    return set;
  }, [boqItems]);

  const boqWithCalculatedWeights = useMemo(() => {
    if (!boqItems || boqItems.length === 0) return [];

    // Helper to check if item_no is a parent of another item_no
    const getDirectChildren = (parentNo: string) => {
      return boqItems.filter(child => {
        const childNo = child.item_no || '';
        if (childNo === parentNo) return false;
        if (!childNo.startsWith(parentNo + '.')) return false;
        
        // Ensure no intermediate node exists
        const intermediateExists = boqItems.some(inter => {
          const interNo = inter.item_no || '';
          return interNo !== parentNo && interNo !== childNo &&
                 childNo.startsWith(interNo + '.') && interNo.startsWith(parentNo + '.');
        });
        return !intermediateExists;
      });
    };

    // Calculate computed contract amount for each item
    // For leaves: contract_amount || (qty * rate) || 0
    // For parents: sum of direct children computed contract amount
    const memoAmount = new Map<string, number>();

    const getAmount = (itemId: string, itemNo: string): number => {
      if (memoAmount.has(itemId)) return memoAmount.get(itemId)!;

      const children = getDirectChildren(itemNo);
      if (children.length === 0) {
        // Leaf node
        const item = boqItems.find(i => i.id === itemId);
        const amt = item ? (item.contract_amount || ((item.contract_qty ?? item.quantity ?? 0) * (item.contract_rate ?? item.rate ?? 0)) || 0) : 0;
        memoAmount.set(itemId, amt);
        return amt;
      }

      // Parent node: sum of children's amounts
      let total = 0;
      children.forEach(c => {
        total += getAmount(c.id, c.item_no || '');
      });
      memoAmount.set(itemId, total);
      return total;
    };

    // Total project budget = sum of amount of root items
    // Root items are items whose item_no has no dots (parts.length === 1)
    let totalProjectBudget = 0;
    boqItems.forEach(item => {
      const parts = (item.item_no || '').split('.');
      if (parts.length === 1) {
        totalProjectBudget += getAmount(item.id, item.item_no || '');
      }
    });

    if (totalProjectBudget === 0) {
      // Fallback: sum of all items with no children (leaves)
      boqItems.forEach(item => {
        const children = getDirectChildren(item.item_no || '');
        if (children.length === 0) {
          totalProjectBudget += getAmount(item.id, item.item_no || '');
        }
      });
    }

    // Now map each item to include computed amount, sibling weight, and project weight
    return boqItems.map(item => {
      const parentParts = (item.item_no || '').split('.');
      let siblingTotal = 0;
      let siblingWeight = 0;

      const amt = getAmount(item.id, item.item_no || '');

      if (parentParts.length > 1) {
        const parentNo = parentParts.slice(0, -1).join('.');
        const siblings = getDirectChildren(parentNo);
        siblings.forEach(s => {
          siblingTotal += getAmount(s.id, s.item_no || '');
        });
        if (siblingTotal > 0) {
          siblingWeight = (amt / siblingTotal) * 100;
        }
      } else {
        // Roots: sibling total is all root items
        boqItems.forEach(s => {
          if ((s.item_no || '').split('.').length === 1) {
            siblingTotal += getAmount(s.id, s.item_no || '');
          }
        });
        if (siblingTotal > 0) {
          siblingWeight = (amt / siblingTotal) * 100;
        }
      }

      const projectWeight = totalProjectBudget > 0 ? (amt / totalProjectBudget) * 100 : 0;

      return {
        ...item,
        computed_contract_amount: amt,
        sibling_weight: siblingWeight,
        project_weight: projectWeight,
      };
    });
  }, [boqItems]);

  const overallProgressPercent = useMemo(() => {
    if (!boqWithCalculatedWeights || boqWithCalculatedWeights.length === 0) return 0;
    
    let totalWeight = 0;
    let weightedProgressTotal = 0;
    
    boqWithCalculatedWeights.forEach(item => {
      // check if it has children in the full BOQ set
      const childNoPrefix = (item.item_no || '') + '.';
      const hasChildren = boqWithCalculatedWeights.some(other => (other.item_no || '').startsWith(childNoPrefix));
      
      if (!hasChildren) {
        // leaf item
        const weight = item.project_weight || 0;
        const progress = item.progress_pct || 0;
        weightedProgressTotal += (progress * weight);
        totalWeight += weight;
      }
    });
    
    if (totalWeight === 0) return 0;
    return (weightedProgressTotal / totalWeight);
  }, [boqWithCalculatedWeights]);

  const filteredItems = useMemo(() => {
    return boqWithCalculatedWeights.filter(item => 
      (cleanRichText(item.description)).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.item_no || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [boqWithCalculatedWeights, searchTerm]);

  const displayItems = useMemo(() => {
    if (searchTerm) return filteredItems;
    
    return filteredItems.filter(item => {
      const parts = (item.item_no || '').split('.');
      if (parts.length === 1) return true;
      
      for (let i = 1; i < parts.length; i++) {
        const ancestor = parts.slice(0, i).join('.');
        if (!expandedItems.has(ancestor)) return false;
      }
      return true;
    });
  }, [filteredItems, expandedItems, searchTerm]);

  const loadActualData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('boq_items')
        .select('*')
        .eq('project_id', project.id);
      
      if (error) throw error;
      
      const sorted = (data || []).sort((a, b) => {
        return (a.item_no || '').localeCompare(b.item_no || '', undefined, { numeric: true, sensitivity: 'base' });
      });
      setBoqItems(sorted);

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

  const loadReportActivities = async () => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_activities')
        .select(`
          *,
          daily_progress!inner (id, report_date, status, project_id),
          boq_items (item_no, description, unit)
        `)
        .eq('daily_progress.project_id', project.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setReportActivities(data || []);
    } catch (e) {
      console.error('Error loading activity logs:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadActualData();
  }, [project.id]);

  useEffect(() => {
    if (activeTab === 'daily_controls') {
      loadReportActivities();
    }
  }, [project.id, activeTab]);

  const handleActivityUpdate = async (activityId: string, newQty: number) => {
    try {
      // 1. Fetch exact original daily activity record to find difference and BOQ item ID
      const { data: originalAct, error: fetchErr } = await supabase
        .from('daily_activities')
        .select('boq_item_id, progress_qty')
        .eq('id', activityId)
        .single();
      
      if (fetchErr) throw fetchErr;
      if (!originalAct) throw new Error('Activity record not found');

      // 2. Update the daily_activities table with the new quantity
      const { error } = await supabase
        .from('daily_activities')
        .update({ progress_qty: newQty })
        .eq('id', activityId);
      
      if (error) throw error;

      // 3. Update boq_items.actual_qty and progress_pct in sync
      const { data: boq } = await supabase
        .from('boq_items')
        .select('actual_qty, contract_qty')
        .eq('id', originalAct.boq_item_id)
        .single();

      if (boq) {
        const diff = newQty - (originalAct.progress_qty || 0);
        const newActualQty = Math.max(0, (boq.actual_qty || 0) + diff);
        const newPct = Math.min(100, (newActualQty / (boq.contract_qty || 1)) * 100);
        
        await supabase.from('boq_items').update({
          actual_qty: newActualQty,
          progress_pct: newPct,
          status: newPct === 100 ? 'complete' : (newPct > 0 ? 'in_progress' : 'pending')
        }).eq('id', originalAct.boq_item_id);
      }
      
      await recalculateBOQTreeProgress(project.id, supabase);
      loadReportActivities();
      loadActualData(); // Refresh totals
    } catch (e: any) {
      alert('Error updating activity: ' + e.message);
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this daily progress activity log? This will adjust the actual quantities on the BOQ list and cannot be undone.')) return;
    try {
      const { data: act } = await supabase.from('daily_activities').select('boq_item_id, progress_qty').eq('id', id).single();
      const { error } = await supabase.from('daily_activities').delete().eq('id', id);
      if (error) throw error;

      if (act) {
        const { data: boq } = await supabase.from('boq_items').select('actual_qty, contract_qty').eq('id', act.boq_item_id).single();
        if (boq) {
          const newQty = Math.max(0, (boq.actual_qty || 0) - (act.progress_qty || 0));
          const newPct = Math.min(100, (newQty / (boq.contract_qty || 1)) * 100);
          await supabase.from('boq_items').update({
            actual_qty: newQty,
            progress_pct: newPct,
            status: newPct === 100 ? 'complete' : (newPct > 0 ? 'in_progress' : 'pending')
          }).eq('id', act.boq_item_id);
        }
      }

      await recalculateBOQTreeProgress(project.id, supabase);
      setReportActivities(prev => prev.filter(a => a.id !== id));
      loadActualData();
    } catch (err: any) {
      alert('Error deleting activity: ' + err.message);
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

      await recalculateBOQTreeProgress(project.id, supabase);
      return true;
    } catch (e: any) {
      console.error('Error updating BOQ item:', e.message);
      return false;
    }
  };

  const handleSaveAll = async () => {
    if (Object.keys(drafts).length === 0) {
      setIsMassEdit(false);
      setEditingItemId(null);
      return;
    }

    setIsSaving(true);
    try {
      const promises = Object.entries(drafts).map(([id, updates]) => handleOverride(id, updates));
      const results = await Promise.all(promises);
      
      if (results.every(r => r === true)) {
        setDrafts({});
        setIsMassEdit(false);
        setEditingItemId(null);
        await loadActualData();
      } else {
        alert('Some items failed to save. Please check your connection and try again.');
      }
    } catch (e: any) {
      alert('Error saving changes: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const updateDraft = (itemId: string, updates: { actual_qty?: number; progress_pct?: number }) => {
    setDrafts(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        ...updates
      }
    }));
  };

  const renderExecutionControls = () => {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        {!isFullscreen && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-black text-main flex items-center gap-1.5 uppercase tracking-widest flex-wrap">
                <Database className="w-5 h-5 text-primary" />
                <span>Execution Control Center</span>
              </h2>
              <p className="text-[10px] text-ghost opacity-60 font-bold uppercase tracking-tighter mt-0.5">Validate reported site data or perform manual overrides</p>
            </div>

            {/* Total Project Weighted Progress Indicator */}
            <div className="flex-1 max-w-xs bg-surface-1 border border-border-subtle rounded-xl p-2.5 flex items-center gap-3">
               <div className="flex-1">
                  <div className="flex justify-between text-[9px] font-black uppercase tracking-wider text-ghost mb-1">
                     <span>Total Progress</span>
                     <span className="text-primary font-mono font-black">{overallProgressPercent.toFixed(2)}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                     <div className="h-full bg-primary transition-all duration-500" style={{ width: `${overallProgressPercent}%` }} />
                  </div>
               </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex bg-surface-base border border-border-subtle p-1 rounded-xl shadow-inner backdrop-blur-sm">
                 <button 
                   onClick={() => setActiveReportTab('total')}
                   className={cn(
                     "px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                     activeReportTab === 'total' 
                       ? "bg-primary text-white shadow-[0_4px_12px_rgba(var(--primary-rgb),0.3)] scale-[1.02]" 
                       : "text-ghost hover:text-main hover:bg-surface-base"
                   )}
                 >
                   BOQ Totals
                 </button>
                 <button 
                   onClick={() => setActiveReportTab('activity_log')}
                   className={cn(
                     "px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                     activeReportTab === 'activity_log' 
                       ? "bg-primary text-white shadow-[0_4px_12px_rgba(var(--primary-rgb),0.3)] scale-[1.02]" 
                       : "text-ghost hover:text-main hover:bg-surface-base"
                   )}
                 >
                   Activity Logs
                 </button>
              </div>
            </div>
          </div>
        )}

        {activeReportTab === 'total' ? (
          <div className={cn(
            "bg-surface-1 border border-border-subtle rounded-xl flex flex-col transition-all",
            isFullscreen ? "flex-1 min-h-0" : "overflow-hidden shadow-sm"
          )}>
            <div className="p-3 border-b border-border-subtle bg-surface-2 flex items-center justify-between h-14 relative">
               <div className="flex items-center gap-3 flex-1 max-w-xl">
                 <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ghost" />
                    <input 
                      type="text"
                      placeholder="Filter BOQ by No or description..."
                      className="w-full bg-transparent border border-border-subtle rounded-md py-1 pl-8 pr-3 text-[11px] font-light outline-none focus:border-primary/50 transition-all h-8 text-main placeholder-ghost/70"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                
                {isMassEdit || editingItemId || Object.keys(drafts).length > 0 ? (
                  <div className="flex items-center gap-2 animate-in zoom-in duration-300">
                    <button 
                      onClick={handleSaveAll}
                      disabled={isSaving}
                      className="btn btn-primary btn-sm h-8 px-3 text-[11px] font-bold uppercase tracking-wider animate-in fade-in flex items-center gap-1.5 rounded-md"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save All
                    </button>
                    <button 
                      onClick={() => {
                        setIsMassEdit(false);
                        setEditingItemId(null);
                        setDrafts({});
                      }}
                      className="btn btn-ghost btn-sm h-8 px-3 text-[11px] font-bold text-ghost uppercase tracking-wider hover:bg-surface-3 transition-all rounded-md"
                    >
                      Discard
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsMassEdit(true)}
                    className="btn btn-secondary btn-sm h-8 px-3 text-[11px] font-bold uppercase tracking-wider transition-all shadow-sm rounded-md flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" />
                    Mass Edit
                  </button>
                )}
              </div>

              <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
                <button 
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 h-8 rounded-md border transition-all shadow-inner font-bold uppercase tracking-wider text-[11px]",
                    isFullscreen 
                      ? "bg-primary text-white border-primary hover:bg-primary/95" 
                      : "bg-surface-base border-border-subtle text-main hover:text-primary hover:border-primary/40"
                  )}
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  <span>{isFullscreen ? 'Shrink' : 'Expand'}</span>
                </button>
              </div>

              {!isFullscreen && (
                <button 
                  onClick={loadActualData}
                  className="btn btn-ghost btn-sm h-8 px-3 text-[11px] font-bold text-primary uppercase tracking-wider hover:bg-surface-3 transition-all rounded-md flex items-center gap-1.5"
                >
                  Sync Totals
                  <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                </button>
              )}
            </div>
            <div className={cn(
              "overflow-x-auto overflow-y-auto custom-scrollbar transition-all",
              isFullscreen ? "flex-1" : "max-h-[70vh]"
            )}>
              <table className="w-full text-left border-collapse table-fixed">
                <thead className="sticky top-0 z-20 bg-surface-base border-b border-border-subtle">
                  <tr>
                    <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost relative group/col bg-surface-base border-b border-border-subtle" style={{ width: colWidths.item_no }}>
                      Item No
                      <div 
                        onMouseDown={(e) => startResize('item_no', e)} 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer"
                      >
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                      </div>
                    </th>
                    <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost relative group/col bg-surface-base border-b border-border-subtle" style={{ width: colWidths.description }}>
                      Description
                      <div 
                        onMouseDown={(e) => startResize('description', e)} 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer"
                      >
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                      </div>
                    </th>
                    <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost text-right relative group/col bg-surface-base border-b border-border-subtle" style={{ width: colWidths.weightage }}>
                      Weight & Value
                      <div 
                        onMouseDown={(e) => startResize('weightage', e)} 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer"
                      >
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                      </div>
                    </th>
                    <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost text-right relative group/col bg-surface-base border-b border-border-subtle" style={{ width: colWidths.contract_qty }}>
                      Contract Qty
                      <div 
                        onMouseDown={(e) => startResize('contract_qty', e)} 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer"
                      >
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                      </div>
                    </th>
                    <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost text-right relative group/col bg-surface-base border-b border-border-subtle" style={{ width: colWidths.actual_qty }}>
                      Actual Qty
                      <div 
                        onMouseDown={(e) => startResize('actual_qty', e)} 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer"
                      >
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                      </div>
                    </th>
                    <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost text-center relative group/col bg-surface-base border-b border-border-subtle" style={{ width: colWidths.progress }}>
                      Progress %
                      <div 
                        onMouseDown={(e) => startResize('progress', e)} 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer"
                      >
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                      </div>
                    </th>
                    <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost text-right relative group/col bg-surface-base border-b border-border-subtle" style={{ width: colWidths.actions }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {displayItems.map(item => {
                    const level = (item.item_no || '').split('.').length - 1;
                    const hasChildren = itemsWithChildren.has(item.item_no || '');
                    const isExpanded = expandedItems.has(item.item_no || '');
                    const isEditing = isMassEdit || editingItemId === item.id;

                    return (
                      <tr key={item.id} className={cn(
                        "hover:bg-primary/[0.02] transition-colors group h-auto min-h-[2.5rem] border-b border-border-subtle/30",
                        isEditing && "bg-primary/[0.03]"
                      )}>
                         <td className="px-4 py-1.5 text-[10px] font-mono border-r border-border-subtle/20" style={{ width: colWidths.item_no }}>
                          <div className="flex items-start gap-1.5 pt-0.5" style={{ paddingLeft: `${level * 12}px` }}>
                            {hasChildren ? (
                              <button 
                                onClick={() => toggleItem(item.item_no || '')}
                                className="w-5 h-5 flex items-center justify-center text-primary hover:bg-primary/10 rounded transition-all shrink-0"
                              >
                                <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", isExpanded && "rotate-90")} />
                              </button>
                            ) : (
                              <div className="w-5 shrink-0" />
                            )}
                             <span className={cn(
                              "break-all transition-opacity text-[11px] font-mono",
                              hasChildren ? "font-semibold text-accent" : "font-normal text-dim",
                              level > 0 && "opacity-60"
                            )}>{item.item_no}</span>
                          </div>
                        </td>
                        <td className="px-4 py-1.5 border-r border-border-subtle/20" style={{ width: colWidths.description }}>
                          <div className={cn(
                            "whitespace-normal leading-[1.3] break-words tracking-tight",
                            hasChildren ? "text-[13px] font-semibold text-main" : "text-[12px] font-normal text-dim/90"
                          )}>
                            {cleanRichText(item.description)}
                          </div>
                          {level === 0 && (
                            <div className="text-[8px] text-ghost opacity-60 uppercase font-semibold tracking-widest mt-0.5">
                              {item.section_group}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-1.5 text-right border-r border-border-subtle/20" style={{ width: colWidths.weightage }}>
                          <div className="flex flex-col items-end justify-center leading-tight">
                            <span className={cn(
                              "font-bold font-mono tracking-tight",
                              hasChildren ? "text-amber-500 font-extrabold text-[12px]" : "text-main font-medium text-[11px]"
                            )}>
                              ${(item.computed_contract_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                            <span className="text-[10px] text-ghost opacity-85 mt-0.5 select-none font-mono tracking-tight">
                              {item.project_weight > 0 ? `${item.project_weight.toFixed(1)}% ` : '0% '}
                              <span className="text-[8px] opacity-75">total</span>
                              {item.sibling_weight !== item.project_weight && item.sibling_weight > 0 && (
                                <span className={cn(
                                  "text-[9px] ml-1.5 font-bold",
                                  hasChildren ? "text-primary/95" : "text-primary/80"
                                )}>
                                  ({item.sibling_weight.toFixed(0)}% <span className="text-[8px] font-normal">sub</span>)
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                      <td className="px-4 py-1.5 text-[11px] font-mono text-main text-right border-r border-border-subtle/20" style={{ width: colWidths.contract_qty }}>
                        {(!hasChildren && item.contract_qty && item.contract_qty > 0) ? (
                          <div className="whitespace-normal leading-tight font-semibold">{item.contract_qty?.toLocaleString()} <span className="text-ghost text-[10px] font-normal">{cleanRichText(item.unit)}</span></div>
                        ) : null}
                      </td>
                      <td className="px-4 py-1.5 text-right border-r border-border-subtle/20" style={{ width: colWidths.actual_qty }}>
                        <div className="flex justify-end">
                          {hasChildren ? (() => {
                            const qtyVal = drafts[item.id]?.actual_qty ?? item.actual_qty ?? 0;
                            if (qtyVal <= 0) return null;
                            return (
                              <div className="text-[11px] font-mono font-bold text-amber-500 px-2 py-1 select-none cursor-not-allowed opacity-85" title="Auto-calculated via weighted contract value">
                                <span>{qtyVal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                              </div>
                            );
                          })() : (
                            <input 
                              type="number"
                              value={drafts[item.id]?.actual_qty ?? item.actual_qty ?? 0}
                              disabled={!isEditing}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                updateDraft(item.id, { 
                                  actual_qty: val,
                                  progress_pct: (item.contract_qty || 1) > 0 ? (val / item.contract_qty) * 100 : 0
                                });
                              }}
                              className={cn(
                                "bg-transparent border rounded-md px-2 py-0.5 text-xs font-mono font-light text-main w-full max-w-[100px] text-right outline-none transition-all h-8",
                                isEditing 
                                  ? "border-primary focus:border-primary/50" 
                                  : "border-border-subtle/30 opacity-70 cursor-not-allowed text-dim"
                              )}
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-1.5 border-r border-border-subtle/20" style={{ width: colWidths.progress }}>
                        <div className="flex items-center gap-3 w-full">
                          {hasChildren ? (() => {
                            const pctVal = Math.round(drafts[item.id]?.progress_pct ?? item.progress_pct ?? 0);
                            if (pctVal <= 0) return null;
                            return (
                              <div className="flex items-center gap-3 w-full">
                                <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-amber-500 select-none cursor-not-allowed opacity-85" title="Auto-calculated via weighted contract value">
                                  <span>{pctVal}%</span>
                                  <span className="text-[9px] text-ghost font-normal italic ml-1">Auto</span>
                                </div>
                                <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden min-w-[50px] shadow-inner border border-border-subtle/20">
                                  <div className="h-full bg-amber-500 transition-all duration-700" style={{ width: `${pctVal}%` }} />
                                </div>
                              </div>
                            );
                          })() : (
                            <>
                              <input 
                                type="number"
                                value={Math.round(drafts[item.id]?.progress_pct ?? item.progress_pct ?? 0)}
                                disabled={!isEditing}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  updateDraft(item.id, { 
                                    progress_pct: val,
                                    actual_qty: ((item.contract_qty || 0) * val) / 100
                                  });
                                }}
                                className={cn(
                                  "bg-transparent border rounded-md px-1.5 py-0.5 text-[11px] font-mono font-light text-main w-14 text-center outline-none transition-all h-8",
                                  isEditing 
                                    ? "border-primary ring-2 ring-primary/10 focus:ring-primary/30" 
                                    : "border-border-subtle/30 opacity-70 cursor-not-allowed text-dim"
                                )}
                              />
                              <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden min-w-[50px] shadow-inner border border-border-subtle/20">
                                 <div className={cn(
                                    "h-full transition-all duration-700",
                                    (drafts[item.id]?.progress_pct ?? item.progress_pct ?? 0) >= 100 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-primary"
                                 )} style={{ width: `${drafts[item.id]?.progress_pct ?? item.progress_pct ?? 0}%` }} />
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-1.5 text-right" style={{ width: colWidths.actions }}>
                        <div className="flex items-center justify-end gap-1">
                          {hasChildren ? null : (
                            <button 
                              onClick={() => setDrawerBoqItem(item)}
                              className="p-1 px-2 text-ghost hover:text-primary hover:bg-primary/5 transition-all rounded-xl border border-transparent h-8 flex items-center justify-center"
                              title="Edit Logged Materials, Machineries, Labours & Progress"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              setSearchTerm(item.item_no || '');
                              setActiveReportTab('activity_log');
                            }}
                            className="p-1 px-2 text-ghost hover:text-primary hover:bg-primary/5 transition-all rounded-xl border border-transparent h-8 flex items-center justify-center"
                            title="View Logs"
                          >
                            <Activity className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden shadow-sm">
             <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-surface-2/50">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-ghost">Project Activity Streams</h3>
                <button 
                  onClick={loadReportActivities}
                  className="p-2 text-ghost hover:text-primary transition-all"
                >
                  <RefreshCw className={cn("w-4 h-4", historyLoading && "animate-spin")} />
                </button>
             </div>
             <div className="p-4 space-y-3">
                {reportActivities.length === 0 ? (
                  <div className="py-20 text-center text-ghost italic text-xs">No activity logs found for this project.</div>
                ) : Object.entries(
                  reportActivities.reduce((acc, act) => {
                    const date = act.daily_progress?.report_date || 'Unknown Date';
                    if (!acc[date]) acc[date] = [];
                    acc[date].push(act);
                    return acc;
                  }, {} as Record<string, any[]>)
                ).sort(([a], [b]) => b.localeCompare(a)).map(([date, dailyActivities]: [string, any]) => {
                  const items = dailyActivities as any[];
                  const isExpanded = expandedDates.has(date);
                  return (
                    <div key={date} className="border border-border-subtle rounded-xl overflow-hidden bg-surface-base shadow-sm">
                      <button 
                        onClick={() => toggleDate(date)}
                        className="w-full flex items-center justify-between p-3 bg-surface-2 hover:bg-surface-3 transition-colors border-b border-border-subtle"
                      >
                         <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-main uppercase tracking-widest">{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            <span className="text-[10px] font-bold text-ghost bg-surface-base px-2 py-0.5 rounded-full border border-border-subtle">{items.length} Activities</span>
                         </div>
                         <ChevronRight className={cn("w-4 h-4 text-ghost transition-transform", isExpanded && "rotate-90")} />
                      </button>
                      
                      {isExpanded && (
                        <div className="overflow-x-auto">
                           <table className="w-full text-left border-collapse">
                             <thead>
                               <tr className="bg-surface-1 border-b border-border-subtle font-mono text-[9px] uppercase tracking-widest text-ghost">
                                 <th className="px-4 py-2">BOQ Item</th>
                                 <th className="px-4 py-2 text-right">Reported Qty</th>
                                 <th className="px-4 py-2 text-center">Status</th>
                                 <th className="px-4 py-2 text-right">Actions</th>
                               </tr>
                             </thead>
                             <tbody className="divide-y divide-border-subtle">
                               {items.map(activity => (
                                 <tr key={activity.id} className="hover:bg-primary/[0.02] transition-colors">
                                   <td className="px-4 py-1.5">
                                     <div className="flex items-start gap-3 pt-0.5">
                                       <span className="text-[9px] font-mono font-black text-primary px-1 py-0.5 bg-primary/5 border border-primary/10 rounded-md shrink-0">{activity.boq_items?.item_no}</span>
                                       <div className="text-[10px] font-bold text-main whitespace-normal leading-tight">{cleanRichText(activity.boq_items?.description)}</div>
                                     </div>
                                   </td>
                                   <td className="px-4 py-1.5 text-right">
                                     <input 
                                       type="number"
                                       defaultValue={activity.progress_qty}
                                       onBlur={(e) => {
                                         const val = parseFloat(e.target.value);
                                         if (val !== activity.progress_qty) {
                                           handleActivityUpdate(activity.id, val);
                                         }
                                       }}
                                       className="bg-surface-base border border-border-subtle rounded-lg px-2 py-0.5 text-[10px] font-mono font-black text-primary w-20 text-right outline-none focus:border-primary transition-all shadow-inner h-6"
                                     />
                                   </td>
                                   <td className="px-4 py-1.5 text-center">
                                     <span className={cn(
                                       "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border",
                                       activity.daily_progress?.status === 'reviewed' 
                                        ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                                        : "bg-blue-50 text-blue-600 border-blue-100"
                                     )}>
                                       {activity.daily_progress?.status}
                                     </span>
                                   </td>
                                   <td className="px-4 py-1.5 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <button 
                                          onClick={() => handleDeleteLog(activity.id)}
                                          className="p-1.5 text-ghost hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-all"
                                          title="Delete Log"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                         </button>
                                         <button 
                                           onClick={() => {
                                             setEditingProgressId(activity.daily_progress_id);
                                             setEditingProgressDate(activity.daily_progress?.report_date || '');
                                           }}
                                           className="p-1.5 text-ghost hover:text-primary rounded-lg hover:bg-primary/5 transition-all"
                                           title="Edit Logged Materials, Machineries & Labours"
                                         >
                                           <Wrench className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                   </td>
                                 </tr>
                               ))}
                             </tbody>
                           </table>
                        </div>
                      )}
                    </div>
                  );
                })}
             </div>
          </div>
        )}

        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
          <Terminal className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-primary">Execution Sync Engine</span>
            <p className="text-[11px] text-primary/70 leading-relaxed">
              Updates to individual Activity Logs are automatically summed into the BOQ Totals. Use "Activity Logs" to rectify specific reporting errors from the site.
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
    const financeHealth = evm.cpi >= 1 ? 'Stable' : evm.cpi > 0.9 ? 'Warning' : 'Overrun';

    return (
      <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-400">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { 
              label: 'Schedule Health', 
              val: scheduleHealth, 
              detail: `${Math.round(evm.spi * 100)}% SPI`,
              icon: TrendingUp,
              color: scheduleHealth === 'Healthy' ? "text-primary bg-primary/10 border-primary/20" : scheduleHealth === 'Warning' ? "text-warning bg-warning/10 border-warning/20" : "text-danger bg-danger/10 border-danger/20"
            },
            { 
              label: 'Financial Health', 
              val: financeHealth, 
              detail: `${Math.round(evm.cpi * 100)}% CPI`,
              icon: Wallet,
              color: evm.cpi >= 1 ? "text-primary bg-primary/10 border-primary/20" : evm.cpi > 0.9 ? "text-warning bg-warning/10 border-warning/20" : "text-danger bg-danger/10 border-danger/20"
            },
            { 
              label: 'Execution Security', 
              val: criticalAlerts === 0 ? 'Secure' : 'At Risk', 
              detail: `${criticalAlerts} Active Alerts`,
              icon: ShieldAlert,
              color: criticalAlerts === 0 ? "text-primary bg-primary/10 border-primary/20" : "text-danger bg-danger/10 border-danger/20"
            },
            { 
              label: 'BAC Management', 
              val: fmt(evm.bac), 
              detail: `Forecasted: ${fmt(evm.eac)}`,
              icon: Gauge,
              color: "text-ghost bg-surface-2 border-border-subtle"
            }
          ].map((card, i) => (
            <div key={i} className={cn("p-4 rounded-xl border flex items-center gap-4 transition-all hover:shadow-md", card.color)}>
              <div className="w-10 h-10 rounded-lg bg-surface-base/50 flex items-center justify-center">
                <card.icon className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{card.label}</span>
                <span className="text-sm font-black text-main">{card.val}</span>
                <span className="text-[9px] font-bold opacity-70 mt-0.5">{card.detail}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 bg-surface-1 border border-border-subtle rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xs font-black text-main uppercase tracking-widest">Execution Pulse</h3>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                   <div className="w-2 h-2 rounded-full bg-primary" />
                   <span className="text-[9px] font-bold text-ghost uppercase">Value</span>
                </div>
                <div className="flex items-center gap-1.5 ml-2">
                   <div className="w-2 h-2 rounded-full bg-warning" />
                   <span className="text-[9px] font-bold text-ghost uppercase">Cost</span>
                </div>
              </div>
            </div>
            <div className="space-y-5">
               {[
                 { label: 'BOQ EARNED VALUE', sub: 'Calculated from site reports', val: (evm.ev / evm.bac) * 100, color: 'bg-primary' },
                 { label: 'BUDGET UTILIZATION', sub: 'Total actual costs incurred', val: (evm.ac / evm.bac) * 100, color: 'bg-warning' },
                 { label: 'PROJECT TIME ELAPSED', sub: 'Duration since mobilization', val: 45, color: 'bg-ghost' }
               ].map(stat => (
                 <div key={stat.label} className="space-y-1.5">
                   <div className="flex justify-between items-end">
                     <div>
                       <span className="text-[10px] font-black text-main block">{stat.label}</span>
                       <span className="text-[9px] text-ghost font-medium">{stat.sub}</span>
                     </div>
                     <span className="text-xs font-bold text-main">{Math.round(stat.val)}%</span>
                   </div>
                   <div className="h-1.5 bg-surface-base border border-border-subtle rounded-full overflow-hidden">
                     <div className={cn("h-full transition-all duration-700", stat.color)} style={{ width: `${stat.val}%` }} />
                   </div>
                 </div>
               ))}
            </div>
          </div>
          
          <div className="lg:col-span-5 flex flex-col gap-4">
             <div className="flex-1 bg-surface-1 border border-border-subtle rounded-2xl p-5 shadow-sm">
                <h3 className="text-xs font-black text-main uppercase tracking-widest mb-4">Operations Feed</h3>
                <div className="space-y-3">
                   {[
                     { icon: FileCheck, text: "Valuations matched with site actuals", time: "2h ago" },
                     { icon: Users, text: "Subcontractor audit results uploaded", time: "5h ago" },
                     { icon: Package, text: "Material inventory reconciled", time: "1d ago" }
                   ].map((item, i) => (
                     <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-base border border-border-subtle group hover:border-primary/30 transition-all">
                        <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary transition-all group-hover:text-white">
                           <item.icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                           <p className="text-[11px] font-bold text-main leading-tight">{item.text}</p>
                           <p className="text-[9px] text-ghost mt-0.5">{item.time}</p>
                        </div>
                        <ArrowRight className="w-3 h-3 text-ghost opacity-0 group-hover:opacity-100 transition-all" />
                     </div>
                   ))}
                </div>
             </div>
             <button onClick={() => setActiveTab('site_health')} className="btn btn-primary btn-sm h-11 w-full rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20">
               Access Intelligence Pipeline
             </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDetailedAnalytics = () => {
    return (
      <div className="flex flex-col gap-8 animate-in fade-in duration-500">
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-surface-base border border-border-subtle rounded-2xl p-5">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xs font-black text-main uppercase tracking-widest">Efficiency Trends</h3>
                </div>
                <div className="flex gap-6">
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-ghost uppercase block mb-1">CPI</span>
                    <span className={cn("text-lg font-black", evm.cpi >= 1 ? "text-primary" : "text-danger")}>{evm.cpi.toFixed(2)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-ghost uppercase block mb-1">SPI</span>
                    <span className={cn("text-lg font-black", evm.spi >= 1 ? "text-primary" : "text-warning")}>{evm.spi.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              <div className="h-44 flex items-end gap-2 px-2">
                {/* Mock chart bars for trends */}
                {[0.8, 0.9, 0.85, 1.1, 1.05, 0.95, evm.cpi].map((val, idx) => (
                  <div key={idx} className="flex-1 flex flex-col gap-1 items-center">
                    <div className="w-full bg-primary/30 rounded-t-sm" style={{ height: `${Math.min(val * 80, 140)}px` }} />
                    <div className="w-full bg-accent/30 rounded-t-sm" style={{ height: `${Math.min((val - 0.1) * 70, 130)}px` }} />
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

  const [siteAppRole, setSiteAppRole] = useState<any>('site_encoder');

  const renderSiteControl = () => {
    return (
      <div className="flex flex-col gap-10 animate-in fade-in duration-500" style={{ marginLeft: '0px' }}>
        {/* Site App Office Access - Integrated Control */}
        <section className="bg-surface-1 border border-border-subtle rounded-3xl overflow-hidden shadow-xl">
           <div className="p-4 bg-surface-2 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-bold text-main">Live Site App Control (Office Access)</h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex bg-surface-1 border border-border-subtle rounded-lg p-1">
                  <button 
                    onClick={() => setSiteAppRole('site_encoder')}
                    className={cn(
                      "px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all",
                      siteAppRole === 'site_encoder' ? "bg-primary text-white" : "text-ghost"
                    )}
                  >
                    Encoder View
                  </button>
                  <button 
                    onClick={() => setSiteAppRole('storeman')}
                    className={cn(
                      "px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all",
                      siteAppRole === 'storeman' ? "bg-primary text-white" : "text-ghost"
                    )}
                  >
                    Store View
                  </button>
                  <button 
                    onClick={() => setSiteAppRole('procurement')}
                    className={cn(
                      "px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all",
                      siteAppRole === 'procurement' ? "bg-primary text-white" : "text-ghost"
                    )}
                  >
                    Procurement View
                  </button>
                  <button 
                    onClick={() => setSiteAppRole('tenant_admin')}
                    className={cn(
                      "px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all",
                      siteAppRole === 'tenant_admin' ? "bg-primary text-white" : "text-ghost"
                    )}
                  >
                    Admin View
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-[10px] font-bold text-ghost uppercase tracking-widest">Active Remote Link</span>
                </div>
              </div>
           </div>
           <div className="p-6">
              <SiteApp project={project} tenantId={tenantId} isEmbedded forcedRole={siteAppRole} key={siteAppRole} />
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
                   <label className="text-[10px] font-bold text-ghost uppercase tracking-tighter">Company Hub ID</label>
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
    <div className="flex flex-col gap-8" style={{ marginLeft: '0px' }}>
      {!isFullscreen && (
         <header className="flex flex-col gap-6 mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
               <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                     <div className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded text-[9px] font-semibold text-primary uppercase tracking-wider">{project.project_code}</div>
                     <span className="text-[9px] font-semibold text-ghost uppercase tracking-[0.2em]">Project Execution</span>
                  </div>
                  <h1 className="text-lg font-semibold tracking-tight text-main">{project.name}</h1>
               </div>
            </div>

            <div className="flex items-center gap-4 ml-auto">
              {/* Dynamic Helpful Information Card (Aligned Right) */}
              {activeTab === 'site_health' && (
                <div className="flex flex-col gap-1 text-right border-r border-border-subtle pr-4 h-10 justify-center">
                  <div className="text-[10px] font-semibold text-ghost uppercase tracking-wider font-mono">SITE HEALTH REPORT</div>
                  <div className="flex items-center gap-2 justify-end">
                     <span className="px-1.5 py-0.25 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-semibold text-emerald-500 select-none uppercase tracking-wider">HEALTHY</span>
                     <div className="h-1 w-1 rounded-full bg-border-subtle" />
                     <span className="text-[9px] font-medium text-dim uppercase tracking-wider font-mono">CPI: {evm.cpi.toFixed(2)} | SPI: {evm.spi.toFixed(2)}</span>
                  </div>
                </div>
              )}
              {activeTab === 'daily_controls' && (
                <div className="flex flex-col gap-1 text-right border-r border-border-subtle pr-4 h-10 justify-center">
                  <div className="text-[10px] font-semibold text-ghost uppercase tracking-wider font-mono">EXECUTION CONTROL LEDGER</div>
                  <div className="flex items-center gap-2 justify-end">
                     <span className="px-1.5 py-0.25 rounded bg-primary/10 border border-primary/20 text-[9px] font-semibold text-primary select-none uppercase tracking-wider">ACTIVE</span>
                     <div className="h-1 w-1 rounded-full bg-border-subtle" />
                     <span className="text-[9px] font-medium text-dim uppercase tracking-wider font-mono">Overall Progress: {overallProgressPercent.toFixed(2)}%</span>
                  </div>
                </div>
              )}
              {activeTab === 'field_app' && (
                <div className="flex flex-col gap-1 text-right border-r border-border-subtle pr-4 h-10 justify-center">
                  <div className="text-[10px] font-semibold text-ghost uppercase tracking-wider font-mono">FIELD APPLICATION LINK</div>
                  <div className="flex items-center gap-2 justify-end">
                     <span className="px-1.5 py-0.25 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] font-semibold text-amber-500 select-none uppercase tracking-wider">ONLINE</span>
                     <div className="h-1 w-1 rounded-full bg-border-subtle" />
                     <span className="text-[9px] font-medium text-dim uppercase tracking-wider font-mono">Build v2.4.1</span>
                  </div>
                </div>
              )}
              {activeTab === 'subcon_progress' && (
                <div className="flex flex-col gap-1 text-right border-r border-border-subtle pr-4 h-10 justify-center">
                  <div className="text-[10px] font-semibold text-ghost uppercase tracking-wider font-mono">SUBCONTRACTOR REGISTRY</div>
                  <div className="flex items-center gap-2 justify-end">
                     <span className="px-1.5 py-0.25 rounded bg-purple-500/10 border border-purple-500/20 text-[9px] font-semibold text-purple-500 select-none uppercase tracking-wider">MANAGED</span>
                     <div className="h-1 w-1 rounded-full bg-border-subtle" />
                     <span className="text-[9px] font-medium text-dim uppercase tracking-wider font-mono">Active Capacity: 84%</span>
                  </div>
                </div>
              )}

              <button onClick={loadActualData} className="btn btn-secondary btn-sm h-10 w-10 p-0 rounded-xl" title="Refresh project status and statistics">
                 <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </button>
            </div>
          </div>

          <div className="pb-2 border-b border-border-subtle">
            <TabBar 
              tabs={[
                { id: 'site_health', label: 'Site Health', icon: Gauge },
                { id: 'daily_controls', label: 'Daily Controls', icon: Database },
                { id: 'field_app', label: 'Field App', icon: Smartphone },
                { id: 'subcon_progress', label: 'Subcontractor Progress', icon: Users }
              ]}
              activeTab={activeTab}
              onChange={setActiveTab}
            />
          </div>
        </header>
      )}

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : activeTab === 'site_health' ? (
        <div className="space-y-8 animate-in fade-in duration-500">
          {renderOverallHealth()}
          <div className="border-t border-border-subtle pt-8">
            <div className="mb-4">
              <h2 className="text-sm font-black uppercase text-accent tracking-widest">Dynamic EVM & Advanced Analytics</h2>
              <p className="text-[10px] text-ghost mt-0.5">Real-time Earned Value Management projections computed from BoQ surveyed outputs and actual progress updates.</p>
            </div>
            {renderDetailedAnalytics()}
          </div>
        </div>
      ) : activeTab === 'daily_controls' ? (
        renderExecutionControls()
      ) : activeTab === 'field_app' ? (
        renderSiteControl()
      ) : activeTab === 'subcon_progress' ? (
        renderSubcontractorsSection()
      ) : null}

      {/* If BOQ item is clicked to edit resources, and there are multiple logs, show a quick-selection modal */}
      {boqResourcePickerItem && (
        <div className="fixed inset-0 bg-surface-base/80 backdrop-blur-sm z-[90] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface-1 border border-border-subtle rounded-2xl max-w-sm w-full shadow-2xl relative overflow-hidden flex flex-col">
            <div className="p-4 bg-surface-2 border-b border-border-subtle flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-ghost uppercase tracking-widest">Select Report Date</h4>
                <div className="text-xs font-bold text-main mt-0.5 truncate max-w-[200px]">{cleanRichText(boqResourcePickerItem.description)}</div>
              </div>
              <button 
                onClick={() => setBoqResourcePickerItem(null)}
                className="p-1-2 text-ghost hover:text-main hover:bg-surface-3 rounded-lg transition-colors border border-transparent"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 max-h-60 overflow-y-auto flex flex-col gap-2">
              {boqResourcePickerItem.logs.map((log: any) => (
                <button
                  key={log.id}
                  onClick={() => {
                    setEditingProgressId(log.daily_progress_id);
                    setEditingProgressDate(log.daily_progress?.report_date || '');
                    setBoqResourcePickerItem(null);
                  }}
                  className="w-full p-2.5 font-semibold text-xs text-left bg-surface-2 hover:bg-primary/[0.04] hover:text-primary border border-border-subtle hover:border-primary/40 rounded-xl transition-all flex items-center justify-between gap-4 group"
                >
                  <div>
                    <span className="font-bold block tracking-tight text-main">
                      {new Date(log.daily_progress?.report_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="text-[10px] text-ghost block font-normal mt-0.5">
                      Logged Qty: {log.progress_qty} {cleanRichText(boqResourcePickerItem.unit)}
                    </span>
                  </div>
                  <div className="text-[9px] uppercase font-black tracking-wider text-ghost group-hover:text-primary transition-colors">
                    Edit &rarr;
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Daily resource logger modal */}
      {editingProgressId && (
        <DailyResourceLogger
          dailyProgressId={editingProgressId}
          tenantId={tenantId}
          onClose={() => {
            setEditingProgressId(null);
            loadReportActivities(); // Reload after save/close
            loadActualData();       // Sync totals too
          }}
          date={editingProgressDate}
        />
      )}

      {/* Single-button unified right-side rollup panel */}
      {drawerBoqItem && (
        <BOQItemEditDrawer
          boqItem={drawerBoqItem}
          project={project}
          tenantId={tenantId}
          onClose={() => setDrawerBoqItem(null)}
          onSaveSuccess={() => {
            loadActualData();
            loadReportActivities();
          }}
        />
      )}
    </div>
  );
}
