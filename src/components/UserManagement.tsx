import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { 
  UserPlus, 
  Mail, 
  Shield, 
  Trash2, 
  MoreHorizontal, 
  Check, 
  X, 
  AlertCircle, 
  Loader2, 
  Settings,
  User as UserIcon,
  Search,
  ChevronRight,
  ShieldAlert,
  Save,
  ChevronDown,
  Folder,
  Lock,
  Unlock,
  Key,
  Fingerprint,
  Eye,
  ShoppingCart,
  Package,
  LayoutGrid,
  Calculator,
  Ban
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Role, UserProfile } from '../types';
import { ROLES, CAPABILITIES } from '../constants/capabilities';
import { useRoles } from '../hooks/useRoles';
import { RoleManagement } from './RoleManagement';

interface UserManagementProps {
  tenantId: string;
  currentUserRole?: string;
}

export function UserManagement({ tenantId, currentUserRole }: UserManagementProps) {
  const { roles: allAvailableRoles } = useRoles(tenantId);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userCaps, setUserCaps] = useState<string[]>([]);
  const [savingCaps, setSavingCaps] = useState(false);
  const [expandedCats, setExpandedCats] = useState<string[]>(['PROJECTS', 'ADMIN']);

  const [inviteData, setInviteData] = useState({
    email: '',
    full_name: '',
    password: '',
    role: 'project_manager' as Role
  });
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<'role' | 'user'>('role');
  const [editingStrategy, setEditingStrategy] = useState<'role' | 'user'>('role');

  // Integration states for Tabs and project specific assignments
  const [activeTab, setActiveTab ] = useState<'directory' | 'roles' | 'approvals' | 'previewer'>('directory');
  const [selectedPreviewRole, setSelectedPreviewRole] = useState<string>('project_manager');
  const [selectedPreviewModule, setSelectedPreviewModule] = useState<string>('budget');
  const [simulationActionFeedback, setSimulationActionFeedback] = useState<{ action: string; allowed: boolean; reason?: string } | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [userProjects, setUserProjects] = useState<{ all_projects: boolean; project_ids: string[] }>({
    all_projects: true,
    project_ids: []
  });

  // Free-form Approval Workflows states
  const [chains, setChains] = useState<any[]>([]);
  const [loadingChains, setLoadingChains] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);

  useEffect(() => {
    loadUsers();
    const activeStrategy = (localStorage.getItem(`permission_strategy_${tenantId}`) || 'role') as 'role' | 'user';
    setStrategy(activeStrategy);

    // Load projects for user assignment
    supabase.from('projects')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name')
      .then(({ data }) => {
        if (data) setProjects(data);
      });
  }, [tenantId]);

  useEffect(() => {
    if (activeTab === 'approvals') {
      loadChains();
    }
  }, [activeTab]);

  useEffect(() => {
    if (editingUser) {
      loadUserCaps(editingUser.id);
      
      const savedStrategy = (localStorage.getItem(`permission_strategy_${editingUser.id}`) || 'role') as 'role' | 'user';
      setEditingStrategy(savedStrategy);

      // Load project assignment boundary
      const saved = localStorage.getItem(`user_project_assignments_${editingUser.id}`);
      if (saved) {
        try {
          setUserProjects(JSON.parse(saved));
        } catch {
          setUserProjects({ all_projects: true, project_ids: [] });
        }
      } else {
        const isGlobal = ['tenant_admin', 'director', 'project_coordinator'].includes(editingUser.role);
        setUserProjects({ all_projects: isGlobal, project_ids: [] });
      }
    }
  }, [editingUser]);

  // Load custom workflows helper
  const loadChains = async () => {
    setLoadingChains(true);
    try {
      const { data, error } = await supabase
        .from('tenant_approval_chains')
        .select('*')
        .eq('tenant_id', tenantId);

      if (error) {
        if (!error.message?.includes('public.tenant_approval_chains') && !error.message?.includes('does not exist')) {
          throw error;
        }
      }

      const initial = [
        { module_type: 'budget', chain_name: 'Budget Approval', steps_json: [{ level: 1, role: 'director', threshold_min: 0 }] },
        { module_type: 'variation', chain_name: 'Variation Approval', steps_json: [{ level: 1, role: 'contract_admin', threshold_min: 0 }] },
        { module_type: 'material_request', chain_name: 'Material Request Approval', steps_json: [{ level: 1, role: 'finance', threshold_min: 5000 }] },
        { module_type: 'daily_report', chain_name: 'Daily Report Approval', steps_json: [{ level: 1, role: 'project_manager', threshold_min: 0 }] }
      ];

      if (data && data.length > 0) {
        // Merge fetched and unique initial chains
        const merged = [...data];
        initial.forEach(initItem => {
          if (!merged.some(m => m.module_type === initItem.module_type)) {
            merged.push(initItem);
          }
        });
        setChains(merged);
      } else {
        setChains(initial);
      }
    } catch (e) {
      console.error('Error loading chains:', e);
    } finally {
      setLoadingChains(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, role, tenant_id, is_platform_god, is_active, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (e: any) {
      console.error('Error loading users:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUserCaps = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_capabilities')
        .select('capability')
        .eq('user_id', userId);

      if (error) {
        if (error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
          console.warn('User capabilities table not found in Supabase schema. Loading from localStorage fallback.');
          const fallbackStr = localStorage.getItem(`user_caps_fallback_${userId}`);
          setUserCaps(fallbackStr ? JSON.parse(fallbackStr) : []);
          return;
        }
        throw error;
      }
      const caps = data?.map(c => c.capability as string) || [];
      setUserCaps(caps);
      localStorage.setItem(`user_caps_fallback_${userId}`, JSON.stringify(caps));
    } catch (e: any) {
      console.warn('Handling load user capabilities fallback due to error:', e.message);
      const fallbackStr = localStorage.getItem(`user_caps_fallback_${userId}`);
      setUserCaps(fallbackStr ? JSON.parse(fallbackStr) : []);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: editingUser.full_name,
          role: editingUser.role,
          is_active: editingUser.is_active
        })
        .eq('id', editingUser.id);

      if (error) throw error;
      
      // Save project assignments
      localStorage.setItem(`user_project_assignments_${editingUser.id}`, JSON.stringify(userProjects));
      localStorage.setItem(`permission_strategy_${editingUser.id}`, editingStrategy);
      window.dispatchEvent(new Event('project-assignments-updated'));
      
      // If permission strategy is 'user', we might want to save capabilities too
      // but we handle that separately via toggle
      
      setEditingUser(null);
      loadUsers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewWorkflow = () => {
    if (!newWorkflowName.trim()) return;
    const moduleType = newWorkflowName.toLowerCase().replace(/\s+/g, '_');
    if (chains.some(c => c.module_type === moduleType)) {
      alert('A workflow with this name already exists');
      return;
    }
    const newChain = {
      module_type: moduleType,
      chain_name: newWorkflowName,
      steps_json: [
        { level: 1, role: 'director', threshold_min: 0 }
      ]
    };
    setChains([...chains, newChain]);
    setIsCreatingWorkflow(false);
    setNewWorkflowName('');
  };

  const handleSaveChains = async () => {
    setLoadingChains(true);
    try {
      for (const chain of chains) {
        const { error } = await supabase
          .from('tenant_approval_chains')
          .upsert({
            tenant_id: tenantId,
            module_type: chain.module_type,
            chain_name: chain.chain_name,
            steps_json: chain.steps_json,
            updated_at: new Date().toISOString()
          }, { onConflict: 'tenant_id, module_type' });
          
        if (error && !error.message?.includes('schema cache') && !error.message?.includes('does not exist')) {
          throw error;
        }
      }
      alert('Custom Approval Workflows saved successfully!');
    } catch (e: any) {
      alert('Saved workflows locally (Database bypassed): ' + e.message);
    } finally {
      setLoadingChains(false);
    }
  };

  const handleDeleteWorkflow = async (moduleType: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    try {
      const { error } = await supabase
        .from('tenant_approval_chains')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('module_type', moduleType);
        
      if (error && !error.message?.includes('schema cache') && !error.message?.includes('does not exist')) {
        throw error;
      }
      
      setChains(chains.filter(c => c.module_type !== moduleType));
    } catch (e: any) {
      console.error('Error deleting chain:', e);
      setChains(chains.filter(c => c.module_type !== moduleType));
    }
  };

  const toggleCapability = async (capId: string) => {
    if (!editingUser) return;
    setSavingCaps(true);

    const isRemoving = userCaps.includes(capId);
    const updatedCaps = isRemoving 
      ? userCaps.filter(id => id !== capId) 
      : [...userCaps, capId];

    // Always update localStorage first for instantaneous response and resilience
    localStorage.setItem(`user_caps_fallback_${editingUser.id}`, JSON.stringify(updatedCaps));
    setUserCaps(updatedCaps);

    try {
      if (isRemoving) {
        const { error } = await supabase
          .from('user_capabilities')
          .delete()
          .eq('user_id', editingUser.id)
          .eq('capability', capId);
        
        if (error && !error.message?.includes('schema cache') && !error.message?.includes('does not exist')) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('user_capabilities')
          .insert([{
            user_id: editingUser.id,
            tenant_id: tenantId,
            capability: capId
          }]);
        
        if (error && !error.message?.includes('schema cache') && !error.message?.includes('does not exist')) {
          throw error;
        }
      }
    } catch (e: any) {
      console.warn('Error syncing cap toggle to remote Supabase database, kept local backup:', e.message);
    } finally {
      setSavingCaps(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCats(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      if (users.some(u => u.email === inviteData.email)) {
        throw new Error('User with this email already exists in your company.');
      }

      if (inviteData.password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }

      const signupClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          }
        }
      );

      const { data: authData, error: authError } = await signupClient.auth.signUp({
        email: inviteData.email,
        password: inviteData.password,
        options: {
          data: {
            full_name: inviteData.full_name,
            tenant_id: tenantId,
            role: inviteData.role
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create authentication record.');

      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert([{
          id: authData.user.id,
          email: inviteData.email,
          full_name: inviteData.full_name,
          role: inviteData.role,
          tenant_id: tenantId,
          is_active: true
        }]);

      if (profileError) throw profileError;
      
      setIsInviting(false);
      setInviteData({ email: '', full_name: '', password: '', role: 'project_manager' });
      loadUsers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredRoles = allAvailableRoles.filter(r => r !== 'platform_god');
  const categories = Array.from(new Set(CAPABILITIES.map(c => c.category)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-border-subtle/40 pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-main">User Management & Controls</h1>
          <p className="text-sm text-ghost">Govern permissions, company custom roles, project boundaries and multi-level approval chains</p>
        </div>
        <button 
          onClick={() => setIsInviting(true)}
          className="bg-primary text-surface-base px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-all flex items-center gap-2 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Add Team Member
        </button>
      </div>

      {/* Tabs Selector Bar */}
      <div className="flex border-b border-border-subtle gap-2">
        <button
          onClick={() => setActiveTab('directory')}
          className={cn(
            "px-4 py-2 border-b-2 text-xs uppercase font-mono font-bold tracking-wider transition-all cursor-pointer",
            activeTab === 'directory' ? "border-primary text-primary" : "border-transparent text-ghost hover:text-dim"
          )}
        >
          Team Directory
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={cn(
            "px-4 py-2 border-b-2 text-xs uppercase font-mono font-bold tracking-wider transition-all cursor-pointer",
            activeTab === 'roles' ? "border-primary text-primary" : "border-transparent text-ghost hover:text-dim"
          )}
        >
          Custom Policy Roles
        </button>
        <button
          onClick={() => setActiveTab('previewer')}
          className={cn(
            "px-4 py-2 border-b-2 text-xs uppercase font-mono font-bold tracking-wider transition-all cursor-pointer",
            activeTab === 'previewer' ? "border-primary text-primary" : "border-transparent text-ghost hover:text-dim"
          )}
          title="Console Simulator"
        >
          Console Simulator
        </button>
      </div>

      {(isInviting || editingUser) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  {isInviting ? <UserPlus className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-main">{isInviting ? 'Add New Team Member' : 'Edit User Profile'}</h3>
                  <p className="text-[11px] text-dim">{isInviting ? 'Create a new login for your company' : `Modifying ${editingUser?.full_name}`}</p>
                </div>
              </div>
              <button 
                onClick={() => { setIsInviting(false); setEditingUser(null); }} 
                className="p-2 hover:bg-surface-2 rounded-full text-dim hover:text-main transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isInviting ? (
                <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-ghost">Full Name</label>
                      <input 
                        type="text"
                        required
                        className="bg-surface-2 border border-border-subtle rounded-lg text-sm p-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-main transition-all"
                        value={inviteData.full_name}
                        onChange={e => setInviteData({...inviteData, full_name: e.target.value})}
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-ghost">Email Address</label>
                      <input 
                        type="email"
                        required
                        className="bg-surface-2 border border-border-subtle rounded-lg text-sm p-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-main transition-all"
                        value={inviteData.email}
                        onChange={e => setInviteData({...inviteData, email: e.target.value})}
                        placeholder="john@company.com"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-ghost">Assigned Role</label>
                      <select 
                        className="bg-surface-2 border border-border-subtle rounded-lg text-sm p-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-main transition-all"
                        value={inviteData.role}
                        onChange={e => setInviteData({...inviteData, role: e.target.value as Role})}
                      >
                        {filteredRoles.map(r => (
                          <option key={r} value={r} className="bg-surface-1">{r.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-ghost">Initial Password</label>
                      <input 
                        type="password"
                        required
                        className="bg-surface-2 border border-border-subtle rounded-lg text-sm p-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-main transition-all"
                        value={inviteData.password}
                        onChange={e => setInviteData({...inviteData, password: e.target.value})}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  {error && (
                    <div className="md:col-span-2 bg-danger/10 border border-danger/20 rounded-xl p-4 flex items-center gap-3 text-danger text-xs font-medium">
                      <AlertCircle className="w-5 h-5 opacity-80" />
                      {error}
                    </div>
                  )}
                  <div className="md:col-span-2 flex justify-end gap-3 mt-4 pt-6 border-t border-border-subtle">
                    <button type="button" onClick={() => setIsInviting(false)} className="px-5 py-2.5 text-sm font-bold text-dim hover:text-main transition-colors">Cancel</button>
                    <button type="submit" disabled={loading} className="bg-primary text-surface-base px-8 py-2.5 rounded-lg text-sm font-bold hover:bg-primary/90 transition-all flex items-center gap-2">
                      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Create Account
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                  {/* Profile Edit Column */}
                  <div className="lg:col-span-2 space-y-6">
                    <form onSubmit={handleSaveUser} className="space-y-6">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-ghost">Full Name</label>
                          <input 
                            type="text"
                            required
                            className="bg-surface-2 border border-border-subtle rounded-lg text-sm p-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-main transition-all"
                            value={editingUser.full_name || ''}
                            onChange={e => setEditingUser({...editingUser, full_name: e.target.value})}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-ghost">Role</label>
                          <select 
                            className="bg-surface-2 border border-border-subtle rounded-lg text-sm p-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-main transition-all"
                            value={editingUser.role}
                            onChange={e => setEditingUser({...editingUser, role: e.target.value as Role})}
                          >
                            {filteredRoles.map(r => (
                              <option key={r} value={r} className="bg-surface-1">{r.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-ghost">Permission Strategy</label>
                          <div className="flex gap-2">
                            <button 
                              type="button"
                              onClick={() => setEditingStrategy('role')}
                              className={cn(
                                "flex-1 py-2 px-3 rounded-lg text-[10px] uppercase font-bold border transition-all",
                                editingStrategy === 'role' ? "bg-primary/10 border-primary text-primary" : "bg-surface-2 border-border-subtle text-dim"
                              )}
                            >Use Role Defaults</button>
                            <button 
                              type="button"
                              onClick={() => setEditingStrategy('user')}
                              className={cn(
                                "flex-1 py-2 px-3 rounded-lg text-[10px] uppercase font-bold border transition-all",
                                editingStrategy === 'user' ? "bg-primary/10 border-primary text-primary" : "bg-surface-2 border-border-subtle text-dim"
                              )}
                            >Bespoke Overrides</button>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-ghost">Account Status</label>
                          <div className="flex gap-2">
                            <button 
                              type="button"
                              onClick={() => setEditingUser({...editingUser, is_active: true})}
                              className={cn(
                                "flex-1 py-2 px-3 rounded-lg text-[11px] font-bold border transition-all",
                                editingUser.is_active ? "bg-primary/10 border-primary text-primary" : "bg-surface-2 border-border-subtle text-dim"
                              )}
                            >Active</button>
                            <button 
                              type="button"
                              onClick={() => setEditingUser({...editingUser, is_active: false})}
                              className={cn(
                                "flex-1 py-2 px-3 rounded-lg text-[11px] font-bold border transition-all",
                                !editingUser.is_active ? "bg-danger/10 border-danger text-danger" : "bg-surface-2 border-border-subtle text-dim"
                              )}
                            >Inactive</button>
                          </div>
                        </div>

                        {/* Project Access Boundaries */}
                        <div className="bg-surface-2 p-4 rounded-xl border border-border-subtle mt-1.5">
                          <div className="flex items-center gap-2 mb-3">
                            <Folder className="w-4 h-4 text-primary" />
                            <span className="text-xs font-bold text-main">Project Access Boundaries</span>
                          </div>
                          <div className="flex gap-2 mb-3">
                            <button 
                              type="button"
                              onClick={() => setUserProjects({ ...userProjects, all_projects: true })}
                              className={cn(
                                "flex-1 py-1.5 px-3 rounded-lg text-[10px] font-bold border transition-all uppercase tracking-wider",
                                userProjects.all_projects ? "bg-primary/10 border-primary text-primary" : "bg-surface-1 border-border-subtle text-dim"
                              )}
                            >All Projects</button>
                            <button 
                              type="button"
                              onClick={() => setUserProjects({ ...userProjects, all_projects: false })}
                              className={cn(
                                "flex-1 py-1.5 px-3 rounded-lg text-[10px] font-bold border transition-all uppercase tracking-wider",
                                !userProjects.all_projects ? "bg-primary/10 border-primary text-primary" : "bg-surface-1 border-border-subtle text-dim"
                              )}
                            >Specific List</button>
                          </div>

                          {!userProjects.all_projects && (
                            <div className="border border-border-subtle bg-surface-1 rounded-lg p-2 max-h-[140px] overflow-y-auto space-y-1 custom-scrollbar">
                              {projects.length === 0 ? (
                                <p className="text-[10px] text-ghost italic p-2 text-center">No projects registered</p>
                              ) : (
                                projects.map(proj => {
                                  const isChecked = userProjects.project_ids.includes(proj.id);
                                  return (
                                    <button
                                      type="button"
                                      key={proj.id}
                                      onClick={() => {
                                        const updatedIds = isChecked
                                          ? userProjects.project_ids.filter(id => id !== proj.id)
                                          : [...userProjects.project_ids, proj.id];
                                        setUserProjects({ ...userProjects, project_ids: updatedIds });
                                      }}
                                      className={cn(
                                        "w-full flex items-center justify-between p-2 rounded text-left text-xs transition-all",
                                        isChecked ? "bg-primary/5 text-primary" : "hover:bg-surface-2 text-dim"
                                      )}
                                    >
                                      <div className="flex flex-col min-w-0 pr-2">
                                        <span className="font-bold text-[11px] truncate">{proj.name}</span>
                                        <span className="text-[9px] text-ghost font-mono">{proj.project_code}</span>
                                      </div>
                                      <div className={cn(
                                        "w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0",
                                        isChecked ? "bg-primary border-primary text-surface-base" : "border-border-subtle"
                                      )}>
                                        {isChecked && <Check className="w-2.5 h-2.5" />}
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {error && (
                        <div className="bg-danger/10 border border-danger/20 rounded-xl p-3 flex items-center gap-2 text-danger text-[11px] font-medium">
                          <AlertCircle className="w-4 h-4" />
                          {error}
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button 
                          type="submit" 
                          disabled={loading}
                          className="flex-1 bg-primary text-surface-base px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Update Profile
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Capabilities Column */}
                  <div className="lg:col-span-3 h-full min-h-[400px] border-l border-border-subtle pl-8">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-main">Capabilities Overrides</h4>
                    </div>

                    {editingStrategy === 'role' ? (
                      <div className="bg-warning/10 border border-warning/20 text-warning px-3 py-2 rounded-lg text-[11px] flex items-start gap-2 mb-4 leading-relaxed">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-bold">Role Defaults Strategy Active:</span> Custom bespoke capability overrides below will only take effect if you set this user's Permission Strategy to <b>Bespoke Overrides</b>.
                        </div>
                      </div>
                    ) : (
                      <div className="bg-primary/10 border border-primary/20 text-primary px-3 py-2 rounded-lg text-[11px] flex items-start gap-2 mb-4 leading-relaxed">
                        <Check className="w-4 h-4 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-bold">Bespoke Overrides Strategy Active:</span> Overrides are currently <b>Live and Active</b>. This user executes with precisely the selected capabilities.
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-4 pr-2 max-h-[60vh] overflow-y-auto">
                      {categories.map(cat => (
                        <div key={cat} className="bg-surface-2 rounded-xl border border-border-subtle overflow-hidden">
                          <button 
                            onClick={() => toggleCategory(cat)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-3 transition-colors"
                          >
                            <span className="text-[10px] font-bold uppercase tracking-widest text-ghost">{cat}</span>
                            <ChevronDown className={cn("w-4 h-4 text-dim transition-transform", expandedCats.includes(cat) && "rotate-180")} />
                          </button>
                          
                          {expandedCats.includes(cat) && (
                            <div className="p-2 space-y-1 bg-surface-1 border-t border-border-subtle">
                              {CAPABILITIES.filter(c => c.category === cat).map(cap => {
                                const isActive = userCaps.includes(cap.id);
                                return (
                                  <button
                                    key={cap.id}
                                    onClick={() => toggleCapability(cap.id)}
                                    disabled={savingCaps}
                                    className={cn(
                                      "w-full flex items-center justify-between p-2.5 rounded-lg border transition-all text-left group",
                                      isActive ? "bg-primary/5 border-primary/20" : "bg-transparent border-transparent hover:bg-surface-2"
                                    )}
                                  >
                                    <div className="flex flex-col gap-0.5">
                                      <span className={cn("text-xs font-bold", isActive ? "text-primary" : "text-main")}>{cap.label}</span>
                                      <span className="text-[10px] text-dim">{cap.description}</span>
                                    </div>
                                    <div className={cn(
                                      "w-5 h-5 rounded-md flex items-center justify-center transition-all",
                                      isActive ? "bg-primary text-surface-base" : "bg-surface-3 border border-border-subtle"
                                    )}>
                                      {isActive && <Check className="w-3 h-3" />}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'directory' && (
        <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden shadow-sm animate-in fade-in duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-2 border-b border-border-subtle">
                  <th className="font-mono text-[10px] uppercase tracking-widest text-dim px-6 py-4">Team Member</th>
                  <th className="font-mono text-[10px] uppercase tracking-widest text-dim px-6 py-4">Role</th>
                  <th className="font-mono text-[10px] uppercase tracking-widest text-dim px-6 py-4">Status</th>
                  <th className="font-mono text-[10px] uppercase tracking-widest text-dim px-6 py-4">Joined</th>
                  <th className="px-6 py-4 flex items-center justify-end font-mono text-[10px] uppercase tracking-widest text-dim pr-10">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-24 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto opacity-40" />
                      <p className="mt-4 text-xs font-medium text-dim">Loading secure directory...</p>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-24 text-center text-dim">
                      <Mail className="w-8 h-8 opacity-20 mx-auto mb-2" />
                      <div className="text-sm font-medium">No team members found</div>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-white/[0.01] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-9 h-9 rounded-full bg-surface-2 border border-border-subtle flex items-center justify-center text-primary font-bold text-xs ring-4 ring-transparent group-hover:ring-primary/5 transition-all">
                              {user.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                            </div>
                            {user.is_active && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-primary border-2 border-surface-1 rounded-full" />}
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="text-sm font-bold text-main truncate">{user.full_name}</div>
                            <div className="text-[11px] text-dim truncate">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-accent/5 text-accent text-[10px] font-bold uppercase tracking-wider border border-accent/10">
                          {user.role?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
                          user.is_active 
                            ? "bg-primary/10 text-primary border-primary/20" 
                            : "bg-danger/10 text-danger border-danger/20"
                        )}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px] text-dim whitespace-nowrap">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending'}
                      </td>
                      <td className="px-6 py-4 text-right pr-10">
                        <button 
                          onClick={() => setEditingUser(user)}
                          className="p-1.5 text-dim hover:bg-surface-2 hover:text-primary rounded-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="animate-in fade-in duration-200">
          <RoleManagement 
            userRole={(currentUserRole || 'project_manager') as Role} 
            isPlatformGod={currentUserRole === 'platform_god'} 
          />
        </div>
      )}

      {activeTab === 'previewer' && (currentUserRole !== 'tenant_admin' && currentUserRole !== 'platform_god') && (
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-12 max-w-lg mx-auto text-center space-y-4 shadow-sm my-12 animate-in fade-in duration-300">
          <ShieldAlert className="w-12 h-12 text-danger mx-auto animate-bounce" />
          <h3 className="text-base font-bold text-main">Administrative Security Seal Active</h3>
          <p className="text-xs text-dim leading-relaxed">
            The Console Simulator matches live whitelists, allowed modules, and core restrictions of other users. Access to simulated environments is restricted exclusively to the <b>Tenant Administrator</b>.
          </p>
        </div>
      )}

      {activeTab === 'previewer' && (currentUserRole === 'tenant_admin' || currentUserRole === 'platform_god') && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-in fade-in duration-300">
          {/* Simulator Control Column */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center gap-2 border-b border-border-subtle/50 pb-3">
                <Fingerprint className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-sm font-bold text-main">Active Role Simulator</h3>
                  <p className="text-[10px] text-ghost font-medium">Select a corporate role default state</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'project_manager', label: 'Project Manager' },
                  { id: 'site_supervisor', label: 'Site Supervisor' },
                  { id: 'finance', label: 'Finance Staff' },
                  { id: 'client', label: 'External Client' }
                ].map((roleOpt) => {
                  const isCurSimulated = selectedPreviewRole === roleOpt.id;
                  return (
                    <button
                      key={roleOpt.id}
                      onClick={() => {
                        setSelectedPreviewRole(roleOpt.id);
                        setSimulationActionFeedback(null);
                        // Reset mock sub-module preview if unauthorized for new simulated role
                        const defaultSubModuleMapping: Record<string, string> = {
                          project_manager: 'budget',
                          site_supervisor: 'warehouse',
                          finance: 'budget',
                          client: 'dashboard'
                        };
                        setSelectedPreviewModule(defaultSubModuleMapping[roleOpt.id] || 'budget');
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center p-3.5 rounded-xl border transition-all text-center gap-2 cursor-pointer group",
                        isCurSimulated 
                          ? "bg-primary/5 border-primary text-primary" 
                          : "bg-surface-2 border-border-subtle text-dim hover:text-main"
                      )}
                    >
                      <div className={cn("p-1.5 rounded-lg transition-all", isCurSimulated ? "bg-primary/15" : "bg-surface-1 group-hover:bg-surface-3")}>
                        <Fingerprint className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider truncate w-full">{roleOpt.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* simulated role description */}
              <div className="bg-surface-2 p-3.5 rounded-xl border border-border-subtle/50">
                <span className="text-[9px] font-mono font-bold uppercase text-ghost tracking-widest block mb-1">Functional Description</span>
                <p className="text-xs text-dim leading-relaxed">
                  {selectedPreviewRole === 'project_manager' && "Authorized to plan cost boundaries, submit internal budgets, view surveys, and build BoQ recipe structures."}
                  {selectedPreviewRole === 'site_supervisor' && "On-site executor focused on daily progress records, receiving warehouse stocks (GRNs), and requesting field materials."}
                  {selectedPreviewRole === 'finance' && "Responsible for supplier invoices, general company overhead claims, budget margin audits, and release clearances."}
                  {selectedPreviewRole === 'client' && "Read-only access limits. Stakeholders can only view schedule tracking calendars and performance audit metrics."}
                </p>
              </div>
            </div>

            {/* Simulated Whitelist Checkbench */}
            <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center gap-2 border-b border-border-subtle/50 pb-3">
                <Settings className="w-5 h-5 text-accent" />
                <div>
                  <h3 className="text-sm font-bold text-main">System Operations Testbed</h3>
                  <p className="text-[10px] text-ghost font-medium">Verify actions permitted to this group</p>
                </div>
              </div>

              <div className="space-y-2">
                {[
                  { 
                    action: 'Update BOQ Contract values', 
                    rules: { project_manager: true, site_supervisor: false, finance: false, client: false }, 
                    reason: 'QS boundary validation policy' 
                  },
                  { 
                    action: 'Process GRN Materials Receipts', 
                    rules: { project_manager: false, site_supervisor: true, finance: false, client: false }, 
                    reason: 'Physical receipt on-site required' 
                  },
                  { 
                    action: 'Approve Spends > $10,000 threshold', 
                    rules: { project_manager: false, site_supervisor: false, finance: true, client: false }, 
                    reason: 'Delegated spending guidelines restrict block' 
                  },
                  { 
                    action: 'Alter System Security & Roles', 
                    rules: { project_manager: false, site_supervisor: false, finance: false, client: false }, 
                    reason: 'Requires full tenant_admin credentials' 
                  }
                ].map((actCheck) => {
                  const simulatedRoleHasAccess = actCheck.rules[selectedPreviewRole as keyof typeof actCheck.rules];
                  return (
                    <button
                      key={actCheck.action}
                      onClick={() => {
                        setSimulationActionFeedback({
                          action: actCheck.action,
                          allowed: simulatedRoleHasAccess,
                          reason: simulatedRoleHasAccess ? undefined : actCheck.reason
                        });
                      }}
                      className="w-full flex items-center justify-between p-2.5 bg-surface-2 border border-border-subtle/50 hover:bg-surface-3 rounded-lg text-left text-xs transition-colors cursor-pointer group"
                    >
                      <span className="font-medium text-dim group-hover:text-main truncate pr-2">{actCheck.action}</span>
                      <div className={cn(
                        "w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold",
                        simulatedRoleHasAccess ? "bg-primary/15 text-primary" : "bg-danger/10 text-danger"
                      )}>
                        {simulatedRoleHasAccess ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {simulationActionFeedback && (
                <div className={cn(
                  "p-3.5 rounded-xl border animate-in slide-in-from-top-2 duration-200 mt-2",
                  simulationActionFeedback.allowed 
                    ? "bg-primary/5 border-primary/20 text-primary" 
                    : "bg-danger/10 border-danger/20 text-danger"
                )}>
                  <div className="flex items-center gap-2 mb-1.5">
                    {simulationActionFeedback.allowed ? <Check className="w-4 h-4 font-black" /> : <Ban className="w-4 h-4" />}
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider">
                      {simulationActionFeedback.allowed ? "ACCESS GRANTED" : "ACCESS BLOCKED"}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-main">
                    {simulationActionFeedback.allowed 
                      ? `Task "${simulationActionFeedback.action}" successfully bypassed system security policies for ${selectedPreviewRole.replace(/_/g, ' ')}.`
                      : `Action restricted. Reason: ${simulationActionFeedback.reason}.`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Console Mock View */}
          <div className="lg:col-span-3 flex flex-col bg-surface-2 border border-border-subtle rounded-xl overflow-hidden shadow-xs h-full min-h-[500px]">
            {/* Mock Header */}
            <div className="bg-surface-3/80 border-b border-border-subtle p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-danger/55" />
                  <span className="w-2.5 h-2.5 rounded-full bg-warning/55" />
                  <span className="w-2.5 h-2.5 rounded-full bg-primary/55" />
                </div>
                <div className="w-px h-3 bg-border-subtle mx-1" />
                <span className="text-[10px] font-mono font-bold tracking-tight text-ghost">CONSOLESANDBOX_PREVIEW_V.1.0</span>
              </div>
              <div className="flex items-center gap-2 bg-surface-1/50 border border-border-subtle px-2.5 py-1 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[9px] font-mono uppercase font-bold text-dim">Simulating {selectedPreviewRole}</span>
              </div>
            </div>

            <div className="flex-1 flex min-h-0">
              {/* Mock Left Navigation Bar */}
              <div className="w-40 bg-surface-3/50 border-r border-border-subtle flex flex-col p-2 gap-1 select-none">
                <span className="text-[8px] font-mono uppercase font-bold tracking-widest text-ghost mb-2 px-2">Simulated Panels</span>
                {[
                  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid, minRules: ['client', 'project_manager'] },
                  { id: 'planning', label: 'BoQ Manager', icon: Folder, minRules: ['project_manager'] },
                  { id: 'budget', label: 'Cost & Budget', icon: Calculator, minRules: ['finance', 'project_manager'] },
                  { id: 'warehouse', label: 'Warehouse File', icon: Package, minRules: ['site_supervisor'] }
                ].map((mockTab) => {
                  const isSimAuthorised = mockTab.minRules.includes(selectedPreviewRole);
                  const isSelect = selectedPreviewModule === mockTab.id;
                  return (
                    <button
                      key={mockTab.id}
                      onClick={() => {
                        setSelectedPreviewModule(mockTab.id);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 p-2 rounded-lg text-left text-[11px] font-bold tracking-tight border transition-all cursor-pointer",
                        isSelect 
                          ? "bg-surface-base border-border-subtle text-main" 
                          : "bg-transparent border-transparent text-dim hover:text-main"
                      )}
                    >
                      <mockTab.icon className={cn("w-3.5 h-3.5", isSelect ? "text-primary" : "text-ghost")} />
                      <span className="truncate flex-1">{mockTab.label}</span>
                      {!isSimAuthorised && <Lock className="w-2.5 h-2.5 text-danger shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Mock Main Dashboard View */}
              <div className="flex-1 bg-surface-base p-6 overflow-y-auto relative">
                {(() => {
                  const isCurrentModuleAuthorised = [
                    { id: 'dashboard', minRules: ['client', 'project_manager'] },
                    { id: 'planning', minRules: ['project_manager'] },
                    { id: 'budget', minRules: ['finance', 'project_manager'] },
                    { id: 'warehouse', minRules: ['site_supervisor'] }
                  ].find(m => m.id === selectedPreviewModule)?.minRules.includes(selectedPreviewRole);

                  if (!isCurrentModuleAuthorised) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 animate-in fade-in duration-300">
                        <div className="w-12 h-12 rounded-full bg-danger/10 border border-danger/20 flex items-center justify-center text-danger mx-auto">
                          <Lock className="w-5 h-5 animate-pulse" />
                        </div>
                        <h4 className="text-xs font-bold text-main whitespace-nowrap">Security Check: Module Restricted</h4>
                        <p className="text-[11px] text-dim max-w-[210px] mx-auto leading-relaxed">
                          Your active corporate policies deny access to this screen. In contrast to admins, this role requires specific capabilities whitelisted.
                        </p>
                        <div className="p-2 bg-surface-2 rounded-md border border-border-subtle">
                          <span className="text-[8px] font-mono font-bold text-ghost uppercase tracking-wider">Required Clearance: {selectedPreviewModule === 'budget' ? 'fin:view_budget' : selectedPreviewModule === 'planning' ? 'boq:view_recipes' : 'stock:view'}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="h-full space-y-4 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between border-b border-border-subtle/50 pb-2.5">
                        <div className="flex items-center gap-1.5">
                          <Unlock className="w-3.5 h-3.5 text-primary" />
                          <h4 className="text-xs font-bold text-main uppercase tracking-wider">{selectedPreviewModule.replace(/-/g, ' ')} VIEW</h4>
                        </div>
                        <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-[#24ce24] bg-[#24ce24]/10 border border-[#24ce24]/20 px-1.5 py-0.5 rounded">
                          ● ONLINE
                        </span>
                      </div>

                      {/* Mock UI Contents per tab selection */}
                      {selectedPreviewModule === 'dashboard' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-surface-2 p-3 rounded-lg border border-border-subtle text-left">
                              <span className="text-[10px] text-ghost block mb-0.5">Project S-Curve</span>
                              <span className="text-sm font-bold text-main">72.4%</span>
                              <div className="w-full h-1 bg-surface-3 rounded-full mt-1.5 overflow-hidden">
                                <div className="w-[72%] h-full bg-accent" />
                              </div>
                            </div>
                            <div className="bg-surface-2 p-3 rounded-lg border border-border-subtle text-left">
                              <span className="text-[10px] text-ghost block mb-0.5">Delivery Audit</span>
                              <span className="text-sm font-bold text-[#24ce24]">Healthy</span>
                            </div>
                          </div>
                          <div className="bg-surface-2/40 border border-border-subtle rounded-lg p-3 text-left">
                            <div className="text-[10px] text-ghost mb-2">Milestones Timeline</div>
                            <div className="space-y-1.5 font-mono text-[9px] text-dim">
                              <div>✓ Foundations Concrete Poured - MAR 26</div>
                              <div>✓ Section Block Grid A locked - APR 26</div>
                              <div className="text-primary animate-pulse">→ Current: Steel Reinforcements framing - MAY 26</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedPreviewModule === 'planning' && (
                        <div className="space-y-3">
                          <div className="bg-surface-2 p-3 rounded-lg border border-border-subtle text-left space-y-1">
                            <span className="text-[10px] text-ghost block">Bill of Quantities active list</span>
                            <span className="text-sm font-extrabold text-main">Contract Sum: $1,420,000</span>
                          </div>

                          <div className="bg-surface-2 rounded-lg p-3 space-y-2 text-left">
                            <div className="text-[10px] font-bold text-main">BOQ Core Columns (Adjustable):</div>
                            <div className="space-y-1.5 text-[11px] text-dim">
                              <div className="flex justify-between border-b border-border-subtle/50 pb-1">
                                <span>Steel Grate Section B</span>
                                <span className="font-bold text-main">40 Tons</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Concrete Mix 40MP</span>
                                <span className="font-bold text-main">120 m³</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedPreviewModule === 'budget' && (
                        <div className="space-y-3 text-left">
                          <div className="bg-surface-2 p-3 rounded-lg border border-border-subtle grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[9px] text-[#24ce24] font-bold uppercase block mb-0.5">Budget Cap</span>
                              <span className="text-sm font-bold text-main">$145,000</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-ghost font-bold uppercase block mb-0.5">Current Spend</span>
                              <span className="text-sm font-bold text-warning">$89,450</span>
                            </div>
                          </div>

                          <div className="bg-surface-2/60 border border-border-subtle rounded-lg p-3">
                            <span className="text-[10px] text-ghost uppercase font-mono block mb-2">Interactive Triggers</span>
                            <div className="flex gap-2">
                              {selectedPreviewRole === 'finance' ? (
                                <button className="flex-1 py-1.5 px-3 bg-[#24ce24]/10 text-[#24ce24] hover:bg-[#24ce24]/20 border border-[#24ce24]/20 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer">
                                  Match Supplier Invoice
                                </button>
                              ) : (
                                <button className="flex-1 py-1.5 px-3 bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer">
                                  Submit Budget Proposal
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedPreviewModule === 'warehouse' && (
                        <div className="space-y-3">
                          <div className="bg-surface-2 p-3 rounded-lg border border-border-subtle text-left space-y-1">
                            <span className="text-[10px] text-ghost block">Concrete Block Reserve Stockpile</span>
                            <span className="text-sm font-bold text-main">4,200 Units</span>
                          </div>
                          <div className="bg-surface-2 rounded-lg p-3 space-y-2 text-left">
                            <div className="text-[10px] font-bold text-main">Live Operations Menu:</div>
                            <button className="w-full text-center py-2 bg-primary text-surface-base font-bold text-[10px] uppercase rounded-lg shadow-sm cursor-pointer hover:bg-primary/95">
                              Log Materials Receipt (GRN)
                            </button>
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
