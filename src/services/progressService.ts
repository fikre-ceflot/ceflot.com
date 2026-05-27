import { supabase } from '../lib/supabase';

export interface SubcontractorProgressItem {
  subcontractor_name: string;
  boq_item_id: string;
  boq_description: string;
  unit: string;
  agreed_qty: number;
  cumulative_progress_qty: number;
  progress_pct: number;
  earned_value: number;
  agreed_amount: number;
  agreed_rate: number;
  project_id: string;
  tenant_id: string;
}

/**
 * Fallback to manual join if the v_subcontractor_progress view is missing.
 */
export async function fetchSubcontractorProgress(projectId: string): Promise<SubcontractorProgressItem[]> {
  try {
    // 1. First, try the view (optimized path)
    const { data: viewData, error: viewError } = await supabase
      .from('v_subcontractor_progress')
      .select('*')
      .eq('project_id', projectId);

    if (!viewError) return viewData as SubcontractorProgressItem[];
    
    // If it's a specific "not found" error, proceed to fallback.
    // Otherwise, throw if it's a real permission or network error.
    if (!viewError.message.includes('not found') && !viewError.message.includes('schema cache')) {
      throw viewError;
    }

    console.warn('v_subcontractor_progress view not found, falling back to manual join');

    // 2. FALLBACK MANUAL JOIN
    // This implements the logic of the view in SQL but in JS
    
    // A. Fetch base data
    const [
      { data: boqItems },
      { data: assignments },
      { data: activities },
      { data: subs }
    ] = await Promise.all([
      supabase.from('boq_items').select('*').eq('project_id', projectId),
      supabase.from('subcontractor_assignments').select('*').eq('project_id', projectId),
      supabase.from('daily_activities').select(`
        *,
        daily_progress!inner(status, project_id)
      `).eq('daily_progress.project_id', projectId).in('daily_progress.status', ['submitted', 'reviewed']),
      supabase.from('subcontractors').select('*')
    ]);

    if (!boqItems || !subs) return [];

    // B. Calculate progress per sub+item
    const subProgressMap = new Map<string, number>(); // key: subId_boqId
    activities?.forEach(act => {
      if (!act.subcontractor_id || !act.boq_item_id) return;
      const key = `${act.subcontractor_id}_${act.boq_item_id}`;
      subProgressMap.set(key, (subProgressMap.get(key) || 0) + (Number(act.progress_qty) || 0));
    });

    // C. Reconstruct the view rows
    const results: SubcontractorProgressItem[] = [];

    subs.forEach(s => {
      boqItems.forEach(bi => {
        const assignment = assignments?.find(a => a.subcontractor_id === s.id && a.boq_item_id === bi.id);
        const cumulativeQty = subProgressMap.get(`${s.id}_${bi.id}`) || 0;

        // View logic: WHERE sp.cumulative_progress_qty > 0 OR sa.id IS NOT NULL;
        if (cumulativeQty > 0 || assignment) {
          const agreedQty = assignment?.contract_qty ?? bi.contract_qty;
          const agreedRate = assignment?.contract_rate ?? bi.contract_rate;
          
          results.push({
            subcontractor_name: s.company_name,
            boq_item_id: bi.id,
            boq_description: bi.description,
            unit: bi.unit,
            agreed_qty: Number(agreedQty),
            cumulative_progress_qty: Number(cumulativeQty),
            progress_pct: agreedQty > 0 ? (cumulativeQty / agreedQty) * 100 : 0,
            earned_value: cumulativeQty * Number(agreedRate),
            agreed_amount: Number(agreedQty) * Number(agreedRate),
            agreed_rate: Number(agreedRate),
            project_id: projectId,
            tenant_id: bi.tenant_id
          });
        }
      });
    });

    return results;
  } catch (err: any) {
    console.error('Error in fetchSubcontractorProgress:', err.message);
    throw err;
  }
}
