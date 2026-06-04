import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  BookOpen, 
  AlertOctagon, 
  History as HistoryIcon, 
  Bell, 
  ChevronRight, 
  ChevronLeft, 
  Plus, 
  Camera, 
  CheckCircle2, 
  Users, 
  Package, 
  Truck, 
  Search, 
  ArrowRight,
  ClipboardList,
  Calculator,
  AlertTriangle,
  Send,
  X,
  CloudSun,
  Zap,
  Loader2,
  MoreVertical,
  MinusCircle,
  Smartphone,
  Info,
  CloudRain,
  Shield,
  Briefcase,
  HardHat,
  Thermometer,
  Lock,
  WifiOff,
  CloudLightning,
  Calendar,
  CheckSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Project, BOQItem, UserProfile } from '../types';
import { cn, cleanRichText } from '../lib/utils';
import { TRADE_GROUPS, getGroupLabel, getGroupEmoji } from '../lib/constants';
import { ResourcePickerModal } from './ResourcePickerModal';
import { recalculateBOQTreeProgress } from '../services/recalculateProgress';

interface SiteAppProps {
  project: Project;
  tenantId: string;
  isEmbedded?: boolean;
  onClose?: () => void;
  forcedRole?: UserProfile['role'];
}

type Step = 1 | 2 | 3 | 4 | 5;

export function SiteApp({ project, tenantId, isEmbedded = false, onClose, forcedRole }: SiteAppProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'report' | 'trade_guide' | 'store' | 'alerts' | 'history' | 'notifications'>('dashboard');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // View Overrides for Platform Admins
  const [activeRole, setActiveRole] = useState<UserProfile['role'] | undefined>(forcedRole);
  const [tradeSearch, setTradeSearch] = useState('');
  
  // Daily Report State
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [weather, setWeather] = useState('Sunny');
  const [shiftHours, setShiftHours] = useState('10');
  const [workingStatus, setWorkingStatus] = useState('Working');
  const [activitiesQueue, setActivitiesQueue] = useState<{
    activity: BOQItem;
    executedQty: number;
    materials: any[];
    manpower: any[];
    machinery: any[];
    remarks: string;
  }[]>([]);
  
  const [selectedActivity, setSelectedActivity] = useState<BOQItem | null>(null);
  const [activitySearch, setActivitySearch] = useState('');
  const [executedQty, setExecutedQty] = useState<number>(0);
  const [materials, setMaterials] = useState<{name: string, qty: number, unit: string, id?: string}[]>([]);
  const [manpower, setManpower] = useState<{skill: string, group: string, count: number, idle: boolean, id?: string, idleCount?: number}[]>([]);
  const [machinery, setMachinery] = useState<{name: string, hours: number, fuel: number, id?: string, idleHours?: number}[]>([]);
  const [remarks, setRemarks] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  // Alert State
  const [isReportingAlert, setIsReportingAlert] = useState(false);
  const [alertStep, setAlertStep] = useState<1 | 2 | 3>(1);
  const [newAlert, setNewAlert] = useState({ 
    category: '', 
    subcategory: '', 
    title: '', 
    message: '', 
    type: 'warning' as 'critical' | 'warning' | 'info',
    priority: 'Medium' as 'Low' | 'Medium' | 'High' | 'Critical' 
  });

  // Suggested Resources
  const [suggestedResources, setSuggestedResources] = useState<{
    materials: any[];
    labour: any[];
    equipment: any[];
  }>({ materials: [], labour: [], equipment: [] });

  // Resource Picker States
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'material' | 'labour' | 'equipment' | null>(null);

  // Storekeeping State
  const [storeMode, setStoreMode] = useState<'grn' | 'issue' | 'return'>('grn');
  const [storeEntries, setStoreEntries] = useState<{item: string, qty: number, unit: string}[]>([]);

  // Metadata & Lookups
  const [boqItems, setBoqItems] = useState<BOQItem[]>([]);
  const [subcontractors, setSubcontractors] = useState<any[]>([]);
  const [labourGrades, setLabourGrades] = useState<any[]>([]);
  const [subcontractorAssignments, setSubcontractorAssignments] = useState<any[]>([]);

  // Filtering & Tree States
  const [executionType, setExecutionType] = useState<'subcontractor' | 'daily_labor'>('subcontractor');
  const [selectedSubcontractorId, setSelectedSubcontractorId] = useState<string | null>(null);
  const [selectedLabourGradeId, setSelectedLabourGradeId] = useState<string | null>(null);
  const [collapsedSiteParents, setCollapsedSiteParents] = useState<Set<string>>(new Set());
  const [tradeLibrary, setTradeLibrary] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [upcomingActivities, setUpcomingActivities] = useState<BOQItem[]>([]);
  const [showPendingModal, setShowPendingModal] = useState(false);

  const liveProgressPct = useMemo(() => {
    if (!boqItems || boqItems.length === 0) return 0;
    
    // Find all leaf nodes
    const leaves = boqItems.filter(item => {
      if (!item.item_no) return false;
      const cleanNo = item.item_no.trim();
      return !boqItems.some(other => 
        other.item_no && 
        other.item_no !== item.item_no && 
        other.item_no.trim().startsWith(cleanNo + '.')
      );
    });

    if (leaves.length === 0) return 0;

    const totalAmount = leaves.reduce((sum, item) => sum + (item.contract_amount || 0), 0);
    if (totalAmount > 0) {
      const weightedSum = leaves.reduce((sum, item) => sum + ((item.progress_pct || 0) * (item.contract_amount || 0)), 0);
      const pct = weightedSum / totalAmount;
      return Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10;
    } else {
      const simpleSum = leaves.reduce((sum, item) => sum + (item.progress_pct || 0), 0);
      const pct = simpleSum / leaves.length;
      return Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10;
    }
  }, [boqItems]);

  const nextPendingTasks = useMemo(() => {
    if (!boqItems || boqItems.length === 0) return [];
    
    const leafIncompletes = boqItems.filter(item => {
      if (!item.item_no) return false;
      const cleanNo = item.item_no.trim();
      const isLeaf = !boqItems.some(other => 
        other.item_no && 
        other.item_no !== item.item_no && 
        other.item_no.trim().startsWith(cleanNo + '.')
      );
      return isLeaf && (item.progress_pct || 0) < 100;
    });

    return leafIncompletes.sort((a, b) => {
      if (a.planned_start_date && b.planned_start_date) {
        return new Date(a.planned_start_date).getTime() - new Date(b.planned_start_date).getTime();
      }
      if (a.planned_start_date) return -1;
      if (b.planned_start_date) return 1;
      return (a.item_no || '').localeCompare(b.item_no || '');
    }).slice(0, 3);
  }, [boqItems]);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [collapsedLogs, setCollapsedLogs] = useState<Set<string>>(new Set());

  // Handle Log Edit
  const handleEditLog = async (log: any) => {
    setLogLoading(true);
    try {
      const { data: fullLog, error } = await supabase
        .from('daily_progress')
        .select(`
          *,
          daily_activities (
            *,
            boq_items (*)
          ),
          daily_labour (*),
          daily_materials (*),
          daily_equipment (*)
        `)
        .eq('id', log.id)
        .single();
      
      if (error) throw error;

      resetReportForm();
      setReportDate(fullLog.report_date);
      setWeather(fullLog.weather || 'Sunny');
      setRemarks(fullLog.remarks || '');
      
      const mappedQueue = (fullLog.daily_activities || []).map((act: any) => ({
        activity: act.boq_items,
        executedQty: act.progress_qty,
        remarks: act.remarks || '',
        materials: [],
        manpower: [],
        machinery: []
      }));

      if (mappedQueue.length > 0) {
        mappedQueue[0].materials = (fullLog.daily_materials || []).map((m: any) => ({
          id: m.material_id,
          name: m.material_id,
          qty: m.quantity_used,
          unit: ''
        }));
        mappedQueue[0].manpower = (fullLog.daily_labour || []).map((l: any) => ({
          id: l.labour_grade_id,
          skill: l.labour_grade_id,
          count: l.headcount,
          idle: l.idle_count > 0,
          idleCount: l.idle_count
        }));
        mappedQueue[0].machinery = (fullLog.daily_equipment || []).map((e: any) => ({
          id: e.equipment_id,
          name: e.equipment_id,
          hours: e.hours_worked,
          fuel: e.fuel_liters,
          idleHours: e.idle_hours
        }));
      }

      setActivitiesQueue(mappedQueue);
      setSelectedLog(null);
      setActiveTab('report');
      setCurrentStep(1);
    } catch (e) {
      console.error('Error loading log for edit:', e);
      alert('Failed to load log data for editing.');
    } finally {
      setLogLoading(false);
    }
  };

  const toggleLogActivities = (logId: string) => {
    setCollapsedLogs(prev => {
      const next = new Set(prev);
      if (next.has(logId)) next.delete(logId);
      else next.add(logId);
      return next;
    });
  };

  // Trade Guide Calculator
  const [calcTrade, setCalcTrade] = useState<any | null>(null);
  const [calcQty, setCalcQty] = useState<number>(0);
  const [expandedTradeGroups, setExpandedTradeGroups] = useState<Set<string>>(new Set());

  // Memoized trade library groupings to fix Rule of Hooks violation
  const groupedTrades = useMemo(() => {
    const groups: { [key: string]: { [subgroup: string]: any[] } } = {};
    tradeLibrary.forEach(item => {
      const group = item.trade_group || 'MISC';
      if (!groups[group]) groups[group] = {};
      
      // Extract professional subgroup
      let subgroup = 'General Standards';
      const itemName = item.trade_item || '';
      if (itemName.includes(':')) {
        subgroup = itemName.split(':')[0].trim();
      } else if (item.trade_code && item.trade_code.includes('.')) {
        const parts = item.trade_code.split('.');
        if (parts.length >= 2) {
           subgroup = `Section ${parts[0]}.${parts[1]}`;
        }
      }

      if (!groups[group][subgroup]) groups[group][subgroup] = [];
      groups[group][subgroup].push(item);
    });
    return groups;
  }, [tradeLibrary]);

  const filteredTradeGroups = useMemo(() => {
    if (!tradeSearch) return groupedTrades;
    const f: { [key: string]: { [subgroup: string]: any[] } } = {};
    const searchLower = tradeSearch.toLowerCase();

    Object.entries(groupedTrades).forEach(([code, subgroups]) => {
      const filteredSubgroups: { [subgroup: string]: any[] } = {};
      Object.entries(subgroups).forEach(([subName, items]) => {
        const filteredItems = items.filter(i => 
          (i.trade_name || '').toLowerCase().includes(searchLower) ||
          (i.trade_item || '').toLowerCase().includes(searchLower) ||
          (i.trade_code || '').toLowerCase().includes(searchLower) ||
          subName.toLowerCase().includes(searchLower)
        );
        if (filteredItems.length > 0) filteredSubgroups[subName] = filteredItems;
      });
      if (Object.keys(filteredSubgroups).length > 0) f[code] = filteredSubgroups;
    });
    return f;
  }, [groupedTrades, tradeSearch]);

  // Check if a BOQ leaf item description/trade matches the labour grade title/keywords
  const isLabourGradeEligible = useCallback((item: BOQItem, gradeTitle: string) => {
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
  }, []);

  const projectSubcontractors = useMemo(() => {
    const assignedSubIds = new Set(subcontractorAssignments.map(a => a.subcontractor_id));
    return subcontractors.filter(sub => assignedSubIds.has(sub.id));
  }, [subcontractors, subcontractorAssignments]);

  const visibleBOQTree = useMemo(() => {
    // Helper to check if an item is a leaf (no other item's item_no starts with this item_no + '.')
    const isLeafNo = (itmNo: string) => {
      return !boqItems.some(other => other.item_no && other.item_no !== itmNo && other.item_no.startsWith(itmNo + '.'));
    };

    // Filter target leaf nodes matching selections & search
    const matchedLeaves = boqItems.filter(item => {
      if (!item.item_no) return false;
      if (!isLeafNo(item.item_no)) return false;

      // Filter by progress completion
      if ((item.progress_pct || 0) >= 100) return false;

      // Filter by searching
      const matchSearch = !activitySearch ? true : (
        item.description.toLowerCase().includes(activitySearch.toLowerCase()) || 
        item.item_no.toLowerCase().includes(activitySearch.toLowerCase())
      );
      if (!matchSearch) return false;

      // Filter by Subcontractor or Daily Labor Selection
      if (executionType === 'subcontractor') {
        if (!selectedSubcontractorId) return true; // Show all leaves if none chosen
        const hasAssign = subcontractorAssignments.some(assign => 
          assign.boq_item_id === item.id && assign.subcontractor_id === selectedSubcontractorId
        );
        return hasAssign;
      } else if (executionType === 'daily_labor') {
        if (!selectedLabourGradeId) return true; // Show all leaves if none chosen
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
  }, [boqItems, activitySearch, executionType, selectedSubcontractorId, selectedLabourGradeId, subcontractorAssignments, labourGrades, isLabourGradeEligible]);

  const renderedBOQTree = useMemo(() => {
    return visibleBOQTree.filter(item => {
      const parts = (item.item_no || '').split('.');
      // Check if any ancestor is collapsed
      for (let i = 1; i < parts.length; i++) {
        const ancestorNo = parts.slice(0, i).join('.');
        if (collapsedSiteParents.has(ancestorNo)) {
          return false;
        }
      }
      return true;
    });
  }, [visibleBOQTree, collapsedSiteParents]);

  useEffect(() => {
    loadInitialData();
  }, [project.id]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase.from('user_profiles').select('id, email, full_name, role, tenant_id, is_platform_god, is_active, created_at, updated_at').eq('id', user.id).single();
        setProfile(prof);
        if (prof && !forcedRole) setActiveRole(prof.role);
      }

      // Load BOQ Items
      const { data: boq } = await supabase
        .from('boq_items')
        .select('*')
        .eq('project_id', project.id)
        .order('item_no');
      setBoqItems(boq || []);

      // Load subcontractors
      const { data: subs } = await supabase
        .from('subcontractors')
        .select('*')
        .eq('tenant_id', tenantId);
      setSubcontractors(subs || []);

      // Load labour grades
      const { data: labRes } = await supabase
        .from('labour_grades')
        .select('*')
        .eq('is_active', true);
      setLabourGrades(labRes || []);

      // Load subcontractor assignments
      const { data: assigns } = await supabase
        .from('subcontractor_assignments')
        .select('*')
        .eq('project_id', project.id);
      setSubcontractorAssignments(assigns || []);

      // Filter upcoming
      const today = new Date();
      setUpcomingActivities((boq || []).filter(item => {
        if (!item.planned_start_date) return false;
        const start = new Date(item.planned_start_date);
        return start >= today && (item.progress_pct || 0) < 100;
      }).slice(0, 3));

      // Load Trade Items
      const { data: trades } = await supabase.from('trade_items').select('*').limit(500);
      
      // Group flat rows into items
      const itemMap = new Map<string, any>();
      (trades || []).forEach((r: any) => {
        const key = `${r.trade_code}_${r.trade_item}_${r.library_tier}`;
        if (!itemMap.has(key)) {
          itemMap.set(key, {
            ...r,
            trade_name: r.trade_item || r.trade_name, // Map for compatibility with search/UI
            resources: []
          });
        }
        if (r.resource_name) {
          itemMap.get(key).resources.push(r);
        }
      });
      setTradeLibrary(Array.from(itemMap.values()));

      // Load Notifications
      const { data: notifs } = await supabase
        .from('alerts')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10);
      setNotifications(notifs || []);

      // Load Recent History
      const { data: reports } = await supabase
        .from('daily_progress')
        .select('*')
        .eq('project_id', project.id)
        .order('report_date', { ascending: false })
        .limit(5);
      setHistory(reports || []);

    } catch (e) {
      console.error('Error loading site app data:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadLogDetails = async (logId: string) => {
    setLogLoading(true);
    try {
      const { data: log, error } = await supabase
        .from('daily_progress')
        .select(`
          *,
          daily_activities (
            *,
            boq_items (description, item_no, unit)
          ),
          daily_labour (*),
          daily_materials (*),
          daily_equipment (*)
        `)
        .eq('id', logId)
        .single();
      
      if (error) throw error;
      setSelectedLog(log);
    } catch (e) {
      console.error('Error loading log details:', e);
      alert('Could not load log details.');
    } finally {
      setLogLoading(false);
    }
  };

  const toggleTradeGroup = (groupCode: string) => {
    setExpandedTradeGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupCode)) next.delete(groupCode);
      else next.add(groupCode);
      return next;
    });
  };

  const handleReportSubmit = async () => {
    if (activitiesQueue.length === 0 && !selectedActivity) {
      alert('Please log at least one activity');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const now = new Date();
      // 1. Upsert Daily Progress record to avoid unique constraint violations
      const { data: progress, error: pErr } = await supabase.from('daily_progress').upsert({
        project_id: project.id,
        tenant_id: tenantId,
        report_date: reportDate,
        weather: weather,
        remarks: remarks,
        status: 'submitted',
        submitted_by: user.id,
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      }, { onConflict: 'tenant_id,project_id,report_date' }).select().single();

      if (pErr) throw pErr;
      if (!progress) throw new Error('Failed to initialize report record');

      // 1.1 Clear existing records to prevent duplicates on overwrite/update
      await Promise.all([
        supabase.from('daily_activities').delete().eq('daily_progress_id', progress.id),
        supabase.from('daily_labour').delete().eq('daily_progress_id', progress.id),
        supabase.from('daily_materials').delete().eq('daily_progress_id', progress.id),
        supabase.from('daily_equipment').delete().eq('daily_progress_id', progress.id)
      ]);

      // Fetch subcontractor assignments for auto-mapping
      const { data: assignments } = await supabase
        .from('subcontractor_assignments')
        .select('boq_item_id, subcontractor_id')
        .eq('project_id', project.id);

      // Bundle current entry if any
      const finalQueue = [...activitiesQueue];
      if (selectedActivity) {
        finalQueue.push({
          activity: selectedActivity,
          executedQty,
          materials,
          manpower,
          machinery,
          remarks
        });
      }

      for (const entry of finalQueue) {
        // Find matching subcontractor
        const matchingAssignment = assignments?.find(a => a.boq_item_id === entry.activity.id);
        const subId = matchingAssignment?.subcontractor_id || null;

        // 2. Log Activity
        const { data: actLog, error: aErr } = await supabase.from('daily_activities').insert({
          daily_progress_id: progress.id,
          boq_item_id: entry.activity.id,
          progress_qty: entry.executedQty,
          subcontractor_id: subId,
          submitted_by: user.id,
          created_at: now.toISOString(),
          remarks: entry.remarks,
          tenant_id: tenantId
        }).select().single();

        if (aErr) throw aErr;

        // Update BOQ item progress
        const { data: currentBOQ } = await supabase.from('boq_items').select('actual_qty, contract_qty').eq('id', entry.activity.id).single();
        if (currentBOQ) {
          const newExecuted = (currentBOQ.actual_qty || 0) + entry.executedQty;
          const newPct = Math.min(100, (newExecuted / (currentBOQ.contract_qty || 1)) * 100);
          await supabase.from('boq_items').update({
            actual_qty: newExecuted,
            progress_pct: newPct,
            status: newPct === 100 ? 'complete' : 'in_progress',
            last_report_date: now.toISOString()
          }).eq('id', entry.activity.id);
        }

        // 3. Log Resources linked to this activity
        if (entry.manpower.length > 0) {
          await supabase.from('daily_labour').insert(entry.manpower.map(m => ({
            daily_progress_id: progress.id,
            labour_grade_id: m.id || m.skill, 
            headcount: m.count,
            idle_count: m.idleCount || 0,
            hours_worked: 8,
            tenant_id: tenantId,
            submitted_by: user.id,
            created_at: now.toISOString()
          })));
        }

        if (entry.materials.length > 0) {
          await supabase.from('daily_materials').insert(entry.materials.map(m => ({
            daily_progress_id: progress.id,
            material_id: m.id || m.name, 
            quantity_used: m.qty,
            tenant_id: tenantId,
            submitted_by: user.id,
            created_at: now.toISOString()
          })));
        }

        if (entry.machinery.length > 0) {
          await supabase.from('daily_equipment').insert(entry.machinery.map(m => ({
            daily_progress_id: progress.id,
            equipment_id: m.id || m.name,
            hours_worked: m.hours,
            idle_hours: m.idleHours || 0,
            fuel_liters: m.fuel,
            tenant_id: tenantId,
            submitted_by: user.id,
            created_at: now.toISOString()
          })));
        }
      }

      // Recalculate BOQ tree progress bottom-up
      await recalculateBOQTreeProgress(project.id, supabase);

      alert('Daily report submitted and logs successfully recorded.');
      resetReportForm();
      if (onClose) {
        onClose();
      } else {
        setActiveTab('dashboard');
      }
      if (!isEmbedded) loadInitialData();
    } catch (e: any) {
      console.error('Submission failed:', e);
      alert('Error committing logs: ' + (e.message || 'Check database connection'));
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  };

  const resetReportForm = () => {
    setCurrentStep(1);
    setSelectedActivity(null);
    setActivitiesQueue([]);
    setActivitySearch('');
    setExecutedQty(0);
    setMaterials([]);
    setManpower([]);
    setMachinery([]);
    setRemarks('');
    setPhoto(null);
    setSuggestedResources({ materials: [], labour: [], equipment: [] });
  };

  useEffect(() => {
    if (selectedActivity && selectedActivity.trade_code) {
      loadSuggestions(selectedActivity.trade_code);
    } else {
      setSuggestedResources({ materials: [], labour: [], equipment: [] });
    }
  }, [selectedActivity]);

  const loadSuggestions = async (tradeCode: string) => {
    try {
      const { data } = await supabase
        .from('trade_items')
        .select('*')
        .eq('trade_code', tradeCode)
        .eq('is_active', true);
      
      if (data) {
        // Unique resource helper by resource_name and resource_code to prevent duplicate suggestions
        const getUniqueResources = (items: any[]) => {
          const seen = new Set<string>();
          return items.filter(item => {
            const name = item.resource_name || '';
            const code = item.resource_code || '';
            const key = `${name.toLowerCase().trim()}_${code.toLowerCase().trim()}`;
            if (!name && !code) return false;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        };

        const rawMaterials = data.filter(r => r.resource_type === 'material' || !r.resource_type);
        const rawLabour = data.filter(r => r.resource_type === 'labour' || r.resource_type === 'labor');
        const rawEquipment = data.filter(r => r.resource_type === 'equipment' || r.resource_type === 'machinery' || r.resource_type === 'plant');

        setSuggestedResources({
          materials: getUniqueResources(rawMaterials),
          labour: getUniqueResources(rawLabour),
          equipment: getUniqueResources(rawEquipment)
        });
      }
    } catch (err) {
      console.error('Error loading suggestions:', err);
    }
  };

  const addAnotherActivity = () => {
    if (!selectedActivity) return;
    
    setActivitiesQueue([
      ...activitiesQueue,
      {
        activity: selectedActivity,
        executedQty,
        materials,
        manpower,
        machinery,
        remarks
      }
    ]);

    // Reset current entry fields
    setSelectedActivity(null);
    setExecutedQty(0);
    setMaterials([]);
    setManpower([]);
    setMachinery([]);
    setRemarks('');
    setCurrentStep(2);
  };

  const handleResourceSelect = (resource: any) => {
    // Use resource.type (from suggestions) or pickerTarget (from Modal)
    const target = resource.type || pickerTarget;
    if (!target) return;

    // Normalize resource ID and name from either suggestions (resource_id/name) or picker
    const resId = resource.resource_id || resource.id || resource.resource_code || resource.name || resource.resource_name;
    const resName = resource.name || resource.resource_name || resource.material_name || resource.title || resource.item_name;

    if (target === 'material') {
      const exists = materials.find(m => m.id === resId || m.name === resName);
      if (!exists) {
        setMaterials([...materials, { 
          id: resId, 
          name: resName, 
          qty: resource.consumption_rate ? resource.consumption_rate * (executedQty || 1) : 0, 
          unit: resource.unit || resource.resource_unit || 'unit' 
        }]);
      }
    } else if (target === 'labour') {
      const exists = manpower.find(m => m.id === resId || m.skill === resName);
      if (!exists) {
        setManpower([...manpower, { 
          id: resId, 
          skill: resName, 
          group: resource.group || 'Direct Labour', 
          count: 1, 
          idle: false,
          idleCount: 0 
        }]);
      }
    } else if (target === 'equipment') {
      const exists = machinery.find(m => m.id === resId || m.name === resName);
      if (!exists) {
        setMachinery([...machinery, { 
          id: resId, 
          name: resName, 
          hours: 1, 
          fuel: 0,
          idleHours: 0 
        }]);
      }
    }

    setPickerOpen(false);
    setPickerTarget(null);
  };

  const renderDashboard = () => {
    const userRole = activeRole || profile?.role || 'site_encoder';
    
    // Define 3 primary actions based on user type
    const getActions = () => {
      if (['procurement', 'storeman'].includes(userRole)) {
        return [
          { id: 'store-grn', label: 'Material Receipt', sub: 'Log incoming goods (GRN)', icon: Truck, color: 'text-success', bg: 'bg-success/10', action: () => { setStoreMode('grn'); setActiveTab('store'); } },
          { id: 'store-issue', label: 'Material Issue', sub: 'Issue stock to site teams', icon: Package, color: 'text-warning', bg: 'bg-warning/10', action: () => { setStoreMode('issue'); setActiveTab('store'); } },
          { id: 'alerts', label: 'Store Alerts', sub: 'Shortages & lead times', icon: Bell, color: 'text-danger', bg: 'bg-danger/10', action: () => setActiveTab('alerts') }
        ];
      }
      
      // Default / Site Manager / Engineer
      return [
        { id: 'report', label: 'Daily Report', sub: 'Log progress & resources', icon: FileText, color: 'text-primary', bg: 'bg-primary/10', action: () => setActiveTab('report') },
        { id: 'guide', label: 'Trade Guide', sub: 'Rates & Calculators', icon: BookOpen, color: 'text-accent', bg: 'bg-accent/10', action: () => setActiveTab('trade_guide') },
        { id: 'alerts', label: 'Site Alerts', sub: 'Incidents & blockers', icon: AlertTriangle, color: 'text-danger', bg: 'bg-danger/10', action: () => setActiveTab('alerts') }
      ];
    };

    const actions = getActions();

    return (
      <div className="flex flex-col gap-4 p-4 animate-in fade-in slide-in-from-bottom-2">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-xl font-black text-main">Hello, {profile?.full_name?.split(' ')[0] || 'User'}</h2>
            <p className="text-xs text-ghost">{project.name} • {new Date().toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-2">
            {(profile?.role === 'tenant_admin' || profile?.is_platform_god) && (
              <select 
                className="bg-surface-1 border border-border-subtle rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary outline-none appearance-none"
                value={activeRole}
                onChange={(e) => setActiveRole(e.target.value as any)}
              >
                <option value="site_encoder">Encoder View</option>
                <option value="storeman">Storeman View</option>
                <option value="procurement">Procurement View</option>
                <option value="tenant_admin">Admin View</option>
              </select>
            )}
            <button 
              onClick={() => setActiveTab('notifications')}
              className="relative p-2 bg-surface-1 border border-border-subtle rounded-xl text-ghost hover:text-primary transition-colors"
            >
              <Bell className="w-5 h-5" />
              {notifications.filter(n => !n.is_read).length > 0 && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-primary rounded-full border-2 border-surface-base" />
              )}
            </button>
            {onClose && (
               <button onClick={onClose} className="p-2 bg-surface-1 border border-border-subtle rounded-xl text-ghost hover:text-danger translate-x-2">
                 <X className="w-5 h-5" />
               </button>
            )}
          </div>
        </div>

        {/* The 3 Button Tool for each user type */}
        <div className="grid grid-cols-1 gap-3">
          {actions.map((act) => (
            <button
              key={act.id}
              onClick={act.action}
              className={cn(
                "flex items-center gap-5 p-5 border rounded-[2rem] transition-all hover:scale-[1.01] active:scale-[0.98] group text-left",
                act.bg,
                act.bg.replace('/10', '/20').replace('bg-', 'border-')
              )}
            >
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:rotate-3", act.bg.replace('10', '40'), act.color)}>
                <act.icon className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <div className={cn("text-sm font-black uppercase tracking-widest", act.color)}>{act.label}</div>
                <div className="text-[10px] text-ghost font-medium mt-0.5">{act.sub}</div>
              </div>
              <ArrowRight className={cn("w-5 h-5 opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all", act.color)} />
            </button>
          ))}
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-ghost">Recent Activity</h3>
            <button onClick={() => setActiveTab('history')} className="text-[10px] font-bold text-primary hover:underline">View History</button>
          </div>
          <div className="flex flex-col gap-2">
            {history.length === 0 ? (
              <div className="p-4 bg-surface-1 border border-border-subtle rounded-xl text-center text-ghost text-[10px]">No recent logs.</div>
            ) : history.map((h, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-surface-1 border border-border-subtle rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
                    <ClipboardList className="w-4 h-4 text-ghost" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-main">Daily Report • {h.report_date}</div>
                    <div className="text-[9px] text-ghost truncate max-w-[150px]">{h.remarks || 'No remarks provided'}</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-ghost" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Grouped Alert Categories with Icons and Colors
  const ALERT_CATEGORIES = [
    { id: 'Safety', label: 'Safety/HSE', icon: HardHat, color: 'text-danger', bg: 'bg-danger/10',
      subs: ['Near Miss', 'PPE Violation', 'Unsafe Act', 'Unsafe Conditions', 'First Aid Incident', 'Major Incident'] },
    { id: 'Security', label: 'Security', icon: Shield, color: 'text-amber-500', bg: 'bg-amber-500/10',
      subs: ['Trespassing', 'Unauthorized Access', 'Vandalism', 'Site Access Issue'] },
    { id: 'Theft', label: 'Theft', icon: Lock, color: 'text-red-600', bg: 'bg-red-600/10',
      subs: ['Material Theft', 'Equipment Theft', 'Fuel Theft', 'Tool Theft'] },
    { id: 'Weather', label: 'Weather', icon: CloudLightning, color: 'text-blue-500', bg: 'bg-blue-500/10',
      subs: ['Heavy Rain / Storm', 'High Wind', 'Extreme Heat', 'Extreme Cold', 'Flooding'] },
    { id: 'Quality', label: 'Quality', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10',
      subs: ['Material Rejection', 'Installation Defect', 'Finishing Issue', 'Design Non-Conformance'] },
    { id: 'Supply', label: 'Supply', icon: Truck, color: 'text-indigo-500', bg: 'bg-indigo-500/10',
      subs: ['Delivery Delay', 'Incorrect Item Delivered', 'Material Shortage', 'Supplier Quality Issue'] },
    { id: 'Equipment', label: 'Equipment', icon: Zap, color: 'text-orange-500', bg: 'bg-orange-500/10',
      subs: ['Mechanical Breakdown', 'Maintenance Required', 'Operator Error', 'Mob/Demob Issue'] },
    { id: 'Personnel', label: 'Personnel', icon: Users, color: 'text-violet-500', bg: 'bg-violet-500/10',
      subs: ['Absenteeism', 'Labor Dispute / Strike', 'Subcontractor Performance', 'Safety Conduct'] },
    { id: 'Environmental', label: 'Env.', icon: CloudSun, color: 'text-teal-500', bg: 'bg-teal-500/10',
      subs: ['Oil / Chemical Spill', 'Dust Control Issue', 'Waste Management Issue', 'Noise Complaint'] },
  ];

  const handleAlertSubmit = async () => {
    if (!newAlert.category || !newAlert.subcategory || !newAlert.message) {
      alert('Please complete all fields including details');
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('alerts').insert({
        project_id: project.id,
        tenant_id: tenantId,
        title: `[${newAlert.subcategory}] ${newAlert.category}`,
        message: newAlert.message,
        type: newAlert.type === 'critical' ? 'critical' : newAlert.type === 'warning' ? 'warning' : 'info',
        severity: newAlert.priority,
        metadata: { sub_category: newAlert.subcategory, priority: newAlert.priority },
        submitted_by: user?.id,
        created_at: new Date().toISOString()
      });
      if (error) throw error;
      alert('Incident report logged successfully');
      setNewAlert({ category: '', subcategory: '', title: '', message: '', type: 'warning', priority: 'Medium' });
      setIsReportingAlert(false);
      setAlertStep(1);
      loadInitialData();
    } catch (e: any) {
      console.error('Alert logging failed:', e);
      if (e.message?.includes('column') || e.message?.includes('schema cache')) {
        alert('Database Schema Error: The "alerts" table might be missing the "message" column. Please ensure migrations are applied and the schema cache is refreshed.');
      } else {
        alert('Error logging alert: ' + e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderReportWizard = () => (
    <div className="flex flex-col h-full overflow-hidden bg-surface-base">
      <header className="flex items-center justify-between p-4 border-b border-border-subtle shrink-0">
        <button onClick={() => setActiveTab('dashboard')} className="p-2 text-ghost hover:text-main">
          <X className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-primary">Shift Entry</span>
          <div className="flex gap-1 mt-1">
            {[1, 2, 3, 4, 5, 6, 7].map(s => (
              <div key={s} className={cn("w-5 h-1 rounded-full transition-all duration-500", s <= currentStep ? "bg-primary" : "bg-surface-2")} />
            ))}
          </div>
        </div>
        <div className="w-9" />
      </header>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.02, y: -10 }}
            className="flex flex-col gap-6"
          >
            {currentStep === 1 && (
              <div className="flex flex-col gap-8 animate-in fade-in zoom-in-95 duration-500">
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-black text-main tracking-tighter">Site Conditions</h2>
                  <p className="text-[11px] text-ghost font-medium uppercase tracking-[0.2em]">Mandatory Daily Initialization</p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {/* Date Selector */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <HistoryIcon className="w-3.5 h-3.5" />
                      Reporting Date
                    </label>
                    <input 
                      type="date"
                      className="w-full bg-surface-1 border border-border-subtle rounded-xl p-5 text-lg font-bold text-main outline-none focus:border-primary shadow-sm"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                    />
                  </div>

                  {/* Weather Grid */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <CloudSun className="w-3.5 h-3.5" />
                      Atmospheric State
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'Sunny', icon: '☀️' },
                        { label: 'Rainy', icon: '🌧️' },
                        { label: 'Cloudy', icon: '☁️' },
                        { label: 'Windy', icon: '💨' }
                      ].map(w => (
                        <button 
                          key={w.label}
                          onClick={() => setWeather(w.label)}
                          className={cn(
                            "flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-300 gap-2",
                            weather === w.label 
                              ? "bg-primary text-white border-primary shadow-xl shadow-primary/20 scale-105" 
                              : "bg-surface-1 border-border-subtle text-ghost hover:border-primary/40"
                          )}
                        >
                          <span className="text-2xl">{w.icon}</span>
                          <span className="text-[9px] font-black uppercase">{w.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hours & Status */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5" />
                        Shift Duration
                      </label>
                      <div className="relative">
                        <input 
                          type="number"
                          className="w-full bg-surface-1 border border-border-subtle rounded-xl p-5 text-2xl font-black text-main outline-none focus:border-primary shadow-sm"
                          value={shiftHours}
                          onChange={(e) => setShiftHours(e.target.value)}
                        />
                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-black text-ghost uppercase">Hrs</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <Smartphone className="w-3.5 h-3.5" />
                        Operational Status
                      </label>
                      <button 
                        onClick={() => setWorkingStatus(workingStatus === 'Working' ? 'Standing' : 'Working')}
                        className={cn(
                          "w-full h-[70px] rounded-xl border flex items-center justify-center gap-3 transition-all font-black text-xs uppercase tracking-widest shadow-sm",
                          workingStatus === 'Working' 
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" 
                            : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                        )}
                      >
                        <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse", workingStatus === 'Working' ? "bg-emerald-500" : "bg-amber-500")} />
                        {workingStatus}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500">
                <div className="text-center mb-2">
                  <h3 className="text-2xl font-black text-main tracking-tight font-sans">Execution Responsibility</h3>
                  <p className="text-[10px] text-ghost font-bold uppercase tracking-widest mt-1">Select subcontractor or daily labor grade assigned to the work type</p>
                </div>

                <div className="flex flex-col gap-4 p-5 bg-surface-2/40 border border-border-subtle/50 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-ghost tracking-widest leading-none">Responsibility Type</span>
                  <div className="flex bg-surface-base p-1 rounded-xl border border-border-subtle/30">
                    <button
                      type="button"
                      className={cn("flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                        executionType === 'subcontractor' ? "bg-primary text-white shadow-md shadow-primary/15" : "text-ghost hover:text-main"
                      )}
                      onClick={() => { setExecutionType('subcontractor'); }}
                    >
                      Subcontractor
                    </button>
                    <button
                      type="button"
                      className={cn("flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                        executionType === 'daily_labor' ? "bg-primary text-white shadow-md shadow-primary/15" : "text-ghost hover:text-main"
                      )}
                      onClick={() => { setExecutionType('daily_labor'); }}
                    >
                      Daily Basis Labor
                    </button>
                  </div>

                  {executionType === 'subcontractor' ? (
                    <div className="space-y-3 pt-2">
                      <label className="text-[10px] font-black uppercase text-primary tracking-widest">Select Subcontractor for this Project</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[250px] overflow-y-auto no-scrollbar">
                        {projectSubcontractors.map(sub => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => setSelectedSubcontractorId(selectedSubcontractorId === sub.id ? null : sub.id)}
                            className={cn("p-4 text-xs font-bold rounded-xl border text-left transition-all",
                              selectedSubcontractorId === sub.id
                                ? "bg-primary text-white border-primary font-black shadow-lg shadow-primary/15"
                                : "bg-surface-base border-border-subtle text-ghost hover:text-main hover:border-ghost"
                            )}
                          >
                            <div className="text-[11px] font-black">{cleanRichText(sub.company_name || sub.name)}</div>
                            <div className={cn("text-[9px] mt-1 font-medium", selectedSubcontractorId === sub.id ? "text-white/80" : "text-ghost")}>
                              Assigned Contract
                            </div>
                          </button>
                        ))}
                        {projectSubcontractors.length === 0 && (
                          <span className="text-[11px] text-ghost italic py-4">No subcontractors found with active assignments for this project</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-2">
                      <label className="text-[10px] font-black uppercase text-primary tracking-widest">Select Daily Labor Grade</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[250px] overflow-y-auto no-scrollbar">
                        {labourGrades.map(lg => (
                          <button
                            key={lg.id}
                            type="button"
                            onClick={() => setSelectedLabourGradeId(selectedLabourGradeId === lg.id ? null : lg.id)}
                            className={cn("p-4 text-xs font-bold rounded-xl border text-left transition-all",
                              selectedLabourGradeId === lg.id
                                ? "bg-primary text-white border-primary font-black shadow-lg shadow-primary/15"
                                : "bg-surface-base border-border-subtle text-ghost hover:text-main hover:border-ghost"
                            )}
                          >
                            <div className="text-[11px] font-black">{cleanRichText(lg.title || lg.name)}</div>
                            <div className={cn("text-[9px] mt-1 font-medium", selectedLabourGradeId === lg.id ? "text-white/80" : "text-ghost")}>
                              Daily Basis Code
                            </div>
                          </button>
                        ))}
                        {labourGrades.length === 0 && (
                          <span className="text-[11px] text-ghost italic py-4">No labour grades available</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="flex flex-col gap-4 animate-in slide-in-from-right-4 duration-500">
                <div className="text-center mb-2">
                  <h3 className="text-2xl font-black text-main tracking-tight font-sans">Scope Assignment</h3>
                  <div className="flex items-center justify-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[9px] text-ghost font-bold uppercase tracking-widest">ASSIGNING TO:</span>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded">
                      {executionType === 'subcontractor' 
                        ? (subcontractors.find(s => s.id === selectedSubcontractorId)?.company_name || 'Subcontractor') 
                        : (labourGrades.find(l => l.id === selectedLabourGradeId)?.title || 'Labor Grade')
                      }
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                    <input 
                      type="text"
                      placeholder="Search Item No or Description..."
                      className="w-full bg-surface-1 border border-border-subtle rounded-xl py-4 pl-11 pr-4 text-sm font-medium outline-none focus:border-primary shadow-sm"
                      value={activitySearch}
                      onChange={(e) => setActivitySearch(e.target.value)}
                    />
                  </div>
                  
                  <div className="bg-surface-2/30 rounded-2xl p-3 max-h-[380px] overflow-y-auto no-scrollbar border border-border-subtle/50 shadow-inner">
                    <div className="flex flex-col gap-2">
                      {renderedBOQTree.map(item => {
                        const level = (item.item_no || '').split('.').length - 1;
                        const hasChildren = boqItems.some(other => other.item_no && other.item_no !== item.item_no && other.item_no.startsWith(item.item_no + '.'));
                        const isCollapsed = collapsedSiteParents.has(item.item_no || '');

                        if (hasChildren) {
                          return (
                            <div 
                              key={item.id} 
                              style={{ paddingLeft: `${level * 14}px` }}
                              onClick={() => {
                                const next = new Set(collapsedSiteParents);
                                if (next.has(item.item_no || '')) {
                                  next.delete(item.item_no || '');
                                } else {
                                  next.add(item.item_no || '');
                                }
                                setCollapsedSiteParents(next);
                              }}
                              className="flex items-center gap-2 py-2 px-3 bg-surface-base/90 border border-border-subtle/30 rounded-xl cursor-pointer select-none hover:bg-surface-3 transition-colors shrink-0"
                            >
                              <div className="w-5 h-5 flex items-center justify-center text-primary/75 bg-primary/5 rounded shrink-0">
                                <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", !isCollapsed && "rotate-90")} />
                              </div>
                              <span className="text-[10px] font-mono font-black text-accent">{item.item_no}</span>
                              <span className="text-[11px] font-black text-main leading-none truncate max-w-[180px] sm:max-w-[260px] uppercase tracking-tight">{cleanRichText(item.description)}</span>
                              
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

                        // leaf node!
                        return (
                          <div key={item.id} style={{ paddingLeft: `${level * 14}px` }} className="flex flex-col gap-2">
                            <button 
                              onClick={() => setSelectedActivity(selectedActivity?.id === item.id ? null : item)}
                              className={cn(
                                "p-4 rounded-xl border text-left transition-all relative overflow-hidden group",
                                selectedActivity?.id === item.id 
                                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                                  : "bg-surface-base border-border-subtle hover:border-primary/40"
                              )}
                            >
                              <div className="flex justify-between items-center mb-2">
                                <span className={cn("text-[8px] font-mono font-black uppercase tracking-widest", selectedActivity?.id === item.id ? "text-white/70" : "text-ghost")}>
                                  TASK {cleanRichText(item.item_no)}
                                </span>
                                <div className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full", selectedActivity?.id === item.id ? "bg-white/20" : "bg-surface-2 text-ghost")}>
                                  {Math.round(item.progress_pct || 0)}%
                                </div>
                              </div>
                              <div className="text-[13px] font-black leading-tight mb-2 pr-4">{cleanRichText(item.description)}</div>
                              <div className="flex items-center gap-2 flex-wrap">
                                 <div className={cn("text-[9px] font-medium", selectedActivity?.id === item.id ? "text-white/80" : "text-ghost")}>
                                   Budget: <span className="font-bold">{item.contract_qty}</span> {cleanRichText(item.unit)}
                                 </div>
                                 <div className={cn("w-1 h-1 rounded-full", selectedActivity?.id === item.id ? "bg-white/30" : "bg-border-subtle")} />
                                 <div className={cn("text-[9px] font-bold", selectedActivity?.id === item.id ? "text-white" : "text-primary")}>
                                   Rem: <span className="font-black">{(item.contract_qty - (item.actual_qty || 0)).toFixed(1)}</span>
                                 </div>
                                 {selectedSubcontractorId && (
                                   <>
                                     <div className={cn("w-1 h-1 rounded-full", selectedActivity?.id === item.id ? "bg-white/30" : "bg-border-subtle")} />
                                     <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-500 text-[8px] font-black uppercase rounded">Matched Spec</span>
                                   </>
                                 )}
                                 {selectedLabourGradeId && (
                                   <>
                                     <div className={cn("w-1 h-1 rounded-full", selectedActivity?.id === item.id ? "bg-white/30" : "bg-border-subtle")} />
                                     <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-500 text-[8px] font-black uppercase rounded">Matched Spec</span>
                                   </>
                                 )}
                              </div>
                            </button>

                            {selectedActivity?.id === item.id && (
                              <div className="mx-2 p-6 bg-primary text-white border-x border-b border-primary rounded-b-2xl -mt-4 pt-10 space-y-4 animate-in slide-in-from-top-2 shadow-2xl relative z-10">
                                <div className="flex items-center justify-between">
                                  <label className="text-[11px] font-black uppercase tracking-widest text-white/90">Enter Output Quantity Executed</label>
                                  <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-bold text-white uppercase">{cleanRichText(selectedActivity.unit)}</span>
                                </div>
                                <div className="relative group">
                                  <input 
                                    type="number"
                                    step="any"
                                    autoFocus
                                    className="w-full bg-white text-primary border-none rounded-xl p-5 text-4xl font-black outline-none shadow-inner selection:bg-primary/20"
                                    placeholder="0.00"
                                    value={executedQty || ''}
                                    onChange={(e) => setExecutedQty(parseFloat(e.target.value) || 0)}
                                  />
                                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/30 font-black text-xl pointer-events-none group-focus-within:text-primary transition-colors">
                                    {cleanRichText(selectedActivity.unit)}
                                  </div>
                                </div>
                                <p className="text-[10px] font-bold text-white/60 leading-tight">This will update the project progress by {((executedQty / (item.contract_qty || 1)) * 100).toFixed(1)}%</p>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {renderedBOQTree.length === 0 && (
                        <div className="py-12 text-center text-ghost text-xs">
                          No matching work types found for this execution responsibility.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500">
                <div className="text-center mb-2">
                  <h3 className="text-2xl font-black text-main tracking-tight">Material Allocation</h3>
                  <div className="text-[10px] font-bold text-ghost uppercase tracking-widest mt-1">LOG MATERIAL CONSUMED DURING THIS ACTIVITY</div>
                </div>
                {suggestedResources.materials.length > 0 && (
                  <div className="flex flex-col gap-2 mb-2 p-4 bg-accent/5 border border-accent/20 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                       <Zap className="w-4 h-4 text-accent" />
                       <h3 className="text-[11px] font-black uppercase tracking-widest text-accent">Material Suggestions</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {suggestedResources.materials.map((sug, i) => (
                        <button
                          key={i}
                          onClick={() => handleResourceSelect({ ...sug, id: sug.resource_code || sug.id || sug.resource_name, name: sug.resource_name, type: 'material' })}
                          className="px-3 py-2 bg-surface-base border border-accent/30 rounded-xl text-[10px] font-bold text-main hover:bg-accent hover:text-white transition-all flex items-center gap-2 shrink-0 shadow-sm"
                        >
                          <Plus className="w-3 h-3" />
                          {cleanRichText(sug.resource_name)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-main">Materials Utilized</h3>
                  <button 
                    onClick={() => { setPickerTarget('material'); setPickerOpen(true); }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Pick from Library
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {materials.map((m, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3.5 bg-surface-base border border-border-subtle rounded-2xl animate-in slide-in-from-right-4 shadow-sm shadow-primary/5">
                      <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center text-ghost">
                        <Package className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-main truncate">{cleanRichText(m.name)}</div>
                        <div className="text-[9px] text-ghost font-medium uppercase">{cleanRichText(m.unit)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number"
                          placeholder="0.00"
                          className="w-20 bg-surface-2 rounded-lg px-3 py-2 text-xs font-mono font-bold outline-none text-right focus:ring-1 focus:ring-primary/50"
                          value={m.qty}
                          onChange={(e) => {
                            const newM = [...materials];
                            newM[idx].qty = parseFloat(e.target.value) || 0;
                            setMaterials(newM);
                          }}
                        />
                        <button 
                          onClick={() => setMaterials(materials.filter((_, i) => i !== idx))}
                          className="p-1.5 text-ghost hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {materials.length === 0 && (
                  <div className="py-12 border-2 border-dashed border-border-subtle rounded-[2rem] flex flex-col items-center justify-center gap-3 opacity-40 bg-surface-1/50 border-spacing-4">
                    <Package className="w-10 h-10" />
                    <div className="text-center">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] block">No Materials Logged</span>
                      <span className="text-[9px] text-ghost font-medium">Select from library or use suggestions</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === 5 && (
              <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500">
                <div className="text-center mb-2">
                  <h3 className="text-2xl font-black text-main tracking-tight">Manpower List</h3>
                  <div className="text-[10px] font-bold text-ghost uppercase tracking-widest mt-1">PERSONNEL ASSIGNED TO THIS TRADES SCOPE</div>
                </div>
                {suggestedResources.labour.length > 0 && (
                  <div className="flex flex-col gap-2 mb-2 p-4 bg-accent/5 border border-accent/20 rounded-2xl">
                    <div className="flex items-center gap-2">
                       <Zap className="w-4 h-4 text-accent" />
                       <h3 className="text-[11px] font-black uppercase tracking-widest text-accent">Labour Suggestions</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {suggestedResources.labour.map((sug, i) => (
                        <button
                          key={i}
                          onClick={() => handleResourceSelect({ ...sug, id: sug.resource_code || sug.id || sug.resource_name, name: sug.resource_name, type: 'labour' })}
                          className="px-3 py-2 bg-surface-base border border-accent/30 rounded-xl text-[10px] font-bold text-main hover:bg-accent hover:text-white transition-all flex items-center gap-2 shrink-0 shadow-sm"
                        >
                          <Plus className="w-3 h-3" />
                          {cleanRichText(sug.resource_name)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-main">Manpower Registration</h3>
                  <button 
                    onClick={() => { setPickerTarget('labour'); setPickerOpen(true); }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Labour
                  </button>
                </div>
                {manpower.map((m, idx) => (
                  <div key={idx} className="flex flex-col gap-4 p-4 bg-surface-base border border-border-subtle rounded-2xl animate-in slide-in-from-right-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                          <Users className="w-5 h-5" />
                        </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black uppercase tracking-wider text-main">{cleanRichText(m.skill)}</span>
                        <span className="text-[9px] text-ghost font-bold uppercase">{cleanRichText(m.group) || 'Direct Labour'}</span>
                      </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                           onClick={() => setManpower(manpower.filter((_, i) => i !== idx))}
                           className="p-1.5 text-ghost hover:text-danger transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2 bg-surface-2/40 p-2 rounded-xl">
                        <span className="text-[9px] font-black uppercase text-ghost ml-2">Headcount (Active)</span>
                        <div className="flex items-center justify-between">
                          <button 
                            onClick={() => {
                              const newM = [...manpower];
                              newM[idx].count = Math.max(0, m.count - 1);
                              setManpower(newM);
                            }}
                            className="w-7 h-7 rounded-lg bg-surface-base border border-border-subtle flex items-center justify-center shadow-sm"
                          >-</button>
                          <span className="text-xs font-mono font-black text-main">{m.count}</span>
                          <button 
                            onClick={() => {
                              const newM = [...manpower];
                              newM[idx].count = m.count + 1;
                              setManpower(newM);
                            }}
                            className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center shadow-md shadow-primary/20 font-black text-xs"
                          >+</button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 bg-orange-500/5 p-2 rounded-xl border border-orange-500/10">
                        <span className="text-[9px] font-black uppercase text-orange-600/60 ml-2">Idle Count</span>
                        <div className="flex items-center justify-between">
                          <button 
                            onClick={() => {
                              const newM = [...manpower];
                              newM[idx].idleCount = Math.max(0, (m.idleCount || 0) - 1);
                              setManpower(newM);
                            }}
                            className="w-7 h-7 rounded-lg bg-surface-base border border-border-subtle flex items-center justify-center shadow-sm"
                          >-</button>
                          <span className="text-xs font-mono font-black text-orange-600">{m.idleCount || 0}</span>
                          <button 
                            onClick={() => {
                              const newM = [...manpower];
                              newM[idx].idleCount = (m.idleCount || 0) + 1;
                              setManpower(newM);
                            }}
                            className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20 font-black text-xs"
                          >+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {currentStep === 6 && (
              <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500">
                <div className="text-center mb-2">
                  <h3 className="text-2xl font-black text-main tracking-tight">Plant & Machinery</h3>
                  <div className="text-[10px] font-bold text-ghost uppercase tracking-widest mt-1">HEAVY EQUIPMENT AND VEHICLE UTILIZATION</div>
                </div>
                {suggestedResources.equipment.length > 0 && (
                  <div className="flex flex-col gap-2 mb-2 p-4 bg-accent/5 border border-accent/20 rounded-2xl">
                    <div className="flex items-center gap-2">
                       <Zap className="w-4 h-4 text-accent" />
                       <h3 className="text-[11px] font-black uppercase tracking-widest text-accent">Equipment Suggestions</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {suggestedResources.equipment.map((sug, i) => (
                        <button
                          key={i}
                          onClick={() => handleResourceSelect({ ...sug, id: sug.resource_code || sug.id || sug.resource_name, name: sug.resource_name, type: 'equipment' })}
                          className="px-3 py-2 bg-surface-base border border-accent/30 rounded-xl text-[10px] font-bold text-main hover:bg-accent hover:text-white transition-all flex items-center gap-2 shrink-0 shadow-sm"
                        >
                          <Plus className="w-3 h-3" />
                          {cleanRichText(sug.resource_name)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-main">Machinery & Equipment</h3>
                  <button 
                    onClick={() => { setPickerTarget('equipment'); setPickerOpen(true); }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Pick Plant
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {machinery.map((m, idx) => (
                    <div key={idx} className="p-4 bg-surface-base border border-border-subtle rounded-2xl flex flex-col gap-4 shadow-sm animate-in slide-in-from-right-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
                            <Truck className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-black uppercase text-main truncate">{cleanRichText(m.name)}</span>
                          </div>
                        </div>
                        <button 
                           onClick={() => setMachinery(machinery.filter((_, i) => i !== idx))}
                           className="p-1.5 text-ghost hover:text-danger transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-black text-ghost uppercase tracking-widest">Utilized Hours</span>
                          <div className="relative">
                            <input 
                              type="number"
                              className="w-full bg-surface-2 border border-border-subtle rounded-xl p-3 text-sm font-bold font-mono outline-none focus:border-primary shadow-inner"
                              value={m.hours}
                              onChange={(e) => {
                                const newM = [...machinery];
                                newM[idx].hours = parseFloat(e.target.value) || 0;
                                setMachinery(newM);
                              }}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-ghost uppercase">Hrs</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-black text-orange-600/60 uppercase tracking-widest">Idle Hours</span>
                          <div className="relative">
                            <input 
                              type="number"
                              className="w-full bg-orange-500/5 border border-orange-500/20 rounded-xl p-3 text-sm font-bold font-mono outline-none focus:border-orange-500 shadow-inner"
                              value={m.idleHours}
                              onChange={(e) => {
                                const newM = [...machinery];
                                newM[idx].idleHours = parseFloat(e.target.value) || 0;
                                setMachinery(newM);
                              }}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-orange-500/60 uppercase">Idle</span>
                          </div>
                        </div>
                        <div className="col-span-2 flex flex-col gap-1.5">
                          <span className="text-[10px] font-black text-ghost uppercase tracking-widest">Fuel consumed (Ltrs)</span>
                          <input 
                            type="number"
                            className="w-full bg-surface-2 border border-border-subtle rounded-xl p-3 text-sm font-bold font-mono outline-none focus:border-primary shadow-inner"
                            value={m.fuel}
                            onChange={(e) => {
                              const newM = [...machinery];
                              newM[idx].fuel = parseFloat(e.target.value) || 0;
                              setMachinery(newM);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {machinery.length === 0 && (
                     <button 
                     onClick={() => { setPickerTarget('equipment'); setPickerOpen(true); }}
                     className="w-full py-12 border-2 border-dashed border-border-subtle rounded-[2rem] flex flex-col items-center justify-center gap-3 text-ghost hover:text-primary hover:border-primary/50 transition-all opacity-40 bg-surface-1/30"
                   >
                     <Truck className="w-10 h-10" />
                     <span className="text-[10px] font-black uppercase tracking-[0.2em]">Log Plant Utilization</span>
                   </button>
                  )}
                </div>
              </div>
            )}

            {currentStep === 7 && (
              <div className="flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500">
                <div className="text-center space-y-1">
                   <h3 className="text-2xl font-black text-main">Final Certification</h3>
                   <p className="text-[10px] text-ghost font-bold uppercase tracking-widest">Verify and append documentation</p>
                </div>
                <div className="flex flex-col gap-4">
                  <h3 className="text-sm font-bold text-main">Final Touches</h3>
                  <div className="aspect-video bg-surface-2 border-2 border-dashed border-border-subtle rounded-2xl flex flex-col items-center justify-center gap-3 text-ghost cursor-pointer hover:bg-surface-3 transition-all">
                    <Camera className="w-8 h-8" />
                    <span className="text-xs font-bold uppercase tracking-widest">Site Progress Photo</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase text-ghost tracking-widest">General Remarks / Challenges</label>
                    <textarea 
                      className="w-full bg-surface-1 border border-border-subtle rounded-xl p-4 text-sm outline-none focus:border-primary min-h-[120px]"
                      placeholder="Mention any material shortages, delays or visitor reports..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                  </div>
                </div>

                <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                  <h4 className="text-[10px] font-black text-primary uppercase mb-3 tracking-widest">Summary Review</h4>
                  <div className="grid grid-cols-2 gap-4 text-[10px] font-bold">
                    <div className="flex flex-col gap-1">
                      <span className="text-ghost uppercase">Activity</span>
                      <span className="truncate">{cleanRichText(selectedActivity?.description) || 'None'}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-ghost uppercase">Quantity</span>
                      <span>{executedQty} {cleanRichText(selectedActivity?.unit)}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-ghost uppercase">Resources</span>
                      <span>{manpower.length} Manpower, {machinery.length} Machinery</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-ghost uppercase">Weather</span>
                      <span>{weather}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="p-4 bg-surface-1 border-t border-border-subtle shrink-0 mb-safe">
        <div className="flex items-center gap-3">
          {currentStep > 1 && (
            <button 
              onClick={() => setCurrentStep(currentStep - 1)}
              className="h-14 px-8 bg-surface-2 text-main rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-surface-3 transition-all"
            >
              Back
            </button>
          )}
          {currentStep < 7 ? (
            <button 
              onClick={() => {
                if (currentStep === 2) {
                  if (executionType === 'subcontractor' && !selectedSubcontractorId) {
                    alert('Please select a subcontractor first');
                    return;
                  }
                  if (executionType === 'daily_labor' && !selectedLabourGradeId) {
                    alert('Please select a Daily Basis labor grade first');
                    return;
                  }
                }
                if (currentStep === 3 && !selectedActivity) {
                  alert('Please select an activity first');
                  return;
                }
                setCurrentStep(currentStep + 1);
              }}
              className="flex-1 h-14 bg-primary text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              Confirm & Continue
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <div className="flex-1 flex gap-3">
              <button 
                onClick={addAnotherActivity}
                disabled={loading || !selectedActivity}
                className="flex-1 h-14 bg-accent text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex flex-col items-center justify-center -space-y-0.5"
              >
                <Plus className="w-4 h-4" />
                <span>Save to Queue</span>
              </button>
              <button 
                onClick={handleReportSubmit}
                disabled={loading}
                className="flex-[1.5] h-14 bg-main text-surface-base rounded-xl text-[11px] font-black uppercase tracking-widest shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 px-6"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                <div className="flex flex-col items-start leading-none">
                  <span className="text-[11px] font-black">Submit Report</span>
                  <span className="text-[8px] font-bold opacity-60">Total: {activitiesQueue.length + (selectedActivity ? 1 : 0)} Items</span>
                </div>
              </button>
            </div>
          )}
        </div>

        {activitiesQueue.length > 0 && (
          <div className="mt-4 p-3 bg-surface-2 rounded-xl flex items-center gap-3 overflow-x-auto custom-scrollbar">
             <span className="text-[10px] font-black uppercase text-ghost whitespace-nowrap">Logged:</span>
             {activitiesQueue.map((entry, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-1.5 bg-surface-1 rounded-lg border border-border-subtle whitespace-nowrap min-w-max shadow-sm">
                  <div className="flex flex-col">
                    <div className="text-[9px] font-black text-primary leading-none uppercase">{cleanRichText(entry.activity.item_no)}</div>
                    <div className="max-w-[100px] truncate text-[8px] text-main font-bold mt-0.5">{cleanRichText(entry.activity.description)}</div>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-2 rounded-md">
                    <span className="text-[10px] font-black text-main">{entry.executedQty}</span>
                    <span className="text-[8px] text-ghost font-bold uppercase">{cleanRichText(entry.activity.unit)}</span>
                  </div>
                  <button 
                   onClick={() => setActivitiesQueue(activitiesQueue.filter((_, idx) => idx !== i))}
                   className="p-1 text-ghost hover:text-danger hover:bg-danger/10 rounded-md transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
          </div>
        )}
      </footer>
    </div>
  );

  const renderTradeGuide = () => {
    return (
      <div className="flex flex-col h-full bg-surface-base">
        <header className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-surface-1 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveTab('dashboard')} className="p-2 -ml-2 text-ghost hover:bg-surface-2 rounded-xl transition-all active:scale-90">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-xl font-black text-main tracking-tight">Trade Guide</h1>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[9px] font-bold text-ghost uppercase tracking-[0.15em]">Live Intelligence Beta</p>
              </div>
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-surface-base border border-border-subtle flex items-center justify-center text-ghost">
            <BookOpen className="w-5 h-5" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar">
          <div className="flex flex-col gap-3">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ghost group-focus-within:text-primary transition-colors" />
              <input 
                type="text"
                placeholder="Search resources, trades, or codes..."
                className="w-full bg-surface-1 border border-border-subtle rounded-xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-primary shadow-sm transition-all focus:ring-4 focus:ring-primary/5"
                value={tradeSearch}
                onChange={(e) => setTradeSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-6 pb-20">
            {Object.entries(filteredTradeGroups).map(([groupCode, subgroups]) => {
              const totalItems = Object.values(subgroups).reduce((acc, curr) => acc + curr.length, 0);
              return (
                <div key={groupCode} className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden shadow-sm">
                  <button 
                    onClick={() => toggleTradeGroup(groupCode)}
                    className="w-full flex items-center gap-4 p-5 hover:bg-surface-2 transition-colors border-b border-border-subtle/40"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-border-subtle flex items-center justify-center text-2xl shadow-inner">
                      {getGroupEmoji(groupCode)}
                    </div>
                    <div className="flex-1 text-left">
                      <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary leading-none mb-1">{getGroupLabel(groupCode)}</h2>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-main uppercase tracking-tight">{Object.keys(subgroups).length} Categories</span>
                        <div className="w-1 h-1 rounded-full bg-border-subtle" />
                        <span className="text-[10px] font-bold text-ghost uppercase tracking-tight">{totalItems} Standards</span>
                      </div>
                    </div>
                    <ChevronRight className={cn(
                      "w-5 h-5 text-ghost transition-transform duration-300",
                      expandedTradeGroups.has(groupCode) && "rotate-90 text-primary"
                    )} />
                  </button>
                  
                  {expandedTradeGroups.has(groupCode) && (
                    <div className="p-4 space-y-6 bg-surface-base/30 animate-in slide-in-from-top-2 duration-300">
                      {Object.entries(subgroups).map(([subName, items]) => (
                        <div key={subName} className="space-y-3">
                          <div className="flex items-center gap-3 px-1">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border-subtle to-transparent" />
                            <span className="text-[9px] font-black text-ghost uppercase tracking-[0.3em] whitespace-nowrap">{subName}</span>
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border-subtle to-transparent" />
                          </div>
                          
                          <div className="grid grid-cols-1 gap-3">
                            {items.map((trade, i) => (
                              <button 
                                key={i}
                                onClick={() => {
                                  setCalcTrade(trade);
                                  setCalcQty(1);
                                }}
                                className="p-4 bg-surface-1 border border-border-subtle rounded-xl flex flex-col gap-3 text-left hover:border-primary/40 hover:shadow-md transition-all group relative overflow-hidden"
                              >
                                <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -mr-10 -mt-10 blur-xl transition-colors" />
                                
                                <div className="flex items-start justify-between relative">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="px-1.5 py-0.5 bg-surface-base border border-border-subtle rounded text-[7px] font-mono font-black text-ghost uppercase">
                                         {cleanRichText(trade.trade_code)}
                                      </span>
                                      <span className="text-[8px] font-black text-primary/60 uppercase tracking-widest">v1.2 Std</span>
                                    </div>
                                    <h3 className="text-sm font-black text-main leading-tight pr-4">{cleanRichText(trade.trade_item || trade.trade_name)}</h3>
                                  </div>
                                  <div className="w-11 h-11 rounded-xl bg-linear-to-br from-surface-base to-surface-2 border border-border-subtle flex items-center justify-center transition-all duration-300 flex-shrink-0 shadow-sm overflow-hidden group-hover:border-primary/30">
                                    <Calculator className="w-[30px] h-[28px] text-primary/30 group-hover:text-primary transition-all rounded-[4px]" strokeWidth={1} />
                                  </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-border-subtle/30 relative">
                                  <div className="grid grid-cols-3 gap-2 w-full">
                                     <div className="flex flex-col">
                                       <span className="text-[7px] font-black text-ghost uppercase tracking-widest leading-none mb-1">Unit</span>
                                       <span className="text-[10px] font-bold text-main uppercase">{cleanRichText(trade.boq_unit || trade.unit) || 'm³'}</span>
                                     </div>
                                     <div className="flex flex-col border-l border-border-subtle/30 pl-2">
                                       <span className="text-[7px] font-black text-ghost uppercase tracking-widest leading-none mb-1">Capacity</span>
                                       <span className="text-[10px] font-bold text-amber-600 uppercase">{trade.daily_output_qty || '--'} / d</span>
                                     </div>
                                     <div className="flex flex-col border-l border-border-subtle/30 pl-2">
                                       <span className="text-[7px] font-black text-ghost uppercase tracking-widest leading-none mb-1">Factors</span>
                                       <span className="text-[10px] font-bold text-accent uppercase">{trade.resources?.length || 0} items</span>
                                     </div>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {calcTrade && (
            <div className="absolute inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 rounded-[3rem] overflow-hidden">
              <motion.div 
                initial={{ y: 200, opacity: 0 }} 
                animate={{ y: 0, opacity: 1 }}
                className="w-full max-w-sm bg-surface-base rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[85vh] border border-border-subtle"
              >
                <div className="p-8 pb-4 relative">
                  <button 
                    onClick={() => setCalcTrade(null)} 
                    className="absolute top-6 right-6 p-2 bg-surface-1 border border-border-subtle rounded-xl text-ghost hover:text-danger"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  
                  <div className="space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-2">Resource Quantifier</div>
                    <h4 className="text-xl font-black text-main leading-tight pr-10">{cleanRichText(calcTrade.trade_item || calcTrade.trade_name)}</h4>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="text-[10px] font-mono font-bold text-ghost px-2 py-1 bg-surface-2 rounded">{cleanRichText(calcTrade.trade_code)}</div>
                      {calcTrade.daily_output_qty && (
                        <div className="text-[10px] font-bold text-warning px-2 py-1 bg-warning/10 rounded uppercase">Output: {calcTrade.daily_output_qty} / Day</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-8 custom-scrollbar">
                  {/* Desired Qty Integrated */}
                  <div className="p-6 bg-primary/5 border border-primary/20 rounded-[2rem] space-y-4">
                    <div className="flex items-center justify-between">
                       <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Target Production</label>
                       <div className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded tracking-tighter">UNIT: {cleanRichText(calcTrade.boq_unit || calcTrade.unit) || 'm³'}</div>
                    </div>
                    <div className="relative">
                      <input 
                        type="number"
                        className="w-full bg-surface-base border border-primary/30 rounded-2xl p-5 text-4xl font-black text-main outline-none focus:ring-4 focus:ring-primary/10 shadow-inner"
                        placeholder="1.00"
                        value={calcQty}
                        onChange={(e) => setCalcQty(parseFloat(e.target.value) || 0)}
                      />
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 flex flex-col gap-1 items-end pointer-events-none">
                         <span className="text-[10px] font-black text-primary uppercase">Volume</span>
                      </div>
                    </div>
                    
                    {/* Professional Insight / Learning Corner */}
                    <div className="mt-4 p-4 bg-white/50 border border-primary/10 rounded-xl flex items-start gap-3">
                       <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" strokeWidth={1.5} />
                       <div className="space-y-1">
                          <p className="text-[10px] font-black text-main uppercase">Standard Compliance Note</p>
                          <p className="text-[9px] text-ghost font-medium leading-relaxed">
                            Standard coefficients assume ideal site conditions and 5% wastage for materials. Ensure local factors for {cleanRichText(calcTrade.trade_item)} are applied if terrain varies.
                          </p>
                       </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <h5 className="text-[10px] font-black uppercase text-main tracking-[0.2em]">Required Setup (One Unit vs Total)</h5>
                       {calcQty !== 1 && (
                         <div className="text-[9px] font-bold text-accent animate-pulse">Previewing {calcQty} Units</div>
                       )}
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2">
                      {calcTrade.resources?.map((res: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 p-3.5 bg-surface-1 rounded-2xl border border-border-subtle group hover:border-primary/20 transition-all shadow-sm">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:rotate-3",
                            (res.resource_type === 'material' || !res.resource_type) ? "bg-success/10 text-success" : "bg-accent/10 text-accent"
                          )}>
                            {(res.resource_type === 'material' || !res.resource_type) ? <Package className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-black text-main uppercase truncate tracking-tight mb-0.5">{cleanRichText(res.resource_name)}</div>
                            <div className="text-[8px] text-ghost flex items-center gap-1.5 font-bold">
                               <span className="text-primary/80 font-black">{res.consumption_rate}</span>
                               <span className="opacity-50">/</span>
                               <span className="uppercase tracking-tighter">{cleanRichText(res.resource_unit || 'unit')}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-base font-black text-main tabular-nums">{(calcQty * res.consumption_rate).toFixed(3)}</div>
                            <div className="text-[8px] font-black text-ghost uppercase tracking-tighter">Gross Req</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {calcTrade.notes && (
                    <div className="p-4 bg-surface-2 rounded-2xl border border-border-subtle">
                      <div className="text-[9px] font-black text-ghost uppercase mb-2 flex items-center gap-2">
                        <Info className="w-3.5 h-3.5" />
                        Production Notes
                      </div>
                      <p className="text-[10px] text-main leading-relaxed font-medium">{calcTrade.notes}</p>
                    </div>
                  )}
                </div>

                <div className="p-8 pt-4 bg-surface-base border-t border-border-subtle">
                  <button 
                    onClick={() => setCalcTrade(null)}
                    className="w-full h-14 bg-main text-surface-base rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Close Trade Guide
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAlerts = () => (
    <div className="flex flex-col h-full bg-surface-base">
      <header className="p-4 border-b border-border-subtle bg-surface-1 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveTab('dashboard')} className="p-2 -ml-2 text-ghost">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-black text-main">Site Incident Log</h1>
        </div>
        <AlertTriangle className="w-5 h-5 text-danger animate-pulse" />
      </header>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="flex flex-col gap-4">
          <button 
            onClick={() => setIsReportingAlert(true)}
            className="w-full py-6 bg-danger text-white rounded-[2rem] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-danger/20 hover:scale-[1.02] transition-all"
          >
            <Plus className="w-6 h-6" />
            Raise Site Incident
          </button>

          <div className="flex flex-col gap-4 mt-6">
            <h3 className="text-[10px] font-black uppercase text-ghost tracking-[0.2em] ml-1">Recent Blocker & Incidents</h3>
            {notifications.length === 0 ? (
              <div className="py-24 text-center opacity-30 border-2 border-dashed border-border-subtle rounded-[2rem]">
                <AlertOctagon className="w-12 h-12 mx-auto mb-4" />
                <p className="text-xs font-bold uppercase tracking-widest">No active site alerts</p>
              </div>
            ) : notifications.map((a, i) => (
              <div key={i} className="p-6 bg-surface-1 border border-border-subtle rounded-[2rem] border-l-8 border-l-danger shadow-sm group hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                   <div className="flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-danger animate-ping" />
                     <span className="text-[10px] font-black text-danger uppercase tracking-[0.15em]">{a.type || 'Alert'}</span>
                   </div>
                   <span className="text-[10px] font-mono font-bold text-ghost bg-surface-2 px-2 py-0.5 rounded">{new Date(a.created_at).toLocaleDateString()}</span>
                </div>
                <h4 className="text-sm font-black text-main group-hover:text-danger transition-colors">{a.title}</h4>
                <p className="text-[11px] text-ghost mt-2 leading-relaxed font-medium">{a.message}</p>
                <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3">
                   <div className="flex -space-x-2">
                      <div className="w-6 h-6 rounded-full bg-surface-3 border-2 border-surface-base" />
                      <div className="w-6 h-6 rounded-full bg-surface-2 border-2 border-surface-base" />
                   </div>
                   <button className="text-[9px] font-black uppercase text-danger hover:underline">Mark as Resolved</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isReportingAlert && (
          <div className="absolute inset-0 z-[2000] bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-4 rounded-[3rem] overflow-hidden">
             <motion.div 
               initial={{ y: 100, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               exit={{ y: 100, opacity: 0 }}
               className="w-full max-w-md bg-surface-1 rounded-[3rem] p-8 space-y-6 shadow-2xl relative border border-border-subtle"
             >
                <div className="absolute top-6 right-6 flex gap-2">
                   {alertStep > 1 && (
                     <button onClick={() => setAlertStep(prev => (prev - 1) as any)} className="p-2 bg-surface-2 rounded-xl text-ghost hover:text-primary transition-all active:scale-90 shadow-sm">
                       <ChevronLeft className="w-5 h-5" />
                     </button>
                   )}
                   <button onClick={() => { setIsReportingAlert(false); setAlertStep(1); }} className="p-2 bg-surface-2 rounded-xl text-ghost hover:text-danger transition-all active:scale-90 shadow-sm">
                      <X className="w-5 h-5" />
                   </button>
                </div>

                <div className="space-y-1">
                   <h2 className="text-2xl font-black text-main tracking-tight">
                     {alertStep === 1 && "Select Category"}
                     {alertStep === 2 && "Classification"}
                     {alertStep === 3 && "Incident Brief"}
                   </h2>
                   <div className="flex gap-1.5 mt-2">
                     {[1, 2, 3].map(s => (
                       <div key={s} className={cn("h-1 rounded-full transition-all duration-300", s === alertStep ? "w-10 bg-danger" : (s < alertStep ? "w-2 bg-danger/40" : "w-1.5 bg-surface-2"))} />
                     ))}
                   </div>
                </div>

                <div className="overflow-y-auto max-h-[55vh] no-scrollbar pr-1 -mr-1">
                  <AnimatePresence mode="wait">
                    {alertStep === 1 && (
                      <motion.div 
                        key="step1"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="grid grid-cols-3 gap-3 pt-2 pb-4"
                      >
                        {ALERT_CATEGORIES.map(cat => (
                          <button 
                            key={cat.id}
                            onClick={() => {
                              setNewAlert({ ...newAlert, category: cat.id });
                              setAlertStep(2);
                            }}
                            className={cn(
                              "flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all gap-2.5 group bg-surface-base border-border-subtle hover:border-danger/30 hover:shadow-lg hover:shadow-danger/5 active:scale-95",
                              newAlert.category === cat.id && "border-danger bg-danger/5 shadow-inner"
                            )}
                          >
                             <div className={cn(
                               "w-11 h-11 rounded-2xl flex items-center justify-center shadow-md transition-transform group-hover:rotate-3",
                               newAlert.category === cat.id ? "bg-danger text-white" : "bg-surface-2 text-ghost group-hover:text-danger"
                             )}>
                                <cat.icon className="w-5 h-5" />
                             </div>
                             <span className={cn("text-[8px] font-black uppercase tracking-widest text-center leading-tight transition-colors", newAlert.category === cat.id ? "text-danger" : "text-ghost")}>
                               {cat.label}
                             </span>
                          </button>
                        ))}
                      </motion.div>
                    )}

                    {alertStep === 2 && (
                      <motion.div 
                        key="step2"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="space-y-4 pt-2 pb-4"
                      >
                        <div className="flex items-center gap-3 px-1 mb-2">
                          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border-subtle to-transparent" />
                          <p className="text-[9px] font-black text-ghost uppercase tracking-[0.2em] whitespace-nowrap">Identify Issue Type</p>
                          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border-subtle to-transparent" />
                        </div>
                        <div className="grid grid-cols-1 gap-2.5">
                          {ALERT_CATEGORIES.find(c => c.id === newAlert.category)?.subs.map(sub => (
                            <button
                              key={sub}
                              onClick={() => {
                                setNewAlert({ ...newAlert, subcategory: sub });
                                setAlertStep(3);
                              }}
                              className={cn(
                                "text-left p-4 rounded-xl border transition-all text-[11px] font-black uppercase tracking-tight flex items-center justify-between group",
                                newAlert.subcategory === sub 
                                  ? "bg-danger text-white border-danger shadow-md shadow-danger/20" 
                                  : "bg-surface-base border-border-subtle text-main hover:border-danger/30 hover:bg-danger/5"
                              )}
                            >
                              <span className="truncate pr-2">{sub}</span>
                              <ChevronRight className={cn("w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-1", newAlert.subcategory === sub ? "text-white" : "text-ghost")} />
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {alertStep === 3 && (
                      <motion.div 
                        key="step3"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="space-y-6 pt-2 pb-4"
                      >
                        <div className="flex items-center gap-3 p-4 bg-surface-2 rounded-2xl border border-border-subtle mb-4">
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", ALERT_CATEGORIES.find(c => c.id === newAlert.category)?.bg || 'bg-surface-2', ALERT_CATEGORIES.find(c => c.id === newAlert.category)?.color || 'text-ghost')}>
                            {React.createElement(ALERT_CATEGORIES.find(c => c.id === newAlert.category)?.icon || Bell, { className: "w-5 h-5" })}
                          </div>
                          <div>
                            <div className="text-[9px] font-black uppercase text-ghost tracking-widest leading-none mb-1">{newAlert.category}</div>
                            <div className="text-xs font-bold text-main">{newAlert.subcategory}</div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                             <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                             Observations & Description
                          </label>
                          <textarea 
                            className="w-full bg-surface-base border border-border-subtle rounded-xl p-5 text-sm outline-none focus:border-danger min-h-[150px] shadow-inner transition-all hover:bg-surface-base/80 leading-relaxed font-semibold italic"
                            placeholder="Describe the situation, exact location, and any immediate actions required..."
                            value={newAlert.message}
                            onChange={(e) => setNewAlert({ ...newAlert, message: e.target.value })}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                               <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                               Type
                            </label>
                            <div className="flex bg-surface-base p-1 rounded-xl border border-border-subtle">
                              {(['info', 'warning', 'critical'] as const).map(t => (
                                <button
                                  key={t}
                                  onClick={() => setNewAlert({ ...newAlert, type: t })}
                                  className={cn(
                                    "flex-1 py-2 rounded text-[8px] font-black uppercase transition-all",
                                    newAlert.type === t ? "bg-danger text-white shadow-md" : "text-ghost"
                                  )}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                               <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                               Priority
                            </label>
                            <div className="flex bg-surface-base p-1 rounded-xl border border-border-subtle">
                              {(['Low', 'Medium', 'High'] as const).map(p => (
                                <button
                                  key={p}
                                  onClick={() => setNewAlert({ ...newAlert, priority: p as any })}
                                  className={cn(
                                    "flex-1 py-2 rounded text-[8px] font-black uppercase transition-all",
                                    newAlert.priority === p ? "bg-danger text-white shadow-md" : "text-ghost"
                                  )}
                                >
                                  {p}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {alertStep === 3 && (
                  <button 
                    onClick={handleAlertSubmit}
                    disabled={loading}
                    className="w-full h-14 bg-danger text-white rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-2xl shadow-danger/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    Log & Broadcast Alert
                  </button>
                )}
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  const renderNotifications = () => (
    <div className="flex flex-col h-full bg-surface-base">
      <header className="p-4 border-b border-border-subtle bg-surface-1 flex items-center gap-4">
        <button onClick={() => setActiveTab('dashboard')} className="p-2 -ml-2 text-ghost">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-black text-main">Notifications</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
         <div className="flex flex-col gap-3">
           {notifications.filter(n => n.type !== 'critical').map((n, i) => (
             <div key={i} className={cn(
               "p-4 border border-border-subtle rounded-2xl flex flex-col gap-2",
               n.is_read ? "bg-surface-1 opacity-70" : "bg-primary/5 border-primary/20"
             )}>
                <div className="flex items-center justify-between">
                  <h4 className={cn("text-xs font-bold", n.is_read ? "text-main" : "text-primary")}>{n.title}</h4>
                  {!n.is_read && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </div>
                <p className="text-[11px] text-ghost leading-relaxed">{n.message}</p>
                <div className="text-[9px] font-mono text-ghost mt-1 uppercase">Today • 2:45 PM</div>
             </div>
           ))}
         </div>
      </div>
    </div>
  );

  const renderStoreView = () => (
    <div className="flex flex-col h-full bg-surface-base">
      <header className="p-4 border-b border-border-subtle bg-surface-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveTab('dashboard')} className="p-2 -ml-2 text-ghost">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-black text-main">Store Manager</h1>
        </div>
        <div className={cn(
          "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
          storeMode === 'grn' ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
        )}>
          {storeMode === 'grn' ? 'Receiving Goods' : 'Issuing Material'}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="flex flex-col gap-6">
           <div className="p-6 bg-surface-1 border border-border-subtle rounded-3xl space-y-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-ghost">Reference No (PO/Gate Pass)</label>
                <input className="w-full bg-surface-base border border-border-subtle rounded-xl p-3 text-sm font-bold outline-none focus:border-primary" placeholder="Enter Reference..." />
              </div>
              
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-ghost">Items List</h4>
                  <button onClick={() => setStoreEntries([...storeEntries, { item: '', qty: 0, unit: 'unit' }])} className="p-2 bg-primary/10 text-primary rounded-lg text-xs font-bold flex items-center gap-1">
                    <Plus className="w-3 h-3" />
                    ADD
                  </button>
                </div>
                {storeEntries.map((entry, idx) => (
                  <div key={idx} className="flex flex-col gap-3 p-4 bg-surface-2 border border-border-subtle rounded-2xl">
                    <input 
                      className="bg-transparent text-sm font-bold outline-none" 
                      placeholder="Item name..." 
                      value={entry.item}
                      onChange={(e) => {
                        const newE = [...storeEntries];
                        newE[idx].item = e.target.value;
                        setStoreEntries(newE);
                      }}
                    />
                    <div className="flex items-center gap-4">
                       <div className="flex-1">
                          <label className="text-[9px] font-black uppercase text-ghost">Quantity</label>
                          <input 
                            type="number" 
                            className="w-full h-10 bg-surface-base border border-border-subtle rounded-lg px-3 text-sm font-mono" 
                            value={entry.qty}
                            onChange={(e) => {
                              const newE = [...storeEntries];
                              newE[idx].qty = parseFloat(e.target.value) || 0;
                              setStoreEntries(newE);
                            }}
                          />
                       </div>
                       <button onClick={() => setStoreEntries(storeEntries.filter((_, i) => i !== idx))} className="p-2 text-ghost hover:text-danger self-end"><MinusCircle className="w-5 h-5" /></button>
                    </div>
                  </div>
                ))}
              </div>
           </div>

           <button className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 h-14">
             Process {storeMode === 'grn' ? 'Delivery' : 'Issue'}
           </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn(
      "bg-surface-base flex flex-col font-sans select-none overflow-hidden safe-area-padding max-w-md mx-auto border border-border-subtle rounded-[3rem] shadow-2xl",
      isEmbedded ? "relative h-[750px] w-full" : "fixed inset-0 z-[1000] my-4"
    )}>
       {/* UI Elements for Mobile Simulation */}
       <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-6 bg-surface-base border border-border-subtle rounded-b-3xl z-[110] flex items-center justify-center">
         <div className="w-12 h-1 bg-border-subtle rounded-full" />
       </div>
       
       {/* Main App Container */}
       <main className="flex-1 relative overflow-hidden pt-6">
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'report' && renderReportWizard()}
          {activeTab === 'trade_guide' && renderTradeGuide()}
          {activeTab === 'store' && renderStoreView()}
          {activeTab === 'alerts' && renderAlerts()}
          {activeTab === 'notifications' && renderNotifications()}
          {activeTab === 'history' && (
            <div className="flex flex-col h-full bg-surface-base">
               <header className="p-4 border-b border-border-subtle bg-surface-1 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setActiveTab('dashboard')} className="p-2 -ml-2 text-ghost">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-lg font-black text-main">Log History</h1>
                  </div>
                  <HistoryIcon className="w-5 h-5 text-ghost" />
               </header>
               <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4 pb-20">
                  {history.map((h, i) => {
                    const isExpanded = collapsedLogs.has(h.id);
                    return (
                      <div key={i} className="p-5 bg-surface-1 border border-border-subtle rounded-2xl space-y-3 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-primary uppercase tracking-widest">{h.weather} Day Log</span>
                            <span className="text-[10px] font-mono text-ghost">{h.report_date}</span>
                        </div>
                        <p className="text-xs text-ghost leading-relaxed">{h.remarks || 'No detailed remarks recorded for this period.'}</p>
                        
                        <div className="pt-2">
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               toggleLogActivities(h.id);
                             }}
                             className="flex items-center gap-2 text-[9px] font-black uppercase text-ghost hover:text-primary transition-colors"
                           >
                             <ChevronRight className={cn("w-3 h-3 transition-transform", isExpanded && "rotate-90")} />
                             Summarize Activities
                           </button>
                           
                           <AnimatePresence>
                             {isExpanded && (
                               <motion.div 
                                 initial={{ height: 0, opacity: 0 }}
                                 animate={{ height: 'auto', opacity: 1 }}
                                 exit={{ height: 0, opacity: 0 }}
                                 className="overflow-hidden mt-3 space-y-2 border-l-2 border-primary/10 pl-3"
                               >
                                  <div className="text-[8px] font-black text-ghost uppercase tracking-widest mb-1">Execution Summary</div>
                                  <div className="text-[10px] text-dim italic">
                                    Click "View Details" to see deep activity and resource breakdown.
                                  </div>
                               </motion.div>
                             )}
                           </AnimatePresence>
                        </div>

                        <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
                           <div className="flex items-center gap-2">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditLog(h);
                                }}
                                className="p-1 px-3 rounded-lg bg-surface-2 border border-border-subtle text-[9px] font-black uppercase text-main hover:bg-surface-3 transition-all flex items-center gap-1.5"
                              >
                                <FileText className="w-3 h-3" />
                                Edit Log
                              </button>
                           </div>
                           <button 
                             onClick={() => loadLogDetails(h.id)}
                             className="text-[9px] font-black uppercase text-primary hover:underline transition-all active:scale-95"
                           >
                             View Full Details
                           </button>
                        </div>
                      </div>
                    );
                  })}
               </div>

               <AnimatePresence>
                 {selectedLog && (
                   <div className="absolute inset-0 z-[1500] bg-surface-base flex flex-col animate-in slide-in-from-right duration-300">
                     <header className="p-4 border-b border-border-subtle bg-surface-1 flex items-center justify-between shadow-sm">
                       <div className="flex items-center gap-3">
                         <button onClick={() => setSelectedLog(null)} className="p-2 -ml-2 text-ghost hover:bg-surface-2 rounded-xl transition-all">
                           <ChevronLeft className="w-6 h-6" />
                         </button>
                         <div>
                            <h1 className="text-lg font-black text-main">Log Details</h1>
                            <p className="text-[9px] font-bold text-ghost uppercase tracking-widest">{selectedLog.report_date}</p>
                         </div>
                       </div>
                       <div className="flex items-center gap-2">
                         <span className="text-[10px] font-bold text-primary px-2 py-0.5 bg-primary/10 rounded uppercase">{selectedLog.weather}</span>
                       </div>
                     </header>
                     
                     <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                        {/* Summary */}
                        <div className="space-y-2">
                           <h3 className="text-[10px] font-black uppercase tracking-widest text-ghost">General Remarks</h3>
                           <p className="text-sm text-main leading-relaxed italic border-l-2 border-primary/20 pl-4 py-1">
                             "{selectedLog.remarks || 'No summary remarks provided for this log.'}"
                           </p>
                        </div>

                        {/* Activities */}
                        <div className="space-y-4">
                           <h3 className="text-[10px] font-black uppercase tracking-widest text-ghost">Executed Activities</h3>
                           <div className="flex flex-col gap-3">
                              {selectedLog.daily_activities?.map((act: any, idx: number) => (
                                <div key={idx} className="p-4 bg-surface-1 border border-border-subtle rounded-2xl shadow-sm">
                                   <div className="flex items-center justify-between mb-2">
                                      <span className="text-[9px] font-black text-primary uppercase tracking-widest">
                                        {act.boq_items?.item_no || 'N/A'}
                                      </span>
                                      <span className="text-xs font-black text-main">
                                        {act.progress_qty} <span className="text-[9px] text-ghost font-bold uppercase">{act.boq_items?.unit}</span>
                                      </span>
                                   </div>
                                   <h4 className="text-sm font-bold text-main mb-2">
                                     {cleanRichText(act.boq_items?.description || 'Unknown Activity')}
                                   </h4>
                                   {act.remarks && (
                                     <p className="text-[10px] text-ghost italic border-t border-border-subtle/50 pt-2 mt-2">
                                       Notes: {act.remarks}
                                     </p>
                                   )}
                                </div>
                              ))}
                           </div>
                        </div>

                        {/* Resources Grid */}
                        <div className="grid grid-cols-1 gap-6">
                           {/* Labour */}
                           {selectedLog.daily_labour?.length > 0 && (
                             <div className="space-y-3">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-ghost flex items-center gap-2">
                                   <Users className="w-3.5 h-3.5" />
                                   Manpower Deployment
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                   {selectedLog.daily_labour.map((l: any, idx: number) => (
                                     <div key={idx} className="p-3 bg-surface-2/50 border border-border-subtle rounded-xl">
                                        <div className="text-[9px] font-black text-main uppercase truncate mb-1">Grade ID: {l.labour_grade_id}</div>
                                        <div className="flex items-center justify-between">
                                           <span className="text-sm font-black text-accent">{l.headcount}</span>
                                           <span className="text-[8px] text-ghost font-bold uppercase">PERSONNEL</span>
                                        </div>
                                     </div>
                                   ))}
                                </div>
                             </div>
                           )}

                           {/* Materials */}
                           {selectedLog.daily_materials?.length > 0 && (
                             <div className="space-y-3">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-ghost flex items-center gap-2">
                                   <Package className="w-3.5 h-3.5" />
                                   Material Utilization
                                </h3>
                                <div className="flex flex-col gap-2">
                                   {selectedLog.daily_materials.map((m: any, idx: number) => (
                                     <div key={idx} className="flex items-center justify-between p-3 bg-surface-2/50 border border-border-subtle rounded-xl">
                                        <span className="text-[10px] font-bold text-main truncate max-w-[150px]">{m.material_id}</span>
                                        <div className="flex items-center gap-1.5">
                                           <span className="text-xs font-black text-emerald-600">{m.quantity_used}</span>
                                           <span className="text-[8px] text-ghost font-bold uppercase">Used</span>
                                        </div>
                                     </div>
                                   ))}
                                </div>
                             </div>
                           )}

                           {/* Equipment */}
                           {selectedLog.daily_equipment?.length > 0 && (
                             <div className="space-y-3">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-ghost flex items-center gap-2">
                                   <Truck className="w-3.5 h-3.5" />
                                   Machinery Runtime
                                </h3>
                                <div className="flex flex-col gap-2">
                                   {selectedLog.daily_equipment.map((e: any, idx: number) => (
                                     <div key={idx} className="p-4 bg-surface-2/50 border border-border-subtle rounded-2xl space-y-2">
                                        <div className="text-[10px] font-black text-main uppercase">{e.equipment_id}</div>
                                        <div className="grid grid-cols-2 gap-4">
                                           <div>
                                              <span className="text-[8px] text-ghost font-black uppercase block">Worked</span>
                                              <span className="text-sm font-black text-orange-600">{e.hours_worked} <span className="text-[9px]">Hrs</span></span>
                                           </div>
                                           <div>
                                              <span className="text-[8px] text-ghost font-black uppercase block">Idle</span>
                                              <span className="text-sm font-black text-ghost">{e.idle_hours} <span className="text-[9px]">Hrs</span></span>
                                           </div>
                                        </div>
                                     </div>
                                   ))}
                                </div>
                             </div>
                           )}
                        </div>
                     </div>
                     
                     <div className="p-8 border-t border-border-subtle bg-surface-1">
                        <button 
                          onClick={() => setSelectedLog(null)}
                          className="w-full h-14 bg-main text-surface-base rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all"
                        >
                          Dismiss Detail View
                        </button>
                     </div>
                   </div>
                 )}
               </AnimatePresence>

               {logLoading && (
                 <div className="absolute inset-0 z-[1600] bg-surface-base/60 backdrop-blur-sm flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                 </div>
               )}
            </div>
          )}
       </main>

       {/* Floating Navigation Progress Bar (Always Visible at Bottom) */}
       <footer 
         onClick={() => setShowPendingModal(true)}
         className="shrink-0 bg-surface-1 border-t border-border-subtle px-4 py-3 sm:pb-8 flex flex-col gap-3 cursor-pointer hover:bg-surface-2 transition-colors select-none group uppercase tracking-tight"
       >
          <div className="flex items-center justify-between mb-1">
             <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                   <LayoutDashboard className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-black text-main uppercase tracking-tight">Project Progress</span>
                <span className="text-[9px] px-1.5 py-0.25 bg-accent/10 border border-accent/20 rounded font-bold text-accent animate-pulse uppercase tracking-widest sm:inline-block hidden">Click to view pending tasks</span>
             </div>
             <span className="text-[11px] font-mono font-black text-primary">{liveProgressPct}%</span>
          </div>
          <div className="h-2 bg-surface-2 rounded-full overflow-hidden mb-1">
             <motion.div 
               initial={{ width: 0 }}
               animate={{ width: `${liveProgressPct}%` }}
               className="h-full bg-primary"
             />
          </div>
          <div className="flex items-center gap-4 overflow-x-auto custom-scrollbar no-scrollbar py-1">
             {upcomingActivities.length > 0 ? upcomingActivities.slice(0, 5).map((act, i) => (
                <div key={i} className="whitespace-nowrap flex items-center gap-2 px-3 py-1.5 bg-surface-2 border border-border-subtle rounded-full text-[9px] font-bold text-ghost shrink-0">
                   <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                   UPCOMING: {cleanRichText(act.description)}
                </div>
             )) : (
               <span className="text-[9px] text-ghost italic">No upcoming scheduled activities.</span>
             )}
          </div>
       </footer>

       {/* Pending Tasks Modal */}
       <AnimatePresence>
         {showPendingModal && (
           <div 
             className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
             onClick={() => setShowPendingModal(false)}
           >
             <motion.div
               initial={{ opacity: 0, scale: 0.95, y: 10 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 10 }}
               className="w-full max-w-md bg-surface-1 border border-border-subtle rounded-3xl overflow-hidden shadow-2xl flex flex-col"
               onClick={(e) => e.stopPropagation()}
             >
               {/* Header */}
               <div className="p-5 border-b border-border-subtle flex items-center justify-between bg-surface-2">
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                     <ClipboardList className="w-4 h-4" />
                   </div>
                   <div>
                     <h3 className="text-sm font-bold text-main normal-case">Next Pending Tasks</h3>
                     <p className="text-[10px] text-ghost font-medium normal-case">Incomplete project execution milestones</p>
                   </div>
                 </div>
                 <button
                   onClick={() => setShowPendingModal(false)}
                   className="p-1.5 text-ghost hover:text-main bg-surface-1 hover:bg-surface-3 border border-border-subtle rounded-lg cursor-pointer transition-colors"
                 >
                   <X className="w-4 h-4" />
                 </button>
               </div>

               {/* List */}
               <div className="p-6 flex flex-col gap-4 max-h-[350px] overflow-y-auto custom-scrollbar">
                 {nextPendingTasks.length > 0 ? (
                   nextPendingTasks.map((task) => (
                     <div 
                       key={task.id} 
                       className="p-4 bg-surface-2 border border-border-subtle rounded-2xl flex flex-col gap-3"
                     >
                       <div className="flex items-start justify-between gap-3">
                         <div className="flex flex-col">
                           <span className="text-[10px] font-mono font-bold text-primary">{task.item_no}</span>
                           <span className="text-xs font-semibold text-main mt-0.5 line-clamp-2 normal-case">{cleanRichText(task.description)}</span>
                         </div>
                         <span className="text-[10px] text-ghost font-semibold whitespace-nowrap bg-surface-1 px-2 py-0.5 border border-border-subtle rounded-md">
                           {task.contract_qty ? `${task.contract_qty.toLocaleString()} ${task.unit || 'Units'}` : 'N/A'}
                         </span>
                       </div>

                       {/* Progress Bar for specific task */}
                       <div className="flex flex-col gap-1">
                         <div className="flex items-center justify-between text-[10px] font-mono text-dim">
                           <span>Progress</span>
                           <span className="text-primary font-bold">{Math.round(task.progress_pct || 0)}%</span>
                         </div>
                         <div className="h-1.5 bg-surface-1 rounded-full overflow-hidden">
                           <div 
                             className="h-full bg-primary" 
                             style={{ width: `${Math.round(task.progress_pct || 0)}%` }} 
                           />
                         </div>
                       </div>

                       {/* Planned Date */}
                       {task.planned_start_date && (
                         <div className="flex items-center gap-1.5 text-[9px] font-medium text-ghost border-t border-border-subtle/50 pt-2 normal-case">
                           <Calendar className="w-3 h-3" />
                           <span>Planned Start: {new Date(task.planned_start_date).toLocaleDateString()}</span>
                         </div>
                       )}
                     </div>
                   ))
                 ) : (
                   <div className="text-center py-8 text-dim space-y-2">
                     <CheckSquare className="w-8 h-8 text-primary mx-auto opacity-45" />
                     <p className="text-xs font-bold uppercase tracking-wider text-ghost">All activities completed</p>
                     <p className="text-[10px] text-ghost">There are no pending incomplete tasks for this project.</p>
                   </div>
                 )}
               </div>

               {/* Footer */}
               <div className="p-4 bg-surface-2 border-t border-border-subtle flex justify-end">
                 <button
                   onClick={() => setShowPendingModal(false)}
                   className="btn btn-secondary text-xs px-5 h-9 rounded-xl cursor-pointer normal-case"
                 >
                   Close
                 </button>
               </div>
             </motion.div>
           </div>
         )}
       </AnimatePresence>

       {pickerOpen && (
         <ResourcePickerModal 
           onClose={() => setPickerOpen(false)}
           onSelect={handleResourceSelect}
           tenantId={tenantId}
         />
       )}

       {loading && activeTab === 'dashboard' && (
         <div className="absolute inset-0 bg-surface-base/80 backdrop-blur-sm z-[100] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-surface-1 border border-border-subtle shadow-2xl">
               <Loader2 className="w-10 h-10 animate-spin text-primary" />
               <span className="text-xs font-black uppercase tracking-widest text-primary animate-pulse">Syncing Site Context</span>
            </div>
         </div>
       )}
    </div>
  );
}
