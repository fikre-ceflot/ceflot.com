import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Tenant, UserProfile } from '../types';
import { 
  Building2, 
  Users, 
  Activity, 
  ShieldCheck, 
  Plus, 
  Search, 
  MoreVertical,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Globe,
  Lock
} from 'lucide-react';
import { cn } from '../lib/utils';

interface PlatformGodProps {
  userProfile: UserProfile;
}

export function PlatformGod({ userProfile }: PlatformGodProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'users' | 'system'>('overview');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTenants: 0,
    totalProjects: 0,
    totalUsers: 0,
    activeSessions: 0
  });

  const [showNewTenantModal, setShowNewTenantModal] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');

  useEffect(() => {
    loadPlatformData();
  }, []);

  async function loadPlatformData() {
    setLoading(true);
    try {
      const [tenantsRes, usersRes, projectsRes] = await Promise.all([
        supabase.from('tenants').select('*').order('created_at', { ascending: false }),
        supabase.from('user_profiles').select('id, email, full_name, role, tenant_id, is_platform_god, is_active, created_at, updated_at').order('full_name'),
        supabase.from('projects').select('id', { count: 'exact', head: true })
      ]);

      if (tenantsRes.data) setTenants(tenantsRes.data);
      if (usersRes.data) setAllUsers(usersRes.data);
      
      setStats({
        totalTenants: tenantsRes.data?.length || 0,
        totalProjects: projectsRes.count || 0,
        totalUsers: usersRes.data?.length || 0,
        activeSessions: Math.floor(Math.random() * 50) + 10 // Mocked for now
      });
    } catch (e) {
      console.error('Error loading platform data:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTenant() {
    if (!newTenantName) return;
    try {
      const { data, error } = await supabase
        .from('tenants')
        .insert([{ name: newTenantName }])
        .select()
        .single();

      if (error) throw error;
      setTenants([data, ...tenants]);
      setStats(prev => ({ ...prev, totalTenants: prev.totalTenants + 1 }));
      setNewTenantName('');
      setShowNewTenantModal(false);
    } catch (e: any) {
      alert('Error creating company: ' + e.message);
    }
  }

  async function toggleUserStatus(user: UserProfile) {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: !user.is_active })
        .eq('id', user.id);

      if (error) throw error;
      setAllUsers(allUsers.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
    } catch (e: any) {
      alert('Error updating user status: ' + e.message);
    }
  }

  async function handleDeleteTenant(id: string) {
    if (!window.confirm('Are you sure you want to delete this company? This will delete all associated data.')) return;
    try {
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setTenants(tenants.filter(t => t.id !== id));
      setStats(prev => ({ ...prev, totalTenants: prev.totalTenants - 1 }));
    } catch (e: any) {
      alert('Error deleting company: ' + e.message);
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface-base">
      {/* Header */}
      <div className="px-8 py-6 border-b border-border-subtle bg-surface-1/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-error/10 flex items-center justify-center text-error border border-error/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-main">Platform God Mode</h1>
              <p className="text-sm text-dim">System-wide administrative controls and oversight</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 bg-error/10 border border-error/20 rounded-xl flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
              <span className="text-[10px] font-bold text-error uppercase tracking-widest">Master Access</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-8">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'tenants', label: 'Companies', icon: Building2 },
            { id: 'users', label: 'User Directory', icon: Users },
            { id: 'system', label: 'System Health', icon: Globe }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border",
                activeTab === tab.id 
                  ? "bg-error text-black border-error" 
                  : "text-dim hover:text-main hover:bg-surface-2 border-transparent"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 text-main">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Total Companies', value: stats.totalTenants, icon: Building2, color: 'text-info' },
                { label: 'Active Projects', value: stats.totalProjects, icon: TrendingUp, color: 'text-primary' },
                { label: 'Platform Users', value: stats.totalUsers, icon: Users, color: 'text-accent' },
                { label: 'Live Sessions', value: stats.activeSessions, icon: Activity, color: 'text-error' }
              ].map((stat, i) => (
                <div key={i} className="bg-surface-1 border border-border-subtle p-6 rounded-2xl transition-all hover:bg-surface-2">
                  <div className="flex items-center justify-between mb-4">
                    <div className={cn("w-10 h-10 rounded-xl bg-current/10 flex items-center justify-center", stat.color)}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-dim uppercase tracking-widest mb-1">{stat.label}</div>
                  <div className="text-2xl font-black text-main">{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Recent Activity or Health Checks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6">
                <h3 className="text-sm font-bold text-main uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  System Health
                </h3>
                <div className="space-y-4">
                  {[
                    { label: 'Database Connection', status: 'healthy', latency: '12ms' },
                    { label: 'Auth Service', status: 'healthy', latency: '45ms' },
                    { label: 'Storage API', status: 'healthy', latency: '28ms' },
                    { label: 'Edge Functions', status: 'warning', latency: '150ms' }
                  ].map((check, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-surface-2 rounded-xl border border-border-subtle hover:border-primary/20 transition-colors">
                      <div className="flex items-center gap-3">
                        {check.status === 'healthy' ? (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-warning" />
                        )}
                        <span className="text-xs font-medium text-main">{check.label}</span>
                      </div>
                      <span className="text-[10px] font-mono text-dim">{check.latency}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6">
                <h3 className="text-sm font-bold text-main uppercase tracking-widest mb-6 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-accent" />
                  Growth Metrics
                </h3>
                <div className="h-48 flex items-end gap-2 px-2">
                  {[40, 65, 45, 80, 55, 90, 75].map((h, i) => (
                    <div key={i} className="flex-1 bg-accent/20 rounded-t-lg relative group">
                      <div 
                        className="absolute bottom-0 left-0 right-0 bg-accent rounded-t-lg transition-all duration-500 group-hover:brightness-110" 
                        style={{ height: `${h}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-4 px-2">
                  <span className="text-[10px] text-dim font-mono">Mon</span>
                  <span className="text-[10px] text-dim font-mono">Sun</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tenants' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
                <input 
                  type="text" 
                  placeholder="Search companies..." 
                  className="w-full bg-surface-1 border border-border-subtle rounded-xl pl-10 pr-4 py-2 text-sm text-main outline-none focus:border-error transition-all"
                />
              </div>
              <button 
                onClick={() => setShowNewTenantModal(true)}
                className="flex items-center gap-2 bg-error text-black px-4 py-2 rounded-xl text-sm font-bold hover:brightness-110 transition-all border border-error shadow-[0_0_15px_rgba(240,74,90,0.15)]"
              >
                <Plus className="w-4 h-4" />
                Add Company
              </button>
            </div>

            <div className="bg-surface-1 border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-2/50">
                    <th className="px-6 py-4 text-[10px] font-bold text-dim uppercase tracking-widest">Company Name</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-dim uppercase tracking-widest">ID</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-dim uppercase tracking-widest">Created At</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-dim uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-dim uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-surface-2/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center text-info border border-info/20">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-bold text-main">{tenant.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-mono text-dim">{tenant.id}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-dim">{new Date(tenant.created_at).toLocaleDateString()}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Active</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 text-dim group-hover:text-main transition-colors">
                          <button 
                            onClick={() => handleDeleteTenant(tenant.id)}
                            className="p-2 hover:text-error transition-colors hover:bg-error/5 rounded-lg"
                            title="Delete Company"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                          <button className="p-2 hover:text-main transition-colors hover:bg-main/5 rounded-lg">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
                <input 
                  type="text" 
                  placeholder="Search users across all companies..." 
                  className="w-full bg-surface-1 border border-border-subtle rounded-xl pl-10 pr-4 py-2 text-sm text-main outline-none focus:border-error transition-all focus:ring-1 focus:ring-error/20"
                />
              </div>
            </div>

            <div className="bg-surface-1 border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-2/50">
                    <th className="px-6 py-4 text-[10px] font-bold text-dim uppercase tracking-widest">User</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-dim uppercase tracking-widest">Company</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-dim uppercase tracking-widest">Role</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-dim uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-dim uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {allUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-surface-2/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent border border-accent/20">
                            {user.full_name?.[0] || user.email[0].toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-main">{user.full_name || 'Unnamed User'}</span>
                            <span className="text-[10px] text-dim">{user.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-main">{tenants.find(t => t.id === user.tenant_id)?.name || 'Unknown'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
                          user.is_platform_god ? "bg-error/10 text-error border-error/20" : "bg-surface-2 text-dim border-border-subtle"
                        )}>
                          {user.role.replace(/_/g, ' ')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {user.is_active ? (
                            <>
                              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Active</span>
                            </>
                          ) : (
                            <>
                              <div className="w-1.5 h-1.5 rounded-full bg-error" />
                              <span className="text-[10px] font-bold text-error uppercase tracking-widest">Suspended</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => toggleUserStatus(user)}
                            className={cn(
                              "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border",
                              user.is_active 
                                ? "bg-error/10 text-error hover:bg-error border-transparent hover:text-black" 
                                : "bg-primary/10 text-primary hover:bg-primary border-transparent hover:text-black"
                            )}
                          >
                            {user.is_active ? 'Suspend' : 'Activate'}
                          </button>
                          <button className="p-2 text-dim hover:text-main transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="flex flex-col items-center justify-center py-20 text-center text-main">
            <div className="w-20 h-20 rounded-3xl bg-surface-1 border border-border-subtle flex items-center justify-center text-dim mb-6">
              <Globe className="w-10 h-10 opacity-20" />
            </div>
            <h3 className="text-lg font-bold text-main">System Infrastructure</h3>
            <p className="text-sm text-dim max-w-md mt-2">
              Platform-level resource monitoring, edge function logs, and global configuration settings.
            </p>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
              <div className="p-4 bg-surface-1 border border-border-subtle rounded-xl text-left hover:border-info/20 transition-all">
                <div className="text-[10px] font-bold text-dim uppercase tracking-widest mb-1">Region</div>
                <div className="text-sm font-bold text-main">EU-West-1</div>
              </div>
              <div className="p-4 bg-surface-1 border border-border-subtle rounded-xl text-left hover:border-accent/20 transition-all">
                <div className="text-[10px] font-bold text-dim uppercase tracking-widest mb-1">Version</div>
                <div className="text-sm font-bold text-main">v2.4.0-stable</div>
              </div>
              <div className="p-4 bg-surface-1 border border-border-subtle rounded-xl text-left hover:border-primary/20 transition-all">
                <div className="text-[10px] font-bold text-dim uppercase tracking-widest mb-1">Uptime</div>
                <div className="text-sm font-bold text-main">99.98%</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Tenant Modal */}
      {showNewTenantModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4 text-main">
          <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border-subtle bg-surface-2/50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-main uppercase tracking-widest">Create New Company</h3>
              <button onClick={() => setShowNewTenantModal(false)} className="text-dim hover:text-main">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-dim uppercase tracking-widest">Company Name</label>
                <input 
                  autoFocus
                  type="text" 
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  placeholder="e.g. Acme Construction Ltd"
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl px-4 py-3 text-sm text-main outline-none focus:border-error transition-all"
                />
              </div>
              <div className="p-4 bg-error/5 border border-error/10 rounded-xl flex gap-3">
                <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
                <p className="text-[11px] text-error leading-relaxed">
                  Creating a new company will provision a unique workspace. You will need to manually assign a Company Admin after creation.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-surface-2/50 border-t border-border-subtle flex justify-end gap-3">
              <button 
                onClick={() => setShowNewTenantModal(false)}
                className="px-4 py-2 text-sm font-bold text-dim hover:text-main"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateTenant}
                disabled={!newTenantName}
                className="bg-error text-black px-6 py-2 rounded-xl text-sm font-bold hover:brightness-110 transition-all border border-error disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_15px_rgba(240,74,90,0.2)]"
              >
                Create Company
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
