import React, { useState, useEffect, useMemo } from "react";
import {
  Calculator,
  Search,
  Download,
  Users,
  CheckCircle,
  Clock,
  ExternalLink,
  Table,
  Briefcase,
  Layers,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Plus,
  Trash2,
  Copy,
  Save,
  Edit,
  Check,
  RefreshCw,
  Info,
  Sliders,
  Settings,
  GitCommit,
  Square,
  CheckSquare
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Project, SubcontractorAssignment, TakeoffEntry, RebarTakeoffEntry, CountableTakeoffEntry, BOQItem } from "../types";
import { cn, cleanRichText } from "../lib/utils";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface TakeoffSheetsManagerProps {
  project: Project | null;
  tenantId: string;
  onSelectProject?: () => void;
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

export function TakeoffSheetsManager({
  project,
  tenantId,
  onSelectProject,
}: TakeoffSheetsManagerProps) {
  const [assignments, setAssignments] = useState<SubcontractorAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubcontractor, setSelectedSubcontractor] = useState("All");
  
  // Tabs on the main screen before editing
  // 1 = Standard / Volumetric/ Area
  // 2 = Countables / Addables (Trusses, window sills, section profiles etc.)
  // 3 = Reinforcement BBS (Rebars)
  const [activeTab, setActiveTab] = useState<"standard" | "countable" | "rebar">("standard");

  // Track expanded item for inline editing
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Classify types mapping for assignments stored locally
  const [takeoffTypes, setTakeoffTypes] = useState<Record<string, "standard" | "countable" | "rebar">>({});

  // Dynamic sheets state loaded for current expanded assignment
  const [standardEntries, setStandardEntries] = useState<TakeoffEntry[]>([]);
  const [countableEntries, setCountableEntries] = useState<CountableTakeoffEntry[]>([]);
  const [rebarEntries, setRebarEntries] = useState<RebarTakeoffEntry[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Checkbox states for bulk editing
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  // Loaded surveyed quantities sums (updated in real time/calculated)
  const [takeoffSums, setTakeoffSums] = useState<Record<string, number>>({});

  const [boqItems, setBoqItems] = useState<BOQItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

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

  const toggleItemCollapse = (itemNo: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedItems);
    if (next.has(itemNo)) {
      next.delete(itemNo);
    } else {
      next.add(itemNo);
    }
    setExpandedItems(next);
  };

  useEffect(() => {
    if (project) {
      loadData();
    }
  }, [project?.id]);

  const loadData = async () => {
    if (!project) return;
    setLoading(true);
    try {
      const [assignmentsRes, boqRes] = await Promise.all([
        supabase
          .from("subcontractor_assignments")
          .select(`
            *,
            subcontractor:subcontractor_id(*),
            boq_item:boq_item_id(*)
          `)
          .eq("project_id", project.id),
        supabase
          .from("boq_items")
          .select("*")
          .eq("project_id", project.id)
      ]);

      if (assignmentsRes.error) throw assignmentsRes.error;
      if (boqRes.error) throw boqRes.error;

      const loadedAssignments = assignmentsRes.data || [];
      const loadedBoqItems = boqRes.data || [];

      setAssignments(loadedAssignments);
      setBoqItems(loadedBoqItems);

      // Initialize expanded items with all parent item numbers so they're expanded by default
      const initialExpanded = new Set<string>();
      loadedBoqItems.forEach(item => {
        if (item.item_no) {
          const parts = item.item_no.split('.');
          if (parts.length > 1) {
            const parentNo = parts.slice(0, -1).join('.');
            initialExpanded.add(parentNo);
          }
        }
      });
      setExpandedItems(initialExpanded);

      // Load types and computed sums
      const typesMap: Record<string, "standard" | "countable" | "rebar"> = {};
      const sumsMap: Record<string, number> = {};

      loadedAssignments.forEach((assign) => {
        // Resolve type (default to standard unless changed)
        const storedType = localStorage.getItem(`takeoff_type_${assign.id}`);
        const resolvedType = (storedType as "standard" | "countable" | "rebar") || "standard";
        typesMap[assign.id] = resolvedType;

        // Calculate sum based on type
        if (resolvedType === "countable") {
          const stored = localStorage.getItem(`countable_entries_${assign.id}`);
          if (stored) {
            try {
              const entries: CountableTakeoffEntry[] = JSON.parse(stored);
              sumsMap[assign.id] = parseFloat(entries.reduce((sum, e) => sum + (e.total_qty || 0), 0).toFixed(3));
            } catch (_) { sumsMap[assign.id] = assign.surveyed_qty || 0; }
          } else {
            sumsMap[assign.id] = assign.surveyed_qty || 0;
          }
        } else if (resolvedType === "rebar") {
          const stored = localStorage.getItem(`rebar_entries_${assign.id}`);
          if (stored) {
            try {
              const entries: RebarTakeoffEntry[] = JSON.parse(stored);
              sumsMap[assign.id] = parseFloat(entries.reduce((sum, e) => sum + (e.qty_kg || 0), 0).toFixed(2));
            } catch (_) { sumsMap[assign.id] = assign.surveyed_qty || 0; }
          } else {
            sumsMap[assign.id] = assign.surveyed_qty || 0;
          }
        } else {
          const stored = localStorage.getItem(`takeoff_entries_${assign.id}`);
          if (stored) {
            try {
              const entries: TakeoffEntry[] = JSON.parse(stored);
              sumsMap[assign.id] = parseFloat(entries.reduce((sum, e) => sum + (e.qty || 0), 0).toFixed(3));
            } catch (_) { sumsMap[assign.id] = assign.surveyed_qty || 0; }
          } else {
            sumsMap[assign.id] = assign.surveyed_qty || 0;
          }
        }
      });

      setTakeoffTypes(typesMap);
      setTakeoffSums(sumsMap);
      setSelectedIds({});
    } catch (err: any) {
      console.error("Error loading subcontractor takeoffs:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // Switch takeoff type of a single assignment row
  const handleAssignType = (assignmentId: string, type: "standard" | "countable" | "rebar") => {
    localStorage.setItem(`takeoff_type_${assignmentId}`, type);
    
    // Auto-update state mapping
    setTakeoffTypes(prev => {
      const copy = { ...prev, [assignmentId]: type };
      
      // Recompute the sum for this assignment right away because its data key changes
      let sum = 0;
      if (type === "countable") {
        const stored = localStorage.getItem(`countable_entries_${assignmentId}`);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            sum = parseFloat(parsed.reduce((acc: number, item: any) => acc + (item.total_qty || 0), 0).toFixed(3));
          } catch (_) {}
        }
      } else if (type === "rebar") {
        const stored = localStorage.getItem(`rebar_entries_${assignmentId}`);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            sum = parseFloat(parsed.reduce((acc: number, item: any) => acc + (item.qty_kg || 0), 0).toFixed(2));
          } catch (_) {}
        }
      } else {
        const stored = localStorage.getItem(`takeoff_entries_${assignmentId}`);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            sum = parseFloat(parsed.reduce((acc: number, item: any) => acc + (item.qty || 0), 0).toFixed(3));
          } catch (_) {}
        }
      }
      
      setTakeoffSums(sums => ({ ...sums, [assignmentId]: sum }));
      return copy;
    });

    // Collapse if it is active
    if (expandedId === assignmentId) {
      setExpandedId(null);
    }
  };

  // Bulk actions
  const handleBulkReclassify = (targetType: "standard" | "countable" | "rebar") => {
    const selectedList = Object.keys(selectedIds).filter(id => selectedIds[id]);
    if (selectedList.length === 0) {
      alert("Please select at least one item first.");
      return;
    }

    selectedList.forEach(id => {
      localStorage.setItem(`takeoff_type_${id}`, targetType);
    });

    alert(`Successfully moved ${selectedList.length} items to ${targetType === 'standard' ? 'Standard Volumetric' : targetType === 'countable' ? 'Countable & Addable' : 'Reinforcement BBS'}`);
    loadData();
  };

  // Subcontractor filters
  const uniqueSubcontractors = useMemo(() => {
    const names = new Set<string>();
    assignments.forEach((a) => {
      if (a.subcontractor?.company_name) {
        names.add(a.subcontractor.company_name);
      }
    });
    return ["All", ...Array.from(names)];
  }, [assignments]);

  // Cumulative totals for parent nodes (folders)
  const getCumulativeStats = (itemNo: string | null) => {
    let contractSum = 0;
    let surveySum = 0;

    if (!itemNo) return { contractSum, surveySum };

    assignments.forEach((a) => {
      const aType = takeoffTypes[a.id] || "standard";
      if (aType !== activeTab) return;

      if (a.boq_item?.item_no && (a.boq_item.item_no === itemNo || a.boq_item.item_no.startsWith(itemNo + '.'))) {
        contractSum += a.contract_qty || 0;
        surveySum += takeoffSums[a.id] || 0;
      }
    });

    return { contractSum, surveySum };
  };

  // Filtered tree of BOQ items, showing actual subcontractor assignments and their parent ancestors
  const filteredTreeNodes = useMemo(() => {
    // 1. Identify all active assignments for the selected tab type that match filters
    const activeAssignments = assignments.filter((a) => {
      const assignedType = takeoffTypes[a.id] || "standard";
      if (assignedType !== activeTab) return false;

      const boqDesc = cleanRichText(a.boq_item?.description || "").toLowerCase();
      const boqRef = (a.boq_item?.item_no || "").toLowerCase();
      const subName = (a.subcontractor?.company_name || "").toLowerCase();
      const query = searchQuery.toLowerCase();

      const matchesSearch =
        boqDesc.includes(query) ||
        boqRef.includes(query) ||
        subName.includes(query);

      const matchesSub =
        selectedSubcontractor === "All" ||
        a.subcontractor?.company_name === selectedSubcontractor;

      return matchesSearch && matchesSub;
    });

    // 2. Obtain assigned BOQ IDs
    const assignedBoqIds = new Set(activeAssignments.map(a => a.boq_item_id));

    // 3. Keep ancestor items structured in the tree
    const visibleBoqIds = new Set<string>();

    boqItems.forEach(item => {
      if (assignedBoqIds.has(item.id)) {
        visibleBoqIds.add(item.id);
        
        if (item.item_no) {
          const parts = item.item_no.split('.');
          for (let i = 1; i < parts.length; i++) {
            const parentNo = parts.slice(0, i).join('.');
            const parentObj = boqItems.find(p => p.item_no === parentNo);
            if (parentObj) {
              visibleBoqIds.add(parentObj.id);
            }
          }
        }
      }
    });

    // 4. Sort visible items based on tree order code
    const visibleItems = boqItems.filter(item => visibleBoqIds.has(item.id));
    const sortedItems = [...visibleItems].sort((a, b) => sortItemNo(a.item_no, b.item_no));

    // 5. Build list with hasChildren and corresponding subcontractor assignment reference
    return sortedItems.map((item, idx) => {
      const hasChildren = sortedItems.some((child, cIdx) => 
        cIdx > idx && 
        child.item_no && 
        item.item_no && 
        child.item_no.startsWith(item.item_no + ".")
      );
      
      const assocAssignment = activeAssignments.find(a => a.boq_item_id === item.id);

      return {
        ...item,
        hasChildren,
        assignment: assocAssignment,
      };
    });
  }, [assignments, boqItems, activeTab, takeoffTypes, searchQuery, selectedSubcontractor]);

  const activeAssignmentsOnly = useMemo(() => {
    return filteredTreeNodes
      .map(node => node.assignment)
      .filter((a): a is SubcontractorAssignment => !!a);
  }, [filteredTreeNodes]);

  const isItemVisible = (itemNo: string | null) => {
    if (!itemNo) return true;
    const parts = itemNo.split('.');
    if (parts.length === 1) return true;

    for (let i = 1; i < parts.length; i++) {
      const parentPath = parts.slice(0, i).join('.');
      if (!expandedItems.has(parentPath)) return false;
    }
    return true;
  };

  // Aggregate statistical metrics
  const stats = useMemo(() => {
    let standardCount = 0;
    let countableCount = 0;
    let rebarCount = 0;
    let totalQtySurveyed = 0;
    let totalContractQty = 0;

    assignments.forEach((a) => {
      const type = takeoffTypes[a.id] || "standard";
      if (type === "standard") standardCount++;
      else if (type === "countable") countableCount++;
      else if (type === "rebar") rebarCount++;

      totalQtySurveyed += takeoffSums[a.id] || 0;
      totalContractQty += a.contract_qty || 0;
    });

    const ratio = totalContractQty > 0 ? (totalQtySurveyed / totalContractQty) * 100 : 0;

    return {
      standardCount,
      countableCount,
      rebarCount,
      totalQtySurveyed,
      totalContractQty,
      ratio,
    };
  }, [assignments, takeoffTypes, takeoffSums]);

  // Expand and load details of single takeoff sheet
  const handleToggleExpand = (assignment: SubcontractorAssignment) => {
    if (expandedId === assignment.id) {
      setExpandedId(null);
      return;
    }

    const type = takeoffTypes[assignment.id] || "standard";
    setExpandedId(assignment.id);

    if (type === "countable") {
      const stored = localStorage.getItem(`countable_entries_${assignment.id}`);
      if (stored) {
        try {
          setCountableEntries(JSON.parse(stored));
        } catch (_) { setCountableEntries([]); }
      } else {
        // Fallback sample countable rows
        setCountableEntries([
          {
            id: `countable-${Date.now()}-1`,
            assignment_id: assignment.id,
            location: "Main Roof Truss - Chords",
            size_name: "75x50x4mm MS Box section",
            length: 5.80,
            count: 12,
            total_qty: 69.60,
          },
          {
            id: `countable-${Date.now()}-2`,
            assignment_id: assignment.id,
            location: "Window sill - Master suite",
            size_name: "20mm Granite sill slab",
            length: 1.80,
            count: 4,
            total_qty: 7.20,
          }
        ]);
      }
    } else if (type === "rebar") {
      const stored = localStorage.getItem(`rebar_entries_${assignment.id}`);
      if (stored) {
        try {
          setRebarEntries(JSON.parse(stored));
        } catch (_) { setRebarEntries([]); }
      } else {
        // Fallback sample rebar scheduling rows
        setRebarEntries([
          {
            id: `rebar-${Date.now()}-1`,
            assignment_id: assignment.id,
            location: "Column C1 foundation pads",
            shape_type: "hook",
            shape_a: 0.15,
            shape_b: 1.20,
            shape_c: 0.15,
            diameter: 12,
            length: 1.50,
            no_of_bars: 8,
            no_of_members: 12,
            total_no_of_bars: 96,
            qty_kg: 127.87,
          },
          {
            id: `rebar-${Date.now()}-2`,
            assignment_id: assignment.id,
            location: "Slab links A-C",
            shape_type: "stirrup",
            shape_a: 0.40,
            shape_b: 0.80,
            shape_c: null,
            diameter: 8,
            length: 1.20,
            no_of_bars: 45,
            no_of_members: 4,
            total_no_of_bars: 180,
            qty_kg: 85.32,
          }
        ]);
      }
    } else {
      const stored = localStorage.getItem(`takeoff_entries_${assignment.id}`);
      if (stored) {
        try {
          setStandardEntries(JSON.parse(stored));
        } catch (_) { setStandardEntries([]); }
      } else {
        // Fallback standard dimensional measurements row
        setStandardEntries([
          {
            id: `std-${Date.now()}-1`,
            assignment_id: assignment.id,
            no_of: 2,
            no_in_mem: 1,
            l: 12.50,
            w: 4.20,
            d: 0.15,
            qty: 15.75,
            description: "Main Floor Slab casting - Area A",
          }
        ]);
      }
    }
  };

  // Calculations for Standard rows
  const parseDecimal = (val: any): number => {
    if (val === "" || val === null || val === undefined) return 0;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
  };

  const calculateRowQty = (noOf: number, noInMem: number, l: number, w: number, d: number): number => {
    const multi = (noOf || 1) * (noInMem || 1);
    let product = 1;
    let hasDim = false;
    if (l > 0) { product *= l; hasDim = true; }
    if (w > 0) { product *= w; hasDim = true; }
    if (d > 0) { product *= d; hasDim = true; }
    return parseFloat((hasDim ? multi * product : multi).toFixed(3));
  };

  // Standard inline handlers
  const handleStandardCellChange = (id: string, field: string, val: any) => {
    setStandardEntries(prev => {
      const next = prev.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: val };
        
        // Recalculate Qty
        const noOf = parseDecimal(field === 'no_of' ? val : updated.no_of) || 1;
        const noMem = parseDecimal(field === 'no_in_mem' ? val : updated.no_in_mem) || 1;
        const l = parseDecimal(field === 'l' ? val : updated.l);
        const w = parseDecimal(field === 'w' ? val : updated.w);
        const d = parseDecimal(field === 'd' ? val : updated.d);

        updated.qty = calculateRowQty(noOf, noMem, l, w, d);
        return updated;
      });
      return next;
    });
  };

  const handleAddStandardRow = (assignId: string) => {
    const newEntry: TakeoffEntry = {
      id: `std-new-${Date.now()}`,
      assignment_id: assignId,
      no_of: 1,
      no_in_mem: 1,
      l: 0,
      w: 0,
      d: 0,
      qty: 1,
      description: "Enter detailed location axises...",
    };
    setStandardEntries([...standardEntries, newEntry]);
  };

  const handleDuplicateStandardRow = (row: TakeoffEntry) => {
    const duplicated: TakeoffEntry = {
      ...row,
      id: `std-dup-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      description: `${row.description} (Copy)`,
    };
    setStandardEntries([...standardEntries, duplicated]);
  };

  const handleDeleteStandardRow = (id: string) => {
    setStandardEntries(standardEntries.filter(e => e.id !== id));
  };


  // Countable inline handlers
  const handleCountableCellChange = (id: string, field: string, val: any) => {
    setCountableEntries(prev => {
      const next = prev.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: val };
        
        const length = parseDecimal(field === 'length' ? val : updated.length);
        const count = parseDecimal(field === 'count' ? val : updated.count);
        updated.total_qty = parseFloat((length * count).toFixed(3));
        
        return updated;
      });
      return next;
    });
  };

  const handleAddCountableRow = (assignId: string) => {
    const newRow: CountableTakeoffEntry = {
      id: `countable-new-${Date.now()}`,
      assignment_id: assignId,
      location: "New Location...",
      size_name: "Specification size...",
      length: 1,
      count: 1,
      total_qty: 1,
    };
    setCountableEntries([...countableEntries, newRow]);
  };

  const handleDuplicateCountableRow = (row: CountableTakeoffEntry) => {
    const duplicated: CountableTakeoffEntry = {
      ...row,
      id: `countable-dup-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      location: `${row.location} (Copy)`,
    };
    setCountableEntries([...countableEntries, duplicated]);
  };

  const handleDeleteCountableRow = (id: string) => {
    setCountableEntries(countableEntries.filter(e => e.id !== id));
  };


  // Rebar BBS inline handlers
  const handleRebarCellChange = (id: string, field: string, val: any) => {
    setRebarEntries(prev => {
      const next = prev.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: val };

        // If simple shape variables or custom length changes
        const shapeA = parseDecimal(field === 'shape_a' ? val : updated.shape_a);
        const shapeB = parseDecimal(field === 'shape_b' ? val : updated.shape_b);
        const shapeC = parseDecimal(field === 'shape_c' ? val : updated.shape_c);
        
        let length = parseDecimal(updated.length);
        if (field === 'shape_a' || field === 'shape_b' || field === 'shape_c' || field === 'shape_type') {
          length = parseFloat(((shapeA || 0) + (shapeB || 0) + (shapeC || 0)).toFixed(3)) || length || 1.0;
          updated.length = length;
        } else if (field === 'length') {
          length = parseDecimal(val);
        }

        const noBars = parseDecimal(field === 'no_of_bars' ? val : updated.no_of_bars) || 1;
        const noMem = parseDecimal(field === 'no_of_members' ? val : updated.no_of_members) || 1;
        const totalBars = noBars * noMem;
        updated.total_no_of_bars = totalBars;

        const dia = parseInt(field === 'diameter' ? val : updated.diameter) || 12;
        const unitW = REBAR_UNIT_WEIGHTS[dia] || 0.888;
        updated.qty_kg = parseFloat((totalBars * length * unitW).toFixed(2));

        return updated;
      });
      return next;
    });
  };

  const handleAddRebarRow = (assignId: string) => {
    const newBar: RebarTakeoffEntry = {
      id: `rebar-new-${Date.now()}`,
      assignment_id: assignId,
      location: "New BBS segment...",
      shape_type: "straight",
      shape_a: 0,
      shape_b: 2.00,
      shape_c: 0,
      diameter: 12,
      length: 2.00,
      no_of_bars: 10,
      no_of_members: 1,
      total_no_of_bars: 10,
      qty_kg: 17.76,
    };
    setRebarEntries([...rebarEntries, newBar]);
  };

  const handleDuplicateRebarRow = (row: RebarTakeoffEntry) => {
    const duplicated: RebarTakeoffEntry = {
      ...row,
      id: `rebar-dup-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      location: `${row.location} (Copy)`,
    };
    setRebarEntries([...rebarEntries, duplicated]);
  };

  const handleDeleteRebarRow = (id: string) => {
    setRebarEntries(rebarEntries.filter(e => e.id !== id));
  };


  // Master inline sheets SAVING & STORAGE Sync
  const handleSaveSheet = async (assignment: SubcontractorAssignment) => {
    setSavingId(assignment.id);
    const type = takeoffTypes[assignment.id] || "standard";

    let totalSum = 0;
    try {
      if (type === "countable") {
        localStorage.setItem(`countable_entries_${assignment.id}`, JSON.stringify(countableEntries));
        totalSum = parseFloat(countableEntries.reduce((sum, e) => sum + (e.total_qty || 0), 0).toFixed(3));
      } else if (type === "rebar") {
        localStorage.setItem(`rebar_entries_${assignment.id}`, JSON.stringify(rebarEntries));
        totalSum = parseFloat(rebarEntries.reduce((sum, e) => sum + (e.qty_kg || 0), 0).toFixed(2));
      } else {
        localStorage.setItem(`takeoff_entries_${assignment.id}`, JSON.stringify(standardEntries));
        totalSum = parseFloat(standardEntries.reduce((sum, e) => sum + (e.qty || 0), 0).toFixed(3));

        // Sync standard takeoff_entries database catalog
        const entriesToUpload = standardEntries.map((e) => ({
          assignment_id: assignment.id,
          no_of: e.no_of,
          no_in_mem: e.no_in_mem,
          l: e.l,
          w: e.w,
          d: e.d,
          qty: e.qty,
          description: e.description,
          tenant_id: tenantId,
        }));

        await supabase.from("takeoff_entries").delete().eq("assignment_id", assignment.id);
        if (entriesToUpload.length > 0) {
          await supabase.from("takeoff_entries").insert(entriesToUpload);
        }
      }

      // Update Database surveyed_qty
      await supabase
        .from("subcontractor_assignments")
        .update({ surveyed_qty: totalSum })
        .eq("id", assignment.id);

      // Update state matrix
      setTakeoffSums(prev => ({ ...prev, [assignment.id]: totalSum }));
      
      // Update local storage backup representation
      localStorage.setItem(`surveyed_qty_assignment_${assignment.id}`, String(totalSum));

      alert(`Takeoff Survey sheet successfully saved! (${totalSum.toLocaleString()} ${type === 'rebar' ? 'Kg' : cleanRichText(assignment.boq_item?.unit || 'units')})`);
      setExpandedId(null);
    } catch (err: any) {
      console.warn("Could not sync with Supabase cloud database, secured offline backup:", err.message);
      setTakeoffSums(prev => ({ ...prev, [assignment.id]: totalSum }));
      setExpandedId(null);
    } finally {
      setSavingId(null);
    }
  };

  // EXCEL EXPORTERS matching tab specifications
  const handleExportExcel = async (assignment: SubcontractorAssignment) => {
    const type = takeoffTypes[assignment.id] || "standard";
    if (type === "standard") {
      await exportStandardExcel(assignment);
    } else if (type === "countable") {
      await exportCountableExcel(assignment);
    } else {
      await exportRebarExcel(assignment);
    }
  };

  const exportStandardExcel = async (assignment: SubcontractorAssignment) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Standard Dimensions Survey");

    worksheet.columns = [
      { width: 8, key: "idx" },
      { width: 12, key: "no_of" },
      { width: 12, key: "no_in_mem" },
      { width: 12, key: "l" },
      { width: 12, key: "w" },
      { width: 12, key: "d" },
      { width: 16, key: "qty" },
      { width: 45, key: "desc" },
    ];

    worksheet.mergeCells("A1", "H1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = localStorage.getItem('ceflot-tenant-company-name') || "CEFLOT ENTERPRISE";
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: "center" };

    worksheet.mergeCells("A2", "H2");
    const subTitle = worksheet.getCell("A2");
    subTitle.value = `AREA & VOLUMETRIC TAKEOFF DIMENSION SHEET`;
    subTitle.font = { size: 11, bold: true, underline: true };
    subTitle.alignment = { horizontal: "center" };

    worksheet.getCell("A4").value = "BOQ Ref:";
    worksheet.getCell("A4").font = { bold: true };
    worksheet.getCell("B4").value = assignment.boq_item?.item_no || "N/A";

    worksheet.getCell("D4").value = "BOQ Description:";
    worksheet.getCell("D4").font = { bold: true };
    worksheet.getCell("E4").value = cleanRichText(assignment.boq_item?.description || "");

    worksheet.getCell("A5").value = "Contractor Partner:";
    worksheet.getCell("A5").font = { bold: true };
    worksheet.getCell("B5").value = assignment.subcontractor?.company_name || "N/A";

    worksheet.getCell("D5").value = "Contract Specs:";
    worksheet.getCell("D5").font = { bold: true };
    worksheet.getCell("E5").value = `${assignment.contract_qty} ${assignment.boq_item?.unit || 'unit'}`;

    const header = worksheet.getRow(7);
    header.values = [
      "No",
      "No. of",
      "No in Mem",
      "Length (L)",
      "Width (W)",
      "Depth (D)",
      "Qty Result",
      "Specific Location Annotations / Details",
    ];
    header.font = { bold: true };
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    });

    // Populate lines
    const targetEntries = expandedId === assignment.id ? standardEntries : (() => {
      const stored = localStorage.getItem(`takeoff_entries_${assignment.id}`);
      return stored ? JSON.parse(stored) : [];
    })();

    let current = 8;
    targetEntries.forEach((e: any, idx: number) => {
      const row = worksheet.getRow(current);
      row.values = [
        idx + 1,
        e.no_of,
        e.no_in_mem,
        e.l || "-",
        e.w || "-",
        e.d || "-",
        e.qty,
        e.description
      ];
      row.eachCell((cell) => {
        cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      });
      current++;
    });

    const sumVal = takeoffSums[assignment.id] || 0;
    const totalRow = worksheet.getRow(current + 1);
    totalRow.getCell(6).value = "TOTAL SURVEYED:";
    totalRow.getCell(6).font = { bold: true };
    totalRow.getCell(7).value = sumVal;
    totalRow.getCell(7).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Standard_Takeoff_BOQ_${assignment.boq_item?.item_no || "ref"}.xlsx`);
  };

  const exportCountableExcel = async (assignment: SubcontractorAssignment) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Countables-Addables Survey");

    worksheet.columns = [
      { width: 8, key: "idx" },
      { width: 25, key: "location" },
      { width: 30, key: "size_name" },
      { width: 14, key: "length" },
      { width: 12, key: "count" },
      { width: 18, key: "total_qty" },
    ];

    worksheet.mergeCells("A1", "F1");
    worksheet.getCell("A1").value = localStorage.getItem('ceflot-tenant-company-name') || "CEFLOT ENTERPRISE";
    worksheet.getCell("A1").font = { size: 16, bold: true };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    worksheet.mergeCells("A2", "F2");
    worksheet.getCell("A2").value = `COUNTABLES & ADDABLE RUNNING SECTIONS MEASUREMENT SHEET`;
    worksheet.getCell("A2").font = { size: 11, bold: true, underline: true };
    worksheet.getCell("A2").alignment = { horizontal: "center" };

    worksheet.getCell("A4").value = "BOQ Ref:";
    worksheet.getCell("A4").font = { bold: true };
    worksheet.getCell("B4").value = assignment.boq_item?.item_no || "N/A";

    worksheet.getCell("D4").value = "BOQ Description:";
    worksheet.getCell("D4").font = { bold: true };
    worksheet.getCell("E4").value = cleanRichText(assignment.boq_item?.description || "");

    const header = worksheet.getRow(6);
    header.values = [
      "No",
      "Location / Member Block",
      "Dimension profile / size / Spec",
      "Unit Size/Length(m)",
      "Count Multiplier",
      "Total Qty (m)",
    ];
    header.font = { bold: true };
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    });

    const targetEntries = expandedId === assignment.id ? countableEntries : (() => {
      const stored = localStorage.getItem(`countable_entries_${assignment.id}`);
      return stored ? JSON.parse(stored) : [];
    })();

    let current = 7;
    targetEntries.forEach((e: any, idx: number) => {
      const row = worksheet.getRow(current);
      row.values = [
        idx + 1,
        e.location,
        e.size_name || "-",
        e.length,
        e.count,
        e.total_qty,
      ];
      row.eachCell((cell) => {
        cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      });
      current++;
    });

    const sumVal = takeoffSums[assignment.id] || 0;
    const totalRow = worksheet.getRow(current + 1);
    totalRow.getCell(5).value = "TOTAL SUM:";
    totalRow.getCell(5).font = { bold: true };
    totalRow.getCell(6).value = sumVal;
    totalRow.getCell(6).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Countables_Takeoff_BOQ_${assignment.boq_item?.item_no || "ref"}.xlsx`);
  };

  const exportRebarExcel = async (assignment: SubcontractorAssignment) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("BBS Scheduling Report");

    worksheet.columns = [
      { width: 22, key: "location" },
      { width: 12, key: "shape" },
      { width: 8, key: "diameter" },
      { width: 10, key: "length" },
      { width: 10, key: "no_bars" },
      { width: 10, key: "no_mem" },
      { width: 12, key: "total_bars" },
      { width: 10, key: "w6" },
      { width: 10, key: "w8" },
      { width: 10, key: "w10" },
      { width: 10, key: "w12" },
      { width: 10, key: "w14" },
      { width: 10, key: "w16" },
      { width: 10, key: "w20" },
      { width: 10, key: "w24" },
      { width: 10, key: "w32" },
    ];

    worksheet.mergeCells("A1", "P1");
    worksheet.getCell("A1").value = localStorage.getItem('ceflot-tenant-company-name') || "CEFLOT ENTERPRISE";
    worksheet.getCell("A1").font = { size: 16, bold: true };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    worksheet.mergeCells("A2", "P2");
    worksheet.getCell("A2").value = `REINFORCEMENT BAR BENDING SCHEDULE (BBS) - BOQ REF: ${assignment.boq_item?.item_no}`;
    worksheet.getCell("A2").font = { size: 11, bold: true, underline: true };
    worksheet.getCell("A2").alignment = { horizontal: "center" };

    // Subtitle block
    worksheet.getCell("A4").value = "BOQ Ref:";
    worksheet.getCell("A4").font = { bold: true };
    worksheet.getCell("B4").value = assignment.boq_item?.item_no || "N/A";

    worksheet.getCell("D4").value = "BOQ Description:";
    worksheet.getCell("D4").font = { bold: true };
    worksheet.getCell("E4").value = cleanRichText(assignment.boq_item?.description || "");

    const header = worksheet.getRow(6);
    header.values = [
      "Location / Member",
      "Shape Type",
      "Φ (mm)",
      "Length (m)",
      "No of bars",
      "No of members",
      "Total bars",
      "6", "8", "10", "12", "14", "16", "20", "24", "32"
    ];
    header.font = { bold: true };
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } };
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    });

    const targetEntries = expandedId === assignment.id ? rebarEntries : (() => {
      const stored = localStorage.getItem(`rebar_entries_${assignment.id}`);
      return stored ? JSON.parse(stored) : [];
    })();

    let current = 7;
    targetEntries.forEach((r: any) => {
      const row = worksheet.getRow(current);
      const totalLength = r.total_no_of_bars * r.length;

      const rowVals: any[] = [
        r.location,
        r.shape_type,
        r.diameter,
        r.length,
        r.no_of_bars,
        r.no_of_members,
        r.total_no_of_bars,
      ];

      REBAR_DIAMETERS.forEach((dia) => {
        rowVals.push(r.diameter === dia ? parseFloat(totalLength.toFixed(2)) : "-");
      });

      row.values = rowVals;
      row.eachCell((cell) => {
        cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      });
      current++;
    });

    // Length calculations row
    const totalLenRow = worksheet.getRow(current + 1);
    totalLenRow.getCell(1).value = "Total Length (m)";
    totalLenRow.getCell(1).font = { bold: true };
    REBAR_DIAMETERS.forEach((dia, idx) => {
      const colIdx = 8 + idx;
      const sumLength = targetEntries
        .filter((r: any) => r.diameter === dia)
        .reduce((sum: number, r: any) => sum + (r.total_no_of_bars * r.length), 0);
      totalLenRow.getCell(colIdx).value = sumLength > 0 ? parseFloat(sumLength.toFixed(2)) : "-";
      totalLenRow.getCell(colIdx).font = { bold: true };
    });

    // Weights row
    const weightRow = worksheet.getRow(current + 2);
    weightRow.getCell(1).value = "Unit Weight (Kg/m)";
    weightRow.getCell(1).font = { bold: true, italic: true };
    REBAR_DIAMETERS.forEach((dia, idx) => {
      const colIdx = 8 + idx;
      weightRow.getCell(colIdx).value = REBAR_UNIT_WEIGHTS[dia];
    });

    // Sum weights row
    const totalWRow = worksheet.getRow(current + 3);
    totalWRow.getCell(1).value = "Total Weight (Kg)";
    totalWRow.getCell(1).font = { bold: true };
    REBAR_DIAMETERS.forEach((dia, idx) => {
      const colIdx = 8 + idx;
      const sumLength = targetEntries
        .filter((r: any) => r.diameter === dia)
        .reduce((sum: number, r: any) => sum + (r.total_no_of_bars * r.length), 0);
      const totalWeight = sumLength * REBAR_UNIT_WEIGHTS[dia];
      totalWRow.getCell(colIdx).value = totalWeight > 0 ? parseFloat(totalWeight.toFixed(2)) : "-";
      totalWRow.getCell(colIdx).font = { bold: true };
    });

    const sumVal = takeoffSums[assignment.id] || 0;
    const finalRow = worksheet.getRow(current + 5);
    finalRow.getCell(1).value = "CUMULATIVE BBS REBAR TOTAL (KG):";
    finalRow.getCell(1).font = { bold: true, size: 11 };
    finalRow.getCell(7).value = sumVal;
    finalRow.getCell(7).font = { bold: true, size: 11 };

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Rebar_BBS_BOQ_${assignment.boq_item?.item_no || "ref"}.xlsx`);
  };

  const handleExportMasterSummary = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Master Takeoff Register");

      worksheet.columns = [
        { width: 12, key: "boq_ref" },
        { width: 45, key: "desc" },
        { width: 14, key: "class" },
        { width: 10, key: "unit" },
        { width: 14, key: "contract_qty" },
        { width: 14, key: "surveyed_qty" },
        { width: 14, key: "ratio" },
        { width: 25, key: "partner" },
      ];

      worksheet.mergeCells("A1", "H1");
      const title = worksheet.getCell("A1");
      title.value = localStorage.getItem('ceflot-tenant-company-name') || "CEFLOT ENTERPRISE";
      title.font = { size: 16, bold: true };
      title.alignment = { horizontal: "center" };

      worksheet.mergeCells("A2", "H2");
      const sub = worksheet.getCell("A2");
      sub.value = `MASTER QUANTITY TAKE-OFF & SURVEY MODULES - PROJECT: ${project?.name}`;
      sub.font = { size: 11, bold: true, underline: true };
      sub.alignment = { horizontal: "center" };

      const head = worksheet.getRow(4);
      head.values = [
        "BOQ Ref",
        "Assigned Task Activity / BOQ Description",
        "Takeoff Class",
        "Unit",
        "Contract Qty",
        "Surveyed Qty",
        "Progress (%)",
        "Subcontractor Partner",
      ];
      head.font = { bold: true };
      head.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
        cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      });

      let current = 5;
      assignments.forEach((a) => {
        const type = takeoffTypes[a.id] || "standard";
        const sumVal = takeoffSums[a.id] || 0;
        const ratio = a.contract_qty > 0 ? (sumVal / a.contract_qty) * 100 : 0;

        const row = worksheet.getRow(current);
        row.values = [
          a.boq_item?.item_no || "N/A",
          cleanRichText(a.boq_item?.description || ""),
          type === "rebar" ? "Rebar BBS" : type === "countable" ? "Countable & Addable" : "Standard Volumetric",
          cleanRichText(type === 'rebar' ? 'Kg' : (a.boq_item?.unit || 'unit')),
          a.contract_qty,
          sumVal,
          parseFloat(ratio.toFixed(1)),
          a.subcontractor?.company_name || "N/A",
        ];
        row.eachCell((cell) => {
          cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
        });
        current++;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Master_Quantity_Takeoffs_${project?.project_code || "report"}.xlsx`);
    } catch (e: any) {
      alert("Error generating master spreadsheet reports: " + e.message);
    }
  };

  const handleSelectRow = (assignmentId: string, val: boolean) => {
    setSelectedIds(prev => ({ ...prev, [assignmentId]: val }));
  };

  const handleSelectAll = (val: boolean) => {
    const updated: Record<string, boolean> = {};
    activeAssignmentsOnly.forEach(a => {
      updated[a.id] = val;
    });
    setSelectedIds(updated);
  };

  const isAllSelected = activeAssignmentsOnly.length > 0 && activeAssignmentsOnly.every(a => selectedIds[a.id]);

  if (!project) {
    return (
      <div className="py-24 text-center bg-surface-1 border border-dashed border-border-subtle rounded-3xl mx-1 max-w-4xl mx-auto my-12 text-main">
        <Briefcase className="w-12 h-12 text-ghost mx-auto mb-4 opacity-20" />
        <h3 className="text-lg font-black text-main uppercase tracking-tight">
          Project Context Required
        </h3>
        <p className="text-sm text-dim mt-2 max-w-sm mx-auto">
          Takeoff Surveying sheets are project-specific. Please select an active project to analyze subcontractor quantities.
        </p>
        <button
          onClick={onSelectProject}
          className="btn btn-accent btn-sm mt-6 shadow-xl shadow-accent/20"
        >
          Open Project Selection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-main animate-in fade-in duration-300 pb-20">
      {/* Overview Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-mono font-medium tracking-wider text-ghost uppercase">
            <span>Planning</span>
            <span className="text-border-subtle">/</span>
            <span className="text-primary font-bold font-black">Quantity Takeoff Sheets</span>
          </div>
          <h1 className="text-2xl font-black text-main uppercase tracking-tighter mt-1">
            Subcontractor Takeoff Sheets Builder
          </h1>
          <p className="text-xs text-dim mt-1 max-w-xl">
            Register and structure your detailed survey takeoffs. Reclassify items between three measurement types below, then bulk edit sheets directly in the table view.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleExportMasterSummary}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-base border border-border-subtle hover:border-primary hover:text-primary text-main transition-all rounded-xl text-xs font-bold"
          >
            <Download className="w-4 h-4 text-primary" />
            Master Spreadsheet Export
          </button>
        </div>
      </div>

      {/* Aggregate Stats Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-4.5 border-l-4 border-l-primary relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Calculator className="w-12 h-12 text-primary" />
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-ghost mb-1">
            Standard Takeoffs
          </div>
          <div className="text-lg font-black text-main font-mono">
            {stats.standardCount} <span className="text-xs text-ghost font-sans lowercase">assigned</span>
          </div>
          <div className="text-[9px] text-ghost mt-1.5 uppercase font-bold tracking-wide">
            Area & Volumetric
          </div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-4.5 border-l-4 border-l-accent relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Layers className="w-12 h-12 text-accent" />
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-ghost mb-1">
            Countables & Addables
          </div>
          <div className="text-lg font-black text-main font-mono">
            {stats.countableCount} <span className="text-xs text-ghost font-sans lowercase">assigned</span>
          </div>
          <div className="text-[9px] text-accent mt-1.5 uppercase font-bold tracking-wide">
            Profiles & Running Sections
          </div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-4.5 border-l-4 border-l-success relative overflow-hidden shadow-sm">
          <div className="absolute top-1 right-0 p-4 opacity-5">
            <CheckCircle className="w-12 h-12 text-success" />
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-ghost mb-1">
            Reinforcement BBS
          </div>
          <div className="text-lg font-black text-main font-mono">
            {stats.rebarCount} <span className="text-xs text-ghost font-sans lowercase">assigned</span>
          </div>
          <div className="text-[9px] text-ghost mt-1.5 uppercase font-bold tracking-wide">
            Structural bars schedules
          </div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-4.5 bg-gradient-to-br from-accent/5 to-transparent shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-accent mb-1">
              Overall Baseline Survey Ratio
            </div>
            <div className="text-lg font-black text-accent font-mono">
              {stats.ratio.toFixed(1)}%
            </div>
          </div>
          <div className="w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, stats.ratio)}%` }}
            />
          </div>
        </div>
      </div>

      {/* TABS CONTROLLERS - Before Editing */}
      <div className="flex border-b border-border-subtle bg-surface-2 p-1.5 rounded-2xl gap-3 w-fit font-sans">
        <button
          onClick={() => { setActiveTab("standard"); setExpandedId(null); }}
          className={cn(
            "py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
            activeTab === "standard"
              ? "bg-surface-1 text-primary shadow-sm border border-border-subtle"
              : "text-ghost hover:text-main"
          )}
        >
          <Table className="w-4 h-4 text-primary" />
          1. Area & Volumetric ({stats.standardCount})
        </button>
        <button
          onClick={() => { setActiveTab("countable"); setExpandedId(null); }}
          className={cn(
            "py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
            activeTab === "countable"
              ? "bg-surface-1 text-accent shadow-sm border border-border-subtle"
              : "text-ghost hover:text-main"
          )}
        >
          <Layers className="w-4 h-4 text-accent" />
          2. Countable & Addable ({stats.countableCount})
        </button>
        <button
          onClick={() => { setActiveTab("rebar"); setExpandedId(null); }}
          className={cn(
            "py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
            activeTab === "rebar"
              ? "bg-surface-1 text-success shadow-sm border border-border-subtle"
              : "text-ghost hover:text-main"
          )}
        >
          <Calculator className="w-4 h-4 text-success" />
          3. Reinforcement Bars ({stats.rebarCount})
        </button>
      </div>

      {/* Main Panel Content */}
      <div className="bg-surface-1 border border-border-subtle rounded-3xl p-6 shadow-sm space-y-6">
        
        {/* Search / filter panel */}
        <div className="flex flex-col md:flex-row gap-3 justify-between items-center bg-surface-2/30 p-3 rounded-2xl border border-border-subtle/50">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
            <input
              type="text"
              placeholder="Search BOQ ref, subcontractor, description..."
              className="w-full bg-surface-base border border-border-subtle rounded-xl py-2 pl-9 pr-4 text-xs font-semibold focus:outline-none focus:border-primary text-main"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto self-end md:self-center">
            <span className="text-xs font-bold text-ghost uppercase tracking-wide">
              Subcontractor Filter:
            </span>
            <select
              className="bg-surface-base border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-main outline-none focus:border-primary cursor-pointer w-full md:w-48 text-main"
              value={selectedSubcontractor}
              onChange={(e) => setSelectedSubcontractor(e.target.value)}
            >
              {uniqueSubcontractors.map((vendor) => (
                <option key={vendor} value={vendor}>
                  {vendor}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Master table list grouped by tab */}
        <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-base">
          {loading ? (
            <div className="py-24 text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-mono text-ghost uppercase tracking-widest">
                Syncing with measurement registers...
              </p>
            </div>
          ) : filteredTreeNodes.length === 0 ? (
            <div className="py-20 text-center">
              <Info className="w-10 h-10 text-ghost mx-auto mb-3 opacity-30" />
              <p className="text-ghost text-xs font-bold uppercase tracking-widest opacity-70">
                No active subcontractor items in this category.
              </p>
              <p className="text-[11px] text-dim mt-1">
                You can assign other items to this category using the Takeoff Class selectors in other tabs!
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="bg-surface-base border-b border-border-subtle">
                  <th className="px-4 py-2 font-mono text-[9px] font-black uppercase text-ghost tracking-widest w-12 text-center border-b border-border-subtle">
                    <button
                      type="button"
                      onClick={() => handleSelectAll(!isAllSelected)}
                      className="text-ghost hover:text-primary transition-colors cursor-pointer inline-flex items-center justify-center p-1"
                      title={isAllSelected ? "Deselect All" : "Select All"}
                    >
                      {isAllSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-primary animate-in zoom-in-95 duration-100" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-2 font-mono text-[9px] font-black uppercase text-ghost tracking-widest w-24 border-b border-border-subtle">
                    BOQ Ref
                  </th>
                  <th className="px-4 py-2 font-mono text-[9px] font-black uppercase text-ghost tracking-widest border-b border-border-subtle">
                    Assigned Task Activity / BOQ Description
                  </th>
                  <th className="px-4 py-2 font-mono text-[9px] font-black uppercase text-ghost tracking-widest w-36 border-b border-border-subtle">
                    Vendor Partner
                  </th>
                  <th className="px-4 py-2 font-mono text-[9px] font-black uppercase text-ghost tracking-widest w-28 text-center border-b border-border-subtle">
                    Takeoff Class
                  </th>
                  <th className="px-4 py-2 font-mono text-[9px] font-black uppercase text-ghost tracking-widest w-20 text-center border-b border-border-subtle">
                    Unit
                  </th>
                  <th className="px-4 py-2 font-mono text-[9px] font-black uppercase text-ghost tracking-widest w-28 text-right border-b border-border-subtle">
                    Contract Qty
                  </th>
                  <th className="px-4 py-2 font-mono text-[9px] font-black uppercase text-ghost tracking-widest w-28 text-right bg-primary/[0.02] border-b border-border-subtle">
                    Survey Qty
                  </th>
                  <th className="px-4 py-2 font-mono text-[9px] font-black uppercase text-ghost tracking-widest w-24 text-center border-b border-border-subtle">
                    Ratio (%)
                  </th>
                  <th className="px-4 py-2 font-mono text-[9px] font-black uppercase text-ghost tracking-widest w-30 text-center border-b border-border-subtle">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50 font-semibold text-xs text-main">
                {filteredTreeNodes.map((node) => {
                  if (!isItemVisible(node.item_no)) return null;

                  const isParent = node.hasChildren || !node.assignment;
                  const itemKey = isParent ? `parent-${node.id}` : node.assignment!.id;
                  const level = getItemLevel(node.item_no);
                  const { contractSum, surveySum } = getCumulativeStats(node.item_no);
                  if (isParent) {
                    return (
                      <tr key={itemKey} className="bg-surface-2/40 cursor-default hover:bg-surface-2 transition-colors border-b border-border-subtle/30 border-l-2 border-l-primary/50 text-xs font-bold">
                        {/* Checkbox empty spacer */}
                        <td className="px-4 py-2 text-center"></td>
                        
                        {/* BOQ Ref with hierarchical indentation */}
                        <td className="px-4 py-2 font-mono text-[11px] text-accent font-bold">
                          <div className="flex items-center gap-1.5" style={{ paddingLeft: `${level * 16}px` }}>
                            {node.hasChildren && (
                              <button
                                onClick={(e) => toggleItemCollapse(node.item_no || '', e)}
                                className="p-0.5 rounded hover:bg-surface-3 transition-colors text-primary shrink-0 z-10"
                              >
                                {expandedItems.has(node.item_no || '') ? (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                            {!node.hasChildren && <div className="w-4.5 shrink-0" />}
                            <span onClick={(e) => node.hasChildren && toggleItemCollapse(node.item_no || '', e)} className="cursor-pointer font-bold hover:underline">
                              {node.item_no || "N/A"}
                            </span>
                          </div>
                        </td>

                        {/* Description */}
                        <td className="px-4 py-2 text-main font-bold">
                          <div className="truncate max-w-md text-[12px] font-semibold text-main cursor-pointer" 
                               title={cleanRichText(node.description || "")}
                               onClick={(e) => node.hasChildren && toggleItemCollapse(node.item_no || '', e)}>
                             {cleanRichText(node.description || "")}
                           </div>
                        </td>

                        {/* Vendor Partner spacer */}
                        <td className="px-4 py-2 text-ghost font-bold text-[11px] truncate select-none"></td>

                        {/* Takeoff Class space */}
                        <td className="px-4 py-2 text-center text-ghost text-[11px] font-mono select-none"></td>

                        {/* Unit */}
                        <td className="px-4 py-2 text-center text-ghost text-[11px] font-mono select-none">
                          {cleanRichText(node.unit || "")}
                        </td>

                        {/* Contract Qty (cumulative) */}
                        <td className="px-4 py-2 text-right font-mono text-ghost font-medium select-none"></td>

                        {/* Survey Qty (cumulative) */}
                        <td className="px-4 py-2 text-right font-mono text-ghost font-medium select-none bg-primary/[0.01]"></td>

                        {/* Ratio */}
                        <td className="px-4 py-2 text-center font-mono text-[10px] text-ghost font-medium select-none"></td>

                        {/* Edit sheet spacer */}
                        <td className="px-4 py-2 text-center select-none"></td>
                      </tr>
                    );
                  }

                  const a = node.assignment!;
                  const sSum = takeoffSums[a.id] || 0;
                  const assignRatioVal = a.contract_qty > 0 ? (sSum / a.contract_qty) * 100 : 0;
                  const isExpanded = expandedId === a.id;

                  return (
                    <React.Fragment key={a.id}>
                      <tr className={cn(
                        "hover:bg-surface-2/40 transition-colors group border-b border-border-subtle/30 text-xs font-medium text-dim/90",
                        selectedIds[a.id] ? "bg-primary/5" : "",
                        isExpanded ? "bg-primary/[0.02]" : ""
                      )}>
                        <td className="px-4 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleSelectRow(a.id, !selectedIds[a.id])}
                            className="text-ghost hover:text-primary transition-colors cursor-pointer inline-flex items-center justify-center p-1"
                            title={selectedIds[a.id] ? "Deselect Item" : "Select Item"}
                          >
                            {selectedIds[a.id] ? (
                              <CheckSquare className="w-3.5 h-3.5 text-primary animate-in zoom-in-95 duration-100" />
                            ) : (
                              <Square className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-1.5 font-mono text-ghost text-[11px]/snug">
                          <div className="flex items-center gap-1.5" style={{ paddingLeft: `${level * 16}px` }}>
                            {node.hasChildren && (
                              <button
                                onClick={(e) => toggleItemCollapse(node.item_no || '', e)}
                                className="p-0.5 rounded hover:bg-surface-3 transition-colors text-primary shrink-0 z-10"
                              >
                                {expandedItems.has(node.item_no || '') ? (
                                  <ChevronDown className="w-3 h-3" />
                                ) : (
                                  <ChevronRight className="w-3 h-3" />
                                )}
                              </button>
                            )}
                            {!node.hasChildren && <div className="w-4.5 shrink-0" />}
                            <span>{a.boq_item?.item_no || "N/A"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-1.5 text-dim/90 select-text">
                          <div className="line-clamp-2 text-[12px] font-normal leading-tight" title={cleanRichText(a.boq_item?.description || "")}>
                            {cleanRichText(a.boq_item?.description || "")}
                          </div>
                        </td>
                        <td className="px-4 py-1.5 text-ghost font-bold text-[11px] truncate select-text" title={a.subcontractor?.company_name}>
                          {a.subcontractor?.company_name}
                        </td>
                        <td className="px-4 py-1.5 text-center">
                          <select
                            className="bg-surface-base border border-border-subtle rounded-lg px-2 py-0.5 text-[10px] font-black text-main uppercase outline-none focus:border-primary cursor-pointer w-full"
                            value={takeoffTypes[a.id] || "standard"}
                            onChange={(e) => handleAssignType(a.id, e.target.value as any)}
                          >
                            <option value="standard">Standard Vol</option>
                            <option value="countable">Countable</option>
                            <option value="rebar">Rebar BBS</option>
                          </select>
                        </td>
                        <td className="px-4 py-1.5 text-center text-ghost text-[11px] font-mono">
                          {cleanRichText(activeTab === 'rebar' ? 'Kg' : (a.boq_item?.unit || 'unit'))}
                        </td>
                        <td className="px-4 py-1.5 text-right font-mono text-dim text-[11px]">
                          {(a.contract_qty || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-1.5 text-right font-mono text-accent font-bold bg-primary/[0.015] text-[11px]">
                          {sSum.toLocaleString()}
                        </td>
                        <td className="px-4 py-1.5 text-center font-mono text-[10px] text-accent font-semibold">
                          {assignRatioVal.toFixed(1)}%
                        </td>
                        <td className="px-4 py-1.5 text-center font-semibold">
                          <button
                            onClick={() => handleToggleExpand(a)}
                            title={isExpanded ? "Close Sheet Editor" : "Edit Sheet Dimensions"}
                            className={cn(
                              "p-1.5 rounded-lg transition-all inline-flex items-center justify-center hover:bg-surface-3 text-ghost hover:text-primary border border-transparent hover:border-border-subtle shadow-xs",
                              isExpanded ? "bg-primary/10 text-primary border-primary/20" : "bg-surface-base border-border-subtle"
                            )}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <Edit className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Inline Expanded Sheet Editor container */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={10} className="bg-surface-2/40 px-6 py-6 border-b-2 border-border-subtle animate-in slide-in-from-top-2 duration-300">
                            <div className="bg-surface-1 rounded-2xl border border-border-subtle overflow-hidden shadow-lg p-5 space-y-4">
                              
                              {/* Sub Header info */}
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-2 p-4 rounded-xl border border-border-subtle/50">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-wide font-mono px-2 py-0.5 bg-accent/10 text-accent rounded">
                                      Class: {activeTab === "standard" ? "Standard Volumetric Dimension" : activeTab === "countable" ? "Countables & Running Sections" : "Reinforcement scheduling (BBS)"}
                                    </span>
                                    <span className="text-[11px] font-bold text-ghost">
                                      Inline Active Spreadsheet
                                    </span>
                                  </div>
                                  <h4 className="text-sm font-black text-main uppercase tracking-tight mt-1.5 break-all">
                                    {cleanRichText(a.boq_item?.description || "")}
                                  </h4>
                                </div>

                                <div className="flex items-center gap-2.5 shrink-0 align-middle">
                                  <button
                                    onClick={() => handleExportExcel(a)}
                                    className="p-2 bg-surface-base border border-border-subtle hover:border-primary hover:text-primary text-ghost rounded-lg title='Export spreadsheet' transition-all"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>

                                  <button
                                    disabled={savingId === a.id}
                                    onClick={() => handleSaveSheet(a)}
                                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/95 transition-all font-black text-xs uppercase tracking-widest flex items-center gap-1.5 shadow-md"
                                  >
                                    {savingId === a.id ? (
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Save className="w-4 h-4" />
                                    )}
                                    Save & Sync Sheet
                                  </button>
                                </div>
                              </div>

                              {/* SPREADSHEETS - Bulk grid inputs (every cell editable!) */}
                              
                              {activeTab === "standard" && (
                                <div className="space-y-4">
                                  <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-base">
                                    <table className="w-full text-left border-collapse table-fixed">
                                      <thead>
                                        <tr className="bg-surface-2 border-b border-border-subtle text-[10px] font-black uppercase tracking-wider text-ghost">
                                          <th className="px-3 py-2.5 w-12 text-center">#</th>
                                          <th className="px-2 py-2.5 w-20 text-center">No. of</th>
                                          <th className="px-2 py-2.5 w-20 text-center">No. in Mem</th>
                                          <th className="px-2 py-2.5 w-24 text-center">Length L(m)</th>
                                          <th className="px-2 py-2.5 w-24 text-center">Width W(m)</th>
                                          <th className="px-2 py-2.5 w-24 text-center">Depth D(m)</th>
                                          <th className="px-3 py-2.5 w-32 text-right">Result Qty</th>
                                          <th className="px-3 py-2.5 text-left">Line Location Details / Axe annotations</th>
                                          <th className="px-2 py-2.5 w-20 text-center">Action</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border-subtle/50 text-xs">
                                        {standardEntries.length === 0 ? (
                                          <tr>
                                            <td colSpan={9} className="py-8 text-center text-ghost text-[11px] font-bold uppercase tracking-widest opacity-60">
                                              No rows. Click "+ Add Line Row" to begin.
                                            </td>
                                          </tr>
                                        ) : (
                                          standardEntries.map((item, idx) => (
                                            <tr key={item.id} className="hover:bg-primary/[0.01]">
                                              <td className="px-3 py-1.5 text-center font-mono font-bold text-ghost">
                                                {idx + 1}
                                              </td>
                                              <td className="px-1 py-1 text-center font-mono">
                                                <input
                                                  type="number"
                                                  step="any"
                                                  className="w-full bg-surface-1 border border-border-subtle rounded px-2 py-1 text-center font-mono text-xs focus:border-primary font-bold outline-none text-main"
                                                  value={item.no_of}
                                                  onChange={(e) => handleStandardCellChange(item.id, 'no_of', e.target.value)}
                                                />
                                              </td>
                                              <td className="px-1 py-1 text-center font-mono">
                                                <input
                                                  type="number"
                                                  step="any"
                                                  className="w-full bg-surface-1 border border-border-subtle rounded px-2 py-1 text-center font-mono text-xs focus:border-primary outline-none text-main"
                                                  value={item.no_in_mem}
                                                  onChange={(e) => handleStandardCellChange(item.id, 'no_in_mem', e.target.value)}
                                                />
                                              </td>
                                              <td className="px-1 py-1 text-center font-mono">
                                                <input
                                                  type="number"
                                                  step="any"
                                                  className="w-full bg-surface-1 border border-border-subtle rounded px-2 py-1 text-center font-mono text-xs focus:border-primary outline-none text-main"
                                                  value={item.l ?? ""}
                                                  placeholder="-"
                                                  onChange={(e) => handleStandardCellChange(item.id, 'l', e.target.value)}
                                                />
                                              </td>
                                              <td className="px-1 py-1 text-center font-mono">
                                                <input
                                                  type="number"
                                                  step="any"
                                                  className="w-full bg-surface-1 border border-border-subtle rounded px-2 py-1 text-center font-mono text-xs focus:border-primary outline-none text-main"
                                                  value={item.w ?? ""}
                                                  placeholder="-"
                                                  onChange={(e) => handleStandardCellChange(item.id, 'w', e.target.value)}
                                                />
                                              </td>
                                              <td className="px-1 py-1 text-center font-mono">
                                                <input
                                                  type="number"
                                                  step="any"
                                                  className="w-full bg-surface-1 border border-border-subtle rounded px-2 py-1 text-center font-mono text-xs focus:border-primary outline-none text-main"
                                                  value={item.d ?? ""}
                                                  placeholder="-"
                                                  onChange={(e) => handleStandardCellChange(item.id, 'd', e.target.value)}
                                                />
                                              </td>
                                              <td className="px-3 py-1.5 text-right font-mono font-black text-primary text-[11px]">
                                                {item.qty.toLocaleString()}
                                              </td>
                                              <td className="px-1 py-1">
                                                <input
                                                  type="text"
                                                  className="w-full bg-surface-1 border border-border-subtle rounded px-2 py-1 text-xs focus:border-primary outline-none text-main font-semibold"
                                                  value={item.description}
                                                  onChange={(e) => handleStandardCellChange(item.id, 'description', e.target.value)}
                                                />
                                              </td>
                                              <td className="px-1 py-1 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                  <button
                                                    onClick={() => handleDuplicateStandardRow(item)}
                                                    className="p-1 hover:bg-accent/15 text-ghost hover:text-accent rounded"
                                                    title="Duplicate Row"
                                                  >
                                                    <Copy className="w-3.5 h-3.5" />
                                                  </button>
                                                  <button
                                                    onClick={() => handleDeleteStandardRow(item.id)}
                                                    className="p-1 hover:bg-error/15 text-ghost hover:text-error rounded"
                                                    title="Delete Row"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          ))
                                        )}
                                      </tbody>
                                    </table>
                                  </div>

                                  <div className="flex justify-between items-center text-xs">
                                    <button
                                      onClick={() => handleAddStandardRow(a.id)}
                                      className="btn btn-outline border-border-subtle btn-sm flex items-center gap-1 text-ghost hover:text-main"
                                    >
                                      <Plus className="w-4 h-4 text-primary" />
                                      Add Line Row (L x W x D)
                                    </button>
                                    <div className="text-right text-ghost font-bold text-[11px] uppercase tracking-wider">
                                       Active Sheet Total: <span className="font-mono text-sm text-primary font-black ml-1.5">
                                         {parseFloat(standardEntries.reduce((sum, e) => sum + (e.qty || 0), 0).toFixed(3)).toLocaleString()}{" "}
                                         {cleanRichText(a.boq_item?.unit || "units")}
                                       </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {activeTab === "countable" && (
                                <div className="space-y-4">
                                  <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-base">
                                    <table className="w-full text-left border-collapse table-fixed">
                                      <thead>
                                        <tr className="bg-surface-2 border-b border-border-subtle text-[10px] font-black uppercase tracking-wider text-ghost">
                                          <th className="px-3 py-2.5 w-12 text-center">#</th>
                                          <th className="px-3 py-2.5 text-left">Location / Member / Window Code</th>
                                          <th className="px-3 py-2.5 text-left w-64">Section Size / Profile details</th>
                                          <th className="px-2 py-2.5 w-40 text-center">Unit Length / Size (m)</th>
                                          <th className="px-2 py-2.5 w-32 text-center font-bold">Count / Multiplier</th>
                                          <th className="px-3 py-2.5 w-40 text-right bg-primary/[0.01]">Total Qty (m)</th>
                                          <th className="px-2 py-2.5 w-20 text-center">Action</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border-subtle/50 text-xs">
                                        {countableEntries.length === 0 ? (
                                          <tr>
                                            <td colSpan={7} className="py-8 text-center text-ghost text-[11px] font-bold uppercase tracking-widest opacity-60">
                                              No countable rows. Click "+ Add Countable item" to start.
                                            </td>
                                          </tr>
                                        ) : (
                                          countableEntries.map((item, idx) => (
                                            <tr key={item.id} className="hover:bg-primary/[0.01]">
                                              <td className="px-3 py-1.5 text-center font-mono font-bold text-ghost">
                                                {idx + 1}
                                              </td>
                                              <td className="px-1 py-1">
                                                <input
                                                  type="text"
                                                  className="w-full bg-surface-1 border border-border-subtle rounded px-2 py-1 text-xs focus:border-primary outline-none text-main font-semibold"
                                                  value={item.location}
                                                  onChange={(e) => handleCountableCellChange(item.id, 'location', e.target.value)}
                                                />
                                              </td>
                                              <td className="px-1 py-1">
                                                <input
                                                  type="text"
                                                  className="w-full bg-surface-1 border border-border-subtle rounded px-2 py-1 text-xs focus:border-primary outline-none text-main"
                                                  value={item.size_name || ""}
                                                  placeholder="e.g. 50x50x4mm RHS bar..."
                                                  onChange={(e) => handleCountableCellChange(item.id, 'size_name', e.target.value)}
                                                />
                                              </td>
                                              <td className="px-1 py-1 text-center font-mono">
                                                <input
                                                  type="number"
                                                  step="any"
                                                  className="w-full bg-surface-1 border border-border-subtle rounded px-2 py-1 text-center font-mono text-xs focus:border-primary outline-none text-main font-bold"
                                                  value={item.length}
                                                  onChange={(e) => handleCountableCellChange(item.id, 'length', e.target.value)}
                                                />
                                              </td>
                                              <td className="px-1 py-1 text-center font-mono">
                                                <input
                                                  type="number"
                                                  step="any"
                                                  className="w-full bg-surface-1 border border-border-subtle rounded px-2 py-1 text-center font-mono text-xs focus:border-primary outline-none text-main font-black"
                                                  value={item.count}
                                                  onChange={(e) => handleCountableCellChange(item.id, 'count', e.target.value)}
                                                />
                                              </td>
                                              <td className="px-3 py-1.5 text-right font-mono font-black text-primary text-[11px] bg-primary/[0.01]">
                                                {item.total_qty.toLocaleString()} <span className="text-[10px] text-ghost font-sans lowercase">m</span>
                                              </td>
                                              <td className="px-1 py-1 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                  <button
                                                    onClick={() => handleDuplicateCountableRow(item)}
                                                    className="p-1 hover:bg-accent/15 text-ghost hover:text-accent rounded"
                                                    title="Duplicate row"
                                                  >
                                                    <Copy className="w-3.5 h-3.5" />
                                                  </button>
                                                  <button
                                                    onClick={() => handleDeleteCountableRow(item.id)}
                                                    className="p-1 hover:bg-error/15 text-ghost hover:text-error rounded"
                                                    title="Delete row"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          ))
                                        )}
                                      </tbody>
                                    </table>
                                  </div>

                                  <div className="flex justify-between items-center text-xs">
                                    <button
                                      onClick={() => handleAddCountableRow(a.id)}
                                      className="btn btn-outline border-border-subtle btn-sm flex items-center gap-1 text-ghost hover:text-main"
                                    >
                                      <Plus className="w-4 h-4 text-primary" />
                                      Add Countable Item
                                    </button>
                                    <div className="text-right text-ghost font-bold text-[11px] uppercase tracking-wider">
                                       Running Total lengths: <span className="font-mono text-sm text-primary font-black ml-1.5">
                                         {parseFloat(countableEntries.reduce((sum, e) => sum + (e.total_qty || 0), 0).toFixed(3)).toLocaleString()} m
                                       </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {activeTab === "rebar" && (
                                <div className="space-y-4">
                                  <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-base">
                                    <table className="w-full text-left border-collapse table-fixed">
                                      <thead>
                                        <tr className="bg-surface-2 border-b border-border-subtle text-[9px] font-black uppercase tracking-wider text-ghost">
                                          <th className="px-3 py-2 w-10 text-center">#</th>
                                          <th className="px-3 py-2 text-left w-36">Location</th>
                                          <th className="px-2 py-2 text-center w-28">Shape Profile</th>
                                          <th className="px-2 py-2 text-center w-16">Φ (mm)</th>
                                          <th className="px-1 py-1 text-center w-14">A (m)</th>
                                          <th className="px-1 py-1 text-center w-14">B (m)</th>
                                          <th className="px-1 py-1 text-center w-14">C (m)</th>
                                          <th className="px-2 py-2 text-center w-20">Length (m)</th>
                                          <th className="px-2 py-2 text-center w-16">Bars</th>
                                          <th className="px-2 py-2 text-center w-16">Mem</th>
                                          <th className="px-2 py-2 text-center w-16 font-bold">Total Bars</th>
                                          <th className="px-3 py-2 text-right w-28 text-success font-bold">Weight (Kg)</th>
                                          <th className="px-2 py-2 w-16 text-center">Action</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border-subtle/50 text-xs">
                                        {rebarEntries.length === 0 ? (
                                          <tr>
                                            <td colSpan={13} className="py-8 text-center text-ghost text-[11px] font-bold uppercase tracking-widest opacity-60">
                                              No scheduled rebars. Click "+ Add Rebar Line" to start BBS.
                                            </td>
                                          </tr>
                                        ) : (
                                          rebarEntries.map((item, idx) => (
                                            <tr key={item.id} className="hover:bg-primary/[0.01]">
                                              <td className="px-3 py-1.5 text-center font-mono font-bold text-ghost">
                                                {idx + 1}
                                              </td>
                                              <td className="px-1 py-1">
                                                <input
                                                  type="text"
                                                  className="w-full bg-surface-1 border border-border-subtle rounded px-2 py-1 text-xs focus:border-primary outline-none text-main font-semibold"
                                                  value={item.location}
                                                  onChange={(e) => handleRebarCellChange(item.id, 'location', e.target.value)}
                                                />
                                              </td>
                                              <td className="px-1 py-1 text-center">
                                                <select
                                                  className="bg-surface-1 border border-border-subtle rounded px-1.5 py-1 text-[10px] font-bold outline-none text-main w-full"
                                                  value={item.shape_type}
                                                  onChange={(e) => handleRebarCellChange(item.id, 'shape_type', e.target.value)}
                                                >
                                                  <option value="straight">Straight</option>
                                                  <option value="hook">Hooked (a+b+c)</option>
                                                  <option value="stirrup">Stirrup (a+b)</option>
                                                  <option value="cranked">Cranked</option>
                                                  <option value="other">Other/Custom</option>
                                                </select>
                                              </td>
                                              <td className="px-1 py-1 text-center">
                                                <select
                                                  className="bg-surface-1 border border-border-subtle rounded py-1 text-xs font-bold outline-none text-main w-full font-mono text-center"
                                                  value={item.diameter}
                                                  onChange={(e) => handleRebarCellChange(item.id, 'diameter', e.target.value)}
                                                >
                                                  {REBAR_DIAMETERS.map(d => (
                                                    <option key={d} value={d}>Φ {d}</option>
                                                  ))}
                                                </select>
                                              </td>
                                              <td className="px-1 py-1">
                                                <input
                                                  type="number"
                                                  step="any"
                                                  className="w-full bg-surface-1 border border-border-subtle rounded py-1 text-center font-mono text-xs focus:border-primary outline-none text-main"
                                                  disabled={item.shape_type === 'straight'}
                                                  value={item.shape_a ?? ""}
                                                  placeholder="-"
                                                  onChange={(e) => handleRebarCellChange(item.id, 'shape_a', e.target.value)}
                                                />
                                              </td>
                                              <td className="px-1 py-1">
                                                <input
                                                  type="number"
                                                  step="any"
                                                  className="w-full bg-surface-1 border border-border-subtle rounded py-1 text-center font-mono text-xs focus:border-primary outline-none text-main"
                                                  value={item.shape_b ?? ""}
                                                  placeholder="-"
                                                  onChange={(e) => handleRebarCellChange(item.id, 'shape_b', e.target.value)}
                                                />
                                              </td>
                                              <td className="px-1 py-1">
                                                <input
                                                  type="number"
                                                  step="any"
                                                  className="w-full bg-surface-1 border border-border-subtle rounded py-1 text-center font-mono text-xs focus:border-primary outline-none text-main"
                                                  disabled={item.shape_type !== 'hook'}
                                                  value={item.shape_c ?? ""}
                                                  placeholder="-"
                                                  onChange={(e) => handleRebarCellChange(item.id, 'shape_c', e.target.value)}
                                                />
                                              </td>
                                              <td className="px-1 py-1">
                                                <input
                                                  type="number"
                                                  step="any"
                                                  className="w-full bg-surface-1 border border-border-subtle rounded py-1 text-center font-mono text-xs focus:border-primary outline-none text-main"
                                                  disabled={item.shape_type !== 'other'}
                                                  value={item.length}
                                                  onChange={(e) => handleRebarCellChange(item.id, 'length', e.target.value)}
                                                />
                                              </td>
                                              <td className="px-1 py-1">
                                                <input
                                                  type="number"
                                                  className="w-full bg-surface-1 border border-border-subtle rounded py-1 text-center font-mono text-xs focus:border-primary outline-none text-main font-bold"
                                                  value={item.no_of_bars}
                                                  onChange={(e) => handleRebarCellChange(item.id, 'no_of_bars', e.target.value)}
                                                />
                                              </td>
                                              <td className="px-1 py-1">
                                                <input
                                                  type="number"
                                                  className="w-full bg-surface-1 border border-border-subtle rounded py-1 text-center font-mono text-xs focus:border-primary outline-none text-main"
                                                  value={item.no_of_members}
                                                  onChange={(e) => handleRebarCellChange(item.id, 'no_of_members', e.target.value)}
                                                />
                                              </td>
                                              <td className="px-2 py-1.5 text-center font-mono font-bold text-ghost">
                                                {item.total_no_of_bars}
                                              </td>
                                              <td className="px-3 py-1.5 text-right font-mono font-black text-success text-[11px] bg-success/[0.01]">
                                                {item.qty_kg.toLocaleString()}{" "}
                                                <span className="text-[10px] text-ghost font-sans lowercase">Kg</span>
                                              </td>
                                              <td className="px-1 py-1 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                  <button
                                                    onClick={() => handleDuplicateRebarRow(item)}
                                                    className="p-1 hover:bg-accent/15 text-ghost hover:text-accent rounded"
                                                    title="Duplicate bar Row"
                                                  >
                                                    <Copy className="w-3" />
                                                  </button>
                                                  <button
                                                    onClick={() => handleDeleteRebarRow(item.id)}
                                                    className="p-1 hover:bg-error/15 text-ghost hover:text-error rounded"
                                                    title="Delete row"
                                                  >
                                                    <Trash2 className="w-3" />
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          ))
                                        )}
                                      </tbody>
                                    </table>
                                  </div>

                                  <div className="flex justify-between items-center text-xs">
                                    <button
                                      onClick={() => handleAddRebarRow(a.id)}
                                      className="btn btn-outline border-border-subtle btn-sm flex items-center gap-1 text-ghost hover:text-main"
                                    >
                                      <Plus className="w-4 h-4 text-success" />
                                      Add BBS Bar Row
                                    </button>
                                    <div className="text-right text-ghost font-bold text-[11px] uppercase tracking-wider">
                                       Cumulative Reinforcement Total: <span className="font-mono text-sm text-success font-black ml-1.5">
                                         {parseFloat(rebarEntries.reduce((sum, e) => sum + (e.qty_kg || 0), 0).toFixed(2)).toLocaleString()} Kg
                                       </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Bottom Selected Actions Floating Bar */}
        {Object.values(selectedIds).some(Boolean) && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface-1 border border-border-subtle px-6 py-4 rounded-[1.8rem] shadow-xl z-50 flex items-center gap-6 animate-in slide-in-from-bottom-8 duration-300">
            <span className="text-xs font-black text-main uppercase">
              {Object.values(selectedIds).filter(Boolean).length} Selected Items:
            </span>
            <div className="flex items-center gap-2 border-l border-border-subtle pl-6">
              <span className="text-[10px] font-black uppercase text-ghost tracking-wide">Bulk Classify:</span>
              <button
                onClick={() => handleBulkReclassify("standard")}
                className="px-3 py-1.5 bg-primary/10 hover:bg-primary hover:text-white text-primary border border-primary/25 rounded-xl font-bold text-xs font-sans transition-all"
              >
                1. Standard Vol
              </button>
              <button
                onClick={() => handleBulkReclassify("countable")}
                className="px-3 py-1.5 bg-accent/10 hover:bg-accent hover:text-white text-accent border border-accent/25 rounded-xl font-bold text-xs font-sans transition-all"
              >
                2. Countable
              </button>
              <button
                onClick={() => handleBulkReclassify("rebar")}
                className="px-3 py-1.5 bg-success/10 hover:bg-success hover:text-white text-success border border-success/25 rounded-xl font-bold text-xs font-sans transition-all"
              >
                3. Rebar BBS
              </button>
            </div>
            
            <button
              onClick={() => setSelectedIds({})}
              className="px-3 py-1.5 hover:bg-surface-2 bg-transparent text-ghost hover:text-main text-xs font-bold transition-all"
            >
              Clear Selection
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
