import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, ChevronRight, Package, Globe, Building2, Check, Users, Wrench, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn, cleanRichText } from '../lib/utils';

type ResourceTab = 'all' | 'material' | 'labour' | 'equipment' | 'vehicle';

interface ResourcePickerModalProps {
  onClose: () => void;
  onSelect: (resource: any) => void;
  tenantId: string;
}

export function ResourcePickerModal({ onClose, onSelect, tenantId }: ResourcePickerModalProps) {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<ResourceTab>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    setLoading(true);
    try {
      // Fetch from all relevant tables
      const [materialsRes, labourRes, equipmentRes, vehiclesRes] = await Promise.all([
        supabase.from('materials').select('*').eq('is_active', true),
        supabase.from('labour_grades').select('*').eq('is_active', true),
        supabase.from('equipment_items').select('*').eq('is_active', true),
        supabase.from('vehicles').select('*').eq('is_active', true)
      ]);

      const normalized: any[] = [];

      if (materialsRes.data) {
        normalized.push(...materialsRes.data.map(m => ({
          id: m.id,
          name: cleanRichText(m.material_name),
          code: cleanRichText(m.material_code),
          unit: cleanRichText(m.unit),
          rate: m.base_rate || 0,
          type: 'material',
          category: cleanRichText(m.category) || 'General Materials',
          library_tier: m.library_tier,
          tenant_id: m.tenant_id
        })));
      }

      if (labourRes.data) {
        normalized.push(...labourRes.data.map(l => ({
          id: l.id,
          name: cleanRichText(l.title),
          code: cleanRichText(l.grade_code),
          unit: 'Day', 
          rate: l.base_rate || 0,
          type: 'labour',
          category: cleanRichText(l.category) || 'Labour Grades',
          library_tier: l.library_tier,
          tenant_id: l.tenant_id
        })));
      }

      if (equipmentRes.data) {
        normalized.push(...equipmentRes.data.map(e => ({
          id: e.id,
          name: cleanRichText(e.name),
          code: cleanRichText(e.equipment_code),
          unit: cleanRichText(e.unit) || 'Hr',
          rate: e.base_rate || 0,
          type: 'equipment',
          category: cleanRichText(e.category) || 'General Equipment',
          library_tier: e.library_tier,
          tenant_id: e.tenant_id
        })));
      }

      if (vehiclesRes.data) {
        normalized.push(...vehiclesRes.data.map(v => ({
          id: v.id,
          name: cleanRichText(v.name),
          code: cleanRichText(v.vehicle_code),
          unit: cleanRichText(v.unit) || 'Day',
          rate: v.base_rate || 0,
          type: 'vehicle',
          category: cleanRichText(v.category) || 'Vehicles',
          library_tier: v.library_tier,
          tenant_id: v.tenant_id
        })));
      }

      // Filter by tenantId if needed
      const filtered = normalized.filter(r => {
        if (!tenantId || tenantId === 'null') return r.library_tier === 'global';
        return r.library_tier === 'global' || r.tenant_id === tenantId;
      });

      setResources(filtered);
      
      // Expand categories with many items
      const categories = Array.from(new Set(filtered.map(r => `${r.type}:${r.category}`)));
      setExpandedCategories(new Set(categories.slice(0, 5)));
    } catch (err) {
      console.error('Error loading resources:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredResources = useMemo(() => {
    let result = resources;
    if (activeTab !== 'all') {
      result = result.filter(r => r.type === activeTab);
    }
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(r => 
        (r.name || '').toLowerCase().includes(s) || 
        (r.code || '').toLowerCase().includes(s) ||
        (r.category || '').toLowerCase().includes(s)
      );
    }
    return result;
  }, [resources, activeTab, search]);

  const groupedResources = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredResources.forEach(r => {
      const key = `${r.type}:${r.category}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredResources]);

  const toggleCategory = (cat: string) => {
    const next = new Set(expandedCategories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setExpandedCategories(next);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'material': return <Package className="w-4 h-4" />;
      case 'labour': return <Users className="w-4 h-4" />;
      case 'equipment': return <Wrench className="w-4 h-4" />;
      case 'vehicle': return <Truck className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 rounded-[3rem] overflow-hidden">
      <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-3xl max-h-[70vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-border-subtle flex items-center justify-between bg-surface-2/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-main">Library Resource Picker</h2>
              <p className="text-xs text-ghost font-mono uppercase tracking-widest mt-0.5">Select a resource from your library</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-2 rounded-lg transition-colors text-ghost hover:text-main">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-surface-base border-b border-border-subtle flex flex-col gap-4">
          <div className="flex items-center gap-2 p-1 bg-surface-2 rounded-xl w-fit border border-border-subtle">
            {(['all', 'material', 'labour', 'equipment', 'vehicle'] as ResourceTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider",
                  activeTab === tab 
                    ? "bg-primary text-surface-base shadow-lg" 
                    : "text-ghost hover:text-main"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
            <input 
              type="text"
              placeholder="Search by name, code or category..."
              className="w-full bg-surface-2 border border-border-subtle rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary transition-all text-main shadow-inner"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-surface-2/10">
          {loading ? (
            <div className="py-20 flex flex-col items-center gap-4 text-ghost">
              <div className="w-8 h-8 border-3 border-border-subtle border-t-primary rounded-full animate-spin" />
              <span className="text-sm font-medium">Scanning libraries...</span>
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-4 border border-border-subtle">
                <Search className="w-8 h-8 text-border-subtle" />
              </div>
              <p className="text-sm text-ghost font-medium">No matches found in your {activeTab === 'all' ? '' : activeTab} library</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {groupedResources.map(([catKey, items]) => {
                const [type, category] = catKey.split(':');
                return (
                  <div key={catKey} className="border border-border-subtle rounded-xl overflow-hidden bg-surface-base shadow-sm">
                    <button 
                      onClick={() => toggleCategory(catKey)}
                      className="w-full flex items-center justify-between p-3 hover:bg-surface-2/40 transition-colors bg-surface-2/10"
                    >
                      <div className="flex items-center gap-3">
                        <ChevronRight className={cn(
                          "w-4 h-4 text-primary transition-transform",
                          expandedCategories.has(catKey) && "rotate-90"
                        )} />
                        <div className="p-1.5 bg-surface-2 rounded-lg text-ghost">
                          {getTypeIcon(type)}
                        </div>
                        <div className="flex flex-col items-start leading-tight">
                          <span className="text-[10px] font-bold text-ghost uppercase tracking-wider">{type}</span>
                          <span className="text-sm font-bold text-main">{cleanRichText(category)}</span>
                        </div>
                        <span className="text-[10px] text-ghost bg-surface-2 px-2 py-0.5 rounded-full border border-border-subtle font-bold">
                          {items.length}
                        </span>
                      </div>
                    </button>
                    
                    {expandedCategories.has(catKey) && (
                      <div className="divide-y divide-border-subtle">
                        {items.map(res => (
                          <button
                            key={res.id}
                            onClick={() => onSelect(res)}
                            className="w-full p-4 flex items-center gap-4 hover:bg-primary/5 group transition-colors text-left"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-xs font-mono font-bold text-primary bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">
                                  {cleanRichText(res.code)}
                                </span>
                                <div className="flex items-center gap-2">
                                  {res.library_tier === 'global' ? (
                                    <Globe className="w-3.5 h-3.5 text-accent" />
                                  ) : (
                                    <Building2 className="w-3.5 h-3.5 text-primary" />
                                  )}
                                  <span className="text-[14px] font-mono font-bold text-main">
                                    {new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(res.rate)}
                                    <span className="text-[10px] text-ghost font-normal ml-1">/ {cleanRichText(res.unit)}</span>
                                  </span>
                                </div>
                              </div>
                              <div className="text-[15px] font-bold text-main group-hover:text-primary transition-colors truncate">
                                {cleanRichText(res.name)}
                              </div>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className={cn(
                                  "text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded",
                                  res.library_tier === 'global' ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"
                                )}>
                                  {res.library_tier} tier
                                </span>
                                <span className="text-[10px] text-dim font-medium uppercase tracking-wider">{cleanRichText(res.unit)}</span>
                              </div>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white shadow-lg shadow-primary/20">
                              <Check className="w-4 h-4" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border-subtle bg-surface-2/50 rounded-b-2xl flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 text-sm font-bold text-ghost hover:text-main hover:bg-surface-2 rounded-xl transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
