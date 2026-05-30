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
  Ban,
  Calendar,
  CheckCircle,
  GitBranch,
  Clock,
  Users as UsersIcon,
  Bell,
  BookOpen,
  ShieldCheck,
  Activity,
  BrainCircuit,
  Globe,
  Shapes,
  Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Role, UserProfile } from '../types';
import { ROLES, CAPABILITIES } from '../constants/capabilities';
import { useRoles } from '../hooks/useRoles';
import { RoleManagement } from './RoleManagement';
import { DEFAULT_ROLE_CAPABILITIES } from '../hooks/usePermissions';

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
  const [activeTab, setActiveTab ] = useState<'directory' | 'previewer'>('directory');
  const [selectedPreviewUserOrRole, setSelectedPreviewUserOrRole] = useState<string>('role:project_manager');
  const [selectedPreviewModule, setSelectedPreviewModule] = useState<string>('dashboard');
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

  // Simulated cockpit interactive sandbox states
  const [simulatedChecklist, setSimulatedChecklist] = useState([
    { id: 'chk-1', task: 'HSE Committee setup', completed: true },
    { id: 'chk-2', task: 'Local zoning council permits', completed: true },
    { id: 'chk-3', task: 'Initial staff scheduling assignment', completed: false },
    { id: 'chk-4', task: 'Safety signage deployment and hazard logs config', completed: false }
  ]);

  const [simulatedBaselineLocked, setSimulatedBaselineLocked] = useState(false);

  const [simulatedBoq, setSimulatedBoq] = useState([
    { id: 'boq-1', item: 'Steel Grate Section B', quantity: '40', unit: 'Tons' },
    { id: 'boq-2', item: 'Concrete Mix 40MPA', quantity: '120', unit: 'm³' },
    { id: 'boq-3', item: 'Aggregate base fill', quantity: '250', unit: 'm³' }
  ]);

  const [simulatedMilestoneProgress, setSimulatedMilestoneProgress] = useState(40);

  const [simulatedVariations, setSimulatedVariations] = useState([
    { id: 'vo-1', claim: 'VO-14 Grid B foundations offset', amount: 24500, approved: false },
    { id: 'vo-2', claim: 'VO-15 Steel gauge thickness adjustment', amount: 3200, approved: false }
  ]);

  const [simulatedBudget, setSimulatedBudget] = useState({ limit: 145000, spend: 89450 });

  const [simulatedDailyLogs, setSimulatedDailyLogs] = useState([
    { id: 'log-1', detail: 'Concrete poured at structural column block A by site crew', reporter: 'supervisor_blueprint' }
  ]);

  const [simulatedSubcontractors, setSimulatedSubcontractors] = useState([
    { id: 'sub-1', name: 'Prestige Foundations Ltd', status: 'Contract Live', trade: 'Groundworks' },
    { id: 'sub-2', name: 'Apex Steel Frame Erectors', status: 'Awaiting mobilization', trade: 'Steel frames' }
  ]);

  const [simulatedApprovals, setSimulatedApprovals] = useState([
    { id: 'appr-1', item: 'Material Purchase Order #14092 Requisition', amount: 12450, approved: false },
    { id: 'appr-2', item: 'Site Overtime Allowance claims batch #2', amount: 1850, approved: false }
  ]);

  const [simulatedAlerts, setSimulatedAlerts] = useState([
    { id: 'alert-1', message: 'High Temperature Advisory: Heat forecast 34°C on Jund 2nd', severity: 'warning', active: true }
  ]);

  const [simulatedTenders, setSimulatedTenders] = useState([
    { id: 'tender-1', title: 'RFQ-12 Foundation Steel reinforcements', status: '3 bids received' }
  ]);

  const [simulatedWarehouse, setSimulatedWarehouse] = useState({ stock: 4200 });

  // Internal inputs states inside mockup terminal
  const [newBoqItemName, setNewBoqItemName] = useState('');
  const [newBoqItemQty, setNewBoqItemQty] = useState('');
  const [newBoqItemUnit, setNewBoqItemUnit] = useState('m³');

  const [newVoClaimName, setNewVoClaimName] = useState('');
  const [newVoClaimAmount, setNewVoClaimAmount] = useState('');

  const [newDailyLogDetail, setNewDailyLogDetail] = useState('');

  const [newSubconName, setNewSubconName] = useState('');
  const [newSubconTrade, setNewSubconTrade] = useState('');

  const [newRfqTitle, setNewRfqTitle] = useState('');


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
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-all flex items-center gap-2 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Add Team Member
        </button>
      </div>

      {/* Tabs Selector Bar */}
      <div className="flex bg-surface-1 p-1 rounded-xl border border-border-subtle gap-1 overflow-x-auto self-start">
        <button 
          onClick={() => setActiveTab('directory')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
            activeTab === 'directory' ? "bg-surface-2 text-primary shadow-sm animate-in fade-in zoom-in-95" : "text-ghost hover:text-main"
          )}
        >
          <UsersIcon className="w-4 h-4" />
          Team Directory
        </button>
        <button 
          onClick={() => setActiveTab('previewer')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
            activeTab === 'previewer' ? "bg-surface-2 text-[#24ce24] shadow-sm animate-in fade-in zoom-in-95" : "text-ghost hover:text-[#24ce24]"
          )}
        >
          <Fingerprint className="w-4 h-4" />
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
                    <button type="submit" disabled={loading} className="bg-primary text-white px-8 py-2.5 rounded-lg text-sm font-bold hover:bg-primary/90 transition-all flex items-center gap-2">
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
                                        isChecked ? "bg-primary border-primary text-white" : "border-border-subtle"
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
                          className="flex-1 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
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
                                      isActive ? "bg-primary text-white" : "bg-surface-3 border border-border-subtle"
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

      {/* Active simulation and preview block */}

      {activeTab === 'previewer' && (currentUserRole !== 'tenant_admin' && currentUserRole !== 'platform_god') && (
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-12 max-w-lg mx-auto text-center space-y-4 shadow-sm my-12 animate-in fade-in duration-300">
          <ShieldAlert className="w-12 h-12 text-danger mx-auto animate-bounce" />
          <h3 className="text-base font-bold text-main">Administrative Security Seal Active</h3>
          <p className="text-xs text-dim leading-relaxed">
            The Console Simulator matches live whitelists, allowed modules, and core restrictions of other users. Access to simulated environments is restricted exclusively to the <b>Tenant Administrator</b>.
          </p>
        </div>
      )}

      {activeTab === 'previewer' && (currentUserRole === 'tenant_admin' || currentUserRole === 'platform_god') && (() => {
        // Resolve selected simulation params
        let userObj: UserProfile | null = null;
        let r: Role = 'project_manager';
        let strat = 'role';
        
        if (selectedPreviewUserOrRole.startsWith('user:')) {
          const uid = selectedPreviewUserOrRole.substring(5);
          userObj = users.find(u => u.id === uid) || null;
          if (userObj) {
            r = userObj.role as Role;
            strat = localStorage.getItem(`permission_strategy_${userObj.id}`) || 'role';
          }
        } else {
          r = selectedPreviewUserOrRole.substring(5) as Role;
        }

        let caps = new Set<string>();
        if (userObj && strat === 'user') {
          const saved = localStorage.getItem(`user_caps_fallback_${userObj.id}`);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              caps = new Set<string>(parsed);
            } catch {
              caps = new Set<string>(DEFAULT_ROLE_CAPABILITIES[r] || []);
            }
          } else {
            caps = new Set<string>(DEFAULT_ROLE_CAPABILITIES[r] || []);
          }
        } else {
          caps = new Set<string>(DEFAULT_ROLE_CAPABILITIES[r] || []);
        }

        const simulatedCaps = caps;
        const simulatedRole = r;
        const simulatedUser = userObj;
        const simulatedStrategy = strat;

        // Simulator sandbox capability checkers
        const hasSetChecklist = simulatedCaps.has('proj:set_checklists');
        const hasLockBaseline = simulatedCaps.has('plan:lock_baseline');
        const hasAddBoq = simulatedCaps.has('boq:add_item') || simulatedCaps.has('boq:edit_contract');
        const hasUpdateProgress = simulatedCaps.has('plan:update_progress');
        const hasVarCreate = simulatedCaps.has('fin:var_create') || simulatedCaps.has('fin:claim_create');
        const hasEditBudget = simulatedCaps.has('fin:edit_budget');
        const hasDailySubmit = simulatedCaps.has('daily:submit');
        const hasSubconManage = simulatedCaps.has('res:subcon_manage');
        const hasApprove = simulatedCaps.has('appr:approve');
        const hasAlertDismiss = simulatedCaps.has('alert:dismiss');
        const hasCreateRfq = simulatedCaps.has('proc:create_rfq');
        const hasGrn = simulatedCaps.has('stock:grn_step1');
        const hasEditRole = simulatedCaps.has('admin:edit_role');
        const hasCreateUser = simulatedCaps.has('admin:create_user');
        const hasSetLogic = simulatedCaps.has('appr:set_logic') || simulatedCaps.has('appr:manage');

        // Custom MOCK items representing the real layout NAV_ITEMS
        const MOCK_NAV_ITEMS = [
          { section: 'OVERVIEW', id: 'home',      label: 'Home',      icon: LayoutGrid, capability: null },
          
          { section: 'INSIGHTS', id: 'dashboard', label: 'Portfolio', icon: Shapes, capability: 'dash:view' },
          { section: 'INSIGHTS', id: 'intelligence', label: 'Intelligence', icon: BrainCircuit, capability: 'intel:view' },
          { section: 'INSIGHTS', id: 'client-portal', label: 'Client view', icon: Globe, capability: 'client:view' },

          { section: 'PLANNING', id: 'project-setup', label: 'Project setup', icon: CheckCircle, capability: 'proj:view_all' },
          { section: 'PLANNING', id: 'governance',    label: 'Governance & SoT', icon: ShieldCheck, capability: 'boq:manage_baseline' },
          { section: 'PLANNING', id: 'planning',   label: 'BoQ',  icon: Calendar, capability: 'boq:view_recipes' },
          { section: 'PLANNING', id: 'schedule',   label: 'Schedule',  icon: Clock, capability: 'plan:view' },
          { section: 'PLANNING', id: 'variations',     label: 'Contract claims',     icon: GitBranch, capability: 'fin:var_view' },
          { section: 'PLANNING', id: 'budget',    label: 'Cost & budget', icon: Calculator, capability: 'fin:view_budget' },

          { section: 'EXECUTION', id: 'operations-hub', label: 'Operations', icon: Activity, capability: 'daily:view_project' },
          { section: 'EXECUTION', id: 'subcontractors', label: 'Subcontractors', icon: UsersIcon,      capability: 'res:subcon_view' },
          { section: 'EXECUTION', id: 'approvals',  label: 'Approvals', icon: CheckCircle, capability: 'appr:view_pending' },
          { section: 'EXECUTION', id: 'alerts',     label: 'Alerts',    icon: Bell, capability: 'alert:view' },

          { section: 'SUPPLY CHAIN', id: 'procurement', label: 'Procurement', icon: ShoppingCart, capability: 'proc:view_demand' },
          { section: 'SUPPLY CHAIN', id: 'warehouse', label: 'Supply hub', icon: Package, capability: 'stock:view' },

          { section: 'REFERENCE', id: 'library', label: 'Library', icon: BookOpen, capability: 'trade:view_global' },

          { section: 'ADMIN', id: 'users',          label: 'Team',    icon: UserPlus, capability: 'admin:view_users' },
          { section: 'ADMIN', id: 'permissions',    label: 'Role permissions',   icon: ShieldCheck, capability: 'admin:view_roles' },
          { section: 'ADMIN', id: 'approval-config',label: 'Platform settings',    icon: Settings,   capability: 'appr:view_chains' },
        ];

        // Filter items dynamically using identical logic to Layout.tsx
        const hasAdminView = simulatedCaps.has('admin:view_users') || simulatedCaps.has('admin:view_roles');
        const filteredMockNavItems = MOCK_NAV_ITEMS.filter(item => {
          if (item.section === 'ADMIN') {
            if (!hasAdminView && item.capability && !simulatedCaps.has(item.capability)) {
              return false;
            }
          } else {
            if (item.capability && !simulatedCaps.has(item.capability)) {
              return false;
            }
          }
          return true;
        });

        // Ensure selectedPreviewModule has a fallback to the first active screen
        const isCurrentModuleAuthorised = filteredMockNavItems.some(m => m.id === selectedPreviewModule);
        const activePreviewModule = isCurrentModuleAuthorised 
          ? selectedPreviewModule 
          : (filteredMockNavItems[0]?.id || 'dashboard');

        let lastSection = '';

        return (
          <div className="flex flex-col gap-6 animate-in fade-in duration-300">
            {/* Elegant Dropdown Control Top Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between bg-surface-1 border border-border-subtle p-5 rounded-2xl shadow-xs gap-4">
              <div className="flex flex-col text-left">
                <h3 className="text-sm font-bold text-main">Select Profile or Role to Simulate</h3>
                <p className="text-xs text-dim">Isolate core compliance rules and render precise permissions-based layouts</p>
              </div>
              <div className="w-full md:w-96 text-left">
                <select
                  value={selectedPreviewUserOrRole}
                  onChange={(e) => {
                    setSelectedPreviewUserOrRole(e.target.value);
                    setSimulationActionFeedback(null);
                    
                    // Route default modules based on active simulated role
                    const resolvedVal = e.target.value;
                    let targetRole: Role = 'project_manager';
                    if (resolvedVal.startsWith('user:')) {
                      const foundUser = users.find(u => u.id === resolvedVal.substring(5));
                      if (foundUser) targetRole = foundUser.role as Role;
                    } else {
                      targetRole = resolvedVal.substring(5) as Role;
                    }

                    const defaultSubModuleMapping: Record<Role, string> = {
                      project_manager: 'dashboard',
                      site_supervisor: 'operations-hub',
                      finance: 'budget',
                      client: 'client-portal',
                      tenant_admin: 'dashboard',
                      director: 'dashboard',
                      project_coordinator: 'dashboard',
                      contract_admin: 'variations',
                      qs: 'planning',
                      procurement: 'procurement',
                      site_encoder: 'operations-hub',
                      storeman: 'warehouse',
                      platform_god: 'dashboard'
                    };
                    const defaultModule = defaultSubModuleMapping[targetRole] || 'dashboard';
                    setSelectedPreviewModule(defaultModule);
                  }}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl text-xs font-bold p-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-main transition-all font-sans cursor-pointer"
                >
                  <optgroup label="System Role Templates" className="bg-surface-1 font-bold text-ghost text-[10px]">
                    <option value="role:project_manager" className="font-sans text-xs text-main">Role Blueprint: Project Manager</option>
                    <option value="role:site_supervisor" className="font-sans text-xs text-main">Role Blueprint: Site Supervisor</option>
                    <option value="role:finance" className="font-sans text-xs text-main">Role Blueprint: Finance Staff</option>
                    <option value="role:client" className="font-sans text-xs text-main">Role Blueprint: External Client</option>
                    <option value="role:director" className="font-sans text-xs text-main">Role Blueprint: Director</option>
                    <option value="role:tenant_admin" className="font-sans text-xs text-main">Role Blueprint: Tenant Administrator</option>
                  </optgroup>
                  {users.length > 0 && (
                    <optgroup label="Live Corporate Profiles (Dynamic Overrides)" className="bg-surface-1 font-bold text-ghost text-[10px]">
                      {users.map(u => {
                        const strat = localStorage.getItem(`permission_strategy_${u.id}`) || 'role';
                        return (
                          <option key={u.id} value={`user:${u.id}`} className="font-sans text-xs text-main">
                            Profile: {u.full_name} ({u.role.replace(/_/g, ' ')}) {strat === 'user' ? ' [Bespoke]' : ''}
                          </option>
                        );
                      })}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            {/* Console Sandbox Screen (Identical to actual App) - Now Full Screen width */}
            <div className="w-full flex flex-col bg-[#0b0f17] border border-[#1e2530] rounded-2xl overflow-hidden shadow-2xl h-full min-h-[620px]">
                {/* Real-looking window chrome header */}
                <div className="bg-[#131924] border-b border-[#2d3748] p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-[#ef4444]/80" />
                      <span className="w-3 h-3 rounded-full bg-[#f59e0b]/80" />
                      <span className="w-3 h-3 rounded-full bg-[#10b981]/80" />
                    </div>
                    <div className="w-px h-3 bg-[#2d3748] mx-2" />
                    <span className="text-[10px] font-mono font-bold tracking-tight text-[#a0aec0] uppercase">
                      PREVIEWING: {simulatedUser ? simulatedUser.full_name : simulatedRole.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-[#1b2535] border border-[#2d3748] px-2.5 py-1 rounded-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#24ce24] animate-pulse" />
                    <span className="text-[9px] font-mono uppercase font-black text-[#24ce24]">● SIMULATION ACTIVE</span>
                  </div>
                </div>

                <div className="flex-1 flex min-h-0">
                  {/* IDENTICAL sidebar layout */}
                  <div className="w-48 bg-[#0b0f17] border-r border-[#1e2530] flex flex-col p-2 gap-1 select-none overflow-y-auto custom-scrollbar">
                    <div className="px-2 py-2 mb-1 bg-[#131924] rounded-lg border border-[#1e2530] text-center">
                      <div className="text-[10px] font-mono font-bold text-white truncate">
                        {simulatedUser ? simulatedUser.full_name : 'Blueprint Mode'}
                      </div>
                      <div className="text-[8px] font-mono font-black text-accent truncate uppercase mt-0.5 tracking-wider">
                        {simulatedRole.replace(/_/g, ' ')}
                      </div>
                    </div>

                    {filteredMockNavItems.map((item) => {
                      const showSection = item.section !== lastSection;
                      if (showSection) lastSection = item.section;
                      const isSelect = activePreviewModule === item.id;

                      return (
                        <React.Fragment key={item.id}>
                          {showSection && (
                            <div className="font-mono text-[9px] uppercase tracking-widest text-[#4a5568] px-2.5 py-2 mt-2 leading-[1.3] text-left">
                              {item.section}
                            </div>
                          )}
                          <button
                            onClick={() => {
                              setSelectedPreviewModule(item.id);
                            }}
                            className={cn(
                              "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[11px] font-bold tracking-tight transition-all cursor-pointer border",
                              isSelect 
                                ? "bg-primary/20 border-primary/40 text-primary" 
                                : "bg-transparent border-transparent text-[#a0aec0] hover:bg-[#131924] hover:text-white"
                            )}
                          >
                            <item.icon className={cn("w-3.5 h-3.5 flex-shrink-0", isSelect ? "text-primary" : "text-[#4a5568]")} />
                            <span className="truncate flex-1 text-left">{item.label}</span>
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* IDENTICAL workspace / simulator pane */}
                  <div className="flex-1 bg-[#070a0e] p-6 overflow-y-auto relative text-left">
                    <div className="h-full space-y-5 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between border-b border-[#1e2530] pb-2.5">
                        <div className="flex items-center gap-2">
                          <Unlock className="w-4 h-4 text-primary" />
                          <h4 className="text-xs font-black text-white uppercase tracking-wider">
                            {activePreviewModule.replace(/-/g, ' ')} Module
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-[#24ce24] bg-[#24ce24]/10 border border-[#24ce24]/20 px-2 py-0.5 rounded">
                            ● ACTIVE INHERITENCE
                          </span>
                        </div>
                      </div>

                      {/* Mock UI Contents per tab selection */}
                      {activePreviewModule === 'home' && (
                        <div className="space-y-4">
                          <p className="text-xs text-[#a0aec0] leading-relaxed">
                            Welcome to the Construction Platform landing cockpit. Below is your simulated access clearance profile for live operations validation:
                          </p>
                          <div className="bg-[#131924]/55 border border-[#1e2530] rounded-xl p-4 space-y-3">
                            <div className="text-[10px] font-mono text-[#a0aec0] uppercase tracking-wide">Corporate Policy Clearance Matrix</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                              <div className="flex items-center justify-between p-2 bg-[#0b0f17] rounded-lg border border-[#1e2530]">
                                <span className="text-[#a0aec0]">BoQ Modification</span>
                                <span className={cn("px-2 py-0.5 rounded font-mono text-[9px] font-bold", hasAddBoq ? "bg-[#24ce24]/10 text-[#24ce24]" : "bg-danger/10 text-danger")}>
                                  {hasAddBoq ? "AUTHORIZED" : "READ-ONLY"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-[#0b0f17] rounded-lg border border-[#1e2530]">
                                <span className="text-[#a0aec0]">Milestone Sign-off</span>
                                <span className={cn("px-2 py-0.5 rounded font-mono text-[9px] font-bold", hasUpdateProgress ? "bg-[#24ce24]/10 text-[#24ce24]" : "bg-danger/10 text-danger")}>
                                  {hasUpdateProgress ? "AUTHORIZED" : "READ-ONLY"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-[#0b0f17] rounded-lg border border-[#1e2530]">
                                <span className="text-[#a0aec0]">Daily Progress Reporting</span>
                                <span className={cn("px-2 py-0.5 rounded font-mono text-[9px] font-bold", hasDailySubmit ? "bg-[#24ce24]/10 text-[#24ce24]" : "bg-danger/10 text-danger")}>
                                  {hasDailySubmit ? "AUTHORIZED" : "LOCKED"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-[#0b0f17] rounded-lg border border-[#1e2530]">
                                <span className="text-[#a0aec0]">Digital Voucher Release</span>
                                <span className={cn("px-2 py-0.5 rounded font-mono text-[9px] font-bold", hasApprove ? "bg-[#24ce24]/10 text-[#24ce24]" : "bg-danger/10 text-danger")}>
                                  {hasApprove ? "AUTHORIZED" : "LOCKED"}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="p-3 bg-[#1e2530]/40 border border-[#1e2530] rounded-xl text-[11px] text-[#a0aec0] leading-relaxed">
                            💡 Use the sidebar navigation on the left to toggle between simulated application screens and watch how components instantly switch between input and locked layouts based on standard capabilities.
                          </div>
                        </div>
                      )}

                      {activePreviewModule === 'dashboard' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-[#a0aec0] leading-relaxed">
                              Portfolio summary dashboard, project S-curves, and aggregate risks.
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-[#131924] p-4 rounded-xl border border-[#1e2530] text-left">
                              <span className="text-[10px] text-[#718096] block mb-0.5">Project S-Curve Completeness</span>
                              <span className="text-base font-extrabold text-white">{simulatedMilestoneProgress}%</span>
                              <div className="w-full h-1.5 bg-[#0b0f17] rounded-full mt-2 overflow-hidden">
                                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${simulatedMilestoneProgress}%` }} />
                              </div>
                            </div>
                            <div className="bg-[#131924] p-4 rounded-xl border border-[#1e2530] text-left">
                              <span className="text-[10px] text-[#718096] block mb-0.5">Delivery Compliance Audit</span>
                              <span className="text-base font-extrabold text-[#10b981]">Fully Compliant</span>
                              <div className="text-[9px] text-[#718096] mt-1.5">No critical NCR variances assigned</div>
                            </div>
                          </div>

                          <div className="bg-[#131924]/45 border border-[#1e2530] rounded-xl p-4 text-left">
                            <div className="text-[10px] text-primary font-bold mb-2 uppercase tracking-wider flex justify-between items-center">
                              <span>Milestones Timeline Sequencer</span>
                              <span className="text-[8px] font-mono text-[#a0aec0]">CAP: plan:view</span>
                            </div>
                            <div className="space-y-2 font-mono text-[10px] text-[#a0aec0]">
                              <div className="flex items-center gap-2">
                                <span className="text-[#10b981]">✓</span>
                                <span>Foundations Concrete Poured - MAR 26</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[#10b981]">✓</span>
                                <span>Section Block Grid A locked - APR 26</span>
                              </div>
                              <div className="flex items-center gap-2 text-primary">
                                <span>→</span>
                                <span>Steel reinforcements framing - CURRENTLY LIVE AT {simulatedMilestoneProgress}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {activePreviewModule === 'intelligence' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between bg-accent/5 border border-accent/20 p-2.5 rounded-lg">
                            <span className="text-[10px] text-accent font-bold uppercase tracking-wider font-mono">Module Access Lock: Verified</span>
                            <span className="text-[9px] text-[#a0aec0] font-mono">REQ: intel:view</span>
                          </div>
                          <p className="text-xs text-[#a0aec0] leading-relaxed">
                            High-fidelity forecasting engine mapping regional construction rates and material procurement thresholds:
                          </p>
                          <div className="bg-[#131924] p-4 rounded-xl border border-[#1e2530] space-y-3">
                            <div className="text-[10px] font-mono text-accent font-bold uppercase tracking-wide flex justify-between">
                              <span>Neural Material Index Recommendation</span>
                              <span className="text-[9px] text-accent">Active AI Forecast</span>
                            </div>
                            <p className="text-xs text-[#a0aec0] leading-relaxed">
                              Concrete procurement rates in Region A are modeled to rise by <b className="text-white">14.6%</b> over the coming 60 days. Secure bulk batch pricing immediately to hedge against regional labor spikes.
                            </p>
                          </div>
                        </div>
                      )}

                      {activePreviewModule === 'client-portal' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between bg-primary/5 border border-primary/20 p-2.5 rounded-lg">
                            <span className="text-[10px] text-primary font-bold uppercase tracking-wider font-mono">Client Read-Only Access Gate</span>
                            <span className="text-[9px] text-[#a0aec0] font-mono">REQ: client:view</span>
                          </div>
                          <p className="text-xs text-[#a0aec0] leading-relaxed">
                            Oversight portal configured exclusively for project investors, external corporate auditors, and client sponsors:
                          </p>
                          <div className="bg-[#131924] p-4 rounded-xl border border-[#1e2530] text-left space-y-2.5">
                            <div className="text-xs font-bold text-white flex justify-between">
                              <span>Sponsor Capital Account</span>
                              <span className="text-[#10b981] font-mono text-[10px]">● SECURE RECORD</span>
                            </div>
                            <div className="flex justify-between border-b border-[#1e2530] pb-1.5 text-[11px] text-[#a0aec0]">
                              <span>Approved Core Contract Value</span>
                              <span className="font-bold text-white">$1,420,000</span>
                            </div>
                            <div className="flex justify-between text-[11px] text-[#a0aec0]">
                              <span>Total Verified & Signed Claims</span>
                              <span className="font-bold text-[#10b981]">$482,000</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {activePreviewModule === 'project-setup' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-[#a0aec0]">
                              Configure project default milestones, administrative checklists, and baseline constraints:
                            </p>
                            <div className="flex-shrink-0">
                              {hasSetChecklist ? (
                                <span className="text-[9px] text-[#24ce24] bg-[#24ce24]/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-[#24ce24]/20">
                                  ✓ EDITABLE (proj:set_checklists)
                                </span>
                              ) : (
                                <span className="text-[9px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-amber-500/20">
                                  🔒 READ-ONLY (Lacks proj:set_checklists)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="bg-[#131924] border border-[#1e2530] rounded-xl p-4 space-y-2.5">
                            <div className="text-white text-xs font-bold uppercase tracking-wider pb-1 border-b border-[#1e2530] flex justify-between">
                              <span>Simulation Checklist Items</span>
                              <span className="text-[9px] text-[#718096] font-mono">Dynamic Checklist State</span>
                            </div>
                            <div className="space-y-2.5 text-xs text-[#a0aec0]">
                              {simulatedChecklist.map(chk => (
                                <div key={chk.id} className="flex items-start gap-2.5 group">
                                  <input 
                                    type="checkbox"
                                    checked={chk.completed}
                                    disabled={!hasSetChecklist}
                                    onChange={() => {
                                      setSimulatedChecklist(prev => prev.map(item => item.id === chk.id ? { ...item, completed: !item.completed } : item));
                                    }}
                                    className="mt-0.5 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed"
                                  />
                                  <span className={cn("leading-tight transition-colors", chk.completed ? "line-through text-[#4a5568]" : "text-white")}>
                                    {chk.task}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {activePreviewModule === 'governance' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-[#a0aec0]">
                              Lockdown official baselines, baseline schedules, and system policy locks:
                            </p>
                            <div>
                              {hasLockBaseline ? (
                                <span className="text-[9px] text-[#24ce24] bg-[#24ce24]/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-[#24ce24]/20">
                                  ✓ EDITABLE (plan:lock_baseline)
                                </span>
                              ) : (
                                <span className="text-[9px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-amber-500/20">
                                  🔒 READ-ONLY (Lacks plan:lock_baseline)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className={cn(
                            "p-4 rounded-xl border space-y-2.5 transition-all text-xs",
                            simulatedBaselineLocked 
                              ? "bg-red-950/15 border-red-900/40 text-red-400" 
                              : "bg-[#131924] border-[#1e2530] text-[#a0aec0]"
                          )}>
                            <div className="flex items-center justify-between">
                              <span className="font-bold uppercase tracking-wider font-mono">
                                System Baseline Lock: {simulatedBaselineLocked ? "FROZEN LOCKED" : "CURRENTLY UNLOCKED"}
                              </span>
                              <span className="text-[9px] text-[#718096]">V.1.2 Scope</span>
                            </div>
                            <p className="leading-relaxed">
                              When frozen, planning changes are locked, and any cost adjustments are designated as contract variances.
                            </p>

                            <button
                              disabled={!hasLockBaseline}
                              onClick={() => setSimulatedBaselineLocked(!simulatedBaselineLocked)}
                              className={cn(
                                "py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer box-border border",
                                !hasLockBaseline 
                                  ? "bg-transparent border-[#1e2530] text-[#4a5568] cursor-not-allowed" 
                                  : simulatedBaselineLocked 
                                    ? "bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-400" 
                                    : "bg-[#24ce24]/10 hover:bg-[#24ce24]/20 border-[#24ce24]/30 text-[#24ce24]"
                              )}
                            >
                              {simulatedBaselineLocked ? "Unlock Planning Changes" : "Lock Baseline Version"}
                            </button>
                          </div>
                        </div>
                      )}

                      {activePreviewModule === 'planning' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-[#a0aec0]">
                              Interactive Bill of Quantities (BoQ) builder:
                            </p>
                            <div>
                              {hasAddBoq ? (
                                <span className="text-[9px] text-[#24ce24] bg-[#24ce24]/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-[#24ce24]/20">
                                  ✓ AUTHORIZED (boq:add_item)
                                </span>
                              ) : (
                                <span className="text-[9px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-amber-500/20">
                                  🔒 READ-ONLY (Lacks boq:add_item)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="bg-[#131924] p-4 rounded-xl border border-[#1e2530] space-y-3">
                            <h5 className="text-xs font-bold text-white uppercase tracking-wide">Live Bill of Quantities Summary</h5>
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                              {simulatedBoq.map(item => (
                                <div key={item.id} className="flex justify-between items-center text-xs text-[#a0aec0] bg-[#0b0f17] p-2.5 rounded-lg border border-[#1e2530]">
                                  <span>{item.item}</span>
                                  <span className="font-bold text-white font-mono">{item.quantity} {item.unit}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Adding capabilities control loop to lock planning edits if unauthorized */}
                          <div className="bg-[#131924]/40 border border-[#1e2530] rounded-xl p-4 space-y-3">
                            <div className="text-[10px] font-mono text-[#a0aec0] uppercase font-bold">Add Custom BoQ Item</div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                              <input 
                                type="text"
                                disabled={!hasAddBoq}
                                placeholder="e.g. Steel Bolts Gauge"
                                value={newBoqItemName}
                                onChange={(e) => setNewBoqItemName(e.target.value)}
                                className="bg-[#0b0f17] border border-[#1e2530] text-xs px-2.5 py-1.5 rounded text-white outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <input 
                                type="number"
                                disabled={!hasAddBoq}
                                placeholder="Qty"
                                value={newBoqItemQty}
                                onChange={(e) => setNewBoqItemQty(e.target.value)}
                                className="bg-[#0b0f17] border border-[#1e2530] text-xs px-2.5 py-1.5 rounded text-white outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <button
                                disabled={!hasAddBoq}
                                onClick={() => {
                                  if (!newBoqItemName || !newBoqItemQty) return;
                                  setSimulatedBoq(prev => [...prev, { id: Date.now().toString(), item: newBoqItemName, quantity: newBoqItemQty, unit: newBoqItemUnit }]);
                                  setNewBoqItemName('');
                                  setNewBoqItemQty('');
                                }}
                                className="bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary text-xs py-1.5 rounded transition-colors font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              >
                                Append Item
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {activePreviewModule === 'schedule' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-[#a0aec0]">
                              Standard timeline sequence parameters:
                            </p>
                            <div>
                              {hasUpdateProgress ? (
                                <span className="text-[9px] text-[#24ce24] bg-[#24ce24]/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-[#24ce24]/20">
                                  ✓ AUTHORIZED (plan:update_progress)
                                </span>
                              ) : (
                                <span className="text-[9px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-amber-500/20">
                                  🔒 READ-ONLY (Lacks plan:update_progress)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="bg-[#131924] p-4 rounded-xl border border-[#1e2530] space-y-4 text-xs">
                            <div className="flex justify-between items-center text-white">
                              <span className="font-bold uppercase tracking-wider">AGGREGATE FRAMING COMPLETENESS</span>
                              <span className="font-mono text-primary font-bold text-sm bg-primary/10 px-2.5 py-0.5 border border-primary/20 rounded">{simulatedMilestoneProgress}%</span>
                            </div>
                            
                            <input 
                              type="range"
                              min="0"
                              max="100"
                              value={simulatedMilestoneProgress}
                              disabled={!hasUpdateProgress}
                              onChange={(e) => setSimulatedMilestoneProgress(Number(e.target.value))}
                              className="w-full h-1.5 bg-[#0b0f17] rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <p className="text-[10px] text-[#718096] leading-relaxed">
                              * Drag the slider back and forth to dynamically update aggregate framing curves. Progress changes reflect in portfolio calculations.
                            </p>
                          </div>
                        </div>
                      )}

                      {activePreviewModule === 'variations' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-[#a0aec0]">
                              Contract variation orders, cost estimates, and client claims log:
                            </p>
                            <div>
                              {hasVarCreate ? (
                                <span className="text-[9px] text-[#24ce24] bg-[#24ce24]/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-[#24ce24]/20">
                                  ✓ AUTHORIZED (fin:var_create)
                                </span>
                              ) : (
                                <span className="text-[9px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-amber-500/20">
                                  🔒 READ-ONLY (Lacks fin:var_create)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="bg-[#131924] p-4 rounded-xl border border-[#1e2530] space-y-2.5">
                            <div className="text-white text-xs font-bold uppercase tracking-wider">Claims Ledger</div>
                            <div className="space-y-1.5">
                              {simulatedVariations.map(vo => (
                                <div key={vo.id} className="flex justify-between items-center text-xs p-2 bg-[#0b0f17] border border-[#1e2530] rounded-lg">
                                  <span className="text-[#a0aec0]">{vo.claim}</span>
                                  <span className="font-mono text-[#10b981] font-bold">+${vo.amount.toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="bg-[#131924]/40 border border-[#1e2530] rounded-xl p-4 space-y-2.5">
                            <div className="text-[10px] font-mono text-[#a0aec0] uppercase font-bold">Initiate New Cost Claim Variant</div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                              <input 
                                type="text"
                                placeholder="Claim detail description"
                                disabled={!hasVarCreate}
                                value={newVoClaimName}
                                onChange={(e) => setNewVoClaimName(e.target.value)}
                                className="bg-[#0b0f17] border border-[#1e2530] text-xs px-2.5 py-1.5 rounded text-white outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <input 
                                type="number"
                                placeholder="Amount ($)"
                                disabled={!hasVarCreate}
                                value={newVoClaimAmount}
                                onChange={(e) => setNewVoClaimAmount(e.target.value)}
                                className="bg-[#0b0f17] border border-[#1e2530] text-xs px-2.5 py-1.5 rounded text-white outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <button
                                disabled={!hasVarCreate}
                                onClick={() => {
                                  if (!newVoClaimName || !newVoClaimAmount) return;
                                  const amt = Number(newVoClaimAmount);
                                  setSimulatedVariations(prev => [...prev, { id: Date.now().toString(), claim: newVoClaimName, amount: amt, approved: false }]);
                                  setSimulatedBudget(prev => ({ ...prev, spend: prev.spend + amt }));
                                  setNewVoClaimName('');
                                  setNewVoClaimAmount('');
                                }}
                                className="bg-[#10b981]/15 hover:bg-[#10b981]/25 border border-[#10b981]/20 text-[#10b981] text-xs py-1.5 rounded font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              >
                                Submit VO Claim
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {activePreviewModule === 'budget' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-[#a0aec0]">
                              Simulate company spend margins, project cash flows, and supplier invoices:
                            </p>
                            <div>
                              {hasEditBudget ? (
                                <span className="text-[9px] text-[#24ce24] bg-[#24ce24]/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-[#24ce24]/20">
                                  ✓ AUTHORIZED (fin:edit_budget)
                                </span>
                              ) : (
                                <span className="text-[9px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-amber-500/20">
                                  🔒 READ-ONLY (Lacks fin:edit_budget)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="bg-[#131924] p-4 rounded-xl border border-[#1e2530] grid grid-cols-2 gap-3 text-xs">
                            <div className="bg-[#0b0f17] p-3 rounded-lg border border-[#1e2530]">
                              <span className="text-[10px] text-[#718096] uppercase font-mono block">Budget Cap</span>
                              <span className="text-base font-extrabold text-white">${simulatedBudget.limit.toLocaleString()}</span>
                            </div>
                            <div className="bg-[#0b0f17] p-3 rounded-lg border border-[#1e2530]">
                              <span className="text-[10px] text-red-400 uppercase font-mono block">Current Expenditure</span>
                              <span className="text-base font-extrabold text-white">${simulatedBudget.spend.toLocaleString()}</span>
                            </div>
                          </div>

                          <div className="bg-[#131924]/50 border border-[#1e2530] rounded-xl p-4 space-y-3">
                            <span className="text-[10px] text-primary uppercase font-bold block">Interactions Section</span>
                            <div className="flex gap-2.5">
                              <button 
                                disabled={!hasEditBudget}
                                onClick={() => {
                                  setSimulatedBudget(prev => ({ ...prev, limit: prev.limit + 10000 }));
                                }}
                                className="flex-1 py-2 bg-primary/15 hover:bg-primary/25 border border-primary/25 rounded-lg text-[10px] font-bold text-primary uppercase tracking-wider transition-all disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer text-center"
                              >
                                Increment Budget Limit (+$10k)
                              </button>
                              <button 
                                disabled={!simulatedCaps.has('fin:match_invoice')}
                                onClick={() => {
                                  setSimulatedBudget(prev => ({ ...prev, spend: prev.spend + 4500 }));
                                }}
                                className="flex-1 py-2 bg-[#10b981]/15 hover:bg-[#10b981]/25 border border-[#10b981]/25 rounded-lg text-[10px] font-bold text-[#10b981] uppercase tracking-wider transition-all disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer text-center"
                              >
                                Match Supplier Invoice ($4,500)
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {activePreviewModule === 'operations-hub' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-[#a0aec0]">
                              Operations controller logs site progress data:
                            </p>
                            <div>
                              {hasDailySubmit ? (
                                <span className="text-[9px] text-[#24ce24] bg-[#24ce24]/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-[#24ce24]/20">
                                  ✓ AUTHORIZED (daily:submit)
                                </span>
                              ) : (
                                <span className="text-[9px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-amber-500/20">
                                  🔒 READ-ONLY (Lacks daily:submit)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="bg-[#131924] p-4 border border-[#1e2530] rounded-xl space-y-2.5">
                            <div className="text-white text-xs font-bold uppercase tracking-wider">Dynamic Activity Logs</div>
                            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                              {simulatedDailyLogs.map(log => (
                                <div key={log.id} className="text-xs p-2 bg-[#0b0f17] border border-[#1e2530] rounded-lg text-[#a0aec0] leading-normal font-mono">
                                  &gt; {log.detail}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="bg-[#131924]/40 border border-[#1e2530] rounded-xl p-4 space-y-2.5">
                            <div className="text-[10px] font-mono text-[#a0aec0] uppercase font-bold">Write Daily Site Report Entry</div>
                            <div className="flex gap-2">
                              <input 
                                type="text"
                                placeholder="Detail e.g. Excavation complete on Sector 3"
                                disabled={!hasDailySubmit}
                                value={newDailyLogDetail}
                                onChange={(e) => setNewDailyLogDetail(e.target.value)}
                                className="flex-1 bg-[#0b0f17] border border-[#1e2530] text-xs px-2.5 py-1.5 rounded text-white outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <button
                                disabled={!hasDailySubmit}
                                onClick={() => {
                                  if (!newDailyLogDetail) return;
                                  setSimulatedDailyLogs(prev => [...prev, { id: Date.now().toString(), detail: newDailyLogDetail, reporter: simulatedRole }]);
                                  setNewDailyLogDetail('');
                                }}
                                className="bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary text-xs px-4 py-1.5 rounded font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              >
                                Log progress
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {activePreviewModule === 'subcontractors' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-[#a0aec0]">
                              Manage subcontractors directory, assignments, and labor rates:
                            </p>
                            <div>
                              {hasSubconManage ? (
                                <span className="text-[9px] text-[#24ce24] bg-[#24ce24]/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-[#24ce24]/20">
                                  ✓ AUTHORIZED (res:subcon_manage)
                                </span>
                              ) : (
                                <span className="text-[9px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-amber-500/20">
                                  🔒 READ-ONLY (Lacks res:subcon_manage)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="bg-[#131924] p-4 border border-[#1e2530] rounded-xl text-xs space-y-2.5 text-[#a0aec0]">
                            <div className="text-white font-bold uppercase tracking-wider">Subcontractor Directory State</div>
                            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                              {simulatedSubcontractors.map(sub => (
                                <div key={sub.id} className="flex justify-between items-center p-2 bg-[#0b0f17] border border-[#1e2530] rounded-lg">
                                  <div>
                                    <span className="text-white block font-semibold">{sub.name}</span>
                                    <span className="text-[10px] text-[#718096] block">{sub.trade}</span>
                                  </div>
                                  <span className="text-primary font-mono font-bold text-[10px]">{sub.status}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="bg-[#131924]/40 border border-[#1e2530] rounded-xl p-4 space-y-2.5">
                            <div className="text-[10px] font-mono text-[#a0aec0] uppercase font-bold">Register New Trade Subcontractor</div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <input 
                                type="text"
                                placeholder="Subcontractor Name"
                                value={newSubconName}
                                disabled={!hasSubconManage}
                                onChange={(e) => setNewSubconName(e.target.value)}
                                className="bg-[#0b0f17] border border-[#1e2530] text-xs px-2.5 py-1.5 rounded text-white outline-none focus:border-primary disabled:opacity-50"
                              />
                              <input 
                                type="text"
                                placeholder="Trade Specialty (e.g. Plumbing)"
                                value={newSubconTrade}
                                disabled={!hasSubconManage}
                                onChange={(e) => setNewSubconTrade(e.target.value)}
                                className="bg-[#0b0f17] border border-[#1e2530] text-xs px-2.5 py-1.5 rounded text-white outline-none focus:border-primary disabled:opacity-50"
                              />
                              <button
                                disabled={!hasSubconManage}
                                onClick={() => {
                                  if (!newSubconName || !newSubconTrade) return;
                                  setSimulatedSubcontractors(prev => [...prev, { id: Date.now().toString(), name: newSubconName, status: 'Contract Live', trade: newSubconTrade }]);
                                  setNewSubconName('');
                                  setNewSubconTrade('');
                                }}
                                className="bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary text-xs py-1.5 rounded font-bold transition-all disabled:opacity-40 cursor-pointer"
                              >
                                Enroll Contractor
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {activePreviewModule === 'approvals' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-[#a0aec0]">
                              View pending financial requisitions, purchase orders, and release actions:
                            </p>
                            <div>
                              {hasApprove ? (
                                <span className="text-[9px] text-[#24ce24] bg-[#24ce24]/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-[#24ce24]/20">
                                  ✓ AUTHORIZED (appr:approve)
                                </span>
                              ) : (
                                <span className="text-[9px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-amber-500/20">
                                  🔒 READ-ONLY (Lacks appr:approve)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="bg-[#131924] p-4 border border-[#1e2530] rounded-xl space-y-2.5 text-xs text-[#a0aec0]">
                            <div className="text-white font-mono text-[10px] uppercase font-bold">Pending Requisitions Queue</div>
                            <div className="space-y-2">
                              {simulatedApprovals.length === 0 ? (
                                <p className="text-xs text-[#718096] text-center py-4 font-mono">No pending workflows items in queue.</p>
                              ) : (
                                simulatedApprovals.map(apr => (
                                  <div key={apr.id} className="flex items-center justify-between p-2.5 bg-[#0b0f17] border border-[#1e2530] rounded-lg">
                                    <div className="text-left">
                                      <span className="text-white font-semibold block">{apr.item}</span>
                                      <span className="text-[9px] text-red-400 font-mono block">Spend: ${apr.amount.toLocaleString()}</span>
                                    </div>
                                    <button
                                      disabled={!hasApprove}
                                      onClick={() => {
                                        setSimulatedApprovals(prev => prev.filter(item => item.id !== apr.id));
                                        alert(`Successfully Approved Requisition: ${apr.item} for $${apr.amount}`);
                                      }}
                                      className={cn(
                                        "py-1 px-2.5 rounded text-[9px] font-black uppercase tracking-wider border transition-colors",
                                        hasApprove 
                                          ? "bg-[#24ce24]/10 hover:bg-[#24ce24]/20 border-[#24ce24]/30 text-[#24ce24] cursor-pointer" 
                                          : "bg-transparent border-[#1e2530] text-[#3a4454] cursor-not-allowed"
                                      )}
                                    >
                                      {hasApprove ? "Digital Release" : "Locked"}
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {activePreviewModule === 'alerts' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-[#a0aec0]">
                              View site climate parameters and critical alarms dispatch list:
                            </p>
                            <div>
                              {hasAlertDismiss ? (
                                <span className="text-[9px] text-[#24ce24] bg-[#24ce24]/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-[#24ce24]/20">
                                  ✓ AUTHORIZED (alert:dismiss)
                                </span>
                              ) : (
                                <span className="text-[9px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-amber-500/20">
                                  🔒 READ-ONLY (Lacks alert:dismiss)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2.5 text-xs">
                            {simulatedAlerts.filter(a => a.active).length === 0 ? (
                              <p className="text-xs text-[#718096] text-center p-4 font-mono border border-dashed border-[#1e2530] rounded-xl">&gt; All system warnings acknowledged and healthy.</p>
                            ) : (
                              simulatedAlerts.filter(a => a.active).map(alt => (
                                <div key={alt.id} className="bg-orange-500/10 border border-orange-500/20 text-orange-400 p-4 rounded-xl leading-relaxed flex justify-between items-start">
                                  <div className="flex-1 pr-3">
                                    <b>System Warning Logged &ndash; SITE A:</b>
                                    <p className="mt-1 text-xs text-[#a0aec0]">{alt.message}</p>
                                  </div>
                                  <button
                                    disabled={!hasAlertDismiss}
                                    onClick={() => {
                                      setSimulatedAlerts(prev => prev.map(a => a.id === alt.id ? { ...a, active: false } : a));
                                    }}
                                    className={cn(
                                      "px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wide border",
                                      hasAlertDismiss 
                                        ? "bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30 text-orange-400 cursor-pointer" 
                                        : "bg-transparent border-[#1e2530] text-[#3a4454] cursor-not-allowed"
                                    )}
                                  >
                                    Acknowledge
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      {activePreviewModule === 'procurement' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-[#a0aec0]">
                              Review material supply lines and issue Request for Proposals (RFQs):
                            </p>
                            <div>
                              {hasCreateRfq ? (
                                <span className="text-[9px] text-[#24ce24] bg-[#24ce24]/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-[#24ce24]/20">
                                  ✓ AUTHORIZED (proc:create_rfq)
                                </span>
                              ) : (
                                <span className="text-[9px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-amber-500/20">
                                  🔒 READ-ONLY (Lacks proc:create_rfq)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="bg-[#131924] p-4 border border-[#1e2530] rounded-xl text-xs space-y-2 text-[#a0aec0]">
                            <div className="text-white font-bold uppercase tracking-wider">Tenders and RFQs</div>
                            <div className="space-y-2">
                              {simulatedTenders.map(tnd => (
                                <div key={tnd.id} className="flex justify-between p-2 bg-[#0b0f17] border border-[#1e2530] rounded-lg">
                                  <span>{tnd.title}</span>
                                  <span className="text-white font-bold">{tnd.status}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="bg-[#131924]/40 border border-[#1e2530] rounded-xl p-4 space-y-2.5">
                            <div className="text-[10px] font-mono text-[#a0aec0] uppercase font-bold">Issue New RFQ Tender Proposal</div>
                            <div className="flex gap-2">
                              <input 
                                type="text"
                                placeholder="RFQ Template Name e.g. Timber batten supply"
                                disabled={!hasCreateRfq}
                                value={newRfqTitle}
                                onChange={(e) => setNewRfqTitle(e.target.value)}
                                className="flex-1 bg-[#0b0f17] border border-[#1e2530] text-xs px-2.5 py-1.5 rounded text-white outline-none focus:border-primary disabled:opacity-50"
                              />
                              <button
                                disabled={!hasCreateRfq}
                                onClick={() => {
                                  if (!newRfqTitle) return;
                                  setSimulatedTenders(prev => [...prev, { id: Date.now().toString(), title: newRfqTitle, status: 'No bids yet (Tendering)' }]);
                                  setNewRfqTitle('');
                                }}
                                className="bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary text-xs px-4 py-1.5 rounded font-bold transition-all disabled:opacity-40 cursor-pointer"
                              >
                                Publish RFQ
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {activePreviewModule === 'warehouse' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-[#a0aec0]">
                              Warehouse storage levels, material receipts, and stock inventory balances:
                            </p>
                            <div>
                              {hasGrn ? (
                                <span className="text-[9px] text-[#24ce24] bg-[#24ce24]/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-[#24ce24]/20">
                                  ✓ AUTHORIZED (stock:grn_step1)
                                </span>
                              ) : (
                                <span className="text-[9px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-amber-500/20">
                                  🔒 READ-ONLY (Lacks stock:grn_step1)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="bg-[#131924] p-4 rounded-xl border border-[#1e2530] text-left space-y-1 text-xs">
                            <span className="text-[10px] text-[#718096] block uppercase tracking-wider font-mono">Simulated Materials Storage Balance</span>
                            <span className="text-base font-extrabold text-white font-mono">{simulatedWarehouse.stock.toLocaleString()} Units</span>
                          </div>

                          <div className="bg-[#131924]/40 border border-[#1e2530] rounded-xl p-4 space-y-2.5">
                            <div className="text-white text-xs font-bold uppercase tracking-wider">Log Goods Received Note (GRN)</div>
                            <p className="text-[11px] text-[#a0aec0]">
                              Authorized staff can execute a live GRN receipt voucher to record incoming truck deliveries.
                            </p>
                            <button 
                              disabled={!hasGrn}
                              onClick={() => {
                                setSimulatedWarehouse(prev => ({ stock: prev.stock + 500 }));
                              }}
                              className={cn(
                                "w-full text-center py-2 font-bold text-[10px] uppercase rounded-lg border transition-all",
                                hasGrn 
                                  ? "bg-primary hover:bg-primary/90 text-white border-primary cursor-pointer" 
                                  : "bg-transparent border-[#1e2530] text-[#4a5568] cursor-not-allowed"
                              )}
                            >
                              {hasGrn ? "Confirm Materials Receipt (+500 Units)" : "GRN Logging Locked"}
                            </button>
                          </div>
                        </div>
                      )}

                      {activePreviewModule === 'library' && (
                        <div className="space-y-4">
                          <p className="text-xs text-[#a0aec0]">
                            Corporate reference library of standard trade recipe specifications and structural cost units:
                          </p>
                          <div className="bg-[#131924] p-4 border border-[#1e2530] rounded-xl space-y-2 text-xs text-[#a0aec0]">
                            <div className="text-white font-bold">Standard Reference Rates Matrix</div>
                            <div className="space-y-1.5 leading-relaxed font-mono text-[10px]">
                              <div>&gt; Structural Reinforcements steel base : $1,420 / Ton</div>
                              <div>&gt; Reinforced Aggregate Concrete 40MPA : $145 / m³</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {activePreviewModule === 'users' && (
                        <div className="space-y-3">
                          <p className="text-xs text-[#a0aec0]">
                            Simulation of policy matrix directory:
                          </p>
                          <p className="text-xs text-[#24ce24] font-mono leading-relaxed">
                            ✓ {users.length} Dynamic corporate user profiles mapped to active tenancy directory boundaries correctly.
                          </p>
                        </div>
                      )}

                      {activePreviewModule === 'permissions' && (
                        <div className="space-y-3">
                          <p className="text-xs text-[#a0aec0]">
                            Simulation of policy matrices:
                          </p>
                          <div className="bg-amber-500/5 border border-amber-500/20 text-amber-500 p-4 rounded-xl text-xs leading-relaxed font-mono">
                            ACTIVE SECURITY LEDGER FOR TENANT: {tenantId}
                          </div>
                        </div>
                      )}

                      {activePreviewModule === 'approval-config' && (
                        <div className="space-y-3">
                          <p className="text-xs text-[#a0aec0]">
                            Simulation of multi-stage approval structures and global variables:
                          </p>
                          <div className="bg-[#131924] p-4 border border-[#1e2530] rounded-xl text-xs text-[#a0aec0] font-mono">
                            Spends exceeding $10,000 threshold require secondary authorization automatically.
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              </div>

            {/* Simulated Profile Info and Checkbench moved to the bottom */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start mt-6">
              {/* Simulated actor details */}
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 space-y-4 shadow-xs text-left">
                <div className="flex items-center gap-2 border-b border-border-subtle/50 pb-3">
                  <Fingerprint className="w-5 h-5 text-[#24ce24]" />
                  <div>
                    <h3 className="text-sm font-bold text-main">Simulated Profile Info</h3>
                    <p className="text-[10px] text-ghost font-semibold uppercase tracking-wider">
                      {simulatedUser ? 'LIVE REGISTERED PROFILE' : 'BLUEPRINT WORKFLOW MODEL'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between border-b border-border-subtle/30 pb-1.5">
                    <span className="text-ghost">Actor Identity</span>
                    <span className="font-bold text-main">{simulatedUser ? simulatedUser.full_name : 'Role Blueprint'}</span>
                  </div>
                  <div className="flex justify-between border-b border-border-subtle/30 pb-1.5">
                    <span className="text-ghost">Corporate Role</span>
                    <span className="font-bold text-accent uppercase tracking-wider text-[10px]">{simulatedRole.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex justify-between border-b border-border-subtle/30 pb-1.5">
                    <span className="text-ghost">Permissions Strategy</span>
                    <span className="font-bold text-primary uppercase text-[10px]">{simulatedStrategy === 'user' ? 'Bespoke Overrides' : 'Role-based RBAC'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ghost">Unlocked Whitelists</span>
                    <span className="font-mono text-[10px] bg-[#24ce24]/10 text-[#24ce24] font-bold px-1.5 py-0.5 rounded">
                      {simulatedCaps.size} capabilities
                    </span>
                  </div>
                </div>

                <div className="bg-surface-2 p-3.5 rounded-xl border border-border-subtle/50 text-xs text-dim leading-relaxed">
                  <span className="text-[9px] font-mono font-bold uppercase text-ghost tracking-widest block mb-1">Functional Description</span>
                  {simulatedRole === 'project_manager' && "Authorized to plan cost boundaries, submit internal budgets, view surveys, and build BoQ recipe structures."}
                  {simulatedRole === 'site_supervisor' && "On-site executor focused on daily progress records, receiving warehouse stocks (GRNs), and requesting field materials."}
                  {simulatedRole === 'finance' && "Responsible for supplier invoices, general company overhead claims, budget margin audits, and release clearances."}
                  {simulatedRole === 'client' && "Read-only access limits. Stakeholders can only view schedule tracking calendars and performance audit metrics."}
                  {simulatedRole === 'director' && "Global strategic director with view-all privileges on financial summaries, portfolio performance, and custom approval workflows."}
                  {simulatedRole === 'tenant_admin' && "Primary system owner. Complete authority over team members, bespoke permission sets, and system preferences."}
                </div>
              </div>

              {/* Simulated Whitelist Checkbench */}
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 space-y-4 shadow-xs text-left">
                <div className="flex items-center gap-2 border-b border-border-subtle/50 pb-3">
                  <Settings className="w-5 h-5 text-accent" />
                  <div>
                    <h3 className="text-sm font-bold text-main">Security Checkbench</h3>
                    <p className="text-[10px] text-ghost font-medium">Verify actions permitted for this active simulated scope</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { 
                      action: 'Update BOQ Contract values', 
                      capability: 'boq:edit_contract',
                      reason: 'QS boundary validation policy restricts modification' 
                    },
                    { 
                      action: 'Process GRN Materials Receipts', 
                      capability: 'stock:grn_step1',
                      reason: 'Physical receipt on-site required' 
                    },
                    { 
                      action: 'Approve Spends > $10,000 threshold', 
                      capability: 'po:approve',
                      reason: 'Delegated spending guidelines restrict block' 
                    },
                    { 
                      action: 'Alter System Security & Roles', 
                      capability: 'admin:view_roles',
                      reason: 'Requires full role permissions view privileges' 
                    }
                  ].map((actCheck) => {
                    const simulatedRoleHasAccess = simulatedCaps.has(actCheck.capability);
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
                        <span className="font-semibold text-dim group-hover:text-main truncate pr-2">{actCheck.action}</span>
                        <div className={cn(
                          "w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold",
                          simulatedRoleHasAccess ? "bg-primary/10 text-primary border border-primary/20" : "bg-danger/10 text-danger border border-danger/20"
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
                      ? "bg-[#24ce24]/5 border-[#24ce24]/20 text-[#24ce24]" 
                      : "bg-danger/10 border-danger/20 text-danger"
                  )}>
                    <div className="flex items-center gap-2 mb-1.5">
                      {simulationActionFeedback.allowed ? <Check className="w-4 h-4 font-black" /> : <Ban className="w-4 h-4" />}
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider">
                        {simulationActionFeedback.allowed ? "ACCESS GRANTED" : "ACCESS BLOCKED"}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed">
                      {simulationActionFeedback.allowed 
                        ? `Task verified. Simulated entity has standard permissions: Active cap matches standard.`
                        : `Action restricted. Reason: ${simulationActionFeedback.reason}.`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
