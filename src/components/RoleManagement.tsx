import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Role } from '../types';
import { CAPABILITIES, ROLES } from '../constants/capabilities';
import { DEFAULT_ROLE_CAPABILITIES } from '../hooks/usePermissions';
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
  ChevronDown,
  Eye, 
  Shield 
} from 'lucide-react';
import { cn } from '../lib/utils';

// Helper to determine if a capability is viewing/read-only
export function isReadCapability(capId: string): boolean {
  const idLower = capId.toLowerCase();
  return (
    idLower.includes('view') || 
    idLower.includes('read') || 
    idLower.includes('history') || 
    idLower.includes('audit') || 
    idLower.includes('metrics') ||
    idLower.includes('stats') ||
    idLower.includes('health') ||
    idLower.includes('export') ||
    idLower.includes('print') ||
    idLower === 'fin:committed' ||
    idLower === 'fin:actual' ||
    idLower === 'fin:cashflow' ||
    idLower === 'plan:manpower_req' ||
    idLower === 'plan:material_req' ||
    idLower === 'plan:equip_req' ||
    idLower === 'plan:critical_path'
  );
}

interface RoleManagementProps {
  userRole: Role;
  isPlatformGod?: boolean;
}

const GLOBAL_ROLES: { id: string; label: string; description: string; caps: string[] }[] = [
  { 
    id: 'director', 
    label: 'Managing Director', 
    description: 'Strategic executive overview, portfolio KPIs, financial performance, and executive approvals.',
    caps: [
      'dash:view', 'dash:view_portfolio', 'dash:view_kpi',
      'client:view',
      'proj:view_all', 'proj:view_financials',
      'plan:view', 'plan:view_baseline',
      'fin:view_cost', 'fin:view_budget', 'fin:claim_view', 'fin:var_view', 'fin:eot_view', 'fin:committed', 'fin:actual', 'fin:cashflow',
      'daily:view_project',
      'alert:view', 'alert:view_variance', 'alert:view_budget', 'alert:view_contract',
      'appr:view_pending', 'appr:approve', 'appr:reject', 'appr:view_instances', 'appr:view_history',
      'res:subcon_view', 'proc:view_demand', 'stock:view', 'trade:view_global', 'intel:view', 'lib:view'
    ]
  },
  { 
    id: 'project_manager', 
    label: 'Project Manager', 
    description: 'Complete project execution, checklist planning, task sequence adjustments, PO approvals, & site report monitoring.',
    caps: [
      'dash:view', 'dash:view_kpi',
      'proj:view_all', 'proj:edit', 'proj:set_checklists', 'proj:view_financials',
      'boq:view_recipes', 'boq:confirm_recipe', 'boq:view_actuals', 'boq:export', 'boq:tag_trade',
      'plan:view', 'plan:edit_dates', 'plan:sequence', 'plan:set_output', 'plan:lock_baseline', 'plan:view_baseline', 'plan:update_progress', 'plan:view_upcoming',
      'daily:submit', 'daily:view_project', 'daily:edit_draft', 'daily:log_manpower', 'daily:log_equip', 'daily:log_subcon', 'daily:attach_photo',
      'alert:view', 'alert:create_manual', 'alert:dismiss', 'alert:view_variance', 'alert:view_budget', 'alert:view_contract', 'alert:comment',
      'proc:view_demand', 'proc:create_rfq', 'proc:edit_rfq', 'proc:send_rfq', 'proc:view_bids', 'proc:compare_bids', 'proc:select_vendor', 'proc:track_pipeline',
      'po:create', 'po:edit', 'po:issue', 'po:view_all', 'po:print', 'po:view_payments',
      'stock:view', 'stock:issue', 'stock:return', 'stock:view_history',
      'fin:view_cost', 'fin:view_budget', 'fin:edit_budget', 'fin:claim_create', 'fin:claim_view', 'fin:var_create', 'fin:var_view', 'fin:eot_create', 'fin:eot_view', 'fin:subcon_agree', 'fin:subcon_pay', 'fin:committed', 'fin:actual', 'fin:cashflow',
      'sup:view_company', 'sup:rate', 'sup:contacts',
      'appr:view_pending', 'appr:approve', 'appr:reject', 'appr:view_instances', 'appr:view_history',
      'res:subcon_view', 'trade:view_global', 'intel:view', 'lib:view'
    ]
  },
  { 
    id: 'project_coordinator', 
    label: 'Project Coordinator', 
    description: 'Coordination support, milestone updates, schedule tracking, procurement tracking, and general read authorizations.',
    caps: [
      'dash:view', 'dash:view_kpi',
      'proj:view_all', 'proj:view_financials',
      'plan:view', 'plan:view_baseline', 'plan:view_upcoming', 'plan:manpower_req', 'plan:material_req', 'plan:equip_req',
      'daily:view_project', 'daily:view_snapshot',
      'alert:view', 'alert:view_variance', 'alert:comment',
      'proc:view_demand', 'proc:track_pipeline',
      'stock:view',
      'res:subcon_view', 'trade:view_global', 'intel:view', 'lib:view',
      'appr:view_pending', 'appr:view_instances'
    ]
  },
  { 
    id: 'contract_admin', 
    label: 'Contract Administrator', 
    description: 'Contract administration, subcontractor agreements, progress evaluation claims, and variations tracking.',
    caps: [
      'proj:view_all',
      'boq:view_recipes', 'boq:view_actuals',
      'plan:view',
      'fin:claim_view', 'fin:var_create', 'fin:var_view', 'fin:eot_create', 'fin:eot_view', 'fin:subcon_agree', 'fin:subcon_pay', 'fin:committed', 'fin:actual',
      'res:subcon_view', 'res:subcon_manage',
      'appr:view_pending', 'appr:approve', 'appr:reject', 'appr:view_history',
      'trade:view_global', 'lib:view'
    ]
  },
  { 
    id: 'qs', 
    label: 'Quantity Surveyor (QS)', 
    description: 'Responsible for BOQ imports, contract adjustment, survey audits, trade rates, and material specifications.',
    caps: [
      'proj:view_all',
      'boq:import', 'boq:edit_contract', 'boq:set_surveyed', 'boq:view_recipes', 'boq:confirm_recipe', 'boq:create_section', 'boq:assign_section', 'boq:view_actuals', 'boq:export', 'boq:add_item', 'boq:delete_item', 'boq:tag_trade', 'boq:manage_baseline', 'boq:survey_audit',
      'trade:view_global', 'trade:create_company', 'trade:edit_company', 'trade:import', 'trade:manage_groups', 'trade:view_goal', 'trade:view_unit', 'trade:link_material', 'trade:link_labour', 'trade:link_equip', 'trade:audit',
      'res:mat_view', 'res:labour_view', 'res:equip_view', 'res:subcon_view',
      'plan:view', 'plan:view_baseline', 'plan:material_req',
      'fin:view_cost', 'fin:view_budget', 'fin:claim_view', 'fin:var_create', 'fin:var_view', 'fin:eot_view', 'fin:committed', 'fin:actual',
      'appr:view_pending', 'appr:approve', 'appr:reject',
      'lib:view'
    ]
  },
  { 
    id: 'finance', 
    label: 'Finance Officer', 
    description: 'Budget oversight, invoice matching, payment approvals, financial forecasting, and cashflow monitoring.',
    caps: [
      'dash:view', 'dash:view_portfolio', 'dash:view_kpi',
      'proj:view_all', 'proj:view_financials',
      'fin:view_cost', 'fin:view_budget', 'fin:edit_budget', 'fin:approve_budget', 'fin:claim_view', 'fin:claim_approve', 'fin:var_view', 'fin:var_approve', 'fin:eot_view', 'fin:committed', 'fin:actual', 'fin:cashflow', 'fin:export', 'fin:match_invoice', 'fin:audit',
      'po:view_all', 'po:view_payments', 'po:approve',
      'proc:view_demand', 'proc:track_pipeline',
      'appr:view_pending', 'appr:approve', 'appr:reject', 'appr:view_history',
      'stock:view', 'trade:view_global', 'intel:view', 'lib:view'
    ]
  },
  { 
    id: 'procurement', 
    label: 'Procurement Specialist', 
    description: 'Supplier catalogs, pipeline analysis, RFQ compare & vendor selection, PO creation, and tracking delivery status.',
    caps: [
      'proj:view_all',
      'res:mat_view', 'res:mat_manage', 'res:subcon_view',
      'proc:view_demand', 'proc:create_rfq', 'proc:edit_rfq', 'proc:send_rfq', 'proc:view_bids', 'proc:compare_bids', 'proc:select_vendor', 'proc:approve_rfq', 'proc:view_all_rfq', 'proc:cancel_rfq', 'proc:track_pipeline', 'proc:manage_types', 'proc:view_certified', 'proc:demand_manual', 'proc:rfq_docs', 'proc:supplier_invite', 'proc:audit',
      'po:create', 'po:edit', 'po:issue', 'po:view_all', 'po:cancel', 'po:close', 'po:track_delivery', 'po:print', 'po:view_payments', 'po:manage_terms', 'po:amend', 'po:audit',
      'sup:view_global', 'sup:view_company', 'sup:manage', 'sup:rate', 'sup:view_history', 'sup:categories', 'sup:compliance', 'sup:contacts', 'sup:regions', 'sup:metrics', 'sup:portal_invite', 'sup:archive', 'sup:audit',
      'stock:view', 'stock:view_history',
      'appr:view_pending', 'appr:approve', 'appr:reject',
      'trade:view_global', 'lib:view'
    ]
  },
  { 
    id: 'site_supervisor', 
    label: 'Site Supervisor', 
    description: 'Daily diaries submission, weather logs, subcontractor audits, field logs, and warehouse material collections.',
    caps: [
      'proj:view_all',
      'plan:view', 'plan:view_upcoming',
      'daily:submit', 'daily:view_own', 'daily:view_project', 'daily:edit_draft', 'daily:log_manpower', 'daily:log_equip', 'daily:log_fuel', 'daily:log_subcon', 'daily:log_weather', 'daily:attach_photo',
      'alert:view', 'alert:create_manual', 'alert:dismiss',
      'stock:view', 'stock:issue', 'stock:return', 'stock:view_history'
    ]
  },
  { 
    id: 'site_encoder', 
    label: 'Site Data Encoder', 
    description: 'Data entry assistant, records site report drafts, registers physical equipment hours, fuel levels, and manpower counts.',
    caps: [
      'proj:view_all',
      'plan:view', 'plan:view_upcoming',
      'daily:submit', 'daily:view_own', 'daily:edit_draft', 'daily:log_manpower', 'daily:log_equip', 'daily:log_fuel', 'daily:log_subcon', 'daily:log_weather', 'daily:attach_photo',
      'alert:view', 'alert:create_manual'
    ]
  },
  { 
    id: 'storeman', 
    label: 'Warehouse Storeman', 
    description: 'Warehouse/Inventory management, inbound GRN slip registration, stock adjustments, issues, and transfers.',
    caps: [
      'proj:view_all',
      'stock:view', 'stock:grn_step1', 'stock:grn_step2', 'stock:issue', 'stock:return', 'stock:transfer', 'stock:adjust', 'stock:view_history', 'stock:low_alert', 'stock:view_location', 'stock:audit_count', 'stock:dispose',
      'po:view_all', 'po:track_delivery',
      'alert:view', 'alert:dismiss'
    ]
  },
  { 
    id: 'client', 
    label: 'External Client / Stakeholder', 
    description: 'Limited visibility client portal showing high-level construction progress, approved contract variations, and claims.',
    caps: [
      'client:view', 'dash:view',
      'proj:view_all',
      'plan:view', 'plan:view_baseline',
      'fin:claim_view', 'fin:var_view', 'fin:eot_view'
    ]
  }
];

export function RoleManagement({ userRole, isPlatformGod }: RoleManagementProps) {
  const [tenantId, setTenantId] = useState<string>('');
  const [strategy, setStrategy] = useState<'role' | 'user'>('role');
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

  const handleStrategyChange = async (newStrategy: 'role' | 'user') => {
    if (!tenantId) return;
    setStrategy(newStrategy);
    
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ permission_strategy: newStrategy })
        .eq('id', tenantId);
      if (error) {
        console.warn('Could not persist permission_strategy column in tenants table:', error);
      }
    } catch (e) {
      console.warn('Skipping tenant strategy db-save:', e);
    }

    alert(`System updated! Permissions are now evaluated using ${newStrategy === 'role' ? 'Role-Based Access (RBAC)' : 'User-Specific Bespoke Override Caps'}.`);
  };

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

      setTenantId(profile.tenant_id);

      // Attempt to load tenant permission strategy from DB
      let dbTenantStrategy: string | null = null;
      try {
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('permission_strategy')
          .eq('id', profile.tenant_id)
          .single();
        if (tenantData && 'permission_strategy' in tenantData) {
          dbTenantStrategy = (tenantData as any).permission_strategy;
        }
      } catch (e) {
        console.warn('Could not read permission_strategy from tenants table.');
      }

      const activeStrategy = (dbTenantStrategy || 'role') as 'role' | 'user';
      setStrategy(activeStrategy);

      const { data, error } = await supabase
        .from('role_capabilities')
        .select('role')
        .eq('tenant_id', profile.tenant_id);

      if (error) throw error;

      const localCustomStr = localStorage.getItem(`custom_roles_${profile.tenant_id}`);
      let localCustom: string[] = [];
      if (localCustomStr) {
        try {
          localCustom = JSON.parse(localCustomStr);
        } catch {}
      }

      const uniqueRoles = Array.from(new Set([
        ...(data || []).map(d => d.role),
        ...localCustom
      ]));
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

    const updated = [...customRoles, roleId];
    setCustomRoles(updated);
    if (tenantId) {
      localStorage.setItem(`custom_roles_${tenantId}`, JSON.stringify(updated));
    }
    setSelectedRole(roleId);
    setRoleCaps(new Set());
    setIsAddingRole(false);
    setNewRoleName('');
    window.dispatchEvent(new Event('roles-updated'));
  };

  const importFromGlobal = (globalRole: typeof GLOBAL_ROLES[0]) => {
    let updatedCustom = [...customRoles];
    if (!allRoles.includes(globalRole.id)) {
      updatedCustom = [...customRoles, globalRole.id];
      setCustomRoles(updatedCustom);
      if (tenantId) {
        localStorage.setItem(`custom_roles_${tenantId}`, JSON.stringify(updatedCustom));
      }
      setSelectedRole(globalRole.id);
    } else {
      setSelectedRole(globalRole.id);
    }
    setRoleCaps(new Set(globalRole.caps));
    setShowGlobalLibrary(false);
    window.dispatchEvent(new Event('roles-updated'));
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
      
      if (!data || data.length === 0) {
        const defaults = DEFAULT_ROLE_CAPABILITIES[selectedRole as Role] || [];
        setRoleCaps(new Set(defaults));
      } else {
        setRoleCaps(new Set(data.map(d => d.capability)));
      }
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

      {/* Strategic Permission Selector Banner */}
      <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[9px] font-mono tracking-wider font-extrabold uppercase rounded bg-primary/10 text-primary border border-primary/20">
              Authority Options Engine
            </span>
            <span className="text-ghost text-xs">•</span>
            <span className="text-[10px] text-ghost font-semibold uppercase font-mono">
              Strategy: {strategy === 'role' ? 'Role-Based Access' : 'User-Based Overrides'}
            </span>
          </div>
          <h2 className="text-sm font-black text-main uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Platform Control Permission Strategy
          </h2>
          <p className="text-xs text-ghost leading-relaxed">
            Choose how your company evaluates user authority across modules. <b>Role-Based (RBAC)</b> assigns templates to standard roles like Project Managers and Quantity Surveyors. <b>User-Based</b> ignores roles to evaluate unique, highly customized permissions specifically on a per-user list.
          </p>
        </div>

        <div className="flex bg-surface-base border border-border-subtle rounded-xl p-1 shrink-0 select-none">
          <button
            onClick={() => handleStrategyChange('role')}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5",
              strategy === 'role'
                ? "bg-primary text-surface-base shadow-sm font-black"
                : "text-ghost hover:text-main"
            )}
          >
            <Lock className="w-3.5 h-3.5" />
            Role-Based (RBAC)
          </button>
          <button
            onClick={() => handleStrategyChange('user')}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5",
              strategy === 'user'
                ? "bg-accent text-white shadow-sm font-black"
                : "text-ghost hover:text-main"
            )}
          >
            <Unlock className="w-3.5 h-3.5" />
            User-Based (Bespoke)
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
                    <span 
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCustomRoles(customRoles.filter(r => r !== role));
                        if (selectedRole === role) setSelectedRole(allRoles[0]);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          e.preventDefault();
                          setCustomRoles(customRoles.filter(r => r !== role));
                          if (selectedRole === role) setSelectedRole(allRoles[0]);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-danger cursor-pointer inline-flex items-center justify-center"
                      title="Delete role"
                    >
                      <Trash2 className="w-3 h-3" />
                    </span>
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
            
            const readCaps = categoryCaps.filter(c => isReadCapability(c.id));
            const writeCaps = categoryCaps.filter(c => !isReadCapability(c.id));

            return (
              <div key={category} className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
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
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] bg-primary/10 text-primary border border-primary/20 rounded-full font-bold">
                      {activeCount} / {categoryCaps.length} Active
                    </span>
                  </div>
                </div>
                
                {!isCollapsed && (
                  <div className="flex flex-col divide-y divide-border-subtle/50 bg-surface-base">
                    {/* 1. VIEWING & READ ACCESS */}
                    {readCaps.length > 0 && (
                      <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2 pb-1 text-ghost border-b border-border-subtle/30">
                          <Eye className="w-3.5 h-3.5 text-primary" />
                          <h4 className="text-[11px] font-black uppercase tracking-wider">Viewing & Read-Only Authority</h4>
                          <span className="text-[10px] text-ghost opacity-60">•</span>
                          <span className="text-[10px] font-mono text-ghost">
                            {readCaps.filter(c => roleCaps.has(c.id)).length} of {readCaps.length} enabled
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {readCaps.map((cap) => (
                            <button
                              key={cap.id}
                              onClick={() => toggleCapability(cap.id)}
                              className={cn(
                                "flex items-start gap-3 p-3 rounded-xl border transition-all text-left group cursor-pointer",
                                roleCaps.has(cap.id) 
                                  ? "bg-primary/5 border-primary/25" 
                                  : "bg-surface-1 border-border-subtle/80 hover:border-ghost/50 hover:bg-surface-2/50"
                              )}
                            >
                              <div className={cn(
                                "w-4.5 h-4.5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all",
                                roleCaps.has(cap.id) 
                                  ? "bg-primary border-primary text-white" 
                                  : "border-border-normal group-hover:border-ghost bg-surface-2"
                              )}>
                                {roleCaps.has(cap.id) && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={cn(
                                  "text-xs font-bold mb-0.5 transition-colors",
                                  roleCaps.has(cap.id) ? "text-main" : "text-ghost group-hover:text-dim"
                                )}>
                                  {cap.label}
                                </div>
                                <div className="text-[11px] text-ghost leading-normal">
                                  {cap.description}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 2. ADMINISTRATIVE & EXECUTION ACCESS */}
                    {writeCaps.length > 0 && (
                      <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2 pb-1 text-ghost border-b border-border-subtle/30">
                          <Shield className="w-3.5 h-3.5 text-accent" />
                          <h4 className="text-[11px] font-black uppercase tracking-wider">Execution, Write & Modification Authority</h4>
                          <span className="text-[10px] text-ghost opacity-60">•</span>
                          <span className="text-[10px] font-mono text-ghost">
                            {writeCaps.filter(c => roleCaps.has(c.id)).length} of {writeCaps.length} enabled
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {writeCaps.map((cap) => (
                            <button
                              key={cap.id}
                              onClick={() => toggleCapability(cap.id)}
                              className={cn(
                                "flex items-start gap-3 p-3 rounded-xl border transition-all text-left group cursor-pointer",
                                roleCaps.has(cap.id) 
                                  ? "bg-accent/5 border-accent/25" 
                                  : "bg-surface-1 border-border-subtle/80 hover:border-ghost/50 hover:bg-surface-2/50"
                              )}
                            >
                              <div className={cn(
                                "w-4.5 h-4.5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all",
                                roleCaps.has(cap.id) 
                                  ? "bg-accent border-accent text-white" 
                                  : "border-border-normal group-hover:border-ghost bg-surface-2"
                              )}>
                                {roleCaps.has(cap.id) && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={cn(
                                  "text-xs font-bold mb-0.5 transition-colors",
                                  roleCaps.has(cap.id) ? "text-main font-bold" : "text-ghost group-hover:text-dim"
                                )}>
                                  {cap.label}
                                </div>
                                <div className="text-[11px] text-ghost leading-normal">
                                  {cap.description}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
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
