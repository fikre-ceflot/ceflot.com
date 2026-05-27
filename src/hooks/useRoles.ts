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

        if (error) {
          if (error.message?.includes('public.role_capabilities')) {
             // Table might not exist yet, just use defaults
             setRoles(ROLES);
             return;
          }
          throw error;
        }

        const uniqueCustomRoles = Array.from(new Set(data.map(d => d.role)))
          .filter(r => !ROLES.includes(r as any));
        
        setRoles([...ROLES, ...uniqueCustomRoles]);
      } catch (e) {
        console.error('Error loading roles:', e);
        setRoles(ROLES);
      } finally {
        setLoading(false);
      }
    }

    loadRoles();
  }, [tenantId]);

  return { roles, loading };
}
