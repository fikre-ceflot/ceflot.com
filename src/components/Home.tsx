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
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, cleanRichText } from '../lib/utils';
import { CeflotLogo } from './Logo';
import { supabase } from '../lib/supabase';

import { usePermissions, Capability } from '../hooks/usePermissions';

interface ModuleCard {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  capability?: Capability;
  subTools?: string[];
}

const MODULE_GROUPS = [
  {
    title: 'Dashboard',
    description: 'Analytics and Repositories',
    modules: [
      { id: 'dashboard', title: 'Portfolio', description: 'Global overview for all projects', icon: LayoutGrid, color: 'text-primary', subTools: ['Project Map', 'Performance KPIs', 'Risk Matrix'], capability: 'dash:view' as Capability },
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
      { id: 'god', title: 'Platform God', description: 'System administrative controls and core config', icon: Zap, color: 'text-danger', subTools: ['Tenant Control', 'Global Config', 'System Root'], isGodOnly: true },
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
  'Tenant Control': 'god',
  'Global Config': 'god',
  'System Root': 'god'
};

export function Home({ onSelectModule, onLogout, isGodMode, userName, companyName, userEmail, userRole, tenantId }: HomeProps) {
  const { hasCapability } = usePermissions(userRole as any, tenantId, { 
    id: '', 
    email: userEmail, 
    role: userRole as any, 
    tenant_id: tenantId
  } as any);
  const [clickCounts, setClickCounts] = useState<Record<string, number>>({});
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);

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
        if (count) actions.push({ id: 's1', title: `Review ${count} Tenant Requests`, type: 'assignment', completed: false, system: true, targetModule: 'god' } as any);
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
          <div className="flex items-center gap-4 border-r border-border-subtle pr-6 mr-2">
            <div className="flex flex-col items-end hidden lg:flex">
              <span className="text-xs font-bold text-main">{userName}</span>
              <span className="text-[10px] text-ghost font-mono uppercase tracking-widest">{userRole.replace(/_/g, ' ')}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-[10px] font-bold text-primary overflow-hidden">
                {(userName || userEmail).split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}
            </div>
            <button 
              onClick={onLogout}
              className="p-2 hover:bg-danger/10 rounded-lg text-ghost hover:text-danger transition-all"
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
        <div className="hidden lg:flex w-52 lg:w-56 flex-col py-3 border-r border-border-subtle bg-surface-1/40 backdrop-blur-sm">
          <div className="flex items-center gap-2 px-4 mb-2.5">
            <Clock className="w-3 h-3 text-primary" />
            <h2 className="text-[9px] font-black text-ghost uppercase tracking-[0.2em] opacity-60">Frequent</h2>
          </div>
          <div className="flex flex-col gap-2 px-3 mb-6 overflow-y-auto custom-scrollbar max-h-[220px]">
            {frequentModules.length > 0 ? (
              frequentModules.map((module) => (
                <button
                  key={`frequent-${module.id}`}
                  onClick={() => handleModuleClick(module.id)}
                  className="group flex items-center gap-3 bg-surface-2/40 border border-border-subtle rounded-xl p-3 text-left hover:border-primary hover:bg-primary/5 transition-all duration-300"
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl bg-surface-base border border-border-subtle flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:bg-primary/10",
                    module.color
                  )}>
                    <module.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-main truncate group-hover:text-primary transition-colors">{module.title}</h3>
                    <p className="text-[11px] text-dim truncate leading-tight">{module.description}</p>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-6 text-center border border-dashed border-border-subtle rounded-xl">
                <p className="text-[11px] text-ghost">Most used tools appear here</p>
              </div>
            )}
          </div>

          {/* Tasks & Assignments Viewport */}
          <div className="flex flex-col flex-1 min-h-0">
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

          {/* Add Task Modal overlay (simple inline for now) */}
          {showAddTask && (
            <div className="absolute inset-x-0 bottom-[84px] mx-4 p-5 bg-surface-2 border border-accent/50 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex flex-col gap-4">
                <h3 className="text-[11px] font-black text-main uppercase tracking-widest">New Reminder</h3>
                <input 
                  autoFocus
                  type="text"
                  placeholder="What needs to be done?"
                  className="w-full bg-surface-base border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-main outline-none focus:border-accent transition-all"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-surface-base border border-border-subtle flex items-center justify-center text-dim">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <input 
                    type="date"
                    className="flex-1 bg-surface-base border border-border-subtle rounded-xl px-4 py-2 text-xs text-main outline-none focus:border-accent"
                    value={newTaskDeadline}
                    onChange={e => setNewTaskDeadline(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-3 mt-2">
                  <button 
                    onClick={() => setShowAddTask(false)}
                    className="btn btn-ghost btn-sm px-4"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddTask}
                    className="btn btn-accent btn-sm px-6"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}

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
                <div className="font-mono text-[10px] text-ghost uppercase tracking-widest mt-0.5">{userRole.replace(/_/g, ' ')}</div>
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

          <div className="flex-1 w-full mx-auto flex flex-col gap-4 lg:gap-8 justify-start py-2 overflow-y-auto custom-scrollbar relative z-10">
            {filteredGroups.map((group, groupIdx) => {
              const isProminent = group.title === 'Project' || group.title === 'Support';
              const isDashboard = group.title === 'Dashboard';
              const isAdmin = group.title === 'Admin';
              
              return (
                <motion.div 
                  key={group.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: groupIdx * 0.1 }}
                  className={cn(
                    "flex flex-col min-h-fit shrink-0 transition-all duration-500",
                    isProminent ? "mb-6 lg:mb-8" : "mb-4 lg:mb-6"
                  )}
                >
                  <div className={cn("flex items-center gap-3 mb-2 lg:mb-3 px-1", isAdmin && "h-[15.5104px]")}>
                    <h2 className="text-[10px] lg:text-[11px] font-black text-dim uppercase tracking-[0.25em] whitespace-nowrap opacity-60">
                      {group.title}
                    </h2>
                    <div className="h-px flex-1 bg-gradient-to-r from-border-subtle to-transparent" />
                  </div>

                  <div className={cn(
                    "flex flex-col rounded-xl",
                    (isDashboard || isAdmin) && "bg-surface-1/5 p-3 lg:p-4 border border-border-subtle/10 shadow-sm"
                  )}>
                    <div className={cn(
                      "grid gap-2 lg:gap-3 w-full",
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
                        transition={{ delay: (groupIdx * 0.1) + (moduleIdx * 0.05) }}
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
                          "group relative flex flex-col bg-surface-1 border border-border-subtle rounded-xl p-2.5 text-left transition-all duration-300 hover:shadow-xl overflow-hidden w-full cursor-pointer",
                          isProminent 
                            ? "hover:border-primary hover:bg-surface-2 h-[170px] hover:shadow-primary/5 shadow-sm" 
                            : cn(
                              "hover:border-accent hover:bg-surface-2 h-full min-h-[55px] lg:min-h-[65px] border-dashed hover:shadow-accent/5 focus:outline-none focus:ring-1 focus:ring-accent/50",
                              module.id === 'god' && "hover:border-danger hover:shadow-danger/5 shadow-sm border-solid focus:ring-danger/50"
                            )
                        )}
                      >
                        {/* Three-dot context menu */}
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              // Placeholder for Move Order / Display logic
                            }}
                            className="p-1 hover:bg-surface-3 rounded-md text-ghost hover:text-main transition-colors"
                          >
                            <MoreHorizontal className="w-2.5 h-2.5" />
                          </button>
                        </div>

                        <div className={cn(
                          "flex items-center gap-2",
                          isProminent ? "mb-1" : "mb-0"
                        )}>
                          <div className={cn(
                            "rounded-lg bg-surface-base border border-border-subtle flex items-center justify-center transition-all duration-300 group-hover:scale-105 shadow-sm",
                            isProminent ? "w-[55px] h-[50px]" : "w-5.5 h-5.5",
                            isProminent ? "group-hover:bg-primary group-hover:text-surface-base" : cn(
                              "group-hover:bg-accent group-hover:text-surface-base",
                              module.id === 'god' && "group-hover:bg-danger text-danger group-hover:text-surface-base"
                            ),
                            module.color
                          )}>
                            <module.icon className={isProminent ? "w-[30px] h-[30px]" : "w-[40px] h-[25px]"} />
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <h3 className={cn(
                              "font-black text-main transition-colors tracking-tight truncate leading-none",
                              isProminent ? "text-xl group-hover:text-primary" : cn("text-base group-hover:text-accent", module.id === 'god' && "group-hover:text-danger")
                            )}>
                              {module.title}
                            </h3>
                            {!isProminent && (
                              <p className="text-[7.5px] text-dim truncate opacity-70 mt-0.5">{module.description}</p>
                            )}
                          </div>
                        </div>
                        
                        {isProminent && (
                          <div className="relative h-14 mt-2 px-0.5">
                            <p 
                              className={cn(
                                "text-[10px] text-dim leading-relaxed transition-all duration-300 absolute inset-0 line-clamp-2 ml-[65px]",
                                hoveredModule === module.id ? "lg:opacity-0 lg:-translate-y-2" : "opacity-80 translate-y-0"
                              )}
                            >
                              {module.description}
                            </p>
                            <div className={cn(
                              "grid grid-cols-3 gap-1.5 transition-all duration-500 absolute inset-0",
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
                                    "flex items-center justify-center text-[9px] font-black px-2 h-8 rounded-xl border border-primary/20 bg-primary/5 text-primary uppercase tracking-wider hover:bg-primary hover:text-white transition-all cursor-pointer z-10 shadow-sm text-center self-center",
                                    "hover:scale-[1.03] active:scale-[0.97]"
                                  )}
                                >
                                  <span className="line-clamp-1 leading-none">{tool}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {isProminent && (
                          <div className="mt-auto pt-1 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0 border-t border-border-subtle/10">
                            <span className="text-[7.5px] font-black text-primary uppercase tracking-[0.2em]">Open</span>
                            <ChevronRight className="w-2.5 h-2.5 text-primary" />
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
