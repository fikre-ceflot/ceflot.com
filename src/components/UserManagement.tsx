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
  ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Role, UserProfile } from '../types';
import { ROLES, CAPABILITIES } from '../constants/capabilities';
import { useRoles } from '../hooks/useRoles';

interface UserManagementProps {
  tenantId: string;
}

export function UserManagement({ tenantId }: UserManagementProps) {
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

  useEffect(() => {
    loadUsers();
  }, [tenantId]);

  useEffect(() => {
    if (editingUser) {
      loadUserCaps(editingUser.id);
    }
  }, [editingUser]);

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

      if (error) throw error;
      setUserCaps(data?.map(c => c.capability) || []);
    } catch (e: any) {
      console.error('Error loading user capabilities:', e.message);
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

  const toggleCapability = async (capId: string) => {
    if (!editingUser) return;
    setSavingCaps(true);

    try {
      if (userCaps.includes(capId)) {
        await supabase
          .from('user_capabilities')
          .delete()
          .eq('user_id', editingUser.id)
          .eq('capability', capId);
        
        setUserCaps(prev => prev.filter(id => id !== capId));
      } else {
        await supabase
          .from('user_capabilities')
          .insert([{
            user_id: editingUser.id,
            tenant_id: tenantId,
            capability: capId
          }]);
        
        setUserCaps(prev => [...prev, capId]);
      }
    } catch (e: any) {
      console.error('Error toggling capability:', e.message);
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
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-main">User Management</h1>
          <p className="text-sm text-ghost">Manage your company team and their access levels</p>
        </div>
        <button 
          onClick={() => setIsInviting(true)}
          className="bg-primary text-surface-base px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-all flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Add Team Member
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
                      </div>          </div>

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
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-main">Capabilities Overrides</h4>
                    </div>
                    
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

      <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2 border-b border-border-subtle">
                <th className="font-mono text-[10px] uppercase tracking-widest text-dim px-6 py-4">Team Member</th>
                <th className="font-mono text-[10px] uppercase tracking-widest text-dim px-6 py-4">Role</th>
                <th className="font-mono text-[10px] uppercase tracking-widest text-dim px-6 py-4">Status</th>
                <th className="font-mono text-[10px] uppercase tracking-widest text-dim px-6 py-4">Joined</th>
                <th className="px-6 py-4"></th>
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
                        <div className="flex flex-col">
                          <div className="text-sm font-bold text-main">{user.full_name}</div>
                          <div className="text-[11px] text-dim">{user.email}</div>
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
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setEditingUser(user)}
                        className="p-1.5 text-dim hover:bg-surface-2 hover:text-primary rounded-lg transition-all opacity-0 group-hover:opacity-100"
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
    </div>
  );
}
