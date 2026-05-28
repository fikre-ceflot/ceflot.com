import React from 'react';
import { 
  LayoutGrid, 
  Folder, 
  Calendar, 
  CheckCircle, 
  Bell, 
  GitBranch, 
  Clock, 
  Users, 
  UserPlus, 
  Sliders, 
  Settings, 
  Zap,
  LogOut,
  Calculator,
  Package,
  BookOpen,
  ShieldCheck,
  Activity,
  BrainCircuit,
  ShoppingCart,
  X,
  Building2,
  ChevronLeft,
  ChevronRight,
  Menu,
  ArrowLeft,
  User,
  Search,
  Shapes,
  Globe,
  DollarSign,
  Sun,
  Moon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { UserProfile, Project, Tenant } from '../types';
import { usePermissions, Capability } from '../hooks/usePermissions';
import { CeflotLogo } from './Logo';

interface LayoutProps {
  user: UserProfile;
  tenant: Tenant | null;
  projects: Project[];
  counts?: any;
  tenantUsers?: any[];
  activeProject: string | null;
  setActiveProject: (id: string) => void;
  activePanel: string;
  pendingPanel?: string | null;
  setActivePanel: (id: string) => void;
  onLogout: () => void;
  onBack?: () => void;
  children: React.ReactNode;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

const NAV_ITEMS: { section: string; id: string; label: string; icon: any; capability: Capability | null }[] = [
  { section: 'OVERVIEW', id: 'home',      label: 'Home',      icon: LayoutGrid, capability: null },
  
  { section: 'DASHBOARD', id: 'dashboard', label: 'Portfolio', icon: Shapes, capability: 'dash:view' },
  { section: 'DASHBOARD', id: 'intelligence', label: 'Intelligence', icon: BrainCircuit, capability: null },
  { section: 'DASHBOARD', id: 'library', label: 'Library', icon: BookOpen, capability: 'trade:view_global' },

  { section: 'PROJECT', id: 'project-setup', label: 'Project Setup', icon: CheckCircle, capability: null },
  { section: 'PROJECT', id: 'planning',   label: 'BoQ Manager',  icon: Calendar, capability: 'boq:view_recipes' },
  { section: 'PROJECT', id: 'schedule',   label: 'Project Schedule',  icon: Clock, capability: 'plan:view' },
  { section: 'PROJECT', id: 'budget',    label: 'Cost & Budget', icon: Calculator, capability: 'fin:view_budget' },
  { section: 'PROJECT', id: 'operations-hub', label: 'Operations Control', icon: Activity, capability: 'daily:view_project' },
  { section: 'PROJECT', id: 'approvals',  label: 'Approvals', icon: CheckCircle, capability: 'appr:view_pending' },
  { section: 'PROJECT', id: 'alerts',     label: 'Alerts',    icon: Bell, capability: 'alert:view' },

  { section: 'SUPPORT', id: 'variations',     label: 'Variations',     icon: GitBranch, capability: 'fin:var_view' },
  { section: 'SUPPORT', id: 'eot',            label: 'EoT Claims',     icon: Clock,      capability: 'fin:eot_view' },
  { section: 'SUPPORT', id: 'subcontractors', label: 'Subcontractors', icon: Users,      capability: 'res:subcon_view' },
  { section: 'SUPPORT', id: 'procurement', label: 'Procurement', icon: ShoppingCart, capability: 'proc:view_demand' },
  { section: 'SUPPORT', id: 'warehouse', label: 'Warehouse', icon: Package, capability: 'stock:view' },

  { section: 'ADMIN', id: 'users',          label: 'User Management',    icon: UserPlus, capability: 'admin:view_users' },
  { section: 'ADMIN', id: 'permissions',    label: 'Role Permissions',   icon: ShieldCheck, capability: 'admin:view_roles' },
  { section: 'ADMIN', id: 'approval-config',label: 'Approval Config',    icon: Sliders,   capability: 'appr:view_chains' },
  { section: 'ADMIN', id: 'alert-settings', label: 'Alert Settings',     icon: Settings,  capability: 'alert:set_thresholds' },
  
  { section: 'GOD',   id: 'god',            label: 'God Mode',           icon: Zap,       capability: null },
];

export function Layout({ 
  user, 
  tenant,
  projects, 
  counts = {},
  tenantUsers = [],
  activeProject, 
  setActiveProject, 
  activePanel, 
  pendingPanel,
  setActivePanel, 
  onLogout,
  onBack,
  children,
  theme,
  setTheme
}: LayoutProps) {
  const [showProfileModal, setShowProfileModal] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSpotlightOpen, setIsSpotlightOpen] = React.useState(false);
  const [spotlightQuery, setSpotlightQuery] = React.useState('');

  React.useEffect(() => {
    const handleFocusMode = (e: any) => {
      setIsSidebarCollapsed(e.detail);
    };
    window.addEventListener('toggle-focus-mode', handleFocusMode);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSpotlightOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('toggle-focus-mode', handleFocusMode);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  const [profileForm, setProfileForm] = React.useState({
    full_name: user.full_name || ''
  });

  const { hasCapability, loading: permissionsLoading } = usePermissions(user.role, user.tenant_id, user);

  const showSidebar = activePanel !== 'home';
  
  // Filter items based on current context and search query
  const filteredNavItems = React.useMemo(() => {
    let items = NAV_ITEMS.filter(item => {
      if (item.id === 'god' && !user.is_platform_god) return false;
      
      const isItemAdmin = item.section === 'ADMIN';
      const userHasAdminView = hasCapability('admin:view_users') || hasCapability('admin:view_roles');
      
      if (isItemAdmin) {
        if (!userHasAdminView && item.capability && !hasCapability(item.capability)) {
          return false;
        }
      } else {
        if (item.capability && !hasCapability(item.capability)) return false;
      }

      // Always show Home
      if (item.id === 'home') return true;

      // If we are on the project selection page (activeProject is null and not home),
      // show home and all tools in the same section as the pending target.
      if (!activeProject && activePanel === 'project-selection') {
        if (item.id === 'home') return true;
        
        const targetModule = pendingPanel || activePanel;
        const targetItem = NAV_ITEMS.find(i => i.id === targetModule);
        
        if (targetItem && targetItem.section && item.section === targetItem.section) {
          return true;
        }

        return item.id === pendingPanel;
      }

      if (!activeProject && activePanel !== 'home') {
        const activeItem = NAV_ITEMS.find(i => i.id === activePanel);
        if (activeItem?.section === 'ADMIN' && item.section === 'ADMIN') {
          return true;
        }
        if (activeItem?.section === 'GOD' && item.section === 'GOD') {
          return true;
        }
        if (activeItem?.section === 'DASHBOARD' && item.section === 'DASHBOARD') {
          return true;
        }
        return item.id === activePanel;
      }
      const activeItem = NAV_ITEMS.find(i => i.id === activePanel);
      const activeSection = activeItem?.section;

      // If the item is in the same section as the active panel, show it
      if (item.section === activeSection) return true;

      // Special case: Admin items should often be visible if you have permission
      if (item.section === 'ADMIN') return true;

      // Always show the current active panel if not already covered
      if (item.id === activePanel) return true;

      return false;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(item => 
        item.label.toLowerCase().includes(q) || 
        item.section.toLowerCase().includes(q)
      );
    }
    return items;
  }, [activePanel, user.is_platform_god, user.role, hasCapability, searchQuery, activeProject, pendingPanel]);

  const authorizedTools = React.useMemo(() => {
    return NAV_ITEMS.filter(item => {
      if (item.id === 'god' && !user.is_platform_god) return false;
      if (item.capability && !hasCapability(item.capability)) return false;
      return true;
    });
  }, [user.is_platform_god, hasCapability]);

  const unifiedSpotlightResults = React.useMemo(() => {
    if (!spotlightQuery.trim()) return null;
    const q = spotlightQuery.toLowerCase().trim();

    // 1. Search Modules / Tools
    const matchedModules = authorizedTools.filter(item => 
      item.label.toLowerCase().includes(q) || 
      item.section.toLowerCase().includes(q)
    );

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
      { id: 'role', label: 'My Corporate Role', value: user.role === 'tenant_admin' ? 'Company Master Administrator' : user.role.replace(/_/g, ' '), isMatch: user.role.toLowerCase().includes(q) },
      { id: 'email', label: 'My Registered Email', value: user.email, isMatch: user.email.toLowerCase().includes(q) },
      { id: 'name', label: 'My Account Name', value: user.full_name || '', isMatch: (user.full_name || '').toLowerCase().includes(q) },
      { id: 'tenant', label: 'My Company Workspace', value: tenant?.name || 'Your Company', isMatch: (tenant?.name || '').toLowerCase().includes(q) },
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
  }, [spotlightQuery, authorizedTools, projects, tenant, counts, tenantUsers, user, hasCapability]);

  const filteredSpotlightTools = React.useMemo(() => {
    return unifiedSpotlightResults?.modules || [];
  }, [unifiedSpotlightResults]);

  const [notification, setNotification] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

  React.useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  let lastSection: string | null = null;

  return (
      <div className="flex h-screen overflow-hidden bg-surface-base text-main font-sans">
        {/* Sidebar Overlay for Mobile */}
        {showSidebar && isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        {showSidebar && (
          <aside className={cn(
            "bg-surface-1 border-r border-border-subtle flex flex-col flex-shrink-0 overflow-hidden transition-all duration-300 relative group/sidebar z-[101]",
            isSidebarCollapsed ? "w-16" : "w-56",
            "fixed inset-y-0 left-0 lg:relative lg:translate-x-0",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}>
            {/* Collapse Toggle (Desktop Only) */}
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="absolute -right-3 top-20 w-6 h-6 bg-surface-2 border border-border-subtle rounded-full hidden lg:flex items-center justify-center text-dim hover:text-primary hover:border-primary z-50 transition-all opacity-0 group-hover/sidebar:opacity-100"
            >
              {isSidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>

            <div className="p-4 border-b border-border-subtle flex items-center gap-3 flex-shrink-0 overflow-hidden">
              <div className="flex-shrink-0">
                <CeflotLogo className="w-10 h-7" />
              </div>
              {(!isSidebarCollapsed || isMobileMenuOpen) && (
                <div className="animate-in fade-in duration-300">
                  <div className="text-xl font-black tracking-tighter uppercase text-main leading-none">Ceflot</div>
                  <div className="font-mono text-[11px] text-ghost uppercase tracking-widest mt-0.5">v0.4.2</div>
                </div>
              )}
              {/* Close Button for Mobile */}
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="lg:hidden ml-auto p-2 text-dim hover:text-main"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-3 py-2 border-b border-border-subtle/30 flex-shrink-0">
              <button 
                onClick={() => {
                  setSpotlightQuery('');
                  setIsSpotlightOpen(true);
                }}
                className={cn(
                  "w-full flex items-center bg-surface-base border border-border-subtle hover:border-primary rounded-lg transition-all text-ghost p-2 text-left shrink-0 group",
                  isSidebarCollapsed && !isMobileMenuOpen ? "justify-center" : "gap-2"
                )}
                title="Search all tools... (Cmd+K)"
              >
                <Search className="w-4 h-4 text-ghost shrink-0 group-hover:text-primary transition-colors" />
                {(!isSidebarCollapsed || isMobileMenuOpen) && (
                  <span className="text-xs font-medium text-ghost/70 group-hover:text-main transition-colors flex items-center justify-between w-full">
                    <span>Search tools...</span>
                    <kbd className="hidden md:inline-block text-[9px] px-1.5 py-0.5 bg-surface-2 border border-border-subtle/50 rounded text-ghost/50 font-mono scale-90">⌘K</kbd>
                  </span>
                )}
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5 custom-scrollbar">
              {permissionsLoading ? (
                <div className="p-4 text-center">
                  <div className="w-4 h-4 border border-border-subtle border-t-primary rounded-full animate-spin mx-auto" />
                </div>
              ) : filteredNavItems.map((item) => {
                const showSection = item.section !== lastSection;
                if (showSection) lastSection = item.section;

                return (
                  <React.Fragment key={item.id}>
                    {showSection && (!isSidebarCollapsed || isMobileMenuOpen) && (
                      <div className="font-mono text-[11px] uppercase tracking-widest text-ghost px-2 py-3.5 mt-2 animate-in fade-in duration-300">
                        {item.section}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setActivePanel(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-left relative",
                        (activePanel === item.id || 
                         (activePanel === 'project-selection' && pendingPanel === item.id))
                          ? "bg-primary/10 text-primary" 
                          : "text-dim hover:bg-surface-2 hover:text-main",
                        isSidebarCollapsed && !isMobileMenuOpen && "justify-center px-0"
                      )}
                      title={isSidebarCollapsed && !isMobileMenuOpen ? item.label : undefined}
                    >
                      {(activePanel === item.id || 
                        (activePanel === 'project-selection' && pendingPanel === item.id)) && (
                        <div className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full" />
                      )}
                      <item.icon className={cn("w-4 h-4 flex-shrink-0", isSidebarCollapsed && !isMobileMenuOpen && "w-5 h-5")} />
                      {(!isSidebarCollapsed || isMobileMenuOpen) && <span className="truncate animate-in fade-in duration-300">{item.label}</span>}
                    </button>
                  </React.Fragment>
                );
              })}
            </nav>

          <div className="p-3 border-t border-border-subtle flex-shrink-0">
            <div 
              onClick={() => setActivePanel('profile')}
              className={cn(
                "flex items-center gap-2.5 p-2 rounded-md bg-surface-2 border border-border-subtle hover:border-primary transition-all cursor-pointer group",
                isSidebarCollapsed && !isMobileMenuOpen && "justify-center p-1.5",
                activePanel === 'profile' && "border-primary bg-primary/10"
              )}
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary flex items-center justify-center text-[11px] font-bold text-primary flex-shrink-0 overflow-hidden">
                {(user.full_name || user.email).split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}
              </div>
              {(!isSidebarCollapsed || isMobileMenuOpen) && (
                <>
                  <div className="flex-1 min-w-0 animate-in fade-in duration-300">
                    <div className="text-[12px] font-semibold truncate group-hover:text-primary transition-colors">{user.full_name || user.email}</div>
                    <div className="flex flex-col">
                      <div className="font-mono text-[8px] text-ghost uppercase tracking-wider">{user.role === 'tenant_admin' ? 'Company Admin' : user.role.replace(/_/g, ' ')}</div>
                      {tenant && (
                        <div className="text-[10px] text-primary font-bold truncate tracking-tight">{tenant.name}</div>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onLogout();
                    }}
                    className="w-6.5 h-6.5 rounded-md border border-border-subtle flex items-center justify-center flex-shrink-0 hover:bg-danger/10 transition-colors group/logout"
                    title="Sign out"
                  >
                    <LogOut className="w-3.5 h-3.5 text-ghost group-hover/logout:text-danger" />
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden w-full relative">
        {showSidebar && (
          <header className="h-14 bg-surface-1/80 border-b border-border-subtle flex items-center justify-between px-4 lg:px-8 gap-4 flex-shrink-0 relative z-50 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-2 text-dim hover:text-main hover:bg-surface-2 rounded-lg transition-all"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="hidden lg:block p-2 -ml-2 text-dim hover:text-main hover:bg-surface-2 rounded-lg transition-all"
              >
                <Menu className="w-5 h-5" />
              </button>
              {onBack && (
                <button 
                  onClick={onBack}
                  className="ml-2 flex items-center gap-2 p-1.5 px-3 rounded-lg border border-border-subtle hover:bg-surface-2 transition-all group"
                >
                  <ArrowLeft className="w-4 h-4 text-dim group-hover:text-primary transition-colors" />
                  <span className="text-[11px] font-bold text-ghost group-hover:text-main transition-colors uppercase tracking-widest hidden sm:inline">Back</span>
                </button>
              )}
            </div>
            
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-20">
              <div className="flex items-center gap-3">
                <div className="text-sm font-black text-main tracking-[0.3em] uppercase drop-shadow-sm whitespace-nowrap">
                  {NAV_ITEMS.find(i => i.id === activePanel)?.label || activePanel.replace(/-/g, ' ').toUpperCase()}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
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

              <button className="relative p-2 text-dim hover:text-main transition-colors hidden sm:block">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2.5 w-1.5 h-1.5 bg-danger rounded-full ring-2 ring-surface-1" />
              </button>

              <div className="w-px h-6 bg-border-subtle mx-1 hidden sm:block" />

              <div 
                className="flex items-center gap-3 pl-1.5 pr-1.5 py-1 rounded-xl border border-border-subtle/50 bg-surface-2/30 mr-[-8px] sm:mr-0"
              >
                <button 
                  onClick={() => setShowProfileModal(true)}
                  className="w-8 h-8 rounded-lg bg-surface-base border border-border-subtle flex items-center justify-center text-xs font-black text-primary overflow-hidden hover:bg-primary hover:text-surface-1 hover:border-primary transition-all cursor-pointer shadow-sm"
                  title="Modify User Profile Settings"
                >
                  {(user.full_name || user.email).split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}
                </button>
                <div className="hidden md:flex flex-col items-start leading-tight pr-2 select-none">
                  <span className="text-xs font-black text-main uppercase tracking-tight">{user.full_name || 'My Profile'}</span>
                  <div className="font-mono text-[9px] text-ghost uppercase tracking-widest leading-none mt-0.5">{user.role === 'tenant_admin' ? 'Company Admin' : user.role.replace(/_/g, ' ')}</div>
                </div>
              </div>
            </div>
          </header>
        )}
        <div className={cn(
          "flex-1",
          showSidebar ? "overflow-y-auto custom-scrollbar p-4 lg:p-6" : "h-full overflow-hidden p-0"
        )}>
          <div className={cn(
            "w-full mx-auto",
            showSidebar ? "max-w-[1600px]" : "h-full max-w-none"
          )}>
            {children}
          </div>
        </div>
      </main>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border-subtle flex items-center justify-between bg-surface-2/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-main">User Profile</h3>
                  <p className="text-[11px] font-bold text-dim uppercase tracking-wider">Account Settings</p>
                </div>
              </div>
              <button 
                onClick={() => setShowProfileModal(false)} 
                className="btn btn-ghost btn-sm p-2 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-6">
              <div className="flex flex-col items-center gap-4 mb-2">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full bg-surface-2 border-2 border-border-subtle flex items-center justify-center text-2xl font-bold text-primary overflow-hidden shadow-xl">
                    {(user.full_name || user.email).split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-main">{user.full_name || user.email}</div>
                  <div className="text-[11px] font-mono text-ghost uppercase tracking-widest mt-0.5">{user.role === 'tenant_admin' ? 'Company Admin' : user.role.replace(/_/g, ' ')}</div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-dim ml-1">Full Name</label>
                <input 
                  type="text"
                  value={profileForm.full_name}
                  onChange={e => setProfileForm({...profileForm, full_name: e.target.value})}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-all text-main"
                  placeholder="Your full name"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-dim ml-1">Appearance</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setTheme('dark')}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-widest transition-all",
                      theme === 'dark' 
                        ? "bg-primary border-primary text-surface-1 shadow-lg shadow-primary/20" 
                        : "bg-surface-2 border-border-subtle text-dim hover:border-ghost"
                    )}
                  >
                    Dark
                  </button>
                  <button 
                    onClick={() => setTheme('light')}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-widest transition-all",
                      theme === 'light' 
                        ? "bg-primary border-primary text-surface-1 shadow-lg shadow-primary/20" 
                        : "bg-surface-2 border-border-subtle text-dim hover:border-ghost"
                    )}
                  >
                    Light
                  </button>
                </div>
              </div>

              {tenant && (
                <div className="bg-surface-2 border border-border-subtle rounded-lg p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-ghost">Company</div>
                    <div className="text-xs font-bold text-main">{tenant.name}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-surface-2 border-t border-border-subtle flex items-center gap-3">
              <button 
                onClick={() => setShowProfileModal(false)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-bold text-dim hover:bg-surface-3 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  setIsSavingProfile(true);
                  try {
                    const { error } = await supabase
                      .from('user_profiles')
                      .update({
                        full_name: profileForm.full_name
                      })
                      .eq('id', user.id);
                    
                    if (error) throw error;
                    setNotification({ type: 'success', message: 'Profile updated successfully!' });
                    setTimeout(() => window.location.reload(), 1000);
                  } catch (e: any) {
                    setNotification({ type: 'error', message: 'Error updating profile: ' + e.message });
                  } finally {
                    setIsSavingProfile(false);
                  }
                }}
                disabled={isSavingProfile}
                className="btn btn-primary flex-1"
              >
                {isSavingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Notifications */}
      {notification && (
        <div className={cn(
          "fixed top-6 right-6 z-[300] px-6 py-3 rounded-xl shadow-2xl animate-in slide-in-from-right duration-300 flex items-center gap-3 border",
          notification.type === 'success' ? "bg-primary text-surface-base border-primary" : "bg-danger text-white border-danger"
        )}>
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm font-bold">{notification.message}</span>
        </div>
      )}

      {/* Spotlight Command Search Modal */}
      {isSpotlightOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-start justify-center p-4 pt-[10vh]">
          <div 
            className="fixed inset-0"
            onClick={() => setIsSpotlightOpen(false)}
          />
          <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 relative z-10">
            <div className="flex items-center gap-3 p-4 border-b border-border-subtle bg-surface-2">
              <Search className="w-5 h-5 text-ghost shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Search all tools across the platform..."
                value={spotlightQuery}
                onChange={(e) => setSpotlightQuery(e.target.value)}
                className="w-full bg-transparent text-sm font-medium outline-none text-main placeholder:text-ghost/60"
              />
              <button 
                onClick={() => setIsSpotlightOpen(false)}
                className="p-1 px-1.5 hover:bg-surface-3 rounded text-xs text-ghost hover:text-main font-mono border border-border-subtle/40 whitespace-nowrap"
              >
                ESC
              </button>
            </div>            <div className="max-h-[450px] overflow-y-auto p-3 space-y-4 custom-scrollbar">
              {!unifiedSpotlightResults ? (
                /* Clear default search helper */
                <div className="space-y-1">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-ghost mb-2 px-1">
                    🚀 Standard Capabilities & Shortcuts
                  </div>
                  {authorizedTools.map((item) => {
                    const isActive = activePanel === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActivePanel(item.id);
                          setIsSpotlightOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all group",
                          isActive 
                            ? "bg-primary/5 border-primary/20" 
                            : "bg-transparent border-transparent hover:bg-surface-2 hover:border-border-subtle/40"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={cn(
                            "w-7.5 h-7.5 rounded-lg flex items-center justify-center border transition-colors",
                            isActive ? "bg-primary/10 border-primary/20 text-primary" : "bg-surface-2 border-border-subtle text-dim group-hover:bg-primary/5 group-hover:border-primary/20 group-hover:text-primary"
                          )}>
                            <item.icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className={cn("text-xs font-bold", isActive ? "text-primary" : "text-main")}>{item.label}</span>
                            <span className="text-[9px] text-ghost font-mono uppercase tracking-wider">{item.section}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-ghost/40 group-hover:text-primary transition-colors pr-1">Launch ↗</span>
                      </button>
                    );
                  })}
                </div>
              ) : unifiedSpotlightResults.totalCount === 0 ? (
                <div className="p-10 text-center flex flex-col items-center justify-center gap-2">
                  <span className="text-xl">🔍</span>
                  <div className="text-sm font-bold text-main">No global query matches found</div>
                  <div className="text-xs text-ghost max-w-xs leading-normal">
                    We scanned platform systems, commercial locations, users, and your role permissions, but found no matches.
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 1. Modules Matched */}
                  {unifiedSpotlightResults.modules.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-primary border-l-2 border-primary pl-2 mb-2 select-none">
                        ⚙️ Systems & Modules ({unifiedSpotlightResults.modules.length})
                      </div>
                      {unifiedSpotlightResults.modules.map((item) => {
                        const isActive = activePanel === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActivePanel(item.id);
                              setIsSpotlightOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all group",
                              isActive 
                                ? "bg-primary/5 border-primary/20" 
                                : "bg-transparent border-transparent hover:bg-surface-2 hover:border-border-subtle/40"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={cn(
                                "w-7.5 h-7.5 rounded-lg flex items-center justify-center border transition-colors",
                                isActive ? "bg-primary/10 border-primary/20 text-primary" : "bg-surface-2 border-border-subtle text-dim group-hover:bg-primary/5 group-hover:border-primary/20 group-hover:text-primary"
                              )}>
                                <item.icon className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className={cn("text-xs font-bold", isActive ? "text-primary" : "text-main")}>{item.label}</span>
                                <span className="text-[9px] text-ghost font-mono uppercase tracking-wider">{item.section}</span>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-ghost/40 group-hover:text-primary transition-colors pr-1">Launch ↗</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 2. Projects Matched */}
                  {unifiedSpotlightResults.projects.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-accent border-l-2 border-accent pl-2 mb-2 select-none">
                        🏗️ Commercial Projects & Sites ({unifiedSpotlightResults.projects.length})
                      </div>
                      {unifiedSpotlightResults.projects.map((p) => {
                        const isCurrent = activeProject === p.id;
                        return (
                          <button
                            key={`spot-proj-${p.id}`}
                            onClick={() => {
                              setActiveProject(p.id);
                              setActivePanel('dashboard'); // Switch views automatically to dashboard when selected
                              setIsSpotlightOpen(false);
                            }}
                            className={cn(
                              "w-full flex flex-col p-2.5 rounded-xl border text-left transition-all group relative",
                              isCurrent 
                                ? "bg-accent/5 border-accent/25" 
                                : "bg-transparent border-transparent hover:bg-surface-2 hover:border-border-subtle/40"
                            )}
                          >
                            <div className="flex items-start justify-between w-full">
                              <div className="min-w-0">
                                <span className="text-[8px] font-mono font-bold text-accent bg-accent/5 border border-accent/20 px-1 py-0.5 rounded uppercase tracking-wide leading-none">{p.project_code || 'CODE'}</span>
                                <span className={cn("text-xs font-bold block mt-1", isCurrent ? "text-accent" : "text-main")}>{p.name}</span>
                              </div>
                              <span className="text-[8px] bg-ghost/10 border border-border-subtle/40 text-ghost font-black uppercase px-1.5 py-0.5 rounded leading-none">
                                {p.status}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 mt-1.5 text-[10px] text-ghost font-medium">
                              <span className="flex items-center gap-0.5"><Globe className="w-3 h-3 shrink-0" />{p.location || 'Unknown'}</span>
                              <span className="text-border-subtle">•</span>
                              {p.contract_value !== null && (
                                <span className="flex items-center gap-0.5 font-bold text-main"><DollarSign className="w-3 h-3 shrink-0" />${p.contract_value.toLocaleString()}</span>
                              )}
                            </div>
                            <div className="text-[8px] font-mono font-bold absolute bottom-2 right-2 text-accent opacity-0 group-hover:opacity-100 transition-all">
                              ACTIVATE CONTEXT ↗
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 3. Company & Tenant Matched */}
                  {unifiedSpotlightResults.tenantDetails && (
                    <div className="space-y-1.5">
                      <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-warning border-l-2 border-warning pl-2 mb-2 select-none">
                        🏢 Corporate Workspace
                      </div>
                      <div className="bg-surface-2 border border-border-subtle rounded-xl p-3 flex flex-col gap-2 animate-in fade-in-50 duration-200">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-black text-main">{unifiedSpotlightResults.tenantDetails.tenant.name}</div>
                            <span className="text-[8px] font-mono font-bold text-ghost uppercase tracking-wider">ID: {unifiedSpotlightResults.tenantDetails.tenant.id}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center bg-surface-base py-1.5 rounded-lg border border-border-subtle/40 text-[9px]">
                          <div>
                            <span className="font-bold text-main block">{counts.projects || 0}</span>
                            <span className="text-[8px] text-ghost uppercase">Projects</span>
                          </div>
                          <div className="border-l border-border-subtle/50">
                            <span className="font-bold text-main block">{counts.users || 0}</span>
                            <span className="text-[8px] text-ghost uppercase">Active Users</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4. Users Matched */}
                  {unifiedSpotlightResults.users.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-ghost border-l-2 border-ghost pl-2 mb-2 select-none">
                        👥 Corporate Directory ({unifiedSpotlightResults.users.length})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in-50 duration-200">
                        {unifiedSpotlightResults.users.map((u) => (
                          <div
                            key={`spot-user-${u.id}`}
                            className="bg-surface-2 border border-border-subtle/70 rounded-xl p-2.5 flex items-center justify-between gap-2.5"
                          >
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-main truncate leading-tight">{u.full_name || 'Anonymous QS'}</h4>
                              <p className="text-[9px] text-ghost truncate font-mono">{u.email}</p>
                            </div>
                            <span className="text-[8px] font-mono font-black uppercase text-ghost bg-surface-base px-1.5 py-0.5 rounded border border-border-subtle">
                              {u.role === 'tenant_admin' ? 'Admin' : u.role?.replace(/_/g, ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 5. Clearances Matched */}
                  {unifiedSpotlightResults.permissions.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-red-500 border-l-2 border-red-500 pl-2 mb-2 select-none">
                        🛡️ Credentials & Active Access Policies ({unifiedSpotlightResults.permissions.length})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in-50 duration-200">
                        {unifiedSpotlightResults.permissions.map((p) => (
                          <div
                            key={`spot-perm-${p.id}`}
                            className="bg-surface-2 border border-border-subtle/70 rounded-xl p-2 flex flex-col border-dashed text-left"
                          >
                            <span className="text-[8px] font-black text-ghost uppercase leading-none">{p.label}</span>
                            <span className="text-[10px] font-mono font-bold text-main truncate mt-1">{p.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
