import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { BOQItem } from '../types';
import { GoogleGenAI } from "@google/genai";
import { 
  X, 
  Calculator, 
  Package, 
  Users, 
  Truck, 
  Wrench, 
  Info, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Trash2,
  Plus,
  Loader2,
  Save,
  GripVertical,
  Library
} from 'lucide-react';
import { cn, cleanRichText } from '../lib/utils';
import { usePermissions } from '../hooks/usePermissions';
import { ConsumptionCalculator } from './ConsumptionCalculator';
import { TradePickerModal } from './TradePickerModal';
import { ResourcePickerModal } from './ResourcePickerModal';
import { Sparkles } from 'lucide-react';

interface RecipePanelProps {
  item: BOQItem;
  onClose: () => void;
  onUpdate?: (tradeCode: string) => void;
  onConfirm?: (updatedFields: Partial<BOQItem>) => void;
  userRole: any;
  tenantId: any;
}

interface BOQResource {
  id: string;
  resource_type: 'material' | 'labour' | 'equipment' | 'vehicle' | 'subcontractor';
  resource_code?: string;
  resource_name: string;
  resource_unit: string;
  consumption_rate: number;
  waste_factor_pct: number;
  is_excluded?: boolean;
  is_manual?: boolean;
  source_trade_code?: string;
}

export function RecipePanel({ item, onClose, onUpdate, onConfirm, userRole, tenantId }: RecipePanelProps) {
  const { hasCapability } = usePermissions(userRole, tenantId);
  
  // Persistent DB state and working draft state
  const [dbResources, setDbResources] = useState<BOQResource[]>([]);
  const [localResources, setLocalResources] = useState<BOQResource[]>([]);
  const [deletedResourceIds, setDeletedResourceIds] = useState<string[]>([]);
  
  const [tradeName, setTradeName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [calcQty, setCalcQty] = useState<number>(item.surveyed_qty || item.contract_qty || 0);

  const cleanUnit = (unit: string | null) => {
    if (!unit) return '';
    if (typeof unit !== 'string') return '';
    if (unit.startsWith('{') && unit.includes('richText')) {
      try {
        const parsed = JSON.parse(unit);
        if (parsed.richText) {
          return parsed.richText.map((rt: any) => rt.text).join('');
        }
      } catch (e) {
        return unit;
      }
    }
    return unit;
  };

  const uniqueResources = useMemo(() => {
    const list: BOQResource[] = [];
    
    // Synonym groups for common material categories to detect duplicate slots from multiple recipes
    const SYNONYM_GROUPS = [
      ['cement'],
      ['sand', 'quarry'],
      ['aggregate', 'stone', 'gravel', 'ballast', 'rock', 'chippings'],
      ['steel', 'bar', 'rebar', 'iron', 'wire'],
      ['water'],
      ['timber', 'wood', 'plywood', 'board']
    ];

    const areSimilar = (r1: BOQResource, r2: BOQResource) => {
      if (r1.resource_type !== r2.resource_type) return false;
      if (r1.resource_unit !== r2.resource_unit) return false;
      
      // If consumption rate is identical, check name similarity
      if (Math.abs(r1.consumption_rate - r2.consumption_rate) < 0.0001) {
        const n1 = r1.resource_name.toLowerCase();
        const n2 = r2.resource_name.toLowerCase();

        // Exact name or inclusion
        if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) return true;

        // Synonym group check
        for (const group of SYNONYM_GROUPS) {
          const hasR1 = group.some(word => n1.includes(word));
          const hasR2 = group.some(word => n2.includes(word));
          if (hasR1 && hasR2) return true;
        }

        // Substantial word overlap (words of length > 3)
        const w1 = n1.split(/[^a-z0-9]+/).filter(w => w.length > 3);
        const w2 = n2.split(/[^a-z0-9]+/).filter(w => w.length > 3);
        const common = w1.filter(w => w2.includes(w));
        if (common.length > 0) return true;
      }
      return false;
    };

    localResources.forEach(r => {
      // Check if we already have a similar resource in the list
      const isDuplicate = list.some(existing => areSimilar(existing, r));
      if (!isDuplicate) {
        list.push(r);
      }
    });

    return list;
  }, [localResources]);

  const groupedResources = useMemo(() => {
    const groups: Record<string, BOQResource[]> = {};
    uniqueResources.forEach(res => {
      const type = res.resource_type || 'other';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(res);
    });
    return groups;
  }, [uniqueResources]);

  const [editingRate, setEditingRate] = useState<{ id: string, value: string } | null>(null);
  const [showCalculator, setShowCalculator] = useState<{ resource: BOQResource } | null>(null);
  const [showTradePicker, setShowTradePicker] = useState(false);
  const [showCombinePicker, setShowCombinePicker] = useState(false);
  const [showResourcePicker, setShowResourcePicker] = useState(false);
  const [isAssigningAI, setIsAssigningAI] = useState(false);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [manualFormData, setManualFormData] = useState({
    resource_type: 'material' as any,
    resource_name: '',
    resource_unit: '',
    consumption_rate: 0,
    waste_factor_pct: 0
  });

  // Local change tracking computed variables
  const hasLocalChanges = useMemo(() => {
    if (deletedResourceIds.length > 0) return true;
    const hasNew = localResources.some(r => r.id.startsWith('temp_'));
    if (hasNew) return true;
    const hasModified = localResources.some(r => {
      const dbRes = dbResources.find(db => db.id === r.id);
      if (!dbRes) return false;
      return dbRes.consumption_rate !== r.consumption_rate || dbRes.is_excluded !== r.is_excluded;
    });
    return hasModified;
  }, [localResources, dbResources, deletedResourceIds]);

  const hasQtyChanges = calcQty !== (item.surveyed_qty || item.contract_qty || 0);
  const canConfirm = hasLocalChanges || hasQtyChanges || !item.recipe_confirmed;

  const combinedTrades = useMemo(() => {
    const codes = new Set<string>();
    localResources.forEach(r => {
      if (r.source_trade_code && r.source_trade_code !== item.trade_code) {
        codes.add(r.source_trade_code);
      }
    });
    return Array.from(codes);
  }, [localResources, item.trade_code]);

  // Resize logic
  const [width, setWidth] = useState(580); // Set slightly wider to comfortably place rate on right sides
  const isResizing = useRef(false);

  const startResizing = (e: React.MouseEvent) => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
  };

  const stopResizing = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 350 && newWidth <= 1100) {
      setWidth(newWidth);
    }
  };

  useEffect(() => {
    const initializeRecipe = async () => {
      await loadRecipe();
    };
    initializeRecipe();
  }, [item.id]);

  const updateTrade = async (tradeCode: string) => {
    if (hasLocalChanges && !confirm('You have unsaved changes in this recipe build-up. Changing trade will reset them. Continue?')) {
      return;
    }
    
    try {
      setIsSyncing(true);
      const { error: clearError } = await supabase
        .from('boq_item_resources')
        .delete()
        .eq('boq_item_id', item.id);
        
      if (clearError) console.warn('Could not clear prior resources:', clearError);

      const { error } = await supabase
        .from('boq_items')
        .update({ 
          trade_code: tradeCode,
          recipe_confirmed: false, // reset back to unconfirmed so they review the new one
          status: 'in_progress'
        })
        .eq('id', item.id);
      
      if (error) throw error;
      
      // Use the atomic RPC to populate resources
      const { error: rpcError } = await supabase.rpc('populate_recipe_from_trade', {
        p_boq_item_id: item.id,
        p_trade_code: tradeCode
      });

      if (rpcError) throw rpcError;

      onUpdate?.(tradeCode);
      await loadRecipe(); 
    } catch (e: any) {
      alert('Error updating trade: ' + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const combineTradeRecipe = async (tradeCode: string) => {
    setIsSyncing(true);
    try {
      // Query the resources flatly from trade_items database table where resource_name IS NOT NULL
      const { data, error } = await supabase
        .from('trade_items')
        .select('*')
        .eq('trade_code', tradeCode)
        .not('resource_name', 'is', null);

      if (error) throw error;

      if (!data || data.length === 0) {
        alert(`Selected trade "${tradeCode}" does not have any pre-configured resources in the library.`);
        return;
      }

      // Map trade resources to manual items and append to local resources array
      const imported: BOQResource[] = data.map((tr, idx) => ({
        id: `temp_combined_${tradeCode}_${Date.now()}_${idx}`,
        resource_type: tr.resource_type as any || 'material',
        resource_code: tr.resource_code || '',
        resource_name: tr.resource_name,
        resource_unit: tr.resource_unit || 'unit',
        consumption_rate: Number(tr.consumption_rate) || 0,
        waste_factor_pct: Number(tr.waste_factor_pct) || 0,
        is_excluded: false,
        is_manual: true,
        source_trade_code: tradeCode
      }));

      setLocalResources(prev => [...prev, ...imported]);
    } catch (e: any) {
      alert('Failed to combine trade recipe: ' + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAIAssign = async () => {
    setIsAssigningAI(true);
    try {
      const { data: trades } = await supabase.from('trade_items').select('trade_code, trade_item, description').eq('is_active', true);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const tradeList = (trades || []).map(t => `${t.trade_code}: ${cleanRichText(t.trade_item)} (${cleanRichText(t.description)})`).join('\n');
      
      const prompt = `
        Match this BOQ item to the most appropriate trade code.
        Item: ${item.item_no} ${cleanRichText(item.description)} (${cleanRichText(item.unit)})
        
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
        await updateTrade(result.trade_code);
      }
    } catch (err: any) {
      alert('AI Error: ' + err.message);
    } finally {
      setIsAssigningAI(false);
    }
  };

  const loadRecipe = async () => {
    setLoading(true);
    try {
      const [resData, tradeData] = await Promise.all([
        supabase
          .from('boq_item_resources')
          .select('*')
          .eq('boq_item_id', item.id),
        item.trade_code ? 
          supabase
            .from('trade_items')
            .select('trade_item')
            .eq('trade_code', item.trade_code)
            .limit(1)
            .maybeSingle() : 
          Promise.resolve({ data: null, error: null })
      ]);
      
      if (resData.error) throw resData.error;
      const loadedResources = resData.data || [];
      
      // Auto-sync IF it's empty but HAS a trade code
      if (loadedResources.length === 0 && item.trade_code) {
        await supabase.rpc('populate_recipe_from_trade', {
          p_boq_item_id: item.id,
          p_trade_code: item.trade_code
        });
        // Re-load after auto-sync
        const { data: syncedRes, error: syncError } = await supabase
          .from('boq_item_resources')
          .select('*')
          .eq('boq_item_id', item.id);
        
        if (!syncError && syncedRes) {
          const matchedRes = syncedRes || [];
          setDbResources(matchedRes);
          setLocalResources(matchedRes);
        }
      } else {
        setDbResources(loadedResources);
        setLocalResources(loadedResources);
      }
      setDeletedResourceIds([]);
      
      if (tradeData?.data) {
        setTradeName(cleanRichText(tradeData.data.trade_item));
      }
    } catch (e: any) {
      console.error('Error loading recipe:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const syncFromTrade = async () => {
    if (!item.trade_code) {
      alert('Please assign a trade code first.');
      return;
    }

    if (hasLocalChanges && !confirm('This will overwrite all manual customizations and combinations with library defaults. Continue?')) {
      return;
    }

    setIsSyncing(true);
    try {
      const { error: clearError } = await supabase
        .from('boq_item_resources')
        .delete()
        .eq('boq_item_id', item.id);
        
      if (clearError) console.warn('Could not clear prior resources:', clearError);

      const { error } = await supabase.rpc('populate_recipe_from_trade', {
        p_boq_item_id: item.id,
        p_trade_code: item.trade_code
      });

      if (error) throw error;
      
      await loadRecipe();
      alert('Recipe successfully populated from trade library.');
    } catch (e: any) {
      console.error('Error syncing from trade:', e.message);
      alert('Error syncing from trade: ' + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleExclude = (resourceId: string, currentExcluded: boolean) => {
    setLocalResources(prev => prev.map(r => r.id === resourceId ? { ...r, is_excluded: !currentExcluded } : r));
  };

  const updateConsumptionRate = (resourceId: string, value: number) => {
    setLocalResources(prev => prev.map(r => r.id === resourceId ? { ...r, consumption_rate: value } : r));
    setEditingRate(null);
  };

  const deleteResource = (resourceId: string) => {
    if (!confirm('Are you sure you want to remove this resource from the build-up?')) return;
    if (!resourceId.startsWith('temp_')) {
      setDeletedResourceIds(prev => [...prev, resourceId]);
    }
    setLocalResources(prev => prev.filter(r => r.id !== resourceId));
  };

  const handleSaveManualResource = () => {
    if (!manualFormData.resource_name || !manualFormData.resource_unit) {
      alert('Please fill in Name and Unit');
      return;
    }

    const tempId = `temp_manual_${Date.now()}`;
    const newResource: BOQResource = {
      id: tempId,
      resource_type: manualFormData.resource_type,
      resource_name: manualFormData.resource_name,
      resource_unit: manualFormData.resource_unit,
      consumption_rate: manualFormData.consumption_rate,
      waste_factor_pct: manualFormData.waste_factor_pct,
      is_manual: true,
      source_trade_code: item.trade_code || null
    };

    setLocalResources(prev => [...prev, newResource]);
    setIsAddingManual(false);
    setManualFormData({
      resource_type: 'material',
      resource_name: '',
      resource_unit: '',
      consumption_rate: 0,
      waste_factor_pct: 0
    });
  };

  const confirmRecipe = async () => {
    setIsSyncing(true);
    try {
      // 1. Delete removed components from DB
      if (deletedResourceIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('boq_item_resources')
          .delete()
          .in('id', deletedResourceIds);
        if (deleteError) throw deleteError;
      }

      // 2. Insert/Update remaining components back to SB
      for (const res of localResources) {
        if (res.id.startsWith('temp_')) {
          // Newly added manual or newly combined resource from another recipe
          const { error: insError } = await supabase
            .from('boq_item_resources')
            .insert([{
              boq_item_id: item.id,
              resource_type: res.resource_type,
              resource_name: res.resource_name,
              resource_unit: res.resource_unit,
              resource_code: res.resource_code || null,
              consumption_rate: res.consumption_rate,
              waste_factor_pct: res.waste_factor_pct,
              is_manual: true,
              source_trade_code: res.source_trade_code || item.trade_code || null,
              is_excluded: !!res.is_excluded,
              is_active: true
            }]);
          if (insError) throw insError;
        } else {
          // Update existing component
          const { error: updError } = await supabase
            .from('boq_item_resources')
            .update({
              consumption_rate: res.consumption_rate,
              is_excluded: !!res.is_excluded,
              waste_factor_pct: res.waste_factor_pct
            })
            .eq('id', res.id);
          if (updError) throw updError;
        }
      }

      // 3. Confirm quantities in boq_items
      const { error: itemError } = await supabase
        .from('boq_items')
        .update({ 
          recipe_confirmed: true,
          status: 'in_progress',
          surveyed_qty: calcQty
        })
        .eq('id', item.id);

      if (itemError) throw itemError;

      alert('Changes and recipe confirmed successfully!');
      onConfirm?.({ recipe_confirmed: true, status: 'in_progress', surveyed_qty: calcQty });
      onClose();
    } catch (e: any) {
      alert('Error confirming changes: ' + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'material': return <Package className="w-4 h-4" />;
      case 'labour': return <Users className="w-4 h-4" />;
      case 'equipment': return <Wrench className="w-4 h-4" />;
      case 'vehicle': return <Truck className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  return (
    <div 
      style={{ width: `${width}px` }}
      className="fixed inset-y-0 right-0 bg-surface-1 border-l border-border-subtle shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300"
    >
      {/* Resize Handle */}
      <div 
        onMouseDown={startResizing}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 transition-colors z-10 group"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-primary rounded-full p-0.5">
          <GripVertical className="w-3.5 h-3.5 text-surface-base" />
        </div>
      </div>

      <div className="p-6 border-b border-border-subtle flex items-start justify-between gap-4 bg-surface-2/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] text-ghost uppercase tracking-widest">{item.bill_no} • {item.item_no}</span>
            {item.recipe_confirmed && !hasLocalChanges && (
              <span className="bg-primary/10 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded border border-primary/20">CONFIRMED</span>
            )}
            {hasLocalChanges && (
              <span className="bg-warning/15 text-warning text-[9px] font-bold px-1.5 py-0.5 rounded border border-warning/20 animate-pulse">DRAFT EDITS</span>
            )}
          </div>
          <div className="text-lg font-bold leading-tight text-main">{cleanRichText(item.description)}</div>
        </div>
        <button 
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-surface-2 border border-border-subtle flex items-center justify-center hover:bg-surface-3 transition-colors"
        >
          <X className="w-4 h-4 text-dim" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Trade Assignment Section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[9px] uppercase tracking-widest text-ghost">Trade Assignment</div>
            {item.trade_code && (
              <button 
                onClick={syncFromTrade}
                disabled={isSyncing}
                className="text-[10px] font-bold text-accent hover:text-accent/80 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isSyncing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Sync from Library
              </button>
            )}
          </div>
          
          <div className={cn(
            "p-4 rounded-xl border flex items-center gap-4 transition-all group relative",
            item.trade_code 
              ? "bg-surface-2 border-border-subtle" 
              : "bg-danger/5 border-danger/20 border-dashed"
          )}>
            <div className={cn(
              "min-w-12 h-12 px-3 rounded-xl border flex items-center justify-center font-mono font-bold text-lg",
              item.trade_code 
                ? "bg-accent/10 border-accent/20 text-accent" 
                : "bg-surface-3 border-border-subtle text-ghost"
            )}>
              {item.trade_code || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-main truncate">
                {item.trade_code ? `${item.trade_code}: ${tradeName || 'Trade Item'}` : 'No Trade Assigned'}
              </div>
              <div className="text-xs text-dim mt-0.5 truncate">
                {item.trade_code ? 'Recipe build-up active • Editable' : 'Assign a trade code to populate resources'}
              </div>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => setShowTradePicker(true)}
                className="p-2 rounded-lg bg-surface-3 border border-border-subtle text-dim hover:text-primary hover:border-primary transition-all"
                title="Change Trade"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button 
                onClick={handleAIAssign}
                disabled={isAssigningAI}
                className="p-2 rounded-lg bg-surface-3 border border-border-subtle text-dim hover:text-primary hover:border-primary transition-all"
                title="AI Assign"
              >
                {isAssigningAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Combined Trade Recipes */}
          {true && (
            <div className="bg-surface-2/40 rounded-xl border border-border-subtle/50 p-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-main uppercase tracking-wider">Combined Trade Recipes</span>
                <button 
                  onClick={() => setShowCombinePicker(true)}
                  className="text-[10px] font-bold text-accent hover:text-accent/90 flex items-center gap-1 transition-colors bg-accent/10 hover:bg-accent/15 px-2 py-1 rounded"
                >
                  <Plus className="w-3 h-3" /> Combine Trade Recipe
                </button>
              </div>
              {combinedTrades.length === 0 ? (
                <div className="text-[11px] text-ghost leading-relaxed">
                  Only the primary trade's resources are in this buildup. Use "Combine Trade Recipe" to overlay recipes from secondary trades (e.g. concrete + rebar).
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {combinedTrades.map(code => (
                    <span key={code} className="bg-accent/10 border border-accent/20 text-accent font-mono text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-2">
                      <span>{code}</span>
                      <button 
                        onClick={() => {
                          if (confirm(`Remove all resources combined from trade "${code}"?`)) {
                            const toRemove = localResources.filter(r => r.source_trade_code === code);
                            toRemove.forEach(r => {
                              if (!r.id.startsWith('temp_')) {
                                setDeletedResourceIds(prev => [...prev, r.id]);
                              }
                            });
                            setLocalResources(prev => prev.filter(r => r.source_trade_code !== code));
                          }
                        }}
                        className="text-ghost hover:text-danger font-bold text-xs"
                        title="Remove combined recipe"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Resources Summary (Quantities Only) */}
        <div className="bg-surface-2 border border-border-subtle rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[9px] uppercase tracking-widest text-ghost">Execution Quantity</div>
            <div className="text-[10px] text-ghost font-medium">Contract: {item.contract_qty} {cleanUnit(item.unit)}</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <input 
                type="number" 
                className="w-full bg-surface-base border border-border-subtle rounded-xl py-4 px-5 text-3xl font-mono font-bold text-main outline-none focus:border-primary transition-colors"
                value={calcQty}
                onChange={(e) => setCalcQty(parseFloat(e.target.value) || 0)}
              />
              <div className="absolute right-5 top-1/2 -translate-y-1/2 font-mono text-sm text-ghost">{cleanUnit(item.unit)}</div>
            </div>
          </div>
        </div>

        {/* Resources List */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-2">
            <div className="font-mono text-[9px] uppercase tracking-widest text-ghost">Resource Build-up</div>
            <div className="text-[11px] font-bold text-main bg-surface-3/60 px-2 py-0.5 rounded-full border border-border-subtle/50">{localResources.length} components</div>
          </div>
          
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto mb-3" />
              <div className="text-xs text-ghost">Loading recipe resources…</div>
            </div>
          ) : localResources.length === 0 ? (
            <div className="py-16 text-center bg-surface-2/30 rounded-xl border border-border-subtle border-dashed">
              <AlertCircle className="w-10 h-10 text-ghost opacity-20 mx-auto mb-3" />
              <div className="text-sm font-medium text-dim">Recipe Empty</div>
              <p className="text-xs text-ghost mt-1">Sync from library or add resources manually</p>
              {item.trade_code && hasCapability('manage_trades') && (
                <button onClick={syncFromTrade} className="btn-ghost text-xs mt-4 text-accent flex items-center justify-center mx-auto hover:text-accent/80 transition-colors">
                  <RefreshCw className="w-3 h-3 mr-1.5" />
                  Sync from Trade Library
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Grouped Resources List */}
              {Object.keys(groupedResources).length > 0 && 
                (['material', 'labour', 'equipment', 'vehicle', 'subcontractor'] as const).map(type => {
                  const itemsOfGroup = groupedResources[type] || [];
                  if (itemsOfGroup.length === 0) return null;

                  const getGroupNameLabel = (t: string) => {
                    switch (t) {
                      case 'material': return 'Materials';
                      case 'labour': return 'Labour';
                      case 'equipment': return 'Equipment';
                      case 'vehicle': return 'Vehicles';
                      case 'subcontractor': return 'Subcontractor';
                      default: return t.charAt(0).toUpperCase() + t.slice(1) + 's';
                    }
                  };

                  return (
                    <div key={type} className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 px-1 font-mono text-[10px] uppercase tracking-[0.15em] text-primary font-bold">
                        <span className="opacity-80">{getIcon(type)}</span>
                        <span>{getGroupNameLabel(type)}</span>
                        <div className="h-[1px] flex-1 bg-border-subtle mx-2 opacity-50" />
                        <span className="text-[10px] font-black px-1.5 py-0.25 rounded bg-surface-2 border border-border-subtle/80 text-ghost font-mono">
                          {itemsOfGroup.length}
                        </span>
                      </div>
                      <div className="flex flex-col gap-3">
                        {itemsOfGroup.map((res) => {
                          const netQty = res.consumption_rate * calcQty;
                          const grossQty = netQty * (1 + (res.waste_factor_pct || 0) / 100);

                          return (
                            <div 
                              key={res.id} 
                              className={cn(
                                "bg-surface-2 border rounded-xl p-3.5 flex items-center justify-between gap-4 transition-all group",
                                res.is_excluded ? "opacity-35 border-border-subtle" : "border-border-subtle hover:border-primary/25"
                              )}
                            >
                              {/* Left parameters: Name, Quantity & Badge */}
                              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                <div className="w-10 h-10 rounded-lg bg-surface-3 border border-border-subtle flex items-center justify-center text-ghost flex-shrink-0">
                                  {getIcon(res.resource_type)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-bold text-main truncate leading-snug">
                                    {cleanRichText(res.resource_name)}
                                  </div>
                                  
                                  <div className="flex flex-wrap items-center gap-2 mt-1">
                                    {res.source_trade_code && res.source_trade_code !== item.trade_code && (
                                      <span className="bg-accent/10 border border-accent/25 text-accent font-mono text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                                        FROM {res.source_trade_code}
                                      </span>
                                    )}
                                    <span className="font-mono font-bold text-main text-sm">
                                      {Number(grossQty || 0).toFixed(2)} <span className="text-xs text-ghost font-normal uppercase">{res.resource_unit}</span>
                                    </span>
                                    {res.waste_factor_pct > 0 && (
                                      <span className="bg-warning/10 text-warning border border-warning/20 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
                                        +{res.waste_factor_pct}% WASTE
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right parameters: Consumption rate (aligned perfectly to right) and Control Options */}
                              <div className="flex items-center gap-5 flex-shrink-0">
                                <div className="flex flex-col items-end gap-1 font-mono text-right min-w-[130px]">
                                  <span className="text-ghost text-[10px] uppercase tracking-wider font-bold">Consumption</span>
                                  {editingRate?.id === res.id ? (
                                    <div className="flex items-center gap-1">
                                      <input 
                                        type="number"
                                        step="0.01"
                                        className="w-18 bg-surface-base border border-primary rounded px-2 py-0.5 text-xs text-main font-mono outline-none"
                                        value={editingRate.value}
                                        autoFocus
                                        onChange={e => setEditingRate({ ...editingRate, value: e.target.value })}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') updateConsumptionRate(res.id, parseFloat(editingRate.value) || 0);
                                          if (e.key === 'Escape') setEditingRate(null);
                                        }}
                                      />
                                      <button 
                                        onClick={() => updateConsumptionRate(res.id, parseFloat(editingRate.value) || 0)}
                                        className="text-primary hover:text-primary/80 cursor-pointer p-0.5"
                                      >
                                        <Save className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      <button 
                                        onClick={() => setEditingRate({ id: res.id, value: Number(res.consumption_rate).toFixed(2) })}
                                        className="text-main hover:text-primary underline decoration-dotted underline-offset-2 cursor-pointer font-bold text-xs"
                                        title="Click to edit rate directly"
                                      >
                                        {Number(res.consumption_rate).toFixed(2)} {cleanRichText(res.resource_unit)}/{cleanRichText(item.unit)}
                                      </button>
                                      <button 
                                        onClick={() => setShowCalculator({ resource: res })}
                                        className="p-1 rounded bg-surface-3 border border-border-subtle/80 text-dim hover:text-primary hover:border-primary transition-all cursor-pointer"
                                        title="Calculate rate with factors"
                                      >
                                        <Calculator className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => toggleExclude(res.id, !!res.is_excluded)}
                                    className={cn(
                                      "text-[10px] font-bold px-2.5 py-1.5 rounded transition-colors cursor-pointer border min-w-[75px] text-center",
                                      res.is_excluded 
                                        ? "bg-surface-3 text-ghost border-border-subtle hover:text-main hover:border-border-main" 
                                        : "bg-danger/10 text-danger border-danger/20 hover:bg-danger/20"
                                    )}
                                  >
                                    {res.is_excluded ? 'INCLUDE' : 'EXCLUDE'}
                                  </button>
                                  {hasCapability('manage_trades') && (
                                    <button 
                                      onClick={() => deleteResource(res.id)}
                                      className="p-1.5 text-ghost hover:text-danger hover:bg-danger/10 rounded transition-all cursor-pointer"
                                      title="Remove from build-up"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              }

              {/* Dynamic types (not pre-ordered above) */}
              {Object.entries(groupedResources).map(([type, itemsOfGroup]) => {
                if (['material', 'labour', 'equipment', 'vehicle', 'subcontractor'].includes(type)) return null;
                if (itemsOfGroup.length === 0) return null;

                return (
                  <div key={type} className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 px-1 font-mono text-[10px] uppercase tracking-[0.15em] text-primary font-bold">
                      <span className="opacity-80">{getIcon(type)}</span>
                      <span>{type.charAt(0).toUpperCase() + type.slice(1) + 's'}</span>
                      <div className="h-[1px] flex-1 bg-border-subtle mx-2 opacity-50" />
                      <span className="text-[10px] font-black px-1.5 py-0.25 rounded bg-surface-2 border border-border-subtle/80 text-ghost font-mono">
                        {itemsOfGroup.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {itemsOfGroup.map((res) => {
                        const netQty = res.consumption_rate * calcQty;
                        const grossQty = netQty * (1 + (res.waste_factor_pct || 0) / 100);

                        return (
                          <div 
                            key={res.id} 
                            className={cn(
                              "bg-surface-2 border rounded-xl p-3.5 flex items-center justify-between gap-4 transition-all group",
                              res.is_excluded ? "opacity-35 border-border-subtle" : "border-border-subtle hover:border-primary/25"
                            )}
                          >
                            {/* Left parameters: Name, Quantity & Badge */}
                            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                              <div className="w-10 h-10 rounded-lg bg-surface-3 border border-border-subtle flex items-center justify-center text-ghost flex-shrink-0">
                                {getIcon(res.resource_type)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-bold text-main truncate leading-snug">
                                  {cleanRichText(res.resource_name)}
                                </div>
                                
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  {res.source_trade_code && res.source_trade_code !== item.trade_code && (
                                    <span className="bg-accent/10 border border-accent/25 text-accent font-mono text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                                      FROM {res.source_trade_code}
                                    </span>
                                  )}
                                  <span className="font-mono font-bold text-main text-sm">
                                    {Number(grossQty || 0).toFixed(2)} <span className="text-xs text-ghost font-normal uppercase">{res.resource_unit}</span>
                                  </span>
                                  {res.waste_factor_pct > 0 && (
                                    <span className="bg-warning/10 text-warning border border-warning/20 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
                                      +{res.waste_factor_pct}% WASTE
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Right parameters: Consumption rate (aligned perfectly to right) and Control Options */}
                            <div className="flex items-center gap-5 flex-shrink-0">
                              <div className="flex flex-col items-end gap-1 font-mono text-right min-w-[130px]">
                                <span className="text-ghost text-[10px] uppercase tracking-wider font-bold">Consumption</span>
                                {editingRate?.id === res.id ? (
                                  <div className="flex items-center gap-1">
                                    <input 
                                      type="number"
                                      step="0.01"
                                      className="w-18 bg-surface-base border border-primary rounded px-2 py-0.5 text-xs text-main font-mono outline-none"
                                      value={editingRate.value}
                                      autoFocus
                                      onChange={e => setEditingRate({ ...editingRate, value: e.target.value })}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') updateConsumptionRate(res.id, parseFloat(editingRate.value) || 0);
                                        if (e.key === 'Escape') setEditingRate(null);
                                      }}
                                    />
                                    <button 
                                      onClick={() => updateConsumptionRate(res.id, parseFloat(editingRate.value) || 0)}
                                      className="text-primary hover:text-primary/80 cursor-pointer p-0.5"
                                    >
                                      <Save className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <button 
                                      onClick={() => setEditingRate({ id: res.id, value: Number(res.consumption_rate).toFixed(2) })}
                                      className="text-main hover:text-primary underline decoration-dotted underline-offset-2 cursor-pointer font-bold text-xs"
                                      title="Click to edit rate directly"
                                    >
                                      {Number(res.consumption_rate).toFixed(2)} {cleanRichText(res.resource_unit)}/{cleanRichText(item.unit)}
                                    </button>
                                    <button 
                                      onClick={() => setShowCalculator({ resource: res })}
                                      className="p-1 rounded bg-surface-3 border border-border-subtle/80 text-dim hover:text-primary hover:border-primary transition-all cursor-pointer"
                                      title="Calculate rate with factors"
                                    >
                                      <Calculator className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => toggleExclude(res.id, !!res.is_excluded)}
                                  className={cn(
                                    "text-[10px] font-bold px-2.5 py-1.5 rounded transition-colors cursor-pointer border min-w-[75px] text-center",
                                    res.is_excluded 
                                      ? "bg-surface-3 text-ghost border-border-subtle hover:text-main font-bold" 
                                      : "bg-danger/10 text-danger border-danger/20 hover:bg-danger/20"
                                  )}
                                >
                                  {res.is_excluded ? 'INCLUDE' : 'EXCLUDE'}
                                </button>
                                {hasCapability('manage_trades') && (
                                  <button 
                                    onClick={() => deleteResource(res.id)}
                                    className="p-1.5 text-ghost hover:text-danger hover:bg-danger/10 rounded transition-all cursor-pointer"
                                    title="Remove from build-up"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              
              {/* Dynamic manual adding / triggers nested neatly at bottom of the panel list */}
              <div className="mt-4 border-t border-border-subtle/50 pt-4 flex flex-col gap-3">
                {isAddingManual ? (
                  <div className="bg-surface-2 border border-primary/30 rounded-xl p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold text-primary uppercase tracking-wider">New Custom Resource</div>
                      <button onClick={() => setIsAddingManual(false)} className="text-ghost hover:text-main cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-ghost uppercase tracking-wider">Type</label>
                        <select 
                          className="bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-xs outline-none text-main focus:border-primary"
                          value={manualFormData.resource_type}
                          onChange={e => setManualFormData({...manualFormData, resource_type: e.target.value as any})}
                        >
                          <option value="material">Material</option>
                          <option value="labour">Labour</option>
                          <option value="equipment">Equipment</option>
                          <option value="vehicle">Vehicle</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-ghost uppercase tracking-wider">Unit</label>
                        <input 
                          className="bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-xs outline-none text-main focus:border-primary"
                          value={manualFormData.resource_unit}
                          onChange={e => setManualFormData({...manualFormData, resource_unit: e.target.value})}
                          placeholder="e.g. kg, hr"
                        />
                      </div>
                      <div className="col-span-2 flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-ghost uppercase tracking-wider">Resource Name</label>
                        <input 
                          className="bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-xs outline-none text-main focus:border-primary"
                          value={manualFormData.resource_name}
                          onChange={e => setManualFormData({...manualFormData, resource_name: e.target.value})}
                          placeholder="Enter resource name..."
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-ghost uppercase tracking-wider">Consumption</label>
                        <input 
                          type="number"
                          step="any"
                          className="bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-xs outline-none text-main focus:border-primary"
                          value={manualFormData.consumption_rate}
                          onChange={e => setManualFormData({...manualFormData, consumption_rate: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-bold text-ghost uppercase tracking-wider">Waste %</label>
                        <input 
                          type="number"
                          className="bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-xs outline-none text-main focus:border-primary"
                          value={manualFormData.waste_factor_pct}
                          onChange={e => setManualFormData({...manualFormData, waste_factor_pct: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button 
                        onClick={handleSaveManualResource}
                        className="bg-primary hover:brightness-110 text-white text-[10px] font-bold py-2 px-4 rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-md"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Add to Recipe
                      </button>
                    </div>
                  </div>
                ) : (
                  hasCapability('manage_trades') && (
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => setShowResourcePicker(true)}
                        className="flex items-center justify-center gap-2 p-3 border border-border-subtle border-dashed rounded-xl text-xs text-ghost hover:text-dim hover:border-ghost transition-all cursor-pointer"
                      >
                        <Library className="w-3.5 h-3.5 text-accent" />
                        <span>Library Resource</span>
                      </button>
                      <button 
                        onClick={() => setIsAddingManual(true)}
                        className="flex items-center justify-center gap-2 p-3 border border-border-subtle border-dashed rounded-xl text-xs text-ghost hover:text-dim hover:border-ghost transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Ad-hoc Resource</span>
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 border-t border-border-subtle bg-surface-2/80 backdrop-blur-md flex flex-col gap-4">
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn-ghost text-sm font-bold text-dim bg-surface-3/50 hover:bg-surface-3 py-2.5 rounded-xl transition-colors">Close</button>
          {hasCapability('manage_trades') && (
            <button 
              onClick={confirmRecipe}
              disabled={localResources.length === 0 || !canConfirm}
              className="flex-[2] bg-primary text-surface-base text-sm font-bold py-2.5 rounded-xl hover:bg-primary/95 transition-all shadow-lg shadow-primary/25 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Confirm
            </button>
          )}
        </div>
      </div>

      {showCalculator && (
        <ConsumptionCalculator 
          resourceName={cleanRichText(showCalculator.resource.resource_name)}
          resourceUnit={cleanRichText(showCalculator.resource.resource_unit)}
          boqUnit={cleanRichText(item.unit) || 'Unit'}
          onClose={() => setShowCalculator(null)}
          onConfirm={(rate) => {
            updateConsumptionRate(showCalculator.resource.id, rate);
            setShowCalculator(null);
          }}
        />
      )}

      {showTradePicker && (
        <TradePickerModal 
          tenantId={tenantId}
          onClose={() => setShowTradePicker(false)}
          onSelect={(trade) => {
            updateTrade(trade.trade_code);
            setShowTradePicker(false);
          }}
        />
      )}

      {showCombinePicker && (
        <TradePickerModal 
          tenantId={tenantId}
          onClose={() => setShowCombinePicker(false)}
          onSelect={(trade) => {
            combineTradeRecipe(trade.trade_code);
            setShowCombinePicker(false);
          }}
        />
      )}

      {showResourcePicker && (
        <ResourcePickerModal 
          tenantId={tenantId}
          onClose={() => setShowResourcePicker(false)}
          onSelect={(res) => {
            const tempId = `temp_library_${Date.now()}`;
            const newResource: BOQResource = {
              id: tempId,
              resource_type: res.type as any || 'material',
              resource_name: res.name,
              resource_unit: res.unit,
              resource_code: res.code || '',
              consumption_rate: 0,
              waste_factor_pct: 0,
              is_manual: true,
              source_trade_code: item.trade_code || null
            };
            setLocalResources(prev => [...prev, newResource]);
            setShowResourcePicker(false);
          }}
        />
      )}
    </div>
  );
}
