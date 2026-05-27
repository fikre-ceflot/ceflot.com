import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { BOQItem, Project } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Search, 
  Filter, 
  Upload, 
  Download, 
  Plus, 
  MoreHorizontal,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Save,
  Edit2,
  X as XIcon,
  Loader2,
  Trash2,
  GripVertical,
  RefreshCw,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  CheckSquare,
  Square
} from 'lucide-react';
import { cn, isValidUUID, cleanRichText } from '../lib/utils';
import { RecipePanel } from './RecipePanel';
import { TradeAssignmentModal } from './TradeAssignmentModal';
import { BOQImportPreview } from './BOQImportPreview';
import { TradePickerModal } from './TradePickerModal';
import { usePermissions } from '../hooks/usePermissions';
import ExcelJS from 'exceljs';
import { motion, AnimatePresence } from 'motion/react';
import { exportMaterialList } from '../lib/exportUtils';

interface BOQManagerProps {
  project: Project;
  userRole: any;
  tenantId: any;
}

export function BOQManager({ project, userRole, tenantId }: BOQManagerProps) {
  const { hasCapability } = usePermissions(userRole, tenantId);
  const [items, setItems] = useState<BOQItem[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [libraryRates, setLibraryRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dependencies, setDependencies] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<BOQItem | null>(null);
  const [editingQty, setEditingQty] = useState<{ id: string, value: string } | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [expandedBills, setExpandedBills] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [colWidths, setColWidths] = useState({
    item_no: 100,
    description: 380,
    unit: 60,
    contract_qty: 90,
    contract_rate: 90,
    contract_amount: 110,
    surveyed_qty: 90,
    actual_qty: 90,
    trade: 220,
    no_days: 80,
    predecessors: 120,
    budget_rate: 100,
    budget_total: 110,
    variance: 100
  });

  const handleResize = (col: keyof typeof colWidths, width: number) => {
    setColWidths(prev => ({ ...prev, [col]: Math.max(50, width) }));
  };

  const resizerRef = useRef<{ col: string, startX: number, startWidth: number } | null>(null);

  const startResize = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    resizerRef.current = { 
      col, 
      startX: e.clientX, 
      startWidth: colWidths[col as keyof typeof colWidths] 
    };
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (resizerRef.current) {
        const delta = moveEvent.clientX - resizerRef.current.startX;
        handleResize(resizerRef.current.col as any, resizerRef.current.startWidth + delta);
      }
    };
    
    const onMouseUp = () => {
      resizerRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const toggleBill = (bill: string) => {
    const next = new Set(expandedBills);
    if (next.has(bill)) next.delete(bill);
    else next.add(bill);
    setExpandedBills(next);
  };

  const toggleItemCollapse = (itemNo: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedItems);
    if (next.has(itemNo)) next.delete(itemNo);
    else next.add(itemNo);
    setExpandedItems(next);
  };

  const isItemVisible = (item: BOQItem) => {
    if (!item.item_no) return true;
    const parts = item.item_no.split('.');
    if (parts.length === 1) return true; // Level 0 items always visible if bill is expanded

    // Check all parent levels for expansion
    for (let i = 1; i < parts.length; i++) {
      const parentPath = parts.slice(0, i).join('.');
      if (!expandedItems.has(parentPath)) return false;
    }
    return true;
  };

  const [manualAssignItem, setManualAssignItem] = useState<BOQItem | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [manualFormData, setManualFormData] = useState({
    bill_no: '',
    item_no: '',
    description: '',
    unit: '',
    contract_qty: 0,
    contract_rate: 0
  });
  const [importPreviewData, setImportPreviewData] = useState<any[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('toggle-focus-mode', { detail: isFullscreen }));
  }, [isFullscreen]);
  const [rowAssigningId, setRowAssigningId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemsPendingDeletion, setItemsPendingDeletion] = useState<string[]>([]);
  
  // Column Visibility Management
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set([
    'item_no', 'description', 'unit', 'contract_qty', 'contract_rate', 'contract_amount',
    'surveyed_qty', 'actual_qty', 'daily_output', 'trade', 'no_days', 'predecessors', 'budget_rate',
    'budget_total', 'variance', 'status', 'actions'
  ]));
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  const COLUMN_LABELS: Record<string, string> = {
    item_no: 'Item No',
    description: 'Description',
    unit: 'Unit',
    contract_qty: 'Contract Qty',
    contract_rate: 'Contract Rate',
    contract_amount: 'Contract Total',
    surveyed_qty: 'Surveyed Qty',
    actual_qty: 'Actual Qty',
    daily_output: 'Output/Day',
    trade: 'Trade/Recipe',
    no_days: 'No Days',
    predecessors: 'Pred.',
    budget_rate: 'Budget Rate',
    budget_total: 'Budget Total',
    variance: 'Variance',
    status: 'Status',
    actions: 'Actions'
  };
  
  // Mass Edit States
  const [isMassEdit, setIsMassEdit] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<BOQItem>>>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveAll = async () => {
    if (Object.keys(drafts).length === 0) {
      setIsMassEdit(false);
      setEditingItemId(null);
      return;
    }

    setIsSaving(true);
    try {
      const updates = Object.entries(drafts).map(([id, update]) => {
        // Remove contract_amount as it is a generated column in the DB
        const { contract_amount, ...cleanUpdate } = update as any;
        
        return {
          id,
          ...cleanUpdate,
          tenant_id: tenantId
        };
      });

      // Update one by one to handle potential individual errors
      for (const update of updates) {
        const { id, ...data } = update;
        const { error } = await supabase
          .from('boq_items')
          .update(data)
          .eq('id', id)
          .eq('tenant_id', tenantId);
        
        if (error) throw error;
      }

      setDrafts({});
      setIsMassEdit(false);
      setEditingItemId(null);
      await loadBOQ();
      setNotification({ type: 'success', message: 'All changes saved successfully.' });
    } catch (e: any) {
      console.error('Save all error:', e);
      setNotification({ type: 'error', message: 'Failed to save changes: ' + e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const updateDraft = (itemId: string, updates: Partial<BOQItem>) => {
    setDrafts(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        ...updates
      }
    }));
  };

  const [aiItems, setAiItems] = useState<BOQItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [refreshStage, setRefreshStage] = useState<'idle' | 'syncing' | 'completed'>('idle');
  const [refreshProgress, setRefreshProgress] = useState<{ current: number, total: number } | null>(null);
  const [refreshReport, setRefreshReport] = useState<{
    total: number;
    unassigned: string[];
    unpopulated: string[];
    successful: string[];
    states: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    loadBOQ();
  }, [project.id]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const bulkDelete = () => {
    if (selectedIds.size === 0) return;
    setItemsPendingDeletion(Array.from(selectedIds));
    setShowDeleteConfirm(true);
  };

  const deleteItem = (id: string) => {
    setItemsPendingDeletion([id]);
    setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    // Robust selection filtering to prevent UUID syntax errors
    const validIds = itemsPendingDeletion.filter(isValidUUID);

    if (validIds.length === 0) {
      setNotification({ 
        type: 'error', 
        message: 'No valid items selected for deletion.' 
      });
      setShowDeleteConfirm(false);
      setItemsPendingDeletion([]);
      return;
    }

    if (!isValidUUID(tenantId)) {
      setNotification({ 
        type: 'error', 
        message: 'Failed to delete: Missing security context (Tenant ID). Please refresh the page.' 
      });
      return;
    }
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('boq_items')
        .delete()
        .in('id', validIds)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      
      const idsSet = new Set(validIds);
      setItems(items.filter(i => !idsSet.has(i.id)));
      
      setSelectedIds(prev => {
        const next = new Set(prev);
        validIds.forEach(id => next.delete(id));
        return next;
      });

      setNotification({ 
        type: 'success', 
        message: `Successfully removed ${validIds.length} item${validIds.length > 1 ? 's' : ''}.` 
      });
      setShowDeleteConfirm(false);
    } catch (err: any) {
      console.error('Delete error:', err);
      setNotification({ type: 'error', message: 'Failed to delete: ' + err.message });
    } finally {
      setIsDeleting(false);
      setItemsPendingDeletion([]);
    }
  };

  const handleRowAIAssign = async (item: BOQItem) => {
    setRowAssigningId(item.id);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const tradeList = trades.map(t => `${t.trade_code}: ${t.trade_item} (${t.description})`).join('\n');
      
      const prompt = `
        Match this BOQ item to the most appropriate trade code.
        Item: ${item.item_no} ${item.description} (${item.unit})
        
        TRADE LIBRARY:
        ${tradeList}
        
        Return JSON: {"trade_code": "CODE", "confidence": 0.9}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      
      const result = JSON.parse(response.text || '{}');
      if (result.trade_code) {
        await updateTradeCode(item.id, result.trade_code);
      } else {
        setNotification({ type: 'error', message: 'AI could not find a confident match' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: 'AI Error: ' + err.message });
    } finally {
      setRowAssigningId(null);
    }
  };

  const unassignTrade = async (id: string) => {
    try {
      const { error } = await supabase
        .from('boq_items')
        .update({ 
          trade_code: null,
          recipe_confirmed: false,
          status: 'recipe_pending'
        })
        .eq('id', id);
      
      if (error) throw error;

      // Also clear the resources in database
      await supabase.rpc('populate_recipe_from_trade', {
        p_boq_item_id: id,
        p_trade_code: ''
      });

      setItems(items.map(item => item.id === id ? { ...item, trade_code: null, recipe_confirmed: false, status: 'recipe_pending' } : item));
      setNotification({ type: 'success', message: 'Trade unassigned and resources cleared' });
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Error unassigning trade: ' + err.message });
    }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.getWorksheet(1);
      
      if (!worksheet) {
        alert('No worksheet found in the selected file.');
        return;
      }

      const getCellValue = (val: any): any => {
        if (val === null || val === undefined) return '';
        
        // Handle Rich Text
        if (typeof val === 'object' && val.richText) {
          return val.richText.map((rt: any) => rt.text).join('');
        }
        
        // Handle Formula results
        if (typeof val === 'object' && 'result' in val) {
          return getCellValue(val.result);
        }
        
        // Handle Hyperlinks
        if (typeof val === 'object' && 'text' in val) {
          return val.text;
        }

        return val;
      };

      const rows: any[][] = [];
      worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const values = Array.isArray(row.values) 
          ? row.values.slice(1).map(v => getCellValue(v)) 
          : []; 
        rows.push(values);
      });
      
      if (rows.length === 0) {
        alert('No data found in the selected sheet.');
        return;
      }

      // The first row contains the labels
      const headers = rows[0].map((h, i) => h?.toString() || `Column ${i + 1}`);
      
      // Map the rest of the rows to objects using these headers
      const data = rows.slice(1).map(row => {
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = row[index];
        });
        return obj;
      });
      
      if (data.length === 0) {
        alert('No data rows found after the header row.');
        return;
      }

      setImportPreviewData(data);
    } catch (err: any) {
      console.error('Error reading Excel:', err);
      alert('Error reading Excel: ' + err.message);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const startRefreshProcess = async () => {
    if (items.length === 0) {
      setNotification({ type: 'error', message: 'No items found to refresh.' });
      return;
    }

    setIsRefreshing(true);
    setRefreshStage('syncing');
    
    // Process ALL items to ensure cleanup for those without trades
    const itemsToSync = items;
    setRefreshProgress({ current: 0, total: itemsToSync.length });
    
    try {
      const BATCH_SIZE = 5; 
      let processed = 0;
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      
      for (let i = 0; i < itemsToSync.length; i += BATCH_SIZE) {
        const batch = itemsToSync.slice(i, i + BATCH_SIZE);
        
        // We use individual calls so one bad trade code doesn't wipe out the whole batch
        await Promise.all(batch.map(item => 
          supabase.rpc('populate_recipe_from_trade', {
            p_boq_item_id: item.id,
            p_trade_code: item.trade_code || ''
          })
        ));

        processed += batch.length;
        setRefreshProgress({ current: Math.min(processed, itemsToSync.length), total: itemsToSync.length });
        
        // Brief pause between batches
        if (i + BATCH_SIZE < itemsToSync.length) {
          await delay(200);
        }
      }

      // Re-load data to get final state
      const { data: updatedItems, error: loadError } = await supabase
        .from('boq_items')
        .select('*')
        .eq('project_id', project.id)
        .order('item_sequence');
      
      if (loadError) throw loadError;
      
      const normalizedItems = (updatedItems || []).map(item => ({
        ...item,
        contract_qty: item.contract_qty ?? item.quantity ?? 0,
        contract_rate: item.contract_rate ?? item.rate ?? 0,
        contract_amount: item.contract_amount ?? ((item.contract_qty ?? item.quantity ?? 0) * (item.contract_rate ?? item.rate ?? 0))
      }));
      setItems(normalizedItems);

      // Generate Report
      const report = {
        total: normalizedItems.length,
        unassigned: normalizedItems.filter(i => !i.trade_code).map(i => i.item_no),
        unpopulated: normalizedItems.filter(i => i.trade_code && !i.recipe_confirmed).map(i => i.item_no),
        successful: normalizedItems.filter(i => i.trade_code && i.recipe_confirmed).map(i => i.item_no),
        states: normalizedItems.reduce((acc, i) => {
          const s = i.status || 'draft';
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };
      
      setRefreshReport(report);
      setRefreshStage('completed');
    } catch (e: any) {
      console.error('Refresh error:', e);
      setNotification({ type: 'error', message: 'Refresh failed: ' + (e.message || 'Unknown error') });
      setShowRefreshModal(false);
    } finally {
      setIsRefreshing(false);
    }
  };

  const refreshAllResources = () => {
    setRefreshStage('syncing');
    setShowRefreshModal(true);
    setRefreshReport(null);
    startRefreshProcess();
  };

  const handleSaveManualItem = async () => {
    if (!manualFormData.bill_no || !manualFormData.item_no || !manualFormData.description) {
      alert('Please fill in Bill No, Item No and Description');
      return;
    }

    try {
      setIsAdding(true);
      // Get the current max sequence to correctly append new items
      const maxSeq = items.reduce((max, i) => Math.max(max, i.item_sequence ?? 0), -1);
      
      const newItem = {
        project_id: project.id,
        tenant_id: tenantId,
        bill_no: manualFormData.bill_no,
        item_no: manualFormData.item_no,
        description: manualFormData.description,
        unit: manualFormData.unit,
        contract_qty: manualFormData.contract_qty,
        contract_rate: manualFormData.contract_rate,
        surveyed_qty: manualFormData.contract_qty,
        status: 'draft',
        is_active: true,
        item_sequence: maxSeq + 1
      };

      const { data, error } = await supabase
        .from('boq_items')
        .insert([newItem])
        .select()
        .single();

      if (error) throw error;

      setItems([data, ...items]);
      setIsAddingManual(false);
      setManualFormData({
        bill_no: '',
        item_no: '',
        description: '',
        unit: '',
        contract_qty: 0,
        contract_rate: 0
      });
      setNotification({ type: 'success', message: 'Custom item added successfully!' });
    } catch (e: any) {
      alert('Error adding item: ' + e.message);
    } finally {
      setIsAdding(false);
    }
  };

  const confirmImport = async (formattedBoq: any[]) => {
    try {
      // Get the current max sequence to correctly append new items
      const maxSeq = items.reduce((max, i) => Math.max(max, i.item_sequence ?? 0), -1);
      
      const { data: insertedData, error } = await supabase
        .from('boq_items')
        .insert(formattedBoq.map((item, index) => {
          // Destructure to remove contract_amount as it is a generated column in the DB
          const { contract_amount, ...rest } = item;
          return {
            ...rest,
            project_id: project.id,
            tenant_id: tenantId,
            item_sequence: maxSeq + 1 + index
          };
        }))
        .select();

      if (error) throw error;
      
      // Filter items that were imported with a trade_code assigned
      const itemsWithTrades = (insertedData || [])
        .filter(item => item.trade_code && item.trade_code.trim() !== '')
        .map(item => item.id);

      // Automatically populate resources if trade codes are present
      if (itemsWithTrades.length > 0) {
        setNotification({ type: 'success', message: `Imported ${formattedBoq.length} items. Syncing resources for ${itemsWithTrades.length} tagged items...` });
        const { error: syncError } = await supabase.rpc('bulk_populate_recipes', {
          p_boq_item_ids: itemsWithTrades
        });
        if (syncError) console.error('Auto-sync error during import:', syncError);
      } else {
        setNotification({ type: 'success', message: `Successfully imported ${formattedBoq.length} items.` });
      }

      setImportPreviewData(null);
      await loadBOQ();
    } catch (err: any) {
      console.error('Error importing BOQ:', err);
      setNotification({ type: 'error', message: 'Error importing BOQ: ' + err.message });
    }
  };

  const updateSurveyedQty = async (id: string, value: number) => {
    try {
      const { error } = await supabase
        .from('boq_items')
        .update({ surveyed_qty: value })
        .eq('id', id);
      
      if (error) throw error;
      setItems(items.map(item => item.id === id ? { ...item, surveyed_qty: value } : item));
      setEditingQty(null);
    } catch (err: any) {
      alert('Error updating quantity: ' + err.message);
    }
  };

  const updateTradeCode = async (id: string, code: string) => {
    try {
      const { error } = await supabase
        .from('boq_items')
        .update({ 
          trade_code: code,
          recipe_confirmed: true,
          status: 'in_progress'
        })
        .eq('id', id);
      
      if (error) throw error;
      
      // Sync resources using the atomic RPC
      const { error: rpcError } = await supabase.rpc('populate_recipe_from_trade', {
        p_boq_item_id: id,
        p_trade_code: code
      });

      if (rpcError) throw rpcError;

      setItems(items.map(item => item.id === id ? { ...item, trade_code: code, recipe_confirmed: true, status: 'in_progress' } : item));
      setNotification({ type: 'success', message: 'Trade assigned and resources synchronized' });
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Error assigning trade: ' + err.message });
    }
  };

  const handleAIAssign = async () => {
    const unassigned = items.filter(item => !item.trade_code);
    if (unassigned.length === 0) {
      alert('All items already have trade codes.');
      return;
    }
    setShowAIModal(true);
  };

  const loadBOQ = async () => {
    setLoading(true);
    try {
      let tradeQuery = supabase.from('trade_items')
        .select('id, trade_code, trade_item, library_tier')
        .eq('is_active', true);
      
      if (tenantId && tenantId !== 'null') {
        tradeQuery = tradeQuery.or(`library_tier.eq.global,tenant_id.eq.${tenantId}`);
      }

      const { data: bData, error: bErr } = await supabase
        .from('boq_items')
        .select('*')
        .eq('project_id', project.id)
        .order('item_sequence', { ascending: true });

      if (bErr) throw bErr;
      const bIds = (bData || []).map(i => i.id);

      const [tradesRes, resDataRes, matRes, labRes, eqRes, vehRes, fuelRes, subRes, depsRes] = await Promise.all([
        tradeQuery,
        supabase
          .from('boq_item_resources')
          .select('*')
          .in('boq_item_id', bIds),
        supabase.from('materials').select('material_name, material_code, base_rate'),
        supabase.from('labour_grades').select('grade_code, base_rate'),
        supabase.from('equipment_items').select('equipment_code, base_rate'),
        supabase.from('vehicles').select('vehicle_code, base_rate'),
        supabase.from('fuel_types').select('fuel_code, base_rate'),
        supabase.from('subcontractor_categories').select('category_code, base_rate'),
        supabase.from('task_dependencies').select('*').eq('project_id', project.id)
      ]);

      if (tradesRes.error) throw tradesRes.error;
      if (resDataRes.error) throw resDataRes.error;
      if (depsRes.error) throw depsRes.error;

      setResources(resDataRes.data || []);
      setDependencies(depsRes.data || []);

      const libRates: Record<string, number> = {};
      const processLib = (data: any[] | null, codeKey: string, rateKey = 'base_rate') => {
        data?.forEach(item => {
          if (item[codeKey]) {
            libRates[item[codeKey].toLowerCase().trim()] = Number(item[rateKey]) || 0;
          }
        });
      };

      processLib(matRes.data, 'material_code');
      processLib(labRes.data, 'grade_code');
      processLib(eqRes.data, 'equipment_code');
      processLib(vehRes.data, 'vehicle_code');
      processLib(fuelRes.data, 'fuel_code');
      processLib(subRes.data, 'category_code');
      
      setLibraryRates(libRates);

      const normalizedItems = (bData || []).map(item => ({
        ...item,
        contract_qty: item.contract_qty ?? item.quantity ?? 0,
        contract_rate: item.contract_rate ?? item.rate ?? 0,
        contract_amount: item.contract_amount ?? ( (item.contract_qty ?? item.quantity ?? 0) * (item.contract_rate ?? item.rate ?? 0) )
      }));
      setItems(normalizedItems);
      
      // Deduplicate trades by trade_code (prefer company tier)
      const uniqueTradesMap = new Map();
      (tradesRes.data || []).forEach(t => {
        const existing = uniqueTradesMap.get(t.trade_code);
        if (!existing || (existing.library_tier === 'global' && t.library_tier === 'company')) {
          uniqueTradesMap.set(t.trade_code, t);
        }
      });
      setTrades(Array.from(uniqueTradesMap.values()));
    } catch (e: any) {
      console.error('Error loading BOQ:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const sortItemNo = (a: string | null, b: string | null) => {
    if (a === b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    
    const aParts = a.split('.');
    const bParts = b.split('.');
    const maxLen = Math.max(aParts.length, bParts.length);
    
    for (let i = 0; i < maxLen; i++) {
      const aPart = aParts[i];
      const bPart = bParts[i];
      
      if (aPart === undefined) return -1;
      if (bPart === undefined) return 1;
      
      const aVal = parseInt(aPart);
      const bVal = parseInt(bPart);
      
      if (!isNaN(aVal) && !isNaN(bVal)) {
        if (aVal !== bVal) return aVal - bVal;
      } else {
        const comp = aPart.localeCompare(bPart, undefined, { numeric: true });
        if (comp !== 0) return comp;
      }
    }
    return 0;
  };

  const getItemLevel = (itemNo: string | null) => {
    if (!itemNo) return 0;
    const dots = (itemNo.match(/\./g) || []).length;
    return dots;
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = 
        cleanRichText(item.description).toLowerCase().includes(search.toLowerCase()) ||
        item.item_no?.toLowerCase().includes(search.toLowerCase()) ||
        item.trade_code?.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [items, search, statusFilter]);

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

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      const amt = item.contract_amount || 0;
      // If contract is 0 but surveyed is > 0, include in total using contract_rate
      if (item.contract_qty === 0 && (item.surveyed_qty || 0) > 0) {
        return sum + ((item.surveyed_qty || 0) * (item.contract_rate || 0));
      }
      return sum + amt;
    }, 0);
  }, [items]);

  // Group items by bill_no while maintaining deep hierarchy
  const groupedItems = useMemo(() => {
    const groups: Record<string, (BOQItem & { hasChildren: boolean })[]> = {};
    const order: string[] = [];

    // Sort items by item_no naturally (1.1, 1.1.1, 1.2, etc)
    const sortedFiltered = [...filteredItems].sort((a, b) => sortItemNo(a.item_no, b.item_no));

    // Pre-calculate children to avoid O(n^2) during render
    const itemWithChildren = sortedFiltered.map((item, idx) => {
      const hasChildren = sortedFiltered.some((child, cIdx) => 
        cIdx > idx && 
        child.item_no && 
        item.item_no && 
        child.item_no.startsWith(item.item_no + ".")
      );
      return { ...item, hasChildren };
    });

    itemWithChildren.forEach(item => {
      const bill = item.bill_no || 'Bill 1';
      if (!groups[bill]) {
        groups[bill] = [];
        order.push(bill);
      }
      groups[bill].push(item);
    });

    return { groups, order };
  }, [filteredItems]);

  const { groups: groupedItemsMap, order: bills } = groupedItems;

  const handleExportBOQ = async () => {
    try {
      if (items.length === 0) {
        setNotification({ type: 'error', message: 'No items to export.' });
        return;
      }
      
      const exportItems = items.map(i => ({
        code: i.item_no,
        name: i.description,
        unit: i.unit,
        base_rate: i.contract_rate || 0,
        category: i.bill_no || 'Project Item'
      }));

      await exportMaterialList(project.name, exportItems);
      setNotification({ type: 'success', message: 'BOQ exported successfully in SUNSHINE format.' });
    } catch (err: any) {
      console.error('Export error:', err);
      setNotification({ type: 'error', message: 'Failed to export: ' + err.message });
    }
  };

  return (
    <div className={cn(
      "flex flex-col transition-all duration-300",
      isFullscreen ? "fixed top-0 bottom-0 right-0 left-0 lg:left-16 z-[100] bg-surface-base p-4 overflow-hidden" : "gap-3"
    )}>
      {!isFullscreen && (
        <header className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
          <div className="flex flex-col gap-0.5 md:mt-auto">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-black text-ghost uppercase tracking-[0.3em]">Quantity Survey (BOQ)</span>
            </div>
            <h1 className="text-[19px] font-black tracking-tight text-main -ml-0.5">{project.name}</h1>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex items-center gap-2 text-[10px] font-bold text-ghost">
                <span className="text-primary font-black uppercase tracking-widest decoration-primary/30 underline-offset-4">BOQ Dashboard</span>
                <span className="w-1 h-1 rounded-full bg-border-subtle" />
                <span className="px-1.5 py-0.25 rounded bg-surface-2 border border-border-subtle opacity-80">{items.length} Items</span>
              </div>
              <div className="h-1 w-1 rounded-full bg-border-subtle" />
              <span className="text-[10px] font-bold text-dim uppercase tracking-wider">{project.status || 'Active'}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-4">
            <div className="flex flex-col items-end min-w-[120px]">
              <span className="text-[8px] font-bold text-ghost uppercase tracking-[0.2em] mb-1 opacity-60">Reference ID</span>
              <div className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center w-full">
                <span className="text-xs font-black text-primary tracking-widest">{project.project_code}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleExcelImport} 
                className="hidden" 
                accept=".xlsx, .xls" 
              />
              <button 
                className="btn btn-secondary btn-sm h-8 px-3"
                onClick={handleExportBOQ}
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <button 
                className="btn btn-secondary btn-sm h-8 px-3"
                onClick={refreshAllResources}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Refresh</span>
              </button>
              
              {hasCapability('boq:add_item') && (
                <button 
                  className="btn btn-primary btn-sm h-8 px-3"
                  onClick={() => setIsAddingManual(true)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Item</span>
                </button>
              )}

              {hasCapability('manage_boq') && (
                <button 
                  className="btn btn-accent btn-sm h-8 px-3"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import</span>
                </button>
              )}
            </div>
          </div>
        </header>
      )}

        <div className={cn(
          "bg-surface-1 border border-border-subtle rounded-xl flex flex-col transition-all",
          isFullscreen ? "flex-1 min-h-0" : "overflow-hidden shadow-sm"
        )}>
          {isAddingManual && !isFullscreen && (
          <div className="p-4 border-b border-border-subtle bg-surface-base animate-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-main uppercase tracking-widest">Add Custom BOQ Item</h3>
              <button onClick={() => setIsAddingManual(false)} className="text-ghost hover:text-main">
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-ghost uppercase tracking-widest">Bill No</label>
                <input 
                  className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-1.5 text-xs outline-none text-main focus:border-primary"
                  value={manualFormData.bill_no}
                  onChange={e => setManualFormData({...manualFormData, bill_no: e.target.value})}
                  placeholder="Bill No. 01"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-ghost uppercase tracking-widest">Item No</label>
                <input 
                  className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-1.5 text-xs outline-none text-main focus:border-primary"
                  value={manualFormData.item_no}
                  onChange={e => setManualFormData({...manualFormData, item_no: e.target.value})}
                  placeholder="1.1.1"
                />
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <label className="text-[9px] font-black text-ghost uppercase tracking-widest">Description</label>
                <input 
                  className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-1.5 text-xs outline-none text-main focus:border-primary"
                  value={manualFormData.description}
                  onChange={e => setManualFormData({...manualFormData, description: e.target.value})}
                  placeholder="Item description..."
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-ghost uppercase tracking-widest">Unit</label>
                <input 
                  className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-1.5 text-xs outline-none text-main focus:border-primary"
                  value={manualFormData.unit}
                  onChange={e => setManualFormData({...manualFormData, unit: e.target.value})}
                  placeholder="m3"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-ghost uppercase tracking-widest">Qty</label>
                <input 
                  type="number"
                  className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-1.5 text-xs outline-none text-main focus:border-primary"
                  value={manualFormData.contract_qty}
                  onChange={e => setManualFormData({...manualFormData, contract_qty: parseFloat(e.target.value) || 0})}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button 
                onClick={() => setIsAddingManual(false)} 
                className="px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-dim hover:bg-surface-2 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveManualItem}
                className="btn btn-accent btn-sm h-8 px-5"
              >
                Add Item
              </button>
            </div>
          </div>
        )}
        {/* Table Toolbar */}
        <div className="px-4 py-2 border-b border-border-subtle bg-surface-2 flex flex-col md:flex-row md:items-center justify-between gap-3 min-h-14">
          <div className="flex items-center gap-2 shrink-0">
            <SlidersHorizontal className="w-4 h-4 text-primary" />
            <span className="text-sm font-black uppercase tracking-widest text-main truncate max-w-[280px]">
              {isFullscreen ? project.name : "BOQ List"}
            </span>
            <span className="ml-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-surface-base border border-border-subtle text-ghost">
              {filteredItems.length} {filteredItems.length === 1 ? 'ITEM' : 'ITEMS'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Inline Search Bar */}
            <div className="relative w-48 font-sans">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ghost" />
              <input 
                type="text"
                placeholder="Search BOQ items..."
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
                    setEditingItemId(null);
                    setDrafts({});
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
                  onClick={handleSaveAll}
                  disabled={isSaving || Object.keys(drafts).length === 0}
                  className="btn btn-primary btn-sm h-8 px-3 text-[11px] font-bold uppercase tracking-wider animate-in fade-in"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                  Save All ({Object.keys(drafts).length})
                </button>
              )}
            </div>

            {/* AI Sync Button */}
            <button 
              onClick={handleAIAssign}
              className="btn btn-accent btn-sm h-8 px-3 rounded-md flex items-center gap-1.5 text-[11px] uppercase font-bold tracking-wider"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Sync</span>
            </button>

            <div className="h-6 w-px bg-border-subtle" />

            {/* Expand / Shrink Button */}
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
        </div>

        <div className={cn(
          "overflow-x-auto overflow-y-auto transition-all",
          isFullscreen ? "flex-1" : "max-h-[calc(100vh-280px)]"
        )}>
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-surface-base border-b border-border-subtle sticky top-0 z-10">
                <th className="px-4 py-2.5 w-10 bg-surface-base border-b border-border-subtle">
                  <button 
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-ghost hover:text-primary transition-colors cursor-pointer block p-1"
                    title={selectedIds.size === filteredItems.length && filteredItems.length > 0 ? "Deselect All" : "Select All"}
                  >
                    {selectedIds.size === filteredItems.length && filteredItems.length > 0 ? (
                      <CheckSquare className="w-3.5 h-3.5 text-primary animate-in zoom-in-95 duration-100" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                  </button>
                </th>
                {visibleColumns.has('item_no') && (
                  <th 
                    className="relative group font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 bg-surface-base border-b border-border-subtle"
                    style={{ width: colWidths.item_no }}
                  >
                    Item No
                    <div 
                      onMouseDown={(e) => startResize('item_no', e)}
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer" 
                    >
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                    </div>
                  </th>
                )}
                {visibleColumns.has('description') && (
                  <th 
                    className="relative group font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 bg-surface-base border-b border-border-subtle"
                    style={{ width: colWidths.description }}
                  >
                    Description
                    <div 
                      onMouseDown={(e) => startResize('description', e)}
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer" 
                    >
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                    </div>
                  </th>
                )}
                {visibleColumns.has('unit') && (
                  <th 
                    className="relative group font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 text-center bg-surface-base border-b border-border-subtle"
                    style={{ width: colWidths.unit }}
                  >
                    Unit
                    <div 
                      onMouseDown={(e) => startResize('unit', e)}
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer" 
                    >
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                    </div>
                  </th>
                )}
                {visibleColumns.has('contract_qty') && (
                  <th 
                    className="relative group font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 text-right bg-surface-base border-b border-border-subtle"
                    style={{ width: colWidths.contract_qty }}
                  >
                    Contract Qty
                    <div 
                      onMouseDown={(e) => startResize('contract_qty', e)}
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer" 
                    >
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                    </div>
                  </th>
                )}
                {visibleColumns.has('contract_rate') && (
                  <th 
                    className="relative group font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 text-right select-none bg-surface-base border-b border-border-subtle"
                    style={{ width: colWidths.contract_rate }}
                  >
                    Rate
                    <div 
                      onMouseDown={(e) => startResize('contract_rate', e)}
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer" 
                    >
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                    </div>
                  </th>
                )}
                {visibleColumns.has('contract_amount') && (
                  <th 
                    className="relative group font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 text-right select-none bg-surface-base border-b border-border-subtle"
                    style={{ width: colWidths.contract_amount }}
                  >
                    Amount
                    <div 
                      onMouseDown={(e) => startResize('contract_amount', e)}
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer" 
                    >
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                    </div>
                  </th>
                )}
                {visibleColumns.has('surveyed_qty') && (
                   <th 
                    className="relative group font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 text-right select-none bg-surface-base border-b border-border-subtle"
                    style={{ width: colWidths.surveyed_qty }}
                  >
                    Surveyed Qty
                    <div 
                      onMouseDown={(e) => startResize('surveyed_qty', e)}
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer" 
                    >
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                    </div>
                  </th>
                )}
                {visibleColumns.has('actual_qty') && (
                  <th 
                    className="relative group font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 text-right select-none bg-surface-base border-b border-border-subtle"
                    style={{ width: colWidths.actual_qty }}
                  >
                    Actual Qty
                    <div 
                      onMouseDown={(e) => startResize('actual_qty', e)}
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer" 
                    >
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                    </div>
                  </th>
                )}
                {visibleColumns.has('daily_output') && (
                  <th className="font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2 text-right select-none bg-surface-base">
                    Output/Day
                  </th>
                )}
                 {visibleColumns.has('no_days') && (
                  <th 
                    className="relative group font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 text-center select-none bg-surface-base border-b border-border-subtle"
                    style={{ width: colWidths.no_days }}
                  >
                    No. Days
                    <div 
                      onMouseDown={(e) => startResize('no_days', e)}
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer" 
                    >
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                    </div>
                  </th>
                )}
                {visibleColumns.has('predecessors') && (
                  <th 
                    className="relative group font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 select-none bg-surface-base border-b border-border-subtle"
                    style={{ width: colWidths.predecessors }}
                  >
                    Predecessors
                    <div 
                      onMouseDown={(e) => startResize('predecessors', e)}
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer" 
                    >
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                    </div>
                  </th>
                )}
                {visibleColumns.has('trade') && (
                  <th 
                    className="relative group font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 select-none bg-surface-base border-b border-border-subtle"
                    style={{ width: colWidths.trade }}
                  >
                    Trade & Recipe
                    <div 
                      onMouseDown={(e) => startResize('trade', e)}
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer" 
                    >
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                    </div>
                  </th>
                )}

                {visibleColumns.has('budget_rate') && (
                  <th 
                    className="relative group font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 text-right bg-surface-base border-b border-border-subtle"
                    style={{ width: colWidths.budget_rate }}
                  >
                    Budget Rate
                    <div 
                      onMouseDown={(e) => startResize('budget_rate', e)}
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer" 
                    >
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                    </div>
                  </th>
                )}
                {visibleColumns.has('budget_total') && (
                  <th 
                    className="relative group font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 text-right bg-surface-base border-b border-border-subtle"
                    style={{ width: colWidths.budget_total }}
                  >
                    Budget Total
                    <div 
                      onMouseDown={(e) => startResize('budget_total', e)}
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer" 
                    >
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                    </div>
                  </th>
                )}
                {visibleColumns.has('variance') && (
                  <th 
                    className="relative group font-mono text-[9px] font-black uppercase tracking-widest text-ghost px-4 py-2.5 text-right bg-surface-base border-b border-border-subtle"
                    style={{ width: colWidths.variance }}
                  >
                    Variance
                    <div 
                      onMouseDown={(e) => startResize('variance', e)}
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer" 
                    >
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                    </div>
                  </th>
                )}

                {visibleColumns.has('status') && (
                  <th className="font-mono text-[9px] uppercase tracking-widest text-ghost px-4 py-2.5 bg-surface-base border-b border-border-subtle">Status</th>
                )}
                {visibleColumns.has('actions') && (
                  <th className="px-4 py-2.5 bg-surface-base border-b border-border-subtle"></th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50">
              {loading ? (
                <tr>
                  <td colSpan={16} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-ghost">
                      <div className="w-8 h-8 border-2 border-border-subtle border-t-primary rounded-full animate-spin" />
                      <span className="text-sm font-bold uppercase tracking-widest">Hydrating BOQ Architecture…</span>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-ghost">
                      <Search className="w-8 h-8 opacity-20" />
                      <span className="text-sm font-bold">No results found</span>
                      <span className="text-[11px] uppercase tracking-widest">Adjust filters or search parameters</span>
                    </div>
                  </td>
                </tr>
              ) : (
                bills.map(bill => (
                  <React.Fragment key={bill}>
                    <tr className="bg-surface-2/40 cursor-pointer hover:bg-surface-2 transition-colors border-l-2 border-l-primary/50"
                      onClick={() => toggleBill(bill)}
                    >
                      <td className="px-4 py-3"></td>
                      <td colSpan={Array.from(visibleColumns).length} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ChevronRight className={cn(
                            "w-4 h-4 text-primary transition-transform duration-200",
                            expandedBills.has(bill) && "rotate-90"
                          )} />
                          <span className="text-xs font-black uppercase tracking-widest text-main">{bill}</span>
                          <span className="text-[11px] font-mono text-ghost px-2 py-0.5 rounded bg-surface-base border border-border-subtle">
                            {groupedItemsMap[bill].length} Items
                          </span>
                        </div>
                      </td>
                    </tr>
                    {expandedBills.has(bill) && groupedItemsMap[bill].map((item, idx) => {
                      if (!isItemVisible(item)) return null;

                      const level = getItemLevel(item.item_no);
                      const isHeader = !item.unit && (item.contract_qty === 0 && (item.surveyed_qty || 0) === 0);
                      
                      const hasChildren = item.hasChildren;
                      const isExpanded = expandedItems.has(item.item_no || '');

                      // Calculate Budgeting
                      const itemResources = resources.filter(r => r.boq_item_id === item.id);
                      const budgetUnitCost = itemResources.reduce((sum, res) => {
                        const q = res.consumption_rate * (1 + (res.waste_factor_pct || 0) / 100);
                        const localStorageOverride = localStorage.getItem(`rate_override_${res.id}`);
                        const rateToUse = localStorageOverride !== null
                          ? parseFloat(localStorageOverride)
                          : ((res.is_manual && res.effective_rate != null)
                            ? Number(res.effective_rate)
                            : (libraryRates[(res.resource_code || '').toLowerCase().trim()] || 0));
                        return sum + (q * rateToUse);
                      }, 0);
                      
                      const currentQty = item.surveyed_qty || item.contract_qty || 0;
                      const budgetTotal = budgetUnitCost * currentQty;
                      const effectiveContractAmount = (item.contract_qty === 0 && (item.surveyed_qty || 0) > 0)
                        ? ((item.surveyed_qty || 0) * (item.contract_rate || 0))
                        : item.contract_amount;
                      const variance = effectiveContractAmount - budgetTotal;

                      return (
                        <tr 
                          key={item.id} 
                          className={cn(
                            "hover:bg-surface-2/50 transition-colors cursor-pointer group border-b border-border-subtle/30",
                            isHeader ? "bg-surface-3/50 font-bold" : "",
                            selectedIds.has(item.id) && "bg-primary/5",
                            (isMassEdit || editingItemId === item.id) && "bg-primary/[0.02]"
                          )}
                          onClick={() => {
                            if (isHeader) return;
                            if (selectedIds.size > 0) {
                              toggleSelect(item.id);
                            } else {
                              setSelectedItem(item);
                            }
                          }}
                        >
                          <td className="px-4 py-1.5" onClick={e => e.stopPropagation()}>
                            <button 
                              type="button"
                              onClick={() => toggleSelect(item.id)}
                              className="text-ghost hover:text-primary transition-colors cursor-pointer block p-1"
                              title={selectedIds.has(item.id) ? "Deselect Item" : "Select Item"}
                            >
                              {selectedIds.has(item.id) ? (
                                <CheckSquare className="w-3.5 h-3.5 text-primary animate-in zoom-in-95 duration-100" />
                              ) : (
                                <Square className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>
                          {visibleColumns.has('item_no') && (
                            <td className="px-4 py-1.5 border-r border-border-subtle/20">
                               <div className="flex items-start gap-2 pt-0.5 relative" style={{ paddingLeft: `${level * 20}px`, width: colWidths.item_no }}>
                                  {level > 0 && (
                                    <div className="absolute left-[calc(level*20px-10px)] top-1/2 w-2 border-t border-dashed border-border-muted -translate-x-full" 
                                         style={{ marginLeft: `${-10}px` }} />
                                  )}
                                  {hasChildren && (
                                    <button 
                                      onClick={(e) => toggleItemCollapse(item.item_no || '', e)}
                                      className="p-0.5 rounded hover:bg-surface-2 transition-colors shrink-0 z-10 bg-surface-base/50"
                                    >
                                      {expandedItems.has(item.item_no || '') ? <ChevronDown className="w-3 h-3 text-primary" /> : <ChevronRight className="w-3 h-3 text-primary" />}
                                    </button>
                                  )}
                                  {!hasChildren && <div className="w-4 shrink-0" />}
                                  {(isMassEdit || editingItemId === item.id) && !isHeader ? (
                                    <input 
                                      className="bg-surface-base border border-primary rounded px-1.5 py-0.5 text-[10px] font-mono text-main w-full outline-none h-7 font-black"
                                      value={drafts[item.id]?.item_no ?? item.item_no ?? ''}
                                      onClick={e => e.stopPropagation()}
                                      onChange={e => updateDraft(item.id, { item_no: e.target.value })}
                                    />
                                  ) : (
                                    <span 
                                      className={cn(
                                        "text-[11px] whitespace-normal break-words cursor-pointer font-mono",
                                        hasChildren ? "font-semibold text-accent hover:underline" : "font-normal text-dim"
                                      )}
                                      onClick={(e) => hasChildren && toggleItemCollapse(item.item_no || '', e)}
                                    >
                                      {cleanRichText(item.item_no) || '—'}
                                    </span>
                                  )}
                                </div>
                            </td>
                          )}
                          {visibleColumns.has('description') && (
                            <td className="px-4 py-1.5 border-r border-border-subtle/20">
                               <div className="flex items-start gap-2" style={{ width: colWidths.description }}>
                                  {(isMassEdit || editingItemId === item.id) && !isHeader ? (
                                    <textarea 
                                      className="bg-surface-base border border-primary rounded px-1.5 py-0.5 text-[11px] text-main w-full outline-none min-h-[50px] leading-tight resize-none font-black"
                                      value={drafts[item.id]?.description ?? item.description ?? ''}
                                      onClick={e => e.stopPropagation()}
                                      onChange={e => updateDraft(item.id, { description: e.target.value })}
                                    />
                                  ) : (
                                    <span className={cn(
                                      "whitespace-normal leading-tight py-0.5",
                                      hasChildren ? "text-[13px] font-semibold text-main" : "text-[12px] font-normal text-dim/90"
                                    )}>{cleanRichText(item.description)}</span>
                                  )}
                                  {item.contract_qty === 0 && (item.surveyed_qty || 0) > 0 && (
                                    <span className="px-1.5 py-0.5 rounded bg-warning/10 border border-warning/20 text-[8px] font-black text-warning uppercase whitespace-nowrap ml-auto self-start mt-0.5 tracking-widest">
                                      Extra Scope
                                    </span>
                                  )}
                                </div>
                            </td>
                          )}
                          {visibleColumns.has('unit') && (
                            <td className={cn(
                              "px-4 py-1.5 font-mono text-ghost text-center",
                              isFullscreen ? "text-[14px]" : "text-[13px]"
                            )}>
                              <div style={{ width: colWidths.unit }} className="flex justify-center">
                                {!isHeader && (
                                  (isMassEdit || editingItemId === item.id) ? (
                                    <input 
                                      className="bg-surface-base border border-primary rounded px-1 py-0.5 text-xs font-mono text-main w-full text-center outline-none h-7"
                                      value={drafts[item.id]?.unit ?? item.unit ?? ''}
                                      onClick={e => e.stopPropagation()}
                                      onChange={e => updateDraft(item.id, { unit: e.target.value })}
                                    />
                                  ) : (
                                    <span className="whitespace-normal">{cleanRichText(item.unit) || '—'}</span>
                                  )
                                )}
                              </div>
                            </td>
                          )}
                          {visibleColumns.has('contract_qty') && (
                            <td className={cn(
                              "px-4 py-1.5 font-mono text-main text-right",
                              isFullscreen ? "text-[14px]" : "text-[12px]"
                            )}>
                              <div style={{ width: colWidths.contract_qty }}>
                                {!isHeader && (
                                  (isMassEdit || editingItemId === item.id) ? (
                                    <input 
                                      type="number"
                                      className="bg-surface-base border border-primary rounded px-1 py-0.5 text-xs font-mono text-main w-full text-right outline-none h-7"
                                      value={drafts[item.id]?.contract_qty ?? item.contract_qty ?? 0}
                                      onClick={e => e.stopPropagation()}
                                      onChange={e => updateDraft(item.id, { contract_qty: parseFloat(e.target.value) || 0 })}
                                    />
                                  ) : (
                                    (item.contract_qty || 0).toLocaleString()
                                  )
                                )}
                              </div>
                            </td>
                          )}
                          {visibleColumns.has('contract_rate') && (
                            <td className={cn(
                              "px-4 py-1.5 font-mono text-dim text-right",
                              isFullscreen ? "text-[14px]" : "text-[12px]"
                            )}>
                               <div style={{ width: colWidths.contract_rate }}>
                                {!isHeader && (
                                  (isMassEdit || editingItemId === item.id) ? (
                                    <input 
                                      type="number"
                                      className="bg-surface-base border border-primary rounded px-1 py-0.5 text-xs font-mono text-main w-full text-right outline-none h-7"
                                      value={drafts[item.id]?.contract_rate ?? item.contract_rate ?? 0}
                                      onClick={e => e.stopPropagation()}
                                      onChange={e => updateDraft(item.id, { contract_rate: parseFloat(e.target.value) || 0 })}
                                    />
                                  ) : (
                                    (item.contract_rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                  )
                                )}
                              </div>
                            </td>
                          )}
                          {visibleColumns.has('contract_amount') && (
                            <td className={cn(
                              "px-4 py-1.5 font-mono text-ghp-total text-right font-bold",
                              isFullscreen ? "text-[15px]" : "text-[12px]"
                            )}>
                              <div style={{ width: colWidths.contract_amount }} className="truncate">
                                {!isHeader && (
                                  (drafts[item.id]?.contract_qty != null || drafts[item.id]?.contract_rate != null) ? (
                                    ((drafts[item.id]?.contract_qty ?? item.contract_qty ?? 0) * (drafts[item.id]?.contract_rate ?? item.contract_rate ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                                  ) : (
                                    item.contract_qty === 0 && (item.surveyed_qty || 0) > 0
                                      ? ((item.surveyed_qty || 0) * (item.contract_rate || 0)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                                      : (item.contract_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                                  )
                                )}
                              </div>
                            </td>
                          )}
                          {visibleColumns.has('surveyed_qty') && (
                            <td className={cn(
                              "px-4 py-1.5 font-mono text-accent text-right",
                              isFullscreen ? "text-[14px]" : "text-[12px]"
                            )}>
                              <div style={{ width: colWidths.surveyed_qty }}>
                                 {!isHeader && (
                                  editingQty?.id === item.id ? (
                                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                      <input 
                                        type="number"
                                        className="w-full bg-surface-base border border-primary rounded px-1 py-0.5 text-right outline-none text-main h-7"
                                        value={editingQty.value}
                                        autoFocus
                                        onChange={e => setEditingQty({ ...editingQty, value: e.target.value })}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') updateSurveyedQty(item.id, parseFloat(editingQty.value) || 0);
                                          if (e.key === 'Escape') setEditingQty(null);
                                        }}
                                        onBlur={() => updateSurveyedQty(item.id, parseFloat(editingQty.value) || 0)}
                                      />
                                    </div>
                                  ) : (
                                    <div 
                                      className="cursor-pointer hover:underline decoration-dotted"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingQty({ id: item.id, value: (item.surveyed_qty || 0).toString() });
                                      }}
                                    >
                                      {(item.surveyed_qty || 0).toLocaleString()}
                                    </div>
                                  )
                                )}
                              </div>
                            </td>
                          )}
                          {visibleColumns.has('actual_qty') && (
                            <td className={cn(
                              "px-4 py-1.5 font-mono text-primary font-bold text-right bg-primary/5",
                              isFullscreen ? "text-[14px]" : "text-[12px]"
                            )}>
                              <div style={{ width: colWidths.actual_qty }} className="truncate">
                                {!isHeader && (item.actual_qty || 0).toLocaleString()}
                              </div>
                            </td>
                          )}
                          {visibleColumns.has('daily_output') && (
                            <td className={cn(
                              "px-4 py-1.5 font-mono text-dim text-right whitespace-nowrap",
                              isFullscreen ? "text-[14px]" : "text-[12px]"
                            )}>
                              {!isHeader && (item.daily_output_qty || '—')}
                            </td>
                          )}
                          {visibleColumns.has('no_days') && (
                            <td className={cn(
                              "px-4 py-1.5 font-mono text-ghost text-center whitespace-nowrap overflow-hidden",
                              isFullscreen ? "text-[14px]" : "text-[11px]"
                            )}>
                              <div style={{ width: colWidths.no_days }} className="truncate">
                                {!isHeader && (calculateDuration(item.planned_start_date, item.planned_end_date) || '—')}
                              </div>
                            </td>
                          )}
                          {visibleColumns.has('predecessors') && (
                            <td className={cn(
                              "px-4 py-1.5 font-mono text-ghost whitespace-nowrap overflow-hidden",
                              isFullscreen ? "text-[14px]" : "text-[11px]"
                            )}>
                              <div style={{ width: colWidths.predecessors }} className="truncate">
                                {!isHeader && (getPredecessorsString(item.id) || '—')}
                              </div>
                            </td>
                          )}
                          {visibleColumns.has('trade') && (
                            <td className="px-4 py-1.5" style={{ width: colWidths.trade }}>
                              {!isHeader && (
                                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                  <button
                                    onClick={() => setManualAssignItem(item)}
                                    className={cn(
                                      "flex items-center justify-between gap-2 px-2 py-1 rounded text-[11px] border transition-all min-w-[150px] flex-1",
                                      item.trade_code 
                                        ? "bg-surface-2 border-border-subtle text-primary font-bold" 
                                        : "bg-surface-base border-border-subtle text-dim hover:border-primary"
                                    )}
                                  >
                                    <span className="truncate">
                                      {item.trade_code 
                                        ? `${cleanRichText(item.trade_code)}: ${cleanRichText(trades.find(t => t.trade_code === item.trade_code)?.trade_item) || '...'}` 
                                        : 'Select Trade...'}
                                    </span>
                                    <ChevronRight className="w-3 h-3 flex-shrink-0" />
                                  </button>
                                  
                                  {item.trade_code && !item.recipe_confirmed && (
                                    <button 
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          const { error } = await supabase
                                            .from('boq_items')
                                            .update({ 
                                              recipe_confirmed: true,
                                              status: 'in_progress'
                                            })
                                            .eq('id', item.id);
                                          if (error) throw error;
                                          setItems(items.map(i => i.id === item.id ? { ...i, recipe_confirmed: true, status: 'in_progress' } : i));
                                          setNotification({ type: 'success', message: 'Recipe confirmed!' });
                                        } catch (err: any) {
                                          setNotification({ type: 'error', message: 'Error: ' + err.message });
                                        }
                                      }}
                                      className="p-1 px-2 rounded bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                                      title="Confirm Recipe"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      Confirm
                                    </button>
                                  )}

                                  {item.trade_code && (
                                    <button 
                                      onClick={() => unassignTrade(item.id)}
                                      className="p-1 text-dim hover:text-danger transition-colors"
                                      title="Unassign Trade"
                                    >
                                      <XIcon className="w-3 h-3" />
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => handleRowAIAssign(item)}
                                    disabled={rowAssigningId === item.id}
                                    className={cn(
                                      "p-1 rounded transition-all",
                                      rowAssigningId === item.id ? "text-primary animate-spin" : "text-dim hover:text-primary hover:bg-primary/10"
                                    )}
                                    title="AI Assign"
                                  >
                                    {rowAssigningId === item.id ? <Loader2 className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              )}
                            </td>
                          )}

                          {visibleColumns.has('budget_rate') && (
                            <td className="px-4 py-1.5 font-mono text-[12px] text-right text-main">
                              {!isHeader && budgetUnitCost > 0 && budgetUnitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          )}
                          {visibleColumns.has('budget_total') && (
                            <td className="px-4 py-1.5 font-mono text-[12px] text-right text-main">
                              {!isHeader && budgetTotal > 0 && budgetTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </td>
                          )}
                          {visibleColumns.has('variance') && (
                            <td className={cn(
                              "px-4 py-1.5 font-mono text-[12px] text-right font-bold",
                              variance >= 0 ? "text-primary" : "text-danger"
                            )}>
                              {!isHeader && variance !== 0 && variance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </td>
                          )}

                          {visibleColumns.has('status') && (
                            <td className="px-4 py-1.5 whitespace-nowrap">
                              {!isHeader && (
                                <div className={cn(
                                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                  item.status === 'certified' ? "bg-primary/10 text-primary border border-primary/30" :
                                  item.status === 'in_progress' ? "bg-accent/10 text-accent border border-accent/20" :
                                  item.status === 'recipe_pending' ? "bg-warning/10 text-warning border border-warning/20" :
                                  "bg-surface-3 text-dim border border-border-subtle"
                                )}>
                                  <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                  {item.status.replace('_', ' ')}
                                </div>
                              )}
                            </td>
                          )}
                          {visibleColumns.has('actions') && (
                            <td className="px-4 py-1.5 text-right sticky right-0 bg-surface-base/80 backdrop-blur-sm shadow-[-4px_0_4px_-2px_rgba(0,0,0,0.05)] border-l border-border-subtle/50 group-hover:bg-surface-3/30 transition-colors">
                              {!isHeader && (
                                <div className="flex items-center justify-end gap-1">
                                  {editingItemId === item.id ? (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setEditingItemId(null); }}
                                      className="p-1.5 text-success hover:bg-success/10 transition-all rounded-lg"
                                      title="Keep changes in draft"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setEditingItemId(item.id); }}
                                      disabled={isMassEdit}
                                      className="p-1.5 text-ghost hover:text-primary transition-all rounded-lg hover:bg-primary/10 disabled:opacity-30"
                                      title="Edit Item"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}
                                    className="p-1.5 rounded-md hover:bg-surface-2 text-dim hover:text-primary transition-colors"
                                    title="View Recipe"
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                  {hasCapability('boq:delete_item') && (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteItem(item.id);
                                      }}
                                      className="p-1.5 rounded-md hover:bg-danger/10 text-dim hover:text-danger transition-colors"
                                      title="Delete Item"
                                    >
                                      <Trash2 className="w-4 h-4" />
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!isFullscreen && (
        <div className="mt-3 bg-surface-2 border border-border-subtle rounded-lg p-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[9px] font-mono uppercase tracking-widest text-dim">Total Contract</span>
              <span className="text-sm font-bold text-main">€{totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-mono uppercase tracking-widest text-dim">Total Budget</span>
              <span className="text-sm font-bold text-accent">
                €{items.reduce((sum, item) => {
                  const itemResources = resources.filter(r => r.boq_item_id === item.id);
                  const budgetUnitCost = itemResources.reduce((sum, res) => {
                    const q = res.consumption_rate * (1 + (res.waste_factor_pct || 0) / 100);
                    const localStorageOverride = localStorage.getItem(`rate_override_${res.id}`);
                    const rateToUse = localStorageOverride !== null
                      ? parseFloat(localStorageOverride)
                      : ((res.is_manual && res.effective_rate != null)
                        ? Number(res.effective_rate)
                        : (libraryRates[(res.resource_code || '').toLowerCase().trim()] || 0));
                    return sum + (q * rateToUse);
                  }, 0);
                  return sum + (budgetUnitCost * (item.surveyed_qty || item.contract_qty || 0));
                }, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-mono uppercase tracking-widest text-dim">Est. Potential Profit</span>
              <span className={cn(
                "text-sm font-bold",
                (totalAmount - items.reduce((sum, item) => {
                  const itemResources = resources.filter(r => r.boq_item_id === item.id);
                  const budgetUnitCost = itemResources.reduce((sum, res) => {
                    const q = res.consumption_rate * (1 + (res.waste_factor_pct || 0) / 100);
                    const localStorageOverride = localStorage.getItem(`rate_override_${res.id}`);
                    const rateToUse = localStorageOverride !== null
                      ? parseFloat(localStorageOverride)
                      : ((res.is_manual && res.effective_rate != null)
                        ? Number(res.effective_rate)
                        : (libraryRates[(res.resource_code || '').toLowerCase().trim()] || 0));
                    return sum + (q * rateToUse);
                  }, 0);
                  return sum + (budgetUnitCost * (item.surveyed_qty || item.contract_qty || 0));
                }, 0)) >= 0 ? "text-primary" : "text-danger"
              )}>
                €{(totalAmount - items.reduce((sum, item) => {
                  const itemResources = resources.filter(r => r.boq_item_id === item.id);
                  const budgetUnitCost = itemResources.reduce((sum, res) => {
                    const q = res.consumption_rate * (1 + (res.waste_factor_pct || 0) / 100);
                    const localStorageOverride = localStorage.getItem(`rate_override_${res.id}`);
                    const rateToUse = localStorageOverride !== null
                      ? parseFloat(localStorageOverride)
                      : ((res.is_manual && res.effective_rate != null)
                        ? Number(res.effective_rate)
                        : (libraryRates[(res.resource_code || '').toLowerCase().trim()] || 0));
                    return sum + (q * rateToUse);
                  }, 0);
                  return sum + (budgetUnitCost * (item.surveyed_qty || item.contract_qty || 0));
                }, 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
          <div className="text-[10px] font-mono text-dim bg-surface-base px-2 py-1 rounded">
            {filteredItems.length} ITEMS FILTERED
          </div>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[80] bg-surface-1 border-2 border-primary rounded-2xl shadow-2xl p-4 flex items-center gap-6 animate-in slide-in-from-bottom-5">
           <div className="flex flex-col gap-0.5">
             <span className="text-[9px] font-black uppercase text-primary tracking-widest">Mass Edit Active</span>
             <span className="text-xs font-bold text-main">{selectedIds.size} tasks selected</span>
           </div>
           
           <div className="h-8 w-px bg-border-subtle" />
           
           <div className="flex items-center gap-4">
             {hasCapability('boq:delete_item') && (
               <div className="flex flex-col gap-1">
                 <label className="text-[8px] font-black uppercase text-ghost">Actions</label>
                 <button 
                   onClick={bulkDelete}
                   disabled={isDeleting}
                   className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-lg text-xs font-bold transition-all uppercase tracking-wider cursor-pointer"
                 >
                   {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                   Remove ({selectedIds.size})
                 </button>
               </div>
             )}

             {hasCapability('manage_boq') && (
               <div className="flex flex-col gap-1">
                 <label className="text-[8px] font-black uppercase text-ghost">Task Setup</label>
                 <button 
                   onClick={async () => {
                     if (confirm(`Finalize and confirm the ${selectedIds.size} selected items?`)) {
                       try {
                         const { error } = await supabase
                           .from('boq_items')
                           .update({ 
                             recipe_confirmed: true,
                             status: 'in_progress'
                           })
                           .in('id', Array.from(selectedIds));
                         if (error) throw error;
                         setItems(items.map(i => selectedIds.has(i.id) ? { ...i, recipe_confirmed: true, status: 'in_progress' } : i));
                         setSelectedIds(new Set());
                         setNotification({ type: 'success', message: 'Rows confirmed.' });
                       } catch (err: any) {
                         setNotification({ type: 'error', message: err.message });
                       }
                     }
                   }}
                   className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-xs font-bold transition-all uppercase tracking-wider cursor-pointer font-sans"
                 >
                   <CheckCircle2 className="w-3.5 h-3.5" />
                   Confirm Selected
                 </button>
               </div>
             )}

             <div className="h-8 w-px bg-border-subtle" />

             <button 
               type="button"
               onClick={() => setSelectedIds(new Set())}
               className="p-2 text-ghost hover:text-rose-500 transition-all cursor-pointer"
               title="Deselect All"
             >
               <XIcon className="w-5 h-5" />
             </button>
           </div>
        </div>
      )}

      {selectedItem && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-300"
            onClick={() => setSelectedItem(null)}
          />
          <RecipePanel 
            item={selectedItem} 
            onClose={() => setSelectedItem(null)} 
            onUpdate={(code) => {
              setItems(items => items.map(i => i.id === selectedItem.id ? { ...i, trade_code: code } : i));
            }}
            onConfirm={(updatedFields) => {
              setItems(items => items.map(i => i.id === selectedItem.id ? { ...i, ...updatedFields } : i));
            }}
            userRole={userRole}
            tenantId={tenantId}
          />
        </>
      )}

      {showAIModal && (
        <TradeAssignmentModal 
          items={aiItems}
          onClose={() => setShowAIModal(false)}
          tenantId={tenantId}
          onSuccess={() => {
            loadBOQ();
            setNotification({ type: 'success', message: 'Trade codes assigned successfully!' });
          }}
        />
      )}

      {importPreviewData && (
        <BOQImportPreview 
          data={importPreviewData}
          onConfirm={confirmImport}
          onCancel={() => setImportPreviewData(null)}
        />
      )}

      {manualAssignItem && (
        <TradePickerModal 
          tenantId={tenantId}
          onClose={() => setManualAssignItem(null)}
          onSelect={(trade) => {
            updateTradeCode(manualAssignItem.id, trade.trade_code);
            setManualAssignItem(null);
          }}
        />
      )}

      {/* Deletion Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-surface-base/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center text-danger">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-main">Confirm Deletion</h3>
                  <p className="text-sm text-dim">This action cannot be undone.</p>
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-surface-base border border-border-subtle mb-6">
                <div className="text-sm text-main font-medium mb-1">
                  {itemsPendingDeletion.length === 1 ? (
                    <>You are about to delete <span className="text-danger">"{items.find(i => i.id === itemsPendingDeletion[0])?.description}"</span></>
                  ) : (
                    <>You are about to delete <span className="text-danger text-lg">{itemsPendingDeletion.length} items</span></>
                  )}
                </div>
                <p className="text-xs text-dim">Associated resources and build-ups will also be permanently removed.</p>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setItemsPendingDeletion([]);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border-subtle text-main text-sm font-bold hover:bg-surface-2 transition-all"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button 
                  onClick={executeDelete}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-danger text-white text-sm font-bold hover:bg-danger/90 transition-all flex items-center justify-center gap-2"
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refresh Activity Modal */}
      {showRefreshModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-surface-base/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-8 text-center animate-in zoom-in-95 duration-200">
            {refreshStage === 'syncing' ? (
              <>
                <div className="relative w-24 h-24 mx-auto mb-6">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      className="text-border-subtle"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
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
                    <span className="text-[10px] text-dim font-mono uppercase tracking-widest mt-1">Syncing</span>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-main mb-2">Refreshing BOQ Data</h3>
                <p className="text-sm text-ghost mb-6">
                  Checking {refreshProgress?.total} items...
                  <br/>
                  <span className="text-[10px] font-mono mt-1 block">
                    Progress: {refreshProgress?.current} / {refreshProgress?.total}
                  </span>
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
                <h3 className="text-xl font-bold text-main mb-2">Sync Complete!</h3>
                <p className="text-sm text-ghost mb-8">
                  All items have been matched and updated against the library.
                </p>
                <button 
                  onClick={() => {
                    setShowRefreshModal(false);
                    // refreshReport stays populated so that modal shows when this one closes
                  }}
                  className="w-full btn btn-accent py-3 font-bold"
                >
                  View Final Report
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {refreshReport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-surface-base/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-main">Refresh Summary</h2>
                    <p className="text-xs text-ghost">Analysis of {refreshReport.total} items</p>
                  </div>
                </div>
                <button onClick={() => setRefreshReport(null)} className="text-dim hover:text-main">
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-surface-2 border border-border-subtle p-4 rounded-xl">
                  <div className="text-[10px] font-mono text-dim uppercase tracking-wider mb-1">Populated</div>
                  <div className="text-2xl font-bold text-primary">{refreshReport.successful.length}</div>
                </div>
                <div className="bg-surface-2 border border-border-subtle p-4 rounded-xl">
                  <div className="text-[10px] font-mono text-dim uppercase tracking-wider mb-1">Unassigned</div>
                  <div className="text-2xl font-bold text-warning">{refreshReport.unassigned.length}</div>
                </div>
                <div className="bg-surface-2 border border-border-subtle p-4 rounded-xl">
                  <div className="text-[10px] font-mono text-dim uppercase tracking-wider mb-1">No Library Match</div>
                  <div className="text-2xl font-bold text-danger">{refreshReport.unpopulated.length}</div>
                </div>
                <div className="bg-surface-2 border border-border-subtle p-4 rounded-xl">
                  <div className="text-[10px] font-mono text-dim uppercase tracking-wider mb-1">Total Checked</div>
                  <div className="text-2xl font-bold text-accent">{refreshReport.total}</div>
                </div>
              </div>

              <div className="mb-6">
                <div className="text-[10px] font-mono text-dim uppercase tracking-wider mb-2">State Breakdown</div>
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
                <div className="mb-6 last:mb-0">
                  <div className="text-[10px] font-mono text-warning uppercase tracking-wider mb-2">Unassigned Items (Needs Trade Code)</div>
                  <div className="max-h-24 overflow-y-auto bg-surface-base border border-warning/20 rounded-lg p-2 font-mono text-[10px] text-warning/50 flex flex-wrap gap-x-2 gap-y-1">
                    {refreshReport.unassigned.map((no, idx) => <span key={`${no}-${idx}`}>{no}</span>)}
                  </div>
                </div>
              )}

              <button 
                onClick={() => setRefreshReport(null)}
                className="w-full btn btn-accent py-3 font-bold"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div className={cn(
          "fixed top-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl animate-in slide-in-from-right duration-300 flex items-center gap-3 border",
          notification.type === 'success' ? "bg-primary text-surface-base border-primary" : "bg-danger text-white border-danger"
        )}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-bold">{notification.message}</span>
        </div>
      )}
    </div>
  );
}
