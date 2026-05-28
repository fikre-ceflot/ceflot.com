import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ROLES } from '../constants/capabilities';

export function useRoles(tenantId: string | undefined) {
  const [roles, setRoles] = useState<string[]>(ROLES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    async function loadRoles() {
      try {
        const { data, error } = await supabase
          .from('role_capabilities')
          .select('role')
          .eq('tenant_id', tenantId);

        const localCustomStr = localStorage.getItem(`custom_roles_${tenantId}`);
        let localCustom: string[] = [];
        if (localCustomStr) {
          try {
            localCustom = JSON.parse(localCustomStr);
          } catch {}
        }

        if (error) {
          if (error.message?.includes('public.role_capabilities') || error.message?.includes('does not exist')) {
            // Table might not exist yet, merge with custom local storage storage
            setRoles(Array.from(new Set([...ROLES, ...localCustom])));
            return;
          }
          throw error;
        }

        const uniqueCustomRoles = Array.from(new Set([
          ...(data || []).map(d => d.role),
          ...localCustom
        ])).filter(r => !ROLES.includes(r as any));
        
        setRoles([...ROLES, ...uniqueCustomRoles]);
      } catch (e) {
        console.error('Error loading roles:', e);
        const fallbackStr = localStorage.getItem(`custom_roles_${tenantId}`);
        let fallbackCustom: string[] = [];
        if (fallbackStr) {
          try { fallbackCustom = JSON.parse(fallbackStr); } catch {}
        }
        setRoles(Array.from(new Set([...ROLES, ...fallbackCustom])));
      } finally {
        setLoading(false);
      }
    }

    loadRoles();

    // Re-verify and reload roles when they are modified in the configuration panel
    window.addEventListener('roles-updated', loadRoles);
    return () => {
      window.removeEventListener('roles-updated', loadRoles);
    };
  }, [tenantId]);

  return { roles, loading };
}
