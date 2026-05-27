import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Role } from '../types';
import { CAPABILITIES, ROLES } from '../constants/capabilities';
import { 
  ShieldCheck, 
  Check, 
  X, 
  AlertCircle,
  Save,
  RefreshCcw,
  Lock,
  Unlock,
  Plus,
  Library,
  Trash2,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';

interface RoleManagementProps {
  userRole: Role;
  isPlatformGod?: boolean;
}

const GLOBAL_ROLES: { id: string; label: string; description: string; caps: string[] }[] = [
  { 
    id: 'project_manager', 
    label: 'Project Manager', 
    description: 'Full control over project delivery and planning',
    caps: ['view_dashboard', 'view_projects', 'manage_boq', 'manage_planning', 'manage_variations']
  },
  { 
    id: 'qs', 
    label: 'Quantity Surveyor', 
    description: 'Focus on BOQ, budgets and variations',
    caps: ['view_projects', 'manage_boq', 'view_budget', 'manage_variations']
  },
  { 
    id: 'site_supervisor', 
    label: 'Site Supervisor', 
    description: 'Daily progress and site management',
    caps: ['view_projects', 'manage_planning']
  },
  { 
    id: 'finance', 
    label: 'Finance Officer', 
    description: 'Budget oversight and approvals',
    caps: ['view_dashboard', 'view_budget', 'approve_budget']
  }
];

export function RoleManagement({ userRole, isPlatformGod }: RoleManagementProps) {
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [roleCaps, setRoleCaps] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set(CAPABILITIES.map(c => c.category)));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGlobalLibrary, setShowGlobalLibrary] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const allRoles = [...ROLES, ...customRoles].filter(r => {
    if (r === 'platform_god' && !isPlatformGod) return false;
    return true;
  });

  useEffect(() => {
    loadCustomRoles();
  }, []);

  useEffect(() => {
    if (selectedRole) {
      loadRoleCapabilities();
    }
  }, [selectedRole]);

  const loadCustomRoles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from('role_capabilities')
        .select('role')
        .eq('tenant_id', profile.tenant_id);

      if (error) throw error;

      const uniqueRoles = Array.from(new Set(data.map(d => d.role)));
      const custom = uniqueRoles.filter(r => !ROLES.includes(r as any));
      setCustomRoles(custom);
      
      if (!selectedRole && allRoles.length > 0) {
        setSelectedRole(allRoles[0]);
      }
    } catch (e) {
      console.error('Error loading custom roles:', e);
    }
  };

  const createCustomRole = async () => {
    if (!newRoleName.trim()) return;
    const roleId = newRoleName.toLowerCase().replace(/\s+/g, '_');
    if (allRoles.includes(roleId)) {
      alert('Role already exists');
      return;
    }

    setCustomRoles([...customRoles, roleId]);
    setSelectedRole(roleId);
    setRoleCaps(new Set());
    setIsAddingRole(false);
    setNewRoleName('');
  };

  const importFromGlobal = (globalRole: typeof GLOBAL_ROLES[0]) => {
    if (allRoles.includes(globalRole.id)) {
      setSelectedRole(globalRole.id);
    } else {
      setCustomRoles([...customRoles, globalRole.id]);
      setSelectedRole(globalRole.id);
    }
    setRoleCaps(new Set(globalRole.caps));
    setShowGlobalLibrary(false);
  };

  const loadRoleCapabilities = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('role_capabilities')
        .select('capability')
        .eq('role', selectedRole);

      if (error) {
        if (error.message?.includes('public.role_capabilities')) {
          setError('Table "role_capabilities" not found. Please run the SQL migration script below.');
          return;
        }
        throw error;
      }
      setRoleCaps(new Set(data.map(d => d.capability)));
    } catch (e: any) {
      console.error('Error loading capabilities:', e.message);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCapability = (capId: string) => {
    const newCaps = new Set(roleCaps);
    if (newCaps.has(capId)) {
      newCaps.delete(capId);
    } else {
      newCaps.add(capId);
    }
    setRoleCaps(newCaps);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Get current tenant_id from user profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Delete existing caps for this role
      await supabase
        .from('role_capabilities')
        .delete()
        .eq('role', selectedRole)
        .eq('tenant_id', profile.tenant_id);

      // Insert new caps
      if (roleCaps.size > 0) {
        const toInsert = Array.from(roleCaps).map(cap => ({
          tenant_id: profile.tenant_id,
          role: selectedRole,
          capability: cap
        }));

        const { error } = await supabase
          .from('role_capabilities')
          .insert(toInsert);

        if (error) throw error;
      }

      alert('Permissions updated successfully!');
    } catch (e: any) {
      console.error('Error saving permissions:', e.message);
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-main">Role Permissions</h1>
          <p className="text-sm text-ghost">Configure granular capabilities for each user role</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowGlobalLibrary(true)}
            className="btn btn-ghost btn-sm text-accent"
          >
            <Library className="w-4 h-4" />
            Global Library
          </button>
          <button 
            onClick={loadRoleCapabilities}
            className="btn btn-ghost btn-sm"
            disabled={loading || saving}
          >
            <RefreshCcw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </button>
          <button 
            onClick={handleSave}
            className="btn btn-accent btn-sm"
            disabled={loading || saving || !selectedRole}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-lg p-4 flex items-start gap-3 text-danger">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <div className="font-bold mb-1">Database Error</div>
            {error}
            {error.includes('role_capabilities') && (
              <div className="mt-3 flex items-center gap-3">
                <button 
                  onClick={async () => {
                    const sql = `
CREATE TABLE role_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  role text NOT NULL,
  capability text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, role, capability)
);

ALTER TABLE role_capabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON role_capabilities FOR ALL USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
                    `;
                    try {
                      await navigator.clipboard.writeText(sql);
                      setCopied(true);
                      setCopyError(false);
                      setTimeout(() => setCopied(false), 2000);
                    } catch (e) {
                      console.error('Clipboard error:', e);
                      console.log('SQL Fallback:', sql);
                      setCopyError(true);
                      setTimeout(() => setCopyError(false), 3000);
                    }
                  }}
                  className="px-3 py-1.5 bg-danger text-white rounded font-bold text-[11px] hover:bg-danger/80 transition-colors flex items-center gap-2"
                >
                  Copy Migration SQL
                </button>
                {copied && <span className="text-[11px] font-bold text-emerald-500 animate-in fade-in slide-in-from-left-2 flex items-center gap-1"><Check className="w-3 h-3" /> Copied!</span>}
                {copyError && <span className="text-[11px] font-bold text-danger animate-in fade-in slide-in-from-left-2">Copy failed — paste manually</span>}
                {!copied && !copyError && <span className="text-[11px] opacity-70 italic">Run this in your Supabase SQL Editor</span>}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Role List */}
        <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden flex flex-col h-fit">
          <div className="p-4 border-b border-border-subtle bg-surface-2 flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase tracking-widest text-ghost">Roles</h3>
            <button 
              onClick={() => setIsAddingRole(true)}
              className="p-1 hover:bg-border-subtle rounded text-primary"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-2 flex flex-col gap-1">
            {isAddingRole && (
              <div className="p-2 flex flex-col gap-2 bg-surface-2 rounded-lg mb-2">
                <input 
                  autoFocus
                  className="bg-surface-base border border-border-subtle rounded px-2 py-1.5 text-xs w-full outline-none focus:border-primary text-main"
                  placeholder="Role name..."
                  value={newRoleName}
                  onChange={e => setNewRoleName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createCustomRole()}
                />
                <div className="flex items-center gap-2">
                  <button onClick={createCustomRole} className="flex-1 bg-primary text-white text-[10px] font-bold py-1 rounded">Add</button>
                  <button onClick={() => setIsAddingRole(false)} className="flex-1 bg-surface-base text-ghost text-[10px] font-bold py-1 rounded">Cancel</button>
                </div>
              </div>
            )}
            {allRoles.map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={cn(
                  "flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-all group",
                  selectedRole === role 
                    ? "bg-primary/10 text-primary border border-primary/20" 
                    : "text-ghost hover:bg-surface-2 hover:text-main"
                )}
              >
                <span className="capitalize">{role.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-2">
                  {selectedRole === role && <Check className="w-4 h-4" />}
                  {customRoles.includes(role) && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setCustomRoles(customRoles.filter(r => r !== role));
                        if (selectedRole === role) setSelectedRole(allRoles[0]);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-danger"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Capabilities Grid */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-end gap-2">
            <button 
              onClick={() => setCollapsedCategories(new Set())}
              className="text-[10px] font-bold uppercase tracking-widest text-ghost hover:text-primary transition-colors"
            >
              Expand All
            </button>
            <div className="w-1 h-1 rounded-full bg-border-subtle" />
            <button 
              onClick={() => setCollapsedCategories(new Set(CAPABILITIES.map(c => c.category)))}
              className="text-[10px] font-bold uppercase tracking-widest text-ghost hover:text-danger transition-colors"
            >
              Collapse All
            </button>
          </div>
          {Array.from(new Set(CAPABILITIES.map(c => c.category)))
            .filter(cat => {
              if (cat === 'GOD_MODE' && !isPlatformGod) return false;
              return true;
            })
            .map((category) => {
              const isCollapsed = collapsedCategories.has(category);
            const categoryCaps = CAPABILITIES.filter(c => c.category === category);
            const activeCount = categoryCaps.filter(c => roleCaps.has(c.id)).length;

            return (
              <div key={category} className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden">
                <div 
                  className="p-4 border-b border-border-subtle bg-surface-2 flex items-center justify-between cursor-pointer hover:bg-surface-2/80 transition-colors"
                  onClick={() => {
                    const next = new Set(collapsedCategories);
                    if (next.has(category)) next.delete(category);
                    else next.add(category);
                    setCollapsedCategories(next);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <ChevronRight className={cn("w-4 h-4 text-ghost transition-transform", !isCollapsed && "rotate-90")} />
                    <h3 className="text-xs font-mono uppercase tracking-widest text-ghost">{category} Capabilities</h3>
                  </div>
                  <div className="text-[10px] text-ghost font-mono">
                    {activeCount} / {categoryCaps.length} Active
                  </div>
                </div>
                
                {!isCollapsed && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border-subtle animate-in slide-in-from-top-2 duration-200">
                    {categoryCaps.map((cap) => (
                      <button
                        key={cap.id}
                        onClick={() => toggleCapability(cap.id)}
                        className={cn(
                          "flex items-start gap-4 p-4 bg-surface-1 transition-all text-left group",
                          roleCaps.has(cap.id) ? "bg-primary/5" : "hover:bg-white/5"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all",
                          roleCaps.has(cap.id) 
                            ? "bg-primary border-primary text-white" 
                            : "border-border-normal group-hover:border-ghost"
                        )}>
                          {roleCaps.has(cap.id) && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={cn(
                            "text-sm font-semibold mb-0.5 transition-colors",
                            roleCaps.has(cap.id) ? "text-main" : "text-ghost"
                          )}>
                            {cap.label}
                          </div>
                          <div className="text-xs text-ghost leading-relaxed">
                            {cap.description}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Migration Hint */}
      <div className="bg-surface-2 border border-border-subtle rounded-xl p-6 flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-bold text-main">Database Migration Required</div>
            <div className="text-xs text-ghost mt-1 max-w-xl">
              To use granular permissions, you must create the <code className="text-accent">role_capabilities</code> table in your Supabase project. 
              This table stores the mapping between roles and their specific access rights.
            </div>
          </div>
        </div>
        <button 
          className="btn btn-ghost btn-sm text-accent flex items-center gap-2"
          onClick={async () => {
            const sql = `
CREATE TABLE role_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  role text NOT NULL,
  capability text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, role, capability)
);

ALTER TABLE role_capabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON role_capabilities FOR ALL USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()));
            `;
            try {
              await navigator.clipboard.writeText(sql);
              setCopied(true);
              setCopyError(false);
              setTimeout(() => setCopied(false), 2000);
            } catch (e) {
              console.error('Clipboard error:', e);
              console.log('SQL Fallback:', sql);
              setCopyError(true);
              setTimeout(() => setCopyError(false), 3000);
            }
          }}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-500" />
              <span className="text-emerald-500">Copied!</span>
            </>
          ) : copyError ? (
            <span className="text-danger">Failed to copy</span>
          ) : (
            'Copy SQL Script'
          )}
        </button>
      </div>
      {/* Global Library Modal */}
      {showGlobalLibrary && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6">
          <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border-subtle flex items-center justify-between bg-surface-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                  <Library className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-main">Global Roles Library</h3>
                  <p className="text-xs text-ghost">Import pre-configured roles with standard permissions</p>
                </div>
              </div>
              <button onClick={() => setShowGlobalLibrary(false)} className="p-2 hover:bg-surface-base rounded-full text-ghost">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {GLOBAL_ROLES.map(role => (
                <button 
                  key={role.id}
                  onClick={() => importFromGlobal(role)}
                  className="flex flex-col gap-2 p-4 bg-surface-2 border border-border-subtle rounded-xl hover:border-primary transition-all text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-main group-hover:text-primary">{role.label}</div>
                    <Plus className="w-4 h-4 text-ghost group-hover:text-primary" />
                  </div>
                  <p className="text-[11px] text-ghost leading-relaxed">{role.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {role.caps.slice(0, 3).map(c => (
                      <span key={c} className="text-[9px] bg-border-subtle text-ghost px-1.5 py-0.5 rounded uppercase font-mono">
                        {c.split('_')[1]}
                      </span>
                    ))}
                    {role.caps.length > 3 && <span className="text-[9px] text-ghost px-1">+ {role.caps.length - 3} more</span>}
                  </div>
                </button>
              ))}
            </div>
            <div className="p-4 bg-surface-2 border-t border-border-subtle text-center">
              <p className="text-[10px] text-ghost uppercase tracking-widest">Select a role to import into your company</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
