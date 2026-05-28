import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutGrid, 
  BrainCircuit, 
  Calendar, 
  CheckCircle,
  Activity, 
  Package, 
  FileText, 
  ShoppingCart, 
  Settings, 
  Users, 
  Zap,
  ChevronRight,
  Clock,
  Calculator,
  Bell,
  GitBranch,
  BookOpen,
  UserPlus,
  ShieldCheck,
  Sliders,
  HelpCircle,
  History,
  LogOut,
  Plus,
  MoreHorizontal,
  RefreshCw,
  Search,
  X,
  Shapes,
  Globe,
  Cpu,
  MapPin,
  DollarSign,
  Building2,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, cleanRichText } from '../lib/utils';
import { CeflotLogo } from './Logo';
import { supabase } from '../lib/supabase';

import { usePermissions, Capability } from '../hooks/usePermissions';
import { Project, Tenant } from '../types';

interface ModuleCard {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  capability?: Capability;
  subTools?: string[];
}

export interface SearchItem {
  id: string;
  title: string;
  description: string;
  category: 'DASHBOARD' | 'PROJECT' | 'SUPPORT' | 'ADMIN' | 'GOD';
  capability: Capability | null;
  isGodOnly?: boolean;
  tags: string[];
}

const EXPLORER_DATABASE: SearchItem[] = [
  // Dashboard Group
  { id: 'dashboard', title: 'Portfolio Overview', description: 'Global dashboard representing performance KPIs, cashflows, and overall status for all projects.', category: 'DASHBOARD', capability: 'dash:view', tags: ['portfolio', 'analytics', 'earned value', 'kpi', 'performance', 'map', 'summary'] },
  { id: 'dashboard', title: 'Project GIS Map', description: 'Geographic and status distribution of all regional company site works and active contracts.', category: 'DASHBOARD', capability: 'dash:view', tags: ['gis', 'map', 'location', 'projects', 'coordinates'] },
  { id: 'dashboard', title: 'Performance KPIs', description: 'Real-time financial and schedule metrics including Schedule Variance, Cost Variance, and CPI.', category: 'DASHBOARD', capability: 'dash:view', tags: ['charts', 'cpi', 'spi', 'evm', 'performance'] },
  { id: 'dashboard', title: 'Risk Evaluation Matrix', description: 'Early warning indicators and systematic project risk classification.', category: 'DASHBOARD', capability: 'dash:view', tags: ['risk', 'alerts', 'warnings', 'incidents'] },

  // Client Portal Group
  { id: 'client-portal', title: 'Client Portal Dashboard', description: 'Security-cleared gateway designed for clients to monitor progress milestones, certified financial summaries, and work variations.', category: 'DASHBOARD', capability: 'client:view', tags: ['client', 'portal', 'transparency', 'collaboration', 'investor'] },

  // Intelligence Group
  { id: 'intelligence', title: 'Intelligence Center', description: 'Resource demand model, labor planning market trends, and contextual AI assistants.', category: 'DASHBOARD', capability: null, tags: ['ai', 'intelligence', 'gemini', 'assistant', 'trends', 'market', 'labor'] },
  { id: 'intelligence', title: 'Resource Demand Forecasting', description: 'Forecasting engine displaying allocation limits, shortages, and labor bottlenecks.', category: 'DASHBOARD', capability: null, tags: ['demand', 'forecasting', 'allocation', 'shortages'] },

  // Library Group
  { id: 'library', title: 'Material and Trade Rate Library', description: 'Global dictionary for material catalog items, standard specifications, and trade subcontract labor rates.', category: 'DASHBOARD', capability: 'trade:view_global', tags: ['library', 'catalog', 'specs', 'materials', 'items', 'costs'] },

  // Project Group
  { id: 'project-setup', title: 'Project Initialization Setup', description: 'Establish new milestones, setup administrative metadata, add project teams, and audit checklists.', category: 'PROJECT', capability: 'proj:set_checklists', tags: ['milestones', 'initialization', 'checklists', 'teams', 'setup'] },
  { id: 'planning', title: 'Bill of Quantities (BoQ) Builder', description: 'Construct cost-coded quantities, load recipe estimates, and baseline the original project scope.', category: 'PROJECT', capability: 'boq:view_recipes', tags: ['boq', 'quantities', 'survey', 'measurement', 'contracts', 'recipe'] },
  { id: 'schedule', title: 'Project Gantt Chart Scheduler', description: 'Create logical sequences between tasks, analyze the critical path, and manage active dates/slippages.', category: 'PROJECT', capability: 'plan:view', tags: ['gantt', 'schedule', 'planning', 'milestones', 'calendar', 'critical path'] },
  { id: 'budget', title: 'Cost Planning & Budget Manager', description: 'Formulate baseline budgets, track actual costs against committed purchase orders, and monitor bottom-line margins.', category: 'PROJECT', capability: 'fin:view_budget', tags: ['budget', 'cost', 'committed', 'invoice', 'actual', 'margin'] },
  { id: 'operations-hub', title: 'Operations Control Center', description: 'Daily site reporting, weather logs, manpower ratios, fuel consumptions, activity trackers, and direct supervision.', category: 'PROJECT', capability: 'daily:view_project', tags: ['daily report', 'execution', 'site', 'weather', 'manpower', 'fuel', 'operations'] },
  { id: 'approvals', title: 'System Approval Desk', description: 'Review, authorize, or delegate work packages, variation orders, material requests, and custom workflow budgets.', category: 'PROJECT', capability: 'appr:view_pending', tags: ['approvals', 'signatures', 'review', 'workflow'] },
  { id: 'alerts', title: 'Incidents & Broadcaster Alerts', description: 'Warning sinks tracking extreme weather events, variation thresholds, low-material reorder points, and budget variances.', category: 'PROJECT', capability: 'alert:view', tags: ['notifications', 'alerts', 'warnings', 'incidents'] },

  // Support Group
  { id: 'variations', title: 'Variation Order Management', description: 'Contract changes, additional work assessments, variation rate calculations, and official instructions ledger.', category: 'SUPPORT', capability: 'fin:var_view', tags: ['variations', 'claims', 'rates', 'instructions', 'changes'] },
  { id: 'eot', title: 'Extension of Time (EoT) Claims', description: 'Slippage impacts, critical path disruptions, claim submissions, and contractual approval logs.', category: 'SUPPORT', capability: 'fin:eot_view', tags: ['eot', 'delay', 'claims', 'insurance', 'impact'] },
  { id: 'subcontractors', title: 'Subcontractor Directory & Agreements', description: 'Partner database, verified certificates, payment applications, retention ledgers, and trade evaluations.', category: 'SUPPORT', capability: 'res:subcon_view', tags: ['subcontractors', 'trades', 'partners', 'retention', 'certificates'] },
  { id: 'procurement', title: 'Procurement Pipeline & RFQ Builder', description: 'Track requisitions, compile multi-vendor RFQs, analyze comparative bid tables, and issue unified POs.', category: 'SUPPORT', capability: 'proc:view_demand', tags: ['rfq', 'procurement', 'bids', 'vendors', 'purchase orders', 'po'] },
  { id: 'warehouse', title: 'Warehouse Stock Registry', description: 'Log incoming materials, request stock releases, track localized warehouses, and check low inventory markers.', category: 'SUPPORT', capability: 'stock:view', tags: ['inventory', 'stock', 'warehouse', 'goods receipt', 'grn'] },

  // Admin Group
  { id: 'users', title: 'User Account Directory', description: 'Invite team members, assign initial enterprise roles, and audit account states.', category: 'ADMIN', capability: 'admin:view_users', tags: ['users', 'directory', 'teammates', 'invite', 'staff'] },
  { id: 'permissions', title: 'Role Capabilities Matrix', description: 'Alter global role definitions, toggle user permission strategies, and assign bespoke granular overrides.', category: 'ADMIN', capability: 'admin:view_roles', tags: ['permissions', 'roles', 'capabilities', 'rbac', 'security'] },
  { id: 'approval-config', title: 'Workflow Chains Configurator', description: 'Construct multi-tier approval levels based on customized cost-centers and specific company roles.', category: 'ADMIN', capability: 'appr:view_chains', tags: ['workflows', 'approvals', 'chains', 'levels', 'sign-off'] },
  { id: 'alert-settings', title: 'Alert Triggers & Threshold Settings', description: 'Tune automatic warning indicators for budget overrun thresholds and material stock reorder rules.', category: 'ADMIN', capability: 'alert:set_thresholds', tags: ['thresholds', 'triggers', 'sensors', 'tolerances'] },
  { id: 'audit', title: 'Secure Event Stream Logs', description: 'Immutable trail logging all database record creations, profile updates, and authentication requests.', category: 'ADMIN', capability: 'admin:view_audit', tags: ['audit', 'security', 'logs', 'trail', 'history'] },

  // God Mode Group
  { id: 'god', title: 'Platform Control Center', description: 'Super-user dashboard managing multitenant database schemas, bypass security constraints, configure baseline templates, and monitor systems telemetry.', category: 'GOD', isGodOnly: true, capability: null, tags: ['god', 'root', 'telemetry', 'tenants', 'admin'] }
];

const MODULE_GROUPS = [
  {
    title: 'Dashboard',
    description: 'Analytics and Repositories',
    modules: [
      { id: 'dashboard', title: 'Portfolio', description: 'Global overview for all projects', icon: Shapes, color: 'text-primary', subTools: ['Project Map', 'Performance KPIs', 'Risk Matrix'], capability: 'dash:view' as Capability },
      { id: 'client-portal', title: 'Client Portal', description: 'Project oversight and transparency', icon: ShieldCheck, color: 'text-accent', subTools: ['Progress', 'Financials', 'Variations'], capability: 'client:view' as Capability },
      { id: 'intelligence', title: 'Intelligence', description: 'Resource demand map & AI queries', icon: BrainCircuit, color: 'text-accent', subTools: ['Resource Demand', 'AI Assistant', 'Market Trends'], capability: 'intel:view' as Capability },
      { id: 'library', title: 'Library', description: 'Resource and trade item repositories', icon: BookOpen, color: 'text-warning', subTools: ['Material Catalog', 'Trade Rates', 'Standard Specs'], capability: 'lib:view' as Capability },
    ]
  },
  {
    title: 'Project',
    description: 'Execution and Planning',
    modules: [
      { id: 'project-setup', title: 'Project Setup', description: 'Checklists and initialization tasks', icon: CheckCircle, color: 'text-primary', subTools: ['Initialization', 'Team Setup', 'Compliance'], capability: 'proj:set_checklists' as Capability },
      { id: 'planning', title: 'Project Planning', description: 'BOQ, scheduling and budget build-up', icon: Calendar, color: 'text-warning', subTools: ['BOQ Builder', 'Schedule', 'Budgeting'], capability: 'plan:view' as Capability },
      { id: 'operations-hub', title: 'Operations Control', description: 'Progress, EVM, Financials & Site Execution', icon: Activity, color: 'text-accent', subTools: ['Site App', 'Earned Value', 'Financial Health'], capability: 'daily:view_project' as Capability },
    ]
  },
  {
    title: 'Support',
    description: 'Contracts and Procurement',
    modules: [
      { id: 'variations', title: 'Contracts', description: 'Variations, EoT claims and subcontractors', icon: FileText, color: 'text-main', subTools: ['Variations', 'EoT Claims', 'Subcon Portal'], capability: 'fin:var_view' as Capability },
      { id: 'procurement', title: 'Procurement', description: 'Purchase orders and material tracking', icon: ShoppingCart, color: 'text-primary', subTools: ['Purchase Orders', 'Inventory', 'Deliveries'], capability: 'proc:view_demand' as Capability },
      { id: 'help', title: 'Support & Docs', description: 'Platform documentation and help center', icon: HelpCircle, color: 'text-dim', subTools: ['User Guide', 'Video Tutorials', 'Support Ticket'] },
    ]
  },
  {
    title: 'Admin',
    description: 'System Management',
    modules: [
      { id: 'users', title: 'User Management', description: 'Team members and role permissions', icon: Users, color: 'text-accent', subTools: ['User List', 'Role Config', 'Access Logs'], capability: 'admin:view_users' as Capability },
      { id: 'approval-config', title: 'Settings', description: 'System config and approval workflows', icon: Settings, color: 'text-dim', subTools: ['Workflows', 'Global Settings', 'Integrations'], capability: 'appr:view_chains' as Capability },
      { id: 'audit', title: 'Audit Logs', description: 'Track system changes and activities', icon: History, color: 'text-ghost', subTools: ['Activity Stream', 'Security Logs', 'Export Data'], capability: 'admin:view_audit' as Capability },
      { id: 'god', title: 'Platform God', description: 'System administrative controls and core config', icon: Zap, color: 'text-danger', subTools: ['Company Control', 'Global Config', 'System Root'], isGodOnly: true },
    ]
  }
];

interface HomeProps {
  onSelectModule: (id: string) => void;
  onLogout: () => void;
  onCreateProject?: () => void;
  isGodMode: boolean;
  userName: string;
  companyName: string;
  userEmail: string;
  userRole: string;
  tenantId: string;
  userId: string;
  projects?: Project[];
  tenant?: Tenant | null;
  counts?: any;
  tenantUsers?: any[];
  setActiveProject?: (id: string) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

interface Task {
  id: string;
  title: string;
  deadline?: string;
  type: 'assignment' | 'reminder';
  completed: boolean;
}

const SUBTOOL_MAPPING: Record<string, string> = {
  'Project Map': 'dashboard',
  'Performance KPIs': 'dashboard',
  'Risk Matrix': 'dashboard',
  'Resource Demand': 'intelligence',
  'AI Assistant': 'intelligence',
  'Market Trends': 'intelligence',
  'Material Catalog': 'library',
  'Trade Rates': 'library',
  'Standard Specs': 'library',
  'Initialization': 'project-setup',
  'Team Setup': 'project-setup',
  'Compliance': 'project-setup',
  'BOQ Builder': 'planning',
  'Schedule': 'schedule',
  'Budgeting': 'budget',
  'Site App': 'field-app',
  'Earned Value': 'operations-hub',
  'Financial Health': 'operations-hub',
  'Variations': 'variations',
  'EoT Claims': 'eot',
  'Subcon Portal': 'subcontractors',
  'Purchase Orders': 'procurement',
  'Inventory': 'warehouse',
  'User List': 'users',
  'Role Config': 'permissions',
  'Access Logs': 'audit',
  'Workflows': 'approval-config',
  'Global Settings': 'approval-config',
  'Integrations': 'approval-config',
  'Activity Stream': 'audit',
  'Security Logs': 'audit',
  'Export Data': 'audit',
  'Company Control': 'god',
  'Global Config': 'god',
  'System Root': 'god'
};

export function Home({ 
  onSelectModule, 
  onLogout, 
  isGodMode, 
  userName, 
  companyName, 
  userEmail, 
  userRole, 
  tenantId, 
  userId,
  projects = [],
  tenant = null,
  counts = {},
  tenantUsers = [],
  setActiveProject,
  theme,
  setTheme
}: HomeProps) {
  const { hasCapability } = usePermissions(userRole as any, tenantId, { 
    id: userId, 
    email: userEmail, 
    role: userRole as any, 
    tenant_id: tenantId
  } as any);
  const [clickCounts, setClickCounts] = useState<Record<string, number>>({});
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [homeSearchQuery, setHomeSearchQuery] = useState('');

  // Filter groups and modules based on capabilities
  const filteredGroups = useMemo(() => {
    return MODULE_GROUPS.map(group => ({
      ...group,
      modules: group.modules.filter(module => {
        if ((module as any).isGodOnly) return isGodMode;
        return !module.capability || hasCapability(module.capability);
      })
    })).filter(group => group.modules.length > 0);
  }, [hasCapability, isGodMode]);

  
  // Tasks & Assignments State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [systemTasks, setSystemTasks] = useState<Task[]>([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');

  const loadSystemTasks = async () => {
    const actions: Task[] = [];
    const today = new Date().toISOString().split('T')[0];

    try {
      if (userRole === 'platform_god') {
        const { count } = await supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('is_active', false);
        if (count) actions.push({ id: 's1', title: `Review ${count} Company Requests`, type: 'assignment', completed: false, system: true, targetModule: 'god' } as any);
      } 
      
      if (userRole === 'tenant_admin' || userRole === 'Company Admin') {
        const { count } = await supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', false);
        if (count) actions.push({ id: 's2', title: `Activate ${count} New Users`, type: 'assignment', completed: false, system: true, targetModule: 'users' } as any);
      }

      if (userRole === 'project_manager' || userRole === 'qs') {
        const { count } = await supabase.from('boq_items').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('recipe_confirmed', false);
        if (count) actions.push({ id: 's3', title: `Confirm recipes for ${count} BOQ items`, type: 'assignment', completed: false, system: true, targetModule: 'planning' } as any);
      }

      if (userRole === 'finance') {
        const { count } = await supabase.from('budget_approvals').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'pending');
        if (count) actions.push({ id: 's4', title: `Approve ${count} budget requests`, type: 'assignment', completed: false, system: true, targetModule: 'approvals' } as any);
      }

      if (userRole === 'procurement') {
        const { count } = await supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'draft');
        if (count) actions.push({ id: 's5', title: `Review ${count} draft POs`, type: 'assignment', completed: false, system: true, targetModule: 'procurement' } as any);
      }

      if (userRole === 'site_supervisor') {
        const { data } = await supabase.from('daily_progress').select('id').eq('tenant_id', tenantId).eq('report_date', today).limit(1);
        if (!data?.length) actions.push({ id: 's6', title: "Submit today's site report", type: 'assignment', completed: false, system: true, targetModule: 'field-app' } as any);
      }
    } catch (e) {
      console.error('Error loading system tasks:', e);
    }

    setSystemTasks(actions);
  };

  useEffect(() => {
    loadSystemTasks();
    const saved = localStorage.getItem('module_click_counts');
    if (saved) {
      setClickCounts(JSON.parse(saved));
    }
    
    const savedTasks = localStorage.getItem('user_tasks');
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    }
  }, []);

  const saveTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    localStorage.setItem('user_tasks', JSON.stringify(newTasks));
  };

  const handleAddTask = () => {
    if (!newTaskTitle) return;
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      title: newTaskTitle,
      deadline: newTaskDeadline,
      type: 'reminder',
      completed: false
    };
    saveTasks([...tasks, newTask]);
    setNewTaskTitle('');
    setNewTaskDeadline('');
    setShowAddTask(false);
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = (id: string) => {
    saveTasks(tasks.filter(t => t.id !== id));
  };

  const handleModuleClick = (id: string) => {
    const updatedCounts = {
      ...clickCounts,
      [id]: (clickCounts[id] || 0) + 1
    };
    setClickCounts(updatedCounts);
    localStorage.setItem('module_click_counts', JSON.stringify(updatedCounts));
    onSelectModule(id);
  };

  const allModules = filteredGroups.flatMap(g => g.modules);
  
  // Get top 3 most frequent modules
  const frequentModules = Object.entries(clickCounts)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([id]) => allModules.find(m => m.id === id))
    .filter(Boolean) as ModuleCard[];

  const unifiedSearchResults = useMemo(() => {
    if (!homeSearchQuery.trim()) return null;
    const q = homeSearchQuery.toLowerCase().trim();

    // 1. Search Modules / Tools (only if they have capability matching)
    const matchedModules = EXPLORER_DATABASE.filter(item => {
      if (item.isGodOnly && !isGodMode) return false;
      if (item.capability && !hasCapability(item.capability)) return false;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.tags.some(t => t.toLowerCase().includes(q))
      );
    });

    // 2. Search Projects & Details (Project names & main details outside BOQ)
    const matchedProjects = (projects || []).filter(p => {
      const matchName = p.name?.toLowerCase().includes(q);
      const matchCode = p.project_code?.toLowerCase().includes(q);
      const matchType = p.project_type?.toLowerCase().includes(q);
      const matchLoc = p.location?.toLowerCase().includes(q);
      const matchNotes = p.notes?.toLowerCase().includes(q);
      const matchStatus = p.status?.toLowerCase().includes(q);
      return matchName || matchCode || matchType || matchLoc || matchNotes || matchStatus;
    });

    // 3. Search Tenant & Company-level values
    let matchedTenantInfo = null;
    if (tenant) {
      const isCompanyMatch = 
        tenant.name?.toLowerCase().includes(q) ||
        tenant.id?.toLowerCase().includes(q) ||
        "company".includes(q) ||
        "tenant".includes(q) ||
        "enterprise".includes(q);
      
      if (isCompanyMatch) {
        matchedTenantInfo = {
          tenant,
          counts: counts || {},
        };
      }
    }

    // 4. Search Users & Team Members (under current user's role access/visibility policy)
    const matchedUsers = (tenantUsers || []).filter(u => {
      return (
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
      );
    });

    // 5. Search User Permissions & Overrides (Self capabilities or details)
    const matchedPermissions = [
      { id: 'role', label: 'My Corporate Role', value: userRole === 'tenant_admin' ? 'Company Master Administrator' : userRole.replace(/_/g, ' '), isMatch: userRole.toLowerCase().includes(q) },
      { id: 'email', label: 'My Registered Email', value: userEmail, isMatch: userEmail.toLowerCase().includes(q) },
      { id: 'name', label: 'My Account Name', value: userName, isMatch: userName.toLowerCase().includes(q) },
      { id: 'tenant', label: 'My Company Workspace', value: companyName, isMatch: companyName.toLowerCase().includes(q) },
      { id: 'cap_boq_view', label: 'BOQ Build Capacity', value: 'boq:view_recipes (Authorized)', isMatch: 'boq'.includes(q) && hasCapability('boq:view_recipes') },
      { id: 'cap_budget_view', label: 'Budget Allocation Access', value: 'fin:view_budget (Authorized)', isMatch: ('budget'.includes(q) || 'finance'.includes(q)) && hasCapability('fin:view_budget') },
      { id: 'cap_permissions_view', label: 'Security Configuration Control', value: 'admin:view_roles (Authorized)', isMatch: ('permissions'.includes(q) || 'security'.includes(q)) && hasCapability('admin:view_roles') },
      { id: 'cap_users_view', label: 'Staff Management Credentials', value: 'admin:view_users (Authorized)', isMatch: ('users'.includes(q) || 'staff'.includes(q)) && hasCapability('admin:view_users') }
    ].filter(item => item.isMatch);

    return {
      modules: matchedModules,
      projects: matchedProjects,
      tenantDetails: matchedTenantInfo,
      users: matchedUsers,
      permissions: matchedPermissions,
      totalCount: matchedModules.length + matchedProjects.length + (matchedTenantInfo ? 1 : 0) + matchedUsers.length + matchedPermissions.length
    };
  }, [homeSearchQuery, isGodMode, hasCapability, projects, tenant, counts, tenantUsers, userRole, userEmail, userName, companyName]);

  const searchedExplorerItems = useMemo(() => {
    return unifiedSearchResults?.modules || [];
  }, [unifiedSearchResults]);

  // Group searched results by category
  const groupedSearchedItems = useMemo(() => {
    const groups: Record<string, SearchItem[]> = {};
    searchedExplorerItems.forEach(item => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });
    return groups;
  }, [searchedExplorerItems]);

  const searchedModules = useMemo(() => {
    if (!homeSearchQuery.trim()) return [];
    const q = homeSearchQuery.toLowerCase();
    return allModules.filter(m => 
      m.title.toLowerCase().includes(q) || 
      m.description.toLowerCase().includes(q) ||
      m.subTools?.some(st => st.toLowerCase().includes(q))
    );
  }, [allModules, homeSearchQuery]);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-surface-base">
      {/* Header */}
      <div className="relative flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-surface-1/30 h-[52px] flex-shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <CeflotLogo className="w-10 h-7" />
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-tighter text-main leading-none">CEFLOT</span>
            <span className="text-[9px] text-primary font-bold uppercase tracking-widest mt-0.5">Platform</span>
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 text-center hidden sm:block">
          <h1 className="text-base font-bold tracking-tight text-main">Welcome, {cleanRichText(userName)}</h1>
          <p className="text-dim text-[10px] uppercase tracking-widest font-medium">
            Managing <span className="text-primary">{cleanRichText(companyName)}</span>
          </p>
        </div>

        <div className="flex items-center gap-6">
          {/* Distinctive, highly visible Dark/Light Toggle with Labels */}
          <div className="flex items-center bg-surface-2/60 border border-border-subtle rounded-xl p-1 gap-1 select-none">
            <button
              onClick={() => setTheme('light')}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] uppercase font-bold tracking-wider transition-all cursor-pointer",
                theme === 'light' 
                  ? "bg-surface-base text-amber-500 shadow-sm border border-border-subtle/45" 
                  : "text-ghost hover:text-dim"
              )}
              title="Switch to light mode"
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span className="opacity-90">Light</span>
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] uppercase font-bold tracking-wider transition-all cursor-pointer",
                theme === 'dark' 
                  ? "bg-surface-base text-primary shadow-sm border border-border-subtle/45" 
                  : "text-ghost hover:text-dim"
              )}
              title="Switch to dark mode"
            >
              <Moon className="w-3.5 h-3.5 text-primary" />
              <span className="opacity-90">Dark</span>
            </button>
          </div>

          <div className="flex items-center gap-4 border-r border-border-subtle pr-6 mr-2">
            <div className="flex flex-col items-end hidden lg:flex select-none">
              <span className="text-xs font-bold text-main">{userName}</span>
              <span className="text-[9px] text-ghost font-mono uppercase tracking-widest mt-0.5">{userRole === 'tenant_admin' ? 'Company Admin' : userRole.replace(/_/g, ' ')}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-[10px] font-bold text-primary overflow-hidden select-none">
                {(userName || userEmail).split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}
            </div>
            <button 
              onClick={onLogout}
              className="p-2 hover:bg-danger/10 rounded-lg text-ghost hover:text-danger transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-6 hidden sm:flex">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] text-ghost font-mono uppercase tracking-widest">Live</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] text-ghost font-mono uppercase tracking-widest">Sync</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 relative">
        {/* Widen Vertical Frequent Tools - Hidden on Mobile/Portrait */}
        <div className="hidden lg:flex w-52 lg:w-56 flex-col py-3 border-r border-border-subtle bg-surface-1/40 backdrop-blur-sm relative z-[1000]">
          
          {/* Quick Search Tool */}
          <div className="px-3 mb-4">
            <div className="relative flex items-center bg-surface-base border border-border-subtle hover:border-primary focus-within:border-primary rounded-xl transition-all">
              <Search className="w-3.5 h-3.5 text-ghost absolute left-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search tools..."
                value={homeSearchQuery}
                onChange={(e) => setHomeSearchQuery(e.target.value)}
                className="w-full bg-transparent pl-9 pr-8 py-2 text-xs font-semibold outline-none text-main placeholder:text-ghost/60"
              />
              {homeSearchQuery && (
                <button 
                  onClick={() => setHomeSearchQuery('')} 
                  className="absolute right-2.5 p-1 text-ghost hover:text-main focus:outline-none"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {homeSearchQuery.trim() ? (
            <>
              <div className="flex items-center gap-2 px-4 mb-2.5 pb-1 select-none">
                <Search className="w-3 h-3 text-primary animate-pulse" />
                <h2 className="text-[9px] font-black text-ghost uppercase tracking-[0.2em] opacity-60">Search Results</h2>
              </div>
              <div className="flex flex-col gap-1.5 px-3 mb-6 overflow-y-auto custom-scrollbar max-h-[220px]">
                {searchedModules.length > 0 ? (
                  searchedModules.map((module) => (
                    <button
                      key={`search-${module.id}`}
                      onClick={() => handleModuleClick(module.id)}
                      className="group flex items-center gap-3 bg-surface-2/40 border border-border-subtle rounded-xl p-2.5 text-left hover:border-primary hover:bg-primary/5 transition-all duration-300"
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-lg bg-surface-base border border-border-subtle flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:bg-primary/10",
                        module.color
                      )}>
                        <module.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs font-bold text-main truncate group-hover:text-primary transition-colors">{module.title}</h3>
                        <p className="text-[10px] text-dim truncate leading-tight">{module.description}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-6 text-center border border-dashed border-border-subtle rounded-xl">
                    <p className="text-[11px] text-ghost">No matching tools found</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 px-4 mb-2.5 select-none">
                <Clock className="w-3 h-3 text-primary" />
                <h2 className="text-[9px] font-black text-ghost uppercase tracking-[0.2em] opacity-60">Frequent</h2>
              </div>
              <div className="flex flex-col gap-1.5 px-3 mb-6 overflow-y-auto custom-scrollbar max-h-[220px]">
                {frequentModules.length > 0 ? (
                  frequentModules.map((module) => (
                    <button
                      key={`frequent-${module.id}`}
                      onClick={() => handleModuleClick(module.id)}
                      className="group flex items-center gap-3 bg-surface-2/40 border border-border-subtle rounded-xl p-2.5 text-left hover:border-primary hover:bg-primary/5 transition-all duration-300"
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-lg bg-surface-base border border-border-subtle flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:bg-primary/10",
                        module.color
                      )}>
                        <module.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs font-bold text-main truncate group-hover:text-primary transition-colors">{module.title}</h3>
                        <p className="text-[10px] text-dim truncate leading-tight">{module.description}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-6 text-center border border-dashed border-border-subtle rounded-xl">
                    <p className="text-[11px] text-ghost">Most used tools appear here</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Tasks & Assignments Viewport */}
          <div className="flex flex-col flex-1 min-h-0 relative">
            <div className="flex items-center justify-between px-4 mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-accent" />
                <h2 className="text-[10px] font-black text-main uppercase tracking-widest">Tasks</h2>
              </div>
              <button 
                onClick={() => setShowAddTask(true)}
                className="p-1 hover:bg-surface-3 rounded-md text-accent transition-colors"
                title="Add Reminder"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <AnimatePresence>
              {showAddTask && (
                <motion.div
                  initial={{ scale: 0.96, opacity: 0, y: -5 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.96, opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  id="add-task-dialog-card"
                  className="absolute top-[28px] left-[12px] z-[9999] w-[350px] bg-surface-1 border border-border-muted rounded-2xl shadow-2xl flex flex-col p-5"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-border-subtle mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                        <Activity className="w-3 h-3" />
                      </div>
                      <h3 className="text-[10px] font-black text-main uppercase tracking-widest">New Task Reminder</h3>
                    </div>
                    <button 
                      onClick={() => setShowAddTask(false)} 
                      className="p-1 rounded-md hover:bg-surface-3 text-ghost hover:text-main transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-dim uppercase tracking-wider block">What needs to be done?</label>
                      <input 
                        autoFocus
                        type="text"
                        placeholder="e.g. Verify subcontractor compliance"
                        className="w-full bg-surface-base border border-border-subtle focus:border-accent hover:border-accent/65 rounded-xl px-3 py-2 text-xs text-main outline-none focus:ring-4 focus:ring-accent/10 transition-all font-semibold animate-in fade-in duration-300"
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-dim uppercase tracking-wider block">Target Deadline</label>
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-surface-2 border border-border-subtle flex items-center justify-center text-ghost">
                          <Calendar className="w-4 h-4 text-accent" />
                        </div>
                        <input 
                          type="date"
                          className="flex-1 bg-surface-base border border-border-subtle focus:border-accent hover:border-accent/65 rounded-xl px-3 py-2 text-xs text-main outline-none focus:ring-4 focus:ring-accent/10 transition-all font-mono font-semibold"
                          value={newTaskDeadline}
                          onChange={e => setNewTaskDeadline(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2.5 mt-5 pt-3 border-t border-border-subtle/60">
                    <button 
                      onClick={() => setShowAddTask(false)}
                      className="px-4 py-2 text-[10px] font-bold text-dim hover:text-main transition-colors uppercase tracking-wider"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleAddTask}
                      className="bg-accent text-black px-5 py-2 rounded-xl text-[10px] font-black hover:brightness-110 active:scale-[0.98] transition-all border border-accent shadow-[0_4px_15px_rgba(26,172,170,0.22)] uppercase tracking-widest"
                    >
                      Create
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col gap-2 px-3 overflow-y-auto custom-scrollbar flex-1 pb-4">
              {/* Assignments Section */}
              {systemTasks.map(assignment => (
                <button 
                  key={assignment.id} 
                  onClick={() => (assignment as any).targetModule && handleModuleClick((assignment as any).targetModule)}
                  className="w-full text-left flex items-start gap-3 bg-surface-2/60 border border-border-subtle rounded-xl p-3.5 border-l-4 border-l-accent shadow-sm hover:border-l-primary hover:bg-surface-2 transition-all group"
                >
                  <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-accent group-hover:text-primary transition-colors">
                      <path d="M12 2L4 6.5L12 11L20 6.5L12 2Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4 10L12 14.5L20 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-main leading-snug group-hover:text-primary transition-colors">{assignment.title}</div>
                    <div className="text-[10px] font-black text-accent uppercase tracking-tighter mt-1.5 flex items-center gap-1">
                       <RefreshCw className="w-2.5 h-2.5 animate-spin-slow" />
                       Action Required
                    </div>
                  </div>
                </button>
              ))}

              {/* Reminders Section */}
              {tasks.map(task => (
                <div key={task.id} className={cn(
                  "flex items-start gap-3 bg-surface-2/30 border border-border-subtle rounded-xl p-3 transition-all group",
                  task.completed && "opacity-50"
                )}>
                  <button 
                    onClick={() => toggleTask(task.id)}
                    className={cn(
                      "w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
                      task.completed ? "bg-primary border-primary" : "border-ghost hover:border-primary"
                    )}
                  >
                    {task.completed && <CheckCircle className="w-3 h-3 text-surface-bg-alt" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "text-[11px] font-medium text-main leading-tight",
                      task.completed && "line-through text-dim"
                    )}>
                      {task.title}
                    </div>
                    {task.deadline && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Calendar className="w-3 h-3 text-warning" />
                        <span className="text-[9px] text-warning font-mono">{task.deadline}</span>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => deleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-danger hover:bg-danger/10 rounded-lg transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 rotate-45" />
                  </button>
                </div>
              ))}

              {tasks.length === 0 && systemTasks.length === 0 && (
                <div className="py-10 text-center border border-dashed border-border-subtle rounded-2xl">
                  <p className="text-[11px] text-ghost font-medium">No pending assignments</p>
                </div>
              )}
            </div>
          </div>


          {/* User Profile Footer in Home Sidebar */}
          <div className="p-4 border-t border-border-subtle flex-shrink-0">
            <div 
              onClick={() => handleModuleClick('profile')}
              className="flex items-center gap-3 p-2 rounded-xl bg-surface-2/50 border border-border-subtle hover:border-primary transition-all group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-black text-primary flex-shrink-0 overflow-hidden shadow-sm">
                {(userName || userEmail).split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate text-main group-hover:text-primary transition-colors">{cleanRichText(userName || userEmail)}</div>
                <div className="font-mono text-[10px] text-ghost uppercase tracking-widest mt-0.5">{userRole === 'tenant_admin' ? 'Company Admin' : userRole.replace(/_/g, ' ')}</div>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onLogout();
                }}
                className="w-8 h-8 rounded-lg border border-border-subtle flex items-center justify-center flex-shrink-0 hover:bg-danger/10 transition-all group/logout"
                title="Sign out"
              >
                <LogOut className="w-4 h-4 text-ghost group-hover/logout:text-danger" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area - Single Page Layout */}
        <div className="flex-1 p-2 lg:p-6 flex flex-col overflow-hidden bg-surface-base relative">
          {/* Logo Watermark Background Overlay */}
          <div className="absolute inset-0 logo-pattern-bg pointer-events-none opacity-50 z-0" />

          {/* Mobile Tasks Trigger - Only on Portrait/Small screens */}
          <div className="lg:hidden flex items-center justify-between mb-4 relative z-10 px-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-accent" />
              <div className="flex flex-col">
                <span className="text-xs font-black text-main uppercase tracking-widest leading-none">ACTIVE TASKS</span>
                <span className="text-[10px] text-ghost font-bold mt-0.5">{systemTasks.length + tasks.filter(t => !t.completed).length} pending actions</span>
              </div>
            </div>
            <button 
              onClick={() => setShowAddTask(true)}
              className="p-3 bg-accent text-white rounded-2xl shadow-lg shadow-accent/20 active:scale-95 transition-all"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 w-full mx-auto flex flex-col gap-3.5 lg:gap-5 xl:gap-6 justify-start py-1.5 overflow-y-auto custom-scrollbar relative z-10">
            {homeSearchQuery.trim() && unifiedSearchResults ? (
              /* Highly detailed search board filtered on-the-fly as per permissions */
              <div className="flex-1 flex flex-col gap-6 pb-12">
                <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                  <div>
                    <h3 className="text-sm font-black text-main uppercase tracking-widest">
                      Platform Intelligence Search Results
                    </h3>
                    <p className="text-[10px] text-dim font-medium mt-1">
                      Query matches across system tools, commercial projects, enterprise directories, and permission clearances for <span className="text-primary font-bold uppercase">{userRole.replace(/_/g, ' ')}</span>
                    </p>
                  </div>
                  <button 
                    onClick={() => setHomeSearchQuery('')}
                    className="text-[10px] font-black text-primary hover:text-primary/75 uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/20"
                  >
                    <X className="w-3 h-3" />
                    Reset Search
                  </button>
                </div>

                {unifiedSearchResults.totalCount > 0 ? (
                  <div className="flex flex-col gap-8">
                    
                    {/* 1. Modules & Systems Matches */}
                    {unifiedSearchResults.modules.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 select-none border-l-2 border-primary pl-2.5">
                          <span className="text-[10px] font-black tracking-widest text-main uppercase">
                            ⚙️ Integrated Systems & Tools ({unifiedSearchResults.modules.length})
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                          {unifiedSearchResults.modules.map((item, idx) => {
                            const m = allModules.find(mod => mod.id === item.id);
                            const mColor = m?.color || 'text-primary';
                            const IconComponent = m?.icon || Search;
                            return (
                              <motion.div
                                key={`mod-${item.id}-${idx}`}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                onClick={() => handleModuleClick(item.id)}
                                className="group relative flex flex-col bg-surface-1 border border-border-subtle hover:border-primary hover:bg-surface-2/40 rounded-xl p-3.5 text-left transition-all duration-300 hover:shadow-md cursor-pointer h-full min-h-[120px] shadow-sm select-none"
                              >
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-8.5 h-8.5 rounded-lg bg-surface-base border border-border-subtle flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-surface-base transition-all duration-300 shadow-sm",
                                    mColor
                                  )}>
                                    <IconComponent className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[8px] font-black tracking-[0.16em] text-ghost uppercase block mb-0.5 leading-none">
                                      {item.category}
                                    </span>
                                    <h3 className="text-xs font-bold text-main group-hover:text-primary transition-colors truncate">
                                      {item.title}
                                    </h3>
                                  </div>
                                </div>
                                <p className="text-[11px] text-dim leading-relaxed mt-2.5 mb-2 flex-1">
                                  {item.description}
                                </p>
                                <div className="flex items-center justify-between border-t border-border-subtle/30 pt-2.5 mt-auto">
                                  <span className="text-[8px] font-mono text-ghost bg-surface-base border border-border-subtle px-1.5 py-0.5 rounded uppercase font-bold tracking-wider leading-none">
                                    Authorized
                                  </span>
                                  <span className="text-[9px] font-black text-primary uppercase tracking-[0.15em] opacity-0 group-hover:opacity-100 transition-all duration-300">
                                    Launch Tool ↗
                                  </span>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 2. Projects Matches (Search Project name and details outside BOQ) */}
                    {unifiedSearchResults.projects.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 select-none border-l-2 border-accent pl-2.5">
                          <span className="text-[10px] font-black tracking-widest text-main uppercase">
                            🏗️ Project Portfolio & Active Contracts ({unifiedSearchResults.projects.length})
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                          {unifiedSearchResults.projects.map((p, idx) => {
                            return (
                              <motion.div
                                key={`proj-search-${p.id}`}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.04 }}
                                onClick={() => {
                                  if (setActiveProject) {
                                    setActiveProject(p.id);
                                    handleModuleClick('dashboard'); // Switch views automatically to dashboard when selected
                                  }
                                }}
                                className="group relative flex flex-col bg-surface-1 border border-border-subtle hover:border-accent hover:bg-surface-2/40 rounded-xl p-4 text-left transition-all duration-300 hover:shadow-md cursor-pointer shadow-sm select-none"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-[8px] font-mono font-bold text-accent bg-accent/5 border border-accent/20 px-1.5 py-0.5 rounded-md uppercase tracking-wide self-start mb-1.5">
                                      {p.project_code || 'UNTITLED CODE'}
                                    </span>
                                    <h3 className="text-xs font-bold text-main group-hover:text-accent transition-colors truncate">
                                      {p.name}
                                    </h3>
                                  </div>
                                  <span className={cn(
                                    "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border leading-none shrink-0",
                                    p.status === 'active' ? "bg-primary/10 border-primary/20 text-primary" : "bg-ghost/10 border-border-subtle text-ghost"
                                  )}>
                                    {p.status.replace(/_/g, ' ')}
                                  </span>
                                </div>

                                <div className="space-y-1.5 text-[11px] text-dim flex-1 my-2">
                                  <div className="flex items-center gap-1.5">
                                    <Globe className="w-3.5 h-3.5 text-ghost shrink-0" />
                                    <span className="truncate">{p.location || 'No Location Logged'}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-ghost shrink-0" />
                                    <span>{p.start_date || 'N/A'} — {p.end_date || 'N/A'}</span>
                                  </div>
                                  {p.contract_value !== null && (
                                    <div className="flex items-center gap-1.5 font-semibold text-main">
                                      <DollarSign className="w-3.5 h-3.5 text-primary shrink-0" />
                                      <span>Contract Baseline Value: ${p.contract_value.toLocaleString()}</span>
                                    </div>
                                  )}
                                  {p.notes && (
                                    <p className="text-[10px] text-ghost/80 italic mt-2 border-t border-border-subtle/30 pt-1.5 line-clamp-2">
                                      "{p.notes}"
                                    </p>
                                  )}
                                </div>

                                <div className="border-t border-border-subtle/30 pt-2.5 mt-auto flex items-center justify-between text-[10px]">
                                  <span className="text-accent font-bold group-hover:underline">
                                    Select active project context
                                  </span>
                                  <span className="text-accent opacity-0 group-hover:opacity-100 transition-all">
                                    Open Portfolio ↗
                                  </span>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 3. Company & Tenant Matches */}
                    {unifiedSearchResults.tenantDetails && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 select-none border-l-2 border-warning pl-2.5">
                          <span className="text-[10px] font-black tracking-widest text-main uppercase">
                            🏢 Enterprise Tenant & Company Workspace (1)
                          </span>
                        </div>
                        <motion.div
                          initial={{ opacity: 0, scale: 0.99 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="bg-surface-1 border border-border-subtle rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
                              <Building2 className="w-6 h-6" />
                            </div>
                            <div>
                              <h3 className="text-sm font-black text-main">{unifiedSearchResults.tenantDetails.tenant.name}</h3>
                              <p className="text-[10px] text-ghost font-mono uppercase tracking-wider mt-0.5">
                                ID: {unifiedSearchResults.tenantDetails.tenant.id} • Active Commercial Subscription
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-surface-base border border-border-subtle/50 px-4 py-2.5 rounded-xl text-center min-w-full md:min-w-[400px]">
                            <div>
                              <div className="text-xs font-black text-main">{counts.projects || 0}</div>
                              <span className="text-[8px] text-ghost font-mono uppercase tracking-widest select-none">Projects</span>
                            </div>
                            <div className="border-l border-border-subtle/60 pl-2">
                              <div className="text-xs font-black text-main">{counts.users || 0}</div>
                              <span className="text-[8px] text-ghost font-mono uppercase tracking-widest select-none">Staff Users</span>
                            </div>
                            <div className="border-l border-border-subtle/60 pl-2">
                              <div className="text-xs font-black text-main">{counts.resources_global + counts.resources_company || 0}</div>
                              <span className="text-[8px] text-ghost font-mono uppercase tracking-widest select-none">Materials</span>
                            </div>
                            <div className="border-l border-border-subtle/60 pl-2">
                              <div className="text-xs font-black text-main">{counts.trades_global + counts.trades_company || 0}</div>
                              <span className="text-[8px] text-ghost font-mono uppercase tracking-widest select-none">Trade Rates</span>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    )}

                    {/* 4. Users / Teammate Matches */}
                    {unifiedSearchResults.users.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 select-none border-l-2 border-ghost pl-2.5">
                          <span className="text-[10px] font-black tracking-widest text-main uppercase">
                            👥 Teammates & Enterprise Directory ({unifiedSearchResults.users.length})
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {unifiedSearchResults.users.map((u, idx) => (
                            <motion.div
                              key={`user-match-${u.id}`}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.03 }}
                              className="bg-surface-1 border border-border-subtle rounded-xl p-3 flex items-center justify-between gap-3 shadow-xs"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-black text-primary shrink-0 uppercase">
                                  {u.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || u.email[0]}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-main truncate leading-tight">{u.full_name || 'Pending User Setup'}</h4>
                                  <p className="text-[10px] text-ghost truncate font-mono mt-0.5">{u.email}</p>
                                </div>
                              </div>
                              <span className="text-[9px] font-mono border border-border-subtle/40 bg-surface-base px-2 py-0.5 rounded-lg text-ghost uppercase shrink-0">
                                {u.role === 'tenant_admin' ? 'Company Admin' : u.role?.replace(/_/g, ' ')}
                              </span>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 5. Personal Clearances & Security Overrides Matches */}
                    {unifiedSearchResults.permissions.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 select-none border-l-2 border-red-500 pl-2.5">
                          <span className="text-[10px] font-black tracking-widest text-main uppercase">
                            🛡️ Clearances, Security Tokens & Access Policies ({unifiedSearchResults.permissions.length})
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {unifiedSearchResults.permissions.map((p, idx) => (
                            <motion.div
                              key={`perm-${p.id}`}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-surface-1 border border-border-subtle/80 rounded-xl p-3 flex flex-col justify-between shadow-xs border-dashed"
                            >
                              <span className="text-[9px] font-black tracking-wide text-dim uppercase">{p.label}</span>
                              <div className="text-[11px] font-mono font-bold text-main mt-1 pt-1 border-t border-border-subtle/30">
                                {p.value}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-14 h-14 bg-surface-2 rounded-2xl flex items-center justify-center border border-dashed border-border-subtle text-dim mb-4 animate-pulse">
                      <Search className="w-5 h-5 text-ghost" />
                    </div>
                    <h4 className="text-sm font-bold text-main">No database matches found</h4>
                    <p className="text-xs text-ghost max-w-sm mt-1 px-4 leading-normal">
                      We couldn't match any system tools, commercial projects, staff directories, or clearance tags matching <span className="text-primary font-bold">"{homeSearchQuery}"</span>.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Regular dashboard module groups list with enriched sizing for big screens */
              filteredGroups.map((group, groupIdx) => {
                const isProminent = group.title === 'Project' || group.title === 'Support';
                const isDashboard = group.title === 'Dashboard';
                const isAdmin = group.title === 'Admin';
                
                return (
                  <motion.div 
                    key={group.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: groupIdx * 0.08 }}
                    className={cn(
                      "flex flex-col min-h-fit shrink-0 transition-all duration-500",
                      isProminent ? "mb-1.5 lg:mb-2 xl:mb-3" : "mb-1 lg:mb-1.5 xl:mb-2"
                    )}
                  >
                    <div className={cn("flex items-center gap-3 mb-1.5 px-1", isAdmin && "h-[15.5104px]")}>
                      <h2 className="text-[9px] lg:text-[10px] xl:text-[11px] font-black text-dim uppercase tracking-[0.25em] whitespace-nowrap opacity-60">
                        {group.title}
                      </h2>
                      <div className="h-px flex-1 bg-gradient-to-r from-border-subtle to-transparent" />
                    </div>

                    <div className={cn(
                      "flex flex-col rounded-xl",
                      (isDashboard || isAdmin) && "bg-surface-1/5 p-2 lg:p-3.5 border border-border-subtle/10 shadow-sm"
                    )}>
                      <div className={cn(
                        "grid gap-2 lg:gap-3 xl:gap-4 w-full",
                        isProminent 
                          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" 
                          : (isDashboard || isAdmin)
                            ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
                            : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                      )}>
                        {group.modules.map((module, moduleIdx) => (
                        <motion.div
                          key={module.id}
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: (groupIdx * 0.08) + (moduleIdx * 0.04) }}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleModuleClick(module.id)}
                          onKeyDown={(e) => {
                             if (e.key === 'Enter' || e.key === ' ') {
                               e.preventDefault();
                               handleModuleClick(module.id);
                             }
                          }}
                          onMouseEnter={() => setHoveredModule(module.id)}
                          onMouseLeave={() => setHoveredModule(null)}
                          className={cn(
                            "group relative flex flex-col bg-surface-1 border border-border-subtle rounded-xl p-2.5 lg:p-3 xl:p-4 text-left transition-all duration-300 hover:shadow-xl overflow-hidden w-full cursor-pointer",
                            isProminent 
                              ? "hover:border-primary hover:bg-surface-2 h-[155px] lg:h-[180px] xl:h-[200px] hover:shadow-primary/5 shadow-sm" 
                              : cn(
                                "hover:border-accent hover:bg-surface-2 h-full min-h-[50px] lg:min-h-[58px] xl:min-h-[66px] border-dashed hover:shadow-accent/5 focus:outline-none focus:ring-1 focus:ring-accent/50",
                                module.id === 'god' && "hover:border-danger hover:shadow-danger/5 shadow-sm border-solid focus:ring-danger/50"
                              )
                          )}
                        >
                          {/* Three-dot context menu */}
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              className="p-1 hover:bg-surface-3 rounded-md text-ghost hover:text-main transition-colors"
                            >
                              <MoreHorizontal className="w-2.5 h-2.5" />
                            </button>
                          </div>

                          <div className={cn(
                            "flex items-center gap-2 lg:gap-3",
                            isProminent ? "mb-1" : "mb-0"
                          )}>
                            <div className={cn(
                              "rounded-lg bg-surface-base border border-border-subtle flex items-center justify-center transition-all duration-300 group-hover:scale-105 shadow-sm flex-shrink-0",
                              isProminent ? "w-11 h-9.5 lg:w-[46px] lg:h-[40px] xl:w-[50px] xl:h-[44px]" : "w-7 h-7 lg:w-8 h-8 xl:w-9 h-9",
                              isProminent ? "group-hover:bg-primary group-hover:text-surface-base" : cn(
                                "group-hover:bg-accent group-hover:text-surface-base",
                                module.id === 'god' && "group-hover:bg-danger text-danger group-hover:text-surface-base"
                              ),
                              module.color
                            )}>
                              <module.icon className={isProminent ? "w-5 h-5 lg:w-[22px] lg:h-[22px] xl:w-[24px] xl:h-[24px]" : "w-4 h-4"} />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <h3 className={cn(
                                "font-black text-main transition-colors tracking-tight truncate leading-none",
                                isProminent 
                                  ? "text-sm lg:text-base xl:text-lg group-hover:text-primary" 
                                  : cn("text-xs lg:text-sm group-hover:text-accent", module.id === 'god' && "group-hover:text-danger")
                              )}>
                                {module.title}
                              </h3>
                              {!isProminent && (
                                <p className="text-[7.5px] lg:text-[8px] text-dim truncate opacity-70 mt-0.5">{module.description}</p>
                              )}
                            </div>
                          </div>
                          
                          {isProminent && (
                            <div className="relative flex-1 mt-2.5 min-h-[50px] lg:min-h-[58px] xl:min-h-[66px] px-0.5">
                              <p 
                                className={cn(
                                  "text-[10px] lg:text-[11px] xl:text-[11.5px] text-dim leading-relaxed transition-all duration-300 w-full",
                                  "lg:absolute lg:inset-x-0 lg:top-0 line-clamp-3",
                                  hoveredModule === module.id ? "lg:opacity-0 lg:-translate-y-2 lg:pointer-events-none" : "opacity-80 translate-y-0"
                                )}
                              >
                                {module.description}
                              </p>
                              <div className={cn(
                                "grid grid-cols-3 gap-1 lg:gap-1.5 transition-all duration-500 mt-2 lg:mt-0",
                                "lg:absolute lg:inset-0",
                                hoveredModule === module.id ? "opacity-100 translate-y-0" : "lg:opacity-0 lg:translate-y-2 lg:pointer-events-none"
                              )}>
                                {module.subTools?.slice(0, 3).map((tool, i) => (
                                  <button 
                                    key={i}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const targetId = SUBTOOL_MAPPING[tool] || module.id;
                                      handleModuleClick(targetId);
                                    }}
                                    className={cn(
                                      "flex items-center justify-center text-[9px] lg:text-[10px] xl:text-[11px] font-black px-1 py-1.5 h-8.5 lg:h-9 rounded-lg border border-primary/20 bg-primary/5 text-primary uppercase tracking-wider hover:bg-primary hover:text-white transition-all cursor-pointer z-10 shadow-sm text-center self-center",
                                      "hover:scale-[1.03] active:scale-[0.97]"
                                    )}
                                  >
                                    <span className="line-clamp-2 leading-tight">{tool}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {isProminent && (
                            <div className="mt-auto pt-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0 border-t border-border-subtle/10">
                              <span className="text-[7.5px] font-black text-primary uppercase tracking-[0.2em]">Open Module</span>
                              <ChevronRight className="w-2.5 h-2.5 text-primary" />
                            </div>
                          )}
                        </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}

            {/* Live Cockpit Insights Footer - Condense to premium two lines to free up space for taller cards */}
            {!homeSearchQuery.trim() && (
              <div className="mt-2 text-[10px] border border-border-subtle/60 bg-gradient-to-r from-surface-1/40 to-surface-2/15 px-4 py-1.5 rounded-xl relative overflow-hidden flex-shrink-0 animate-in fade-in slide-in-from-bottom-2 duration-500 leading-normal">
                <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-[0.05] pointer-events-none">
                  <Globe className="w-12 h-12 text-primary animate-pulse" />
                </div>
                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-0.5 text-dim">
                  <span className="flex items-center gap-1.5 font-bold text-main uppercase tracking-widest text-[9px]">
                    <Activity className="w-3 h-3 text-primary animate-pulse" />
                    Operational Cockpit:
                  </span>
                  <span className="flex items-center gap-1 text-main font-semibold">
                    <ShieldCheck className="w-3 h-3 text-primary" /> Active Workspace ({cleanRichText(companyName)})
                  </span>
                  <span className="text-border-subtle">|</span>
                  <span className="flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-accent" /> V2 Real-time Sync Active
                  </span>
                  <span className="text-border-subtle">|</span>
                  <span className="flex items-center gap-1">
                    <Globe className="w-3 h-3 text-warning" /> Nairobi KE Regional Node
                  </span>
                  <span className="ml-auto font-mono text-[8px] uppercase text-ghost tracking-widest">Integrity: 100%</span>
                </div>
                <div className="text-[10px] text-ghost/75 mt-1 font-medium leading-normal flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-primary/60 animate-ping" />
                  Telemetry mapping validated. Daily Logs, Planning, Procurement, and Subcontractor status records are fully synchronized under secure compliance.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
