import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Users, 
  Package, 
  Truck, 
  Plus, 
  Trash2, 
  Save, 
  X,
  CheckCircle2,
  AlertCircle,
  Activity,
  Loader2,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { cn, cleanRichText } from '../lib/utils';
import { recalculateBOQTreeProgress } from '../services/recalculateProgress';

interface DailyResourceLoggerProps {
  dailyProgressId: string;
  tenantId: string;
  onClose: () => void;
  date: string;
}

export function DailyResourceLogger({ dailyProgressId, tenantId, onClose, date }: DailyResourceLoggerProps) {
  const [activeTab, setActiveTab] = useState<'labour' | 'equipment' | 'materials' | 'progress'>('labour');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);

  // Library Data
  const [labourGrades, setLabourGrades] = useState<any[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [boqItems, setBoqItems] = useState<any[]>([]);
  const [subcontractors, setSubcontractors] = useState<any[]>([]);

  // Daily Data
  const [dailyLabour, setDailyLabour] = useState<any[]>([]);
  const [dailyEquipment, setDailyEquipment] = useState<any[]>([]);
  const [dailyMaterials, setDailyMaterials] = useState<any[]>([]);
  const [dailyActivities, setDailyActivities] = useState<any[]>([]);

  useEffect(() => {
    loadLibraries();
    loadDailyData();
  }, [dailyProgressId]);

  // Draft Persistence Logic
  useEffect(() => {
    const draftKey = `draft_${dailyProgressId}`;
    const draft = localStorage.getItem(draftKey);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.labour?.length) setDailyLabour(parsed.labour);
        if (parsed.equipment?.length) setDailyEquipment(parsed.equipment);
        if (parsed.materials?.length) setDailyMaterials(parsed.materials);
        if (parsed.activities?.length) setDailyActivities(parsed.activities);
        setDraftRestored(true);
        setTimeout(() => setDraftRestored(false), 5000);
      } catch (e) {
        console.error('Failed to parse draft');
      }
    }
  }, [dailyProgressId]);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem(`draft_${dailyProgressId}`, JSON.stringify({
        labour: dailyLabour,
        equipment: dailyEquipment,
        materials: dailyMaterials,
        activities: dailyActivities
      }));
    }
  }, [dailyLabour, dailyEquipment, dailyMaterials, dailyActivities, loading]);

  async function loadLibraries() {
    const [labour, equip, mats, boq, subs] = await Promise.all([
      supabase.from('labour_grades').select('*').eq('is_active', true),
      supabase.from('equipment_items').select('*').eq('is_active', true),
      supabase.from('materials').select('*').eq('is_active', true),
      supabase.from('boq_items').select('id, description, unit, item_no').order('item_sequence'),
      supabase.from('subcontractors').select('id, company_name').eq('status', 'active')
    ]);

    setLabourGrades(labour.data || []);
    setEquipmentItems(equip.data || []);
    setMaterials(mats.data || []);
    setBoqItems(boq.data || []);
    setSubcontractors(subs.data || []);
  }

  async function loadDailyData() {
    setLoading(true);
    try {
      const [lab, eq, mat, act] = await Promise.all([
        supabase.from('daily_labour').select('*, labour_grades(title, unit)').eq('daily_progress_id', dailyProgressId),
        supabase.from('daily_equipment').select('*, equipment_items(name, unit)').eq('daily_progress_id', dailyProgressId),
        supabase.from('daily_materials').select('*, materials(material_name, unit)').eq('daily_progress_id', dailyProgressId),
        supabase.from('daily_activities').select('*, boq_items(description, unit)').eq('daily_progress_id', dailyProgressId)
      ]);

      setDailyLabour(lab.data || []);
      setDailyEquipment(eq.data || []);
      setDailyMaterials(mat.data || []);
      setDailyActivities(act.data || []);
    } finally {
      setLoading(false);
    }
  }

  const addItem = (type: typeof activeTab) => {
    if (type === 'labour') {
      setDailyLabour([...dailyLabour, { id: 'temp-' + Date.now(), labour_grade_id: '', count: 0, hours: 8 }]);
    } else if (type === 'equipment') {
      setDailyEquipment([...dailyEquipment, { id: 'temp-' + Date.now(), equipment_id: '', hours: 0, fuel_litres: 0 }]);
    } else if (type === 'materials') {
      setDailyMaterials([...dailyMaterials, { id: 'temp-' + Date.now(), material_id: '', quantity: 0 }]);
    } else if (type === 'progress') {
      setDailyActivities([...dailyActivities, { id: 'temp-' + Date.now(), boq_item_id: '', subcontractor_id: '', progress_qty: 0 }]);
    }
  };

  const removeItem = (type: typeof activeTab, id: string) => {
    if (type === 'labour') setDailyLabour(dailyLabour.filter(i => i.id !== id));
    if (type === 'equipment') setDailyEquipment(dailyEquipment.filter(i => i.id !== id));
    if (type === 'materials') setDailyMaterials(dailyMaterials.filter(i => i.id !== id));
    if (type === 'progress') setDailyActivities(dailyActivities.filter(i => i.id !== id));
  };

  const updateItem = (type: typeof activeTab, id: string, field: string, value: any) => {
    const setter = type === 'labour' ? setDailyLabour : 
                   type === 'equipment' ? setDailyEquipment : 
                   type === 'materials' ? setDailyMaterials : setDailyActivities;
    const data = type === 'labour' ? dailyLabour : 
                 type === 'equipment' ? dailyEquipment : 
                 type === 'materials' ? dailyMaterials : dailyActivities;

    setter(data.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const calculateTotalCost = () => {
    const labCost = dailyLabour.reduce((acc, item) => {
      const grade = labourGrades.find(g => g.id === item.labour_grade_id);
      return acc + (item.count * (item.hours / 8.0) * (grade?.base_rate || 0));
    }, 0);

    const equipCost = dailyEquipment.reduce((acc, item) => {
      const equip = equipmentItems.find(e => e.id === item.equipment_id);
      return acc + (item.hours * (equip?.base_rate || 0));
    }, 0);

    const matCost = dailyMaterials.reduce((acc, item) => {
      const mat = materials.find(m => m.id === item.material_id);
      return acc + (item.quantity * (mat?.base_rate || 0));
    }, 0);

    return labCost + equipCost + matCost;
  };

  async function handleSave() {
    setSaving(true);
    setSaveState('saving');
    setSaveError('');
    
    // Explicitly update draft before save attempt
    const draftKey = `draft_${dailyProgressId}`;
    localStorage.setItem(draftKey, JSON.stringify({
      labour: dailyLabour,
      equipment: dailyEquipment,
      materials: dailyMaterials,
      activities: dailyActivities
    }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      // Fetch the project_id for active subcontractor_assignments mapping
      const { data: progressRow } = await supabase
        .from('daily_progress')
        .select('project_id')
        .eq('id', dailyProgressId)
        .single();

      let assignments: any[] = [];
      if (progressRow?.project_id) {
        const { data } = await supabase
          .from('subcontractor_assignments')
          .select('boq_item_id, subcontractor_id')
          .eq('project_id', progressRow.project_id);
        assignments = data || [];
      }

      // 1. Clean existing
      await Promise.all([
        supabase.from('daily_labour').delete().eq('daily_progress_id', dailyProgressId),
        supabase.from('daily_equipment').delete().eq('daily_progress_id', dailyProgressId),
        supabase.from('daily_materials').delete().eq('daily_progress_id', dailyProgressId),
        supabase.from('daily_activities').delete().eq('daily_progress_id', dailyProgressId)
      ]);

      const labourToInsert = dailyLabour.filter(i => i.labour_grade_id).map(({ id, labour_grades, ...rest }) => ({ 
        daily_progress_id: dailyProgressId,
        tenant_id: tenantId,
        submitted_by: userId,
        created_at: new Date().toISOString(),
        labour_grade_id: rest.labour_grade_id,
        headcount: rest.count,
        hours_worked: rest.hours,
        remarks: rest.remarks
      }));
      
      const equipToInsert = dailyEquipment.filter(i => i.equipment_id).map(({ id, equipment_items, ...rest }) => ({ 
        daily_progress_id: dailyProgressId,
        tenant_id: tenantId,
        submitted_by: userId,
        created_at: new Date().toISOString(),
        equipment_id: rest.equipment_id,
        hours_worked: rest.hours,
        fuel_liters: rest.fuel_litres,
        remarks: rest.remarks
      }));

      const matToInsert = dailyMaterials.filter(i => i.material_id).map(({ id, materials, ...rest }) => ({ 
        daily_progress_id: dailyProgressId,
        tenant_id: tenantId,
        submitted_by: userId,
        created_at: new Date().toISOString(),
        material_id: rest.material_id,
        quantity_used: rest.quantity,
        remarks: rest.remarks
      }));

      const actToInsert = dailyActivities.filter(i => i.boq_item_id).map(({ id, boq_items, ...rest }) => {
        const matchingAssignment = assignments.find(a => a.boq_item_id === rest.boq_item_id);
        const subId = rest.subcontractor_id || matchingAssignment?.subcontractor_id || null;

        return { 
          daily_progress_id: dailyProgressId,
          tenant_id: tenantId,
          submitted_by: userId,
          created_at: new Date().toISOString(),
          boq_item_id: rest.boq_item_id,
          progress_qty: rest.progress_qty,
          subcontractor_id: subId,
          remarks: rest.remarks
        };
      });

      await Promise.all([
        labourToInsert.length > 0 && supabase.from('daily_labour').insert(labourToInsert),
        equipToInsert.length > 0 && supabase.from('daily_equipment').insert(equipToInsert),
        matToInsert.length > 0 && supabase.from('daily_materials').insert(matToInsert),
        actToInsert.length > 0 && supabase.from('daily_activities').insert(actToInsert)
      ]);

      if (progressRow?.project_id) {
        await recalculateBOQTreeProgress(progressRow.project_id, supabase);
      }

      localStorage.removeItem(draftKey);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 3000);
      loadDailyData();
    } catch (e: any) {
      console.error('Save error:', e);
      setSaveState('error');
      setSaveError('Connection lost — changes not saved. Check your internet and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 z-[90] animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Rollup Drawer */}
      <div className="fixed inset-y-0 right-0 w-[600px] max-w-full bg-surface-1 border-l border-border-subtle shadow-2xl z-[100] flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Banners */}
        {draftRestored && (
          <div className="bg-primary/95 text-white px-4 py-2 text-center text-xs font-bold animate-in slide-in-from-top duration-300 z-10">
             Draft restored for this report.
          </div>
        )}
        {saveState === 'saved' && (
          <div className="bg-emerald-500 text-white px-4 py-2 text-center text-xs font-bold animate-in slide-in-from-top duration-300 z-10">
             Daily resources saved successfully.
          </div>
        )}
        {saveState === 'error' && (
          <div className="bg-danger text-white px-4 py-3 flex items-center justify-between gap-4 animate-in slide-in-from-top duration-300 z-10">
             <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5" />
                <span className="text-xs font-bold">{saveError}</span>
             </div>
             <button onClick={() => setSaveState('idle')} className="p-1 hover:bg-white/20 rounded">
                <X className="w-4 h-4" />
             </button>
          </div>
        )}

        {/* Header */}
        <div className="p-5 border-b border-border-subtle flex flex-col gap-4 bg-surface-2/50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-ghost">LOG CONTROL PANEL</h2>
              <div className="text-base font-bold text-main mt-0.5">Daily Resource Allocation</div>
              <p className="text-[10px] font-mono text-primary font-bold uppercase tracking-widest mt-1">
                {new Date(date).toLocaleDateString(undefined, { dateStyle: 'full' })}
              </p>
            </div>
            
            <button 
              onClick={onClose} 
              className="w-8 h-8 rounded-full bg-surface-2 border border-border-subtle flex items-center justify-center hover:bg-surface-3 transition-colors text-dim hover:text-main"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between bg-surface-1 border border-border-subtle rounded-xl p-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-ghost uppercase tracking-widest">Est. Daily Cost</span>
              <span className="text-lg font-mono font-black text-primary">
                ${calculateTotalCost().toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <button 
              onClick={handleSave}
              disabled={saving || saveState === 'saving'}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:brightness-110 text-surface-base font-black text-xs uppercase tracking-wider rounded-lg transition-all disabled:opacity-50 min-w-[130px] justify-center shadow-lg shadow-primary/20"
            >
              {saveState === 'saving' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-surface-base" />
                  <span>Saving...</span>
                </>
              ) : saveState === 'saved' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Horizontal Navigation Tabs */}
        <div className="flex border-b border-border-subtle p-2 gap-1 bg-surface-2/30">
          <button 
            onClick={() => setActiveTab('labour')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all",
              activeTab === 'labour' 
                ? "bg-surface-1 text-primary border border-border-subtle shadow-sm font-black" 
                : "text-ghost hover:bg-surface-2 hover:text-main"
            )}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Labour</span>
          </button>
          <button 
            onClick={() => setActiveTab('equipment')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all",
              activeTab === 'equipment' 
                ? "bg-surface-1 text-primary border border-border-subtle shadow-sm font-black" 
                : "text-ghost hover:bg-surface-2 hover:text-main"
            )}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Equipment</span>
          </button>
          <button 
            onClick={() => setActiveTab('materials')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all",
              activeTab === 'materials' 
                ? "bg-surface-1 text-primary border border-border-subtle shadow-sm font-black" 
                : "text-ghost hover:bg-surface-2 hover:text-main"
            )}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Materials</span>
          </button>
          <button 
            onClick={() => setActiveTab('progress')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all",
              activeTab === 'progress' 
                ? "bg-surface-1 text-primary border border-border-subtle shadow-sm font-black" 
                : "text-ghost hover:bg-surface-2 hover:text-main"
            )}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Activities</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 bg-surface-base flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle/50">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-ghost">{activeTab} Entries</h3>
              <p className="text-[10px] text-ghost mt-0.5">Double check all logs before committing changes.</p>
            </div>
            <button 
              onClick={() => addItem(activeTab)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-primary text-[10px] font-black uppercase tracking-wider border border-border-subtle rounded-lg transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Row
            </button>
          </div>

          {loading ? (
            <div className="py-20 text-center text-ghost animate-pulse font-bold text-xs">Loading daily resources...</div>
          ) : (
            <div className="space-y-3">
              {activeTab === 'labour' && dailyLabour.map((item) => (
                <div key={item.id} className="bg-surface-1 border border-border-subtle rounded-xl p-3 flex items-center gap-3 animate-in slide-in-from-bottom duration-300">
                  <div className="flex-1 min-w-0">
                    <label className="text-[9px] font-black text-ghost uppercase tracking-wider mb-1 block">Labour Grade</label>
                    <select 
                      value={item.labour_grade_id}
                      onChange={e => updateItem('labour', item.id, 'labour_grade_id', e.target.value)}
                      className="w-full bg-surface-base border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-main font-semibold focus:border-primary outline-none"
                    >
                      <option value="">Select Grade...</option>
                      {labourGrades.map(g => <option key={g.id} value={g.id}>{cleanRichText(g.title)}</option>)}
                    </select>
                  </div>
                  <div className="w-20">
                    <label className="text-[9px] font-black text-ghost uppercase tracking-wider mb-1 block">Count</label>
                    <input 
                      type="number"
                      value={item.count}
                      onChange={e => updateItem('labour', item.id, 'count', parseInt(e.target.value) || 0)}
                      className="w-full bg-surface-base border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-main font-mono focus:border-primary outline-none text-center"
                    />
                  </div>
                  <div className="w-20">
                    <label className="text-[9px] font-black text-ghost uppercase tracking-wider mb-1 block">Hours</label>
                    <input 
                      type="number"
                      step="0.5"
                      value={item.hours}
                      onChange={e => updateItem('labour', item.id, 'hours', parseFloat(e.target.value) || 0)}
                      className="w-full bg-surface-base border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-main font-mono focus:border-primary outline-none text-center"
                    />
                  </div>
                  <button 
                    onClick={() => removeItem('labour', item.id)}
                    className="p-1.5 text-ghost hover:text-danger hover:bg-danger/5 rounded-lg mt-4 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {activeTab === 'equipment' && dailyEquipment.map((item) => (
                <div key={item.id} className="bg-surface-1 border border-border-subtle rounded-xl p-3 flex items-center gap-3 animate-in slide-in-from-bottom duration-300">
                  <div className="flex-1 min-w-0">
                    <label className="text-[9px] font-black text-ghost uppercase tracking-wider mb-1 block">Equipment Item</label>
                    <select 
                      value={item.equipment_id}
                      onChange={e => updateItem('equipment', item.id, 'equipment_id', e.target.value)}
                      className="w-full bg-surface-base border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-main font-semibold focus:border-primary outline-none"
                    >
                      <option value="">Select Equipment...</option>
                      {equipmentItems.map(e => <option key={e.id} value={e.id}>{cleanRichText(e.name)}</option>)}
                    </select>
                  </div>
                  <div className="w-20">
                    <label className="text-[9px] font-black text-ghost uppercase tracking-wider mb-1 block">Hours</label>
                    <input 
                      type="number"
                      step="0.5"
                      value={item.hours}
                      onChange={e => updateItem('equipment', item.id, 'hours', parseFloat(e.target.value) || 0)}
                      className="w-full bg-surface-base border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-main font-mono focus:border-primary outline-none text-center"
                    />
                  </div>
                  <div className="w-20">
                    <label className="text-[9px] font-black text-ghost uppercase tracking-wider mb-1 block">Fuel (L)</label>
                    <input 
                      type="number"
                      step="1"
                      value={item.fuel_litres}
                      onChange={e => updateItem('equipment', item.id, 'fuel_litres', parseFloat(e.target.value) || 0)}
                      className="w-full bg-surface-base border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-main font-mono focus:border-primary outline-none text-center"
                    />
                  </div>
                  <button 
                    onClick={() => removeItem('equipment', item.id)}
                    className="p-1.5 text-ghost hover:text-danger hover:bg-danger/5 rounded-lg mt-4 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {activeTab === 'materials' && dailyMaterials.map((item) => (
                <div key={item.id} className="bg-surface-1 border border-border-subtle rounded-xl p-3 flex items-center gap-3 animate-in slide-in-from-bottom duration-300">
                  <div className="flex-1 min-w-0">
                    <label className="text-[9px] font-black text-ghost uppercase tracking-wider mb-1 block">Material</label>
                    <select 
                      value={item.material_id}
                      onChange={e => updateItem('materials', item.id, 'material_id', e.target.value)}
                      className="w-full bg-surface-base border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-main font-semibold focus:border-primary outline-none"
                    >
                      <option value="">Select Material...</option>
                      {materials.map(m => <option key={m.id} value={m.id}>{cleanRichText(m.material_name)}</option>)}
                    </select>
                  </div>
                  <div className="w-28">
                    <label className="text-[9px] font-black text-ghost uppercase tracking-wider mb-1 block">Quantity Used</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={item.quantity}
                      onChange={e => updateItem('materials', item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-full bg-surface-base border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-main font-mono focus:border-primary outline-none text-center"
                    />
                  </div>
                  <button 
                    onClick={() => removeItem('materials', item.id)}
                    className="p-1.5 text-ghost hover:text-danger hover:bg-danger/5 rounded-lg mt-4 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {activeTab === 'progress' && dailyActivities.map((item) => (
                <div key={item.id} className="bg-surface-1 border border-border-subtle rounded-xl p-3 flex flex-col gap-3 animate-in slide-in-from-bottom duration-300 relative">
                  <div className="absolute right-2 top-2">
                    <button 
                      onClick={() => removeItem('progress', item.id)}
                      className="p-1 text-ghost hover:text-danger hover:bg-danger/5 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2.5">
                    <div>
                      <label className="text-[9px] font-black text-ghost uppercase tracking-wider mb-1 block">BOQ Activity</label>
                      <select 
                        value={item.boq_item_id}
                        onChange={e => updateItem('progress', item.id, 'boq_item_id', e.target.value)}
                        className="w-full bg-surface-base border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-main font-semibold focus:border-primary outline-none"
                      >
                        <option value="">Select Activity...</option>
                        {boqItems
                          .filter(b => !boqItems.some(other => other.item_no && other.item_no.startsWith((b.item_no || '') + '.')))
                          .map(b => <option key={b.id} value={b.id}>{(b.item_no ? b.item_no + ' : ' : '') + cleanRichText(b.description)}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-black text-ghost uppercase tracking-wider mb-1 block">Subcontractor</label>
                        <select 
                          value={item.subcontractor_id || ''}
                          onChange={e => updateItem('progress', item.id, 'subcontractor_id', e.target.value || null)}
                          className="w-full bg-surface-base border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-main font-semibold focus:border-primary outline-none"
                        >
                          <option value="">Self-Performed</option>
                          {subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-ghost uppercase tracking-wider mb-1 block">Qty Done</label>
                        <input 
                          type="number"
                          step="0.01"
                          value={item.progress_qty}
                          onChange={e => updateItem('progress', item.id, 'progress_qty', parseFloat(e.target.value) || 0)}
                          className="w-full bg-surface-base border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-main font-mono focus:border-primary outline-none text-center"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {((activeTab === 'labour' && dailyLabour.length === 0) || 
                (activeTab === 'equipment' && dailyEquipment.length === 0) || 
                (activeTab === 'materials' && dailyMaterials.length === 0) ||
                (activeTab === 'progress' && dailyActivities.length === 0)) && (
                <div className="py-20 border border-dashed border-border-subtle rounded-2xl text-center bg-surface-2/10">
                  <div className="text-ghost text-xs">No {activeTab} logged for this report.</div>
                  <button 
                    onClick={() => addItem(activeTab)}
                    className="text-primary text-[11px] font-black uppercase tracking-wider mt-2 hover:underline"
                  >
                    Add entry
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
