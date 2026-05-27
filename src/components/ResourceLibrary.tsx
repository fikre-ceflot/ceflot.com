import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Package, 
  Users, 
  Wrench, 
  Truck, 
  Fuel, 
  Briefcase,
  Plus,
  Search,
  Edit2,
  Trash2,
  Save,
  X,
  MoreVertical,
  Globe,
  Building2,
  FileUp,
  Download,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  Zap
} from 'lucide-react';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { cn, cleanRichText } from '../lib/utils';
import { usePermissions } from '../hooks/usePermissions';
import { exportMaterialList } from '../lib/exportUtils';
import { RESOURCE_CATEGORIES, TRADE_GROUPS, getGroupLabel, getGroupEmoji } from '../lib/constants';

type ResourceType = 'material' | 'labour' | 'equipment' | 'vehicle' | 'fuel' | 'subcontractor';

interface Resource {
  id: string;
  tenant_id: string | null;
  name: string;
  code: string;
  unit: string;
  base_rate: number;
  category?: string;
  library_tier: 'global' | 'company';
  is_active: boolean;
  [key: string]: any; // Allow arbitrary fields for specific columns
}

const TABLE_NAME_COLUMNS: Record<string, string> = {
  'materials': 'material_name',
  'labour_grades': 'title',
  'equipment_items': 'name',
  'vehicles': 'name',
  'fuel_types': 'name',
  'subcontractor_categories': 'name'
};

const TABLE_CODE_COLUMNS: Record<string, string> = {
  'materials': 'material_code',
  'labour_grades': 'grade_code',
  'equipment_items': 'equipment_code',
  'vehicles': 'vehicle_code',
  'fuel_types': 'fuel_code',
  'subcontractor_categories': 'category_code'
};

const TABS: { id: ResourceType; label: string; icon: any; table: string }[] = [
  { id: 'material', label: 'Materials', icon: Package, table: 'materials' },
  { id: 'labour', label: 'Labour Grades', icon: Users, table: 'labour_grades' },
  { id: 'equipment', label: 'Equipment', icon: Wrench, table: 'equipment_items' },
  { id: 'vehicle', label: 'Vehicles', icon: Truck, table: 'vehicles' },
  { id: 'fuel', label: 'Fuel Types', icon: Fuel, table: 'fuel_types' },
  { id: 'subcontractor', label: 'Subcontractors', icon: Briefcase, table: 'subcontractor_categories' },
];

interface ResourceLibraryProps {
  userRole: any;
  tenantId: any;
  isGodMode?: boolean;
}

const TAB_COLUMNS: Record<ResourceType, { key: string; label: string; align?: 'left' | 'right' }[]> = {
  material: [
    { key: 'material_code', label: 'Code' },
    { key: 'category', label: 'Category' },
    { key: 'material_name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'unit', label: 'Unit' },
    { key: 'base_rate', label: 'Unit Rate', align: 'right' },
    { key: 'supplier_name', label: 'Supplier' },
    { key: 'lead_time_days', label: 'Lead Time' }
  ],
  labour: [
    { key: 'grade_code', label: 'Code' },
    { key: 'category', label: 'Category' },
    { key: 'title', label: 'Title' },
    { key: 'trade_group', label: 'Trade Group' },
    { key: 'description', label: 'Description' },
    { key: 'base_rate', label: 'Daily Rate', align: 'right' },
    { key: 'source_type', label: 'Source' }
  ],
  equipment: [
    { key: 'equipment_code', label: 'Code' },
    { key: 'category_name', label: 'Category' },
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'type', label: 'Type' },
    { key: 'base_rate', label: 'Rental Rate', align: 'right' },
    { key: 'owned_or_hired', label: 'Owned/Hired' }
  ],
  vehicle: [
    { key: 'vehicle_code', label: 'Code' },
    { key: 'category_name', label: 'Category' },
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'type', label: 'Type' },
    { key: 'rate_type', label: 'Rate Type' },
    { key: 'base_rate', label: 'Rate', align: 'right' }
  ],
  fuel: [
    { key: 'fuel_code', label: 'Code' },
    { key: 'category_name', label: 'Category' },
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'unit', label: 'Unit' },
    { key: 'base_rate', label: 'Unit Price', align: 'right' }
  ],
  subcontractor: [
    { key: 'category_code', label: 'Code' },
    { key: 'category_name', label: 'Category' },
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'base_rate', label: 'Base Rate', align: 'right' }
  ]
};

const STANDARD_CATEGORIES: Record<ResourceType, string[]> = RESOURCE_CATEGORIES;

export function ResourceLibrary({ userRole, tenantId, isGodMode }: ResourceLibraryProps) {
  const { hasCapability } = usePermissions(userRole, tenantId);
  const [activeTab, setActiveTab] = useState<ResourceType>('material');
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'global' | 'company'>(isGodMode ? 'all' : 'company');
  const [isAdding, setIsAdding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [tenants, setTenants] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [showUniqueOnly, setShowUniqueOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const fetchTenants = async () => {
      const { data } = await supabase.from('tenants').select('id, name');
      if (data) setTenants(data);
    };
    const fetchSuppliers = async () => {
      const { data } = await supabase.from('suppliers').select('id, company_name, category').eq('is_active', true);
      if (data) setSuppliers(data);
    };
    if (isGodMode) fetchTenants();
    fetchSuppliers();
  }, [isGodMode]);

  // Form state
  const [formData, setFormData] = useState<Record<string, any>>({
    code: '',
    name: '',
    unit: '',
    base_rate: 0,
    category: ''
  });

  useEffect(() => {
    loadResources();
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, [activeTab]);

  const loadResources = async () => {
    setLoading(true);
    const tab = TABS.find(t => t.id === activeTab);
    if (!tab) return;

    try {
      const nameCol = TABLE_NAME_COLUMNS[tab.table] || 'name';
      console.log(`[ResourceLibrary] Loading from ${tab.table}. TenantID: ${tenantId}, GodMode: ${isGodMode}`);
      
      let query = supabase.from(tab.table).select('*');
      
      // If not God Mode, only show global or own tenant data
      if (!isGodMode && tenantId && tenantId !== 'null') {
        query = query.or(`library_tier.eq.global,tenant_id.eq.${tenantId}`);
      } else if (!isGodMode && (!tenantId || tenantId === 'null')) {
        query = query.eq('library_tier', 'global');
      }

      const response = await query;

      if (response.error) {
        console.error(`[ResourceLibrary] Supabase error loading ${tab.table}:`, response.error);
        throw response.error;
      }
      
      const data = response.data || [];
      console.log(`[ResourceLibrary] Loaded ${data.length} rows from ${tab.table}`);

      // Map the dynamic name column to 'name' for the UI
      const mappedData = (data || []).map(item => {
        const parseVal = (val: any) => {
          if (typeof val === 'number') return val;
          if (!val) return 0;
          const cleaned = String(val).replace(/[^\d.-]/g, '');
          const parsed = parseFloat(cleaned);
          return isNaN(parsed) ? 0 : parsed;
        };

        // Mapping to avoid "Unnamed Resource"
        const nameCol = TABLE_NAME_COLUMNS[tab.table] || 'name';
        
        // Try to find a name in order of preference
        const rawName = cleanRichText(
          item.description ||
          item.trade ||
          item[nameCol] || 
          item.name || 
          item.material_name || 
          item.labour_grade || 
          item.equipment_name || 
          item.vehicle_name || 
          item.fuel_type || 
          item.title ||
          'Unnamed Resource'
        );
        
        // Try to find a code in order of preference
        const rawCode = cleanRichText(
          item.material_code || 
          item.labour_code || 
          item.equipment_code || 
          item.vehicle_code || 
          item.fuel_code || 
          item.code || 
          item.item_code || 
          item.grade_code || 
          item.category_code || 
          'N/A'
        );
        
        // Use existing category or 'General'
        const actualCategory = cleanRichText(
          item.category_name || 
          item.category ||
          item.trade_group || 
          item.type || 
          'General'
        );

        // Rate detection
        const detectedRate = 
          item.base_rate || 
          item.rate || 
          item.unit_price || 
          item.price || 
          item.daily_rate || 
          0;

        // Unit detection
        const rawUnit = cleanRichText(item.unit || item.uom || item.Unit || item.UoM || 'Unit');

        return {
          ...item,
          name: rawName,
          code: rawCode,
          unit: rawUnit,
          category: actualCategory,
          category_name: actualCategory,
          description: cleanRichText(item.description) || rawName,
          library_tier: item.library_tier || 'global',
          base_rate: parseVal(detectedRate)
        };
      });
      
      // Sort by code primarily, then name
      mappedData.sort((a, b) => {
        if (a.code !== 'N/A' && b.code !== 'N/A') {
          return a.code.localeCompare(b.code);
        }
        return a.name.localeCompare(b.name);
      });
      
      setResources(mappedData);
    } catch (e: any) {
      console.error(`Error loading ${activeTab}:`, e.message);
      setResources([]); // Ensure it's at least an empty array
    } finally {
      setLoading(false);
    }
  };


  const cloneGlobalResources = async (specificIds?: string[]) => {
    if (!tenantId) {
      setNotification({ type: 'error', message: 'Please select a project first.' });
      return;
    }
    
    const activeTabDef = TABS.find(t => t.id === activeTab)!;
    let globals = resources.filter(r => r.library_tier === 'global');
    if (specificIds) {
      globals = globals.filter(r => specificIds.includes(r.id));
    } else if (selectedIds.size > 0) {
      globals = globals.filter(r => selectedIds.has(r.id));
    }

    if (globals.length === 0) {
      setNotification({ type: 'info', message: 'No global resources selected to clone.' });
      return;
    }

    setConfirmAction({
      message: `Clone ${globals.length} global ${activeTabDef.label.toLowerCase()} to your company library?`,
      onConfirm: async () => {
        setLoading(true);
        try {
          const tab = TABS.find(t => t.id === activeTab)!;
          const codeCol = TABLE_CODE_COLUMNS[tab.table];
          const nameCol = TABLE_NAME_COLUMNS[tab.table];

          // 1. Fetch existing codes for this tenant to avoid duplicates
          const { data: existingItems, error: fetchError } = await supabase
            .from(tab.table)
            .select(`${codeCol}, ${nameCol}`)
            .eq('tenant_id', tenantId)
            .eq('library_tier', 'company');

          if (fetchError) throw fetchError;

          const existingCodes = new Set(existingItems?.map(i => i[codeCol]) || []);
          
          let skippedCount = 0;
          const clones = globals.filter(g => {
            const itemCode = g[codeCol] || g.code;
            if (existingCodes.has(itemCode)) {
              skippedCount++;
              return false;
            }
            return true;
          }).map(g => {
            const { id, created_at, library_tier, tenant_id, name, code, is_active, ...rest } = g as any;
            const cleanData = { ...rest };
            delete (cleanData as any).category_name;
            
            // Ensure the specific name and code columns are included
            if (nameCol) cleanData[nameCol] = name;
            if (codeCol) cleanData[codeCol] = code;

            return {
              ...cleanData,
              tenant_id: tenantId,
              library_tier: 'company',
              is_active: true,
              origin_id: id
            };
          });

          if (clones.length > 0) {
            const { error } = await supabase.from(tab.table).insert(clones);
            if (error) throw error;
          }

          let msg = `Successfully cloned ${clones.length} items.`;
          if (skippedCount > 0) {
            msg += ` ${skippedCount} items were already in your library and were skipped.`;
          }
          
          setNotification({ 
            type: clones.length > 0 ? 'success' : 'info', 
            message: msg 
          });

          setSelectedIds(new Set());
          setIsSelectionMode(false);
          loadResources();
        } catch (e: any) {
          setNotification({ type: 'error', message: 'Error cloning resources: ' + (e.message || 'Unknown error') });
        } finally {
          setLoading(false);
          setConfirmAction(null);
        }
      }
    });
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };


  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[ResourceLibrary] handleExcelImport triggered');
    const file = e.target.files?.[0];
    if (!file) return;

    const tab = TABS.find(t => t.id === activeTab);
    if (!tab) return;

    const parseCurrency = (val: any) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      const cleaned = String(val).replace(/[^\d.-]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    };

    setIsImporting(true);
    try {
      if (!tenantId && !isGodMode) {
        throw new Error('Tenant ID missing. Please ensure you are logged in.');
      }

      console.log('[ResourceLibrary] Loading workbook...');
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);
      
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) throw new Error('No worksheet found in file.');

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

      console.log('[ResourceLibrary] Parsed rows:', data.length, data[0]);

      const nameCol = TABLE_NAME_COLUMNS[tab.table] || 'name';
      const codeCol = TABLE_CODE_COLUMNS[tab.table] || 'code';
      
      const formattedData = data.map((row: any) => {
            const itemToInsert: any = {
              tenant_id: tenantId,
              library_tier: 'company',
              is_active: true
            };

            // Map columns based on TAB_COLUMNS
            TAB_COLUMNS[activeTab].forEach(col => {
              // Try to find a matching column in the row (case-insensitive)
              const rowKey = Object.keys(row).find(k => k.toLowerCase() === col.label.toLowerCase() || k.toLowerCase() === col.key.toLowerCase());
              if (rowKey) {
                let val = row[rowKey];
                if (col.key.includes('rate') || col.key.includes('days') || col.key.includes('consumption')) {
                  val = parseCurrency(val);
                }
                itemToInsert[col.key] = val;
              }
            });

            // Fallback for name and code if not mapped
            const nameCol = TABLE_NAME_COLUMNS[tab.table] || 'name';
            const codeCol = TABLE_CODE_COLUMNS[tab.table] || 'code';

            if (!itemToInsert[nameCol]) {
              itemToInsert[nameCol] = row.Name || row.name || row.Description || row.description || 'Unnamed Resource';
            }
            if (!itemToInsert[codeCol]) {
              itemToInsert[codeCol] = row.Code || row.code || row['Item Code'] || row.item_code || 'N/A';
            }
            if (!itemToInsert.category) {
              itemToInsert.category = row.Category || row.category || 'General';
            }
            if (!itemToInsert.unit) {
              itemToInsert.unit = row.Unit || row.unit || 'Unit';
            }
            if (!itemToInsert.base_rate) {
              itemToInsert.base_rate = parseCurrency(row.Rate || row.rate || row.base_rate || row.unit_rate || row.unit_price || row.daily_rate || 0);
            }

            // Add description if table supports it
            if (tab.table !== 'labour_grades' && tab.table !== 'subcontractor_categories') {
              itemToInsert.description = itemToInsert[nameCol] || row.Description || row.description || '';
            }
            
            return itemToInsert;
          }).filter(item => {
            const nameCol = TABLE_NAME_COLUMNS[tab.table] || 'name';
            return item[nameCol] || item.description;
          });

          if (formattedData.length === 0) {
            setNotification({ type: 'error', message: 'No valid data found in Excel. Ensure you have a "Name" or "Description" column.' });
            setIsImporting(false);
            return;
          }

          // Deduplicate against existing company items
          const existingCompanyResources = resources.filter(r => r.library_tier === 'company');
          const existingKeys = new Set(existingCompanyResources.map(r => `${r.code}|${r.name}`.toLowerCase()));
          
          let skippedCount = 0;
          const finalDataToInsert = formattedData.filter(item => {
            const key = `${item[codeCol]}|${item[nameCol]}`.toLowerCase();
            if (existingKeys.has(key)) {
              skippedCount++;
              return false;
            }
            return true;
          });

          if (finalDataToInsert.length === 0) {
            setNotification({ type: 'info', message: `Import skipped: all ${formattedData.length} items already exist in your company library.` });
            setIsImporting(false);
            return;
          }

          console.log('[ResourceLibrary] Inserting formatted rows:', finalDataToInsert.length, finalDataToInsert[0]);
          const { error } = await supabase.from(tab.table).insert(finalDataToInsert);
          if (error) throw error;

          let successMsg = `Successfully imported ${finalDataToInsert.length} items!`;
          if (skippedCount > 0) successMsg += ` (${skippedCount} duplicates skipped)`;
          setNotification({ type: 'success', message: successMsg });
          loadResources();
    } catch (err: any) {
      console.error('[ResourceLibrary] Error during import processing:', err);
      setNotification({ type: 'error', message: 'Import processing failed: ' + err.message });
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  const downloadTemplate = async () => {
    const tab = TABS.find(t => t.id === activeTab);
    if (!tab) return;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Template');
    
    sheet.columns = [
      { header: 'Code', key: 'Code' },
      { header: 'Name', key: 'Name' },
      { header: 'Unit', key: 'Unit' },
      { header: 'Rate', key: 'Rate' },
      { header: 'Category', key: 'Category' }
    ];

    sheet.addRow({ Code: 'MAT-001', Name: 'Sample Item 1', Unit: 'm3', Rate: 1500, Category: 'General' });
    sheet.addRow({ Code: 'MAT-002', Name: 'Sample Item 2', Unit: 'Bag', Rate: 850, Category: 'General' });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${tab.label}_Template.xlsx`);
  };

  const handleExportExcel = async () => {
    const tab = TABS.find(t => t.id === activeTab);
    if (!tab) return;

    if (activeTab === 'material') {
      await exportMaterialList('Project Resources', resources);
      setNotification({ type: 'success', message: 'Exported material list with SUNSHINE format.' });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(tab.label);

    const cols = TAB_COLUMNS[activeTab];
    sheet.columns = [
      ...cols.map(c => ({ header: c.label, key: c.key })),
      { header: 'Tier', key: 'library_tier' },
      { header: 'Status', key: 'Status' }
    ];

    resources.forEach(res => {
      const rowData: any = {};
      cols.forEach(col => {
        rowData[col.key] = res[col.key] || '-';
      });
      rowData.library_tier = res.library_tier;
      rowData.Status = res.is_active ? 'Active' : 'Inactive';
      sheet.addRow(rowData);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${tab.label}_Library_Export.xlsx`);
    
    setNotification({ type: 'success', message: `Exported ${resources.length} items to Excel.` });
  };

  const handleBulkCleanup = async () => {
    if (!isGodMode) return;
    
    setNotification({ type: 'info', message: 'Starting bulk cleanup and recategorization...' });
    setIsImporting(true);

    try {
      const { data: tradeItems } = await supabase
        .from('trade_items')
        .select('resource_name, trade_group');
      
      const categoryMap: Record<string, string> = {};
      tradeItems?.forEach(item => {
        if (item.resource_name && item.trade_group) {
          categoryMap[item.resource_name] = item.trade_group;
        }
      });

      let updatedCount = 0;
      const tab = TABS.find(t => t.id === activeTab);
      if (!tab) return;

      for (const res of resources) {
        let newCategory = res.category || 'General';
        const name = res.name;
        
        // Migration logic: Identify if this material should be moved
        const isFuel = name?.toLowerCase().match(/fuel|diesel|petrol|gasoline|lubricant|oil/);
        const isEquipment = name?.toLowerCase().match(/excavator|loader|truck|crane|mixer|pump|generator|compressor|roller|grader|tractor/);

        if (tab.id === 'material' && (isFuel || isEquipment)) {
          const targetTable = isFuel ? 'fuel_types' : 'equipment_items';
          const nameField = isFuel ? 'fuel_type' : 'equipment_name';
          
          const { error: insertError } = await supabase
            .from(targetTable)
            .upsert({
              [nameField]: name,
              name: name,
              description: res.description || name,
              unit: res.unit,
              base_rate: res.base_rate,
              category: isFuel ? 'Fuel & Lubricants' : 'Construction Equipment',
              category_name: isFuel ? 'Fuel & Lubricants' : 'Construction Equipment',
              library_tier: res.library_tier,
              tenant_id: res.tenant_id
            });
          
          if (!insertError) {
            await supabase.from('materials').delete().eq('id', res.id);
            updatedCount++;
            continue; // Move to next resource
          }
        }

        if (name && categoryMap[name]) {
          newCategory = categoryMap[name];
        } else if (name) {
          const n = name.toLowerCase();
          // Use unified categories from TRADE_GROUPS
          if (n.includes('concrete') || n.includes('cement') || n.includes('ballast') || n.includes('sand')) newCategory = 'Concrete Works';
          else if (n.includes('steel') || n.includes('rebar') || n.includes('mesh') || n.includes('iron')) newCategory = 'Structural Steel';
          else if (n.includes('timber') || n.includes('wood') || n.includes('plywood') || n.includes('formwork')) newCategory = 'Carpentry';
          else if (n.includes('pipe') || n.includes('fitting') || n.includes('pvc') || n.includes('elbow') || n.includes('valve')) newCategory = 'Plumbing';
          else if (n.includes('cable') || n.includes('wire') || n.includes('switch') || n.includes('socket') || n.includes('conduit')) newCategory = 'Electrical';
          else if (n.includes('paint') || n.includes('gloss') || n.includes('emulsion') || n.includes('filler')) newCategory = 'Painting';
          else if (n.includes('tile') || n.includes('ceramic') || n.includes('grout')) newCategory = 'Tiling';
          else if (n.includes('brick') || n.includes('block') || n.includes('stone') || n.includes('mortar')) newCategory = 'Masonry';
          else if (n.includes('roof') || n.includes('sheet') || n.includes('gutter')) newCategory = 'Roof & Cladding';
          else if (n.includes('glass') || n.includes('window') || n.includes('door') || n.includes('lock')) newCategory = 'Glazing';
          else if (n.includes('fuel') || n.includes('diesel') || n.includes('oil')) newCategory = 'Fuel & Lubricants';
          else if (n.includes('excavator') || n.includes('truck') || n.includes('crane') || n.includes('mixer')) newCategory = 'Construction Equipment';
        }

        const dbUpdates: any = { 
          category: newCategory,
          library_tier: 'global',
          tenant_id: null,
          description: res.description || res.name
        };
        const nameCol = TABLE_NAME_COLUMNS[tab.table];
        const codeCol = TABLE_CODE_COLUMNS[tab.table];
        const rateCol = tab.id === 'material' ? 'base_rate' : 
                        tab.id === 'labour' ? 'base_rate' : 
                        tab.id === 'equipment' ? 'base_rate' : 'base_rate';

        if (nameCol) {
          dbUpdates[nameCol] = res.name;
          // Populate legacy columns for backward compatibility
          if (tab.id === 'labour') dbUpdates.labour_grade = res.name;
          if (tab.id === 'equipment') dbUpdates.equipment_name = res.name;
          if (tab.id === 'vehicle') dbUpdates.vehicle_name = res.name;
          if (tab.id === 'fuel') dbUpdates.fuel_type = res.name;
          if (tab.id === 'subcontractor') dbUpdates.category_name = res.name;
        }
        if (codeCol) dbUpdates[codeCol] = res.code;
        dbUpdates[rateCol] = res.base_rate;
        
        // Also populate category_name if it's a column
        if (tab.id === 'material' || tab.id === 'labour' || tab.id === 'equipment' || tab.id === 'vehicle' || tab.id === 'fuel' || tab.id === 'subcontractor') {
          dbUpdates.category_name = newCategory;
        }

        const { error } = await supabase.from(tab.table).update(dbUpdates).eq('id', res.id);
        if (!error) updatedCount++;
      }

      setNotification({ type: 'success', message: `Cleanup complete! Updated ${updatedCount} items.` });
      loadResources();
    } catch (e: any) {
      setNotification({ type: 'error', message: 'Cleanup failed: ' + e.message });
    } finally {
      setIsImporting(false);
    }
  };

  const handleSave = async (id?: string) => {
    const tab = TABS.find(t => t.id === activeTab);
    if (!tab) return;

    if (!tenantId && !isGodMode) {
      setNotification({ type: 'error', message: 'Tenant ID missing. Please ensure you are logged in correctly.' });
      return;
    }

    try {
      const dataToSave: any = { ...formData };
      
      // Remove UI-only helper fields
      delete dataToSave.name;
      delete dataToSave.code;
      delete dataToSave.category;
      delete dataToSave.id;
      delete dataToSave.created_at;
      delete dataToSave.updated_at;

      // Ensure base_rate is a number
      if (dataToSave.base_rate !== undefined) dataToSave.base_rate = Number(dataToSave.base_rate) || 0;

      // Map back to specific columns if they were edited via the generic fields
      const nameCol = TABLE_NAME_COLUMNS[tab.table];
      const codeCol = TABLE_CODE_COLUMNS[tab.table];
      
      if (formData.name && nameCol) dataToSave[nameCol] = formData.name;
      if (formData.code && codeCol) dataToSave[codeCol] = formData.code;
      if (formData.category) {
        dataToSave.category = formData.category;
        dataToSave.category_name = formData.category;
      }

      // Ensure library_tier and tenant_id are set for new items
      if (!id) {
        dataToSave.library_tier = isGodMode ? 'global' : 'company';
        dataToSave.tenant_id = isGodMode ? null : tenantId;
      }

      console.log(`[ResourceLibrary] Saving to ${tab.table}:`, dataToSave);

      let response;
      if (id) {
        response = await supabase
          .from(tab.table)
          .update(dataToSave)
          .eq('id', id);
      } else {
        const insertData = { 
          ...dataToSave, 
          tenant_id: isGodMode && tierFilter === 'global' ? null : tenantId,
          library_tier: isGodMode && tierFilter === 'global' ? 'global' : 'company', 
          is_active: true 
        };
        console.log('[ResourceLibrary] Inserting:', insertData);
        response = await supabase
          .from(tab.table)
          .insert([insertData]);
      }
      
      if (response.error) {
        console.error('[ResourceLibrary] Supabase error:', response.error);
        throw response.error;
      }
      
      setIsAdding(false);
      setEditingId(null);
      setFormData({ code: '', name: '', unit: '', base_rate: 0, category: '' });
      loadResources();
    } catch (e: any) {
      console.error('[ResourceLibrary] Save error:', e);
      alert('Error saving resource: ' + e.message);
    }
  };

  const handleDelete = async (id: string) => {
    const tab = TABS.find(t => t.id === activeTab);
    if (!tab) return;

    const resource = resources.find(r => r.id === id);
    if (!resource) return;

    try {
      const { data: assignments, error: checkError } = await supabase
        .from('trade_items')
        .select('resource_name')
        .eq('resource_name', resource.name)
        .eq('is_active', true);

      if (checkError) throw checkError;

      let message = 'Are you sure you want to deactivate this resource?';
      if (assignments && assignments.length > 0) {
        message = `Warning: This resource is currently assigned to ${assignments.length} trade recipes. Deactivating it may affect your project estimates. Do you still want to proceed?`;
      }

      setConfirmAction({
        message,
        onConfirm: async () => {
          try {
            let error;
            if (resource.library_tier === 'company') {
              // Permanent delete for company items
              const { error: delError } = await supabase
                .from(tab.table)
                .delete()
                .eq('id', id);
              error = delError;
            } else {
              // Just deactivate global items (or items we don't want to hard delete)
              const { error: updError } = await supabase
                .from(tab.table)
                .update({ is_active: false })
                .eq('id', id);
              error = updError;
            }
            
            if (error) throw error;
            setNotification({ 
              type: 'success', 
              message: resource.library_tier === 'company' ? 'Resource deleted permanently.' : 'Resource deactivated successfully.' 
            });
            loadResources();
          } catch (e: any) {
            setNotification({ type: 'error', message: 'Error deleting resource: ' + e.message });
          } finally {
            setConfirmAction(null);
          }
        }
      });
    } catch (e: any) {
      setNotification({ type: 'error', message: 'Error checking assignments: ' + e.message });
    }
  };

  const handleMassDelete = async () => {
    if (selectedIds.size === 0) return;

    const tab = TABS.find(t => t.id === activeTab);
    if (!tab) return;

    const selectedResources = resources.filter(r => selectedIds.has(r.id));
    const names = selectedResources.map(r => r.name);

    try {
      const { data: assignments, error: checkError } = await supabase
        .from('trade_items')
        .select('resource_name')
        .in('resource_name', names)
        .eq('is_active', true);

      if (checkError) throw checkError;

      const assignedNames = new Set(assignments?.map(a => a.resource_name));
      let message = `Are you sure you want to deactivate ${selectedIds.size} selected resources?`;
      
      if (assignedNames.size > 0) {
        message = `Warning: ${assignedNames.size} of the selected resources are currently assigned to trade recipes. Deactivating them may affect your project estimates. Do you still want to proceed?`;
      }

      setConfirmAction({
        message,
        onConfirm: async () => {
          try {
            // Separate company items for hard delete and global items for deactivation
            const companyIds = selectedResources.filter(r => r.library_tier === 'company').map(r => r.id);
            const globalIds = selectedResources.filter(r => r.library_tier !== 'company').map(r => r.id);

            if (companyIds.length > 0) {
              const { error: delError } = await supabase
                .from(tab.table)
                .delete()
                .in('id', companyIds);
              if (delError) throw delError;
            }

            if (globalIds.length > 0) {
              const { error: updError } = await supabase
                .from(tab.table)
                .update({ is_active: false })
                .in('id', globalIds);
              if (updError) throw updError;
            }
            
            setNotification({ 
              type: 'success', 
              message: `${selectedIds.size} resources processed (Company items deleted, Global items deactivated).` 
            });
            setSelectedIds(new Set());
            setIsSelectionMode(false);
            loadResources();
          } catch (e: any) {
            setNotification({ type: 'error', message: 'Error deleting resources: ' + e.message });
          } finally {
            setConfirmAction(null);
          }
        }
      });
    } catch (e: any) {
      setNotification({ type: 'error', message: 'Error checking assignments: ' + e.message });
    }
  };

  const groupedResources = React.useMemo(() => {
    // 1. Initial filtered set
    const filtered = resources.filter(r => {
      const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.category?.toLowerCase().includes(search.toLowerCase()) ||
        r.code.toLowerCase().includes(search.toLowerCase());
      const matchesTier = tierFilter === 'all' || r.library_tier === tierFilter;
      const matchesCategory = selectedCategory === 'all' || r.category === selectedCategory;
      const matchesUnique = !showUniqueOnly || (r.library_tier === 'company' && !r.origin_id);
      return matchesSearch && matchesTier && matchesCategory && matchesUnique;
    });

    // 2. If viewing 'all', deduplicate: prefer company version over global version for same name/code
    let deduplicated = filtered;
    if (tierFilter === 'all') {
      const bestMatchMap = new Map<string, Resource>();
      filtered.forEach(r => {
        const key = (r.code && r.code !== 'N/A') ? r.code.toLowerCase().trim() : r.name.toLowerCase().trim();
        const existing = bestMatchMap.get(key);
        // Prefer company tier over global tier
        if (!existing || (existing.library_tier === 'global' && r.library_tier === 'company')) {
          bestMatchMap.set(key, r);
        }
      });
      deduplicated = Array.from(bestMatchMap.values());
    }

    const groups: Record<string, Resource[]> = {};
    deduplicated.forEach(r => {
      const cat = r.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(r);
    });

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [resources, search, tierFilter, selectedCategory, showUniqueOnly]);

  const toggleGroup = (cat: string) => {
    const next = new Set(expandedGroups);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setExpandedGroups(next);
  };
  
  // All unique categories for dropdown
  const allCategories = React.useMemo(() => {
    return Array.from(new Set([
      ...(STANDARD_CATEGORIES[activeTab] || []),
      ...resources.map(r => r.category).filter(Boolean)
    ])).sort() as string[];
  }, [activeTab, resources]);

  const activeTabDef = TABS.find(t => t.id === activeTab)!;

  const canManageCurrentTab = () => {
    switch (activeTab) {
      case 'material': return hasCapability('res:mat_manage');
      case 'labour': return hasCapability('res:labour_manage');
      case 'equipment': return hasCapability('res:equip_manage');
      case 'vehicle': return hasCapability('res:veh_manage');
      case 'fuel': return hasCapability('res:fuel_manage');
      case 'subcontractor': return hasCapability('res:subcon_manage');
      default: return false;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold">Resource Library</h1>
          <p className="text-sm text-dim">Manage global and company-specific resource rates</p>
        </div>
        <div className="flex items-center gap-2">
          {hasCapability('res:global_consume') && (
            <>
              {isSelectionMode ? (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => cloneGlobalResources()}
                    className="flex items-center gap-2 px-3 py-2 bg-primary border border-primary rounded-lg text-xs font-bold text-surface-base hover:bg-primary/90 transition-all shadow-lg shadow-primary/10"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    {selectedIds.size > 0 ? `Clone Selected (${selectedIds.size})` : 'Clone All Global'}
                  </button>
                  <button 
                    onClick={() => {
                      setIsSelectionMode(false);
                      setSelectedIds(new Set());
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs font-bold text-danger hover:bg-danger/10 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                </div>
              ) : (
                tierFilter === 'company' && (
                  <button 
                    onClick={() => {
                      setTierFilter('global');
                      setIsSelectionMode(true);
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-primary border border-primary rounded-lg text-xs font-bold text-surface-base hover:bg-primary/90 transition-all shadow-lg shadow-primary/10"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    Clone from Global
                  </button>
                )
              )}
            </>
          )}
          <button 
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs font-bold text-dim hover:text-main transition-all"
            title="Download Excel Template"
          >
            <Download className="w-3.5 h-3.5" />
            Template
          </button>
          {isGodMode && (
            <>
              <button 
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-primary/20 rounded-lg text-xs font-bold text-primary hover:bg-primary/10 transition-all"
                title="Export Library to Excel"
              >
                <FileUp className="w-3.5 h-3.5 rotate-180" />
                Export
              </button>
              <button 
                onClick={handleBulkCleanup}
                disabled={isImporting}
                className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-warning/20 rounded-lg text-xs font-bold text-warning hover:bg-warning/10 transition-all disabled:opacity-50"
                title="Run Diagnosis & Bulk Cleanup"
              >
                <Zap className="w-3.5 h-3.5" />
                Cleanup
              </button>
            </>
          )}
          <button 
            onClick={() => {
              if (!hasCapability('res:import_all')) {
                setNotification({ type: 'error', message: 'You do not have permission to import resources.' });
                return;
              }
              fileInputRef.current?.click();
            }}
            disabled={isImporting}
            className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs font-bold text-dim hover:text-main transition-all cursor-pointer disabled:opacity-50"
          >
            <FileUp className="w-3.5 h-3.5" />
            {isImporting ? 'Importing...' : 'Import Excel'}
          </button>
          <input 
            type="file" 
            ref={fileInputRef}
            accept=".xlsx, .xls" 
            className="hidden" 
            onChange={handleExcelImport}
          />
          {canManageCurrentTab() && (
            <button 
              className="btn btn-accent btn-sm"
              onClick={() => {
                setIsAdding(true);
                setFormData({ name: '', unit: '', base_rate: 0, category: '' });
              }}
            >
              <Plus className="w-4 h-4" />
              Add {activeTabDef.label.slice(0, -1)}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 bg-surface-1 border border-border-subtle p-1 rounded-lg w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
              activeTab === tab.id 
                ? "bg-surface-2 text-primary shadow-sm" 
                : "text-ghost hover:text-dim"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border-subtle flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
            <input 
              type="text"
              placeholder={`Search ${activeTabDef.label.toLowerCase()}…`}
              className="w-full bg-surface-2 border border-border-subtle rounded-md py-2 pl-10 pr-4 text-sm outline-none focus:border-primary transition-colors"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 bg-surface-2 border border-border-subtle p-1 rounded-lg">
            {(isGodMode || tierFilter === 'all') && (
              <button 
                onClick={() => {
                  setTierFilter('all');
                  setIsSelectionMode(false);
                }}
                className={cn(
                  "px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all",
                  tierFilter === 'all' ? "bg-border-subtle text-main" : "text-ghost hover:text-dim"
                )}
              >
                All
              </button>
            )}
            {(isGodMode || tierFilter === 'global') && (
              <button 
                onClick={() => {
                  setTierFilter('global');
                  setIsSelectionMode(false);
                }}
                className={cn(
                  "px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all",
                  tierFilter === 'global' ? "bg-border-subtle text-accent" : "text-ghost hover:text-dim"
                )}
              >
                Global
              </button>
            )}
            <button 
              onClick={() => {
                setTierFilter('company');
                setIsSelectionMode(false);
              }}
              className={cn(
                "px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all",
                tierFilter === 'company' ? "bg-border-subtle text-accent" : "text-ghost hover:text-dim"
              )}
            >
              Company
            </button>
          </div>

          {isGodMode && (
            <button 
              onClick={() => setShowUniqueOnly(!showUniqueOnly)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 border rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                showUniqueOnly 
                  ? "bg-accent/10 border-accent/20 text-accent" 
                  : "bg-surface-2 border-border-subtle text-ghost hover:text-dim"
              )}
            >
              <Zap className={cn("w-3.5 h-3.5", showUniqueOnly && "fill-current")} />
              Unique Company Items
            </button>
          )}

          <div className="flex items-center gap-2 bg-surface-2 border border-border-subtle p-1 rounded-lg">
            <select 
              className="bg-transparent text-[10px] font-bold uppercase tracking-wider text-dim outline-none px-2 py-1 cursor-pointer"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              {allCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="h-6 w-px bg-border-subtle mx-2" />

          {isSelectionMode ? (
            <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest mr-2">
                {selectedIds.size} Selected
              </span>
              {tierFilter === 'global' ? (
                <button 
                  onClick={() => cloneGlobalResources()}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary text-surface-base rounded-lg text-[10px] font-bold hover:bg-primary/90 transition-all"
                >
                  <Globe className="w-3.5 h-3.5" />
                  Clone Selected
                </button>
              ) : (
                <button 
                  onClick={handleMassDelete}
                  className="flex items-center gap-2 px-3 py-1.5 bg-danger/10 text-danger border border-danger/20 rounded-lg text-[10px] font-bold hover:bg-danger/20 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Mass Delete
                </button>
              )}
              <button 
                onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedIds(new Set());
                }}
                className="p-1.5 text-ghost hover:text-main transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsSelectionMode(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 border border-border-subtle rounded-lg text-[10px] font-bold text-ghost hover:text-main transition-all"
            >
              <MoreVertical className="w-3.5 h-3.5" />
              Select Items
            </button>
          )}
        </div>

        <div className="flex flex-1 overflow-hidden bg-surface-base min-h-[500px] max-h-[800px]">
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="py-24 text-center">
                  <div className="w-8 h-8 border-2 border-border-subtle border-t-primary rounded-full animate-spin mx-auto mb-4" />
                  <div className="text-sm text-ghost">Loading resources…</div>
                </div>
              ) : groupedResources.length === 0 && !isAdding ? (
                <div className="py-24 text-center text-ghost">
                  <Search className="w-12 h-12 opacity-10 mx-auto mb-4" />
                  <div className="text-lg font-medium">No resources found</div>
                  <div className="text-sm">Try adjusting your search or filters</div>
                  {hasCapability('res:global_consume') && (
                    <div className="flex items-center justify-center gap-4 mt-6">
                      <button 
                        onClick={() => {
                          setTierFilter('global');
                          setIsSelectionMode(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-surface-base rounded-lg text-xs font-bold hover:bg-primary/90 transition-all"
                      >
                        <Globe className="w-4 h-4" />
                        Clone from Global
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col p-6 gap-4">
                  {isAdding && (
                    <div className="p-6 bg-surface-2 border border-border-subtle rounded-xl mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold">Add New {activeTabDef.label}</h3>
                        <button onClick={() => setIsAdding(false)} className="text-ghost hover:text-main">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        {TAB_COLUMNS[activeTab].map(col => (
                          <div key={col.key} className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-ghost uppercase tracking-wider">{col.label}</label>
                            {col.key === 'supplier_name' ? (
                              <select 
                                className="bg-surface-base border border-border-subtle rounded px-3 py-2 text-sm outline-none focus:border-primary"
                                value={formData[col.key] || ''}
                                onChange={e => setFormData({...formData, [col.key]: e.target.value})}
                              >
                                <option value="">Select Supplier...</option>
                                {suppliers.map(s => (
                                  <option key={s.id} value={s.company_name}>{s.company_name}</option>
                                ))}
                              </select>
                            ) : (
                              <input 
                                type={col.key.includes('rate') || col.key.includes('days') || col.key.includes('consumption') ? 'number' : 'text'}
                                className="bg-surface-base border border-border-subtle rounded px-3 py-2 text-sm outline-none focus:border-primary"
                                value={formData[col.key] || ''}
                                onChange={e => setFormData({...formData, [col.key]: e.target.value})}
                                placeholder={col.label}
                              />
                            )}
                          </div>
                        ))}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold text-ghost uppercase tracking-wider">Actions</label>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleSave()} className="p-2 bg-primary text-surface-base rounded-md hover:bg-primary/90 transition-colors flex-1 flex items-center justify-center gap-2">
                              <Save className="w-4 h-4" />
                              <span className="text-xs font-bold">Save</span>
                            </button>
                            <button onClick={() => setIsAdding(false)} className="p-2 bg-surface-2 text-danger border border-border-subtle rounded-md hover:bg-surface-base transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {groupedResources.map(([category, items]) => (
                    <div key={category} className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden">
                      <button 
                        onClick={() => toggleGroup(category)}
                        className="w-full flex items-center justify-between p-4 hover:bg-surface-2 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center text-lg">
                            {getGroupEmoji(category)}
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="text-sm font-bold text-main">{getGroupLabel(category)}</span>
                            <span className="text-[10px] text-ghost font-mono uppercase tracking-widest">{items.length} Resources</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {expandedGroups.has(category) ? <ChevronDown className="w-4 h-4 text-ghost" /> : <ChevronRight className="w-4 h-4 text-ghost" />}
                        </div>
                      </button>

                      {expandedGroups.has(category) && (
                        <div className="border-t border-border-subtle overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-surface-base border-b border-border-subtle">
                                  {isSelectionMode && (
                                    <th className="px-6 py-3 w-10 whitespace-nowrap">
                                      <input 
                                        type="checkbox"
                                        className="rounded border-border-subtle bg-surface-base text-primary focus:ring-primary"
                                        checked={items.every(r => selectedIds.has(r.id))}
                                        onChange={() => {
                                          const allSelected = items.every(r => selectedIds.has(r.id));
                                          const next = new Set(selectedIds);
                                          items.forEach(r => {
                                            if (allSelected) next.delete(r.id);
                                            else next.add(r.id);
                                          });
                                          setSelectedIds(next);
                                        }}
                                      />
                                    </th>
                                  )}
                                  {TAB_COLUMNS[activeTab].map(col => (
                                    <th 
                                      key={col.key}
                                      className={cn(
                                        "px-6 py-3 text-[10px] font-mono font-black uppercase tracking-widest text-ghost whitespace-nowrap",
                                        col.align === 'right' && "text-right"
                                      )}
                                    >
                                      {col.label}
                                    </th>
                                  ))}
                                  <th className="px-6 py-3 text-[10px] font-mono font-black uppercase tracking-widest text-ghost whitespace-nowrap">Tier</th>
                                  <th className="px-6 py-3 text-[10px] font-mono font-black uppercase tracking-widest text-ghost whitespace-nowrap">Status</th>
                                  <th className="px-6 py-3"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                              {items.map(res => (
                                <tr key={res.id} className="group hover:bg-primary/[0.02] transition-colors border-b border-border-subtle/20 h-auto min-h-[2.5rem]">
                                  {isSelectionMode && (
                                    <td className="px-6 py-3 whitespace-nowrap border-r border-border-subtle/20">
                                      <input 
                                        type="checkbox"
                                        className="rounded border-border-subtle bg-surface-base text-primary focus:ring-primary"
                                        checked={selectedIds.has(res.id)}
                                        onChange={() => toggleSelect(res.id)}
                                      />
                                    </td>
                                  )}
                                      {TAB_COLUMNS[activeTab].map(col => (
                                        <td 
                                          key={col.key}
                                          className={cn(
                                            "px-6 py-3 whitespace-nowrap border-r border-border-subtle/20",
                                            col.align === 'right' ? "text-right font-mono text-[11px] font-black text-primary" : "text-main",
                                            col.key.includes('code') && "text-[10px] font-mono font-black text-accent"
                                          )}
                                        >
                                           {editingId === res.id ? (
                                            col.key === 'supplier_name' ? (
                                              <select 
                                                className="bg-surface-base border border-border-subtle rounded px-2 py-1 text-sm w-full outline-none focus:border-primary"
                                                value={formData[col.key as keyof typeof formData] || ''}
                                                onChange={e => setFormData({...formData, [col.key]: e.target.value})}
                                              >
                                                <option value="">Select Supplier...</option>
                                                {suppliers.map(s => (
                                                  <option key={s.id} value={s.company_name}>{cleanRichText(s.company_name)}</option>
                                                ))}
                                              </select>
                                            ) : (
                                              <input 
                                                className="bg-surface-base border border-border-subtle rounded px-2 py-1 text-sm w-full outline-none focus:border-primary"
                                                value={formData[col.key as keyof typeof formData] || ''}
                                                onChange={e => setFormData({...formData, [col.key]: e.target.value})}
                                              />
                                            )
                                          ) : (
                                            col.key.includes('rate') ? (
                                              <span className="font-mono font-black py-0.5">${(res[col.key] || 0).toLocaleString()}</span>
                                            ) : col.key === 'description' || col.key === 'material_name' || col.key === 'name' || col.key === 'title' || col.key === 'category_name' || col.key === 'category' ? (
                                               <span className="text-[11px] font-black text-main uppercase py-0.5">{cleanRichText(res[col.key]) || '-'}</span>
                                            ) : (
                                              <span className="py-0.5">{cleanRichText(res[col.key]) || '-'}</span>
                                            )
                                          )}
                                        </td>
                                      ))}
                                  <td className="px-6 py-3 whitespace-nowrap border-r border-border-subtle/20">
                                    <div className={cn(
                                      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border",
                                      res.library_tier === 'global' 
                                        ? "bg-accent/10 text-accent border-accent/20" 
                                        : "bg-surface-2 text-ghost border-border-subtle"
                                    )}>
                                      {res.library_tier === 'global' ? (
                                        <>
                                          <Globe className="w-2.5 h-2.5" />
                                          Global
                                        </>
                                      ) : (
                                        <>
                                          <Building2 className="w-2.5 h-2.5" />
                                          {tenants.find(t => t.id === res.tenant_id)?.name || 'Company'}
                                        </>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-3 whitespace-nowrap border-r border-border-subtle/20">
                                    <span className={cn(
                                       "inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                      res.is_active ? "bg-primary/10 text-primary border-primary/20" : "bg-surface-2 text-ghost border-border-subtle"
                                    )}>
                                      {res.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-3 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {res.library_tier === 'global' && hasCapability('res:global_consume') && (
                                        <button 
                                          onClick={() => cloneGlobalResources([res.id])}
                                          className="flex items-center gap-1.5 px-2 py-1 bg-primary text-surface-base rounded text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-sm"
                                          title="Clone to Company Library"
                                        >
                                          <Plus className="w-3 h-3" />
                                          Clone
                                        </button>
                                      )}
                                      {editingId === res.id ? (
                                        <>
                                          <button onClick={() => handleSave(res.id)} className="p-1.5 text-primary hover:bg-primary/10 rounded-md transition-colors">
                                            <Save className="w-4 h-4" />
                                          </button>
                                          <button onClick={() => setEditingId(null)} className="p-1.5 text-danger hover:bg-danger/10 rounded-md transition-colors">
                                            <X className="w-4 h-4" />
                                          </button>
                                        </>
                                      ) : (
                                        ((res.library_tier === 'company' && canManageCurrentTab()) || isGodMode) && (
                                          <>
                                            <button 
                                              onClick={() => {
                                                setEditingId(res.id);
                                                setFormData({ ...res });
                                              }}
                                              className="p-1.5 text-dim hover:bg-surface-2 hover:text-main rounded-md transition-colors"
                                            >
                                              <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button 
                                              onClick={() => handleDelete(res.id)}
                                              className="p-1.5 text-ghost hover:bg-danger/10 hover:text-danger rounded-md transition-colors"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </>
                                        )
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Notifications */}
      {notification && (
        <div className={cn(
          "fixed top-6 right-6 z-[100] px-6 py-3 rounded-xl shadow-2xl animate-in slide-in-from-right duration-300 flex items-center gap-3 border",
          notification.type === 'success' ? "bg-primary text-surface-base border-primary" :
          notification.type === 'error' ? "bg-danger text-white border-danger" :
          "bg-surface-2 text-main border-border-subtle"
        )}>
          {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-bold">{notification.message}</span>
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
                <p className="text-xs text-ghost">Please verify before proceeding</p>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-dim leading-relaxed">{confirmAction.message}</p>
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
                className="flex-1 bg-primary text-surface-base px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-all"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
