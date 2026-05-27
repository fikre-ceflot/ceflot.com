import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  HardHat, 
  Truck, 
  Package, 
  ChevronRight, 
  ArrowLeft,
  Search,
  Save,
  AlertCircle,
  TrendingUp,
  History,
  Info
} from 'lucide-react';
import { supabase } from './supabase';
import { Project, BOQItem } from './types';
import { cn, cleanRichText } from './utils';
import { recalculateBOQTreeProgress } from '../services/recalculateProgress';

interface DailyResourceLoggerProps {
  project: Project;
  onClose: () => void;
  initialDate?: string;
}

export function DailyResourceLogger({ project, onClose, initialDate }: DailyResourceLoggerProps) {
  const [step, setStep] = useState(1);
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [boqItems, setBoqItems] = useState<BOQItem[]>([]);
  const [labourGrades, setLabourGrades] = useState<any[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<any[]>([]);
  const [materialItems, setMaterialItems] = useState<any[]>([]);
  const [subcontractors, setSubcontractors] = useState<any[]>([]);
  const [subcontractorAssignments, setSubcontractorAssignments] = useState<any[]>([]);

  // Filtering & Tree States
  const [executionType, setExecutionType] = useState<'subcontractor' | 'daily_labor'>('subcontractor');
  const [selectedSubcontractorId, setSelectedSubcontractorId] = useState<string | null>(null);
  const [selectedLabourGradeId, setSelectedLabourGradeId] = useState<string | null>(null);
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [labourData, setLabourData] = useState<any[]>([]);
  const [equipmentData, setEquipmentData] = useState<any[]>([]);
  const [materialData, setMaterialData] = useState<any[]>([]);
  const [reportMetadata, setReportMetadata] = useState({
    weather: 'Clear',
    conditions: 'Normal',
    working_hours: 8,
    remarks: ''
  });

  useEffect(() => {
    loadReferenceData();
    // Load draft if exists
    const draft = localStorage.getItem(`daily_draft_${project.id}`);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.date === date) {
          setSelectedItems(parsed.selectedItems || []);
          setLabourData(parsed.labourData || []);
          setEquipmentData(parsed.equipmentData || []);
          setMaterialData(parsed.materialData || []);
          setReportMetadata(parsed.reportMetadata || reportMetadata);
        }
      } catch (e) {
        console.error('Error loading draft:', e);
      }
    }
  }, [project.id]);

  // Persist draft
  useEffect(() => {
    const draft = {
      date,
      selectedItems,
      labourData,
      equipmentData,
      materialData,
      reportMetadata
    };
    localStorage.setItem(`daily_draft_${project.id}`, JSON.stringify(draft));
  }, [selectedItems, labourData, equipmentData, materialData, reportMetadata, date]);

  // Check if a BOQ leaf item description/trade matches the labour grade title/keywords
  const isLabourGradeEligible = (item: BOQItem, gradeTitle: string) => {
    if (!gradeTitle) return true;
    const desc = (item.description || '').toLowerCase();
    const trade = (item.trade_name || '').toLowerCase();
    const code = (item.trade_code || '').toLowerCase();
    const titleLower = gradeTitle.toLowerCase();
    
    if (desc.includes(titleLower) || trade.includes(titleLower) || code.includes(titleLower)) return true;
    
    // Fuzzy matching on keyword parts, e.g. "Bricklayer" matches "brickwork"
    const keywords = titleLower.split(/\s+/).filter(w => w.length > 2);
    for (const kw of keywords) {
      if (desc.includes(kw) || trade.includes(kw) || code.includes(kw)) return true;
      const stem = kw.substring(0, Math.min(kw.length, 5));
      if (stem.length >= 3 && (desc.includes(stem) || trade.includes(stem) || code.includes(stem))) {
        return true;
      }
    }
    return false;
  };

  const visibleBOQTree = React.useMemo(() => {
    // Helper to check if an item is a leaf
    const isLeafNo = (itmNo: string) => {
      return !boqItems.some(other => other.item_no && other.item_no !== itmNo && other.item_no.startsWith(itmNo + '.'));
    };

    // Filter target leaf nodes matching selections & search
    const matchedLeaves = boqItems.filter(item => {
      if (!item.item_no) return false;
      if (!isLeafNo(item.item_no)) return false;

      // Filter by searching
      const matchSearch = !searchTerm ? true : (
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.item_no.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (!matchSearch) return false;

      // Filter by Subcontractor or Daily Labor Selection
      if (executionType === 'subcontractor') {
        if (!selectedSubcontractorId) return true; // Show all if none
        const hasAssign = subcontractorAssignments.some(assign => 
          assign.boq_item_id === item.id && assign.subcontractor_id === selectedSubcontractorId
        );
        return hasAssign;
      } else if (executionType === 'daily_labor') {
        if (!selectedLabourGradeId) return true; // Show all if none
        const grade = labourGrades.find(g => g.id === selectedLabourGradeId);
        if (!grade) return true;
        return isLabourGradeEligible(item, grade.title || grade.name || '');
      }
      return true;
    });

    // Collect all visible item_no's including their parents
    const visibleSet = new Set<string>();
    matchedLeaves.forEach(leaf => {
      const parts = (leaf.item_no || '').split('.');
      for (let i = 1; i <= parts.length; i++) {
        const parentNo = parts.slice(0, i).join('.');
        visibleSet.add(parentNo);
      }
    });

    return boqItems.filter(item => {
      return item.item_no && visibleSet.has(item.item_no);
    });
  }, [boqItems, searchTerm, executionType, selectedSubcontractorId, selectedLabourGradeId, subcontractorAssignments, labourGrades]);

  const renderedBOQTree = React.useMemo(() => {
    return visibleBOQTree.filter(item => {
      const parts = (item.item_no || '').split('.');
      // Check if any ancestor is collapsed
      for (let i = 1; i < parts.length; i++) {
        const ancestorNo = parts.slice(0, i).join('.');
        if (collapsedParents.has(ancestorNo)) {
          return false;
        }
      }
      return true;
    });
  }, [visibleBOQTree, collapsedParents]);

  async function loadReferenceData() {
    setLoading(true);
    try {
      const [
        { data: boq },
        { data: grades },
        { data: equip },
        { data: mats },
        { data: subs },
        { data: assigns }
      ] = await Promise.all([
        supabase.from('boq_items').select('*').eq('project_id', project.id).order('item_no'),
        supabase.from('labour_grades').select('*').order('name'),
        supabase.from('equipment_items').select('*').order('name'),
        supabase.from('materials').select('*').order('name'),
        supabase.from('subcontractors').select('*'),
        supabase.from('subcontractor_assignments').select('*').eq('project_id', project.id)
      ]);

      setBoqItems(boq || []);
      setLabourGrades(grades || []);
      setEquipmentItems(equip || []);
      setMaterialItems(mats || []);
      setSubcontractors(subs || []);
      setSubcontractorAssignments(assigns || []);
    } catch (e) {
      console.error('Error loading reference data:', e);
    } finally {
      setLoading(false);
    }
  }

  const handleSaveReport = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Upsert Daily Log Header based on project, tenant, and date
      const { data: log, error: logError } = await supabase
        .from('daily_progress')
        .upsert(
          {
            project_id: project.id,
            tenant_id: project.tenant_id,
            report_date: date,
            weather: reportMetadata.weather,
            site_conditions: reportMetadata.conditions,
            remarks: reportMetadata.remarks,
            working_status: 'Working',
            shift_hours: reportMetadata.working_hours,
            status: 'submitted',
            created_by: user.id,
            submitted_by: user.id,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'tenant_id,project_id,report_date' }
        )
        .select()
        .single();

      if (logError) throw logError;

      // 2. Clear existing child records to prevent duplicates on re-sync
      // We do this because the UI sends the full state every time
      await Promise.all([
        supabase.from('daily_activities').delete().eq('daily_progress_id', log.id),
        supabase.from('daily_labour').delete().eq('daily_progress_id', log.id),
        supabase.from('daily_equipment').delete().eq('daily_progress_id', log.id),
        supabase.from('daily_materials').delete().eq('daily_progress_id', log.id)
      ]);

      const { data: assignments } = await supabase
        .from('subcontractor_assignments')
        .select('boq_item_id, subcontractor_id')
        .eq('project_id', project.id);

      // 3. Insert Activities
      if (selectedItems.length > 0) {
        const { error: actError } = await supabase
          .from('daily_activities')
          .insert(selectedItems.map(item => {
            const matchingAssignment = assignments?.find(a => a.boq_item_id === item.id);
            const subId = item.subcontractor_id || matchingAssignment?.subcontractor_id || null;
            return {
              daily_progress_id: log.id,
              boq_item_id: item.id,
              progress_qty: item.quantity || 0,
              remarks: item.remarks,
              subcontractor_id: subId,
              tenant_id: project.tenant_id,
              submitted_by: user.id,
              created_at: new Date().toISOString()
            };
          }));
        if (actError) throw actError;
      }

      // 4. Insert Labour
      if (labourData.length > 0) {
        const { error: labError } = await supabase
          .from('daily_labour')
          .insert(labourData.map(l => ({
            daily_progress_id: log.id,
            labour_grade_id: l.grade_id,
            headcount: l.count,
            hours_worked: l.hours,
            cost_rate: l.rate,
            tenant_id: project.tenant_id,
            submitted_by: user.id,
            created_at: new Date().toISOString()
          })));
        if (labError) throw labError;
      }

      // 5. Insert Equipment
      if (equipmentData.length > 0) {
        const { error: eqError } = await supabase
          .from('daily_equipment')
          .insert(equipmentData.map(e => ({
            daily_progress_id: log.id,
            equipment_id: e.item_id,
            hours_worked: e.hours,
            fuel_litres: e.fuel,
            cost_rate: e.rate,
            tenant_id: project.tenant_id,
            submitted_by: user.id,
            created_at: new Date().toISOString()
          })));
        if (eqError) throw eqError;
      }

      // 6. Insert Materials
      if (materialData.length > 0) {
        const { error: matError } = await supabase
          .from('daily_materials')
          .insert(materialData.map(m => ({
            daily_progress_id: log.id,
            material_id: m.item_id,
            quantity: m.quantity,
            cost_rate: m.rate,
            tenant_id: project.tenant_id,
            submitted_by: user.id,
            created_at: new Date().toISOString()
          })));
        if (matError) throw matError;
      }

      // Recalculate BOQ tree progress
      await recalculateBOQTreeProgress(project.id, supabase);

      // Clear draft
      localStorage.removeItem(`daily_draft_${project.id}`);
      alert('Daily report submitted successfully!');
      onClose();
    } catch (e: any) {
      console.error('Submission failed:', e);
      alert('Error saving report: ' + (e.message || JSON.stringify(e)));
    } finally {
      setSaving(false);
    }
  };

  const filteredBOQ = boqItems.filter(item => {
    // Exclude parent elements
    const isParent = boqItems.some(other => other.item_no && other.item_no.startsWith((item.item_no || '') + '.'));
    if (isParent) return false;

    return (item.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
           (item.item_no || '').toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="fixed inset-0 bg-surface-base z-[100] flex flex-col md:inset-4 md:rounded-3xl md:shadow-2xl md:border md:border-border-subtle overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-500">
      {/* Header */}
      <header className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-surface-1 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-surface-2 rounded-xl transition-all">
            <ArrowLeft className="w-5 h-5 text-ghost" />
          </button>
          <div>
            <h2 className="text-sm font-black text-main uppercase tracking-widest">Daily Site Log</h2>
            <p className="text-[10px] text-ghost font-mono">{project.name} • {date}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary">
            Draft Auto-saved
          </div>
          <button 
            onClick={handleSaveReport}
            disabled={saving}
            className="btn btn-primary btn-sm rounded-xl px-6"
          >
            {saving ? 'Syncing...' : 'Sync Report'}
            <Save className="w-4 h-4 ml-2" />
          </button>
        </div>
      </header>

      {/* Progress Stepper */}
      <div className="px-6 py-3 bg-surface-2 border-b border-border-subtle flex items-center gap-2 overflow-x-auto shrink-0">
         {[
           { id: 1, label: 'Progress', icon: TrendingUp },
           { id: 2, label: 'Manpower', icon: HardHat },
           { id: 3, label: 'Machinery', icon: Truck },
           { id: 4, label: 'Materials', icon: Package },
           { id: 5, label: 'Review', icon: CheckCircle2 }
         ].map((s) => (
           <React.Fragment key={s.id}>
             <button 
               onClick={() => setStep(s.id)}
               className={cn(
                 "flex items-center gap-2 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all",
                 step === s.id ? "bg-primary text-white" : "text-ghost hover:bg-surface-3"
               )}
             >
               <s.icon className="w-4 h-4" />
               <span className="text-[10px] font-bold uppercase tracking-wider">{s.label}</span>
             </button>
             {s.id < 5 && <ChevronRight className="w-3 h-3 text-border-subtle shrink-0" />}
           </React.Fragment>
         ))}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 bg-surface-1">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Clock className="w-12 h-12 text-primary animate-spin-slow" />
              <p className="text-xs font-mono text-ghost uppercase tracking-widest">Loading Site Context...</p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto w-full">
            {step === 1 && (
              <div className="flex flex-col gap-6 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-main">Work Executed</h3>
                    <p className="text-xs text-ghost">Assign actor responsibility and record output</p>
                  </div>
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                    <input 
                      type="text" 
                      placeholder="Search items..." 
                      className="w-full bg-surface-base border border-border-subtle rounded-xl py-2 pl-10 pr-4 text-xs outline-none focus:border-primary transition-all"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                {/* Subcontractor vs Daily Basis Labor Selector Segment */}
                <div className="flex flex-col gap-3 p-4 bg-surface-2/40 border border-border-subtle/50 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-ghost tracking-widest leading-none">Execution Responsibility</span>
                  <div className="flex bg-surface-base p-1 rounded-xl border border-border-subtle/30">
                    <button
                      type="button"
                      className={cn("flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                        executionType === 'subcontractor' ? "bg-primary text-white shadow" : "text-ghost hover:text-main"
                      )}
                      onClick={() => { setExecutionType('subcontractor'); }}
                    >
                      Subcontractor
                    </button>
                    <button
                      type="button"
                      className={cn("flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                        executionType === 'daily_labor' ? "bg-primary text-white shadow" : "text-ghost hover:text-main"
                      )}
                      onClick={() => { setExecutionType('daily_labor'); }}
                    >
                      Daily Basis Labor
                    </button>
                  </div>

                  {executionType === 'subcontractor' ? (
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[9px] font-black uppercase text-primary/85 tracking-widest">Select Subcontractor</label>
                      <div className="flex gap-2 overflow-x-auto pb-1.5 no-scrollbar">
                        {subcontractors.map(sub => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => setSelectedSubcontractorId(selectedSubcontractorId === sub.id ? null : sub.id)}
                            className={cn("px-4 py-2 text-[10px] font-bold rounded-xl border transition-all whitespace-nowrap",
                              selectedSubcontractorId === sub.id
                                ? "bg-primary text-white border-primary font-black shadow-md shadow-primary/10"
                                : "bg-surface-base border-border-subtle text-ghost hover:text-main hover:border-ghost"
                            )}
                          >
                            {cleanRichText(sub.company_name || sub.name)}
                          </button>
                        ))}
                        {subcontractors.length === 0 && (
                          <span className="text-[10px] text-ghost italic">No active subcontractors available</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[9px] font-black uppercase text-primary/85 tracking-widest">Select Daily Labor Grade</label>
                      <div className="flex gap-2 overflow-x-auto pb-1.5 no-scrollbar">
                        {labourGrades.map(lg => (
                          <button
                            key={lg.id}
                            type="button"
                            onClick={() => setSelectedLabourGradeId(selectedLabourGradeId === lg.id ? null : lg.id)}
                            className={cn("px-4 py-2 text-[10px] font-bold rounded-xl border transition-all whitespace-nowrap",
                              selectedLabourGradeId === lg.id
                                ? "bg-primary text-white border-primary font-black shadow-md shadow-primary/10"
                                : "bg-surface-base border-border-subtle text-ghost hover:text-main hover:border-ghost"
                            )}
                          >
                            {cleanRichText(lg.title || lg.name)}
                          </button>
                        ))}
                        {labourGrades.length === 0 && (
                          <span className="text-[10px] text-ghost italic">No labour grades available</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 bg-surface-2/10 p-2 rounded-2xl border border-border-subtle/40">
                  {renderedBOQTree.map(item => {
                    const level = (item.item_no || '').split('.').length - 1;
                    const hasChildren = boqItems.some(other => other.item_no && other.item_no !== item.item_no && other.item_no.startsWith(item.item_no + '.'));
                    const isCollapsed = collapsedParents.has(item.item_no || '');

                    if (hasChildren) {
                      return (
                        <div 
                          key={item.id} 
                          style={{ paddingLeft: `${level * 14}px` }}
                          onClick={() => {
                            const next = new Set(collapsedParents);
                            if (next.has(item.item_no || '')) {
                              next.delete(item.item_no || '');
                            } else {
                              next.add(item.item_no || '');
                            }
                            setCollapsedParents(next);
                          }}
                          className="flex items-center gap-2 py-2.5 px-3 bg-surface-base border border-border-subtle/30 rounded-xl cursor-pointer select-none hover:bg-surface-3 transition-colors shrink-0 my-0.5"
                        >
                          <div className="w-5 h-5 flex items-center justify-center text-primary/75 bg-primary/5 rounded shrink-0">
                            <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", !isCollapsed && "rotate-90")} />
                          </div>
                          <span className="text-[10px] font-mono font-black text-accent">{item.item_no}</span>
                          <span className="text-[11px] font-black text-main leading-none uppercase tracking-tight truncate max-w-[180px] sm:max-w-[400px]">{cleanRichText(item.description)}</span>
                          
                          <div className="ml-auto flex items-center gap-1.5 shrink-0">
                            <span className={cn(
                              "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border",
                              (item.progress_pct || 0) >= 100 
                                ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" 
                                : (item.progress_pct || 0) > 0 
                                  ? "text-amber-500 bg-amber-500/10 border-amber-500/20" 
                                  : "text-ghost bg-surface-2 border-border-subtle/35"
                            )}>
                              {Math.round(item.progress_pct || 0)}%
                            </span>
                          </div>
                        </div>
                      );
                    }

                    // Leaf node
                    const isSelected = selectedItems.find(i => i.id === item.id);
                    return (
                      <div 
                        key={item.id}
                        style={{ paddingLeft: `${level * 14}px` }}
                        className={cn(
                          "p-4 rounded-xl border-2 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 my-1",
                          isSelected ? "bg-primary/5 border-primary" : "bg-surface-base border-border-subtle hover:border-ghost"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-[10px] font-mono text-primary font-bold">{item.item_no}</span>
                            <span className="w-1 h-1 rounded-full bg-border-subtle" />
                            <span className="text-[10px] text-ghost italic">{cleanRichText(item.unit)}</span>
                            {item.actual_qty > 0 && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-border-subtle" />
                                <span className="text-[10px] text-success font-bold">Total to date: {item.actual_qty.toLocaleString()}</span>
                              </>
                            )}
                            {selectedSubcontractorId && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-border-subtle" />
                                <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase rounded">Matched Spec</span>
                              </>
                            )}
                            {selectedLabourGradeId && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-border-subtle" />
                                <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase rounded">Matched Spec</span>
                              </>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-main leading-tight">{cleanRichText(item.description)}</h4>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {isSelected ? (
                            <div className="flex items-center gap-2 animate-in zoom-in-95 duration-200">
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-black text-primary uppercase px-1">Today's Qty</label>
                                <input 
                                  type="number" 
                                  className="w-24 bg-white border border-primary rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                                  placeholder="0.00"
                                  value={isSelected.quantity}
                                  onChange={(e) => {
                                    const qty = parseFloat(e.target.value);
                                    setSelectedItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: qty } : i));
                                  }}
                                />
                              </div>
                              <select 
                                className="bg-white border border-primary rounded-lg px-2 py-1.5 text-[10px] font-bold text-primary outline-none mt-4"
                                value={isSelected.subcontractor_id || ''}
                                onChange={(e) => {
                                  setSelectedItems(prev => prev.map(i => i.id === item.id ? { ...i, subcontractor_id: e.target.value } : i));
                                }}
                              >
                                <option value="">Main Labour</option>
                                {subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                              </select>
                              <button 
                                onClick={() => setSelectedItems(prev => prev.filter(i => i.id !== item.id))}
                                className="p-2 text-ghost hover:text-danger mt-4"
                              >
                                <AlertCircle className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => {
                                const initialSubId = executionType === 'subcontractor' ? selectedSubcontractorId : null;
                                setSelectedItems(prev => [...prev, { id: item.id, quantity: 0, remarks: '', subcontractor_id: initialSubId }]);
                              }}
                              className="px-4 py-2 rounded-xl bg-surface-2 border border-border-subtle text-[10px] font-bold uppercase tracking-wider text-ghost hover:border-primary hover:text-primary transition-all"
                            >
                              Add Progress
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {renderedBOQTree.length === 0 && (
                    <div className="py-20 text-center bg-surface-base border border-dashed border-border-subtle rounded-3xl">
                      <p className="text-[10px] text-ghost italic">No items found matching "{searchTerm}" for this responsibility</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col gap-6 animate-in fade-in duration-500">
                <div>
                  <h3 className="text-lg font-bold text-main">Labour Breakdown</h3>
                  <p className="text-xs text-ghost">Input headcount and working hours for each trade</p>
                </div>

                <div className="bg-surface-base border border-border-subtle rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-2 border-b border-border-subtle">
                        <th className="px-4 py-3 text-[10px] font-bold text-ghost uppercase tracking-wider">Classification</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-ghost uppercase tracking-wider text-center">Count</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-ghost uppercase tracking-wider text-center">Hours</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-ghost uppercase tracking-wider text-right">Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {labourGrades.map(grade => {
                        const data = labourData.find(l => l.grade_id === grade.id) || { count: 0, hours: 8, rate: grade.standard_rate };
                        return (
                          <tr key={grade.id}>
                            <td className="px-4 py-4">
                              <div className="text-xs font-bold text-main">{grade.name}</div>
                              <div className="text-[10px] text-ghost">{grade.category}</div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <input 
                                type="number" 
                                className="w-16 bg-surface-1 border border-border-subtle rounded px-2 py-1 text-xs text-main text-center outline-none focus:border-primary"
                                value={data.count}
                                onChange={(e) => {
                                  const count = parseInt(e.target.value);
                                  setLabourData(prev => {
                                    const filtered = prev.filter(l => l.grade_id !== grade.id);
                                    if (count > 0) return [...filtered, { ...data, grade_id: grade.id, count }];
                                    return filtered;
                                  });
                                }}
                              />
                            </td>
                            <td className="px-4 py-4 text-center">
                              <input 
                                type="number" 
                                className="w-16 bg-surface-1 border border-border-subtle rounded px-2 py-1 text-xs text-main text-center outline-none focus:border-primary"
                                value={data.hours}
                                onChange={(e) => {
                                  const hours = parseFloat(e.target.value);
                                  setLabourData(prev => prev.map(l => l.grade_id === grade.id ? { ...l, hours } : l));
                                }}
                                disabled={data.count === 0}
                              />
                            </td>
                            <td className="px-4 py-4 text-right text-xs font-mono text-ghost">
                              ${grade.standard_rate}/hr
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col gap-6 animate-in fade-in duration-500">
                <div>
                  <h3 className="text-lg font-bold text-main">Machinery & Plant</h3>
                  <p className="text-xs text-ghost">Log equipment utilization and fuel consumption</p>
                </div>
                <div className="bg-surface-base border border-border-subtle rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-2 border-b border-border-subtle">
                        <th className="px-4 py-3 text-[10px] font-bold text-ghost uppercase tracking-wider">Equipment</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-ghost uppercase tracking-wider text-center">Hours</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-ghost uppercase tracking-wider text-center">Fuel (L)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {equipmentItems.map(item => {
                        const data = equipmentData.find(e => e.item_id === item.id) || { hours: 0, fuel: 0, rate: item.standard_rate || 0 };
                        return (
                          <tr key={item.id}>
                            <td className="px-4 py-4">
                              <div className="text-xs font-bold text-main">{item.name}</div>
                              <div className="text-[10px] text-ghost">{item.category}</div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <input 
                                type="number" 
                                className="w-16 bg-surface-1 border border-border-subtle rounded px-2 py-1 text-xs text-main text-center outline-none focus:border-primary"
                                value={data.hours}
                                onChange={(e) => {
                                  const hours = parseFloat(e.target.value);
                                  setEquipmentData(prev => {
                                    const filtered = prev.filter(ele => ele.item_id !== item.id);
                                    if (hours > 0) return [...filtered, { ...data, item_id: item.id, hours }];
                                    return filtered;
                                  });
                                }}
                              />
                            </td>
                            <td className="px-4 py-4 text-center">
                              <input 
                                type="number" 
                                className="w-16 bg-surface-1 border border-border-subtle rounded px-2 py-1 text-xs text-main text-center outline-none focus:border-primary"
                                value={data.fuel}
                                onChange={(e) => {
                                  const fuel = parseFloat(e.target.value);
                                  setEquipmentData(prev => prev.map(ele => ele.item_id === item.id ? { ...ele, fuel } : ele));
                                }}
                                disabled={data.hours === 0}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="flex flex-col gap-6 animate-in fade-in duration-500">
                <div>
                  <h3 className="text-lg font-bold text-main">Material Consumption</h3>
                  <p className="text-xs text-ghost">Log quantities of materials used from site stock</p>
                </div>
                <div className="bg-surface-base border border-border-subtle rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-2 border-b border-border-subtle">
                        <th className="px-4 py-3 text-[10px] font-bold text-ghost uppercase tracking-wider">Material</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-ghost uppercase tracking-wider text-right">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {materialItems.map(item => {
                        const data = materialData.find(m => m.item_id === item.id) || { quantity: 0, rate: item.unit_price || 0 };
                        return (
                          <tr key={item.id}>
                            <td className="px-4 py-4">
                              <div className="text-xs font-bold text-main">{item.material_name}</div>
                              <div className="text-[10px] text-ghost">{item.unit}</div>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <input 
                                  type="number" 
                                  className="w-24 bg-surface-1 border border-border-subtle rounded px-2 py-1 text-xs text-main text-right outline-none focus:border-primary"
                                  placeholder="0.00"
                                  value={data.quantity || ''}
                                  onChange={(e) => {
                                    const quantity = parseFloat(e.target.value);
                                    setMaterialData(prev => {
                                      const filtered = prev.filter(ele => ele.item_id !== item.id);
                                      if (quantity > 0) return [...filtered, { ...data, item_id: item.id, quantity }];
                                      return filtered;
                                    });
                                  }}
                                />
                                <span className="text-[10px] text-ghost w-8">{cleanRichText(item.unit)}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="flex flex-col gap-8 animate-in fade-in duration-500">
                <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                    <History className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-primary">Ready to Sync with Headquarters</h3>
                    <p className="text-xs text-primary/70 leading-relaxed mt-1">
                      Review your daily totals below. Once submitted, the data will be routed to the Project Manager for valuation and cost integration.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-ghost tracking-widest px-2">Site Conditions</h4>
                    <div className="bg-surface-base border border-border-subtle rounded-2xl p-4 space-y-4">
                       <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-ghost uppercase">Weather Forecast</label>
                          <select 
                            className="w-full bg-surface-1 border border-border-subtle rounded-xl px-3 py-2 text-xs text-main outline-none focus:border-primary"
                            value={reportMetadata.weather}
                            onChange={(e) => setReportMetadata(prev => ({ ...prev, weather: e.target.value }))}
                          >
                             <option>Clear</option>
                             <option>Rainy</option>
                             <option>Overcast</option>
                             <option>Extreme Heat</option>
                             <option>Windy</option>
                          </select>
                       </div>
                       <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-ghost uppercase">Site Remarks / Obstructions</label>
                          <textarea 
                            className="w-full bg-surface-1 border border-border-subtle rounded-xl px-3 py-2 text-xs text-main outline-none focus:border-primary min-h-[100px]"
                            placeholder="Detail any site delays, accidents or special observations..."
                            value={reportMetadata.remarks}
                            onChange={(e) => setReportMetadata(prev => ({ ...prev, remarks: e.target.value }))}
                          />
                       </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-ghost tracking-widest px-2">Daily Summary</h4>
                    <div className="bg-surface-base border border-border-subtle rounded-2xl p-4 space-y-3">
                       <div className="flex flex-col gap-2 py-2 border-b border-border-subtle/50">
                          <span className="text-xs text-ghost">Project Execution List</span>
                          {selectedItems.map(item => {
                            const boq = boqItems.find(b => b.id === item.id);
                            return (
                              <div key={item.id} className="flex items-center justify-between">
                                <span className="text-[11px] font-medium text-main truncate max-w-[200px]">{cleanRichText(boq?.description)}</span>
                                <span className="text-[11px] font-black text-primary">{item.quantity} {cleanRichText(boq?.unit)}</span>
                              </div>
                            );
                          })}
                       </div>
                       <div className="flex items-center justify-between py-2 border-b border-border-subtle/50">
                          <span className="text-xs text-ghost">Total Manpower</span>
                          <span className="text-xs font-bold text-main">{labourData.reduce((acc, curr) => acc + curr.count, 0)}</span>
                       </div>
                       <div className="flex items-center justify-between py-2 border-b border-border-subtle/50">
                          <span className="text-xs text-ghost">Machinery Hours</span>
                          <span className="text-xs font-bold text-main">{equipmentData.reduce((acc, curr) => acc + curr.hours, 0)}h</span>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Mobile Actions Overlay */}
      <footer className="px-6 py-4 bg-surface-2 border-t border-border-subtle flex items-center justify-between md:hidden shrink-0">
        <button 
          onClick={() => step > 1 && setStep(step - 1)}
          className={cn("btn btn-secondary btn-sm rounded-xl", step === 1 && "opacity-20")}
        >
          Previous
        </button>
        <div className="flex items-center gap-1.5">
           {[1,2,3,4,5].map(i => (
             <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-all", step === i ? "bg-primary w-4" : "bg-ghost")} />
           ))}
        </div>
        <button 
          onClick={() => step < 5 ? setStep(step + 1) : handleSaveReport()}
          className="btn btn-primary btn-sm rounded-xl"
        >
          {step === 5 ? 'Sync' : 'Next'}
        </button>
      </footer>
    </div>
  );
}
