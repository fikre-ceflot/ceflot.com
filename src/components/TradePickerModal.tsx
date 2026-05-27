import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Search, 
  ChevronRight, 
  Package, 
  Globe, 
  Building2, 
  Check, 
  Plus, 
  Trash2, 
  Wrench, 
  Users, 
  Tag, 
  HelpCircle,
  Hash,
  Loader2,
  Lock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn, cleanRichText } from '../lib/utils';
import { TRADE_GROUPS, getGroupLabel, getGroupEmoji, RESOURCE_CATEGORIES } from '../lib/constants';

interface TradePickerModalProps {
  onClose: () => void;
  onSelect: (trade: any) => void;
  tenantId: string;
}

export function TradePickerModal({ onClose, onSelect, tenantId }: TradePickerModalProps) {
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Creative Interlinks / On-the-fly creation states
  const [isCreatingTrade, setIsCreatingTrade] = useState(false);
  const [tradeForm, setTradeForm] = useState({
    trade_code: '',
    trade_item: '',
    trade_group: 'CONC',
    boq_unit: 'm2',
    daily_output_qty: '10',
    labour_hours_per_unit: '1.5',
    team_setup: '',
    notes: ''
  });

  // Material / resources linking state
  const [linkedResources, setLinkedResources] = useState<any[]>([]);
  const [addingResType, setAddingResType] = useState<'material' | 'labour' | 'equipment'>('material');
  const [selectedResId, setSelectedResId] = useState<string>('');
  const [resConsumption, setResConsumption] = useState<string>('1');
  const [resWaste, setResWaste] = useState<string>('0');
  
  // Available database resources (to search and link)
  const [dbResources, setDbResources] = useState<any[]>([]);
  const [loadingRes, setLoadingRes] = useState(false);
  const [resSearchQuery, setResSearchQuery] = useState('');

  // Nested material creator state
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [materialForm, setMaterialForm] = useState({
    name: '',
    code: '',
    unit: 'pcs',
    category: 'Concrete Works',
    base_rate: '0'
  });

  useEffect(() => {
    loadTrades();
  }, []);

  useEffect(() => {
    if (isCreatingTrade) {
      loadDbResources();
    }
  }, [isCreatingTrade]);

  const loadTrades = async () => {
    setLoading(true);
    try {
      let query = supabase.from('trade_items')
        .select('*')
        .eq('is_active', true);
      
      if (tenantId && tenantId !== 'null') {
        query = query.or(`library_tier.eq.global,tenant_id.eq.${tenantId}`);
      } else if (!tenantId || tenantId === 'null') {
        query = query.eq('library_tier', 'global');
      }

      const { data, error } = await query.order('trade_code');

      if (error) throw error;
      setTrades(data || []);
      
      const categories = Array.from(new Set((data || []).map(t => t.trade_group || 'Uncategorized')));
      setExpandedCategories(new Set(categories.slice(0, 3)));
    } catch (err) {
      console.error('Error loading trades:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDbResources = async () => {
    setLoadingRes(true);
    try {
      const [mRes, lRes, eRes] = await Promise.all([
        supabase.from('materials').select('id, material_name, material_code, unit, category').eq('is_active', true).order('material_name'),
        supabase.from('labour_grades').select('id, title, grade_code, unit').eq('is_active', true).order('title'),
        supabase.from('equipment_items').select('id, name, equipment_code, unit').eq('is_active', true).order('name')
      ]);
      const mapped = [
        ...(mRes.data || []).map(r => ({ id: r.id, name: r.material_name, code: r.material_code, unit: r.unit, type: 'material', category: r.category })),
        ...(lRes.data || []).map(r => ({ id: r.id, name: r.title, code: r.grade_code, unit: r.unit || 'hr', type: 'labour', category: 'Labour' })),
        ...(eRes.data || []).map(r => ({ id: r.id, name: r.name, code: r.equipment_code, unit: r.unit || 'hr', type: 'equipment', category: 'Equipment' }))
      ];
      setDbResources(mapped);
    } catch (err) {
      console.error('Error loading db resources:', err);
    } finally {
      setLoadingRes(false);
    }
  };

  const groupedTrades = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const filtered = trades.filter(t => {
      const code = t.trade_code || '';
      const item = t.trade_item || '';
      const desc = t.description || '';
      return code.toLowerCase().includes(search.toLowerCase()) ||
             item.toLowerCase().includes(search.toLowerCase()) ||
             desc.toLowerCase().includes(search.toLowerCase());
    });

    const uniqueMap = new Map<string, any>();
    filtered.forEach(t => {
      const key = t.trade_code || '';
      const existing = uniqueMap.get(key);
      if (!existing || (existing.library_tier === 'global' && t.library_tier === 'company')) {
        uniqueMap.set(key, t);
      }
    });

    uniqueMap.forEach(t => {
      const cat = t.trade_group || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    });

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [trades, search]);

  const toggleCategory = (cat: string) => {
    const next = new Set(expandedCategories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setExpandedCategories(next);
  };

  const handleLinkResource = () => {
    if (!selectedResId) return;
    const res = dbResources.find(r => r.id === selectedResId && r.type === addingResType);
    if (!res) {
      alert('Resource not found in resource pool.');
      return;
    }

    if (linkedResources.some(lr => lr.resource_code === res.code && lr.resource_type === res.type)) {
      alert('This resource is already linked to this trade creation draft.');
      return;
    }

    const newItem = {
      resource_type: res.type,
      resource_name: res.name,
      resource_code: res.code,
      resource_unit: res.unit,
      consumption_rate: parseFloat(resConsumption) || 1,
      waste_factor_pct: parseFloat(resWaste) || 0
    };

    setLinkedResources([...linkedResources, newItem]);
    setSelectedResId('');
    setResConsumption('1');
    setResWaste('0');
  };

  const removeLinkedResource = (index: number) => {
    setLinkedResources(linkedResources.filter((_, i) => i !== index));
  };

  const handleSaveMaterial = async () => {
    if (!materialForm.name || !materialForm.code) {
      alert('Please fill in material Name and Code.');
      return;
    }
    try {
      const insertData = {
        material_name: materialForm.name,
        material_code: materialForm.code,
        unit: materialForm.unit,
        base_rate: parseFloat(materialForm.base_rate) || 0,
        category: materialForm.category || 'General Tools',
        category_name: materialForm.category || 'General Tools',
        tenant_id: tenantId,
        library_tier: 'company',
        is_active: true
      };

      const { data, error } = await supabase
        .from('materials')
        .insert([insertData])
        .select();

      if (error) throw error;
      
      const newMaterial = data?.[0];
      if (newMaterial) {
        const mappedRes = {
          id: newMaterial.id,
          name: newMaterial.material_name,
          code: newMaterial.material_code,
          unit: newMaterial.unit,
          type: 'material',
          category: newMaterial.category
        };
        
        // Append to the list so we select it or link it
        setDbResources(prev => [mappedRes, ...prev]);
        
        // Auto-link of newly created material
        const automatedLinkedRes = {
          resource_type: 'material',
          resource_name: newMaterial.material_name,
          resource_code: newMaterial.material_code,
          resource_unit: newMaterial.unit,
          consumption_rate: 1,
          waste_factor_pct: 0
        };
        setLinkedResources(prev => [...prev, automatedLinkedRes]);
      }

      setIsAddingMaterial(false);
      setMaterialForm({
        name: '',
        code: '',
        unit: 'pcs',
        category: 'Concrete Works',
        base_rate: '0'
      });
      alert('Material successfully created and immediately linked to trade recipe draft!');
    } catch (err: any) {
      alert('Error creating material: ' + err.message);
    }
  };

  const handleSaveTradeItemSubmit = async () => {
    if (!tradeForm.trade_code || !tradeForm.trade_item || !tradeForm.trade_group) {
      alert('Please fill in Code, Group and Item Name.');
      return;
    }
    try {
      const tier = 'company';
      const tid = tenantId;

      if (linkedResources.length > 0) {
        const rows = linkedResources.map(res => ({
          trade_code: tradeForm.trade_code,
          trade_group: tradeForm.trade_group,
          trade_item: tradeForm.trade_item,
          boq_unit: tradeForm.boq_unit,
          daily_output_qty: Number(tradeForm.daily_output_qty) || 0,
          labour_hours_per_unit: Number(tradeForm.labour_hours_per_unit) || 0,
          team_setup: tradeForm.team_setup,
          notes: tradeForm.notes,
          resource_type: res.resource_type,
          resource_name: res.resource_name,
          resource_code: res.resource_code || '',
          resource_unit: res.resource_unit,
          consumption_rate: Number(res.consumption_rate) || 0,
          waste_factor_pct: Number(res.waste_factor_pct || 0),
          tenant_id: tid,
          library_tier: tier,
          is_active: true,
          version: 1
        }));
        
        const { error } = await supabase.from('trade_items').insert(rows);
        if (error) throw error;
      } else {
        const insertData = {
          trade_code: tradeForm.trade_code,
          trade_group: tradeForm.trade_group,
          trade_item: tradeForm.trade_item,
          boq_unit: tradeForm.boq_unit,
          daily_output_qty: Number(tradeForm.daily_output_qty) || 0,
          labour_hours_per_unit: Number(tradeForm.labour_hours_per_unit) || 0,
          team_setup: tradeForm.team_setup,
          notes: tradeForm.notes,
          tenant_id: tid,
          library_tier: tier,
          is_active: true,
          version: 1
        };
        const { error } = await supabase.from('trade_items').insert([insertData]);
        if (error) throw error;
      }

      setIsCreatingTrade(false);
      await loadTrades();
      
      const newlyCreatedTrade = {
        trade_code: tradeForm.trade_code,
        trade_item: tradeForm.trade_item,
        trade_group: tradeForm.trade_group,
        library_tier: 'company',
        tenant_id: tid
      };
      
      onSelect(newlyCreatedTrade);
    } catch (err: any) {
      alert('Error creating trade item: ' + err.message);
    }
  };

  // Filter db resources for the selected tab & search
  const filteredResourcesForSelection = useMemo(() => {
    return dbResources.filter(r => {
      if (r.type !== addingResType) return false;
      const name = r.name || '';
      const code = r.code || '';
      return name.toLowerCase().includes(resSearchQuery.toLowerCase()) || 
             code.toLowerCase().includes(resSearchQuery.toLowerCase());
    });
  }, [dbResources, addingResType, resSearchQuery]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      {/* Outer wrapper */}
      <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden relative">
        
        {/* NESTED OVERLAY: Create Material Popover (Anti-confining, no closing trade creator window) */}
        {isAddingMaterial && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-[120] flex items-center justify-center p-6">
            <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between mb-4 border-b border-border-subtle pb-3">
                <div className="flex items-center gap-2 text-accent">
                  <Package className="w-5 h-5" />
                  <span className="font-bold text-sm uppercase tracking-wider">Quick Create Material Resource</span>
                </div>
                <button 
                  onClick={() => setIsAddingMaterial(false)} 
                  className="p-1 hover:bg-surface-2 rounded-lg text-ghost hover:text-main"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 text-left">
                <div>
                  <label className="text-[10px] font-bold text-ghost uppercase tracking-wider block mb-1">Material Code *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. MAT201" 
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-xs text-main outline-none focus:border-accent"
                    value={materialForm.code}
                    onChange={e => setMaterialForm({ ...materialForm, code: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-ghost uppercase tracking-wider block mb-1">Material Name *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Portland Cement Grade 42.5" 
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-xs text-main outline-none focus:border-accent"
                    value={materialForm.name}
                    onChange={e => setMaterialForm({ ...materialForm, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-ghost uppercase tracking-wider block mb-1">Unit</label>
                    <input 
                      type="text" 
                      placeholder="e.g. bag, m3, ton" 
                      className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-xs text-main outline-none focus:border-accent"
                      value={materialForm.unit}
                      onChange={e => setMaterialForm({ ...materialForm, unit: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-ghost uppercase tracking-wider block mb-1">Est. Unit Cost ($)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 15.5" 
                      className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-xs text-main outline-none focus:border-accent"
                      value={materialForm.base_rate}
                      onChange={e => setMaterialForm({ ...materialForm, base_rate: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-ghost uppercase tracking-wider block mb-1">Material Category</label>
                  <select 
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-xs text-main outline-none focus:border-accent"
                    value={materialForm.category}
                    onChange={e => setMaterialForm({ ...materialForm, category: e.target.value })}
                  >
                    {RESOURCE_CATEGORIES.material.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 border-t border-border-subtle pt-4">
                <button 
                  onClick={() => setIsAddingMaterial(false)}
                  className="px-4 py-2 text-xs font-bold text-ghost hover:text-main"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveMaterial}
                  className="px-4 py-2 bg-accent hover:bg-accent/85 text-white text-xs font-bold rounded-xl"
                >
                  Create & Link
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 1: Main Trade Item Selection List */}
        {!isCreatingTrade ? (
          <>
            <div className="p-6 border-b border-border-subtle flex items-center justify-between bg-surface-2/50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-main">Select Trade</h2>
                  <p className="text-xs text-ghost font-mono uppercase tracking-widest mt-0.5">Choose a trade to link with BOQ item</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCreatingTrade(true)}
                  className="px-3 py-1.5 bg-accent/10 border border-accent/20 hover:bg-accent/20 text-accent rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Quick Create Trade
                </button>
                <button onClick={onClose} className="p-2 hover:bg-surface-2 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-ghost" />
                </button>
              </div>
            </div>

            <div className="p-4 border-b border-border-subtle">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                <input 
                  type="text"
                  placeholder="Search trade code, item name, or description..."
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary transition-all text-main"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {loading ? (
                <div className="py-12 flex flex-col items-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-sm text-ghost">Loading trades...</span>
                </div>
              ) : groupedTrades.length === 0 ? (
                <div className="py-12 text-center">
                  <Package className="w-12 h-12 text-border-subtle mx-auto mb-3" />
                  <p className="text-sm text-ghost">No trades found matching your search</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {groupedTrades.map(([category, items]) => (
                    <div key={category} className="border border-border-subtle rounded-xl overflow-hidden bg-surface-2/20">
                      <button 
                        onClick={() => toggleCategory(category)}
                        className="w-full flex items-center justify-between p-3 hover:bg-surface-2/40 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <ChevronRight className={cn(
                            "w-4 h-4 text-primary transition-transform",
                            expandedCategories.has(category) && "rotate-90"
                          )} />
                          <span className="text-xl">{getGroupEmoji(category)}</span>
                          <span className="text-xs font-bold text-main uppercase tracking-wider">{cleanRichText(getGroupLabel(category))}</span>
                          <span className="text-[10px] text-ghost bg-surface-base px-2 py-0.5 rounded-full border border-border-subtle">
                            {items.length}
                          </span>
                        </div>
                      </button>
                      
                      {expandedCategories.has(category) && (
                        <div className="divide-y divide-border-subtle bg-surface-base/30 text-left">
                          {items.map(trade => (
                            <button
                              key={trade.id}
                              onClick={() => onSelect(trade)}
                              className="w-full p-3 flex items-start gap-3 hover:bg-primary/5 group transition-colors text-left"
                            >
                              <div className="mt-1">
                                {trade.library_tier === 'global' ? (
                                  <Globe className="w-3.5 h-3.5 text-accent" />
                                ) : (
                                  <Building2 className="w-3.5 h-3.5 text-primary" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                  <span className="text-xs font-mono font-bold text-primary">{cleanRichText(trade.trade_code)}</span>
                                  <span className={cn(
                                    "text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded",
                                    trade.library_tier === 'global' ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"
                                  )}>
                                    {trade.library_tier}
                                  </span>
                                </div>
                                <div className="text-sm font-bold text-main group-hover:text-primary transition-colors truncate">
                                  {cleanRichText(trade.trade_item)}
                                </div>
                                {trade.description && (
                                  <div className="text-[11px] text-ghost line-clamp-1 mt-0.5">
                                    {cleanRichText(trade.description)}
                                  </div>
                                )}
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity self-center">
                                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-surface-base">
                                  <Check className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border-subtle bg-surface-2/50 rounded-b-2xl flex justify-end">
              <button 
                onClick={onClose}
                className="px-4 py-2 text-sm font-bold text-ghost hover:text-main transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          /* VIEW 2: Dynamic Inline Create Trade Item View */
          <div className="flex flex-col h-full max-h-[90vh] text-left">
            <div className="p-6 border-b border-border-subtle flex items-center justify-between bg-surface-2/50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                  <Plus className="w-5 h-5 overflow-hidden" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-main">Quick Create Trade Item</h2>
                  <p className="text-xs text-ghost font-mono uppercase tracking-widest mt-0.5">Configure new enterprise trade standard</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCreatingTrade(false)} 
                className="p-2 hover:bg-surface-2 rounded-lg transition-colors"
                title="Return to selection"
              >
                <X className="w-5 h-5 text-ghost" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-left">
              {/* Basic Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-ghost uppercase tracking-wider block mb-1">Trade Code *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. PT-21" 
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-xs text-main outline-none focus:border-accent"
                    value={tradeForm.trade_code}
                    onChange={e => setTradeForm({ ...tradeForm, trade_code: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-ghost uppercase tracking-wider block mb-1">Item Title *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Gypsum Board Ceiling Partitioning" 
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-xs text-main outline-none focus:border-accent"
                    value={tradeForm.trade_item}
                    onChange={e => setTradeForm({ ...tradeForm, trade_item: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-ghost uppercase tracking-wider block mb-1">Trade Group Classification *</label>
                  <select 
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-xs text-main outline-none focus:border-accent"
                    value={tradeForm.trade_group}
                    onChange={e => setTradeForm({ ...tradeForm, trade_group: e.target.value })}
                  >
                    {TRADE_GROUPS.map(g => (
                      <option key={g.code} value={g.code}>{g.emoji} {g.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-ghost uppercase tracking-wider block mb-1">Typical BOQ Unit</label>
                  <input 
                    type="text" 
                    placeholder="e.g. m2, m3, linear meters" 
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-xs text-main outline-none focus:border-accent"
                    value={tradeForm.boq_unit}
                    onChange={e => setTradeForm({ ...tradeForm, boq_unit: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-ghost uppercase tracking-wider block mb-1">Standard Daily Output (Qty/Day)</label>
                  <input 
                    type="number" 
                    placeholder="10" 
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-xs text-main outline-none focus:border-accent"
                    value={tradeForm.daily_output_qty}
                    onChange={e => setTradeForm({ ...tradeForm, daily_output_qty: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-ghost uppercase tracking-wider block mb-1">Planned Labour Hours per Unit</label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="1.5" 
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-xs text-main outline-none focus:border-accent"
                    value={tradeForm.labour_hours_per_unit}
                    onChange={e => setTradeForm({ ...tradeForm, labour_hours_per_unit: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-ghost uppercase tracking-wider block mb-1">Recommended Gang/Team Setup</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 1 Lead Mason, 2 Helpers, 1 Mix Operator" 
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-xs text-main outline-none focus:border-accent"
                    value={tradeForm.team_setup}
                    onChange={e => setTradeForm({ ...tradeForm, team_setup: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-ghost uppercase tracking-wider block mb-1">Detailed Execution Notes</label>
                  <textarea 
                    rows={2}
                    placeholder="Specify special handling instructions, curing periods, or equipment tolerances here..." 
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-xs text-main outline-none focus:border-accent resize-none"
                    value={tradeForm.notes}
                    onChange={e => setTradeForm({ ...tradeForm, notes: e.target.value })}
                  />
                </div>
              </div>

              {/* Resource Recipe Sub-block */}
              <div className="bg-surface-2 rounded-2xl border border-border-subtle/75 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-accent" />
                    <span className="font-bold text-xs uppercase tracking-wider text-main">Trade Recipe Ingredients</span>
                  </div>
                  <span className="text-[10px] text-ghost bg-surface-base px-2 py-0.5 rounded border border-border-subtle font-mono">
                    {linkedResources.length} Linked
                  </span>
                </div>

                {/* Inline resource linking form */}
                <div className="bg-surface-base border border-border-subtle rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    
                    {/* Resource Type */}
                    <div className="flex-1 min-w-[120px]">
                      <label className="text-[9px] font-black uppercase text-ghost tracking-widest block mb-1">Type</label>
                      <select 
                        className="w-full bg-surface-2 border border-border-subtle rounded-lg p-2 text-xs text-main outline-none"
                        value={addingResType}
                        onChange={e => {
                          setAddingResType(e.target.value as any);
                          setSelectedResId('');
                        }}
                      >
                        <option value="material">🧱 Material</option>
                        <option value="labour">👷 Labour Grade</option>
                        <option value="equipment">🚜 Equipment</option>
                      </select>
                    </div>

                    {/* Resource database select + INTERLINK trigger */}
                    <div className="flex-[2] min-w-[200px]">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[9px] font-black uppercase text-ghost tracking-widest">Select Item</label>
                        {addingResType === 'material' && (
                          <button
                            onClick={() => setIsAddingMaterial(true)}
                            className="text-[9px] font-bold text-accent hover:underline flex items-center gap-0.5"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            Create Material
                          </button>
                        )}
                      </div>
                      <select 
                        className="w-full bg-surface-2 border border-border-subtle rounded-lg p-2 text-xs text-main outline-none"
                        value={selectedResId}
                        onChange={e => setSelectedResId(e.target.value)}
                      >
                        <option value="">Choose standard resource...</option>
                        {filteredResourcesForSelection.map(r => (
                          <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                        ))}
                      </select>
                    </div>

                    {/* Consumption Rate */}
                    <div className="w-[80px]">
                      <label className="text-[9px] font-black uppercase text-ghost tracking-widest block mb-1" title="Qty of resource required per trade unit">Factor</label>
                      <input 
                        type="number" 
                        step="0.001"
                        placeholder="1" 
                        className="w-full bg-surface-2 border border-border-subtle rounded-lg p-2 text-xs text-main outline-none"
                        value={resConsumption}
                        onChange={e => setResConsumption(e.target.value)}
                      />
                    </div>

                    {/* Waste Pct */}
                    <div className="w-[80px]">
                      <label className="text-[9px] font-black uppercase text-ghost tracking-widest block mb-1">Waste %</label>
                      <input 
                        type="number" 
                        placeholder="0" 
                        className="w-full bg-surface-2 border border-border-subtle rounded-lg p-2 text-xs text-main outline-none"
                        value={resWaste}
                        onChange={e => setResWaste(e.target.value)}
                      />
                    </div>

                    <div className="self-end pb-0.5">
                      <button
                        onClick={handleLinkResource}
                        className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold transition-all hover:bg-opacity-90 flex items-center gap-1"
                        disabled={!selectedResId}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Link
                      </button>
                    </div>

                  </div>
                </div>

                {/* Linked resources table list */}
                {linkedResources.length === 0 ? (
                  <p className="text-[10px] text-ghost/50 text-center py-4 uppercase tracking-widest font-mono">No resources linked to this recipe draft yet</p>
                ) : (
                  <div className="border border-border-subtle/50 rounded-xl overflow-hidden bg-surface-base">
                    <table className="w-full table-fixed divide-y divide-border-subtle/40">
                      <thead className="bg-surface-2/30 text-[9px] uppercase tracking-wider text-ghost">
                        <tr>
                          <th className="px-3 py-1.5 text-left w-[40%] font-bold">Resource</th>
                          <th className="px-3 py-1.5 text-left w-[15%] font-bold">Type</th>
                          <th className="px-3 py-1.5 text-center w-[15%] font-bold">Usage</th>
                          <th className="px-3 py-1.5 text-center w-[15%] font-bold">Waste</th>
                          <th className="px-3 py-1.5 text-center w-[15%] font-bold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle/30 text-xs">
                        {linkedResources.map((res, idx) => (
                          <tr key={idx} className="hover:bg-surface-2/10">
                            <td className="px-3 py-2 text-main font-bold truncate">
                              <span className="block truncate">{res.resource_name}</span>
                              <span className="block text-[9px] text-ghost font-mono">{res.resource_code}</span>
                            </td>
                            <td className="px-3 py-2 capitalize font-mono text-[10px] text-ghost/80 text-left">
                              {res.resource_type}
                            </td>
                            <td className="px-3 py-2 text-center font-bold font-mono">
                              {res.consumption_rate} <span className="text-[9px] font-normal text-ghost">{res.resource_unit}</span>
                            </td>
                            <td className="px-3 py-2 text-center font-mono">
                              {res.waste_factor_pct}%
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button 
                                onClick={() => removeLinkedResource(idx)}
                                className="p-1 hover:bg-danger/10 hover:text-danger rounded text-ghost"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* View 2 Footer */}
            <div className="p-4 border-t border-border-subtle bg-surface-2/50 rounded-b-2xl flex justify-between">
              <button 
                onClick={() => setIsCreatingTrade(false)}
                className="px-4 py-2 text-xs font-bold text-ghost hover:text-main"
              >
                Back to List
              </button>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsCreatingTrade(false)}
                  className="px-4 py-2 text-sm font-bold text-ghost hover:text-main"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveTradeItemSubmit}
                  className="px-6 py-2 bg-accent hover:bg-accent/85 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Save and Use Trade
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
