import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "../lib/supabase";
import {
  BookOpen,
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  Package,
  Users,
  Wrench,
  Truck,
  Info,
  Globe,
  Building2,
  Edit2,
  Trash2,
  Save,
  X,
  MoreHorizontal,
  FileUp,
  Download,
  AlertCircle,
  Database,
  CheckCircle,
  FileSearch,
  Play,
  Loader2,
  Calculator,
  Library,
  Droplet,
} from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { cn, cleanRichText } from "../lib/utils";
import { usePermissions } from "../hooks/usePermissions";
import {
  TRADE_GROUPS,
  getGroupLabel,
  getGroupEmoji,
  OPERATIONAL_BUNDLES,
} from "../lib/constants";
import { ConsumptionCalculator } from "./ConsumptionCalculator";
import { ResourcePickerModal } from "./ResourcePickerModal";

interface TradeItemRow {
  id: string;
  tenant_id: string | null;
  trade_code: string;
  trade_group: string;
  trade_item: string;
  boq_unit: string;
  resource_type: string | null;
  resource_name: string | null;
  resource_code: string | null;
  resource_unit: string | null;
  consumption_rate: number | null;
  waste_factor_pct: number | null;
  labour_hours_per_unit: number | null;
  daily_output_qty: number | null;
  team_setup: string | null;
  notes: string | null;
  is_active: boolean;
  library_tier: "global" | "company";
}

interface GroupedTradeItem {
  code: string;
  name: string;
  group: string;
  unit: string;
  outputQty: number | null;
  labHrs: number | null;
  teamSetup: string | null;
  notes: string | null;
  tier: "global" | "company";
  resources: TradeItemRow[];
}

interface TradeGroup {
  code: string;
  name: string;
  items: GroupedTradeItem[];
}

interface TradeLibraryProps {
  userRole: any;
  tenantId: any;
  isGodMode?: boolean;
}

export function TradeLibrary({
  userRole,
  tenantId,
  isGodMode,
}: TradeLibraryProps) {
  // Unified professional toast notifications state
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info" | "warning";
  } | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" | "warning" = "success",
  ) => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const { hasCapability } = usePermissions(userRole, tenantId);
  const [groups, setGroups] = useState<TradeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | "global" | "company">(
    isGodMode ? "all" : "company",
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<GroupedTradeItem | null>(
    null,
  );
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState<"append" | "overwrite">(
    "append",
  );
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [importPreviewRows, setImportPreviewRows] = useState<any[]>([]);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<GroupedTradeItem | null>(null);
  const [showResourcePicker, setShowResourcePicker] = useState(false);
  const [isEditingRecipe, setIsEditingRecipe] = useState(false);
  const [recipeDraft, setRecipeDraft] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    trade_code: "",
    trade_group: "",
    trade_item: "",
    boq_unit: "m3",
    daily_output_qty: 0,
    labour_hours_per_unit: 0,
    team_setup: "",
    notes: "",
    resources: [] as any[],
  });
  const [showCalculator, setShowCalculator] = useState<{
    index: number;
    row: any;
  } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTradeLibrary();
  }, []);

  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [libraryResources, setLibraryResources] = useState<{
    materials: any[];
    labour: any[];
    equipment: any[];
    vehicles: any[];
    fuel: any[];
  }>({ materials: [], labour: [], equipment: [], vehicles: [], fuel: [] });
  const [isFetchingResources, setIsFetchingResources] = useState(false);

  useEffect(() => {
    if (isEditingRecipe || isAdding) {
      fetchAllResources();
    }
  }, [isEditingRecipe, isAdding]);

  const fetchAllResources = async () => {
    setIsFetchingResources(true);
    try {
      const [mats, labs, eqps, vehs, fuels] = await Promise.all([
        supabase
          .from("materials")
          .select("id, material_name, material_code, unit")
          .eq("is_active", true),
        supabase
          .from("labour_grades")
          .select("id, title, grade_code")
          .eq("is_active", true) as any,
        supabase
          .from("equipment_items")
          .select("id, name, equipment_code")
          .eq("is_active", true),
        supabase
          .from("vehicles")
          .select("id, name, vehicle_code")
          .eq("is_active", true),
        supabase
          .from("fuel_types")
          .select("id, name, fuel_code, unit")
          .eq("is_active", true),
      ]);

      if (mats.error) console.error("Error fetching materials:", mats.error);
      if (labs.error) console.error("Error fetching labour:", labs.error);
      if (eqps.error) console.error("Error fetching equipment:", eqps.error);
      if (vehs.error) console.error("Error fetching vehicles:", vehs.error);
      if (fuels.error) console.error("Error fetching fuels:", fuels.error);

      setLibraryResources({
        materials: mats.data || [],
        labour: labs.data || [],
        equipment: eqps.data || [],
        vehicles: vehs.data || [],
        fuel: fuels.data || [],
      });
    } catch (err) {
      console.error("Error fetching resources:", err);
    } finally {
      setIsFetchingResources(false);
    }
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const [enrichedResources, setEnrichedResources] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (selectedItem) {
      enrichResources(selectedItem.resources);
    } else {
      setEnrichedResources([]);
    }
  }, [selectedItem]);

  const enrichResources = async (resources: TradeItemRow[]) => {
    setIsSyncing(true);
    try {
      const enriched = await Promise.all(
        resources.map(async (res) => {
          let table = "";
          switch (res.resource_type?.toLowerCase()) {
            case "material":
              table = "materials";
              break;
            case "labour":
              table = "labour_grades";
              break;
            case "equipment":
              table = "equipment_items";
              break;
            case "vehicle":
              table = "vehicles";
              break;
            case "fuel":
              table = "fuel_types";
              break;
            default:
              return { ...res, not_found: false };
          }

          const nameCol = TABLE_NAME_COLUMNS[table];
          if (!nameCol) return { ...res, not_found: false };

          const { data, error } = await supabase
            .from(table)
            .select("id")
            .eq(nameCol, res.resource_name)
            .eq("is_active", true)
            .limit(1);

          if (error || !data || data.length === 0) {
            return { ...res, not_found: true };
          }

          return { ...res, not_found: false };
        }),
      );
      setEnrichedResources(enriched);
    } catch (err) {
      console.error("Error enriching resources:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // syncTradeRates removed to comply with Layer 2 (No Price Storage) principle.
  // Trade library should only store consumption rates (recipes).

  const TABLE_NAME_COLUMNS: Record<string, string> = {
    materials: "material_name",
    labour_grades: "title",
    equipment_items: "name",
    vehicles: "name",
    fuel_types: "name",
    subcontractor_categories: "name",
  };

  const loadTradeLibrary = async () => {
    setLoading(true);
    try {
      console.log(
        `[TradeLibrary] Loading trade_items. TenantID: ${tenantId}, GodMode: ${isGodMode}`,
      );

      let query = supabase.from("trade_items").select("*");

      // If not God Mode, only show global or own tenant data
      if (!isGodMode && tenantId && tenantId !== "null") {
        query = query.or(`library_tier.eq.global,tenant_id.eq.${tenantId}`);
      } else if (!isGodMode && (!tenantId || tenantId === "null")) {
        query = query.eq("library_tier", "global");
      }

      const response = await query.order("trade_group").order("trade_code");

      if (response.error) {
        console.error("[TradeLibrary] Supabase error:", response.error);
        throw response.error;
      }

      const data = response.data || [];
      console.log(`[TradeLibrary] Loaded ${data.length} rows`, {
        status: response.status,
        sample: data[0],
      });

      // Group flat rows into items and then groups
      // Key: trade_code + trade_item + library_tier
      const itemMap = new Map<string, GroupedTradeItem>();
      data.forEach((r: TradeItemRow) => {
        const key = `${r.trade_code}_${r.trade_item}_${r.library_tier}`;
        if (!itemMap.has(key)) {
          itemMap.set(key, {
            code: r.trade_code,
            name: r.trade_item,
            group: r.trade_group,
            unit: r.boq_unit,
            outputQty: r.daily_output_qty,
            labHrs: r.labour_hours_per_unit,
            teamSetup: r.team_setup,
            notes: r.notes,
            tier: r.library_tier || "global",
            resources: [],
          });
        }
        if (r.resource_name) {
          itemMap.get(key)!.resources.push(r);
        }
      });

      // Simple filter by tier
      const deduplicatedItems = Array.from(itemMap.values());

      const groupMap = new Map<string, TradeGroup>();
      deduplicatedItems.forEach((item) => {
        const gcode = item.group;
        if (!groupMap.has(gcode)) {
          groupMap.set(gcode, {
            code: gcode,
            name: getGroupLabel(gcode),
            items: [],
          });
        }
        groupMap.get(gcode)!.items.push(item);
      });

      // Sort items within each group by the numeric part of their trade_code
      groupMap.forEach((group) => {
        group.items.sort((a, b) => {
          const numA = parseInt(a.code.match(/\d+/)?.[0] || "0");
          const numB = parseInt(b.code.match(/\d+/)?.[0] || "0");
          if (numA !== numB) return numA - numB;
          return a.code.localeCompare(b.code);
        });
      });

      setGroups(
        Array.from(groupMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );

      // Inject synthetic operational bundles
      const opGroup: TradeGroup = {
        code: "PREL",
        name: "Operational & Site Startup Bundles",
        items: OPERATIONAL_BUNDLES.map((b) => ({
          code: `OP-${b.id.toUpperCase().slice(0, 3)}`,
          name: b.name,
          group: "PREL",
          unit: "LS",
          outputQty: 1,
          labHrs: 0,
          teamSetup: "Site mobilization phase",
          notes: b.description,
          tier: "global",
          resources: b.items.map((bi) => ({
            id: `virtual-${b.id}-${bi.name}`,
            tenant_id: null,
            trade_code: `OP-${b.id.toUpperCase().slice(0, 3)}`,
            trade_group: "PREL",
            trade_item: b.name,
            boq_unit: "LS",
            resource_type: bi.type,
            resource_name: bi.name,
            resource_code: null,
            resource_unit: bi.unit,
            consumption_rate: bi.qty,
            waste_factor_pct: 0,
            labour_hours_per_unit: 0,
            daily_output_qty: 1,
            team_setup: null,
            notes: null,
            is_active: true,
            library_tier: "global",
          })) as TradeItemRow[],
        })) as GroupedTradeItem[],
      };

      setGroups((prev) => [opGroup, ...prev]);
    } catch (e: any) {
      console.error("Error loading trade library:", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: GroupedTradeItem) => {
    setEditingItem(item);
    setFormData({
      trade_code: item.code,
      trade_group: item.group,
      trade_item: item.name,
      boq_unit: item.unit,
      daily_output_qty: item.outputQty || 0,
      labour_hours_per_unit: item.labHrs || 0,
      team_setup: item.teamSetup || "",
      notes: item.notes || "",
      resources: item.resources.map((r) => ({
        resource_type: r.resource_type || "material",
        resource_name: r.resource_name || "",
        resource_code: r.resource_code || "",
        resource_unit: r.resource_unit || "",
        consumption_rate: r.consumption_rate || 0,
        waste_factor_pct: r.waste_factor_pct || 0,
      })),
    });
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!tenantId && !isGodMode) {
      setNotification({
        type: "error",
        message:
          "Tenant ID missing. Please ensure you are logged in correctly.",
      });
      return;
    }

    if (!formData.trade_code || !formData.trade_item || !formData.trade_group) {
      setNotification({
        type: "error",
        message: "Please fill in all required fields (Code, Group, Item Name).",
      });
      return;
    }

    setLoading(true);
    try {
      const tier = editingItem
        ? editingItem.tier
        : isGodMode && tierFilter === "global"
          ? "global"
          : "company";
      const tid = tier === "global" ? null : tenantId;

      if (editingItem) {
        // Delete all old rows for this trade item so we can cleanly replace with updated ones
        const deleteQuery = supabase
          .from("trade_items")
          .delete()
          .eq("trade_code", editingItem.code)
          .eq("trade_item", editingItem.name)
          .eq("library_tier", editingItem.tier);

        if (editingItem.tier === "company") {
          deleteQuery.eq("tenant_id", tenantId);
        } else {
          deleteQuery.is("tenant_id", null);
        }

        const { error: delError } = await deleteQuery;
        if (delError) throw delError;
      }

      // Insert new rows
      if (formData.resources.length > 0) {
        const rows = formData.resources.map((res) => ({
          trade_code: formData.trade_code,
          trade_group: formData.trade_group,
          trade_item: formData.trade_item,
          boq_unit: formData.boq_unit,
          daily_output_qty: Number(formData.daily_output_qty),
          labour_hours_per_unit: Number(formData.labour_hours_per_unit),
          team_setup: formData.team_setup,
          notes: formData.notes,
          resource_type: res.resource_type,
          resource_name: res.resource_name,
          resource_code: res.resource_code || "",
          resource_unit: res.resource_unit,
          consumption_rate: Number(res.consumption_rate),
          waste_factor_pct: Number(res.waste_factor_pct || 0),
          tenant_id: tid,
          library_tier: tier,
          is_active: true,
          version: 1,
        }));

        const { error } = await supabase.from("trade_items").insert(rows);
        if (error) throw error;
      } else {
        const insertData = {
          trade_code: formData.trade_code,
          trade_group: formData.trade_group,
          trade_item: formData.trade_item,
          boq_unit: formData.boq_unit,
          daily_output_qty: Number(formData.daily_output_qty),
          labour_hours_per_unit: Number(formData.labour_hours_per_unit),
          team_setup: formData.team_setup,
          notes: formData.notes,
          resource_type: null,
          resource_name: null,
          resource_code: "",
          resource_unit: null,
          consumption_rate: null,
          tenant_id: tid,
          library_tier: tier,
          is_active: true,
          version: 1,
        };
        const { error } = await supabase
          .from("trade_items")
          .insert([insertData]);
        if (error) throw error;
      }

      setNotification({
        type: "success",
        message: editingItem
          ? "Trade item updated successfully!"
          : "Trade item saved successfully!",
      });

      setIsAdding(false);
      setEditingItem(null);
      setFormData({
        trade_code: "",
        trade_group: "",
        trade_item: "",
        boq_unit: "m3",
        daily_output_qty: 0,
        labour_hours_per_unit: 0,
        team_setup: "",
        notes: "",
        resources: [],
      });
      setSelectedItem(null);
      loadTradeLibrary();
    } catch (e: any) {
      console.error("[TradeLibrary] Save error:", e);
      showToast("Error saving trade item: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditRecipe = () => {
    if (!selectedItem) return;
    handleEdit(selectedItem);
  };

  const handleUpdateRecipeDraft = (index: number, updates: any) => {
    const next = [...recipeDraft];
    next[index] = { ...next[index], ...updates };
    setRecipeDraft(next);
  };

  const handleRemoveRecipeRow = (index: number) => {
    setRecipeDraft(recipeDraft.filter((_, i) => i !== index));
  };

  const handleAddRecipeRow = () => {
    if (!selectedItem) return;
    setRecipeDraft([
      ...recipeDraft,
      {
        trade_code: selectedItem.code,
        trade_group: selectedItem.group,
        trade_item: selectedItem.name,
        boq_unit: selectedItem.unit,
        resource_type: "material",
        resource_name: "",
        resource_unit: "",
        consumption_rate: 0,
        waste_factor_pct: 0,
        effective_rate: 0,
        labour_hours_per_unit: selectedItem.labHrs,
        daily_output_qty: selectedItem.outputQty,
        team_setup: selectedItem.teamSetup,
        tenant_id: selectedItem.tier === "global" ? null : tenantId,
        library_tier: selectedItem.tier,
        is_active: true,
      },
    ]);
  };

  const handleSaveRecipe = async () => {
    if (!selectedItem) return;
    setLoading(true);
    try {
      // 1. Delete existing rows for this trade code, item name and tier
      const deleteQuery = supabase
        .from("trade_items")
        .delete()
        .eq("trade_code", selectedItem.code)
        .eq("trade_item", selectedItem.name)
        .eq("library_tier", selectedItem.tier);

      if (selectedItem.tier === "company") {
        deleteQuery.eq("tenant_id", tenantId);
      } else {
        deleteQuery.is("tenant_id", null);
      }

      const { error: delError } = await deleteQuery;
      if (delError) throw delError;

      // 2. Insert new rows
      if (recipeDraft.length > 0) {
        const finalRows = recipeDraft.map((r) => {
          const { id, created_at, effective_rate, ...cleanRow } = r;
          return {
            ...cleanRow,
            resource_code: r.resource_code || "",
            trade_item: selectedItem.name,
            trade_group: selectedItem.group,
            boq_unit: selectedItem.unit,
            daily_output_qty: selectedItem.outputQty,
            labour_hours_per_unit: selectedItem.labHrs,
            team_setup: selectedItem.teamSetup,
            tenant_id: selectedItem.tier === "global" ? null : tenantId,
            library_tier: selectedItem.tier,
            is_active: true,
            version: r.version || 1,
          };
        });

        const { error: insError } = await supabase
          .from("trade_items")
          .insert(finalRows);
        if (insError) throw insError;
      } else {
        const placeholder = {
          trade_code: selectedItem.code,
          trade_group: selectedItem.group,
          trade_item: selectedItem.name,
          boq_unit: selectedItem.unit,
          resource_type: null,
          resource_name: null,
          resource_code: "",
          resource_unit: null,
          consumption_rate: null,
          daily_output_qty: selectedItem.outputQty,
          labour_hours_per_unit: selectedItem.labHrs,
          team_setup: selectedItem.teamSetup,
          tenant_id: selectedItem.tier === "global" ? null : tenantId,
          library_tier: selectedItem.tier,
          is_active: true,
          version: 1,
        };
        const { error: insError } = await supabase
          .from("trade_items")
          .insert([placeholder]);
        if (insError) throw insError;
      }

      setNotification({
        type: "success",
        message: "Recipe updated successfully!",
      });
      setIsEditingRecipe(false);
      setSelectedItem(null);
      loadTradeLibrary();
    } catch (err: any) {
      console.error("Error saving recipe:", err);
      showToast("Error saving: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const cloneGlobalTrades = async (specificCodes?: string[]) => {
    if (!tenantId) {
      setNotification({
        type: "error",
        message:
          "Cannot clone: Tenant ID is missing. Please refresh or log in again.",
      });
      return;
    }

    const tradeCodesToClone = new Set<string>();
    const resourcesToClone: TradeItemRow[] = [];

    groups.forEach((g) => {
      g.items.forEach((i) => {
        if (i.tier === "global") {
          if (specificCodes) {
            if (specificCodes.includes(i.code)) {
              tradeCodesToClone.add(i.code);
              if (i.code.startsWith("OP-")) {
                resourcesToClone.push(...i.resources);
              }
            }
          } else if (selectedCodes.size > 0) {
            if (selectedCodes.has(i.code)) {
              tradeCodesToClone.add(i.code);
              if (i.code.startsWith("OP-")) {
                resourcesToClone.push(...i.resources);
              }
            }
          } else {
            tradeCodesToClone.add(i.code);
            if (i.code.startsWith("OP-")) {
              resourcesToClone.push(...i.resources);
            }
          }
        }
      });
    });

    if (tradeCodesToClone.size === 0) {
      setNotification({
        type: "info",
        message: "No global trade items selected to clone.",
      });
      return;
    }

    setConfirmAction({
      message: `Clone ${tradeCodesToClone.size} selected global trade items to your company library?`,
      onConfirm: async () => {
        setLoading(true);
        try {
          // 1. Fetch existing trade codes and resource codes for this tenant to avoid unique constraint violations
          const { data: existingTrades, error: fetchError } = await supabase
            .from("trade_items")
            .select("trade_code, resource_code")
            .eq("tenant_id", tenantId)
            .eq("library_tier", "company");

          if (fetchError) throw fetchError;

          const existingKeys = new Set(
            existingTrades?.map(
              (t) =>
                `${(t.trade_code || "").toLowerCase().trim()}|${(t.resource_code || "").toLowerCase().trim()}`,
            ) || [],
          );

          const existingCodes = new Set(
            existingTrades?.map((t) =>
              (t.trade_code || "").toLowerCase().trim(),
            ) || [],
          );

          // 2. Fetch global database entries for non-synthetic items
          const dbCodesToQuery = Array.from(tradeCodesToClone).filter(
            (c) => !c.startsWith("OP-"),
          );
          let dbRows: any[] = [];
          if (dbCodesToQuery.length > 0) {
            const { data, error: getGlobalError } = await supabase
              .from("trade_items")
              .select("*")
              .in("trade_code", dbCodesToQuery)
              .eq("library_tier", "global");
            if (getGlobalError) throw getGlobalError;
            dbRows = data || [];
          }

          // 3. Combine synthetic rows (from local state) and database rows
          const allRowsToProcess = [...resourcesToClone, ...dbRows];

          let skippedCount = 0;
          const filteredResources = allRowsToProcess.filter((r) => {
            const tCode = (r.trade_code || "").toLowerCase().trim();
            const rCode = (r.resource_code || "").toLowerCase().trim();
            const key = `${tCode}|${rCode}`;
            return !existingKeys.has(key);
          });

          // Count how many trade items were skipped (fully existing in the company library)
          tradeCodesToClone.forEach((code) => {
            if (existingCodes.has(code.toLowerCase().trim())) {
              skippedCount++;
            }
          });

          const clones = filteredResources.map((g) => {
            const {
              id,
              created_at,
              library_tier,
              tenant_id,
              effective_rate,
              ...rest
            } = g as any;
            return {
              ...rest,
              version: g.version || 1,
              resource_code: g.resource_code || "",
              tenant_id: tenantId,
              library_tier: "company",
              is_active: true,
            };
          });

          // Deduplicate clones to prevent any potential duplicate combinations of (trade_code, resource_code) in same batch
          const seenInBatch = new Set<string>();
          const finalClonesToInsert: any[] = [];

          clones.forEach((c) => {
            const tCode = (c.trade_code || "").toLowerCase().trim();
            const rCode = (c.resource_code || "").toLowerCase().trim();
            const batchKey = `${tCode}|${rCode}`;
            if (!seenInBatch.has(batchKey)) {
              seenInBatch.add(batchKey);
              finalClonesToInsert.push(c);
            }
          });

          if (finalClonesToInsert.length > 0) {
            const { error } = await supabase
              .from("trade_items")
              .insert(finalClonesToInsert);
            if (error) throw error;
          }

          let msg = `Successfully cloned ${tradeCodesToClone.size - skippedCount} trade items.`;
          if (skippedCount > 0) {
            msg += ` ${skippedCount} items were already in your library and were skipped.`;
          }

          setNotification({
            type:
              tradeCodesToClone.size - skippedCount > 0 ? "success" : "info",
            message: msg,
          });

          setSelectedCodes(new Set());
          loadTradeLibrary();
        } catch (e: any) {
          setNotification({
            type: "error",
            message: "Error cloning trades: " + e.message,
          });
        } finally {
          setLoading(false);
          setConfirmAction(null);
        }
      },
    });
  };

  const handleDeleteTrade = async (code: string) => {
    const group = groups.find((g) => g.items.some((i) => i.code === code));
    const item = group?.items.find((i) => i.code === code);
    if (!item) return;

    const isCompany = item.tier === "company";
    const message = isCompany
      ? `Are you sure you want to PERMANENTLY delete the trade item "${item.name}"? This will remove all its resource recipes.`
      : `Are you sure you want to deactivate the trade item "${item.name}"?`;

    setConfirmAction({
      message,
      onConfirm: async () => {
        setLoading(true);
        try {
          let error;
          if (isCompany) {
            // Permanent delete for company trades
            const { error: delError } = await supabase
              .from("trade_items")
              .delete()
              .eq("trade_code", code)
              .eq("trade_item", item.name)
              .eq("tenant_id", tenantId);
            error = delError;
          } else {
            // Deactivate global trades
            const { error: updError } = await supabase
              .from("trade_items")
              .update({ is_active: false })
              .eq("trade_code", code)
              .eq("trade_item", item.name)
              .eq("library_tier", "global");
            error = updError;
          }

          if (error) throw error;
          setNotification({
            type: "success",
            message: isCompany
              ? "Trade item deleted permanently."
              : "Trade item deactivated successfully.",
          });
          loadTradeLibrary();
        } catch (err: any) {
          setNotification({
            type: "error",
            message: "Error deleting trade: " + err.message,
          });
        } finally {
          setLoading(false);
          setConfirmAction(null);
        }
      },
    });
  };

  const toggleSelectAll = (groupCode: string) => {
    const group = groups.find((g) => g.code === groupCode);
    if (!group) return;
    const allSelected = group.items.every((i) => selectedCodes.has(i.code));
    const next = new Set(selectedCodes);
    group.items.forEach((i) => {
      if (allSelected) next.delete(i.code);
      else next.add(i.code);
    });
    setSelectedCodes(next);
  };

  const toggleSelect = (code: string) => {
    const next = new Set(selectedCodes);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelectedCodes(next);
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      console.log("[TradeLibrary] Loading workbook...");
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);

      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) throw new Error("No worksheet found in file.");

      const data: any[] = [];
      const headerRow = worksheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value);
      });

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip headers
        const rowData: any = {};
        row.eachCell((cell, colNumber) => {
          rowData[headers[colNumber]] = cell.value;
        });
        data.push(rowData);
      });

      console.log("[TradeLibrary] Parsed rows:", data.length);

      const formattedData = data
        .map((row: any) => {
          const code =
            row.activity_code ||
            row.Code ||
            row.code ||
            row["Trade Code"] ||
            row.trade_code ||
            row.ID ||
            row.id;
          const group =
            row.work_group ||
            row.Group ||
            row.group ||
            row["Trade Group"] ||
            row.trade_group ||
            row.Category ||
            row.category;
          const item =
            row.activity_name ||
            row.Item ||
            row.item ||
            row["Trade Item"] ||
            row.trade_item ||
            row.Description ||
            row.description ||
            row.Name ||
            row.name;
          const unit =
            row.boq_unit ||
            row.Unit ||
            row.unit ||
            row["BOQ Unit"] ||
            row.boq_unit ||
            "m3";
          const resType =
            row.resource_type ||
            row.ResourceType ||
            row.resource_type ||
            row.Type ||
            row.type ||
            "material";
          const resCode =
            row.resource_code ||
            row.ResourceCode ||
            row.resource_code ||
            row.Code ||
            row.code;
          const resName =
            row.resource_name ||
            row.ResourceName ||
            row.resource_name ||
            row.Resource ||
            row.resource ||
            row.Material ||
            row.material ||
            row.Labour ||
            row.labour ||
            row.Description ||
            row.description ||
            row.Name ||
            row.name;
          const resUnit =
            row.resource_unit ||
            row.ResourceUnit ||
            row.resource_unit ||
            row["Res Unit"] ||
            row.res_unit ||
            row.Unit ||
            row.unit ||
            "Unit";

          // Distinguish between Consumption (Qty)
          const consumption = parseFloat(
            row.consumption_rate ||
              row.Consumption ||
              row.consumption_rate ||
              row.Qty ||
              row.qty ||
              row.Amount ||
              1,
          );

          if (!tenantId && !isGodMode) {
            throw new Error(
              "Tenant ID missing during import. Please ensure you are logged in.",
            );
          }

          return {
            trade_code: code,
            trade_group: group,
            trade_item: item,
            boq_unit: unit,
            resource_type: resType?.toLowerCase(),
            resource_code: resCode,
            resource_name: resName,
            resource_unit: resUnit,
            consumption_rate: consumption,
            waste_factor_pct: parseFloat(
              row.waste_factor_pct ||
                row.Waste ||
                row.waste_factor_pct ||
                row["Waste %"] ||
                0,
            ),
            labour_hours_per_unit: parseFloat(
              row.labor_hours_per_unit ||
                row.LabHrs ||
                row.labour_hours_per_unit ||
                row.Hours ||
                row.hours ||
                0,
            ),
            daily_output_qty: parseFloat(
              row.daily_output_qty ||
                row.Output ||
                row.daily_output_qty ||
                row.Daily ||
                row.daily ||
                0,
            ),
            team_setup:
              row.team_setup ||
              row.Team ||
              row.team_setup ||
              row.Crew ||
              row.crew,
            tenant_id: tenantId,
            library_tier:
              isGodMode && tierFilter === "global" ? "global" : "company",
            is_active: true,
            version: 1,
          };
        })
        .filter((item) => item.trade_code && item.trade_item);

      if (formattedData.length === 0) {
        showToast(
          'No valid data found in Excel. Ensure you have "Code" and "Item" columns.',
          "warning",
        );
        setIsImporting(false);
        return;
      }

      // Fetch existing entries to compare
      const { data: existingEntries } = await supabase
        .from("trade_items")
        .select("id, trade_code, resource_name")
        .eq("tenant_id", tenantId)
        .eq(
          "library_tier",
          isGodMode && tierFilter === "global" ? "global" : "company",
        );

      const existingMap = new Map(
        existingEntries?.map((e) => [
          `${e.trade_code}|${e.resource_name}`.toLowerCase(),
          e.id,
        ]) || [],
      );

      const previewRows = formattedData.map((item) => {
        const key = `${item.trade_code}|${item.resource_name}`.toLowerCase();
        const existingId = existingMap.get(key);

        return {
          ...item,
          existingId,
          isDuplicate: !!existingId,
          status: existingId
            ? importMode === "overwrite"
              ? "update"
              : "skip"
            : "new",
        };
      });

      setImportPreviewRows(previewRows);
      setShowImportPreview(true);
    } catch (err: any) {
      showToast("Error reading file: " + err.message, "error");
      setIsImporting(false);
      if (e.target) e.target.value = "";
    }
  };

  const confirmBatchImport = async () => {
    if (importPreviewRows.length === 0) return;

    setIsImporting(true);
    try {
      const toInsert: any[] = [];
      const toUpdate: any[] = [];
      let skippedCount = 0;

      importPreviewRows.forEach((row) => {
        const { status, existingId, isDuplicate, ...item } = row;
        if (status === "new") {
          toInsert.push(item);
        } else if (status === "update") {
          toUpdate.push({ id: existingId, ...item });
        } else {
          skippedCount++;
        }
      });

      if (toInsert.length === 0 && toUpdate.length === 0) {
        showToast("No new or updated items to import.", "warning");
        setShowImportPreview(false);
        return;
      }

      if (toUpdate.length > 0) {
        const { error } = await supabase.from("trade_items").upsert(toUpdate);
        if (error) throw error;
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from("trade_items").insert(toInsert);
        if (error) throw error;
      }

      setNotification({
        type: "success",
        message: `Import complete: ${toInsert.length} new, ${toUpdate.length} updated, ${skippedCount} skipped.`,
      });
      setShowImportPreview(false);
      setImportPreviewRows([]);
      loadTradeLibrary();
    } catch (err: any) {
      showToast("Batch import failed: " + err.message, "error");
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Trade_Template");

    sheet.columns = [
      { header: "activity_code", key: "activity_code" },
      { header: "work_group", key: "work_group" },
      { header: "activity_name", key: "activity_name" },
      { header: "boq_unit", key: "boq_unit" },
      { header: "resource_type", key: "resource_type" },
      { header: "resource_code", key: "resource_code" },
      { header: "resource_name", key: "resource_name" },
      { header: "resource_unit", key: "resource_unit" },
      { header: "consumption_rate", key: "consumption_rate" },
      { header: "waste_factor_pct", key: "waste_factor_pct" },
      { header: "labor_hours_per_unit", key: "labor_hours_per_unit" },
      { header: "daily_output_qty", key: "daily_output_qty" },
      { header: "team_setup", key: "team_setup" },
    ];

    const data = [
      {
        activity_code: "MOB-1",
        work_group: "Mobilization",
        activity_name: "General Mobilization & Site Setup",
        boq_unit: "LS",
        resource_type: "Material",
        resource_code: "MAT-FU-001",
        resource_name: "Diesel AGO",
        resource_unit: "Litre",
        consumption_rate: 5000,
        waste_factor_pct: 0,
        labor_hours_per_unit: 8,
        daily_output_qty: 1,
        team_setup: "Site Team + Logistics",
      },
      {
        activity_code: "EX-1",
        work_group: "Excavation",
        activity_name: "Excavation Site Clearance",
        boq_unit: "M2",
        resource_type: "Labour",
        resource_code: "LAB-US-001",
        resource_name: "General Labourer",
        resource_unit: "Day",
        consumption_rate: 0.025,
        waste_factor_pct: 0,
        labor_hours_per_unit: 8,
        daily_output_qty: 400,
        team_setup: "1 Foreman + 8 Labourers",
      },
    ];

    data.forEach((row) => sheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Trade_Library_Default_Base.xlsx`);
  };

  const toggleGroup = (code: string) => {
    const next = new Set(expandedGroups);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setExpandedGroups(next);
  };

  const companyTradeCodes = React.useMemo(() => {
    const codes = new Set<string>();
    groups.forEach((g) => {
      g.items.forEach((i) => {
        if (i.tier === "company") {
          codes.add(i.code.toLowerCase().trim());
        }
      });
    });
    return codes;
  }, [groups]);

  const filteredGroups = React.useMemo(() => {
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => {
          const matchesSearch =
            i.name.toLowerCase().includes(search.toLowerCase()) ||
            i.code.toLowerCase().includes(search.toLowerCase());

          let matchesTier = tierFilter === "all" || i.tier === tierFilter;

          // Hide global items if a company-specific version exists to avoid confusing tenants and key duplicates
          if (
            tierFilter === "all" &&
            i.tier === "global" &&
            companyTradeCodes.has(i.code.toLowerCase().trim())
          ) {
            return false;
          }

          return matchesSearch && matchesTier;
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, search, tierFilter, companyTradeCodes]);

  const getResourceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "material":
        return <Package className="w-3.5 h-3.5" />;
      case "labour":
        return <Users className="w-3.5 h-3.5" />;
      case "equipment":
        return <Wrench className="w-3.5 h-3.5" />;
      case "vehicle":
        return <Truck className="w-3.5 h-3.5" />;
      case "fuel":
        return <Droplet className="w-3.5 h-3.5" />;
      default:
        return <Info className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-main">Trade Library</h1>
          <p className="text-sm text-dim">
            Manage construction trade items and their resource recipes
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasCapability("trade:view_global") && !isGodMode && (
            <>
              {selectedCodes.size > 0 ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => cloneGlobalTrades()}
                    className="flex items-center gap-2 px-3 py-2 bg-primary border border-primary rounded-lg text-xs font-bold text-surface-base hover:brightness-110 transition-all shadow-lg shadow-primary/10"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    Clone Selected ({selectedCodes.size})
                  </button>
                  <button
                    onClick={() => setSelectedCodes(new Set())}
                    className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs font-bold text-danger hover:bg-surface-2/80 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                </div>
              ) : (
                tierFilter === "company" && (
                  <button
                    onClick={() => {
                      setTierFilter("global");
                      showToast(
                        "Select items from the Global library to clone them to your company.",
                        "info",
                      );
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-accent border border-accent rounded-lg text-xs font-bold text-surface-base hover:brightness-110 transition-all shadow-lg shadow-accent/10"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    Clone from Global
                  </button>
                )
              )}
            </>
          )}
          <div className="flex items-center gap-3 bg-surface-1 px-3 py-1.5 rounded-xl border border-border-subtle">
            <div className="flex bg-surface-base p-0.5 rounded-lg border border-border-subtle">
              <button
                onClick={() => setImportMode("append")}
                className={cn(
                  "px-3 py-1 text-[9px] font-bold rounded-md transition-all",
                  importMode === "append"
                    ? "bg-primary text-surface-base"
                    : "text-ghost hover:text-main",
                )}
              >
                APPEND
              </button>
              <button
                onClick={() => setImportMode("overwrite")}
                className={cn(
                  "px-3 py-1 text-[9px] font-bold rounded-md transition-all",
                  importMode === "overwrite"
                    ? "bg-danger text-white"
                    : "text-ghost hover:text-main",
                )}
              >
                OVERWRITE
              </button>
            </div>
            <div className="w-px h-4 bg-border-subtle" />
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 text-xs font-bold text-ghost hover:text-main transition-all"
              title="Download structured template with default library data"
            >
              <Download className="w-3.5 h-3.5" />
              Download Default
            </button>
            <div className="w-px h-4 bg-border-subtle" />
            <button
              onClick={() => {
                if (!hasCapability("trade:import")) {
                  showToast(
                    "You do not have permission to import trades.",
                    "warning",
                  );
                  return;
                }
                fileInputRef.current?.click();
              }}
              disabled={isImporting}
              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-all disabled:opacity-50"
            >
              <FileUp className="w-3.5 h-3.5" />
              {isImporting ? "Importing..." : "Import Excel"}
            </button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx, .xls"
            className="hidden"
            onChange={handleExcelImport}
          />
          {hasCapability("trade:create_company") && (
            <button
              onClick={() => setIsAdding(true)}
              className="btn btn-accent btn-sm"
            >
              <Plus className="w-4 h-4" />
              New Trade Item
            </button>
          )}
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface-2 border border-border-subtle rounded-xl max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-1">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-main">
                  {editingItem
                    ? `Edit Trade Item & Recipe: ${editingItem.code}`
                    : "Add New Trade Item & Recipe"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setEditingItem(null);
                }}
                className="text-ghost hover:text-main p-1 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-6">
              {/* Basic Information Section */}
              <div>
                <h4 className="text-xs font-bold text-ghost uppercase tracking-wider mb-3 border-b border-border-subtle pb-1">
                  Basic Trade Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-ghost uppercase tracking-wider">
                      Group
                    </label>
                    <select
                      className="bg-surface-base border border-border-subtle rounded px-3 py-2 text-sm outline-none focus:border-primary text-main"
                      value={formData.trade_group}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          trade_group: e.target.value,
                        })
                      }
                    >
                      <option value="">Select Group...</option>
                      {TRADE_GROUPS.map((g) => (
                        <option key={g.code} value={g.code}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-ghost uppercase tracking-wider">
                      Code
                    </label>
                    <input
                      className="bg-surface-base border border-border-subtle rounded px-3 py-2 text-sm outline-none focus:border-primary text-main disabled:opacity-50"
                      value={formData.trade_code}
                      onChange={(e) =>
                        setFormData({ ...formData, trade_code: e.target.value })
                      }
                      placeholder="e.g. CONC-001"
                      disabled={!!editingItem}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-ghost uppercase tracking-wider">
                      Item Name
                    </label>
                    <input
                      className="bg-surface-base border border-border-subtle rounded px-3 py-2 text-sm outline-none focus:border-primary text-main"
                      value={formData.trade_item}
                      onChange={(e) =>
                        setFormData({ ...formData, trade_item: e.target.value })
                      }
                      placeholder="e.g. Concrete C25"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-ghost uppercase tracking-wider">
                      BOQ Unit
                    </label>
                    <input
                      className="bg-surface-base border border-border-subtle rounded px-3 py-2 text-sm outline-none focus:border-primary text-main"
                      value={formData.boq_unit}
                      onChange={(e) =>
                        setFormData({ ...formData, boq_unit: e.target.value })
                      }
                      placeholder="m3"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-ghost uppercase tracking-wider">
                      Daily Output
                    </label>
                    <input
                      type="number"
                      className="bg-surface-base border border-border-subtle rounded px-3 py-2 text-sm outline-none focus:border-primary text-main"
                      value={formData.daily_output_qty}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          daily_output_qty: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-ghost uppercase tracking-wider">
                      Labour Hours
                    </label>
                    <input
                      type="number"
                      className="bg-surface-base border border-border-subtle rounded px-3 py-2 text-sm outline-none focus:border-primary text-main"
                      value={formData.labour_hours_per_unit}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          labour_hours_per_unit:
                            parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Resources Recipe Section */}
              <div>
                <h4 className="text-xs font-bold text-ghost uppercase tracking-wider mb-3 border-b border-border-subtle pb-1 flex items-center justify-between">
                  <span>Resource Recipe</span>
                  <span className="text-[10px] font-mono text-ghost/70 font-normal">
                    {formData.resources.length} active row
                    {formData.resources.length !== 1 ? "s" : ""}
                  </span>
                </h4>

                <div className="flex flex-col gap-3">
                  {formData.resources.map((res, idx) => (
                    <div
                      key={idx}
                      className="bg-surface-base border border-border-subtle rounded-lg p-3 grid grid-cols-1 md:grid-cols-6 gap-3 group relative shadow-sm hover:border-border-faint transition-all"
                    >
                      <button
                        onClick={() => {
                          const next = [...formData.resources];
                          next.splice(idx, 1);
                          setFormData({ ...formData, resources: next });
                        }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-danger text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all cursor-pointer z-10"
                        title="Remove Resource Row"
                      >
                        <X className="w-3 h-3" />
                      </button>

                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] uppercase font-bold text-ghost">
                          Type
                        </label>
                        <select
                          className="bg-surface-2 border border-border-subtle text-xs px-2 py-1.5 rounded outline-none text-main"
                          value={res.resource_type || "material"}
                          onChange={(e) => {
                            const next = [...formData.resources];
                            next[idx].resource_type = e.target.value;
                            setFormData({ ...formData, resources: next });
                          }}
                        >
                          <option value="material">Material</option>
                          <option value="labour">Labour</option>
                          <option value="equipment">Equipment</option>
                          <option value="vehicle">Vehicle</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1 md:col-span-2">
                        <label className="text-[9px] uppercase font-bold text-ghost">
                          Resource Name
                        </label>
                        <input
                          className="bg-surface-2 border border-border-subtle text-xs px-2 py-1.5 rounded outline-none text-main"
                          value={res.resource_name || ""}
                          onChange={(e) => {
                            const next = [...formData.resources];
                            next[idx].resource_name = e.target.value;
                            setFormData({ ...formData, resources: next });
                          }}
                          placeholder="Name of resource..."
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] uppercase font-bold text-ghost">
                          Consumption
                        </label>
                        <input
                          type="number"
                          step="any"
                          className="bg-surface-2 border border-border-subtle text-xs px-2 py-1.5 rounded outline-none text-main"
                          value={res.consumption_rate || 0}
                          onChange={(e) => {
                            const next = [...formData.resources];
                            next[idx].consumption_rate =
                              parseFloat(e.target.value) || 0;
                            setFormData({ ...formData, resources: next });
                          }}
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] uppercase font-bold text-ghost">
                          Unit
                        </label>
                        <input
                          className="bg-surface-2 border border-border-subtle text-xs px-2 py-1.5 rounded outline-none text-main"
                          value={res.resource_unit || ""}
                          onChange={(e) => {
                            const next = [...formData.resources];
                            next[idx].resource_unit = e.target.value;
                            setFormData({ ...formData, resources: next });
                          }}
                          placeholder="e.g. kg, hr"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] uppercase font-bold text-ghost">
                          Waste %
                        </label>
                        <input
                          type="number"
                          className="bg-surface-2 border border-border-subtle text-xs px-2 py-1.5 rounded outline-none text-main"
                          value={res.waste_factor_pct || 0}
                          onChange={(e) => {
                            const next = [...formData.resources];
                            next[idx].waste_factor_pct =
                              parseFloat(e.target.value) || 0;
                            setFormData({ ...formData, resources: next });
                          }}
                        />
                      </div>
                    </div>
                  ))}

                  {formData.resources.length === 0 && (
                    <div className="text-center py-6 border border-dashed border-border-subtle rounded-xl text-xs text-ghost italic bg-surface-base/50">
                      No recipe components added yet. Add resources from the
                      library or create ad-hoc rows.
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                    <button
                      onClick={() => setShowResourcePicker(true)}
                      className="flex items-center justify-center gap-2 p-2.5 border border-border-subtle border-dashed rounded-xl text-xs text-ghost hover:text-main hover:border-ghost transition-all bg-surface-base cursor-pointer"
                    >
                      <Library className="w-4 h-4 text-primary" />
                      Pick Resource from Library
                    </button>

                    <button
                      onClick={() => {
                        setFormData({
                          ...formData,
                          resources: [
                            ...formData.resources,
                            {
                              resource_type: "material",
                              resource_name: "",
                              resource_unit: "",
                              consumption_rate: 0,
                              waste_factor_pct: 0,
                            },
                          ],
                        });
                      }}
                      className="flex items-center justify-center gap-2 p-2.5 border border-border-subtle border-dashed rounded-xl text-xs text-ghost hover:text-main hover:border-ghost transition-all bg-surface-base cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-main" />
                      Add Ad-hoc Resource
                    </button>
                  </div>
                </div>
              </div>

              {/* Extra Logistical Information (Team Setup & Notes) */}
              <div>
                <h4 className="text-xs font-bold text-ghost uppercase tracking-wider mb-3 border-b border-border-subtle pb-1">
                  Ops & Logistics
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-ghost uppercase tracking-wider">
                      Team Setup
                    </label>
                    <textarea
                      className="bg-surface-base border border-border-subtle rounded px-3 py-2 text-sm outline-none focus:border-primary text-main min-h-[90px]"
                      value={formData.team_setup}
                      onChange={(e) =>
                        setFormData({ ...formData, team_setup: e.target.value })
                      }
                      placeholder="Describe the crew structure, grades needed, or typical setups..."
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-ghost uppercase tracking-wider">
                      Notes & Remarks
                    </label>
                    <textarea
                      className="bg-surface-base border border-border-subtle rounded px-3 py-2 text-sm outline-none focus:border-primary text-main min-h-[90px]"
                      value={formData.notes || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      placeholder="Enter additional explanations, assumptions, or notes..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-border-subtle bg-surface-1">
              <button
                onClick={() => {
                  setIsAdding(false);
                  setEditingItem(null);
                }}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="btn btn-accent btn-sm shadow-md flex items-center gap-1.5"
                disabled={loading}
              >
                {loading
                  ? "Saving..."
                  : editingItem
                    ? "Update Everything"
                    : "Save Everything"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border-subtle flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
            <input
              type="text"
              placeholder="Search trade items or codes…"
              className="w-full bg-surface-2 border border-border-subtle rounded-md py-2 pl-10 pr-4 text-sm outline-none focus:border-primary transition-colors text-main"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 bg-surface-2 border border-border-subtle p-1 rounded-lg">
            {(isGodMode || tierFilter === "all") && (
              <button
                onClick={() => setTierFilter("all")}
                className={cn(
                  "px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all",
                  tierFilter === "all"
                    ? "bg-border-subtle text-main"
                    : "text-ghost hover:text-dim",
                )}
              >
                All
              </button>
            )}
            {(isGodMode || tierFilter === "global") && (
              <button
                onClick={() => setTierFilter("global")}
                className={cn(
                  "px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all",
                  tierFilter === "global"
                    ? "bg-border-subtle text-accent"
                    : "text-ghost hover:text-dim",
                )}
              >
                Global
              </button>
            )}
            <button
              onClick={() => setTierFilter("company")}
              className={cn(
                "px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all",
                tierFilter === "company"
                  ? "bg-border-subtle text-accent"
                  : "text-ghost hover:text-dim",
              )}
            >
              Company
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[calc(100vh-320px)]">
          {loading ? (
            <div className="py-24 text-center">
              <div className="w-8 h-8 border-2 border-border-subtle border-t-primary rounded-full animate-spin mx-auto mb-4" />
              <div className="text-sm text-ghost">Loading trade library…</div>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="py-24 text-center text-ghost">
              <Search className="w-12 h-12 opacity-10 mx-auto mb-4" />
              <div className="text-lg font-medium">No trade items found</div>
              <div className="text-sm">
                Try adjusting your search or filters
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredGroups.map((group) => (
                <div
                  key={group.code}
                  className="border-b border-border-subtle last:border-0"
                >
                  <button
                    onClick={() => toggleGroup(group.code)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-main/5 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center text-lg">
                      {getGroupEmoji(group.code)}
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] font-bold text-main">
                        {cleanRichText(group.name)}
                      </div>
                      <div className="text-[10px] font-mono text-ghost uppercase tracking-wider">
                        {cleanRichText(group.code)} • {group.items.length} Items
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-[10px] font-mono text-ghost bg-surface-2 px-2 py-0.5 rounded border border-border-subtle">
                        Total: {group.items.length}
                      </div>
                      {expandedGroups.has(group.code) ? (
                        <ChevronDown className="w-4 h-4 text-ghost" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-ghost" />
                      )}
                    </div>
                  </button>

                  {expandedGroups.has(group.code) && (
                    <div className="bg-surface-base divide-y divide-border-subtle">
                      <div className="bg-surface-2 border-b border-border-subtle flex items-center px-6 py-2">
                        <div className="w-10 whitespace-nowrap">
                          <input
                            type="checkbox"
                            className="rounded border-border-subtle bg-surface-base text-primary focus:ring-primary"
                            checked={group.items.every((i) =>
                              selectedCodes.has(i.code),
                            )}
                            onChange={() => toggleSelectAll(group.code)}
                          />
                        </div>
                        <div className="w-16 font-mono text-[10px] uppercase tracking-widest text-ghost ml-4 whitespace-nowrap">
                          Item No.
                        </div>
                        <div className="w-24 font-mono text-[10px] uppercase tracking-widest text-ghost whitespace-nowrap">
                          Code
                        </div>
                        <div className="flex-1 font-mono text-[10px] uppercase tracking-widest text-ghost whitespace-nowrap">
                          Trade Item
                        </div>
                        <div className="w-32 whitespace-nowrap"></div>
                      </div>
                      {group.items.map((item, index) => (
                        <div
                          key={`${item.code}-${item.tier}-${index}`}
                          className="group hover:bg-main/5 transition-colors cursor-pointer"
                          onClick={() => setSelectedItem(item)}
                        >
                          <div className="flex items-center gap-4 px-6 py-3.5">
                            <div
                              className="w-10 whitespace-nowrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                className="rounded border-border-subtle bg-surface-base text-primary focus:ring-primary"
                                checked={selectedCodes.has(item.code)}
                                onChange={() => toggleSelect(item.code)}
                              />
                            </div>
                            <div className="w-16 font-mono text-[11px] text-ghost whitespace-nowrap">
                              {(index + 1).toString().padStart(2, "0")}
                            </div>
                            <div className="w-24 font-mono text-[11px] font-bold text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded text-center whitespace-nowrap">
                              {cleanRichText(item.code)}
                            </div>
                            <div className="flex-1 min-w-0 whitespace-nowrap">
                              <div className="text-[13px] font-medium text-main truncate">
                                {cleanRichText(item.name)}
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] font-mono text-ghost">
                                  per {cleanRichText(item.unit)}
                                </span>
                                {item.outputQty && (
                                  <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                    {item.outputQty} {item.unit}/day
                                  </span>
                                )}
                                {item.labHrs && (
                                  <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                                    {item.labHrs} hrs/{item.unit}
                                  </span>
                                )}
                                <div
                                  className={cn(
                                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
                                    item.tier === "global"
                                      ? "bg-accent/5 text-accent border-accent/10"
                                      : "bg-primary/5 text-primary border-primary/10",
                                  )}
                                >
                                  {item.tier}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              {item.tier === "global" &&
                                hasCapability("trade:view_global") && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      cloneGlobalTrades([item.code]);
                                    }}
                                    className="p-1.5 text-accent hover:bg-accent/10 rounded-md transition-colors"
                                    title="Clone to Company Library"
                                  >
                                    <Globe className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              {item.tier === "company" && isGodMode && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (
                                      !confirm(
                                        "Promote this trade item to Global Library?",
                                      )
                                    )
                                      return;
                                    try {
                                      const { error } = await supabase
                                        .from("trade_items")
                                        .update({
                                          library_tier: "global",
                                          tenant_id: null,
                                        })
                                        .eq("trade_code", item.code);
                                      if (error) throw error;
                                      showToast(
                                        "Promoted to Global successfully!",
                                        "success",
                                      );
                                      loadTradeLibrary();
                                    } catch (err: any) {
                                      showToast(
                                        "Error promoting: " + err.message,
                                        "error",
                                      );
                                    }
                                  }}
                                  className="p-1.5 text-accent hover:bg-accent/10 rounded-md transition-colors"
                                  title="Promote to Global"
                                >
                                  <Globe className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {((item.tier === "company" &&
                                hasCapability("trade:edit_company")) ||
                                isGodMode) && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEdit(item);
                                    }}
                                    className="p-1.5 hover:bg-surface-2 rounded-md text-ghost hover:text-main"
                                    title="Edit Trade Item Info"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteTrade(item.code);
                                    }}
                                    className="p-1.5 hover:bg-danger/10 rounded-md text-ghost hover:text-danger"
                                    title="Delete Trade Item"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              <ChevronRight className="w-4 h-4 text-ghost" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Slide-over */}
      {selectedItem && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-[60] animate-in fade-in duration-300"
            onClick={() => setSelectedItem(null)}
          />
          <div className="fixed inset-y-0 right-0 w-[520px] bg-surface-1 border-l border-border-subtle shadow-2xl z-[70] flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-5 border-b border-border-subtle flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-[11px] font-bold text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded">
                    {selectedItem.code}
                  </span>
                  <span className="text-[11px] text-ghost font-medium uppercase tracking-wider">
                    {getGroupLabel(selectedItem.group)}
                  </span>
                </div>
                <div className="text-lg font-bold leading-tight text-main">
                  {selectedItem.name}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedItem(null);
                  setIsEditingRecipe(false);
                  setRecipeDraft([]);
                }}
                className="w-8 h-8 rounded-full bg-surface-2 border border-border-subtle flex items-center justify-center hover:bg-surface-2/80 transition-colors"
              >
                <X className="w-4 h-4 text-dim" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
              {/* KPIs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-2 border border-border-subtle rounded-xl p-4 text-center">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-ghost mb-1">
                    Daily Output
                  </div>
                  <div className="text-2xl font-bold text-main font-mono">
                    {selectedItem.outputQty || "—"}
                  </div>
                  <div className="text-[10px] text-ghost mt-1">
                    {selectedItem.unit} / day
                  </div>
                </div>
                <div className="bg-surface-2 border border-border-subtle rounded-xl p-4 text-center">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-ghost mb-1">
                    Labour Hours
                  </div>
                  <div className="text-2xl font-bold text-main font-mono">
                    {selectedItem.labHrs || "—"}
                  </div>
                  <div className="text-[10px] text-ghost mt-1">
                    hrs / {selectedItem.unit}
                  </div>
                </div>
              </div>

              {/* Team Setup */}
              {selectedItem.teamSetup && (
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-ghost mb-3 border-b border-border-subtle pb-2">
                    Team Setup
                  </div>
                  <div className="text-[13px] text-dim leading-relaxed whitespace-pre-wrap bg-surface-2 p-4 rounded-lg border border-border-subtle">
                    {selectedItem.teamSetup}
                  </div>
                </div>
              )}

              {/* Recipe */}
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-border-subtle pb-2">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-ghost">
                    {isEditingRecipe ? "Recipe Editor" : "Resource Recipe"}
                  </div>
                  <div className="flex items-center gap-3">
                    {isEditingRecipe && (
                      <button
                        onClick={handleAddRecipeRow}
                        className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 hover:bg-primary/20"
                      >
                        + Add Row
                      </button>
                    )}
                    <div className="text-[10px] text-ghost">
                      per {selectedItem.unit}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  {isEditingRecipe ? (
                    recipeDraft.length === 0 ? (
                      <div className="py-8 text-center text-ghost bg-surface-2 rounded-lg border border-dashed border-border-subtle">
                        <button
                          onClick={handleAddRecipeRow}
                          className="text-xs hover:text-main text-accent"
                        >
                          + Add your first resource
                        </button>
                      </div>
                    ) : (
                      recipeDraft.map((res, idx) => (
                        <div
                          key={idx}
                          className="bg-surface-2 border border-border-subtle rounded-lg p-3 flex flex-col gap-3 group relative"
                        >
                          <button
                            onClick={() => handleRemoveRecipeRow(idx)}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-danger text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                          >
                            <X className="w-3 h-3" />
                          </button>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] uppercase font-bold text-ghost">
                                Type
                              </label>
                              <select
                                className="bg-surface-base border border-border-subtle text-xs px-2 py-1 rounded outline-none text-main"
                                value={res.resource_type || "material"}
                                onChange={(e) =>
                                  handleUpdateRecipeDraft(idx, {
                                    resource_type: e.target.value,
                                  })
                                }
                              >
                                <option value="material">Material</option>
                                <option value="labour">Labour</option>
                                <option value="equipment">Equipment</option>
                                <option value="vehicle">Vehicle</option>
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] uppercase font-bold text-ghost">
                                Res Code
                              </label>
                              <input
                                className="bg-surface-base border border-border-subtle text-xs px-2 py-1 rounded outline-none text-ghost font-mono"
                                value={res.resource_code || ""}
                                readOnly
                                tabIndex={-1}
                                placeholder="Auto-populated"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] uppercase font-bold text-ghost">
                                Resource Name
                              </label>
                              <div className="relative">
                                <select
                                  className="w-full bg-surface-base border border-border-subtle text-xs px-2 py-1 rounded outline-none text-main appearance-none"
                                  value={res.resource_name || ""}
                                  onChange={(e) => {
                                    const name = e.target.value;
                                    const type =
                                      res.resource_type || "material";
                                    let resource: any = null;

                                    switch (type) {
                                      case "material":
                                        resource =
                                          libraryResources.materials.find(
                                            (m) => m.material_name === name,
                                          );
                                        break;
                                      case "labour":
                                        resource = libraryResources.labour.find(
                                          (l) => l.title === name,
                                        );
                                        break;
                                      case "equipment":
                                        resource =
                                          libraryResources.equipment.find(
                                            (eq) => eq.name === name,
                                          );
                                        break;
                                      case "vehicle":
                                        resource =
                                          libraryResources.vehicles.find(
                                            (v) => v.name === name,
                                          );
                                        break;
                                      case "fuel":
                                        resource = libraryResources.fuel.find(
                                          (f) => f.name === name,
                                        );
                                        break;
                                    }

                                    if (resource) {
                                      handleUpdateRecipeDraft(idx, {
                                        resource_name: name,
                                        resource_code:
                                          resource.material_code ||
                                          resource.grade_code ||
                                          resource.equipment_code ||
                                          resource.vehicle_code ||
                                          resource.fuel_code ||
                                          "",
                                        resource_unit:
                                          resource.unit ||
                                          (res.resource_type === "labour" ||
                                          res.resource_type === "equipment" ||
                                          res.resource_type === "vehicle"
                                            ? "day"
                                            : ""),
                                      });
                                    } else {
                                      handleUpdateRecipeDraft(idx, {
                                        resource_name: name,
                                      });
                                    }
                                  }}
                                >
                                  <option value="">
                                    -- Select {res.resource_type} --
                                  </option>
                                  {(res.resource_type === "material"
                                    ? libraryResources.materials
                                    : res.resource_type === "labour"
                                      ? libraryResources.labour
                                      : res.resource_type === "equipment"
                                        ? libraryResources.equipment
                                        : res.resource_type === "vehicle"
                                          ? libraryResources.vehicles
                                          : res.resource_type === "fuel"
                                            ? libraryResources.fuel
                                            : []
                                  ).map((item: any) => (
                                    <option
                                      key={item.id}
                                      value={
                                        item.material_name ||
                                        item.title ||
                                        item.name
                                      }
                                    >
                                      {item.material_name ||
                                        item.title ||
                                        item.name}
                                    </option>
                                  ))}
                                </select>
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-ghost">
                                  <ChevronDown className="w-3 h-3" />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] uppercase font-bold text-ghost">
                                Consumption
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  step="any"
                                  className="flex-1 bg-surface-base border border-border-subtle text-xs px-2 py-1 rounded outline-none text-main"
                                  value={res.consumption_rate || 0}
                                  onChange={(e) =>
                                    handleUpdateRecipeDraft(idx, {
                                      consumption_rate:
                                        parseFloat(e.target.value) || 0,
                                    })
                                  }
                                />
                                <button
                                  onClick={() =>
                                    setShowCalculator({ index: idx, row: res })
                                  }
                                  className="p-1 text-accent hover:bg-accent/10 rounded transition-colors"
                                  title="Open Calculator"
                                >
                                  <Calculator className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] uppercase font-bold text-ghost">
                                Unit
                              </label>
                              <input
                                className="bg-surface-base border border-border-subtle text-xs px-2 py-1 rounded outline-none text-ghost"
                                value={res.resource_unit || ""}
                                readOnly
                                tabIndex={-1}
                                placeholder="Auto"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] uppercase font-bold text-ghost">
                                Waste %
                              </label>
                              <input
                                type="number"
                                className="bg-surface-base border border-border-subtle text-xs px-2 py-1 rounded outline-none text-main"
                                value={res.waste_factor_pct || 0}
                                onChange={(e) =>
                                  handleUpdateRecipeDraft(idx, {
                                    waste_factor_pct:
                                      parseFloat(e.target.value) || 0,
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )
                  ) : (
                    <>
                      {isSyncing && enrichedResources.length === 0 ? (
                        <div className="py-8 text-center text-ghost">
                          <div className="w-4 h-4 border border-border-subtle border-t-primary rounded-full animate-spin mx-auto mb-2" />
                          <div className="text-[10px]">
                            Fetching library data...
                          </div>
                        </div>
                      ) : enrichedResources.length === 0 ? (
                        <div className="py-8 text-center text-ghost bg-surface-2 rounded-lg border border-dashed border-border-subtle">
                          <Info className="w-6 h-6 opacity-20 mx-auto mb-2" />
                          <div className="text-xs">
                            No resources defined for this recipe
                          </div>
                        </div>
                      ) : (
                        (() => {
                          const groupsObj: Record<
                            string,
                            typeof enrichedResources
                          > = {
                            Material: [],
                            Labour: [],
                            Equipment: [],
                            Vehicle: [],
                            Fuel: [],
                            Other: [],
                          };
                          enrichedResources.forEach((res) => {
                            const type = (res.resource_type || "")
                              .toLowerCase()
                              .trim();
                            if (type === "material") {
                              groupsObj["Material"].push(res);
                            } else if (type === "labour" || type === "labor") {
                              groupsObj["Labour"].push(res);
                            } else if (type === "equipment") {
                              groupsObj["Equipment"].push(res);
                            } else if (type === "vehicle") {
                              groupsObj["Vehicle"].push(res);
                            } else if (type === "fuel") {
                              groupsObj["Fuel"].push(res);
                            } else {
                              groupsObj["Other"].push(res);
                            }
                          });

                          return Object.entries(groupsObj).map(
                            ([groupName, items]) => {
                              if (items.length === 0) return null;
                              return (
                                <div key={groupName} className="mb-4 last:mb-0">
                                  <div className="flex items-center gap-1.5 mb-2 px-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                                    <span className="text-[10px] font-bold text-ghost uppercase tracking-wider">
                                      {groupName}
                                    </span>
                                    <span className="text-[9px] text-ghost/60 font-mono">
                                      ({items.length})
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    {items.map((res, idx) => (
                                      <div
                                        key={idx}
                                        className="bg-surface-2 border border-border-subtle rounded-lg p-3 flex items-center gap-3 hover:border-border-accent/30 transition-colors"
                                      >
                                        <div className="w-8 h-8 rounded-md bg-surface-base flex items-center justify-center text-dim flex-shrink-0 border border-border-subtle">
                                          {getResourceIcon(
                                            res.resource_type || "",
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between">
                                            <div className="text-[13px] font-semibold text-main truncate">
                                              {res.resource_name}
                                            </div>
                                            {res.not_found && (
                                              <span className="text-[9px] font-bold text-danger bg-danger/10 px-1.5 py-0.5 rounded border border-danger/20">
                                                Not in Library
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center justify-between mt-0.5">
                                            <div className="flex items-center gap-2">
                                              <span className="text-[11px] font-mono text-dim">
                                                {res.consumption_rate}{" "}
                                                {res.resource_unit}
                                              </span>
                                              {res.waste_factor_pct &&
                                                res.waste_factor_pct > 0 && (
                                                  <span className="text-[9px] font-mono text-warning/60">
                                                    (+{res.waste_factor_pct}%
                                                    waste)
                                                  </span>
                                                )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            },
                          );
                        })()
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Notes */}
              {selectedItem.notes && (
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-ghost mb-3 border-b border-border-subtle pb-2">
                    Field Notes
                  </div>
                  <div className="text-[13px] text-ghost italic leading-relaxed">
                    "{selectedItem.notes}"
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-border-subtle bg-surface-1 flex items-center justify-end gap-3">
              {isEditingRecipe ? (
                <>
                  <button
                    onClick={() => setIsEditingRecipe(false)}
                    className="btn btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveRecipe}
                    className="btn btn-accent"
                    disabled={loading}
                  >
                    {loading ? "Saving..." : "Save Recipe"}
                  </button>
                </>
              ) : (
                ((selectedItem.tier === "company" &&
                  hasCapability("trade:edit_company")) ||
                  isGodMode) && (
                  <>
                    <button
                      onClick={handleStartEditRecipe}
                      className="btn btn-ghost"
                    >
                      Edit Recipe
                    </button>
                    <button
                      onClick={() => handleEdit(selectedItem)}
                      className="btn btn-primary"
                    >
                      Edit Trade Info
                    </button>
                  </>
                )
              )}
            </div>
          </div>
        </>
      )}

      {/* Notifications */}
      {notification && (
        <div
          className={cn(
            "fixed top-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl animate-in slide-in-from-right duration-300 flex items-center gap-3 border",
            notification.type === "success"
              ? "bg-primary text-surface-base border-primary"
              : notification.type === "error"
                ? "bg-danger text-white border-danger"
                : "bg-surface-2 text-main border-border-subtle",
          )}
        >
          {notification.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="text-sm font-bold">{notification.message}</span>
        </div>
      )}

      {/* Import Preview Modal */}
      {showImportPreview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[120] flex items-center justify-center p-6">
          <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-5xl h-[85vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border-subtle flex items-center justify-between bg-surface-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <FileSearch className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-main">
                    Import Analysis Overview
                  </h3>
                  <p className="text-xs text-ghost">
                    Review how items will be merged into the library
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowImportPreview(false)}
                className="p-2 text-ghost hover:text-main hover:bg-border-subtle rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Statistics */}
            <div className="p-4 grid grid-cols-4 gap-4 bg-surface-base">
              <div className="bg-surface-2 p-3 rounded-xl border border-border-subtle">
                <p className="text-[10px] font-bold text-ghost uppercase tracking-wider mb-1">
                  Total Items
                </p>
                <p className="text-xl font-bold text-main">
                  {importPreviewRows.length}
                </p>
              </div>
              <div className="bg-primary/10 p-3 rounded-xl border border-primary/20">
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
                  New To Library
                </p>
                <p className="text-xl font-bold text-primary">
                  {importPreviewRows.filter((r) => r.status === "new").length}
                </p>
              </div>
              <div className="bg-warning/10 p-3 rounded-xl border border-warning/20">
                <p className="text-[10px] font-bold text-warning uppercase tracking-wider mb-1">
                  Items To Update
                </p>
                <p className="text-xl font-bold text-warning">
                  {
                    importPreviewRows.filter((r) => r.status === "update")
                      .length
                  }
                </p>
              </div>
              <div className="bg-danger/10 p-3 rounded-xl border border-danger/20">
                <p className="text-[10px] font-bold text-danger uppercase tracking-wider mb-1">
                  Items To Skip
                </p>
                <p className="text-xl font-bold text-danger">
                  {importPreviewRows.filter((r) => r.status === "skip").length}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="pb-3 text-[10px] font-bold text-ghost uppercase tracking-wider">
                      Status
                    </th>
                    <th className="pb-3 text-[10px] font-bold text-ghost uppercase tracking-wider">
                      Group
                    </th>
                    <th className="pb-3 text-[10px] font-bold text-ghost uppercase tracking-wider">
                      Item Code
                    </th>
                    <th className="pb-3 text-[10px] font-bold text-ghost uppercase tracking-wider">
                      Item Name
                    </th>
                    <th className="pb-3 text-[10px] font-bold text-ghost uppercase tracking-wider">
                      Resource
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-2">
                  {importPreviewRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-surface-2/50 transition-colors"
                    >
                      <td className="py-3">
                        {row.status === "new" && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary">
                            NEW
                          </span>
                        )}
                        {row.status === "update" && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-warning/10 text-warning">
                            UPDATE
                          </span>
                        )}
                        {row.status === "skip" && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-danger/10 text-danger">
                            SKIP
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-xs text-dim">
                        {row.trade_group}
                      </td>
                      <td className="py-3 text-xs font-mono font-bold text-main">
                        {row.trade_code}
                      </td>
                      <td className="py-3 text-xs text-main">
                        {row.trade_item}
                      </td>
                      <td className="py-3 text-xs text-ghost">
                        {row.resource_name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-surface-2 border-t border-border-subtle flex items-center justify-between">
              <div className="text-xs text-ghost">
                {importMode === "overwrite"
                  ? "Note: Duplicate items will be updated (overwritten) with Excel data."
                  : "Note: Duplicate items will be skipped to preserve existing library data."}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowImportPreview(false)}
                  className="px-6 py-2 rounded-lg text-sm font-bold text-dim hover:bg-border-subtle transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBatchImport}
                  disabled={isImporting}
                  className="bg-primary text-surface-base px-8 py-2 rounded-lg text-sm font-bold hover:brightness-110 transition-all flex items-center gap-2 shadow-lg shadow-primary/10 disabled:opacity-50"
                >
                  {isImporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Confirm & Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6">
          <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border-subtle flex items-center gap-3 bg-surface-2">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center text-warning">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-main">Confirm Action</h3>
                <p className="text-xs text-ghost">
                  Please verify before proceeding
                </p>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-dim leading-relaxed">
                {confirmAction.message}
              </p>
            </div>
            <div className="p-4 bg-surface-2 border-t border-border-subtle flex items-center gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-bold text-dim hover:bg-border-subtle transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction.onConfirm}
                className="flex-1 bg-primary text-surface-base px-4 py-2 rounded-lg text-sm font-bold hover:brightness-110 transition-all"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showCalculator && (
        <ConsumptionCalculator
          resourceName={showCalculator.row.resource_name}
          resourceUnit={showCalculator.row.resource_unit}
          boqUnit={selectedItem?.unit || ""}
          onClose={() => setShowCalculator(null)}
          onConfirm={(rate) => {
            handleUpdateRecipeDraft(showCalculator.index, {
              consumption_rate: rate,
            });
            setShowCalculator(null);
          }}
        />
      )}

      {showResourcePicker && (
        <ResourcePickerModal
          tenantId={tenantId}
          onClose={() => setShowResourcePicker(false)}
          onSelect={(res) => {
            setFormData({
              ...formData,
              resources: [
                ...formData.resources,
                {
                  resource_type: res.type,
                  resource_name: res.name,
                  resource_code: res.code,
                  resource_unit: res.unit,
                  consumption_rate: 0,
                  waste_factor_pct: 0,
                },
              ],
            });
            setShowResourcePicker(false);
          }}
        />
      )}

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", duration: 0.35 }}
            className="fixed bottom-6 right-6 z-[250] flex items-center gap-3 bg-surface-1 border border-border-subtle shadow-2xl rounded-2xl p-4 max-w-sm"
          >
            <div
              className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                toast.type === "success" &&
                  "bg-primary/10 text-primary border border-primary/20",
                toast.type === "error" &&
                  "bg-danger/10 text-danger border border-danger/20",
                toast.type === "warning" &&
                  "bg-warning/10 text-warning border border-warning/20",
                toast.type === "info" &&
                  "bg-accent/10 text-accent border border-accent/20",
              )}
            >
              {toast.type === "success" && <CheckCircle className="w-4 h-4" />}
              {toast.type === "error" && <AlertCircle className="w-4 h-4" />}
              {toast.type === "warning" && <AlertCircle className="w-4 h-4" />}
              {toast.type === "info" && <Info className="w-4 h-4" />}
            </div>
            <div className="flex-1 text-left min-w-0 pr-1">
              <p className="text-xs font-semibold text-main leading-tight capitalize">
                {toast.type}
              </p>
              <p className="text-[11px] text-dim font-medium mt-0.5 leading-snug break-words">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="p-1 text-ghost hover:text-main rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
