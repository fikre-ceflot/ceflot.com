import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Plus,
  Trash2,
  Download,
  Copy,
  Info,
  CheckCircle,
  RefreshCw,
  Calculator,
  Layers,
  Table,
  Save
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { SubcontractorAssignment, TakeoffEntry, RebarTakeoffEntry, CountableTakeoffEntry, BOQItem } from "../types";
import { cn, cleanRichText } from "../lib/utils";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface TakeoffSheeterProps {
  assignment?: SubcontractorAssignment;
  boqItem?: BOQItem;
  onClose: () => void;
  onSave?: (totalQty: number) => void;
}

const REBAR_DIAMETERS = [6, 8, 10, 12, 14, 16, 20, 24, 32];

const REBAR_UNIT_WEIGHTS: Record<number, number> = {
  6: 0.222,
  8: 0.395,
  10: 0.617,
  12: 0.888,
  14: 1.208,
  16: 1.578,
  20: 2.465,
  24: 3.550,
  32: 6.390,
};

export function TakeoffSheeter({
  assignment,
  boqItem,
  onClose,
  onSave,
}: TakeoffSheeterProps) {
  // Extract common details
  const targetId = assignment ? assignment.id : (boqItem?.id || "");
  const targetRef = assignment ? (assignment.boq_item?.item_no || "") : (boqItem?.item_no || "");
  const targetDesc = assignment ? (assignment.boq_item?.description || "") : (boqItem?.description || "");
  const targetUnit = assignment ? (assignment.boq_item?.unit || "units") : (boqItem?.unit || "units");
  const targetContractQty = assignment ? (assignment.contract_qty || 0) : (boqItem?.contract_qty || 0);
  const targetPartner = assignment ? (assignment.subcontractor?.company_name || "") : null;
  const tenantIdValue = assignment ? assignment.tenant_id : boqItem?.tenant_id;

  // Resolve assigned class or default
  const initialType = (localStorage.getItem(`takeoff_type_${targetId}`) as "standard" | "countable" | "rebar") || "standard";
  const [activeTab, setActiveTab] = useState<"standard" | "countable" | "rebar">(initialType);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Entities state
  const [standardEntries, setStandardEntries] = useState<TakeoffEntry[]>([]);
  const [countableEntries, setCountableEntries] = useState<CountableTakeoffEntry[]>([]);
  const [rebarEntries, setRebarEntries] = useState<RebarTakeoffEntry[]>([]);

  // Input states of rows
  const [newRow, setNewRow] = useState({
    no_of: 1 as string | number,
    no_in_mem: 1 as string | number,
    l: "" as string | number,
    w: "" as string | number,
    d: "" as string | number,
    description: "",
  });

  const [newCountable, setNewCountable] = useState({
    location: "",
    size_name: "",
    length: "" as string | number,
    count: 1 as string | number,
  });

  const [newRebar, setNewRebar] = useState({
    location: "",
    shape_type: "straight" as "hook" | "straight" | "stirrup" | "cranked" | "other",
    shape_a: "" as string | number,
    shape_b: "" as string | number,
    shape_c: "" as string | number,
    diameter: 12,
    length: "" as string | number,
    no_of_bars: "" as string | number,
    no_of_members: 1 as string | number,
  });

  useEffect(() => {
    loadAllEntries();
  }, [targetId]);

  const loadAllEntries = () => {
    setLoading(true);
    
    // 1. Standard
    const standardStored = localStorage.getItem(`takeoff_entries_${targetId}`);
    if (standardStored) {
      try { setStandardEntries(JSON.parse(standardStored)); } catch (_) {}
    } else {
      setStandardEntries([
        {
          id: `std-init-${Date.now()}`,
          assignment_id: targetId,
          no_of: 1,
          no_in_mem: 1,
          l: 1.5,
          w: 1.5,
          d: 0.40,
          qty: 0.90,
          description: "Default pad foundation concrete casting"
        }
      ]);
    }

    // 2. Countable
    const countableStored = localStorage.getItem(`countable_entries_${targetId}`);
    if (countableStored) {
      try { setCountableEntries(JSON.parse(countableStored)); } catch (_) {}
    } else {
      setCountableEntries([
        {
          id: `cnt-init-${Date.now()}`,
          assignment_id: targetId,
          location: "Grade Beam support section",
          size_name: "75x50 RHS box profile",
          length: 6.00,
          count: 8,
          total_qty: 48.00
        }
      ]);
    }

    // 3. Rebars
    const rebarStored = localStorage.getItem(`rebar_entries_${targetId}`);
    if (rebarStored) {
      try { setRebarEntries(JSON.parse(rebarStored)); } catch (_) {}
    } else {
      setRebarEntries([
        {
          id: `rebar-init-${Date.now()}`,
          assignment_id: targetId,
          location: "Column structural stirrup ties",
          shape_type: "stirrup",
          shape_a: 0.35,
          shape_b: 0.35,
          shape_c: null,
          diameter: 10,
          length: 0.70,
          no_of_bars: 24,
          no_of_members: 3,
          total_no_of_bars: 72,
          qty_kg: 31.09
        }
      ]);
    }
    setLoading(false);
  };

  const parseDecimal = (val: any): number => {
    if (val === "" || val === null || val === undefined) return 0;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
  };

  const calculateStandardRowQty = (noOf: number, noMem: number, l: number, w: number, d: number): number => {
    const multi = (noOf || 1) * (noMem || 1);
    let product = 1;
    let hasDim = false;
    if (l > 0) { product *= l; hasDim = true; }
    if (w > 0) { product *= w; hasDim = true; }
    if (d > 0) { product *= d; hasDim = true; }
    return parseFloat((hasDim ? multi * product : multi).toFixed(3));
  };

  // STANDARD LOGIC
  const handleAddStandard = () => {
    if (!newRow.description.trim()) {
      alert("Please provide location/axe details");
      return;
    }
    const noOf = parseDecimal(newRow.no_of) || 1;
    const noMem = parseDecimal(newRow.no_in_mem) || 1;
    const l = parseDecimal(newRow.l);
    const w = parseDecimal(newRow.w);
    const d = parseDecimal(newRow.d);
    
    const qty = calculateStandardRowQty(noOf, noMem, l, w, d);
    const entry: TakeoffEntry = {
      id: `std-${Date.now()}`,
      assignment_id: targetId,
      no_of: noOf,
      no_in_mem: noMem,
      l: l || null,
      w: w || null,
      d: d || null,
      qty,
      description: newRow.description,
    };

    const updated = [...standardEntries, entry];
    setStandardEntries(updated);
    localStorage.setItem(`takeoff_entries_${targetId}`, JSON.stringify(updated));

    setNewRow({
      no_of: 1,
      no_in_mem: 1,
      l: "",
      w: "",
      d: "",
      description: "",
    });
  };

  const handleDeleteStandard = (id: string) => {
    const updated = standardEntries.filter(e => e.id !== id);
    setStandardEntries(updated);
    localStorage.setItem(`takeoff_entries_${targetId}`, JSON.stringify(updated));
  };

  const handleDuplicateStandard = (e: TakeoffEntry) => {
    const dup: TakeoffEntry = {
      ...e,
      id: `std-dup-${Date.now()}`,
      description: `${e.description} (Copy)`,
    };
    const updated = [...standardEntries, dup];
    setStandardEntries(updated);
    localStorage.setItem(`takeoff_entries_${targetId}`, JSON.stringify(updated));
  };


  // COUNTABLES LOGIC
  const handleAddCountable = () => {
    if (!newCountable.location.trim()) {
      alert("Please provide the location marker");
      return;
    }
    const len = parseDecimal(newCountable.length) || 1;
    const cnt = parseDecimal(newCountable.count) || 1;
    const entry: CountableTakeoffEntry = {
      id: `countable-${Date.now()}`,
      assignment_id: targetId,
      location: newCountable.location,
      size_name: newCountable.size_name || "Custom Spec size",
      length: len,
      count: cnt,
      total_qty: parseFloat((len * cnt).toFixed(3)),
    };

    const updated = [...countableEntries, entry];
    setCountableEntries(updated);
    localStorage.setItem(`countable_entries_${targetId}`, JSON.stringify(updated));

    setNewCountable({
      location: "",
      size_name: "",
      length: "",
      count: 1,
    });
  };

  const handleDeleteCountable = (id: string) => {
    const updated = countableEntries.filter(e => e.id !== id);
    setCountableEntries(updated);
    localStorage.setItem(`countable_entries_${targetId}`, JSON.stringify(updated));
  };

  const handleDuplicateCountable = (c: CountableTakeoffEntry) => {
    const dup: CountableTakeoffEntry = {
      ...c,
      id: `countable-dup-${Date.now()}`,
      location: `${c.location} (Copy)`,
    };
    const updated = [...countableEntries, dup];
    setCountableEntries(updated);
    localStorage.setItem(`countable_entries_${targetId}`, JSON.stringify(updated));
  };


  // REBARS BBS LOGIC
  const handleAddRebar = () => {
    if (!newRebar.location.trim()) {
      alert("Please specify structural member location");
      return;
    }
    const a = parseDecimal(newRebar.shape_a);
    const b = parseDecimal(newRebar.shape_b);
    const c = parseDecimal(newRebar.shape_c);
    
    let length = parseDecimal(newRebar.length) || 1.00;
    if (newRebar.shape_type !== 'other') {
      length = parseFloat(((a || 0) + (b || 0) + (c || 0)).toFixed(3)) || length;
    }

    const nb = parseDecimal(newRebar.no_of_bars) || 1;
    const nm = parseDecimal(newRebar.no_of_members) || 1;
    const totBars = nb * nm;
    const unitW = REBAR_UNIT_WEIGHTS[newRebar.diameter] || 0.888;
    const qty_kg = parseFloat((totBars * length * unitW).toFixed(2));

    const entry: RebarTakeoffEntry = {
      id: `rebar-${Date.now()}`,
      assignment_id: targetId,
      location: newRebar.location,
      shape_type: newRebar.shape_type,
      shape_a: a || null,
      shape_b: b || null,
      shape_c: c || null,
      diameter: newRebar.diameter,
      length,
      no_of_bars: nb,
      no_of_members: nm,
      total_no_of_bars: totBars,
      qty_kg,
    };

    const updated = [...rebarEntries, entry];
    setRebarEntries(updated);
    localStorage.setItem(`rebar_entries_${targetId}`, JSON.stringify(updated));

    setNewRebar({
      location: "",
      shape_type: "straight",
      shape_a: "",
      shape_b: "",
      shape_c: "",
      diameter: 12,
      length: "",
      no_of_bars: "",
      no_of_members: 1,
    });
  };

  const handleDeleteRebar = (id: string) => {
    const updated = rebarEntries.filter(e => e.id !== id);
    setRebarEntries(updated);
    localStorage.setItem(`rebar_entries_${targetId}`, JSON.stringify(updated));
  };

  const handleDuplicateRebar = (r: RebarTakeoffEntry) => {
    const dup: RebarTakeoffEntry = {
      ...r,
      id: `rebar-dup-${Date.now()}`,
      location: `${r.location} (Copy)`,
    };
    const updated = [...rebarEntries, dup];
    setRebarEntries(updated);
    localStorage.setItem(`rebar_entries_${targetId}`, JSON.stringify(updated));
  };


  // TAB CUMULATIVES
  const standardSum = useMemo(() => {
    return parseFloat(standardEntries.reduce((sum, e) => sum + (e.qty || 0), 0).toFixed(3));
  }, [standardEntries]);

  const countableSum = useMemo(() => {
    return parseFloat(countableEntries.reduce((sum, e) => sum + (e.total_qty || 0), 0).toFixed(3));
  }, [countableEntries]);

  const rebarSum = useMemo(() => {
    return parseFloat(rebarEntries.reduce((sum, e) => sum + (e.qty_kg || 0), 0).toFixed(2));
  }, [rebarEntries]);

  const activeSum = activeTab === 'rebar' ? rebarSum : activeTab === 'countable' ? countableSum : standardSum;
  const activeUnit = activeTab === 'rebar' ? 'Kg' : cleanRichText(targetUnit);

  // SAVE SHEET BACK TO SERVER & LOCAL DB
  const handleSaveTakeoffSheet = async () => {
    setSaving(true);
    try {
      localStorage.setItem(`takeoff_type_${targetId}`, activeTab);
      localStorage.setItem(`takeoff_entries_${targetId}`, JSON.stringify(standardEntries));
      localStorage.setItem(`countable_entries_${targetId}`, JSON.stringify(countableEntries));
      localStorage.setItem(`rebar_entries_${targetId}`, JSON.stringify(rebarEntries));

      // Sync standard entries catalog in db
      if (activeTab === "standard") {
        const entriesToUpload = standardEntries.map((e) => ({
          assignment_id: targetId,
          no_of: e.no_of,
          no_in_mem: e.no_in_mem,
          l: e.l,
          w: e.w,
          d: e.d,
          qty: e.qty,
          description: e.description,
          tenant_id: tenantIdValue,
        }));

        if (assignment) {
          await supabase.from("takeoff_entries").delete().eq("assignment_id", targetId);
          if (entriesToUpload.length > 0) {
            await supabase.from("takeoff_entries").insert(entriesToUpload);
          }
        }
      }

      if (assignment) {
        await supabase
          .from("subcontractor_assignments")
          .update({ surveyed_qty: activeSum })
          .eq("id", targetId);

        localStorage.setItem(`surveyed_qty_assignment_${targetId}`, String(activeSum));
      } else if (boqItem) {
        await supabase
          .from("boq_items")
          .update({ surveyed_qty: activeSum })
          .eq("id", targetId);

        localStorage.setItem(`surveyed_qty_boq_${targetId}`, String(activeSum));
      }

      alert(`Sheet saved successfully! (${activeSum.toLocaleString()} ${activeUnit})`);
      if (onSave) {
        onSave(activeSum);
      }
      onClose();
    } catch (err: any) {
      console.warn("Could not synchronize, offline fallback saved:", err.message);
      if (assignment) {
        localStorage.setItem(`surveyed_qty_assignment_${targetId}`, String(activeSum));
      } else if (boqItem) {
        localStorage.setItem(`surveyed_qty_boq_${targetId}`, String(activeSum));
      }
      if (onSave) {
        onSave(activeSum);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = async () => {
    // Re-use core export procedures from central sheets manager
    if (activeTab === "standard") {
      await exportStandardExcel();
    } else if (activeTab === "countable") {
      await exportCountableExcel();
    } else {
      await exportRebarExcel();
    }
  };

  const exportStandardExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Takeoff Dimensions survey");
    worksheet.columns = [
      { width: 8, key: "idx" },
      { width: 12, key: "no_of" },
      { width: 12, key: "no_in_mem" },
      { width: 10, key: "l" },
      { width: 10, key: "w" },
      { width: 10, key: "d" },
      { width: 14, key: "qty" },
      { width: 45, key: "desc" },
    ];
    worksheet.getRow(1).values = ["Standard Volumetric details"];
    standardEntries.forEach((e, i) => {
      worksheet.addRow([i + 1, e.no_of, e.no_in_mem, e.l || "-", e.w || "-", e.d || "-", e.qty, e.description]);
    });
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Standard_Dimensions_${targetRef || "direct"}.xlsx`);
  };

  const exportCountableExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Countables survey");
    worksheet.columns = [
      { width: 8, key: "idx" },
      { width: 30, key: "loc" },
      { width: 30, key: "size" },
      { width: 14, key: "len" },
      { width: 12, key: "count" },
      { width: 14, key: "total" },
    ];
    worksheet.getRow(1).values = ["Countables & running sections list"];
    countableEntries.forEach((e, i) => {
      worksheet.addRow([i + 1, e.location, e.size_name, e.length, e.count, e.total_qty]);
    });
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Countable_Sections_${targetRef || "direct"}.xlsx`);
  };

  const exportRebarExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Rebar survey");
    worksheet.columns = [
      { width: 25, key: "loc" },
      { width: 14, key: "shape" },
      { width: 10, key: "dia" },
      { width: 10, key: "len" },
      { width: 10, key: "nbars" },
      { width: 10, key: "nmem" },
      { width: 12, key: "total_bars" },
      { width: 14, key: "tot_kg" },
    ];
    worksheet.getRow(1).values = ["BBS scheduling details"];
    rebarEntries.forEach((e) => {
      worksheet.addRow([e.location, e.shape_type, e.diameter, e.length, e.no_of_bars, e.no_of_members, e.total_no_of_bars, e.qty_kg]);
    });
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `BBS_Structural_Rebars_${targetRef || "direct"}.xlsx`);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[250] p-4 text-main animate-in fade-in duration-300">
      <div className="bg-surface-1 border border-border-subtle rounded-2xl shadow-2xl overflow-hidden w-full max-w-[1250px] flex flex-col h-[90vh]">
        
        {/* Banner Details Header */}
        <div className="bg-surface-2 px-6 py-5 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Calculator className="w-5.5 h-5.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black font-mono bg-primary/15 text-primary px-1.5 py-0.5 rounded">
                  BOQ REFERENCE: {targetRef}
                </span>
                <span className="text-[10px] font-bold text-ghost uppercase tracking-wider">
                  {targetPartner ? "Partner Contract measurements" : "Direct BOQ survey measurements"}
                </span>
              </div>
              <h3 className="text-base font-black text-main uppercase tracking-tight mt-1">
                {cleanRichText(targetDesc || "")}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 bg-surface-base hover:bg-surface-3 rounded-full text-ghost hover:text-main transition-colors border border-border-subtle"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quantities panel banner */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6 py-4.5 bg-surface-2/40 border-b border-border-subtle text-xs">
          {targetPartner ? (
            <div className="p-3.5 bg-surface-1 border border-border-subtle rounded-xl shadow-sm">
              <span className="text-[9px] font-black uppercase text-ghost tracking-widest block">Contract Partner</span>
              <span className="font-bold text-main mt-0.5 block truncate">{targetPartner}</span>
            </div>
          ) : (
            <div className="p-3.5 bg-surface-1 border border-border-subtle rounded-xl shadow-sm">
              <span className="text-[9px] font-black uppercase text-ghost tracking-widest block">Survey Mode</span>
              <span className="font-bold text-main mt-0.5 block truncate font-sans">Direct BOQ Quantity Takeoff</span>
            </div>
          )}

          <div className="p-3.5 bg-surface-1 border border-border-subtle rounded-xl shadow-sm font-mono">
            <span className="text-[9px] font-bold uppercase text-ghost tracking-widest block">Contract baseline Qty</span>
            <span className="font-black text-main block mt-0.5 text-base">
              {(targetContractQty || 0).toLocaleString()} <span className="text-[11px] font-sans font-bold text-ghost">{cleanRichText(targetUnit || '')}</span>
            </span>
          </div>

          <div className="p-3.5 bg-surface-1 border border-border-subtle rounded-xl shadow-sm relative overflow-hidden font-mono">
            <span className="text-[9px] font-black uppercase text-primary tracking-widest block">Survey qty (Active)</span>
            <span className="font-black text-primary block mt-0.5 text-base">
              {activeSum.toLocaleString()} <span className="text-[11px] font-sans font-bold text-ghost">{activeUnit}</span>
            </span>
          </div>

          <div className="p-3.5 bg-gradient-to-br from-primary/5 to-transparent border border-primary/20 rounded-xl relative overflow-hidden flex flex-col justify-between">
            <div>
              <span className="text-[9px] font-black uppercase text-primary tracking-widest block">Survey / Contract ratio</span>
              <span className="font-mono font-black text-primary block mt-0.5 text-base">
                {(targetContractQty > 0 ? (activeSum / targetContractQty) * 100 : 0).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* TAB CONTROLLERS */}
        <div className="px-6 bg-surface-2 border-b border-border-subtle flex items-center justify-between">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("standard")}
              className={cn(
                "py-3 px-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5",
                activeTab === "standard" ? "border-primary text-primary" : "border-transparent text-ghost hover:text-main"
              )}
            >
              <Table className="w-4 h-4" />
              1. Area & Volume ({standardEntries.length})
            </button>
            <button
              onClick={() => setActiveTab("countable")}
              className={cn(
                "py-3 px-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5",
                activeTab === "countable" ? "border-primary text-primary" : "border-transparent text-ghost hover:text-main"
              )}
            >
              <Layers className="w-4 h-4" />
              2. Countables & sections ({countableEntries.length})
            </button>
            <button
              onClick={() => setActiveTab("rebar")}
              className={cn(
                "py-3 px-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5",
                activeTab === "rebar" ? "border-primary text-primary" : "border-transparent text-ghost hover:text-main"
              )}
            >
              <Calculator className="w-4 h-4" />
              3. Reinforcement (BBS) ({rebarEntries.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
               onClick={handleExportExcel}
               className="px-3 py-1.5 bg-surface-base border border-border-subtle rounded-lg text-[10px] font-bold text-main hover:border-primary flex items-center gap-1"
             >
               <Download className="w-3.5 h-3.5 text-primary" />
               Excel Export
             </button>
           </div>
        </div>

        {/* Dynamic Inner Sheets Tables */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-12 text-center text-ghost text-xs uppercase tracking-wider font-mono">
              Loading sheet specifications...
            </div>
          ) : activeTab === "standard" ? (
            <div className="space-y-4">
              <div className="border border-border-subtle rounded-xl overflow-hidden bg-surface-base">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr className="bg-surface-2 border-b border-border-subtle text-[9px] font-black uppercase text-ghost tracking-widest">
                      <th className="px-4 py-2.5 w-12 text-center">#</th>
                      <th className="px-4 py-2.5 w-20 text-center">No of</th>
                      <th className="px-4 py-2.5 w-20 text-center">No Mem</th>
                      <th className="px-4 py-2.5 w-24 text-center">Length (m)</th>
                      <th className="px-4 py-2.5 w-24 text-center">Width (m)</th>
                      <th className="px-4 py-2.5 w-24 text-center">Depth (m)</th>
                      <th className="px-4 py-2.5 w-28 text-right">Result Qty</th>
                      <th className="px-4 py-2.5 text-left">Location description</th>
                      <th className="px-4 py-2.5 w-20 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle text-xs font-semibold">
                    {standardEntries.map((e, idx) => (
                      <tr key={e.id} className="hover:bg-primary/[0.01]">
                        <td className="px-4 py-2 font-mono text-center text-ghost">{idx + 1}</td>
                        <td className="px-4 py-2 text-center font-mono font-bold text-main">{e.no_of}</td>
                        <td className="px-4 py-2 text-center font-mono text-dim">{e.no_in_mem}</td>
                        <td className="px-4 py-2 text-center font-mono text-dim">{e.l || "-"}</td>
                        <td className="px-4 py-2 text-center font-mono text-dim">{e.w || "-"}</td>
                        <td className="px-4 py-2 text-center font-mono text-dim">{e.d || "-"}</td>
                        <td className="px-4 py-2 text-right font-mono font-black text-primary">{e.qty.toLocaleString()}</td>
                        <td className="px-4 py-2 font-semibold text-main truncate" title={e.description}>{e.description}</td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => handleDuplicateStandard(e)} className="p-1 hover:bg-surface-3 rounded text-ghost hover:text-accent"><Copy className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteStandard(e.id)} className="p-1 hover:bg-error/10 rounded text-ghost hover:text-error"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {/* Standard Inline new row entry */}
                    <tr className="bg-surface-2/30 border-t-2 border-border-subtle">
                      <td className="px-4 py-2 text-center text-ghost">+</td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          className="w-full bg-surface-1 border border-border-subtle rounded p-1 text-center text-xs font-sans text-main font-bold outline-none"
                          value={newRow.no_of}
                          onChange={(e) => setNewRow({ ...newRow, no_of: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          className="w-full bg-surface-1 border border-border-subtle rounded p-1 text-center text-xs text-main outline-none"
                          value={newRow.no_in_mem}
                          onChange={(e) => setNewRow({ ...newRow, no_in_mem: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          placeholder="L(m)"
                          className="w-full bg-surface-1 border border-border-subtle rounded p-1 text-center text-xs text-main outline-none"
                          value={newRow.l}
                          onChange={(e) => setNewRow({ ...newRow, l: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          placeholder="W(m)"
                          className="w-full bg-surface-1 border border-border-subtle rounded p-1 text-center text-xs text-main outline-none"
                          value={newRow.w}
                          onChange={(e) => setNewRow({ ...newRow, w: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          placeholder="D(m)"
                          className="w-full bg-surface-1 border border-border-subtle rounded p-1 text-center text-xs text-main outline-none"
                          value={newRow.d}
                          onChange={(e) => setNewRow({ ...newRow, d: e.target.value })}
                        />
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-black text-primary text-xs">
                        {calculateStandardRowQty(
                          parseDecimal(newRow.no_of) || 1,
                          parseDecimal(newRow.no_in_mem) || 1,
                          parseDecimal(newRow.l),
                          parseDecimal(newRow.w),
                          parseDecimal(newRow.d)
                        ).toLocaleString()}
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="text"
                          placeholder="Location / detailed axes notations..."
                          className="w-full bg-surface-1 border border-border-subtle rounded px-2.5 py-1.5 text-xs text-main outline-none"
                          value={newRow.description}
                          onChange={(e) => setNewRow({ ...newRow, description: e.target.value })}
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={handleAddStandard}
                          className="px-3.5 py-1 bg-primary text-white text-[10px] font-black uppercase tracking-wider rounded font-sans hover:bg-primary/95 flex items-center gap-1 mx-auto"
                        >
                          Add
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === "countable" ? (
            <div className="space-y-4">
              <div className="border border-border-subtle rounded-xl overflow-hidden bg-surface-base">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr className="bg-surface-2 border-b border-border-subtle text-[9px] font-black uppercase text-ghost tracking-widest">
                      <th className="px-4 py-2.5 w-12 text-center">#</th>
                      <th className="px-4 py-2.5 text-left">Location marker / room</th>
                      <th className="px-4 py-2.5 text-left w-64">Section specs / profile details</th>
                      <th className="px-4 py-2.5 w-32 text-center">Unit Length(m)</th>
                      <th className="px-4 py-2.5 w-24 text-center">Multiplier</th>
                      <th className="px-4 py-2.5 w-32 text-right">Running Total (m)</th>
                      <th className="px-4 py-2.5 w-20 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle text-xs font-semibold">
                    {countableEntries.map((e, idx) => (
                      <tr key={e.id} className="hover:bg-primary/[0.01]">
                        <td className="px-4 py-2 font-mono text-center text-ghost">{idx + 1}</td>
                        <td className="px-4 py-2 font-bold text-main truncate">{e.location}</td>
                        <td className="px-4 py-2 text-main truncate">{e.size_name}</td>
                        <td className="px-4 py-2 text-center font-mono text-dim">{e.length}</td>
                        <td className="px-4 py-2 text-center font-mono font-bold text-main">{e.count}</td>
                        <td className="px-4 py-2 text-right font-mono font-black text-primary">{(e.total_qty || 0).toLocaleString()} m</td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => handleDuplicateCountable(e)} className="p-1 hover:bg-surface-3 rounded text-ghost hover:text-accent"><Copy className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteCountable(e.id)} className="p-1 hover:bg-error/10 rounded text-ghost hover:text-error"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    <tr className="bg-surface-2/30 border-t-2 border-border-subtle">
                      <td className="px-4 py-2 text-center text-ghost">+</td>
                      <td className="px-1 py-1">
                        <input
                          type="text"
                          placeholder="Room Location..."
                          className="w-full bg-surface-1 border border-border-subtle rounded p-1 text-xs text-main font-semibold outline-none"
                          value={newCountable.location}
                          onChange={(e) => setNewCountable({ ...newCountable, location: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="text"
                          placeholder="Size (e.g. 50x50mm RHS)..."
                          className="w-full bg-surface-1 border border-border-subtle rounded p-1 text-xs text-main outline-none"
                          value={newCountable.size_name}
                          onChange={(e) => setNewCountable({ ...newCountable, size_name: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          placeholder="Length (m)"
                          className="w-full bg-surface-1 border border-border-subtle rounded p-1 text-center text-xs font-mono text-main outline-none"
                          value={newCountable.length}
                          onChange={(e) => setNewCountable({ ...newCountable, length: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          className="w-full bg-surface-1 border border-border-subtle rounded p-1 text-center text-xs font-mono text-main font-bold outline-none"
                          value={newCountable.count}
                          onChange={(e) => setNewCountable({ ...newCountable, count: e.target.value })}
                        />
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-black text-primary">
                        {(parseDecimal(newCountable.length) * parseDecimal(newCountable.count)).toLocaleString()} m
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={handleAddCountable}
                          className="px-3.5 py-1 bg-primary text-white text-[10px] font-black uppercase tracking-wider rounded font-sans hover:bg-primary-hover/95 flex items-center gap-1 mx-auto"
                        >
                          Add
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border border-border-subtle rounded-xl overflow-hidden bg-surface-base">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr className="bg-surface-2 border-b border-border-subtle text-[9px] font-black uppercase text-ghost tracking-widest">
                      <th className="px-3 py-2 w-10 text-center">#</th>
                      <th className="px-3 py-2 text-left w-36">Location</th>
                      <th className="px-2 py-2 text-center w-28">Shape Profile</th>
                      <th className="px-2 py-2 text-center w-16">Φ (mm)</th>
                      <th className="px-1 py-1 text-center w-14">A (m)</th>
                      <th className="px-1 py-1 text-center w-14">B (m)</th>
                      <th className="px-1 py-1 text-center w-14">C (m)</th>
                      <th className="px-2 py-2 text-center w-20">Length (m)</th>
                      <th className="px-2 py-2 text-center w-14">Bars</th>
                      <th className="px-2 py-2 text-center w-14">Mem</th>
                      <th className="px-2 py-2 text-center w-16 font-bold">Total Bars</th>
                      <th className="px-3 py-2 text-right w-24 text-success font-black">Weight (Kg)</th>
                      <th className="px-2 py-2 w-16 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle text-xs font-semibold">
                    {rebarEntries.map((e, idx) => (
                      <tr key={e.id} className="hover:bg-primary/[0.01]">
                        <td className="px-3 py-2 font-mono text-center text-ghost">{idx + 1}</td>
                        <td className="px-3 py-2 font-bold text-main truncate">{e.location}</td>
                        <td className="px-2 py-2 text-center text-[11px] text-ghost uppercase font-bold">{e.shape_type}</td>
                        <td className="px-2 py-2 text-center font-mono">Φ {e.diameter}</td>
                        <td className="px-1 py-1 font-mono text-center text-dim">{e.shape_a || "-"}</td>
                        <td className="px-1 py-1 font-mono text-center text-dim">{e.shape_b || "-"}</td>
                        <td className="px-1 py-1 font-mono text-center text-dim">{e.shape_c || "-"}</td>
                        <td className="px-2 py-2 font-mono text-center text-main font-bold">{e.length}</td>
                        <td className="px-2 py-2 font-mono text-center text-dim">{e.no_of_bars}</td>
                        <td className="px-2 py-2 font-mono text-center text-dim">{e.no_of_members}</td>
                        <td className="px-2 py-2 font-mono text-center text-ghost font-bold">{e.total_no_of_bars}</td>
                        <td className="px-3 py-2 font-mono text-right text-success font-black">{e.qty_kg.toLocaleString()}</td>
                        <td className="px-2 py-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => handleDuplicateRebar(e)} className="p-1 hover:bg-surface-3 rounded text-ghost hover:text-accent"><Copy className="w-3" /></button>
                            <button onClick={() => handleDeleteRebar(e.id)} className="p-1 hover:bg-error/10 rounded text-ghost hover:text-error"><Trash2 className="w-3" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    <tr className="bg-surface-2/30 border-t-2 border-border-subtle text-[11px]">
                      <td className="px-3 py-2 text-center text-ghost">+</td>
                      <td className="px-1 py-1">
                        <input
                          type="text"
                          placeholder="Pad Member..."
                          className="w-full bg-surface-1 border border-border-subtle rounded p-1 text-xs text-main outline-none"
                          value={newRebar.location}
                          onChange={(e) => setNewRebar({ ...newRebar, location: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <select
                          className="w-full bg-surface-1 border border-border-subtle rounded p-1 text-[10px] font-bold outline-none cursor-pointer"
                          value={newRebar.shape_type}
                          onChange={(e) => setNewRebar({ ...newRebar, shape_type: e.target.value as any })}
                        >
                          <option value="straight">Straight</option>
                          <option value="hook">Hooked (a+b+c)</option>
                          <option value="stirrup">Stirrup (a+b)</option>
                          <option value="cranked">Cranked</option>
                          <option value="other">Other/Custom</option>
                        </select>
                      </td>
                      <td className="px-1 py-1">
                        <select
                          className="w-full bg-surface-1 border border-border-subtle rounded p-1 text-xs font-mono outline-none text-center"
                          value={newRebar.diameter}
                          onChange={(e) => setNewRebar({ ...newRebar, diameter: parseInt(e.target.value) })}
                        >
                          {REBAR_DIAMETERS.map(d => (
                            <option key={d} value={d}>Φ {d}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          placeholder="-"
                          disabled={newRebar.shape_type === 'straight'}
                          className="w-full bg-surface-1 border border-border-subtle rounded p-1 text-center font-mono outline-none"
                          value={newRebar.shape_a}
                          onChange={(e) => setNewRebar({ ...newRebar, shape_a: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          placeholder="-"
                          className="w-full bg-surface-1 border border-border-subtle rounded p-1 text-center font-mono outline-none"
                          value={newRebar.shape_b}
                          onChange={(e) => setNewRebar({ ...newRebar, shape_b: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          placeholder="-"
                          disabled={newRebar.shape_type !== 'hook'}
                          className="w-full bg-surface-1 border border-border-subtle rounded p-1 text-center font-mono outline-none"
                          value={newRebar.shape_c}
                          onChange={(e) => setNewRebar({ ...newRebar, shape_c: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          placeholder="L"
                          disabled={newRebar.shape_type !== 'other'}
                          className="w-full bg-surface-1 border border-border-subtle rounded p-1 text-center font-mono outline-none text-main font-bold"
                          value={newRebar.length}
                          onChange={(e) => setNewRebar({ ...newRebar, length: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          className="w-full bg-surface-1 border border-border-subtle rounded p-1 text-center font-mono outline-none text-main font-bold"
                          value={newRebar.no_of_bars}
                          onChange={(e) => setNewRebar({ ...newRebar, no_of_bars: e.target.value })}
                        />
                      </td>
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          className="w-full bg-surface-1 border border-border-subtle rounded p-1 text-center font-mono outline-none text-main"
                          value={newRebar.no_of_members}
                          onChange={(e) => setNewRebar({ ...newRebar, no_of_members: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-ghost font-bold">
                        {(parseDecimal(newRebar.no_of_bars) * parseDecimal(newRebar.no_of_members))}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-black text-success">
                        {parseFloat(
                          ((parseDecimal(newRebar.no_of_bars) * parseDecimal(newRebar.no_of_members)) * 
                          (newRebar.shape_type === 'other' ? parseDecimal(newRebar.length) : (parseDecimal(newRebar.shape_a) + parseDecimal(newRebar.shape_b) + parseDecimal(newRebar.shape_c))) * 
                          (REBAR_UNIT_WEIGHTS[newRebar.diameter] || 0.888)).toFixed(2)
                        ).toLocaleString()} Kg
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={handleAddRebar}
                          className="px-3.5 py-1 bg-success text-white text-[10px] font-black uppercase tracking-wider rounded font-sans hover:bg-success/95 flex items-center gap-1 mx-auto"
                        >
                          Add
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Action Bottom Bar */}
        <div className="bg-surface-2 px-6 py-5 border-t border-border-subtle flex items-center justify-between">
          <div className="text-xs text-ghost font-bold flex items-center gap-1.5 uppercase">
            <Info className="w-4.5 h-4.5 text-accent" />
            Changes are saved locally to system and synchronized on clicking Save.
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-surface-base border border-border-subtle text-xs font-black uppercase text-ghost hover:text-main rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              disabled={saving}
              onClick={handleSaveTakeoffSheet}
              className="px-6 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-1.5 shadow-xl shadow-accent/15 transition-all"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save & Apply Measurements
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
