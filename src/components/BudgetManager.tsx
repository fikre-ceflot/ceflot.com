import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Project, BOQItem } from '../types';
import { 
  Calculator, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  FileText,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  Loader2,
  Search,
  Filter,
  Download,
  X as XIcon,
  Package,
  Users,
  Truck,
  Wrench,
  Building2,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Coins,
  Zap,
  Layers,
  Briefcase,
  RefreshCw,
  AlertCircle,
  MessageSquare,
  GitBranch,
  Clock,
  Boxes,
  Stethoscope,
  Lamp,
  Globe,
  Settings,
  Maximize2,
  Minimize2,
  ClipboardCheck,
  Edit2,
  Save,
  SlidersHorizontal
} from 'lucide-react';
import { cn, isValidUUID, cleanRichText } from '../lib/utils';
import { usePermissions } from '../hooks/usePermissions';
import ExcelJS from 'exceljs';
import { motion, AnimatePresence } from 'motion/react';
import { TabBar } from './ui/TabBar';
import { CollaborationFeed } from './CollaborationFeed';
import { 
  TRADE_GROUPS, 
  RESOURCE_CATEGORIES, 
  OPERATIONAL_BUNDLES,
  getGroupLabel, 
  getGroupEmoji 
} from '../lib/constants';

interface BudgetManagerProps {
  project: Project;
  userRole: any;
  tenantId: any;
  onSelectModule?: (moduleId: string) => void;
}

interface BudgetSummary {
  total_contract: number;
  total_internal_cost: number;
  confirmed_internal_cost: number;
  total_overheads: number;
  total_subcontracted_cost: number;
  margin_amount: number;
  margin_pct: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
}

type TabType = 'internal-budget' | 'resource-demands' | 'subcontractor-contracts' | 'overheads' | 'collaboration';

  export function BudgetManager({ project, userRole, tenantId, onSelectModule }: BudgetManagerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('internal-budget');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [colWidths, setColWidths] = useState({
    item_no: 100,
    description: 400,
    qty: 100,
    contract: 120,
    no_days: 80,
    predecessors: 120,
    internal: 120,
    margin: 120,
    trade: 220,
    trade_code: 100,
    trade_name: 200
  });

  const handleResize = (col: keyof typeof colWidths, width: number) => {
    setColWidths(prev => ({ ...prev, [col]: Math.max(50, width) }));
  };

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set([
    'item_no', 'description', 'qty', 'contract', 'trade_code', 'trade_name', 'internal', 'margin', 'status'
  ]));
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  const COLUMN_LABELS: Record<string, string> = {
    item_no: 'Item No',
    description: 'Description',
    qty: 'Qty',
    contract: 'Contract Total',
    no_days: 'No. Days',
    predecessors: 'Pred.',
    internal: 'Budget',
    margin: 'Margin',
    trade_code: 'Trade Code',
    trade_name: 'Trade Name',
    trade: 'Recipe Sync',
    status: 'Status'
  };

  const [isMassEdit, setIsMassEdit] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { surveyed_qty?: number; recipe_confirmed?: boolean }>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('toggle-focus-mode', { detail: isFullscreen }));
  }, [isFullscreen]);

  const handleSaveAllBudget = async () => {
    if (Object.keys(drafts).length === 0) {
      setIsMassEdit(false);
      setEditingItemId(null);
      return;
    }

    setIsSaving(true);
    try {
      const updates = Object.entries(drafts).map(([id, data]) => {
        const updateObj: any = { ...data };
        // If surveyed_qty is updated, we might want to update status too if needed, 
        // but here it's mainly for budget calculation.
        return supabase.from('boq_items').update(updateObj).eq('id', id);
      });

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      
      if (errors.length > 0) throw errors[0].error;

      setDrafts({});
      setIsMassEdit(false);
      setEditingItemId(null);
      await loadBudgetData();
      alert('Budget quantities updated successfully.');
    } catch (e: any) {
      alert('Error saving budget: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };
  const [actionResult, setActionResult] = useState<{
    title: string;
    rows: { label: string; value: string; status?: 'ok' | 'warn' | 'error' }[];
    summary?: string;
    action?: { label: string; onClick: () => void };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedBoqNodeId, setSelectedBoqNodeId] = useState<string | null>(null);
  const [expandedBoqNodes, setExpandedBoqNodes] = useState<Set<string>>(new Set());
  const [selectedItemDetail, setSelectedItemDetail] = useState<any | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(600);
  const [stagedRates, setStagedRates] = useState<Record<string, number>>({});
  const isResizingPanel = useRef(false);

  const confirmBudgetChanges = async () => {
    try {
      setLoading(true);
      const entries = Object.entries(stagedRates);
      for (const [resId, rate] of entries) {
        localStorage.setItem(`rate_override_${resId}`, String(rate));
        
        // Mark as manual override in database, completely bypassing error-prone "effective_rate" modification
        const { error } = await supabase
          .from('boq_item_resources')
          .update({ is_manual: true })
          .eq('id', resId);
          
        if (error) {
          console.warn(`Supabase is_manual update failed for resource ${resId}:`, error);
        }
      }
      setStagedRates({});
      await loadBudgetData();
    } catch (err) {
      console.error('Error confirming rate updates:', err);
    } finally {
      setLoading(false);
    }
  };

  const startResizingPanel = (e: React.MouseEvent) => {
    isResizingPanel.current = true;
    document.addEventListener('mousemove', handlePanelMouseMove);
    document.addEventListener('mouseup', stopResizingPanel);
    document.body.style.cursor = 'col-resize';
  };

  const stopResizingPanel = () => {
    isResizingPanel.current = false;
    document.removeEventListener('mousemove', handlePanelMouseMove);
    document.removeEventListener('mouseup', stopResizingPanel);
    document.body.style.cursor = 'default';
  };

  const handlePanelMouseMove = (e: MouseEvent) => {
    if (!isResizingPanel.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 400 && newWidth <= window.innerWidth - 100) {
      setPanelWidth(newWidth);
    }
  };

  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [editingRate, setEditingRate] = useState<number>(0);
  const [demandSubTab, setDemandSubTab] = useState<'inventory' | 'boq-alignment'>('inventory');
  const [showAddResourceModal, setShowAddResourceModal] = useState<{ isOpen: boolean; type: string; category?: string }>({ isOpen: false, type: '' });
  const [expandedDemands, setExpandedDemands] = useState<Set<string>>(new Set());
  const [isAddingFactor, setIsAddingFactor] = useState(false);
  const [newFactor, setNewFactor] = useState({ 
    name: '', 
    amount: 0, 
    calcType: 'unit' as 'unit' | 'total',
    mobilization: 0,
    care: 0,
    packSize: 1,
    isAdvanced: false
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<{ current: number; total: number } | null>(null);
  const [refreshReport, setRefreshReport] = useState<{
    total: number;
    successful: string[];
    unassigned: string[];
    unpopulated: string[];
    discrepancies: { item: string; resource: string; current: number; expected: number }[];
    states: Record<string, number>;
  } | null>(null);

  const startSyncAll = async () => {
    if (!project || isSyncing) return;
    
    setIsSyncing(true);
    setShowRefreshModal(true);
    setRefreshProgress({ current: 0, total: items.length });
    setRefreshReport(null); // Clear previous report
    
    const report = {
      total: items.length,
      successful: [] as string[],
      unassigned: [] as string[],
      unpopulated: [] as string[],
      discrepancies: [] as { item: string; resource: string; current: number; expected: number }[],
      states: {} as Record<string, number>
    };

    try {
      // 1. Force a clean bulk sync in the database
      const { error: syncError } = await supabase.rpc('bulk_populate_recipes', {
        p_boq_item_ids: items.map(i => i.id)
      });
      if (syncError) throw syncError;

      // 2. Load latest data for auditing
      const [boqItemsRes, resDataRes, tradeRes] = await Promise.all([
        supabase.from('boq_items').select('*').in('id', items.map(i => i.id)),
        supabase.from('boq_item_resources').select('*').in('boq_item_id', items.map(i => i.id)),
        supabase.from('trade_items').select('*').eq('is_active', true),
      ]);

      if (boqItemsRes.error) throw boqItemsRes.error;
      if (resDataRes.error) throw resDataRes.error;
      if (tradeRes.error) throw tradeRes.error;

      const freshItems = boqItemsRes.data || [];
      const freshResources = resDataRes.data || [];
      const tradeLibrary = tradeRes.data || [];

      // Crucial: Refresh the local budget items data to reflect the new sync
      await loadBudgetData();

      if (freshItems && freshResources && tradeLibrary) {
        const libRecipeMap: Record<string, any[]> = {};
        tradeLibrary.forEach(tr => {
          if (!libRecipeMap[tr.trade_code]) libRecipeMap[tr.trade_code] = [];
          libRecipeMap[tr.trade_code].push(tr);
        });

        freshItems.forEach(item => {
          if (!item.trade_code) {
            report.unassigned.push(item.item_no || '---');
          } else if (item.status === 'recipe_pending') {
            report.unpopulated.push(item.item_no || '---');
          } else {
            report.successful.push(item.item_no || '---');
            
            // Audit: Compare BOQ Recipes (Layer 3) vs Trade Library (Layer 2)
            const itemRes = freshResources.filter(r => r.boq_item_id === item.id && !r.is_manual);
            const libRes = libRecipeMap[item.trade_code] || [];
            
            itemRes.forEach(ir => {
              const matchedLib = libRes.find(lr => lr.resource_name === ir.resource_name);
              const curRate = Number(ir.consumption_rate || 0);
              const expRate = Number(matchedLib?.consumption_rate || 0);
              
              if (matchedLib && Math.abs(curRate - expRate) > 0.00001) {
                report.discrepancies.push({
                  item: item.item_no || '---',
                  resource: ir.resource_name,
                  current: curRate,
                  expected: expRate
                });
              }
            });
          }
          report.states[item.status] = (report.states[item.status] || 0) + 1;
        });
      }

      setRefreshProgress({ current: items.length, total: items.length });
      setRefreshReport(report);
      setShowRefreshModal(false);

    } catch (e: any) {
      alert('Sync failed: ' + e.message);
      setShowRefreshModal(false);
    } finally {
      setIsSyncing(false);
      setRefreshProgress(null);
    }
  };

  const sortItemNo = (a: string | null, b: string | null) => {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    
    const aParts = (a || '').split('.').map(p => parseInt(p) || 0);
    const bParts = (b || '').split('.').map(p => parseInt(p) || 0);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal !== bVal) return aVal - bVal;
    }
    return 0;
  };

  const handleRateUpdate = async (resourceId: string, manualRate?: number) => {
    const rate = manualRate !== undefined ? manualRate : editingRate;
    try {
      // 1. Stage change locally!
      setStagedRates(prev => ({ ...prev, [resourceId]: rate }));
      setEditingResourceId(null);

      // 2. Re-calculate local fields for selectedItemDetail reactively
      if (selectedItemDetail) {
        const itemResources = resources.filter(r => r.boq_item_id === selectedItemDetail.id);
        
        // Deduplicate resources by name (SSOT) to match UI display logic
        const uniqueResources = Array.from(
          itemResources.reduce((map, r) => {
            if (!map.has(r.resource_name)) map.set(r.resource_name, r);
            return map;
          }, new Map<string, any>()).values()
        ) as any[];

        const internalUnitCost = uniqueResources.reduce((sum: number, res: any) => {
          const qty = res.consumption_rate * (1 + (res.waste_factor_pct || 0) / 100);
          
          const typeKey = (res.resource_type || '').toLowerCase();
          const lookupKey = (res.resource_name || '').toLowerCase().trim();
          const ck = (res.resource_code || '').toLowerCase().trim();
          const rateByCode = libraryResources[`${typeKey}_rate_code_${ck}`];
          const rateByName = libraryResources[`${typeKey}_rate_${lookupKey}`];
          const libRate = rateByCode ?? rateByName ?? 0;
          
          const localStorageOverride = localStorage.getItem(`rate_override_${res.id}`);
          const stagedRate = res.id === resourceId ? rate : stagedRates[res.id];
          
          const rateToUse = stagedRate !== undefined
            ? stagedRate
            : (localStorageOverride !== null
              ? parseFloat(localStorageOverride)
              : ((res.is_manual && res.effective_rate != null) ? Number(res.effective_rate) : (libRate ?? 0)));
          
          return sum + (Number(qty) * Number(rateToUse));
        }, 0);

        const qtyToUse = selectedItemDetail.surveyed_qty || selectedItemDetail.contract_qty || 0;
        
        setSelectedItemDetail(prev => ({
          ...prev,
          internal_unit_cost: internalUnitCost,
          total_internal_cost: internalUnitCost * qtyToUse,
          margin: prev.contract_amount - (internalUnitCost * qtyToUse),
          has_recipe: true
        }));
      }
    } catch (error) {
      console.error('Error updating rate:', error);
    }
  };

  const handleAddFactor = async () => {
    if (!selectedItemDetail || !newFactor.name) return;

    try {
      const qty = selectedItemDetail.surveyed_qty || selectedItemDetail.contract_qty || 1;
      let effectiveRate = 0;

      if (newFactor.isAdvanced) {
        // Advanced formula: Base Rate (amount) + ((Mobilization + Care) / pack size)
        effectiveRate = newFactor.amount + ((newFactor.mobilization + newFactor.care) / (newFactor.packSize || 1));
      } else {
        effectiveRate = newFactor.calcType === 'total' ? newFactor.amount / qty : newFactor.amount;
      }

      if (effectiveRate <= 0) return;

      const { error } = await supabase
        .from('boq_item_resources')
        .insert([{
          boq_item_id: selectedItemDetail.id,
          tenant_id: tenantId,
          resource_name: newFactor.name,
          resource_type: 'material', // Map 'other' to 'material' to satisfy DB constraint
          resource_unit: 'UNIT',
          consumption_rate: 1,
          effective_rate: effectiveRate,
          waste_factor_pct: 0,
          is_manual: true
        }]);

      if (error) throw error;
      setNewFactor({ name: '', amount: 0, calcType: 'unit', mobilization: 0, care: 0, packSize: 1, isAdvanced: false });
      setIsAddingFactor(false);
      
      // Reload everything and calculate fresh totals
      const { data: resData } = await supabase
        .from('boq_item_resources')
        .select('*')
        .eq('boq_item_id', selectedItemDetail.id);

      const refreshedResources = resData || [];
      
      // Deduplicate resources (SSOT)
      const uniqueResources = Array.from(
        refreshedResources.reduce((map, r) => {
          if (!map.has((r as any).resource_name)) map.set((r as any).resource_name, r);
          return map;
        }, new Map<string, any>()).values()
      ) as any[];

      const newUnitCost = uniqueResources.reduce((sum: number, res: any) => {
        const q = res.consumption_rate * (1 + (res.waste_factor_pct || 0) / 100);
        const typeKey = (res.resource_type || '').toLowerCase();
        const lookupKey = (res.resource_name || '').toLowerCase().trim();
        const libRate = Number(libraryResources[`${typeKey}_rate_${lookupKey}`]) || 0;
        const rate = (res.is_manual && res.effective_rate != null)
          ? Number(res.effective_rate)
          : libRate;
        return sum + (Number(q) * rate);
      }, 0);
      
      setSelectedItemDetail({
        ...selectedItemDetail,
        internal_unit_cost: newUnitCost,
        total_internal_cost: newUnitCost * qty,
        margin: selectedItemDetail.contract_amount - (newUnitCost * qty)
      });

      // Reload global budget state
      loadBudgetData();
    } catch (error) {
      console.error('Error adding factor:', error);
    }
  };

  const toggleCategory = (cat: string) => {
    const next = new Set(expandedCategories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setExpandedCategories(next);
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [subAssignments, setSubAssignments] = useState<any[]>([]);
  const [dependencies, setDependencies] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [serverResourceDemands, setServerResourceDemands] = useState<any[]>([]);
  const [overheads, setOverheads] = useState<any[]>([]);
  const [libraryResources, setLibraryResources] = useState<Record<string, string>>({});
  const [libraryRates, setLibraryRates] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [demandGrouping, setDemandGrouping] = useState<'type' | 'group'>('type');
  const [manualProjectDemands, setManualProjectDemands] = useState<any[]>([]);
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [isBundling, setIsBundling] = useState(false);
  const [newManualItem, setNewManualItem] = useState<{ name: string; qty: string; category: string } | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [expandedBills, setExpandedBills] = useState<Set<string>>(new Set());

  const toggleBill = (bill: string) => {
    const next = new Set(expandedBills);
    if (next.has(bill)) next.delete(bill);
    else next.add(bill);
    setExpandedBills(next);
  };

  const handleAddBundle = async (bundle: any) => {
    setIsBundling(true);
    try {
      // 1. Ensure we have a "General Requirements" / "Preliminaries" BOQ item to attach these to
      // We look for any item tagged PREL or with item_no 00.xx
      let prelItem = items.find(i => i.trade_code === 'PREL' || i.item_no === '00.00' || (i.item_no || '').startsWith('00.'));
      
      if (!prelItem) {
        console.log('No PREL item found, creating synthetic container...');
        const { data: insertedItems, error: createError } = await supabase
          .from('boq_items')
          .insert([{
            project_id: project.id,
            tenant_id: tenantId,
            item_no: '00.00',
            description: 'Project Operations & Site Preliminaries',
            unit: 'LS',
            contract_qty: 1,
            contract_rate: 0,
            contract_amount: 0,
            trade_code: 'PREL',
            section_group: 'Indirect Costs',
            status: 'draft',
            recipe_confirmed: true
          }])
          .select();
        
        if (createError) throw createError;
        if (!insertedItems || insertedItems.length === 0) throw new Error('Failed to create Preliminaries item');
        prelItem = insertedItems[0];
      }

      // 2. Add resource items from bundle to boq_item_resources
      const resourcesToAdd = bundle.items.map((item: any) => ({
        project_id: project.id,
        tenant_id: tenantId,
        boq_item_id: prelItem.id,
        resource_name: item.name,
        resource_type: item.type || 'operational',
        resource_category: bundle.category || item.category || 'General',
        consumption_rate: item.qty,
        unit: item.unit || 'pcs',
        waste_factor_pct: 0,
        is_manual: true,
        source_trade_code: 'PREL'
      }));

      const { error: insertError } = await supabase
        .from('boq_item_resources')
        .insert(resourcesToAdd);

      if (insertError) throw insertError;

      // 3. Force a data reload and wait for it
      await loadBudgetData();
      
      alert(`Successfully integrated ${bundle.name} into budget calculations.`);
      setShowBundleModal(false);
    } catch (e: any) {
      console.error('Error adding bundle:', e);
      alert('Failed to add bundle: ' + e.message);
    } finally {
      setIsBundling(false);
    }
  };

  const submitForApproval = async () => {
    if (!summary) return;
    if (summary.status === 'pending_approval') {
      alert('Budget is already pending approval.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const { error: approvalError } = await supabase
        .from('approvals')
        .insert({
          tenant_id: tenantId,
          project_id: project.id,
          type: 'budget',
          title: `Budget Approval Request: ${project.name}`,
          requester_id: user.id,
          requester_name: profile?.full_name || 'Project Manager',
          amount: summary.total_internal_cost,
          status: 'pending',
          created_at: new Date().toISOString()
        });

      if (approvalError) throw approvalError;

      alert('Budget submitted for approval successfully.');
      loadBudgetData();
    } catch (e: any) {
      console.error('Error submitting for approval:', e);
      alert('Failed to submit: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveBudget = async () => {
    if (!summary || summary.status !== 'pending_approval') return;
    if (!window.confirm('Are you sure you want to approve this budget? This will baseline the project internal costs.')) return;
    
    setIsSubmitting(true);
    try {
      const { data: request } = await supabase
        .from('approvals')
        .select('id')
        .eq('project_id', project.id)
        .eq('type', 'budget')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!request) throw new Error('No pending approval request found');

      const { error } = await supabase
        .from('approvals')
        .update({ 
          status: 'approved', 
          decided_at: new Date().toISOString() 
        })
        .eq('id', request.id);
      
      if (error) throw error;

      // Update project status if possible
      await supabase
        .from('projects')
        .update({ budget_status: 'approved' })
        .eq('id', project.id);

      alert('Budget approved successfully.');
      loadBudgetData();
    } catch (e: any) {
      alert('Approval failed: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectBudget = async () => {
    if (!summary || summary.status !== 'pending_approval') return;
    const reason = window.prompt('Please provide a reason for rejection:');
    if (reason === null) return;

    setIsSubmitting(true);
    try {
      const { data: request } = await supabase
        .from('approvals')
        .select('id')
        .eq('project_id', project.id)
        .eq('type', 'budget')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!request) throw new Error('No pending approval request found');

      const { error } = await supabase
        .from('approvals')
        .update({ 
          status: 'rejected', 
          decided_at: new Date().toISOString() 
        })
        .eq('id', request.id);
      
      if (error) throw error;

      await supabase
        .from('projects')
        .update({ budget_status: 'rejected' })
        .eq('id', project.id);

      alert('Budget rejected.');
      loadBudgetData();
    } catch (e: any) {
      alert('Rejection failed: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleItemCollapse = (itemNo: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedItems);
    if (next.has(itemNo)) next.delete(itemNo);
    else next.add(itemNo);
    setExpandedItems(next);
  };

  const formatUnit = (unit: string | null) => {
    return cleanRichText(unit);
  };

  const isItemVisible = (item: any) => {
    if (!item.item_no) return true;
    const parts = item.item_no.split('.');
    if (parts.length === 1) return true;
    for (let i = 1; i < parts.length; i++) {
      const parentPath = parts.slice(0, i).join('.');
      if (!expandedItems.has(parentPath)) return false;
    }
    return true;
  };

  useEffect(() => {
    loadBudgetData();
  }, [project.id]);

  const calculateDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    const diff = e.getTime() - s.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  };

  const getPredecessorsString = (taskId: string) => {
    return dependencies
      .filter(d => d.task_id === taskId)
      .map(d => {
        const pred = items.find(t => t.id === d.predecessor_id);
        if (!pred) return '';
        const typeStr = d.link_type !== 'FS' ? d.link_type : '';
        const lagStr = d.lag_days !== 0 ? (d.lag_days > 0 ? `+${d.lag_days}` : d.lag_days) : '';
        return `${pred.item_no}${typeStr}${lagStr}`;
      })
      .filter(Boolean)
      .join(', ');
  };

  const loadBudgetData = async () => {
    setLoading(true);
    try {
      // 1. Fetch BOQ Items and Trades
      let tradeQuery = supabase.from('trade_items').select('trade_code, trade_item, library_tier').eq('is_active', true);
      if (tenantId && tenantId !== 'null') {
        tradeQuery = tradeQuery.or(`library_tier.eq.global,tenant_id.eq.${tenantId}`);
      }

      const [
        { data: rawBoqItems, error: boqError }, 
        { data: tradesData, error: tradesError },
        { data: materials },
        { data: labours },
        { data: equip },
        { data: vehicles },
        { data: fuels },
        { data: subs },
        { data: subAssignments },
        { data: subDetails }
      ] = await Promise.all([
        supabase
          .from('boq_items')
          .select('*')
          .eq('project_id', project.id)
          .order('item_sequence', { ascending: true }),
        tradeQuery,
        supabase.from('materials').select('*').eq('is_active', true),
        supabase.from('labour_grades').select('*').eq('is_active', true),
        supabase.from('equipment_items').select('*').eq('is_active', true),
        supabase.from('vehicles').select('*').eq('is_active', true),
        supabase.from('fuel_types').select('*').eq('is_active', true),
        supabase.from('subcontractor_categories').select('*').eq('is_active', true),
        supabase.from('subcontractor_assignments').select('*').eq('project_id', project.id),
        supabase.from('subcontractors').select('id, name, company_name')
      ]);

       if (boqError) throw boqError;
       if (tradesError) throw tradesError;

       // Normalize field names (quantity/rate vs contract_qty/contract_rate)
       const boqItems = (rawBoqItems || []).map(item => ({
         ...item,
         contract_qty: item.contract_qty ?? item.quantity ?? 0,
         contract_rate: item.contract_rate ?? item.rate ?? 0,
         contract_amount: item.contract_amount ?? ( (item.contract_qty ?? item.quantity ?? 0) * (item.contract_rate ?? item.rate ?? 0) )
       }));
       
       const libMap: Record<string, any> = {};
         materials?.forEach(m => {
          const name = m.material_name || m.name || '';
          const key = (name || '').toLowerCase().trim();
          libMap[`material_${key}`] = m.category || 'Uncategorized Materials';
          libMap[`material_code_${key}`] = m.material_code || m.code;
          libMap[`material_rate_${key}`] = m.base_rate ?? (m as any).unit_rate ?? (m as any).rate ?? 0;
          libMap[`material_rate_code_${(m.material_code || '').toLowerCase().trim()}`] = m.base_rate ?? (m as any).unit_rate ?? (m as any).rate ?? 0;
          libMap[`material_unit_${key}`] = m.unit || 'PCS';
        });
        labours?.forEach(l => {
          const name = l.title || l.name || '';
          const key = (name || '').toLowerCase().trim();
          libMap[`labour_${key}`] = (l as any).category || 'Uncategorized Labour';
          libMap[`labour_code_${key}`] = l.grade_code || l.code || (l as any).id;
          libMap[`labour_rate_${key}`] = l.base_rate ?? (l as any).daily_rate ?? (l as any).rate ?? 0;
          libMap[`labour_rate_code_${(l.grade_code || l.code || '').toLowerCase().trim()}`] = l.base_rate ?? (l as any).daily_rate ?? (l as any).rate ?? 0;
          libMap[`labour_unit_${key}`] = l.unit || 'DAY';
        });
        equip?.forEach(e => {
          const name = e.name || '';
          const key = (name || '').toLowerCase().trim();
          libMap[`equipment_${key}`] = (e as any).category || 'Uncategorized Equipment';
          libMap[`equipment_code_${key}`] = e.equipment_code || e.code || (e as any).id;
          libMap[`equipment_rate_${key}`] = e.base_rate ?? (e as any).hourly_rate ?? (e as any).rate ?? 0;
          libMap[`equipment_rate_code_${(e.equipment_code || e.code || '').toLowerCase().trim()}`] = e.base_rate ?? (e as any).hourly_rate ?? (e as any).rate ?? 0;
          libMap[`equipment_unit_${key}`] = e.unit || 'DAY';
        });
        vehicles?.forEach(v => {
          const name = v.name || '';
          const key = (name || '').toLowerCase().trim();
          libMap[`vehicle_${key}`] = (v as any).category || 'Uncategorized Logistics';
          libMap[`vehicle_code_${key}`] = v.vehicle_code || v.code || (v as any).id;
          libMap[`vehicle_rate_${key}`] = v.base_rate ?? (v as any).daily_rate ?? (v as any).rate ?? 0;
          libMap[`vehicle_rate_code_${(v.vehicle_code || v.code || '').toLowerCase().trim()}`] = v.base_rate ?? (v as any).daily_rate ?? (v as any).rate ?? 0;
          libMap[`vehicle_unit_${key}`] = v.unit || 'km';
        });
        fuels?.forEach(f => {
          const name = f.name || '';
          const key = (name || '').toLowerCase().trim();
          libMap[`fuel_${key}`] = 'Fuels & Energy';
          libMap[`fuel_code_${key}`] = f.fuel_code || f.code;
          libMap[`fuel_rate_${key}`] = f.base_rate ?? (f as any).rate ?? 0;
          libMap[`fuel_rate_code_${(f.fuel_code || f.code || '').toLowerCase().trim()}`] = f.base_rate ?? (f as any).rate ?? 0;
          libMap[`fuel_unit_${key}`] = f.unit || 'L';
        });
        subs?.forEach(s => {
          const name = s.name || '';
          const key = (name || '').toLowerCase().trim();
          libMap[`subcontractor_${key}`] = 'Subcontracting';
          libMap[`subcontractor_code_${key}`] = s.category_code || s.code || (s as any).id;
          libMap[`subcontractor_rate_${key}`] = s.base_rate ?? (s as any).rate ?? 0;
          libMap[`subcontractor_rate_code_${(s.category_code || s.code || '').toLowerCase().trim()}`] = s.base_rate ?? (s as any).rate ?? 0;
          libMap[`subcontractor_unit_${key}`] = s.unit || 'JOB';
        });
       const ratesMap: Record<string, number> = {};
       materials?.forEach(m => { ratesMap[m.material_name || m.name || ''] = m.base_rate ?? 0; });
       labours?.forEach(l => { ratesMap[l.title || l.name || ''] = l.base_rate ?? 0; });
       equip?.forEach(e => { ratesMap[e.name || ''] = e.base_rate ?? 0; });
       vehicles?.forEach(v => { ratesMap[v.name || ''] = v.base_rate ?? 0; });
       fuels?.forEach(f => { ratesMap[f.name || ''] = f.base_rate ?? 0; });
       subs?.forEach(s => { ratesMap[s.name || ''] = s.base_rate ?? 0; });

       setLibraryResources(libMap);
       setLibraryRates(ratesMap);
       const enrichedAssignments = (subAssignments || []).map(a => {
         const vendor = (subDetails || []).find(s => s.id === a.subcontractor_id);
         return {
           ...a,
           subcontractor_name: vendor?.company_name || vendor?.name || a.subcontractor_name
         };
       });
       setSubAssignments(enrichedAssignments);
       
       // Deduplicate trades by trade_code
       const uniqueTradesMap = new Map();
       (tradesData || []).forEach(t => {
         const existing = uniqueTradesMap.get(t.trade_code);
         if (!existing || (existing.library_tier === 'global' && t.library_tier === 'company')) {
           uniqueTradesMap.set(t.trade_code, t);
         }
       });
       setTrades(Array.from(uniqueTradesMap.values()));

      // 2. Fetch ALL resources for these items via item IDs
      const { data: deps, error: depsError } = await supabase
        .from('task_dependencies')
        .select('*')
        .eq('project_id', project.id);
      
      if (depsError) throw depsError;
      setDependencies(deps || []);

      const { data: resData, error: resError } = await supabase
        .from('boq_item_resources')
        .select('*')
        .in('boq_item_id', boqItems.map(i => i.id));

      if (resError) throw resError;
      setResources(resData || []);

      // 3. Calculate calculatedItems (mirroring BOQ but with internal costs)
      const calculatedItems = boqItems.map(item => {
        const itemAssignments = subAssignments?.filter(a => a.boq_item_id === item.id) || [];
        
        if (itemAssignments.length > 0) {
          // If subcontracted, the internal cost is the sum of subcontractor assignments
          const qtyToUse = item.surveyed_qty || item.contract_qty || 0;
          
          let totalCost = 0;
          let totalSubUnitRate = 0;

          itemAssignments.forEach(a => {
            if (a.assignment_type === 'lumpsum' && a.group_name) {
              // For lump sum groups, we need to calculate the proportional cost for this item
              // Find all items in this same group
              const groupItems = subAssignments?.filter(sa => 
                sa.subcontractor_id === a.subcontractor_id && 
                sa.group_name === a.group_name &&
                sa.assignment_type === 'lumpsum'
              ) || [];
              
              const totalGroupQty = groupItems.reduce((sum, gi) => {
                const bi = boqItems.find(i => i.id === gi.boq_item_id);
                return sum + (bi?.surveyed_qty || bi?.contract_qty || 0);
              }, 0);

              if (totalGroupQty > 0) {
                const itemProportion = qtyToUse / totalGroupQty;
                const allocatedCost = (a.lump_sum_total || 0) * itemProportion;
                totalCost += allocatedCost;
                totalSubUnitRate += qtyToUse > 0 ? (allocatedCost / qtyToUse) : 0;
              } else if (groupItems.length > 0) {
                // Fallback for zero qty - distribute evenly
                const allocatedCost = (a.lump_sum_total || 0) / groupItems.length;
                totalCost += allocatedCost;
                totalSubUnitRate += qtyToUse > 0 ? (allocatedCost / qtyToUse) : 0;
              }
            } else {
              // Unit rate assignment
              const rate = a.contract_rate || 0;
              totalCost += qtyToUse * rate;
              totalSubUnitRate += rate;
            }
          });

          return {
            ...item,
            internal_unit_cost: totalSubUnitRate,
            total_internal_cost: totalCost,
            margin: item.contract_amount - totalCost,
            has_recipe: true,
            is_subcontracted: true
          };
        }

        const itemResources = resData?.filter(r => 
          r.boq_item_id === item.id &&
          !r.is_excluded &&
          (r.is_manual || !item.trade_code || r.source_trade_code === item.trade_code || !r.source_trade_code)
        ) || [];
        
        // Deduplicate resources by name (SSOT) to prevent calculation ballooning from DB duplicates
        const uniqueResources = Array.from(
          itemResources.reduce((map, res) => {
            if (!map.has(res.resource_name)) map.set(res.resource_name, res);
            return map;
          }, new Map<string, any>()).values()
        ) as any[];

        const qtyToUse = item.surveyed_qty || item.contract_qty || 0;
        
        const totalInternalCost = uniqueResources.reduce((sum: number, res: any) => {
          const factorWithWaste = res.consumption_rate * (1 + (res.waste_factor_pct || 0) / 100);
          // Use rounded quantity for consistency with sidebar and manual calculations
          const itemTotalQty = Math.round(factorWithWaste * qtyToUse * 10000) / 10000;
          
          const typeKey = (res.resource_type || '').toLowerCase().trim();
          const nk = (res.resource_name || '').toLowerCase().trim();
          const ck = (res.resource_code || '').toLowerCase().trim();
          
          const rateByCode = libMap[`${typeKey}_rate_code_${ck}`];
          const rateByName = libMap[`${typeKey}_rate_${nk}`];
          const libRate = rateByCode ?? rateByName ?? 0;
          
          const localStorageOverride = localStorage.getItem(`rate_override_${res.id}`);
          const stagedRate = stagedRates[res.id];
          const rateToUse = stagedRate !== undefined
            ? stagedRate
            : (localStorageOverride !== null
              ? parseFloat(localStorageOverride)
              : ((res.is_manual && res.effective_rate != null)
                ? Number(res.effective_rate)
                : Number(libRate) || 0));
          
          return sum + (itemTotalQty * Number(rateToUse));
        }, 0);

        const internalUnitCost = qtyToUse > 0 ? totalInternalCost / qtyToUse : 0;
        
        return {
          ...item,
          internal_unit_cost: internalUnitCost,
          total_internal_cost: totalInternalCost,
          margin: item.contract_amount - totalInternalCost,
          has_recipe: itemResources.length > 0 || item.recipe_confirmed
        };
      });

      setItems(calculatedItems);

      // 4. Fetch/Load Overheads
      let currentOverheads = [
        { id: 'def-1', project_id: project.id, tenant_id: tenantId, category: 'Personnel', description: 'Site Engineer Salary', amount: 2500, status: 'active' },
        { id: 'def-2', project_id: project.id, tenant_id: tenantId, category: 'Logistics', description: 'Fuel for Site Vehicle', amount: 800, status: 'active' },
        { id: 'def-3', project_id: project.id, tenant_id: tenantId, category: 'Operations', description: 'Petty Cash', amount: 500, status: 'active' }
      ];

      const { data: overheadData, error: overheadError } = await supabase
        .from('project_overheads')
        .select('*')
        .eq('project_id', project.id);
      
      if (!overheadError && overheadData && overheadData.length > 0) {
        currentOverheads = overheadData;
      }
      
      setOverheads(currentOverheads);

      // 5. Fetch Server Aggregated Resource Demands
      const { data: serverDemands, error: serverDemandsError } = await supabase.rpc('get_project_resource_demands', {
        p_project_id: project.id
      });
      if (!serverDemandsError && serverDemands) {
        setServerResourceDemands(serverDemands);
      }

      const totalContract = boqItems.reduce((sum, i) => sum + (i.contract_amount || 0), 0);
      const totalSubcontracted = calculatedItems.filter(i => i.is_subcontracted).reduce((sum, i) => sum + (i.total_internal_cost || 0), 0);
      const totalInternal = calculatedItems.reduce((sum, i) => sum + (i.total_internal_cost || 0), 0);
      const confirmedInternal = calculatedItems.filter(i => i.recipe_confirmed).reduce((sum, i) => sum + (i.total_internal_cost || 0), 0);
      const totalOverheads = currentOverheads.reduce((sum, i) => sum + Number(i.amount || 0), 0);
      const margin = totalContract - totalInternal - totalOverheads;

      const { data: latestApproval } = await supabase
        .from('approvals')
        .select('status')
        .eq('project_id', project.id)
        .eq('type', 'budget')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const summaryStatus = latestApproval 
        ? (latestApproval.status === 'pending' ? 'pending_approval' : latestApproval.status) 
        : 'draft';

      setSummary({
        total_contract: totalContract,
        total_internal_cost: totalInternal,
        total_subcontracted_cost: totalSubcontracted,
        confirmed_internal_cost: confirmedInternal,
        total_overheads: totalOverheads,
        margin_amount: margin,
        margin_pct: totalContract > 0 ? (margin / totalContract) * 100 : 0,
        status: summaryStatus as any
      });

    } catch (e: any) {
      console.error('Error loading budget:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOverheadUpdate = async (id: string, field: string, value: any) => {
    try {
      if (id.length > 20) { // Real UUID
        const { error } = await supabase
          .from('project_overheads')
          .update({ [field]: value, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
      }
      
      const next = overheads.map(o => o.id === id ? { ...o, [field]: value } : o);
      setOverheads(next);
      // Recalculate summary
      const totalOv = next.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
      const margin = summary!.total_contract - summary!.total_internal_cost - totalOv;
      setSummary({
        ...summary!,
        total_overheads: totalOv,
        margin_amount: margin,
        margin_pct: summary!.total_contract > 0 ? (margin / summary!.total_contract) * 100 : 0
      });
    } catch (e: any) {
      console.error('Error updating overhead:', e);
    }
  };

  const addOverhead = async () => {
    try {
      const { data, error } = await supabase
        .from('project_overheads')
        .insert([{
          project_id: project.id,
          tenant_id: tenantId,
          category: 'Personnel',
          description: 'New Expense',
          amount: 0,
          status: 'active'
        }])
        .select()
        .single();
      
      if (error) throw error;
      if (data) {
        setOverheads([...overheads, data]);
      }
    } catch (e: any) {
      console.error('Error adding overhead:', e);
    }
  };

  const removeOverhead = async (id: string) => {
    try {
      if (isValidUUID(id)) {
        const { error } = await supabase
          .from('project_overheads')
          .delete()
          .eq('id', id);
        if (error) throw error;
      }
      
      const next = overheads.filter(o => o.id !== id);
      setOverheads(next);
      // Recalculate
      const totalOv = next.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
      const margin = summary!.total_contract - summary!.total_internal_cost - totalOv;
      setSummary({
        ...summary!,
        total_overheads: totalOv,
        margin_amount: margin,
        margin_pct: summary!.total_contract > 0 ? (margin / summary!.total_contract) * 100 : 0
      });
    } catch (e: any) {
      console.error('Error deleting overhead:', e);
    }
  };

  const exportResourceDemands = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Resource Demands');

      // Add Metadata
      worksheet.addRow(['PROJECT INFORMATION']);
      worksheet.addRow(['Project Name:', project.name]);
      worksheet.addRow(['Project Code:', project.project_code || 'N/A']);
      worksheet.addRow(['Status:', project.status.toUpperCase()]);
      worksheet.addRow(['Location:', project.location || 'N/A']);
      worksheet.addRow(['Contract Value:', project.contract_value ? fmt(project.contract_value) : '0']);
      worksheet.addRow(['Export Date:', new Date().toLocaleString()]);
      worksheet.addRow([]);
      worksheet.addRow(['RESOURCE DEMAND DATA']);

      // Add Headers
      const headerRow = worksheet.addRow(['#', 'Resource Name', 'Category', 'Resource Type', 'Unit', 'Rate', 'Total Demand Qty', 'Total Extended Cost']);
      headerRow.font = { bold: true };

      // Add Data
      resourceDemands.forEach((d, idx) => {
        worksheet.addRow([
          idx + 1,
          d.name,
          d.category,
          d.type.toUpperCase(),
          formatUnit(d.unit),
          d.rate,
          d.total_qty,
          d.total_cost
        ]);
      });

      // Style columns
      worksheet.columns = [
        { width: 5 },  // #
        { width: 35 }, // Name
        { width: 20 }, // Category
        { width: 15 }, // Type
        { width: 8 },  // Unit
        { width: 12 }, // Rate
        { width: 18 }, // Qty
        { width: 18 }  // Cost
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Resource_Demands_${project.project_code || 'PROJECT'}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Export error:', err);
      alert('Failed to export: ' + err.message);
    }
  };

  const toggleDemandCollapse = (cat: string) => {
    const next = new Set(expandedDemands);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setExpandedDemands(next);
  };

  const resourceDemands = useMemo(() => {
    const groupedDemands: Record<string, any> = {};

    // 1. Filter and group resources
    const cleanResources = resources.filter(res => {
      const boqItem = items.find(i => i.id === res.boq_item_id);
      if (!boqItem) return false;

      // EXCLUDE internal resources if the item is subcontracted
      if (boqItem.is_subcontracted) return false;

      // Allow manual items OR items that match the trade link
      const isCorrectTrade = res.is_manual || (boqItem.trade_code && (res.source_trade_code === boqItem.trade_code || !res.source_trade_code));
      if (!isCorrectTrade) return false;

      return true;
    });

    cleanResources.forEach(res => {
      const boqItem = items.find(i => i.id === res.boq_item_id);
      // PREL items are always operational demands even if not "confirmed" yet
      if (!boqItem?.recipe_confirmed && boqItem?.trade_code !== 'PREL') return;

      const typeKey = (res.resource_type || '').toLowerCase();
      const lookupKey = (res.resource_name || '').toLowerCase().trim();
      const libRate = libraryResources[`${typeKey}_rate_${lookupKey}`] || libraryRates[res.resource_name];
      
      const rateToUse = (res.is_manual && res.effective_rate !== null && res.effective_rate !== undefined) 
        ? res.effective_rate 
        : (libRate || 0);

      const qtyUsed = boqItem.surveyed_qty || boqItem.contract_qty || 0;
      const totalDemand = res.consumption_rate * qtyUsed * (1 + (res.waste_factor_pct || 0) / 100);
      const totalCost = totalDemand * rateToUse;
      
      let resourceType = res.resource_type;
      
      // Map Equipment/Vehicles to Machinery or Tools
      if (res.resource_type === 'equipment' || res.resource_type === 'vehicle') {
        const nameLower = res.resource_name.toLowerCase();
        const isTool = nameLower.includes('tool') || 
                      nameLower.includes('hand') || 
                      nameLower.includes('drill') || 
                      nameLower.includes('saw') || 
                      nameLower.includes('wrench') ||
                      nameLower.includes('hammer');
        
        resourceType = isTool ? 'tool' : 'machinery';
      }

      const category = libraryResources[`${res.resource_type}_${lookupKey}`] || 'Uncategorized';
      const key = `${resourceType}_${res.resource_name}_${res.resource_unit}`;

      if (!groupedDemands[key]) {
        groupedDemands[key] = {
          type: resourceType,
          original_type: res.resource_type,
          category,
          name: res.resource_name,
          unit: res.resource_unit,
          rate: rateToUse,
          total_qty: 0,
          total_cost: 0,
          boq_groups: {}
        };
      }

      groupedDemands[key].total_qty += totalDemand;
      groupedDemands[key].total_cost += totalCost;
      
      const bill = boqItem.bill_no || 'Bill 1';
      if (!groupedDemands[key].boq_groups[bill]) {
        groupedDemands[key].boq_groups[bill] = 0;
      }
      groupedDemands[key].boq_groups[bill] += totalDemand;
    });

    // 2. Add Subcontractor Assignments as demands
    if (subAssignments && subAssignments.length > 0) {
      const processedLumpSumGroups = new Set<string>();

      subAssignments.forEach(a => {
        const boqItem = items.find(i => i.id === a.boq_item_id);
        if (!boqItem) return;

        const qty = boqItem.surveyed_qty || boqItem.contract_qty || 0;
        let cost = 0;
        let name = '';
        let uniqueKey = '';

        if (a.assignment_type === 'lumpsum' && a.group_name) {
          const groupKey = `${a.subcontractor_id}_${a.group_name}`;
          if (processedLumpSumGroups.has(groupKey)) return; // Only add once per lump sum group
          
          cost = a.lump_sum_total || 0;
          name = `Subcontract: ${a.group_name} (${a.subcontractor?.company_name || 'Vendor'})`;
          uniqueKey = `sub_${groupKey}`;
          processedLumpSumGroups.add(groupKey);
        } else {
          // Unit rate
          cost = qty * (a.contract_rate || 0);
          name = `Subcontract: ${cleanRichText(boqItem.description).slice(0, 30)}... (${a.subcontractor?.company_name || 'Vendor'})`;
          uniqueKey = `sub_unit_${a.id}`;
        }

        groupedDemands[uniqueKey] = {
          type: 'subcontractor',
          category: a.subcontractor?.trade_category || 'General Subcontracting',
          name,
          unit: a.assignment_type === 'lumpsum' ? 'LS' : (boqItem.unit || 'unit'),
          rate: a.assignment_type === 'lumpsum' ? cost : (a.contract_rate || 0),
          total_qty: a.assignment_type === 'lumpsum' ? 1 : qty,
          total_cost: cost,
          boq_groups: {
            [boqItem.bill_no || 'Bill 1']: a.assignment_type === 'lumpsum' ? 1 : qty
          },
          is_sub: true
        };
      });
    }

    return Object.values(groupedDemands);
  }, [resources, items, libraryResources, subAssignments]);

  const filteredItems = useMemo(() => {
    const s = (search || '').toLowerCase();
    return items.filter(i => 
      cleanRichText(i.description || '').toLowerCase().includes(s) ||
      (i.item_no || '').toLowerCase().includes(s) ||
      (i.trade_code || '').toLowerCase().includes(s)
    );
  }, [items, search]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const bills: string[] = [];
    filteredItems.forEach(item => {
      const bill = item.bill_no || 'Bill 1';
      if (!groups[bill]) {
        groups[bill] = [];
        bills.push(bill);
      }
      groups[bill].push(item);
    });
    return { groups, bills };
  }, [filteredItems]);

  const boqTree = useMemo(() => {
    if (!items || items.length === 0) return [];
    
    // Group by Bill first
    const bills: Record<string, any[]> = {};
    items.forEach(item => {
      const bill = item.bill_no || 'Bill 1';
      if (!bills[bill]) bills[bill] = [];
      bills[bill].push(item);
    });

    const tree: any[] = [];

    Object.entries(bills).forEach(([billName, billItems]) => {
      const billNodes: Record<string, any> = {};
      const roots: any[] = [];

      // Sort items by item_no
      const sorted = [...billItems].sort((a, b) => 
        (a.item_no || '').localeCompare(b.item_no || '', undefined, { numeric: true })
      );

      sorted.forEach(item => {
        const itemNo = item.item_no || '';
        const node = {
          id: item.id,
          item_no: itemNo,
          description: item.description,
          bill_no: billName,
          children: [],
          itemIds: [item.id],
          isHeader: !item.unit
        };
        billNodes[itemNo] = node;

        const parts = itemNo.split('.');
        if (parts.length > 1) {
          const parentNo = parts.slice(0, -1).join('.');
          const parent = billNodes[parentNo];
          if (parent) {
            parent.children.push(node);
          } else {
            roots.push(node);
          }
        } else {
          roots.push(node);
        }
      });

      // Recursive function to gather all child IDs for aggregation
      const gatherIds = (node: any): string[] => {
        let ids = [...node.itemIds];
        node.children.forEach((child: any) => {
          ids = [...ids, ...gatherIds(child)];
        });
        node.aggregatedItemIds = Array.from(new Set(ids));
        return ids;
      };

      roots.forEach(r => gatherIds(r));

      tree.push({
        id: `bill-${billName}`,
        item_no: '',
        description: billName,
        children: roots,
        aggregatedItemIds: Array.from(new Set(roots.flatMap(r => r.aggregatedItemIds))),
        isBill: true
      });
    });

    return tree;
  }, [items]);

  const selectedNode = useMemo(() => {
    if (!selectedBoqNodeId) return null;
    
    const findNode = (nodes: any[]): any | null => {
      for (const node of nodes) {
        if (node.id === selectedBoqNodeId) return node;
        if (node.children) {
          const found = findNode(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    return findNode(boqTree);
  }, [boqTree, selectedBoqNodeId]);

  const boqContextResources = useMemo(() => {
    if (!selectedNode) return [];
    
    const targetIds = new Set(selectedNode.aggregatedItemIds);
    
    // 1. Filter and group resources (exclude if subcontracted)
    const contextRes = resources.filter(r => {
      if (!targetIds.has(r.boq_item_id)) return false;
      const boqItem = items.find(i => i.id === r.boq_item_id);
      if (boqItem?.is_subcontracted) return false;
      return true;
    });
    
    const summary: Record<string, any> = {};
    contextRes.forEach(res => {
      const boqItem = items.find(i => i.id === res.boq_item_id);
      if (!boqItem?.recipe_confirmed) return;

      const typeKey = (res.resource_type || '').toLowerCase();
      const lookupKey = (res.resource_name || '').toLowerCase().trim();
      const libRate = libraryResources[`${typeKey}_rate_${lookupKey}`];
      
      const rateToUse = (res.is_manual && res.effective_rate !== undefined) 
        ? res.effective_rate 
        : (libRate || 0);

      const qtyUsed = boqItem.surveyed_qty || boqItem.contract_qty || 0;
      const totalDemand = res.consumption_rate * qtyUsed * (1 + (res.waste_factor_pct || 0) / 100);
      const totalCost = totalDemand * rateToUse;

      let resourceType = res.resource_type;
      
      // Map Equipment/Vehicles to Machinery or Tools
      if (res.resource_type === 'equipment' || res.resource_type === 'vehicle') {
        const nameLower = (res.resource_name || '').toLowerCase();
        const isTool = nameLower.includes('tool') || 
                      nameLower.includes('hand') || 
                      nameLower.includes('drill') || 
                      nameLower.includes('saw') || 
                      nameLower.includes('wrench') ||
                      nameLower.includes('hammer');
        
        resourceType = isTool ? 'tool' : 'machinery';
      }

      const category = libraryResources[`${res.resource_type}_${lookupKey}`] || 'Uncategorized';
      const key = `${resourceType}_${res.resource_name}_${res.resource_unit}`;

      if (!summary[key]) {
        summary[key] = {
          name: res.resource_name,
          type: resourceType,
          original_type: res.resource_type,
          category,
          unit: res.resource_unit,
          rate: rateToUse,
          total_qty: 0,
          total_cost: 0
        };
      }
      summary[key].total_qty += totalDemand;
      summary[key].total_cost += totalCost;
    });

    // 2. Add subcontractor assignments in this context
    if (subAssignments && subAssignments.length > 0) {
      const contextSubs = subAssignments.filter(a => targetIds.has(a.boq_item_id));
      const processedLumpSumGroups = new Set<string>();

      contextSubs.forEach(a => {
        const boqItem = items.find(i => i.id === a.boq_item_id);
        if (!boqItem) return;

        const qty = boqItem.surveyed_qty || boqItem.contract_qty || 0;
        let cost = 0;
        let name = '';
        let uniqueKey = '';

        if (a.assignment_type === 'lumpsum' && a.group_name) {
          const groupKey = `${a.subcontractor_id}_${a.group_name}`;
          if (processedLumpSumGroups.has(groupKey)) return; 
          
          cost = a.lump_sum_total || 0;
          name = `Subcontract: ${a.group_name} (${a.subcontractor?.company_name || 'Vendor'})`;
          uniqueKey = `sub_${groupKey}`;
          processedLumpSumGroups.add(groupKey);
        } else {
          cost = qty * (a.contract_rate || 0);
          name = `Subcontract: ${cleanRichText(boqItem.description).slice(0, 30)}... (${a.subcontractor?.company_name || 'Vendor'})`;
          uniqueKey = `sub_unit_${a.id}`;
        }

        summary[uniqueKey] = {
          name,
          type: 'subcontractor',
          category: a.subcontractor?.trade_category || 'General Subcontracting',
          unit: a.assignment_type === 'lumpsum' ? 'LS' : (boqItem.unit || 'unit'),
          rate: a.assignment_type === 'lumpsum' ? cost : (a.contract_rate || 0),
          total_qty: a.assignment_type === 'lumpsum' ? 1 : qty,
          total_cost: cost,
          is_sub: true
        };
      });
    }

    return Object.values(summary).sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
  }, [selectedNode, resources, items, libraryResources, subAssignments]);

  const toggleBoqNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedBoqNodes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedBoqNodes(next);
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
        <div className="text-sm text-dim font-medium">Calculating project cost build-up…</div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col transition-all duration-300",
      isFullscreen ? "fixed top-0 bottom-0 right-0 left-0 lg:left-16 z-[100] bg-surface-base p-4 overflow-hidden" : "gap-8"
    )}>
      {!isFullscreen && (
        <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-6">
          <div className="flex flex-col gap-0.5 md:mt-auto">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-black text-ghost uppercase tracking-[0.3em]">Commercial & Financial</span>
            </div>
            <h1 className="text-[19px] font-black tracking-tight text-main -ml-0.5">{project.name}</h1>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex items-center gap-2 text-[10px] font-bold text-ghost">
                <span className="text-primary font-black uppercase tracking-widest decoration-primary/30 underline-offset-4">Cost & Budget Dashboard</span>
                <span className="w-1 h-1 rounded-full bg-border-subtle" />
                <span className="px-1.5 py-0.25 rounded bg-surface-2 border border-border-subtle opacity-80">{items.length} Tracked Lines</span>
              </div>
              <div className="h-1 w-1 rounded-full bg-border-subtle" />
              <span className="text-[10px] font-bold text-dim uppercase tracking-wider">{project.status || 'Active'}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-5">
            <div className="flex flex-col items-end min-w-[120px]">
              <span className="text-[8px] font-bold text-ghost uppercase tracking-[0.2em] mb-1 opacity-60">Reference ID</span>
              <div className="px-3 py-1 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center w-full">
                <span className="text-xs font-black text-primary tracking-widest">{project.project_code}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <TabBar 
                tabs={[
                  { id: 'subcontractor-contracts', label: 'Contracts', icon: Building2 },
                  { id: 'internal-budget', label: 'Budget', icon: Briefcase },
                  { id: 'resource-demands', label: 'Resources', icon: Layers },
                  { id: 'overheads', label: 'Overheads', icon: Zap },
                  { id: 'collaboration', label: 'Discussion', icon: MessageSquare }
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
              />
              
              <div className="h-8 w-px bg-border-subtle mx-2" />
              
              <div className="flex items-center gap-2">
                {summary?.status === 'draft' && (
                  <button 
                    onClick={submitForApproval}
                    disabled={isSubmitting}
                    className="btn btn-accent btn-sm h-10 px-4"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
                    <span className="text-[11px] font-black uppercase tracking-widest">Submit Approval</span>
                  </button>
                )}

                {summary?.status === 'pending_approval' && (userRole === 'director' || userRole === 'platform_god' || userRole === 'tenant_admin') && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleRejectBudget}
                      disabled={isSubmitting}
                      className="btn btn-danger btn-sm h-10 px-4"
                    >
                      <XIcon className="w-4 h-4" />
                      Reject
                    </button>
                    <button 
                      onClick={handleApproveBudget}
                      disabled={isSubmitting}
                      className="btn btn-primary btn-sm h-10 px-4"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve
                    </button>
                  </div>
                )}

                <button 
                  onClick={startSyncAll}
                  disabled={isSyncing}
                  className="btn btn-secondary h-10 w-10 p-0 rounded-xl"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
                </button>
              </div>
            </div>
          </div>
        </header>
      )}

      {summary && !isFullscreen && (
        <div className="card-default bg-surface-2/20 mb-2 px-6 py-4">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-sm group hover:border-ghost/20 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-ghost uppercase tracking-widest">Contract Value</span>
                <FileText className="w-4 h-4 text-ghost" />
              </div>
              <div className="text-xl font-bold font-mono tracking-tight text-main">{fmt(summary.total_contract)}</div>
              <div className="mt-2 h-1 bg-surface-base rounded-full overflow-hidden">
                <div className="h-full bg-ghost w-full opacity-30" />
              </div>
            </div>

            <div className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-sm group hover:border-accent/20 transition-all" style={{ marginLeft: '0px' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-accent uppercase tracking-widest">Subcontracting</span>
                <Building2 className="w-4 h-4 text-accent" />
              </div>
              <div className="text-xl font-bold font-mono text-accent tracking-tight" style={{ marginLeft: '0px' }}>{fmt(summary.total_subcontracted_cost)}</div>
              <div className="mt-2 h-1 bg-surface-base rounded-full overflow-hidden">
                <div 
                  className="h-full bg-accent opacity-30" 
                  style={{ width: `${summary.total_internal_cost > 0 ? (summary.total_subcontracted_cost / summary.total_internal_cost) * 100 : 0}%` }} 
                />
              </div>
            </div>
            
            <div className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-sm group hover:border-accent/20 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-accent uppercase tracking-widest">Planned Total</span>
                <Calculator className="w-4 h-4 text-accent" />
              </div>
              <div className="text-xl font-bold font-mono text-accent tracking-tight">{fmt(summary.total_internal_cost + summary.total_overheads)}</div>
              <div className="mt-2 h-1 bg-surface-base rounded-full overflow-hidden">
                <div className="h-full bg-accent opacity-30 w-full" />
              </div>
            </div>

            <div className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-sm group hover:border-primary/20 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-primary uppercase tracking-widest">Recipe Yield</span>
                <CheckCircle2 className="w-4 h-4 text-primary" />
              </div>
              <div className="text-xl font-bold font-mono text-primary tracking-tight">{fmt(summary.confirmed_internal_cost)}</div>
              <div className="mt-2 h-1 bg-surface-base rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500 opacity-60" 
                  style={{ width: `${summary.total_internal_cost > 0 ? (summary.confirmed_internal_cost / summary.total_internal_cost) * 100 : 0}%` }} 
                />
              </div>
            </div>

            <div className="bg-surface-1 border border-border-subtle rounded-xl p-4 shadow-sm group hover:border-warning/20 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-warning uppercase tracking-widest">Overheads</span>
                <Zap className="w-4 h-4 text-warning" />
              </div>
              <div className="text-xl font-bold font-mono text-warning tracking-tight">{fmt(summary.total_overheads)}</div>
              <div className="mt-2 h-1 bg-surface-base rounded-full overflow-hidden">
                <div 
                  className="h-full bg-warning opacity-30" 
                  style={{ width: `${summary.total_internal_cost > 0 ? (summary.total_overheads / summary.total_internal_cost) * 100 : 20}%` }} 
                />
              </div>
            </div>

            <div className={cn(
              "bg-surface-1 border rounded-xl p-4 shadow-sm transition-all shadow-lg",
              summary.margin_amount >= 0 ? "border-primary/20 shadow-primary/5" : "border-danger/20 shadow-danger/5"
            )}>
              <div className="flex items-center justify-between mb-2">
                <span className={cn(
                  "text-[11px] font-black uppercase tracking-widest",
                  summary.margin_amount >= 0 ? "text-primary" : "text-danger"
                )}>Project Margin</span>
                {summary.margin_amount >= 0 ? <TrendingUp className="w-4 h-4 text-primary" /> : <TrendingDown className="w-4 h-4 text-danger" />}
              </div>
              <div className={cn(
                "text-2xl font-bold font-mono tracking-tight",
                summary.margin_amount >= 0 ? "text-primary" : "text-danger"
              )}>
                {summary.margin_pct.toFixed(1)}%
              </div>
              <div className="text-[11px] font-mono text-ghost mt-1 text-right">{fmt(summary.margin_amount)}</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'internal-budget' && (
        <div className={cn(
          "bg-surface-1 border border-border-subtle rounded-xl flex flex-col transition-all",
          isFullscreen ? "flex-1 min-h-0" : "overflow-hidden shadow-sm"
        )}>
          <div className="px-4 py-2 border-b border-border-subtle bg-surface-2 flex flex-col md:flex-row md:items-center justify-between gap-3 min-h-14">
            <div className="flex items-center gap-2 shrink-0">
              <ClipboardCheck className="w-4 h-4 text-primary" />
              <span className="text-sm font-black uppercase tracking-widest text-main truncate max-w-[280px]">
                {isFullscreen ? project.name : "Internal Budget Analysis"}
              </span>
              <span className="ml-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-surface-base border border-border-subtle text-ghost font-sans">
                {filteredItems.length} {filteredItems.length === 1 ? 'ITEM' : 'ITEMS'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Inline Search Bar */}
              <div className="relative w-48 font-sans">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ghost" />
                <input 
                  type="text"
                  placeholder="Search budget items..."
                  className="w-full bg-transparent border border-border-subtle rounded-md py-1 pl-8 pr-3 text-[11px] font-light outline-none focus:border-primary/50 transition-all h-8 text-main placeholder-ghost/70"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Column Filter Popover */}
              <div className="relative font-sans">
                <button 
                  type="button"
                  onClick={() => setShowColumnPicker(!showColumnPicker)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 h-8 rounded-md border text-[11px] font-bold uppercase transition-all shadow-sm",
                    showColumnPicker 
                      ? "bg-accent/10 border-accent/40 text-accent font-black" 
                      : "bg-surface-base border-border-subtle text-main hover:border-accent hover:text-accent"
                  )}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Columns</span>
                </button>
                
                <AnimatePresence>
                  {showColumnPicker && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 top-10 w-56 bg-surface-1 border border-border rounded-xl shadow-xl z-[150] overflow-hidden py-1.5"
                    >
                      <div className="px-3 py-1 border-b border-border-subtle text-[9px] font-black uppercase tracking-wider text-ghost mb-1">
                        Toggle Columns
                      </div>
                      <div className="p-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {Object.entries(COLUMN_LABELS).map(([key, label]) => (
                          <label key={key} className="flex items-center justify-between px-3 py-1.5 text-xs text-main hover:bg-surface-2 cursor-pointer transition-colors select-none font-medium">
                            <span>{label}</span>
                            <input 
                              type="checkbox"
                              checked={visibleColumns.has(key)}
                              onChange={(e) => {
                                const next = new Set(visibleColumns);
                                if (e.target.checked) next.add(key);
                                else if (next.size > 2) next.delete(key);
                                setVisibleColumns(next);
                              }}
                              className="rounded text-primary focus:ring-primary w-3.5 h-3.5 border-border-subtle"
                            />
                          </label>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Mass Edit / Bulk Edit button */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    if (isMassEdit) {
                      setIsMassEdit(false);
                      setDrafts({});
                      setEditingItemId(null);
                    } else {
                      setIsMassEdit(true);
                    }
                  }}
                  className={cn(
                    "btn btn-sm h-8 px-3 text-[11px] font-bold uppercase tracking-wider transition-all shadow-sm",
                    isMassEdit ? "bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200" : "btn-secondary"
                  )}
                >
                  {isMassEdit ? <XIcon className="w-3.5 h-3.5 mr-1" /> : <Edit2 className="w-3.5 h-3.5 mr-1" />}
                  {isMassEdit ? 'Cancel' : 'Mass Edit'}
                </button>
                {(isMassEdit || editingItemId || Object.keys(drafts).length > 0) && (
                  <button 
                    onClick={handleSaveAllBudget}
                    disabled={isSaving || Object.keys(drafts).length === 0}
                    className="btn btn-primary btn-sm h-8 px-3 text-[11px] font-bold uppercase tracking-wider animate-in fade-in"
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                    Save All ({Object.keys(drafts).length})
                  </button>
                )}
              </div>

              <div className="h-6 w-px bg-border-subtle" />

              {/* Expand / Shrink Button */}
              <button 
                type="button"
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
          </div>

          <div className={cn(
            "overflow-x-auto overflow-y-auto custom-scrollbar transition-all font-sans",
            isFullscreen ? "flex-1" : "max-h-[calc(100vh-400px)]"
          )}>
            <table className="w-full text-left border-collapse table-fixed">
              <thead className="sticky top-0 z-20 bg-surface-base border-b border-border-subtle">
                <tr>
                  {visibleColumns.has('item_no') && (
                    <th style={{ width: colWidths.item_no }} className="font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 relative group select-none bg-surface-base border-b border-border-subtle">
                      <span>Ref</span>
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer"
                        onMouseDown={(e) => {
                          const startX = e.pageX;
                          const startWidth = colWidths.item_no;
                          const onMouseMove = (moveEvent: MouseEvent) => handleResize('item_no', startWidth + (moveEvent.pageX - startX));
                          const onMouseUp = () => {
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                          };
                          document.addEventListener('mousemove', onMouseMove);
                          document.addEventListener('mouseup', onMouseUp);
                        }}
                      >
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.has('description') && (
                    <th style={{ width: colWidths.description }} className="font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 relative group select-none bg-surface-base border-b border-border-subtle">
                      <span>BOQ Item</span>
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer"
                        onMouseDown={(e) => {
                          const startX = e.pageX;
                          const startWidth = colWidths.description;
                          const onMouseMove = (moveEvent: MouseEvent) => handleResize('description', startWidth + (moveEvent.pageX - startX));
                          const onMouseUp = () => {
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                          };
                          document.addEventListener('mousemove', onMouseMove);
                          document.addEventListener('mouseup', onMouseUp);
                        }}
                      >
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.has('qty') && (
                    <th style={{ width: colWidths.qty }} className="font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 text-right relative group select-none bg-surface-base border-b border-border-subtle">
                      <span>Qty</span>
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer"
                        onMouseDown={(e) => {
                          const startX = e.pageX;
                          const startWidth = colWidths.qty;
                          const onMouseMove = (moveEvent: MouseEvent) => handleResize('qty', startWidth + (moveEvent.pageX - startX));
                          const onMouseUp = () => {
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                          };
                          document.addEventListener('mousemove', onMouseMove);
                          document.addEventListener('mouseup', onMouseUp);
                        }}
                      >
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.has('contract') && (
                    <th style={{ width: colWidths.contract }} className="font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 text-right relative group select-none bg-surface-base border-b border-border-subtle">
                      <span>Contract Total</span>
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer"
                        onMouseDown={(e) => {
                          const startX = e.pageX;
                          const startWidth = colWidths.contract;
                          const onMouseMove = (moveEvent: MouseEvent) => handleResize('contract', startWidth + (moveEvent.pageX - startX));
                          const onMouseUp = () => {
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                          };
                          document.addEventListener('mousemove', onMouseMove);
                          document.addEventListener('mouseup', onMouseUp);
                        }}
                      >
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.has('no_days') && (
                    <th style={{ width: colWidths.no_days }} className="font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 text-center relative group select-none bg-surface-base border-b border-border-subtle">
                      <span>No. Days</span>
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer"
                        onMouseDown={(e) => {
                          const startX = e.pageX;
                          const startWidth = colWidths.no_days;
                          const onMouseMove = (moveEvent: MouseEvent) => handleResize('no_days', startWidth + (moveEvent.pageX - startX));
                          const onMouseUp = () => {
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                          };
                          document.addEventListener('mousemove', onMouseMove);
                          document.addEventListener('mouseup', onMouseUp);
                        }}
                      >
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.has('predecessors') && (
                    <th style={{ width: colWidths.predecessors }} className="font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 relative group select-none bg-surface-base border-b border-border-subtle">
                      <span>Predecessors</span>
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer"
                        onMouseDown={(e) => {
                          const startX = e.pageX;
                          const startWidth = colWidths.predecessors;
                          const onMouseMove = (moveEvent: MouseEvent) => handleResize('predecessors', startWidth + (moveEvent.pageX - startX));
                          const onMouseUp = () => {
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                          };
                          document.addEventListener('mousemove', onMouseMove);
                          document.addEventListener('mouseup', onMouseUp);
                        }}
                      >
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.has('trade_code') && (
                    <th style={{ width: colWidths.trade_code }} className="font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 relative group select-none bg-surface-base border-b border-border-subtle">
                      <span>Trade Code</span>
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer"
                        onMouseDown={(e) => {
                          const startX = e.pageX;
                          const startWidth = colWidths.trade_code;
                          const onMouseMove = (moveEvent: MouseEvent) => handleResize('trade_code', startWidth + (moveEvent.pageX - startX));
                          const onMouseUp = () => {
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                          };
                          document.addEventListener('mousemove', onMouseMove);
                          document.addEventListener('mouseup', onMouseUp);
                        }}
                      >
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.has('trade_name') && (
                    <th style={{ width: colWidths.trade_name }} className="font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 relative group select-none bg-surface-base border-b border-border-subtle">
                      <span>Trade Name</span>
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer"
                        onMouseDown={(e) => {
                          const startX = e.pageX;
                          const startWidth = colWidths.trade_name;
                          const onMouseMove = (moveEvent: MouseEvent) => handleResize('trade_name', startWidth + (moveEvent.pageX - startX));
                          const onMouseUp = () => {
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                          };
                          document.addEventListener('mousemove', onMouseMove);
                          document.addEventListener('mouseup', onMouseUp);
                        }}
                      >
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.has('trade') && (
                    <th style={{ width: colWidths.trade }} className="font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 relative group select-none bg-surface-base border-b border-border-subtle">
                      <span>Recipe Sync</span>
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer"
                        onMouseDown={(e) => {
                          const startX = e.pageX;
                          const startWidth = colWidths.trade;
                          const onMouseMove = (moveEvent: MouseEvent) => handleResize('trade', startWidth + (moveEvent.pageX - startX));
                          const onMouseUp = () => {
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                          };
                          document.addEventListener('mousemove', onMouseMove);
                          document.addEventListener('mouseup', onMouseUp);
                        }}
                      >
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.has('internal') && (
                    <th style={{ width: colWidths.internal }} className="font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 text-right relative group select-none bg-surface-base border-b border-border-subtle">
                      <span>Budget</span>
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer"
                        onMouseDown={(e) => {
                          const startX = e.pageX;
                          const startWidth = colWidths.internal;
                          const onMouseMove = (moveEvent: MouseEvent) => handleResize('internal', startWidth + (moveEvent.pageX - startX));
                          const onMouseUp = () => {
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                          };
                          document.addEventListener('mousemove', onMouseMove);
                          document.addEventListener('mouseup', onMouseUp);
                        }}
                      >
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.has('margin') && (
                    <th style={{ width: colWidths.margin }} className="font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 text-right relative group select-none bg-surface-base border-b border-border-subtle">
                      <span>Margin</span>
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer"
                        onMouseDown={(e) => {
                          const startX = e.pageX;
                          const startWidth = colWidths.margin;
                          const onMouseMove = (moveEvent: MouseEvent) => handleResize('margin', startWidth + (moveEvent.pageX - startX));
                          const onMouseUp = () => {
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                          };
                          document.addEventListener('mousemove', onMouseMove);
                          document.addEventListener('mouseup', onMouseUp);
                        }}
                      >
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.has('status') && (
                    <th className="font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2 text-center w-20 bg-surface-base border-b border-border-subtle">
                      Status
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-dim font-mono text-xs">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing cost breakdown...
                      </div>
                    </td>
                  </tr>
                ) : groupedItems.bills.map(bill => (
                  <React.Fragment key={bill}>
                    <tr 
                      className="bg-surface-2/40 cursor-pointer hover:bg-surface-2/60 transition-colors h-auto min-h-[3rem]"
                      onClick={() => toggleBill(bill)}
                    >
                      <td colSpan={5} className="px-4 py-2 border-b border-border-subtle border-r border-border-subtle/20">
                        <div className="flex items-center gap-2">
                          <ChevronRight className={cn(
                            "w-4 h-4 text-primary transition-transform",
                            expandedBills.has(bill) && "rotate-90"
                          )} />
                          <Building2 className="w-3 h-3 text-primary" />
                          <span className="text-[11px] font-black uppercase tracking-widest text-primary">{bill}</span>
                          <div className="flex-1 border-t border-border-subtle ml-4 opacity-30" />
                          <div className="text-[10px] font-mono font-black text-dim">
                            Σ {fmt(groupedItems.groups[bill].reduce((sum, item) => sum + (item.contract_amount || 0), 0))}
                          </div>
                        </div>
                      </td>
                    </tr>
                    {expandedBills.has(bill) && groupedItems.groups[bill].map((item, idx, arr) => {
                      if (!isItemVisible(item)) return null;

                      const level = (item.item_no?.match(/\./g) || []).length;
                      const isHeader = !item.unit || (item.contract_qty === 0 && !item.has_recipe);
                      
                      const hasChildren = arr.some((child, cIdx) => 
                        cIdx > idx && 
                        child.item_no && 
                        item.item_no && 
                        child.item_no.startsWith(item.item_no + ".")
                      );
                      const isExpanded = expandedItems.has(item.item_no || '');
                      const isRowEditing = isMassEdit || editingItemId === item.id;
                      const currentDraft = drafts[item.id] || {};

                      return (
                        <tr 
                          key={item.id} 
                          className={cn(
                            "hover:bg-surface-2/20 group transition-colors border-b border-border-subtle/30 cursor-pointer h-auto min-h-[2.5rem]", 
                            isHeader && "font-bold bg-surface-2/5",
                            selectedItemDetail?.id === item.id && "bg-primary/[0.03] border-l-2 border-l-primary"
                          )}
                          onClick={() => {
                            if (!isHeader && !isRowEditing) {
                              setSelectedItemDetail(item);
                              setIsPanelOpen(true);
                            }
                          }}
                        >
                                          {visibleColumns.has('item_no') && (
                             <td className="px-4 py-1.5 border-r border-border-subtle/20">
                               <div className={cn("text-[11px] font-mono", hasChildren ? "text-accent font-semibold" : "text-dim font-normal")}>{item.item_no}</div>
                             </td>
                           )}
                           {visibleColumns.has('description') && (
                           <td className="px-4 py-1.5 overflow-hidden border-r border-border-subtle/20">
                             <div style={{ paddingLeft: `${level * 20}px` }} className="flex items-start gap-2 relative">
                               {level > 0 && (
                                 <div className="absolute left-[calc(level*20px-10px)] top-1/2 w-2 border-t border-dashed border-border-muted -translate-x-full" 
                                      style={{ marginLeft: `${-10}px` }} />
                               )}
                               {hasChildren && (
                                 <button 
                                   onClick={(e) => toggleItemCollapse(item.item_no || '', e)}
                                   className="p-1 rounded hover:bg-border-subtle transition-colors shrink-0 z-10 bg-surface-base/50"
                                 >
                                   {isExpanded ? <ChevronDown className="w-3 h-3 text-primary" /> : <ChevronRight className="w-3 h-3 text-primary" />}
                                 </button>
                               )}
                               {!hasChildren && <div className="w-5 shrink-0" />}
                               <div className="min-w-0 flex-1">
                                 <div className={cn("leading-tight whitespace-normal break-words py-0.5", hasChildren ? "text-[13px] font-semibold text-main" : "text-[12px] font-normal text-dim/90")}>{cleanRichText(item.description)}</div>
                               </div>
                             </div>
                           </td>
                           )}
                           {visibleColumns.has('qty') && (
                           <td className={cn("px-4 py-1.5 text-right font-mono text-dim border-r border-border-subtle/20", isFullscreen ? "text-[14px]" : "text-[12px]")}>
                              {isRowEditing && !isHeader ? (
                                <div className="flex flex-col items-end gap-1">
                                  <input 
                                    type="number"
                                    className="w-full bg-surface-base border border-primary/30 rounded px-1 py-0.5 text-right font-black outline-none focus:border-primary"
                                    value={currentDraft.surveyed_qty ?? item.surveyed_qty ?? item.contract_qty ?? 0}
                                    onChange={(e) => setDrafts({...drafts, [item.id]: {...currentDraft, surveyed_qty: parseFloat(e.target.value) || 0}})}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <span className="text-[8px] opacity-70">
                                    Base: {(item.contract_qty || 0).toLocaleString()} {item.unit}
                                  </span>
                                </div>
                              ) : (
                                !isHeader && (
                                  <div className="flex flex-col items-end">
                                    <span className="font-black text-main">{(item.surveyed_qty ?? item.contract_qty ?? 0).toLocaleString()}</span>
                                    <span className="text-[8px] opacity-50 capitalize">{cleanRichText(item.unit || '')}</span>
                                  </div>
                                )
                              )}
                           </td>
                           )}
                           {visibleColumns.has('contract') && (
                           <td className={cn("px-4 py-1.5 text-right font-mono text-dim border-r border-border-subtle/20", isFullscreen ? "text-[14px]" : "text-[12px]")}>
                             {!isHeader && (
                               <div className="flex items-center justify-end">
                                 <span className="font-mono font-black text-main">{fmt(item.contract_amount)}</span>
                               </div>
                             )}
                           </td>
                           )}
                           {visibleColumns.has('no_days') && (
                           <td className={cn("px-4 py-1.5 text-center font-mono text-dim border-r border-border-subtle/20", isFullscreen ? "text-[14px]" : "text-[12px]")}>
                             {!isHeader && <span className="font-black">{calculateDuration(item.planned_start_date, item.planned_end_date) || '—'}</span>}
                           </td>
                           )}
                           {visibleColumns.has('predecessors') && (
                           <td className="px-4 py-1.5 text-[9px] font-mono text-dim leading-tight whitespace-normal break-words border-r border-border-subtle/20 uppercase tracking-tighter">
                             {!isHeader && (getPredecessorsString(item.id) || '—')}
                           </td>
                           )}
                           {visibleColumns.has('trade_code') && (
                             <td className="px-4 py-1.5 border-r border-border-subtle/20">
                               {!isHeader && item.trade_code && (
                                 <span className="bg-surface-base border border-border-subtle text-accent px-1.5 py-0.25 rounded font-mono font-black text-[8px] whitespace-nowrap">
                                   {item.trade_code}
                                 </span>
                               )}
                             </td>
                           )}
                           {visibleColumns.has('trade_name') && (
                             <td className="px-4 py-1.5 border-r border-border-subtle/20">
                               {!isHeader && (
                                 <span className="text-[9px] font-black text-main uppercase truncate tracking-widest">{item.trade_name || 'N/A'}</span>
                               )}
                             </td>
                           )}
                           {visibleColumns.has('trade') && (
                             <td className="px-4 py-1.5 border-r border-border-subtle/20">
                               {!isHeader && (
                                 <div className={cn(
                                   "px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest inline-flex items-center gap-1",
                                   item.has_recipe ? "bg-primary/10 text-primary border border-primary/20" : "bg-surface-base text-ghost border border-border-subtle"
                                 )}>
                                   <div className={cn("w-1 h-1 rounded-full", item.has_recipe ? "bg-primary" : "bg-ghost")} />
                                   {item.has_recipe ? 'Recipe Synchronized' : 'No Recipe'}
                                 </div>
                               )}
                             </td>
                           )}
                           {visibleColumns.has('internal') && (
                           <td className={cn("px-4 py-1.5 text-right font-mono font-black text-accent border-r border-border-subtle/20", isFullscreen ? "text-[14px]" : "text-[12px]")}>
                             {!isHeader && item.has_recipe ? fmt(item.total_internal_cost) : '—'}
                           </td>
                           )}
                           {visibleColumns.has('margin') && (
                           <td className={cn("px-4 py-1.5 text-right font-mono border-r border-border-subtle/20", isFullscreen ? "text-[14px]" : "text-[12px]")}>
                             {!isHeader && item.has_recipe ? (
                               <div className={cn(
                                 "flex flex-col items-end",
                                 item.margin >= 0 ? "text-primary" : "text-danger"
                               )}>
                                 <span className="font-black">{fmt(item.margin)}</span>
                                 <span className="text-[8px] font-black opacity-70">
                                   {item.contract_amount > 0 ? ((item.margin / item.contract_amount) * 100).toFixed(1) : 0}%
                                 </span>
                               </div>
                             ) : '—'}
                           </td>
                           )}
                           {visibleColumns.has('status') && (
                           <td className="px-4 py-1.5 text-center">
                             {!isHeader && (
                               <div className="flex items-center justify-center gap-2">
                                 <div className="flex justify-center flex-1">
                                   {item.recipe_confirmed ? (
                                     <div className="bg-primary/20 text-primary border border-primary/20 rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest whitespace-nowrap">Confirmed</div>
                                   ) : item.has_recipe ? (
                                     <div className="bg-warning/20 text-warning border border-warning/20 rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest whitespace-nowrap">Pending</div>
                                   ) : (
                                     <div className="w-1.5 h-1.5 rounded-full bg-border-subtle" />
                                   )}
                                 </div>
                                 {!isMassEdit && (
                                   <button 
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       setEditingItemId(editingItemId === item.id ? null : item.id);
                                     }}
                                     className="p-1 rounded hover:bg-primary/10 text-ghost hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                                   >
                                     {editingItemId === item.id ? <XIcon className="w-3 h-3" /> : <Edit2 className="w-3 h-3" />}
                                   </button>
                                 )}
                               </div>
                             )}
                           </td>
                           )}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'resource-demands' && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex bg-surface-1 border border-border-subtle p-1 rounded-lg">
              <button 
                onClick={() => setDemandSubTab('inventory')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2",
                  demandSubTab === 'inventory' ? "bg-surface-2 text-primary" : "text-ghost hover:text-dim"
                )}
              >
                <Package className="w-3.5 h-3.5" />
                Inventory View
              </button>
              <button 
                onClick={() => setDemandSubTab('boq-alignment')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2",
                  demandSubTab === 'boq-alignment' ? "bg-surface-2 text-primary" : "text-ghost hover:text-dim"
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                BOQ Alignment
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-[10px] font-mono text-ghost">
                Derived from <span className="text-primary font-bold">{items.filter(i => i.recipe_confirmed || i.trade_code === 'PREL').length}</span> confirmed recipes
              </div>
              <button 
                onClick={loadBudgetData}
                className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 border border-border-subtle rounded-lg text-xs font-bold text-main hover:bg-border-subtle transition-colors"
                title="Refresh Demands"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                Refresh
              </button>
              <button 
                onClick={() => {
                  if (expandedDemands.size > 0) {
                    setExpandedDemands(new Set());
                  } else {
                    const allKeys = new Set<string>();
                    resourceDemands.forEach(d => {
                      const typeKey = d.type;
                      const catKey = d.category || 'Uncategorized';
                      allKeys.add(`${typeKey}_${catKey}`);
                    });
                    setExpandedDemands(allKeys);
                  }
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 border border-border-subtle rounded-lg text-xs font-bold text-main hover:bg-border-subtle transition-colors"
              >
                {expandedDemands.size > 0 ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                {expandedDemands.size > 0 ? 'Collapse All' : 'Expand All'}
              </button>
              <button 
                onClick={() => {
                  const committedValue = resourceDemands.reduce((sum, d) => sum + (d.total_cost || 0), 0);
                  const contractValue = items.reduce((sum, d) => sum + (d.contract_amount || 0), 0);
                  const overheadsValue = overheads.reduce((sum, d) => sum + (d.amount || 0), 0);
                  const projectedMargin = contractValue - committedValue - overheadsValue;
                  const marginPct = contractValue > 0 ? (projectedMargin / contractValue) * 100 : 0;
                  
                  setActionResult({
                    title: 'Project Financial Forecast',
                    rows: [
                      { label: 'Contract Value', value: fmt(contractValue) },
                      { label: 'Committed Cost (Resources)', value: fmt(committedValue) },
                      { label: 'Planned Overheads', value: fmt(overheadsValue) },
                      { 
                        label: 'Projected Site Margin', 
                        value: `${fmt(projectedMargin)} (${marginPct.toFixed(1)}%)`,
                        status: marginPct > 15 ? 'ok' : marginPct > 5 ? 'warn' : 'error'
                      }
                    ],
                    summary: 'This analysis assumes current consumption rates remain constant and all library rates are locked.'
                  });
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-xs font-bold hover:bg-emerald-500/20 transition-colors"
                title="Projected Performance"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Budget Forecast
              </button>
              <button 
                onClick={() => {
                  const noRates = resourceDemands.filter(d => !d.rate || d.rate === 0);
                  const opItems = resourceDemands.filter(d => d.type === 'operational');
                  
                  if (noRates.length > 0) {
                    setActionResult({
                      title: 'Health Check Alert',
                      rows: noRates.slice(0, 5).map(r => ({
                        label: r.name,
                        value: 'Missing Rate',
                        status: 'error'
                      })),
                      summary: `Found ${noRates.length} resources without valid rates. Please update rates in the Trade Library to ensure budget accuracy.`,
                      action: {
                        label: 'Fix Rates Now',
                        onClick: () => onSelectModule?.('library')
                      }
                    });
                  } else {
                    setActionResult({
                      title: 'Budget Health: Optimal',
                      rows: [
                        { label: 'Resource Rates', value: '100% Verified', status: 'ok' },
                        { label: 'Operational Items', value: `${opItems.length} Tracked`, status: 'ok' },
                        { label: 'Sync Status', value: 'Fully Synchronized', status: 'ok' }
                      ],
                      summary: 'Demands are ready for procurement phase.'
                    });
                  }
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-bold hover:bg-primary/20 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Health Check
              </button>
              <button 
                onClick={() => {
                  const leadItems = resourceDemands.filter(d => d.type === 'machinery' || d.type === 'equipment').length;
                  const missingRates = resourceDemands.filter(d => !d.rate).length;
                  
                  setActionResult({
                    title: 'Procurement Readiness',
                    rows: [
                      { label: 'Long-lead Items', value: leadItems.toString() },
                      { label: 'Total Purchase Orders Required', value: resourceDemands.length.toString() },
                      { label: 'Supplier Verification Needed', value: missingRates.toString(), status: missingRates > 0 ? 'warn' : 'ok' }
                    ],
                    summary: 'Ready to generate Purchase Orders?',
                    action: {
                      label: 'Generate POs',
                      onClick: () => onSelectModule?.('procurement')
                    }
                  });
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 text-accent border border-accent/20 rounded-lg text-xs font-bold hover:bg-accent/20 transition-colors"
                title="Procurement Readiness"
              >
                <Truck className="w-3.5 h-3.5" />
                Procurement Check
              </button>
              <button 
                onClick={exportResourceDemands}
                className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 border border-border-subtle rounded-lg text-xs font-bold text-main hover:bg-border-subtle transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Export Excel
              </button>
            </div>
          </div>

          {demandSubTab === 'inventory' ? (
            <div className="space-y-12">
              {['operational', 'material', 'labour', 'machinery', 'tool', 'fuel', 'subcontractor', 'other'].map(type => {
                const typeDemands = resourceDemands.filter(d => d.type === type || (type === 'machinery' && d.type === 'machinery'));
                if (typeDemands.length === 0 && type !== 'operational') return null;

                const typeIcons = {
                  operational: <Boxes className="w-4 h-4 text-primary" />,
                  material: <Package className="w-4 h-4 text-accent" />,
                  labour: <Users className="w-4 h-4 text-primary" />,
                  machinery: <Truck className="w-4 h-4 text-danger" />,
                  tool: <Wrench className="w-4 h-4 text-warning" />,
                  fuel: <Zap className="w-4 h-4 text-warning" />,
                  subcontractor: <Building2 className="w-4 h-4 text-dim" />,
                  other: <Briefcase className="w-4 h-4 text-ghost" />
                };

                // Secondary group by category within type
                const categoryGroups: Record<string, typeof resourceDemands> = {};
                typeDemands.forEach(d => {
                  if (!categoryGroups[d.category]) categoryGroups[d.category] = [];
                  categoryGroups[d.category].push(d);
                });

                return (
                  <div key={type} className="flex flex-col gap-6">
                    <div className="flex items-center gap-3 border-b border-border-subtle pb-3">
                      <div className="p-2 rounded-lg bg-surface-1 border border-border-subtle">
                        {typeIcons[type as keyof typeof typeIcons]}
                      </div>
                      <div>
                        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-main">
                          {type === 'operational' ? 'Operational Supplies' :
                           type === 'labour' ? 'Labour Forces' : 
                           type === 'machinery' ? 'Plant & Machinery' : 
                           type === 'fuel' ? 'Fuel & Energy' : 
                           `${type.charAt(0).toUpperCase() + type.slice(1)} Demands`}
                        </h2>
                        <div className="text-[10px] text-dim font-mono mt-0.5">
                          {type === 'operational' ? (
                            <span className="text-ghost italic">Project-wide operational requirements</span>
                          ) : (
                            `${typeDemands.length} items demanded across project`
                          )}
                        </div>
                      </div>
                    </div>

                    {type === 'operational' && (
                      <button 
                        onClick={() => setShowBundleModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] hover:bg-primary-dark transition-all active:scale-95"
                      >
                        <Plus className="w-4 h-4" /> Add Multi-Resource Bundle
                      </button>
                    )}

                    <div className="space-y-3">
                      {Object.keys(categoryGroups).sort().map(cat => {
                        const demands = categoryGroups[cat];
                        const isExpanded = expandedDemands.has(`${type}_${cat}`);
                        const totalCatCost = demands.reduce((sum, d) => sum + d.total_cost, 0);

                        return (
                          <div key={cat} className="flex flex-col border border-border-subtle rounded-xl overflow-hidden bg-surface-1/30">
                            <button 
                              onClick={() => toggleDemandCollapse(`${type}_${cat}`)}
                              className="flex items-center justify-between p-3 hover:bg-surface-2/50 transition-colors group text-left"
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-6 h-6 rounded flex items-center justify-center transition-all",
                                  !isExpanded ? "bg-surface-2 text-ghost" : "bg-primary/10 text-primary"
                                )}>
                                  {!isExpanded ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </div>
                                <div>
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-main">{cat}</div>
                                  <div className="text-[9px] text-dim font-mono">{demands.length} Resources</div>
                                </div>
                              </div>
                              <div className="text-right flex items-center gap-4">
                                <div>
                                  <div className="text-[8px] text-dim uppercase tracking-tighter">Category Value</div>
                                  <div className="text-xs font-mono font-bold text-primary">{fmt(totalCatCost)}</div>
                                </div>
                              </div>
                            </button>

                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.15, ease: "easeInOut" }}
                                >
                                  <div className="border-t border-border-subtle bg-surface-base/80">
                                    <table className="w-full text-left border-collapse table-fixed">
                                      <thead>
                                        <tr className="bg-surface-2/50 border-b border-border-subtle">
                                          <th className="px-5 py-2 text-[9px] font-mono uppercase tracking-widest text-dim w-12 text-center">#</th>
                                          <th className="px-5 py-2 text-[9px] font-mono uppercase tracking-widest text-dim">Resource Description</th>
                                          <th className="px-5 py-2 text-[9px] font-mono uppercase tracking-widest text-dim text-right w-20">Unit</th>
                                          <th className="px-5 py-2 text-[9px] font-mono uppercase tracking-widest text-dim text-right w-24">Rate</th>
                                          <th className="px-5 py-2 text-[9px] font-mono uppercase tracking-widest text-dim text-right w-28 font-bold text-accent">Total Qty</th>
                                          <th className="px-5 py-2 text-[9px] font-mono uppercase tracking-widest text-dim text-right w-32 font-bold text-primary">Extension</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border-subtle/30">
                                        {demands.map((demand, i) => (
                                          <tr key={i} className="hover:bg-surface-2/20 transition-colors group">
                                            <td className="px-5 py-1.5 text-[10px] font-mono text-dim text-center">
                                              {i + 1}
                                            </td>
                                            <td className="px-5 py-1.5 min-w-0">
                                              <div className="text-[11px] font-black text-main leading-tight whitespace-normal break-words uppercase">{cleanRichText(demand.name)}</div>
                                            </td>
                                            <td className="px-5 py-1.5 text-right text-[10px] font-mono text-dim uppercase">
                                              {formatUnit(demand.unit)}
                                            </td>
                                            <td className="px-5 py-1.5 text-right font-mono text-[10px] text-ghost">
                                              {fmt(demand.rate)}
                                            </td>
                                            <td className="px-5 py-1.5 text-right">
                                              {type === 'operational' ? (
                                                <input 
                                                  type="number"
                                                  defaultValue={demand.total_qty}
                                                  onBlur={async (e) => {
                                                    const val = parseFloat(e.target.value);
                                                    if (isNaN(val)) return;
                                                    const sourceRes = resources.find(r => r.resource_name === demand.name && r.resource_category === cat);
                                                    if (sourceRes) {
                                                      const { error } = await supabase
                                                        .from('boq_item_resources')
                                                        .update({ consumption_rate: val })
                                                        .eq('id', sourceRes.id);
                                                      if (!error) loadBudgetData();
                                                    }
                                                  }}
                                                  className="w-16 bg-surface-base border border-border-subtle rounded px-1.5 py-0.5 text-[10px] font-mono text-right text-main outline-none focus:border-primary transition-all"
                                                />
                                              ) : (
                                                <span className="text-[10px] font-mono font-bold text-accent">
                                                  {(demand.total_qty || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-5 py-1.5 text-right">
                                              <div className="text-[10px] font-mono font-bold text-primary">
                                                {fmt(demand.total_cost)}
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                        {/* Inline Add for Operational Supplies */}
                                        {type === 'operational' && (
                                          <tr className="bg-primary/[0.02] border-t border-primary/10">
                                            <td className="px-5 py-2 text-[10px] font-mono text-primary italic">
                                              <Plus className="w-3 h-3" />
                                            </td>
                                            <td className="px-5 py-2" colSpan={4}>
                                              <input 
                                                type="text"
                                                placeholder={`Add custom requirement to ${cat}... (e.g. "Site Signage")`}
                                                className="w-full bg-transparent border-none outline-none text-xs font-bold text-main placeholder:text-ghost/30"
                                                onKeyDown={async (e) => {
                                                  if (e.key === 'Enter') {
                                                    const target = e.target as HTMLInputElement;
                                                    const name = target.value;
                                                    if (!name) return;
                                                    await handleAddBundle({
                                                      name: 'Custom Entry',
                                                      category: cat,
                                                      items: [{ name, qty: 1, type: 'operational', unit: 'pcs' }]
                                                    });
                                                    target.value = '';
                                                  }
                                                }}
                                              />
                                            </td>
                                            <td className="px-5 py-2 text-right">
                                              <span className="text-[8px] font-black text-primary/40 uppercase tracking-widest whitespace-nowrap">Press Enter to Add</span>
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex bg-surface-1 border border-border-subtle rounded-xl overflow-hidden h-[700px] shadow-2xl">
              {/* Left Sidebar: BOQ Tree Navigation */}
              <div className="w-[350px] border-r border-border-subtle flex flex-col bg-surface-base">
                <div className="p-4 border-b border-border-subtle bg-surface-1/30">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-ghost mb-1">Project Structure</div>
                  <div className="text-xs text-dim">Select an activity to see localized resource demand.</div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {/* Operational Supplies (Preliminaries) Alignment Section */}
                  <div className="p-4 bg-primary/[0.03] border border-primary/20 rounded-xl">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Boxes className="w-4 h-4 text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-main">Operational Costs</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-primary">
                        {fmt(resources.filter(r => r.source_trade_code === 'PREL' || items.find(i => i.id === r.boq_item_id)?.trade_code === 'PREL').reduce((sum, r) => sum + (r.consumption_rate * (libraryRates[r.resource_name] || 0)), 0))}
                      </span>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {resources.filter(r => r.source_trade_code === 'PREL' || items.find(i => i.id === r.boq_item_id)?.trade_code === 'PREL').map((res, i) => (
                        <div key={i} className="bg-surface-1 border border-border-subtle/50 p-2 rounded-lg flex items-center justify-between group">
                          <div>
                            <div className="text-[10px] font-bold text-main leading-tight">{cleanRichText(res.resource_name)}</div>
                            <div className="text-[9px] text-ghost uppercase mt-0.5">{res.consumption_rate} {res.unit} committed</div>
                          </div>
                          <div className="text-[10px] font-mono text-primary font-bold">
                            {fmt(res.consumption_rate * (libraryRates[res.resource_name] || 0))}
                          </div>
                        </div>
                      ))}
                      {resources.filter(r => r.source_trade_code === 'PREL' || items.find(i => i.id === r.boq_item_id)?.trade_code === 'PREL').length === 0 && (
                        <div className="text-[10px] text-ghost italic text-center py-4 border-2 border-dashed border-border-subtle rounded-lg">
                          No operational supplies committed. Click "Add Bundle" to start.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-border-subtle pt-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-ghost mb-2">Activity Demands</div>
                    <div className="space-y-1">
                      {(() => {
                        const renderTree = (nodes: any[], level = 0) => {
                        return nodes.map(node => {
                          const isExpanded = expandedBoqNodes.has(node.id);
                          const isSelected = selectedBoqNodeId === node.id;
                          const hasChildren = node.children && node.children.length > 0;

                          return (
                            <div key={node.id} className="flex flex-col">
                              <button 
                                onClick={() => setSelectedBoqNodeId(node.id)}
                                className={cn(
                                  "group flex items-start gap-2 w-full p-2 rounded-lg transition-all text-left relative",
                                  isSelected ? "bg-primary/10 ring-1 ring-primary/30 shadow-lg shadow-primary/5" : "hover:bg-surface-2/50"
                                )}
                              >
                                <div style={{ width: `${level * 16}px` }} />
                                {hasChildren ? (
                                  <div 
                                    onClick={(e) => toggleBoqNode(node.id, e)}
                                    className="p-1 rounded cursor-pointer hover:bg-surface-3 text-dim"
                                  >
                                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                  </div>
                                ) : (
                                  <div className="w-5" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className={cn(
                                      "text-[10px] font-mono font-bold transition-colors",
                                      isSelected ? "text-primary" : "text-ghost"
                                    )}>
                                      {node.item_no || '•'}
                                    </span>
                                    {node.isBill && <Building2 className="w-3 h-3 text-accent" />}
                                  </div>
                                  <div className={cn(
                                    "text-xs leading-tight line-clamp-2 transition-colors",
                                    isSelected ? "text-white font-bold" : "text-dim group-hover:text-white"
                                  )}>
                                    {cleanRichText(node.description)}
                                  </div>
                                </div>
                                {isSelected && (
                                  <div className="absolute right-2 translate-y-[2px]">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-lg shadow-primary/20" />
                                  </div>
                                )}
                              </button>
                              
                              <AnimatePresence initial={false}>
                                {hasChildren && isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                  >
                                    {renderTree(node.children, level + 1)}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        });
                      };
                      return renderTree(boqTree);
                    })()}
                  </div>
                </div>
              </div>
            </div>

              {/* Right Side: Localized Resource Demand Table */}
              <div className="flex-1 flex flex-col bg-surface-1/30">
                <div className="p-5 border-b border-border-subtle flex items-center justify-between bg-surface-1/20">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-main">
                      {selectedNode ? cleanRichText(selectedNode.description) : 'Select a node from project structure'}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedNode && (
                        <>
                          <span className="px-1.5 py-0.5 rounded bg-surface-2 border border-border-subtle text-[8px] font-mono text-primary uppercase">
                            Selected Layer
                          </span>
                          <span className="text-[10px] text-dim font-mono">
                            {selectedNode.aggregatedItemIds.length} BOQ Items aggregated
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {selectedNode && (
                    <div className="text-right">
                      <div className="text-[9px] text-dim uppercase tracking-widest mb-0.5">Estimated Resource value</div>
                      <div className="text-xl font-mono font-bold text-accent">
                        {fmt(boqContextResources.reduce((sum, r) => sum + r.total_cost, 0))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-auto p-6 space-y-12">
                  {selectedNode ? (
                    boqContextResources.length > 0 ? (
                      ['material', 'labour', 'machinery', 'tool', 'fuel', 'subcontractor', 'other'].map(type => {
                        const typeContextResources = boqContextResources.filter(r => r.type === type);
                        if (typeContextResources.length === 0) return null;

                        const typeIcons = {
                          material: <Package className="w-4 h-4 text-accent" />,
                          labour: <Users className="w-4 h-4 text-primary" />,
                          machinery: <Truck className="w-4 h-4 text-danger" />,
                          tool: <Wrench className="w-4 h-4 text-warning" />,
                          fuel: <Zap className="w-4 h-4 text-warning" />,
                          subcontractor: <Building2 className="w-4 h-4 text-dim" />,
                          other: <Briefcase className="w-4 h-4 text-ghost" />
                        };

                        return (
                          <div key={type} className="space-y-4">
                            <div className="flex items-center gap-3 border-b border-border-subtle pb-3">
                              <div className="p-2 rounded-lg bg-surface-1 border border-border-subtle">
                                {typeIcons[type as keyof typeof typeIcons]}
                              </div>
                              <h4 className="text-xs font-bold uppercase tracking-widest text-main">
                                {type === 'labour' ? 'Labour Forces' : 
                                 type === 'machinery' ? 'Plant & Machinery' : 
                                 type === 'fuel' ? 'Fuel & Energy' : 
                                 `${type.charAt(0).toUpperCase() + type.slice(1)} requirements`}
                              </h4>
                            </div>

                            <div className="bg-surface-base rounded-xl border border-border-subtle overflow-hidden">
                              <table className="w-full text-left border-collapse table-fixed">
                                <thead>
                                  <tr className="bg-surface-1 border-b border-border-subtle">
                                    <th className="px-4 py-2 text-[9px] font-mono uppercase tracking-widest text-dim w-10 text-center">#</th>
                                    <th className="px-4 py-2 text-[9px] font-mono uppercase tracking-widest text-dim">Description</th>
                                    <th className="px-4 py-2 text-[9px] font-mono uppercase tracking-widest text-dim text-right w-20">Qty</th>
                                    <th className="px-4 py-2 text-[9px] font-mono uppercase tracking-widest text-dim text-right w-24 text-primary">Value</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle/30">
                                  {typeContextResources.map((res, i) => (
                                    <tr key={i} className="hover:bg-surface-2/30 transition-colors group">
                                      <td className="px-4 py-1.5 text-[10px] font-mono text-dim text-center">{i + 1}</td>
                                      <td className="px-4 py-1.5 min-w-0">
                                        <div className="text-[11px] font-bold text-main leading-tight whitespace-normal break-words">{cleanRichText(res.resource_name)}</div>
                                        <div className="text-[9px] text-ghost uppercase font-mono mt-0.5">{res.category} • {formatUnit(res.unit)}</div>
                                      </td>
                                      <td className="px-4 py-1.5 text-right font-mono text-[10px] text-dim">
                                        {(res.total_qty || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                      </td>
                                      <td className="px-4 py-1.5 text-right">
                                        <div className="text-[11px] font-mono font-bold text-primary">{fmt(res.total_cost)}</div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center p-10 mt-20">
                        <AlertCircle className="w-8 h-8 text-dim mb-3 opacity-20" />
                        <div className="text-xs font-medium text-ghost">
                          No resources assigned to this section or its children yet.
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-10 animate-in fade-in zoom-in duration-500 mt-20">
                      <div className="w-20 h-20 rounded-full border-2 border-dashed border-border-subtle flex items-center justify-center mb-6 relative">
                        <Layers className="w-8 h-8 text-border-subtle" />
                        <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin opacity-20" />
                      </div>
                      <h4 className="text-sm font-bold text-main mb-2 uppercase tracking-widest">Select an activity</h4>
                      <p className="text-xs text-dim max-w-[280px]">
                        Drill down into the project bill of quantities using the hierarchy on the left to analyze local resource impact.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'subcontractor-contracts' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-accent flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Subcontractor Contract Assignments
            </h2>
            <div className="text-[10px] font-mono text-dim">
              Showing {subAssignments.length} active assignments across {new Set(subAssignments.map(a => a.subcontractor_id)).size} vendors
            </div>
          </div>

          <div className="bg-surface-1 border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left table-fixed">
              <thead>
                <tr className="bg-surface-2 border-b border-border-subtle">
                  <th className="px-4 py-2 text-[9px] font-mono uppercase tracking-widest text-dim w-24">Item No</th>
                  <th className="px-4 py-2 text-[9px] font-mono uppercase tracking-widest text-dim w-48">Subcontractor</th>
                  <th className="px-4 py-2 text-[9px] font-mono uppercase tracking-widest text-dim">Description</th>
                  <th className="px-4 py-2 text-[9px] font-mono uppercase tracking-widest text-dim text-right w-28">Unit Rate</th>
                  <th className="px-4 py-2 text-[9px] font-mono uppercase tracking-widest text-dim text-right w-32">Extension</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {subAssignments.length > 0 ? subAssignments.map((assign, idx) => {
                  const boqItem = items.find(i => i.id === assign.boq_item_id);
                  const qty = boqItem?.surveyed_qty || boqItem?.contract_qty || 0;
                  const extension = qty * (assign.contract_rate || 0);
                  
                  return (
                    <tr key={assign.id || idx} className="hover:bg-surface-2/20 group transition-colors h-auto min-h-[3rem]">
                      <td className="px-4 py-2">
                        <span className="text-[10px] font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10 font-black">
                          {boqItem?.item_no || '---'}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-accent/10 flex items-center justify-center text-accent flex-shrink-0">
                             <Users className="w-3 h-3" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold text-main leading-tight truncate">{assign.subcontractor_name || 'Vendor ID: ' + (assign.subcontractor_id?.slice(0, 8) || 'Unknown')}</div>
                            <div className="text-[8px] text-ghost font-mono uppercase">{assign.trade_code || 'General'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="text-[11px] text-dim leading-tight whitespace-normal break-words">
                          {cleanRichText(boqItem?.description || 'No description available')}
                        </div>
                        {assign.comment && (
                           <div className="text-[8px] text-ghost italic mt-1 flex items-center gap-1">
                             <MessageSquare className="w-2.5 h-2.5" />
                             {assign.comment}
                           </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="text-[11px] font-mono font-bold text-main">{fmt(assign.contract_rate)}</div>
                        <div className="text-[8px] text-dim uppercase">per {formatUnit(boqItem?.unit)}</div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="text-[11px] font-mono font-bold text-primary">{fmt(extension)}</div>
                        <div className="text-[8px] text-ghost">{qty.toLocaleString()} {formatUnit(boqItem?.unit)}</div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={5} className="p-12 text-center">
                       <Building2 className="w-12 h-12 text-ghost/10 mx-auto mb-4" />
                       <div className="text-sm font-medium text-ghost italic">No subcontractor contracts assigned to this project yet.</div>
                       <button 
                         onClick={() => onSelectModule?.('subcontractors')}
                         className="mt-4 text-xs font-bold text-primary hover:underline uppercase tracking-widest"
                       >
                         Assign Subcontractors Now
                       </button>
                    </td>
                  </tr>
                )}
              </tbody>
              {subAssignments.length > 0 && (
                <tfoot className="bg-surface-2/50 border-t border-border-subtle">
                   <tr>
                     <td colSpan={4} className="px-4 py-3 text-[10px] font-bold text-ghost uppercase text-right tracking-widest">Total Assigned Contract Value:</td>
                     <td className="px-4 py-3 text-right">
                        <span className="text-sm font-mono font-black text-primary">
                          {fmt(subAssignments.reduce((sum, a) => {
                            const bi = items.find(i => i.id === a.boq_item_id);
                            const q = bi?.surveyed_qty || bi?.contract_qty || 0;
                            return sum + (q * a.contract_rate);
                          }, 0))}
                        </span>
                     </td>
                   </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {activeTab === 'overheads' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-warning flex items-center gap-2">
              <Coins className="w-4 h-4" />
              Project-wide Overheads
            </h2>
            <button onClick={addOverhead} className="btn btn-accent btn-xs">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Expense
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {['Personnel', 'Logistics', 'Compliance', 'Operations'].map(cat => (
              <div key={cat} className="bg-surface-1 border border-border-subtle rounded-xl p-4">
                <div className="text-[10px] font-mono text-ghost uppercase tracking-widest mb-3">{cat}</div>
                <div className="text-2xl font-bold font-mono">
                  {fmt(overheads.filter(o => o.category === cat).reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0))}
                </div>
                <div className="text-[10px] text-dim mt-1">Total Allocated</div>
              </div>
            ))}
          </div>

          <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left table-fixed">
              <thead>
                <tr className="bg-surface-2 border-b border-border-subtle">
                  <th className="px-4 py-2 text-[9px] font-mono uppercase tracking-widest text-dim w-32">Category</th>
                  <th className="px-4 py-2 text-[9px] font-mono uppercase tracking-widest text-dim">Description</th>
                  <th className="px-4 py-2 text-[9px] font-mono uppercase tracking-widest text-dim text-right w-32">Amount (USD)</th>
                  <th className="px-4 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {overheads.map(ov => (
                  <tr key={ov.id} className="hover:bg-surface-2/20">
                    <td className="px-4 py-1.5">
                      <select 
                        value={ov.category}
                        onChange={(e) => handleOverheadUpdate(ov.id, 'category', e.target.value)}
                        className="w-full bg-surface-2 border border-border-subtle rounded px-2 py-0.5 text-[10px] font-bold outline-none focus:border-primary transition-all"
                      >
                        <option>Personnel</option>
                        <option>Logistics</option>
                        <option>Compliance</option>
                        <option>Operations</option>
                      </select>
                    </td>
                    <td className="px-4 py-1.5">
                      <input 
                        type="text"
                        value={ov.description}
                        onChange={(e) => handleOverheadUpdate(ov.id, 'description', e.target.value)}
                        placeholder="Expense detail..."
                        className="w-full bg-transparent border-none outline-none text-[11px] font-bold text-main placeholder-ghost/30"
                      />
                    </td>
                    <td className="px-4 py-1.5">
                      <input 
                        type="number"
                        value={ov.amount}
                        onChange={(e) => handleOverheadUpdate(ov.id, 'amount', e.target.value)}
                        className="w-full bg-transparent border-none outline-none text-right text-[11px] font-mono font-bold text-main"
                      />
                    </td>
                    <td className="px-4 py-1.5 text-center">
                      <button onClick={() => removeOverhead(ov.id)} className="text-dim hover:text-danger transition-colors p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {overheads.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-xs text-dim italic">No overhead expenses added.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'collaboration' && (
        <div className="flex flex-col gap-6 h-[calc(100vh-280px)]">
          <CollaborationFeed 
            projectId={project.id} 
            tenantId={tenantId}
            category="budget"
          />
        </div>
      )}

      {/* Bundle Selection Modal */}
      <AnimatePresence>
        {showBundleModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBundleModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-surface-1 border border-border-subtle rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border-subtle flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-main uppercase tracking-tight">Select Resource Bundle</h2>
                  <p className="text-xs text-ghost">Import pre-configured operational supply bundles to your project demand</p>
                </div>
                <button 
                  onClick={() => setShowBundleModal(false)}
                  className="p-2 text-ghost hover:text-main hover:bg-surface-2 rounded-xl transition-all"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 max-h-[70vh] overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 bg-surface-base/50">
                {OPERATIONAL_BUNDLES.map(bundle => (
                  <button 
                    key={bundle.id}
                    onClick={() => handleAddBundle(bundle)}
                    disabled={isBundling}
                    className="group relative flex flex-col p-6 bg-surface-1 border border-border-subtle rounded-[2rem] text-left hover:border-primary hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 overflow-hidden disabled:opacity-50"
                  >
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 pointer-events-none">
                      {bundle.id === 'staff-acc' && <Lamp className="w-32 h-32" />}
                      {bundle.id === 'med-safety' && <Stethoscope className="w-32 h-32" />}
                      {bundle.id === 'startup-tools' && <Wrench className="w-32 h-32" />}
                      {bundle.id === 'ppe-bundle' && <ShieldCheck className="w-32 h-32" />}
                      {bundle.id === 'specialty-tools' && <Zap className="w-32 h-32" />}
                    </div>

                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-500">
                        {bundle.id === 'staff-acc' && <Lamp className="w-6 h-6" />}
                        {bundle.id === 'med-safety' && <Stethoscope className="w-6 h-6" />}
                        {bundle.id === 'startup-tools' && <Wrench className="w-6 h-6" />}
                        {bundle.id === 'ppe-bundle' && <ShieldCheck className="w-6 h-6" />}
                        {bundle.id === 'specialty-tools' && <Zap className="w-6 h-6" />}
                      </div>
                      <span className="text-[10px] font-black text-ghost bg-surface-base px-2.5 py-1 rounded-full border border-border-subtle">
                        {bundle.items.length} ITEMS
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-black text-main uppercase tracking-tight mb-2 group-hover:text-primary transition-colors">
                      {bundle.name}
                    </h3>
                    <p className="text-xs text-dim leading-relaxed mb-6 line-clamp-2">
                      {bundle.description}
                    </p>
                     
                    <div className="space-y-2 mb-8">
                      {bundle.items.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[10px] font-medium text-ghost py-1 border-b border-border-subtle/50">
                          <span>{item.name}</span>
                          <span className="font-mono text-dim">x{item.qty} {item.unit}</span>
                        </div>
                      ))}
                      {bundle.items.length > 3 && (
                        <div className="text-[9px] text-primary font-bold italic pt-1">
                          + {bundle.items.length - 3} additional items in bundle
                        </div>
                      )}
                    </div>

                    <div className="mt-auto pt-4 flex items-center justify-between border-t border-border-subtle/30">
                       <span className="text-[10px] font-black text-primary opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-500 flex items-center gap-2">
                         IMPORT AS PROJECT DEMAND <ArrowRight className="w-4 h-4" />
                       </span>
                    </div>
                  </button>
                ))}
                
                <button className="flex flex-col items-center justify-center p-8 bg-surface-1 border-2 border-dashed border-border-subtle rounded-[2rem] hover:border-primary/50 hover:bg-primary/[0.02] transition-all group gap-4">
                  <div className="w-16 h-16 rounded-full bg-ghost/5 flex items-center justify-center text-ghost group-hover:text-primary transition-colors">
                    <Plus className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <h4 className="text-sm font-black text-ghost group-hover:text-primary uppercase tracking-widest">Custom Template</h4>
                    <p className="text-[10px] text-ghost/60 mt-1 max-w-[150px]">Create or upload your own bundle definition</p>
                  </div>
                </button>
              </div>

              <div className="p-6 bg-surface-2 border-t border-border-subtle flex items-center justify-end">
                <button 
                  onClick={() => setShowBundleModal(false)}
                  className="px-6 py-2 text-xs font-bold text-dim hover:text-main transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Item Detail Sidebar */}
      {isPanelOpen && selectedItemDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          <div className="absolute inset-0 bg-surface-base/80 backdrop-blur-sm" onClick={() => setIsPanelOpen(false)} />
          <div 
            style={{ width: panelWidth }}
            className="relative h-full bg-surface-1 border-l border-border-subtle shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
          >
            {/* Resize Handle */}
            <div 
              onMouseDown={startResizingPanel}
              className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary transition-colors z-10"
            />
            <div className="p-6 border-b border-border-subtle bg-surface-2 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                    {selectedItemDetail.item_no}
                  </span>
                  <h2 className="text-lg font-bold text-main">Cost calculations</h2>
                </div>
                <p className="text-xs text-ghost font-medium">{cleanRichText(selectedItemDetail.description)}</p>
              </div>
              <button 
                onClick={() => setIsPanelOpen(false)}
                className="p-2 hover:bg-surface-3 rounded-lg transition-colors text-ghost"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Item Info Summary */}
              <div className="bg-surface-2 rounded-2xl border border-border-subtle overflow-hidden shadow-lg">
                <div className="px-6 py-4 border-b border-border-subtle bg-surface-1/50">
                  <div className="text-[10px] font-mono text-dim uppercase tracking-widest mb-1">Item Specification</div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-bold text-main uppercase">{selectedItemDetail.item_no} — {cleanRichText(selectedItemDetail.description)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-dim uppercase">Trade:</span>
                      <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                        {selectedItemDetail.trade_code || 'Direct'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 divide-x divide-border-subtle">
                  <div className="p-4 text-center">
                    <div className="text-[9px] font-mono text-dim uppercase mb-1">Quantity</div>
                    <div className="text-sm font-bold font-mono text-main">{selectedItemDetail.contract_qty} <span className="text-[10px] text-dim font-normal">{formatUnit(selectedItemDetail.unit)}</span></div>
                  </div>
                  <div className="p-4 text-center">
                    <div className="text-[9px] font-mono text-dim uppercase mb-1">Contract Rate</div>
                    <div className="text-sm font-bold font-mono text-main">{fmt(selectedItemDetail.contract_rate)}</div>
                  </div>
                  <div className="p-4 text-center">
                    <div className="text-[9px] font-mono text-dim uppercase mb-1">Contract Total</div>
                    <div className="text-sm font-bold font-mono text-main">{fmt(selectedItemDetail.contract_amount)}</div>
                  </div>
                  <div className="p-4 text-center">
                    <div className="text-[9px] font-mono text-dim uppercase mb-1">Internal Budget</div>
                    <div className="text-sm font-bold font-mono text-primary">
                      {(() => {
                        const itemRes = resources.filter(r =>
                          r.boq_item_id === selectedItemDetail.id &&
                          !r.is_excluded &&
                          (r.is_manual || !selectedItemDetail.trade_code ||
                            r.source_trade_code === selectedItemDetail.trade_code || !r.source_trade_code)
                        );
                        // Deduplicate (SSOT)
                        const uniqueMap = new Map();
                        itemRes.forEach(r => {
                          if (!uniqueMap.has(r.resource_name)) uniqueMap.set(r.resource_name, r);
                        });
                        const cleanRes = Array.from(uniqueMap.values()) as any[];
                        
                        const itemQty = selectedItemDetail.surveyed_qty || selectedItemDetail.contract_qty || 0;
                        const total = cleanRes.reduce((sum, res) => {
                          const typeKey = (res.resource_type || '').toLowerCase();
                          const lookupKey = (res.resource_name || '').toLowerCase().trim();
                          const libraryRate = libraryResources[`${typeKey}_rate_${lookupKey}`] || 0;
                          const currentRate = (res.is_manual && res.effective_rate != null) ? Number(res.effective_rate) : (Number(libraryRate) || 0);
                          const factorWithWaste = res.consumption_rate * (1 + (res.waste_factor_pct || 0) / 100);
                          // Use rounded quantity for consistent math display
                          const rowQty = Math.round(factorWithWaste * itemQty * 10000) / 10000;
                          return sum + (rowQty * currentRate);
                        }, 0);
                        return fmt(total);
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Resource Requirements List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-ghost flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" />
                    Total Resource Requirements
                  </h3>
                  <div className="text-[10px] font-mono text-dim">
                    Based on Confirmed Recipe (Factors per unit)
                  </div>
                </div>

                <div className="flex flex-col gap-6">
                  {(() => {
                    const itemRes = resources.filter(r =>
                      r.boq_item_id === selectedItemDetail.id &&
                      !r.is_excluded &&
                      (r.is_manual || !selectedItemDetail.trade_code ||
                        r.source_trade_code === selectedItemDetail.trade_code || !r.source_trade_code)
                    );
                    
                    // Deduplicate resources by resource_name just in case there are duplicates
                    const uniqueResMap = new Map();
                    itemRes.forEach(r => {
                      if (!uniqueResMap.has(r.resource_name)) {
                        uniqueResMap.set(r.resource_name, r);
                      }
                    });
                    const deduplicatedList = Array.from(uniqueResMap.values()) as any[];

                    if (deduplicatedList.length === 0) {
                      return (
                        <div className="py-12 text-center bg-surface-2/30 rounded-xl border border-border-subtle border-dashed">
                          <AlertCircle className="w-10 h-10 text-ghost opacity-20 mx-auto mb-3" />
                          <div className="text-sm font-medium text-dim">No Recipe Built</div>
                          <p className="text-xs text-ghost mt-1">Total resource demand is currently undefined.</p>
                        </div>
                      );
                    }

                    // Group resources
                    const groups: Record<string, any[]> = {
                      material: [],
                      labour: [],
                      equipment: [],
                      vehicle: [],
                      subcontractor: [],
                      other: []
                    };

                    deduplicatedList.forEach(r => {
                      const type = (r.resource_type || 'material').toLowerCase().trim();
                      if (groups[type]) {
                        groups[type].push(r);
                      } else if (type === 'machinery') {
                        groups.equipment.push(r);
                      } else {
                        groups.other.push(r);
                      }
                    });

                    const getGroupNameLabel = (t: string) => {
                      switch (t) {
                        case 'material': return 'Materials';
                        case 'labour': return 'Labour';
                        case 'equipment': return 'Equipment & Machinery';
                        case 'vehicle': return 'Vehicles';
                        case 'subcontractor': return 'Subcontractor';
                        default: return 'Other Resources';
                      }
                    };

                    const getResourceIcon = (type: string) => {
                      switch ((type || '').toLowerCase().trim()) {
                        case 'material': return <Layers className="w-4 h-4 text-emerald-500" />;
                        case 'labour': return <Users className="w-4 h-4 text-cyan-500" />;
                        case 'equipment': 
                        case 'machinery': return <Wrench className="w-4 h-4 text-amber-500" />;
                        case 'vehicle': return <Truck className="w-4 h-4 text-orange-500" />;
                        case 'subcontractor': return <Briefcase className="w-4 h-4 text-blue-500" />;
                        default: return <Boxes className="w-4 h-4 text-gray-500" />;
                      }
                    };

                    return (['material', 'labour', 'equipment', 'vehicle', 'subcontractor', 'other'] as const).map(groupKey => {
                      const groupItems = groups[groupKey] || [];
                      if (groupItems.length === 0) return null;

                      return (
                        <div key={groupKey} className="flex flex-col gap-2.5">
                          <div className="flex items-center justify-between border-b border-border-subtle pb-1">
                            <span className="text-[10px] font-bold text-main uppercase tracking-wider">
                              {getGroupNameLabel(groupKey)}
                            </span>
                            <span className="text-[9px] font-mono text-ghost">
                              {groupItems.length} {groupItems.length === 1 ? 'component' : 'components'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 gap-2.5">
                            {groupItems.map((res, i) => {
                              const itemQty = selectedItemDetail.surveyed_qty || selectedItemDetail.contract_qty || 0;
                              const factorWithWaste = res.consumption_rate * (1 + (res.waste_factor_pct || 0) / 100);
                              const totalQty = Math.round(factorWithWaste * itemQty * 10000) / 10000;
                              
                              const typeKey = (res.resource_type || '').toLowerCase().trim();
                              const nk = (res.resource_name || '').toLowerCase().trim();
                              const ck = (res.resource_code || '').toLowerCase().trim();
                              
                              const rateByCode = libraryResources[`${typeKey}_rate_code_${ck}`];
                              const rateByName = libraryResources[`${typeKey}_rate_${nk}`];
                              const libraryRate = Number(rateByCode ?? rateByName ?? 0);
                              
                              const localStorageOverride = localStorage.getItem(`rate_override_${res.id}`);
                              const stagedRate = stagedRates[res.id];
                              const currentRate = stagedRate !== undefined 
                                ? stagedRate 
                                : (localStorageOverride !== null 
                                  ? parseFloat(localStorageOverride) 
                                  : ((res.is_manual && res.effective_rate != null) ? Number(res.effective_rate) : (Number(libraryRate) || 0)));
                              const totalAmount = totalQty * currentRate;
                              
                              const isEditing = editingResourceId === res.id;
                              const resCode = res.resource_code || libraryResources[`${typeKey}_code_${nk}`] || '---';

                              return (
                                <div 
                                  key={res.id || i} 
                                  className={cn(
                                    "bg-surface-2 border rounded-xl p-3.5 flex items-center justify-between gap-4 transition-all group",
                                    res.is_excluded ? "opacity-35 border-border-subtle" : "border-border-subtle hover:border-primary/25"
                                  )}
                                >
                                  {/* Left side: Icon, Title, and Quantities */}
                                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                    <div className="w-10 h-10 rounded-lg bg-surface-3 border border-border-subtle flex items-center justify-center text-ghost flex-shrink-0">
                                      {getResourceIcon(res.resource_type)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-bold text-main truncate leading-snug">
                                        {cleanRichText(res.resource_name)}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 mt-1">
                                        {resCode !== '---' && (
                                          <span className="bg-surface-3 text-dim font-mono text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                                            {resCode}
                                          </span>
                                        )}
                                        <span className="font-mono font-bold text-main text-xs">
                                          {(totalQty || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] text-ghost font-normal uppercase">{res.resource_unit || 'UNIT'}</span>
                                        </span>
                                        {res.waste_factor_pct > 0 && (
                                          <span className="bg-warning/10 text-warning border border-warning/20 px-1 py-0.5 rounded text-[9px] font-mono font-bold">
                                            +{res.waste_factor_pct}% WASTE
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right side: Rate manipulation and line totals */}
                                  <div className="flex items-center gap-5 flex-shrink-0">
                                    <div className="flex flex-col items-end gap-1 font-mono text-right min-w-[140px]">
                                      <span className="text-ghost text-[10px] uppercase tracking-wider font-bold">Est. Rate</span>
                                      {isEditing ? (
                                        <div className="flex items-center gap-1">
                                          <input 
                                            type="number"
                                            className="w-18 bg-surface-base border border-primary rounded px-2 py-0.5 text-xs text-main font-mono text-right outline-none"
                                            value={editingRate}
                                            autoFocus
                                            onChange={e => setEditingRate(parseFloat(e.target.value) || 0)}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') {
                                                handleRateUpdate(res.id, editingRate);
                                              }
                                              if (e.key === 'Escape') setEditingResourceId(null);
                                            }}
                                          />
                                          <button 
                                            onClick={() => handleRateUpdate(res.id, editingRate)}
                                            className="text-primary hover:text-primary/10 cursor-pointer p-0.5"
                                          >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1.5">
                                          <button 
                                            onClick={() => {
                                              setEditingResourceId(res.id);
                                              setEditingRate(currentRate);
                                            }}
                                            className={cn(
                                              "underline decoration-dotted underline-offset-2 cursor-pointer font-bold text-xs",
                                              stagedRates[res.id] !== undefined ? "text-primary decoration-primary font-black" : 
                                              localStorage.getItem(`rate_override_${res.id}`) !== null ? "text-warning decoration-warning font-bold" : "text-main hover:text-primary"
                                            )}
                                            title="Click to adjust rate directly"
                                          >
                                            {fmt(currentRate)}
                                          </button>
                                          <CostFactorCalculator 
                                            baseRate={Number(libraryRate)} 
                                            onApply={(newRate) => {
                                              handleRateUpdate(res.id, newRate);
                                            }}
                                          />
                                        </div>
                                      )}
                                      <span className="text-[9px] text-ghost leading-none">Factor: {Number(res.consumption_rate).toFixed(2)}</span>
                                    </div>
                                    
                                    <div className="text-right min-w-[75px]">
                                      <div className="text-xs font-mono font-black text-primary">
                                        {fmt(totalAmount)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Site Cost Factor Calculator */}
              <div className="bg-surface-2 rounded-xl border border-border-subtle/60 p-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
                  <Calculator className="w-24 h-24 text-primary" />
                </div>
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5" />
                      Extra Cost Adjustments
                    </h4>
                    <button 
                      onClick={() => setIsAddingFactor(true)}
                      className="text-[10px] font-bold text-ghost hover:text-primary flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> ADD COMPONENT
                    </button>
                  </div>

                  <div className="space-y-3">
                    {/* Items like Mobilization, Care, Insurance etc */}
                    <div className="p-3 bg-surface-1/80 border border-border-subtle rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-main">Cost Factor Calculator</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-ghost uppercase tracking-tight">Advanced Mode</span>
                          <button 
                            onClick={() => setNewFactor({...newFactor, isAdvanced: !newFactor.isAdvanced})}
                            className={cn(
                              "w-8 h-4 rounded-full transition-colors relative",
                              newFactor.isAdvanced ? "bg-primary" : "bg-border-subtle"
                            )}
                          >
                            <div className={cn(
                              "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                              newFactor.isAdvanced ? "left-4.5" : "left-0.5"
                            )} />
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-dim leading-relaxed">
                        {newFactor.isAdvanced 
                          ? "Using Formula: Rate + ((Mobilization + Care) / Pack Size)" 
                          : "Adds site-specific adjustments as unit rate or lump sum."}
                      </p>
                    </div>

                    {isAddingFactor && (
                      <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-1 gap-4 mb-4">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-mono text-ghost uppercase tracking-widest">Adjustment Name</label>
                            <input 
                              type="text"
                              placeholder="e.g. Site Handling & Mobilization"
                              className="bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-xs text-main outline-none focus:border-primary"
                              value={newFactor.name}
                              onChange={e => setNewFactor({...newFactor, name: e.target.value})}
                            />
                          </div>
                          
                          {newFactor.isAdvanced ? (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-mono text-ghost uppercase tracking-widest">Base Rate ($)</label>
                                <input 
                                  type="number"
                                  className="bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-xs text-main outline-none font-mono"
                                  value={newFactor.amount || ''}
                                  onChange={e => setNewFactor({...newFactor, amount: parseFloat(e.target.value) || 0})}
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-mono text-ghost uppercase tracking-widest">Mobilization ($)</label>
                                <input 
                                  type="number"
                                  className="bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-xs text-main outline-none font-mono"
                                  value={newFactor.mobilization || ''}
                                  onChange={e => setNewFactor({...newFactor, mobilization: parseFloat(e.target.value) || 0})}
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-mono text-ghost uppercase tracking-widest">Site Care & Logistics ($)</label>
                                <input 
                                  type="number"
                                  className="bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-xs text-main outline-none font-mono"
                                  value={newFactor.care || ''}
                                  onChange={e => setNewFactor({...newFactor, care: parseFloat(e.target.value) || 0})}
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-mono text-ghost uppercase tracking-widest">Pack Size / Multiplier</label>
                                <input 
                                  type="number"
                                  className="bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-xs text-main outline-none font-mono"
                                  value={newFactor.packSize || ''}
                                  onChange={e => setNewFactor({...newFactor, packSize: parseFloat(e.target.value) || 1})}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-mono text-ghost uppercase tracking-widest">Calculation Type</label>
                                <select 
                                  className="bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-xs text-main outline-none focus:border-primary"
                                  value={newFactor.calcType}
                                  onChange={e => setNewFactor({...newFactor, calcType: e.target.value as any})}
                                >
                                  <option value="unit">Rate per {formatUnit(selectedItemDetail.unit)}</option>
                                  <option value="total">Total Lump Sum for Task</option>
                                </select>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-mono text-ghost uppercase tracking-widest">Value ($)</label>
                                <input 
                                  type="number"
                                  placeholder="0.00"
                                  className="bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-xs text-main outline-none focus:border-primary font-mono"
                                  value={newFactor.amount || ''}
                                  onChange={e => setNewFactor({...newFactor, amount: parseFloat(e.target.value) || 0})}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end gap-3 pt-3 border-t border-primary/10">
                          <button onClick={() => setIsAddingFactor(false)} className="px-4 py-2 text-xs font-bold text-ghost hover:text-main">CANCEL</button>
                          <button onClick={handleAddFactor} className="px-4 py-2 bg-primary text-surface-base rounded-lg shadow-lg hover:bg-primary/90 text-xs font-bold uppercase tracking-widest">Apply To Budget</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Total Impact */}
              <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-4">Quantity Scaling Impact</h3>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-[10px] font-mono text-ghost uppercase">Surveyed Work Volume</div>
                    <div className="text-2xl font-bold font-mono tracking-tighter">
                      {(selectedItemDetail.surveyed_qty || selectedItemDetail.contract_qty || 0).toLocaleString()} 
                      <span className="text-xs text-dim ml-2 uppercase font-medium">{formatUnit(selectedItemDetail.unit)}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-border-subtle" />
                  <div className="text-right space-y-1">
                    <div className="text-[10px] font-mono text-ghost uppercase text-right">Total Internal Budget</div>
                    <div className="text-2xl font-bold font-mono tracking-tighter text-accent">
                      {fmt(selectedItemDetail.total_internal_cost)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Actions Footer */}
            {Object.keys(stagedRates).length > 0 && (
              <div className="p-6 border-t border-border-subtle bg-surface-2/95 backdrop-blur-md flex flex-col gap-3 animate-in slide-in-from-bottom duration-200 z-10">
                <div className="flex items-center justify-between text-xs text-ghost">
                  <span className="font-bold flex items-center gap-1.5 text-warning/90">
                    <AlertTriangle className="w-4 h-4" />
                    {Object.keys(stagedRates).length} staged rate adjustments
                  </span>
                  <span className="text-[10px] uppercase font-mono tracking-wider">Pending confirmation</span>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setStagedRates({})} 
                    className="flex-1 btn-ghost text-xs font-bold text-dim bg-surface-3/50 hover:bg-surface-3 py-2.5 rounded-xl transition-colors cursor-pointer"
                  >
                    Discard All
                  </button>
                  <button
                    onClick={confirmBudgetChanges}
                    className="flex-[2] bg-primary text-surface-base text-xs font-bold py-2.5 rounded-xl hover:bg-primary/95 transition-all shadow-lg shadow-primary/25 flex items-center justify-center cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Confirm
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Refresh Progress Modal */}
      {showRefreshModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-surface-base/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-8 text-center animate-in zoom-in-95 duration-200">
            {isSyncing ? (
              <>
                <div className="relative w-24 h-24 mx-auto mb-6">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-border-subtle" />
                    <circle
                      cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent"
                      strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={2 * Math.PI * 40 * (1 - (refreshProgress ? refreshProgress.current / (refreshProgress.total || 1) : 0))}
                      strokeLinecap="round"
                      className="text-primary transition-all duration-500 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold font-mono text-main">
                      {Math.round((refreshProgress ? refreshProgress.current / (refreshProgress.total || 1) : 0) * 100)}%
                    </span>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-main mb-2">Reconciling Budget</h3>
                <p className="text-sm text-ghost mb-6">
                  Checking {refreshProgress?.total} items against trade library...
                </p>
                
                <div className="flex items-center gap-2 justify-center py-2 px-4 bg-surface-2 rounded-lg border border-border-subtle">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  <span className="text-xs text-primary font-medium animate-pulse">Syncing...</span>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-surface-base mx-auto mb-6 shadow-[0_0_20px_rgba(0,200,150,0.3)]">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-main mb-2">Build Complete!</h3>
                <p className="text-sm text-ghost mb-8">
                  Budget has been reconciled with current trade assignments.
                </p>
                <button 
                  onClick={() => setShowRefreshModal(false)}
                  className="w-full py-3 bg-primary text-surface-base rounded-xl font-bold hover:bg-primary/90 transition-all uppercase tracking-widest text-xs"
                >
                  View Final Report
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Refresh Report Modal */}
      {refreshReport && !isSyncing && !showRefreshModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-surface-base/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-main">Reconciliation Summary</h2>
                    <p className="text-xs text-ghost">Analysis of {refreshReport.total} project items</p>
                  </div>
                </div>
                <button onClick={() => setRefreshReport(null)} className="text-dim hover:text-main">
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-surface-2 border border-border-subtle p-4 rounded-xl">
                  <div className="text-[10px] font-mono text-dim uppercase tracking-wider mb-1 text-center">Matched Trades</div>
                  <div className="text-2xl font-bold text-primary text-center">{refreshReport.successful.length}</div>
                </div>
                <div className="bg-surface-2 border border-border-subtle p-4 rounded-xl">
                  <div className="text-[10px] font-mono text-dim uppercase tracking-wider mb-1 text-center">No Assignment</div>
                  <div className="text-2xl font-bold text-warning text-center">{refreshReport.unassigned.length}</div>
                </div>
                <div className="bg-surface-2 border border-border-subtle p-4 rounded-xl">
                  <div className="text-[10px] font-mono text-dim uppercase tracking-wider mb-1 text-center">Resource Miss</div>
                  <div className="text-2xl font-bold text-danger text-center">{refreshReport.unpopulated.length}</div>
                </div>
                <div className="bg-surface-2 border border-border-subtle p-4 rounded-xl">
                  <div className="text-[10px] font-mono text-dim uppercase tracking-wider mb-1 text-center">Total Audited</div>
                  <div className="text-2xl font-bold text-accent text-center">{refreshReport.total}</div>
                </div>
              </div>

              <div className="mb-6">
                <div className="text-[10px] font-mono text-dim uppercase tracking-wider mb-2">Process Integrity</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(refreshReport.states).map(([state, count]) => (
                    <div key={state} className="px-3 py-1 bg-surface-base border border-border-subtle rounded-lg text-xs flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="text-ghost capitalize">{state.replace('_', ' ')}:</span>
                      <span className="text-main font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {refreshReport.unassigned.length > 0 && (
                <div className="mb-6">
                  <div className="text-[10px] font-mono text-warning uppercase tracking-wider mb-2">Unassigned Items (Not in Budget)</div>
                  <div className="max-h-24 overflow-y-auto bg-surface-base border border-warning/20 rounded-lg p-3 font-mono text-[10px] text-warning/50 flex flex-wrap gap-x-2 gap-y-1">
                    {refreshReport.unassigned.map((no, idx) => <span key={`${no}-${idx}`}>{no}</span>)}
                  </div>
                </div>
              )}

              {refreshReport.discrepancies.length > 0 && (
                <div className="mb-6 last:mb-0">
                  <div className="text-[10px] font-mono text-danger uppercase tracking-wider mb-2">Recipe Factor Mismatches (Action Required)</div>
                  <div className="max-h-32 overflow-y-auto bg-surface-base border border-danger/20 rounded-lg p-3 space-y-2">
                    {refreshReport.discrepancies.map((d, i) => (
                      <div key={i} className="flex flex-col gap-0.5 border-b border-border-subtle pb-2 last:border-0">
                        <div className="text-[10px] font-bold text-main flex justify-between">
                          <span>Item {d.item}</span>
                          <span className="text-danger font-mono">Factor Error</span>
                        </div>
                        <div className="text-[9px] text-ghost truncate">{d.resource}</div>
                        <div className="text-[9px] font-mono text-dim">
                          Current: <span className="text-main">{d.current}</span> → Expected: <span className="text-primary">{d.expected}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button 
                onClick={() => setRefreshReport(null)}
                className="w-full py-3 bg-surface-2 border border-border-subtle text-main rounded-xl font-bold hover:bg-border-subtle transition-all uppercase tracking-widest text-xs"
              >
                Accept and Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Analysis Side Panel moved inside main component */}
      <AnimatePresence>
        {actionResult && (
          <div className="fixed inset-0 z-[200] overflow-hidden pointer-events-none">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setActionResult(null)}
               className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
             />
             <motion.div 
               initial={{ x: '100%' }}
               animate={{ x: 0 }}
               exit={{ x: '100%' }}
               transition={{ type: 'spring', damping: 25, stiffness: 200 }}
               className="absolute top-0 right-0 h-full w-96 bg-surface-1 border-l border-border-subtle shadow-2xl p-8 flex flex-col pointer-events-auto"
             >
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-xl font-black text-main tracking-tight">{actionResult.title}</h3>
                   <button onClick={() => setActionResult(null)} className="p-2 hover:bg-surface-2 rounded-xl text-ghost">
                      <XIcon className="w-6 h-6" />
                   </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                   <div className="space-y-4">
                      {actionResult.rows.map((row, i) => (
                        <div key={i} className="p-4 bg-surface-2 border border-border-subtle rounded-2xl flex items-center justify-between">
                           <span className="text-xs font-bold text-ghost uppercase tracking-widest">{row.label}</span>
                           <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-main">{row.value}</span>
                              {row.status && (
                                <div className={cn(
                                  "w-2 h-2 rounded-full",
                                  row.status === 'ok' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                                  row.status === 'warn' ? "bg-warning shadow-[0_0_8px_rgba(245,166,35,0.5)]" :
                                  "bg-danger shadow-[0_0_8px_rgba(240,74,90,0.5)]"
                                )} />
                              )}
                           </div>
                        </div>
                      ))}
                   </div>

                   {actionResult.summary && (
                     <div className="mt-8 p-4 bg-surface-base rounded-2xl border border-border-subtle">
                        <div className="text-[10px] font-black uppercase tracking-widest text-ghost mb-2">Analysis Summary</div>
                        <p className="text-xs text-dim leading-relaxed italic">
                           "{actionResult.summary}"
                        </p>
                     </div>
                   )}
                </div>

                <div className="mt-auto space-y-3 pt-8">
                   {actionResult.action && (
                     <button 
                        onClick={() => {
                          actionResult.action?.onClick();
                          setActionResult(null);
                        }}
                        className="w-full h-14 btn btn-primary rounded-2xl text-xs font-black tracking-widest flex items-center justify-center gap-2"
                     >
                        {actionResult.action.label}
                        <ArrowRight className="w-4 h-4" />
                     </button>
                   )}
                   <button 
                      onClick={() => setActionResult(null)}
                      className="w-full h-14 btn btn-secondary rounded-2xl text-xs font-black tracking-widest"
                   >
                      Dismiss
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface CostFactorCalculatorProps {
  baseRate: number;
  onApply: (finalRate: number) => void;
}

function CostFactorCalculator({ baseRate, onApply }: CostFactorCalculatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [factors, setFactors] = useState({
    mobilizationPct: 0,
    carePct: 0,
    logisticsPct: 0,
    markupPct: 0,
    extraFlat: 0
  });

  const finalRate = baseRate * (1 + (factors.mobilizationPct + factors.carePct + factors.logisticsPct + factors.markupPct) / 100) + factors.extraFlat;

  return (
    <div className="relative">
      <button 
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1 px-1.5 bg-accent/10 rounded border border-accent/20 text-accent hover:bg-accent/20 transition-all focus:outline-none"
        title="Cost Factor Calculator"
      >
        <Calculator className="w-3 h-3" />
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 top-full mt-2 w-64 bg-surface-2 border border-border-subtle rounded-xl shadow-2xl p-4 z-[100] animate-in fade-in slide-in-from-top-2"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4 border-b border-border-subtle pb-2">
            <h4 className="text-[10px] font-bold text-primary uppercase tracking-wider">Rate Build-up</h4>
            <button onClick={() => setIsOpen(false)}><XIcon className="w-3 h-3 text-ghost" /></button>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-[9px] font-mono text-ghost uppercase">
                <span>Base Master Rate</span>
                <span>{fmt(baseRate)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[9px] font-mono text-dim uppercase">Mobilization (%)</label>
                <input 
                  type="number" 
                  className="w-full bg-surface-base border border-border-subtle rounded px-2 py-1 text-xs text-main outline-none"
                  value={factors.mobilizationPct}
                  onChange={e => setFactors({...factors, mobilizationPct: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-mono text-dim uppercase">Site Care (%)</label>
                <input 
                  type="number" 
                  className="w-full bg-surface-base border border-border-subtle rounded px-2 py-1 text-xs text-main outline-none"
                  value={factors.carePct}
                  onChange={e => setFactors({...factors, carePct: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-mono text-dim uppercase">Logistics (%)</label>
                <input 
                  type="number" 
                  className="w-full bg-surface-base border border-border-subtle rounded px-2 py-1 text-xs text-main outline-none"
                  value={factors.logisticsPct}
                  onChange={e => setFactors({...factors, logisticsPct: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-mono text-dim uppercase">Extras (Flat)</label>
                <input 
                  type="number" 
                  className="w-full bg-surface-base border border-border-subtle rounded px-2 py-1 text-xs text-main outline-none"
                  value={factors.extraFlat}
                  onChange={e => setFactors({...factors, extraFlat: parseFloat(e.target.value) || 0})}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-border-subtle flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-main">BUILT RATE</span>
                <span className="text-sm font-mono font-bold text-primary">{fmt(finalRate)}</span>
              </div>
              <button 
                onClick={() => {
                  onApply(finalRate);
                  setIsOpen(false);
                }}
                className="w-full py-1.5 bg-primary text-surface-base rounded text-[10px] font-bold uppercase transition-colors hover:bg-primary/90"
              >
                Apply Rate Build-up
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(val: number, prefix: string = '$ ') {
  return prefix + (val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
