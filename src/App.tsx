import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { UserProfile, Project, Tenant } from './types';
import { Layout } from './components/Layout';
import { BOQManager } from './components/BOQManager';
import { BudgetManager } from './components/BudgetManager';
import { ResourceLibrary } from './components/ResourceLibrary';
import { TradeLibrary } from './components/TradeLibrary';
import { RoleManagement } from './components/RoleManagement';
import { Schedule } from './components/Schedule';
import { UserManagement } from './components/UserManagement';
import { Profile } from './components/Profile';
import { SubcontractorManagement } from './components/SubcontractorManagement';
import { Variations } from './components/Variations';
import { Approvals } from './components/Approvals';
import { Alerts } from './components/Alerts';
import { Settings } from './components/Settings';
import { EoTClaims } from './components/EoTClaims';
import ProcurementDashboard from './components/ProcurementDashboard';
import WarehouseManager from './components/WarehouseManager';
import { Home } from './components/Home';
import { SiteApp } from './components/SiteApp';
import { OperationsHub } from './components/OperationsHub';
import { Intelligence } from './components/Intelligence';
import { DirectorDashboard } from './components/dashboard/DirectorDashboard';
import { ClientPortal } from './components/dashboard/ClientPortal';
import { PlatformGod } from './components/PlatformGod';
import { Library } from './components/Library';
import { ProjectModal } from './components/ProjectModal';
import { ProjectSetup } from './components/ProjectSetup';
import { Governance } from './components/Governance';
import { ProjectSelection } from './components/ProjectSelection';
import { Zap, ExternalLink, Plus, Building2, Calendar as CalendarIcon, MapPin, Users as UsersIcon, Package as PackageIcon, GitBranch as GitBranchIcon, Calculator as CalculatorIcon, Activity, ShoppingCart, ChevronRight, LayoutDashboard, CheckCircle, HelpCircle, History, Truck, AlertCircle } from 'lucide-react';
import { cn } from './lib/utils';

import { ErrorBoundary } from './components/ErrorBoundary';
import { CeflotLogo } from './components/Logo';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [tenantUsers, setTenantUsers] = useState<any[]>([]);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState('home');
  const [panelHistory, setPanelHistory] = useState<string[]>(['home']);
  const [pendingPanel, setPendingPanel] = useState<string | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('ceflot-theme') as 'dark' | 'light') || 'dark';
  });
  const [counts, setCounts] = useState({
    projects: 0,
    resources_global: 0,
    resources_company: 0,
    trades_global: 0,
    trades_company: 0,
    suppliers_global: 0,
    suppliers_company: 0,
    users: 0
  });

  const currentProject = projects.find(p => p.id === activeProject);

  useEffect(() => {
    if (profile) {
      loadCounts();
    }
  }, [profile, projects]);

  const isInitialTheme = useRef(true);

  useEffect(() => {
    if (isInitialTheme.current) {
      document.documentElement.classList.toggle('light', theme === 'light');
      document.documentElement.classList.toggle('dark', theme === 'dark');
      localStorage.setItem('ceflot-theme', theme);
      isInitialTheme.current = false;
      return;
    }

    // Add transitioning class for a smooth 300ms transition
    document.documentElement.classList.add('theme-transition');
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('ceflot-theme', theme);

    const timer = setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 300);

    return () => clearTimeout(timer);
  }, [theme]);

  const loadCounts = async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase.rpc('get_dashboard_counts', { 
        p_tenant_id: profile.tenant_id 
      });

      if (error) {
        if (error.message?.includes('fetch')) {
           setAuthError('Connection lost. Please check your internet connectivity.');
           return;
        }
        throw error;
      }
      if (data) {
        setCounts(data);
      }
    } catch (e: any) {
      console.error('Error loading counts:', e);
    }
  };

  const loadTenantUsers = async (tenantId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, role, is_active')
        .eq('tenant_id', tenantId);
      if (!error && data) {
        setTenantUsers(data);
      }
    } catch (e) {
      console.warn('Error loading tenant users:', e);
    }
  };

  useEffect(() => {
    if (profile?.tenant_id) {
      loadTenantUsers(profile.tenant_id);
    } else {
      setTenantUsers([]);
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    const handleAuthReset = async () => {
      console.warn('Handling clear auth session and resetting Supabase keys...');
      try {
        await supabase.auth.signOut();
      } catch (errsignOut) {
        console.warn('SignOut failed gracefully:', errsignOut);
      }
      Object.keys(localStorage).forEach(key => {
        if (key.includes('supabase') || key.includes('sb-') || key.includes('auth-token')) {
          localStorage.removeItem(key);
        }
      });
      setSession(null);
      setProfile(null);
      setLoading(false);
    };

    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.warn('Session verification caught error, resetting:', error.message);
          handleAuthReset();
          return;
        }
        setSession(session);
        if (session) {
          loadProfile(session.user.id);
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('getSession catch error, resetting:', err);
        handleAuthReset();
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle session refresh failures
      if (event === 'TOKEN_REFRESHED' && !session) {
        console.warn('Token refresh failed inside onAuthStateChange, resetting...');
        handleAuthReset();
        return;
      }

      setSession(session);
      if (session) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, role, tenant_id, is_platform_god, is_active, created_at, updated_at')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows found
          console.warn('No profile found for user, showing setup screen');
          setProfile(null);
          setLoading(false);
          return;
        }
        if (error.message?.includes('fetch')) {
          setAuthError('Connection failed. Your Supabase project may be paused or unreachable.');
          setLoading(false);
          return;
        }
        throw error;
      }
      setProfile(data);
      
      // Load tenant info
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', data.tenant_id)
        .single();
      
      if (tenantData) setTenant(tenantData);

      loadProjects(data.tenant_id, !!data.is_platform_god);
    } catch (e: any) {
      console.error('Error loading profile:', e.message);
      setAuthError('Error loading profile: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const setupProfile = async (fullName: string, tenantId: string) => {
    if (!session) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .insert([{
          id: session.user.id,
          email: session.user.email,
          full_name: fullName,
          tenant_id: tenantId,
          role: 'project_manager' // Default role
        }])
        .select()
        .single();

      if (error) throw error;
      setProfile(data);
      
      // Load tenant info
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();
      
      if (tenantData) setTenant(tenantData);
      loadProjects(tenantId, false);
    } catch (e: any) {
      alert('Error setting up profile: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async (tenantId: string, isGod: boolean) => {
    let q = supabase.from('projects').select('*').order('name');
    if (!isGod) q = q.eq('tenant_id', tenantId);
    
    const { data } = await q;
    let projs = data || [];

    // Filter projects based on user assignment if they are not superadmin
    if (session && !isGod) {
      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
          
        if (profile && profile.role !== 'tenant_admin') {
          const assignmentStr = localStorage.getItem(`user_project_assignments_${session.user.id}`);
          let isAll = false;
          let pIds: string[] = [];
          
          if (assignmentStr) {
            try {
              const parsed = JSON.parse(assignmentStr);
              isAll = parsed.all_projects;
              pIds = parsed.project_ids || [];
            } catch {}
          } else {
            // Default roles
            if (profile.role === 'director' || profile.role === 'project_coordinator') {
              isAll = true;
            } else {
              isAll = false;
              // Fetch from database project_members
              const { data: members } = await supabase
                .from('project_members')
                .select('project_id')
                .eq('user_id', session.user.id);
              if (members) {
                pIds = members.map(m => m.project_id);
              }
            }
          }
          
          if (!isAll) {
            projs = projs.filter(p => pIds.includes(p.id));
          }
        }
      } catch (e) {
        console.error('Error applying project boundaries:', e);
      }
    }

    setProjects(projs);
    // Remove auto-selection to force project selection page
  };

  const handleModuleSelect = (moduleId: string) => {
    // If it's a project-specific module, always go to project selection first
    // The app should not assume the last worked project
    const projectModules = ['project-setup', 'planning', 'operations-hub', 'budget', 'schedule', 'variations', 'subcontractors', 'field-app', 'procurement'];
    if (projectModules.includes(moduleId)) {
      setActiveProject(null); // Clear active project to force selection
      setPendingPanel(moduleId);
      setActivePanel('project-selection');
      setPanelHistory(prev => [...prev, 'project-selection']);
      return;
    }

    setActivePanel(moduleId);
    setPanelHistory(prev => [...prev, moduleId]);
  };

  const handleBack = () => {
    if (panelHistory.length > 1) {
      const projectModules = ['project-setup', 'planning', 'budget', 'schedule'];
      if (projectModules.includes(activePanel)) {
        if (!window.confirm('You may have unsaved changes. Are you sure you want to go back?')) {
          return;
        }
      }

      const newHistory = [...panelHistory];
      newHistory.pop(); // Remove current
      const previous = newHistory[newHistory.length - 1];
      setActivePanel(previous);
      setPanelHistory(newHistory);
    }
  };

  const handleProjectSelect = (projectId: string) => {
    setActiveProject(projectId);
    if (pendingPanel) {
      setActivePanel(pendingPanel);
      setPanelHistory(prev => [...prev, pendingPanel]);
      setPendingPanel(null);
    } else {
      setActivePanel('dashboard');
      setPanelHistory(prev => [...prev, 'dashboard']);
    }
  };

  const createProject = async (data: any) => {
    if (!profile) return;
    
    try {
      // 1. Create the project
      const { data: newProj, error } = await supabase
        .from('projects')
        .insert([{
          name: data.name,
          project_code: data.project_code,
          tenant_id: profile.tenant_id,
          status: 'active',
          location: data.location,
          project_type: data.project_type,
          start_date: data.start_date,
          end_date: data.end_date,
          contract_value: data.contract_value,
          client_name: data.client_name
        }])
        .select()
        .single();
        
      if (error) throw error;

      // 2. Automatically initialize project setup checklist
      try {
        // Fetch checklist matching project_type (e.g., 'Building', 'Road')
        const { data: globalChecklist } = await supabase
          .from('global_project_checklists')
          .select('*')
          .eq('is_active', true)
          .ilike('checklist_name', `%${data.project_type}%`)
          .limit(1)
          .single();

        // Fallback to generic if no type-specific found
        const { data: fallbackChecklist } = !globalChecklist ? await supabase
          .from('global_project_checklists')
          .select('*')
          .eq('is_active', true)
          .limit(1)
          .single() : { data: null };

        const targetChecklist = globalChecklist || fallbackChecklist;

        if (targetChecklist && targetChecklist.tasks_json) {
          const tasksToInsert = targetChecklist.tasks_json.map((task: any, index: number) => ({
            project_id: newProj.id,
            tenant_id: profile.tenant_id,
            task_name: task.task_name || task.name,
            description: task.description,
            is_required: task.required !== false && task.is_required !== false,
            is_complete: false,
            display_order: index
          }));

          await supabase.from('project_setup_tasks').insert(tasksToInsert);
        }
      } catch (checkErr) {
        console.error('Error auto-initializing checklist:', checkErr);
      }

      // 3. If BOQ data was imported, insert it
      if (data.boq && data.boq.length > 0) {
        const boqItems = data.boq.map((item: any) => ({
          ...item,
          project_id: newProj.id,
          tenant_id: profile.tenant_id,
          status: 'draft'
        }));

        const { error: boqError } = await supabase
          .from('boq_items')
          .insert(boqItems);
        
        if (boqError) {
          console.error('Error importing BOQ:', boqError);
          alert('Project created, but BOQ import failed: ' + boqError.message);
        }
      }

      setProjects([...projects, newProj]);
      setActiveProject(newProj.id);
      setIsProjectModalOpen(false);
      alert('Project created successfully' + (data.boq?.length > 0 ? ' with BOQ items!' : '!'));
      setActivePanel('project-setup');
    } catch (e: any) {
      alert('Error creating project: ' + e.message);
    }
  };

  const updateProject = (updated: Project) => {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const deleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProject === id) {
      setActiveProject(null);
      setActivePanel('project-selection');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="h-screen bg-surface-base flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface-1 border border-warning/20 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-warning" />
          </div>
          <h1 className="text-xl font-bold text-main mb-3">Supabase Not Configured</h1>
          <p className="text-sm text-ghost mb-8 leading-relaxed">
            Please set <code className="text-primary font-bold">VITE_SUPABASE_URL</code> and <code className="text-primary font-bold">VITE_SUPABASE_ANON_KEY</code> in the <b>Environment Variables</b> section of the <b>Settings</b> menu to connect to your database.
          </p>
          <div className="bg-surface-2 rounded-xl p-4 text-left border border-border-subtle flex flex-col gap-3">
             <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono text-ghost uppercase">URL Source</span>
                <span className="text-xs font-mono break-all">{import.meta.env.VITE_SUPABASE_URL || 'Missing'}</span>
             </div>
             <div className="flex flex-col gap-1 pt-2 border-t border-border-subtle">
                <span className="text-[10px] font-mono text-ghost uppercase">Key Source</span>
                <span className="text-xs font-mono truncate">{import.meta.env.VITE_SUPABASE_ANON_KEY ? '••••••••' : 'Missing'}</span>
             </div>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-8 w-full py-3 bg-primary hover:bg-primary-hover text-surface-base rounded-xl font-bold transition-all shadow-lg shadow-primary/20"
          >
            Check Configuration Again
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen bg-surface-base flex flex-col items-center justify-center gap-4">
        <div className="w-24 h-16 flex items-center justify-center animate-pulse">
          <CeflotLogo className="w-24 h-16" />
        </div>
        <div className="text-2xl font-black tracking-tighter text-main">CEFLOT</div>
        <div className="font-mono text-[10px] text-ghost uppercase tracking-[0.2em] animate-pulse">Initializing Platform…</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-screen bg-surface-base flex items-center justify-center p-6">
        <div className="w-full max-w-[400px] flex flex-col gap-7">
          <div className="flex flex-col items-center gap-3.5">
            <div className="w-32 h-20 flex items-center justify-center">
              <CeflotLogo className="w-32 h-20" />
            </div>
            <div className="text-3xl font-black tracking-tighter text-main">CEFLOT</div>
            <div className="font-mono text-[10px] text-ghost uppercase tracking-[0.2em] text-center">Cloud Construction Delivery Platform</div>
          </div>
          
          <form onSubmit={handleLogin} className="bg-surface-1 border border-border-subtle rounded-xl p-6 flex flex-col gap-4">
            <div className="text-sm font-semibold text-main">Sign in to your company</div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-dim">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-surface-2 border border-border-subtle rounded-md text-sm p-3 outline-none text-main focus:border-primary transition-colors"
                placeholder="you@company.com"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-dim">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-surface-2 border border-border-subtle rounded-md text-sm p-3 outline-none text-main focus:border-primary transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            {authError && (
              <div className="bg-danger/10 border border-danger/25 rounded-md text-danger text-xs p-3 leading-relaxed">
                {authError}
              </div>
            )}

            <button 
              type="submit"
              className="bg-primary text-surface-base rounded-md text-sm font-bold p-3 mt-2 hover:bg-primary-hover active:scale-[0.97] transition-all"
            >
              Sign In
            </button>
          </form>
          
          <div className="text-center font-mono text-[10px] text-ghost tracking-wider uppercase">
            CEFLOT · SECURE PLATFORM · v0.4
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-screen bg-surface-base flex items-center justify-center p-6">
        <div className="w-full max-w-[400px] flex flex-col gap-7">
          <div className="flex flex-col items-center gap-3.5">
            <div className="w-24 h-16 flex items-center justify-center">
              <CeflotLogo className="w-24 h-16" />
            </div>
            <div className="text-2xl font-black tracking-tighter text-main">Profile Setup</div>
            <div className="font-mono text-[10px] text-ghost uppercase tracking-widest text-center">Complete registration to access the platform</div>
          </div>
          
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              setupProfile(formData.get('fullName') as string, formData.get('tenantId') as string);
            }} 
            className="bg-surface-1 border border-border-subtle rounded-xl p-6 flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-dim">Full Name</label>
              <input 
                name="fullName"
                type="text" 
                className="bg-surface-2 border border-border-subtle rounded-md text-sm p-3 outline-none text-main focus:border-primary transition-colors"
                placeholder="John Doe"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-dim">Company Name</label>
              <select 
                name="tenantId"
                className="bg-surface-2 border border-border-subtle rounded-md text-sm p-3 outline-none text-main focus:border-primary transition-colors"
                required
              >
                <option value="47b5d23d-f030-4edd-9310-4760163cb184">Dsquare</option>
                <option value="c1784ed8-7f42-47f3-85d1-f1de64734573">Sunshine TE Co. LTD.</option>
              </select>
            </div>

            <button 
              type="submit"
              className="bg-primary text-surface-base rounded-md text-sm font-bold p-3 mt-2 hover:bg-primary-hover active:scale-[0.97] transition-all"
            >
              Complete Setup
            </button>
            
            <button 
              type="button"
              onClick={handleLogout}
              className="text-[11px] text-ghost uppercase tracking-widest hover:text-main transition-colors"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>
    );
  }

  const renderProjectPanel = (component: React.ReactNode) => {
    const isProjectSpecific = ['project-setup', 'planning', 'budget', 'schedule'].includes(activePanel);

    return (
      <div className="flex flex-col h-full pt-1">
        {!activeProject ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-border-subtle flex items-center justify-center text-ghost">
              <Building2 className="w-8 h-8" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-bold text-main">No Project Selected</h2>
              <p className="text-sm text-dim max-w-xs">Please select a project from the dropdown above to view this module's data.</p>
            </div>
            <button 
              onClick={() => setActivePanel('projects')}
              className="btn btn-accent btn-sm mt-2"
            >
              Go to Projects
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {component}
          </div>
        )}
      </div>
    );
  };

  return (
    <ErrorBoundary>
      <Layout
        user={profile}
        tenant={tenant}
        projects={projects}
        counts={counts}
        tenantUsers={tenantUsers}
        activeProject={activeProject}
        setActiveProject={handleProjectSelect}
        activePanel={activePanel}
        pendingPanel={pendingPanel}
        setActivePanel={handleModuleSelect}
        onLogout={handleLogout}
        onBack={panelHistory.length > 1 ? handleBack : undefined}
        theme={theme}
        setTheme={setTheme}
      >
       {activePanel === 'home' && (
        <Home 
          onSelectModule={handleModuleSelect} 
          onLogout={handleLogout}
          isGodMode={!!profile.is_platform_god} 
          userName={profile.full_name || profile.email}
          userEmail={profile.email}
          userId={profile.id}
          userRole={profile.role}
          tenantId={profile.tenant_id}
          companyName={tenant?.name || 'Your Company'}
          projects={projects}
          tenant={tenant}
          counts={counts}
          tenantUsers={tenantUsers}
          setActiveProject={handleProjectSelect}
          theme={theme}
          setTheme={setTheme}
        />
      )}

      {activePanel === 'dashboard' && (
        <DirectorDashboard 
          projects={projects}
          counts={counts}
          onSelectProject={handleProjectSelect}
          onSelectModule={handleModuleSelect}
        />
      )}
      {activePanel === 'intelligence' && (
        <Intelligence tenantId={profile.tenant_id} />
      )}
      {activePanel === 'client-portal' && (
        <ClientPortal 
          tenantId={profile.tenant_id} 
          projectId={activeProject || undefined}
        />
      )}

      {activePanel === 'project-selection' && (
        <ProjectSelection 
          projects={projects}
          onSelect={handleProjectSelect}
          onCreateNew={pendingPanel === 'project-setup' ? () => setIsProjectModalOpen(true) : undefined}
          canCreate={profile.role === 'tenant_admin' || profile.is_platform_god}
          pendingModule={pendingPanel}
        />
      )}

      {activePanel === 'projects' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-bold">Projects</h1>
              <p className="text-sm text-dim">All projects in your company</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-mono text-primary uppercase tracking-widest">Live Portfolio</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(p => (
              <button 
                key={p.id}
                onClick={() => handleProjectSelect(p.id)}
                className={cn(
                  "bg-surface-1 border border-border-subtle rounded-xl p-5 text-left hover:border-primary transition-all group relative overflow-hidden",
                  activeProject === p.id && "border-primary bg-primary/5"
                )}
              >
                {activeProject === p.id && (
                  <div className="absolute top-0 right-0 bg-primary text-surface-base text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-bl-lg">
                    Active
                  </div>
                )}
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
                    p.status === 'active' ? "bg-primary/10 text-primary border-primary/20" : "bg-surface-2 text-ghost border-border-subtle"
                  )}>
                    {p.status}
                  </div>
                </div>
                <div className="text-sm font-bold text-main mb-1">{p.name}</div>
                <div className="flex items-center gap-1.5 text-[11px] text-ghost">
                  <MapPin className="w-3 h-3" />
                  {p.location || 'No location set'}
                </div>
                <div className="mt-4 pt-4 border-t border-border-subtle flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-ghost">
                    <CalendarIcon className="w-3 h-3" />
                    {new Date(p.created_at).toLocaleDateString()}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Open Project
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <ProjectModal 
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSave={createProject}
      />

      {activePanel === 'schedule' && (
        renderProjectPanel(<Schedule project={currentProject!} />)
      )}

      {activePanel === 'planning' && (
        renderProjectPanel(<BOQManager project={currentProject!} userRole={profile.role} tenantId={profile.tenant_id} />)
      )}

      {activePanel === 'project-setup' && (
        renderProjectPanel(
          <ProjectSetup 
            project={currentProject!} 
            onCreateProject={() => setIsProjectModalOpen(true)} 
            onUpdate={updateProject}
            onDelete={() => deleteProject(currentProject!.id)}
          />
        )
      )}

      {activePanel === 'governance' && (
        renderProjectPanel(<Governance project={currentProject!} />)
      )}

      {activePanel === 'budget' && (
        renderProjectPanel(<BudgetManager project={currentProject!} userRole={profile.role} tenantId={profile.tenant_id} onSelectModule={handleModuleSelect} />)
      )}

      {activePanel === 'operations-hub' && (
        renderProjectPanel(<OperationsHub project={currentProject!} tenantId={profile.tenant_id} />)
      )}

      {activePanel === 'field-app' && (
        renderProjectPanel(<SiteApp project={currentProject!} tenantId={profile.tenant_id} onClose={() => handleModuleSelect('home')} />)
      )}

      {activePanel === 'procurement' && (
        renderProjectPanel(<ProcurementDashboard project={currentProject!} tenantId={profile.tenant_id} />)
      )}

      {activePanel === 'warehouse' && (
        <WarehouseManager project={currentProject || null} tenantId={profile.tenant_id} userRole={profile.role} />
      )}

      {activePanel === 'library' && (
        <Library 
          userRole={profile.role} 
          tenantId={profile.tenant_id} 
          isGodMode={!!profile.is_platform_god}
        />
      )}

      {activePanel === 'approvals' && (
        <Approvals project={currentProject || undefined} tenantId={profile.tenant_id} userRole={profile.role} />
      )}

      {activePanel === 'alerts' && (
        <Alerts project={currentProject || undefined} tenantId={profile.tenant_id} />
      )}

      {activePanel === 'approval-config' && (
        <Settings tenantId={profile.tenant_id} />
      )}

      {activePanel === 'variations' && (
        renderProjectPanel(<Variations project={currentProject!} tenantId={profile.tenant_id} />)
      )}

      {activePanel === 'subcontractors' && (
        renderProjectPanel(
          <SubcontractorManagement 
            userRole={profile.role} 
            tenantId={profile.tenant_id} 
            project={currentProject || null}
            onSelectProject={() => {
              setPendingPanel('subcontractors');
              setActivePanel('project-selection');
            }}
          />
        )
      )}

      {activePanel === 'users' && (
        <UserManagement tenantId={profile.tenant_id} currentUserRole={profile.role} />
      )}
      {activePanel === 'profile' && (
        <Profile 
          profile={profile} 
          tenantName={tenant?.name || 'Your Company'} 
          onProfileUpdate={setProfile}
        />
      )}

      {activePanel === 'permissions' && (
        <RoleManagement userRole={profile.role} isPlatformGod={profile.is_platform_god} />
      )}

      {activePanel === 'help' && (
        <div className="bg-surface-1 border border-border-subtle rounded-xl p-8 text-center">
          <HelpCircle className="w-12 h-12 text-primary opacity-40 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-main">Help & Documentation</h3>
          <p className="text-sm text-dim max-w-md mx-auto mt-2">Access platform guides, tutorials, and support resources.</p>
        </div>
      )}

      {activePanel === 'audit' && (
        <div className="bg-surface-1 border border-border-subtle rounded-xl p-8 text-center">
          <History className="w-12 h-12 text-accent opacity-40 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-main">Audit Logs</h3>
          <p className="text-sm text-dim max-w-md mx-auto mt-2">Review system-wide activity logs and administrative changes.</p>
        </div>
      )}

      {activePanel === 'god' && profile.is_platform_god && (
        <PlatformGod userProfile={profile} />
      )}
    </Layout>
  </ErrorBoundary>
);
}
