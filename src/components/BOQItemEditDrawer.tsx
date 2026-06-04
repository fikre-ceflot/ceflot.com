import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  X, 
  Save, 
  Loader2, 
  Plus, 
  Trash2, 
  CheckCircle, 
  Clock, 
  Briefcase, 
  Users, 
  Truck, 
  Package, 
  Calendar,
  CloudSun,
  FileText
} from 'lucide-react';
import { cn, cleanRichText } from '../lib/utils';
import { recalculateBOQTreeProgress } from '../services/recalculateProgress';

interface BOQItemEditDrawerProps {
  boqItem: any;
  project: any;
  tenantId: string;
  onClose: () => void;
  onSaveSuccess: () => void;
}

export function BOQItemEditDrawer({ boqItem, project, tenantId, onClose, onSaveSuccess }: BOQItemEditDrawerProps) {
  // Library Data
  const [subcontractors, setSubcontractors] = useState<any[]>([]);
  const [labourGrades, setLabourGrades] = useState<any[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [existingProgressRows, setExistingProgressRows] = useState<any[]>([]);

  // Selected Date / Master Row
  const [allReportDates, setAllReportDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [dailyProgressId, setDailyProgressId] = useState<string | null>(null);

  // States for selected report date
  const [progressQty, setProgressQty] = useState<number>(0);
  const [subcontractorId, setSubcontractorId] = useState<string>('');
  const [weather, setWeather] = useState<string>('Clear');
  const [remarks, setRemarks] = useState<string>('');
  const [status, setStatus] = useState<'draft' | 'submitted' | 'reviewed'>('submitted');

  // Utilized lists
  const [dailyLabour, setDailyLabour] = useState<any[]>([]);
  const [dailyEquipment, setDailyEquipment] = useState<any[]>([]);
  const [dailyMaterials, setDailyMaterials] = useState<any[]>([]);

  // UI States
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'details' | 'resources'>('details');

  // Width Resizing States
  const [width, setWidth] = useState<number>(540);
  const [isResizing, setIsResizing] = useState<boolean>(false);

  // Mouse move handlers for dragging resize edge
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(450, Math.min(window.innerWidth - 40, window.innerWidth - e.clientX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Load everything initial
  useEffect(() => {
    loadInitialData();
  }, [boqItem.id]);

  // Load specific details when selected date changes
  useEffect(() => {
    if (selectedDate) {
      loadDateData(selectedDate);
    }
  }, [selectedDate]);

  async function loadInitialData() {
    setLoading(true);
    setErrorMsg('');
    try {
      // Load autocomplete/libraries items
      const [subsRes, labRes, equipRes, matRes, progressAllRes, actForThisItemRes] = await Promise.all([
        supabase.from('subcontractors').select('id, company_name').eq('status', 'active'),
        supabase.from('labour_grades').select('*').eq('is_active', true),
        supabase.from('equipment_items').select('*').eq('is_active', true),
        supabase.from('materials').select('*').eq('is_active', true),
        supabase.from('daily_progress').select('id, report_date').eq('project_id', project.id).order('report_date', { ascending: false }),
        supabase.from('daily_activities').select('*, daily_progress!inner(report_date)').eq('boq_item_id', boqItem.id)
      ]);

      setSubcontractors(subsRes.data || []);
      setLabourGrades(labRes.data || []);
      setEquipmentItems(equipRes.data || []);
      setMaterials(matRes.data || []);
      
      const allDailyMaster = progressAllRes.data || [];
      setExistingProgressRows(allDailyMaster);

      // Collect all potential report dates (existing project progress dates + today if missing)
      const todayISO = new Date().toISOString().split('T')[0];
      const datesSet = new Set<string>();
      
      // Add existing master report dates
      allDailyMaster.forEach(p => datesSet.add(p.report_date));
      
      // Add dates from where actual activities have been reported
      (actForThisItemRes.data || []).forEach(act => {
        if (act.daily_progress?.report_date) {
          datesSet.add(act.daily_progress.report_date);
        }
      });

      // Default today
      datesSet.add(todayISO);

      const sortedDates = Array.from(datesSet).sort((a, b) => b.localeCompare(a));
      setAllReportDates(sortedDates);

      // If there are existing reported dates, default to the most recent one. Otherwise today.
      const hasActDate = (actForThisItemRes.data || [])[0]?.daily_progress?.report_date;
      const initialDate = hasActDate || sortedDates[0] || todayISO;
      setSelectedDate(initialDate);

    } catch (err: any) {
      console.error('Error loading drawer resources:', err);
      setErrorMsg('Failed to initialize drawer resources');
    } finally {
      setLoading(false);
    }
  }

  async function loadDateData(dateStr: string) {
    setLoading(true);
    setErrorMsg('');
    try {
      // 1. Check if a daily_progress model exists for this project + date
      const { data: progRow, error: pErr } = await supabase
        .from('daily_progress')
        .select('*')
        .eq('project_id', project.id)
        .eq('report_date', dateStr)
        .maybeSingle();

      if (progRow) {
        setDailyProgressId(progRow.id);
        setWeather(progRow.weather || 'Clear');
        setRemarks(progRow.remarks || '');
        setStatus(progRow.status || 'submitted');

        // Load specific details matching this day's progress report
        const [actRes, labRes, equipRes, matRes] = await Promise.all([
          supabase.from('daily_activities').select('*').eq('daily_progress_id', progRow.id).eq('boq_item_id', boqItem.id).maybeSingle(),
          supabase.from('daily_labour').select('*').eq('daily_progress_id', progRow.id),
          supabase.from('daily_equipment').select('*').eq('daily_progress_id', progRow.id),
          supabase.from('daily_materials').select('*').eq('daily_progress_id', progRow.id)
        ]);

        if (actRes.data) {
          setProgressQty(Number(actRes.data.progress_qty) || 0);
          setSubcontractorId(actRes.data.subcontractor_id || '');
        } else {
          setProgressQty(0);
          setSubcontractorId('');
        }

        setDailyLabour(labRes.data || []);
        setDailyEquipment(equipRes.data || []);
        setDailyMaterials(matRes.data || []);
      } else {
        // No daily report exists yet for this date, initialize clean state
        setDailyProgressId(null);
        setProgressQty(0);
        setSubcontractorId('');
        setWeather('Clear');
        setRemarks('');
        setStatus('submitted');
        setDailyLabour([]);
        setDailyEquipment([]);
        setDailyMaterials([]);
      }
    } catch (err: any) {
      console.error('Error loading report for selected date:', err);
      setErrorMsg('Failed to load logs for date: ' + dateStr);
    } finally {
      setLoading(false);
    }
  }

  const handleAddLabour = () => {
    setDailyLabour([
      ...dailyLabour, 
      { id: 'temp-' + Date.now(), labour_grade_id: '', count: 1, hours: 8 }
    ]);
  };

  const handleAddEquipment = () => {
    setDailyEquipment([
      ...dailyEquipment,
      { id: 'temp-' + Date.now(), equipment_id: '', hours: 8, fuel_litres: 0 }
    ]);
  };

  const handleAddMaterial = () => {
    setDailyMaterials([
      ...dailyMaterials,
      { id: 'temp-' + Date.now(), material_id: '', quantity: 0 }
    ]);
  };

  const handleRemoveLabour = (id: string) => {
    setDailyLabour(dailyLabour.filter(l => l.id !== id));
  };

  const handleRemoveEquipment = (id: string) => {
    setDailyEquipment(dailyEquipment.filter(e => e.id !== id));
  };

  const handleRemoveMaterial = (id: string) => {
    setDailyMaterials(dailyMaterials.filter(m => m.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date();

      // Step 1: Upsert daily progress entry
      const { data: progress, error: pErr } = await supabase
        .from('daily_progress')
        .upsert({
          ...(dailyProgressId ? { id: dailyProgressId } : {}),
          project_id: project.id,
          tenant_id: tenantId,
          report_date: selectedDate,
          weather: weather,
          remarks: remarks,
          status: status,
          submitted_by: user?.id || null,
          updated_at: now.toISOString(),
          ...(dailyProgressId ? {} : { created_at: now.toISOString() })
        }, { onConflict: 'tenant_id,project_id,report_date' })
        .select()
        .single();

      if (pErr) throw pErr;
      if (!progress) throw new Error('Failed to save parent progress record');

      const progressId = progress.id;

      // Step 2: Delete existing daily records to cleanly overwrite
      // We only delete daily_activities for this SPECIFIC boq item to avoid cleaning up other activity logs
      await Promise.all([
        supabase.from('daily_activities').delete().eq('daily_progress_id', progressId).eq('boq_item_id', boqItem.id),
        supabase.from('daily_labour').delete().eq('daily_progress_id', progressId),
        supabase.from('daily_equipment').delete().eq('daily_progress_id', progressId),
        supabase.from('daily_materials').delete().eq('daily_progress_id', progressId)
      ]);

      // Step 3: Insert updated records
      // 3.1. Insert daily activity achievement
      if (progressQty > 0 || subcontractorId) {
        const { error: actErr } = await supabase.from('daily_activities').insert({
          daily_progress_id: progressId,
          boq_item_id: boqItem.id,
          progress_qty: Number(progressQty),
          subcontractor_id: subcontractorId || null,
          tenant_id: tenantId
        });
        if (actErr) throw actErr;
      }

      // 3.2. Insert Labours
      const finalLabour = dailyLabour
        .filter(l => l.labour_grade_id)
        .map(l => ({
          daily_progress_id: progressId,
          labour_grade_id: l.labour_grade_id,
          count: Number(l.count) || 0,
          hours: Number(l.hours) || 0,
          tenant_id: tenantId
        }));
      if (finalLabour.length > 0) {
        const { error: labErr } = await supabase.from('daily_labour').insert(finalLabour);
        if (labErr) throw labErr;
      }

      // 3.3. Insert Equipment
      const finalEquipment = dailyEquipment
        .filter(e => e.equipment_id)
        .map(e => ({
          daily_progress_id: progressId,
          equipment_id: e.equipment_id,
          hours: Number(e.hours) || 0,
          fuel_litres: Number(e.fuel_litres) || 0,
          tenant_id: tenantId
        }));
      if (finalEquipment.length > 0) {
        const { error: equipErr } = await supabase.from('daily_equipment').insert(finalEquipment);
        if (equipErr) throw equipErr;
      }

      // 3.4. Insert Materials
      const finalMaterials = dailyMaterials
        .filter(m => m.material_id)
        .map(m => ({
          daily_progress_id: progressId,
          material_id: m.material_id,
          quantity: Number(m.quantity) || 0,
          tenant_id: tenantId
        }));
      if (finalMaterials.length > 0) {
        const { error: matErr } = await supabase.from('daily_materials').insert(finalMaterials);
        if (matErr) throw matErr;
      }

      // Recalculate tree values back-end logic
      await recalculateBOQTreeProgress(project.id, supabase);

      onSaveSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving daily report changes:', err);
      setErrorMsg(err.message || 'Failed to apply daily report edits');
    } finally {
      setSaving(false);
    }
  };

  const progressPctNum = boqItem.contract_qty > 0 ? ((boqItem.actual_qty || 0) / boqItem.contract_qty) * 100 : 0;

  return (
    <>
      {/* Non-blurred dynamic shade background overlay */}
      <div 
        className="fixed inset-0 bg-black/45 z-[60] animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Resizable and Draggable Side Drawer */}
      <div 
        className="fixed inset-y-0 right-0 bg-surface-1 border-l border-border-subtle shadow-2xl z-[70] flex flex-col animate-in slide-in-from-right duration-300"
        style={{ width: `${width}px` }}
      >
        {/* Resize Handle Drag Area */}
        <div 
          className={cn(
            "absolute inset-y-0 left-0 w-2 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-[80] flex items-center justify-center",
            isResizing && "bg-primary/40"
          )}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
          title="Drag left/right to resize this drawer"
        >
          <div className="w-0.5 h-8 rounded-full bg-ghost/30" />
        </div>
        
        {/* Header Section */}
        <div className="p-5 pl-7 border-b border-border-subtle flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="font-mono text-[10px] font-black text-accent bg-accent/10 border border-accent/20 px-2.5 py-0.5 rounded-full">
                {boqItem.item_no}
              </span>
              <span className="text-[10px] text-ghost font-black uppercase tracking-widest">
                {boqItem.section_group || 'General Section'}
              </span>
            </div>
            <h2 className="text-base font-black text-main leading-tight break-words">
              {cleanRichText(boqItem.description)}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-2 border border-border-subtle flex items-center justify-center hover:bg-surface-3 transition-colors shrink-0"
          >
            <X className="w-4 h-4 text-ghost" />
          </button>
        </div>

        {/* Info & Micro KPIs (Identical trade recipe look) */}
        <div className="px-6 pl-8 py-4 bg-surface-2/40 border-b border-border-subtle grid grid-cols-2 gap-4">
          <div className="bg-surface-base border border-border-subtle/70 rounded-xl p-3 shadow-sm flex flex-col justify-between">
            <span className="text-[9px] font-black uppercase tracking-wider text-ghost">Contract Allocation</span>
            <div className="text-sm font-bold text-main font-mono mt-1">
              {boqItem.contract_qty?.toLocaleString()} <span className="text-[10px] font-normal text-ghost">{cleanRichText(boqItem.unit)}</span>
            </div>
            <div className="text-[10px] text-ghost mt-0.5 font-mono">
              Rate: ${Number(boqItem.contract_rate || 0).toFixed(2)}
            </div>
          </div>

          <div className="bg-surface-base border border-border-subtle/70 rounded-xl p-3 shadow-sm flex flex-col justify-between">
            <span className="text-[9px] font-black uppercase tracking-wider text-ghost">Current Progress</span>
            <div className="text-sm font-semibold text-primary font-mono mt-1 flex items-baseline gap-1.5">
              <span>{Math.round(progressPctNum)}%</span>
              <span className="text-[10px] text-ghost font-normal">({(boqItem.actual_qty || 0).toLocaleString()} {cleanRichText(boqItem.unit)})</span>
            </div>
            <div className="w-full bg-surface-2 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, progressPctNum)}%` }} />
            </div>
          </div>
        </div>

        {/* Interactive Tabs Menu */}
        <div className="flex border-b border-border-subtle px-4 pl-7 bg-surface-1 items-center justify-between">
          <div className="flex">
            {(['details', 'resources'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "py-3 px-3.5 border-b-2 text-xs font-black uppercase tracking-wider select-none shrink-0 transition-colors",
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-ghost hover:text-main"
                )}
              >
                {tab === 'details' && <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Details</span>}
                {tab === 'resources' && <span className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Resource Registration</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Areas */}
        <div className="flex-1 overflow-y-auto p-5 pl-7 space-y-6">
          {errorMsg && (
            <div className="bg-rose-50 text-rose-600 border border-rose-100 p-3 rounded-xl text-xs flex items-center gap-2">
              <span className="font-extrabold uppercase shrink-0">Error:</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="py-24 text-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
              <span className="text-xs text-ghost font-black uppercase tracking-widest leading-none">Loading Report Details...</span>
            </div>
          ) : (
            <>
              {/* DATE SELECTION (Stays at the very top of each view for quick adjustments) */}
              <div className="bg-surface-2 border border-border-subtle p-3.5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-[11px] font-bold text-main uppercase tracking-widest">Select Report Date</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Select Dropdown of existing/active dates */}
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-surface-base border border-border-subtle rounded-xl px-3 py-1.5 text-xs font-mono font-black text-primary outline-none focus:border-primary transition-all shadow-sm"
                  >
                    {allReportDates.map(d => (
                      <option key={d} value={d}>
                        {new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </option>
                    ))}
                  </select>

                  {/* Manual input for custom Date creation */}
                  <input
                    type="date"
                    onChange={(e) => {
                      if (e.target.value) {
                        const newD = e.target.value;
                        if (!allReportDates.includes(newD)) {
                          setAllReportDates(prev => [newD, ...prev].sort((a,b) => b.localeCompare(a)));
                        }
                        setSelectedDate(newD);
                      }
                    }}
                    className="bg-surface-base border border-border-subtle rounded-xl px-2.5 py-1 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary h-8"
                  />
                </div>
              </div>

              {/* VIEW: DETAILS */}
              {activeTab === 'details' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* EXECUTION DETAILS */}
                  <div className="border border-border-subtle p-4 rounded-2xl bg-surface-base shadow-sm space-y-4">
                    <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
                      <CheckCircle className="w-4 h-4 text-accent shrink-0" />
                      <h4 className="text-[11px] font-black uppercase tracking-widest text-ghost">Execution achievement for this Date</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-ghost uppercase tracking-wider mb-1">Executed Quantity</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={progressQty || ''}
                            placeholder="0"
                            onChange={(e) => setProgressQty(Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-accent transition-all h-9"
                          />
                          <span className="absolute right-3 top-2.5 text-[10px] font-mono text-ghost">{cleanRichText(boqItem.unit)}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-ghost uppercase tracking-wider mb-1">Subcontractor</label>
                        <select
                          value={subcontractorId}
                          onChange={(e) => setSubcontractorId(e.target.value)}
                          className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3 py-2 text-xs outline-none focus:border-accent transition-all h-9"
                        >
                          <option value="">No subcontractor (direct project team)</option>
                          {subcontractors.map(s => (
                            <option key={s.id} value={s.id}>{s.company_name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* STATUS & OVERVIEW */}
                  <div className="border border-border-subtle p-4 rounded-2xl bg-surface-base shadow-sm space-y-4">
                    <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
                      <CloudSun className="w-4 h-4 text-ghost shrink-0" />
                      <h4 className="text-[11px] font-black uppercase tracking-widest text-ghost">Daily Report Atmosphere</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-ghost uppercase tracking-wider mb-1">Weather</label>
                        <input
                          type="text"
                          value={weather}
                          onChange={(e) => setWeather(e.target.value)}
                          className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3 py-1.5 text-xs outline-none focus:border-primary placeholder-ghost"
                          placeholder="Sunny, Rain, Windy"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-ghost uppercase tracking-wider mb-1">Status</label>
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value as any)}
                          className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3 py-1.5 text-xs outline-none focus:border-primary text-primary font-bold"
                        >
                          <option value="draft">Draft Log</option>
                          <option value="submitted">Submitted</option>
                          <option value="reviewed">Reviewed (Approved)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-ghost uppercase tracking-wider mb-1">Remarks & Observations</label>
                      <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        rows={3}
                        className="w-full bg-surface-2 border border-border-subtle rounded-xl p-3 text-xs outline-none focus:border-primary resize-none placeholder-ghost/50"
                        placeholder="Log any safety incidents, scope explanations or constraints experienced..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW: RESOURCE REGISTRATION (CONSOLIDATED) */}
              {activeTab === 'resources' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* SECTION 1: LABOUR */}
                  <div className="border border-border-subtle p-4 rounded-2xl bg-surface-base shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary shrink-0" />
                        <div>
                          <h4 className="text-[11px] font-black uppercase tracking-widest text-main leading-tight">Daily Labour Allocation</h4>
                          <p className="text-[9px] text-ghost mt-0.5">Manpower utilized on-site for this date report</p>
                        </div>
                      </div>
                      <button
                        onClick={handleAddLabour}
                        className="text-[10px] font-black uppercase tracking-wider text-accent bg-accent/5 px-2.5 py-1 rounded-lg border border-accent/15 hover:bg-accent/10 transition-colors shadow-sm"
                      >
                        + Add Grade
                      </button>
                    </div>

                    {dailyLabour.length === 0 ? (
                      <div className="py-6 text-center text-ghost bg-surface-2/45 rounded-xl border border-dashed border-border-subtle text-[11px] select-none">
                        No labour registered. Click "+ Add Grade" to map crew hours.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {dailyLabour.map((l) => (
                          <div key={l.id} className="bg-surface-2 border border-border-subtle/80 rounded-xl p-2.5 flex items-center gap-2.5 animate-in slide-in-from-top-1 duration-200">
                            <div className="flex-1 min-w-0">
                              <select
                                value={l.labour_grade_id}
                                onChange={(e) => {
                                  const list = dailyLabour.map(item => item.id === l.id ? { ...item, labour_grade_id: e.target.value } : item);
                                  setDailyLabour(list);
                                }}
                                className="w-full bg-surface-base border border-border-subtle rounded-lg px-2 py-1 text-xs outline-none focus:border-primary"
                              >
                                <option value="">Select Crew Grade...</option>
                                {labourGrades.map(g => (
                                  <option key={g.id} value={g.id}>{g.title} (${g.hourly_rate ?? 0}/hr)</option>
                                ))}
                              </select>
                            </div>

                            <div className="w-20 shrink-0">
                              <input
                                type="number"
                                placeholder="Qty"
                                value={l.count || ''}
                                onChange={(e) => {
                                  const list = dailyLabour.map(item => item.id === l.id ? { ...item, count: parseFloat(e.target.value) || 0 } : item);
                                  setDailyLabour(list);
                                }}
                                className="w-full bg-surface-base border border-border-subtle rounded-lg px-2 py-1 text-xs font-mono outline-none text-center focus:border-primary"
                                title="Number of workmen in this grade"
                              />
                            </div>

                            <div className="w-20 shrink-0">
                              <input
                                type="number"
                                placeholder="Hrs"
                                value={l.hours || ''}
                                onChange={(e) => {
                                  const list = dailyLabour.map(item => item.id === l.id ? { ...item, hours: parseFloat(e.target.value) || 0 } : item);
                                  setDailyLabour(list);
                                }}
                                className="w-full bg-surface-base border border-border-subtle rounded-lg px-2 py-1 text-xs font-mono outline-none text-center focus:border-primary"
                                title="Hours worked per individual worker"
                              />
                            </div>

                            <button
                              onClick={() => handleRemoveLabour(l.id)}
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition-colors shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* SECTION 2: EQUIPMENT */}
                  <div className="border border-border-subtle p-4 rounded-2xl bg-surface-base shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-primary shrink-0" />
                        <div>
                          <h4 className="text-[11px] font-black uppercase tracking-widest text-main leading-tight">Machinery & Utilisation</h4>
                          <p className="text-[9px] text-ghost mt-0.5">Heavy machinery hours and fuel logs used on-site</p>
                        </div>
                      </div>
                      <button
                        onClick={handleAddEquipment}
                        className="text-[10px] font-black uppercase tracking-wider text-accent bg-accent/5 px-2.5 py-1 rounded-lg border border-accent/15 hover:bg-accent/10 transition-colors shadow-sm"
                      >
                        + Add Machinery
                      </button>
                    </div>

                    {dailyEquipment.length === 0 ? (
                      <div className="py-6 text-center text-ghost bg-surface-2/45 rounded-xl border border-dashed border-border-subtle text-[11px] select-none">
                        No active machinery logged. Click "+ Add Machinery" to map hours.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {dailyEquipment.map((e) => (
                          <div key={e.id} className="bg-surface-2 border border-border-subtle/80 rounded-xl p-2.5 flex items-center gap-2.5 animate-in slide-in-from-top-1 duration-200">
                            <div className="flex-1 min-w-0">
                              <select
                                value={e.equipment_id}
                                onChange={(eVal) => {
                                  const list = dailyEquipment.map(item => item.id === e.id ? { ...item, equipment_id: eVal.target.value } : item);
                                  setDailyEquipment(list);
                                }}
                                className="w-full bg-surface-base border border-border-subtle rounded-lg px-2 py-1 text-xs outline-none focus:border-primary"
                              >
                                <option value="">Select Equipment...</option>
                                {equipmentItems.map(item => (
                                  <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                              </select>
                            </div>

                            <div className="w-20 shrink-0">
                              <input
                                type="number"
                                placeholder="Hrs"
                                value={e.hours || ''}
                                onChange={(tVal) => {
                                  const list = dailyEquipment.map(item => item.id === e.id ? { ...item, hours: parseFloat(tVal.target.value) || 0 } : item);
                                  setDailyEquipment(list);
                                }}
                                className="w-full bg-surface-base border border-border-subtle rounded-lg px-2 py-1 text-xs font-mono outline-none text-center focus:border-primary"
                                title="Active working hours on-site"
                              />
                            </div>

                            <div className="w-24 shrink-0">
                              <div className="relative">
                                <input
                                  type="number"
                                  placeholder="Fuel"
                                  value={e.fuel_litres || ''}
                                  onChange={(fVal) => {
                                    const list = dailyEquipment.map(item => item.id === e.id ? { ...item, fuel_litres: parseFloat(fVal.target.value) || 0 } : item);
                                    setDailyEquipment(list);
                                  }}
                                  className="w-full bg-surface-base border border-border-subtle rounded-lg pl-2 pr-6 py-1 text-xs font-mono outline-none text-right focus:border-primary"
                                  title="Fuel consumed (Litres)"
                                />
                                <span className="absolute right-1 text-[8px] text-ghost font-bold top-2">ltrs</span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleRemoveEquipment(e.id)}
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition-colors shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* SECTION 3: MATERIALS */}
                  <div className="border border-border-subtle p-4 rounded-2xl bg-surface-base shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-primary shrink-0" />
                        <div>
                          <h4 className="text-[11px] font-black uppercase tracking-widest text-main leading-tight">Material Utilisation</h4>
                          <p className="text-[9px] text-ghost mt-0.5">Physical materials incorporated or used today</p>
                        </div>
                      </div>
                      <button
                        onClick={handleAddMaterial}
                        className="text-[10px] font-black uppercase tracking-wider text-accent bg-accent/5 px-2.5 py-1 rounded-lg border border-accent/15 hover:bg-accent/10 transition-colors shadow-sm"
                      >
                        + Add Material
                      </button>
                    </div>

                    {dailyMaterials.length === 0 ? (
                      <div className="py-6 text-center text-ghost bg-surface-2/45 rounded-xl border border-dashed border-border-subtle text-[11px] select-none">
                        No materials logged. Click "+ Add Material" to register quantities.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {dailyMaterials.map((m) => (
                          <div key={m.id} className="bg-surface-2 border border-border-subtle/80 rounded-xl p-2.5 flex items-center gap-2.5 animate-in slide-in-from-top-1 duration-200">
                            <div className="flex-1 min-w-0">
                              <select
                                value={m.material_id}
                                onChange={(eVal) => {
                                  const list = dailyMaterials.map(item => item.id === m.id ? { ...item, material_id: eVal.target.value } : item);
                                  setDailyMaterials(list);
                                }}
                                className="w-full bg-surface-base border border-border-subtle rounded-lg px-2 py-1 text-xs outline-none focus:border-primary"
                              >
                                <option value="">Select Material...</option>
                                {materials.map(item => (
                                  <option key={item.id} value={item.id}>{item.material_name} ({item.unit})</option>
                                ))}
                              </select>
                            </div>

                            <div className="w-32 shrink-0">
                              <input
                                type="number"
                                placeholder="Quantity"
                                value={m.quantity || ''}
                                onChange={(qVal) => {
                                  const list = dailyMaterials.map(item => item.id === m.id ? { ...item, quantity: parseFloat(qVal.target.value) || 0 } : item);
                                  setDailyMaterials(list);
                                }}
                                className="w-full bg-surface-base border border-border-subtle rounded-lg px-2 py-1 text-xs font-mono outline-none text-right focus:border-primary"
                                title="Quantity consumed on-site"
                              />
                            </div>

                            <button
                              onClick={() => handleRemoveMaterial(m.id)}
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition-colors shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Save Footer Container */}
        <div className="p-4 border-t border-border-subtle bg-surface-2/65 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 hover:bg-surface-3 transition-colors border border-border-subtle rounded-xl text-xs font-black uppercase text-ghost tracking-wider"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-primary hover:bg-primary/95 text-white shadow-xl shadow-primary/10 transition-colors rounded-xl font-black uppercase tracking-wider text-xs px-5 py-2 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>

      </div>
    </>
  );
}
