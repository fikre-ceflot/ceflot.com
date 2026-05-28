import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Role, UserProfile } from '../types';

export type Capability = 
  // 1. Project Management
  | 'proj:create' | 'proj:edit' | 'proj:archive' | 'proj:view_all' | 'proj:assign_roles' | 'proj:set_checklists' | 'proj:view_financials' | 'proj:delete'
  // 2. BOQ & Quantity Management
  | 'boq:import' | 'boq:edit_contract' | 'boq:set_surveyed' | 'boq:view_recipes' | 'boq:confirm_recipe' | 'boq:create_section' | 'boq:assign_section' | 'boq:view_actuals' | 'boq:export' | 'boq:add_item' | 'boq:delete_item' | 'boq:tag_trade' | 'boq:manage_baseline' | 'boq:survey_audit'
  // 3. Trade Library
  | 'trade:view_global' | 'trade:create_company' | 'trade:edit_company' | 'trade:promote' | 'trade:import' | 'trade:archive' | 'trade:manage_groups' | 'trade:view_goal' | 'trade:view_unit' | 'trade:link_material' | 'trade:link_labour' | 'trade:link_equip' | 'trade:global_edit' | 'trade:audit'
  // 4. Resource Library
  | 'res:mat_view' | 'res:mat_manage' | 'res:labour_view' | 'res:labour_manage' | 'res:equip_view' | 'res:equip_manage' | 'res:veh_view' | 'res:veh_manage' | 'res:fuel_view' | 'res:fuel_manage' | 'res:subcon_view' | 'res:subcon_manage' | 'res:import_all' | 'res:set_rates' | 'res:global_consume' | 'res:global_manage' | 'res:tag_category' | 'res:archive' | 'res:audit' | 'res:view_origins'
  // 5. Planning & Schedule
  | 'plan:view' | 'plan:edit_dates' | 'plan:sequence' | 'plan:set_output' | 'plan:lock_baseline' | 'plan:view_baseline' | 'plan:reset' | 'plan:critical_path' | 'plan:update_progress' | 'plan:manage_sections' | 'plan:view_upcoming' | 'plan:export_gantt' | 'plan:manpower_req' | 'plan:material_req' | 'plan:equip_req'
  // 6. Daily Reports & Site Execution
  | 'daily:submit' | 'daily:view_own' | 'daily:view_project' | 'daily:edit_draft' | 'daily:emergency_edit' | 'daily:force_approve' | 'daily:view_edits' | 'daily:log_manpower' | 'daily:log_equip' | 'daily:log_fuel' | 'daily:log_subcon' | 'daily:log_weather' | 'daily:attach_photo' | 'daily:view_snapshot' | 'daily:delete'
  // 7. Alerts & Incidents
  | 'alert:view' | 'alert:create_manual' | 'alert:dismiss' | 'alert:set_thresholds' | 'alert:load_presets' | 'alert:view_variance' | 'alert:view_budget' | 'alert:view_contract' | 'alert:assign' | 'alert:comment' | 'alert:escalate' | 'alert:view_history' | 'alert:export' | 'alert:ncr_manage'
  // 8. Procurement — Demand & RFQ
  | 'proc:view_demand' | 'proc:create_rfq' | 'proc:edit_rfq' | 'proc:send_rfq' | 'proc:view_bids' | 'proc:compare_bids' | 'proc:select_vendor' | 'proc:approve_rfq' | 'proc:view_all_rfq' | 'proc:cancel_rfq' | 'proc:track_pipeline' | 'proc:manage_types' | 'proc:view_certified' | 'proc:demand_manual' | 'proc:rfq_docs' | 'proc:supplier_invite' | 'proc:audit'
  // 9. Purchase Orders
  | 'po:create' | 'po:edit' | 'po:approve' | 'po:issue' | 'po:view_all' | 'po:cancel' | 'po:close' | 'po:track_delivery' | 'po:print' | 'po:view_payments' | 'po:manage_terms' | 'po:link_variation' | 'po:amend' | 'po:audit'
  // 10. Warehouse & Stock
  | 'stock:view' | 'stock:grn_step1' | 'stock:grn_step2' | 'stock:issue' | 'stock:return' | 'stock:transfer' | 'stock:adjust' | 'stock:view_history' | 'stock:low_alert' | 'stock:view_location' | 'stock:audit_count' | 'stock:dispose'
  // 11. Financials & Variations
  | 'fin:view_cost' | 'fin:view_budget' | 'fin:edit_budget' | 'fin:approve_budget' | 'fin:claim_create' | 'fin:claim_view' | 'fin:claim_approve' | 'fin:var_create' | 'fin:var_view' | 'fin:var_approve' | 'fin:eot_create' | 'fin:eot_view' | 'fin:subcon_agree' | 'fin:subcon_pay' | 'fin:committed' | 'fin:actual' | 'fin:cashflow' | 'fin:export' | 'fin:manage_rates' | 'fin:match_invoice' | 'fin:audit'
  // 12. Supplier Management
  | 'sup:view_global' | 'sup:view_company' | 'sup:manage' | 'sup:rate' | 'sup:view_history' | 'sup:categories' | 'sup:compliance' | 'sup:blacklist' | 'sup:contacts' | 'sup:regions' | 'sup:metrics' | 'sup:portal_invite' | 'sup:global_edit' | 'sup:archive' | 'sup:audit'
  // 13. Approval Chains
  | 'appr:view_chains' | 'appr:manage' | 'appr:load_global' | 'appr:set_logic' | 'appr:view_pending' | 'appr:approve' | 'appr:reject' | 'appr:delegate' | 'appr:view_instances' | 'appr:escalate' | 'appr:view_history' | 'appr:set_deadlines' | 'appr:bypass' | 'appr:notify' | 'appr:archive' | 'appr:audit'
  // 14. User & Company Admin
  | 'admin:view_users' | 'admin:create_user' | 'admin:edit_user' | 'admin:suspend' | 'admin:view_roles' | 'admin:create_role' | 'admin:edit_role' | 'admin:load_role_profile' | 'admin:override' | 'admin:view_tenant' | 'admin:edit_tenant' | 'admin:set_preferences' | 'admin:view_audit' | 'admin:view_sessions' | 'admin:manage_teams' | 'admin:security' | 'admin:import_users' | 'admin:view_god_logs' | 'admin:reset_password'
  // 15. Reports & Dashboards
  | 'dash:view' | 'dash:create_panel' | 'dash:edit_panel' | 'dash:load_preset' | 'dash:share' | 'dash:export' | 'dash:view_portfolio' | 'dash:set_home' | 'dash:manage' | 'dash:view_kpi' | 'client:view'
  // 16. Global Library (Platform God Only)
  | 'god:lib_role' | 'god:lib_appr' | 'god:lib_alert' | 'god:lib_dash' | 'god:lib_boq' | 'god:lib_check' | 'god:lib_trade' | 'god:lib_res' | 'god:lib_sup' | 'god:lib_version' | 'god:lib_publish' | 'god:lib_audit'
  // 17. Company Management (Platform God Only)
  | 'god:tenant_create' | 'god:tenant_suspend' | 'god:tenant_view_all' | 'god:tenant_bypass_rls' | 'god:tenant_clone' | 'god:tenant_stats' | 'god:tenant_reset' | 'god:tenant_support' | 'god:tenant_db' | 'god:tenant_limits' | 'god:tenant_audit' | 'god:tenant_manage_admin'
  // 18. System (Platform God Only)
  | 'sys:health' | 'sys:config' | 'sys:backup' | 'sys:migrate' | 'sys:broadcast'
  // 19. Field App Guidance
  | 'field:view_progress' | 'field:view_grouped_progress' | 'field:view_upcoming' | 'field:trade_guide_view' | 'field:offline_sync' | 'field:alert_quick' | 'field:view_baselines' | 'field:pwa_install'
  // Legacy (to be migrated)
  | 'view_dashboard' | 'view_projects' | 'manage_boq' | 'view_budget' | 'approve_budget' | 'manage_planning' | 'manage_resources' | 'manage_trades' | 'manage_variations' | 'manage_subcontractors' | 'manage_users' | 'manage_permissions';

export function usePermissions(role: Role | undefined, tenantId: string | undefined, userProfile?: UserProfile | null) {
  const [capabilities, setCapabilities] = useState<Set<Capability>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!role || !tenantId) {
      setLoading(false);
      return;
    }

    async function loadCapabilities() {
      try {
        let targetUserId = userProfile?.id;

        // If userProfile not provided, try to fetch current user's profile
        if (!userProfile) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('id, email, full_name, role, tenant_id, is_platform_god, is_active, created_at, updated_at')
              .eq('id', user.id)
              .single();
            
            if (profile) {
              targetUserId = profile.id;
            }
          }
        }

        // Read user-specific permission strategy, defaulting to role-based (RBAC)
        const strategy = targetUserId ? (localStorage.getItem(`permission_strategy_${targetUserId}`) || 'role') : 'role';

        if (strategy === 'role') {
          const { data, error } = await supabase
            .from('role_capabilities')
            .select('capability')
            .eq('role', role)
            .eq('tenant_id', tenantId);

          if (error) {
            if (error.code === 'PGRST116' || error.message?.includes('public.role_capabilities')) {
              console.warn('Permissions table not yet created. Using role defaults.');
              setCapabilities(new Set());
              return;
            }
            throw error;
          }
          setCapabilities(new Set(data.map(d => d.capability as Capability)));
        } else if (targetUserId) {
          // User-based strategy
          const { data, error } = await supabase
            .from('user_capabilities')
            .select('capability')
            .eq('user_id', targetUserId)
            .eq('tenant_id', tenantId);

          if (error) {
            if (error.code === 'PGRST116' || error.message?.includes('public.user_capabilities') || error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
              console.warn('User capabilities table not yet created or not in schema cache. Falling back to localStorage.');
              const fallbackStr = localStorage.getItem(`user_caps_fallback_${targetUserId}`);
              if (fallbackStr) {
                try {
                  const parsed = JSON.parse(fallbackStr);
                  setCapabilities(new Set(parsed as Capability[]));
                  return;
                } catch (pe) {
                  console.error('Failed to parse localStorage user capabilities:', pe);
                }
              }
              setCapabilities(new Set());
              return;
            }
            throw error;
          }
          setCapabilities(new Set(data.map(d => d.capability as Capability)));
        }
      } catch (e: any) {
        console.error('Error loading capabilities:', e);
        // Clean fallback to local storage if user-based strategy failed
        const targetUserId = userProfile?.id;
        if (targetUserId) {
          const fallbackStr = localStorage.getItem(`user_caps_fallback_${targetUserId}`);
          if (fallbackStr) {
            try {
              const parsed = JSON.parse(fallbackStr);
              setCapabilities(new Set(parsed as Capability[]));
              return;
            } catch {}
          }
        }
        setCapabilities(new Set(['view_dashboard', 'view_projects'] as Capability[]));
      } finally {
        setLoading(false);
      }
    }

    loadCapabilities();
  }, [role, tenantId, userProfile?.id]);

  const hasCapability = (cap: Capability) => {
    // Platform God and Tenant Admin have all permissions by default
    if (role === 'platform_god' || role === 'tenant_admin') return true;
    return capabilities.has(cap);
  };

  return { capabilities, hasCapability, loading };
}
