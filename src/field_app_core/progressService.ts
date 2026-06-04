import { supabase } from './supabase';

export interface SubcontractorProgressItem {
  subcontractor_id: string;
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

export async function fetchSubcontractorProgress(projectId: string): Promise<SubcontractorProgressItem[]> {
  try {
    // We always use the robust manual client-side join calculation to guarantee 100% accuracy,
    // avoiding the v_subcontractor_progress database view which has stale constraints/bugs.
    
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
      `).eq('daily_progress.project_id', projectId).in('daily_progress.status', ['draft', 'submitted', 'reviewed']),
      supabase.from('subcontractors').select('*')
    ]);

    if (!boqItems || !subs) return [];

    // B. Calculate progress per sub+item
    const subProgressMap = new Map<string, number>(); // key: subId_boqId
    activities?.forEach(act => {
      // Find subcontractor: either act.subcontractor_id, or look it up from subcontractor_assignments using act.boq_item_id
      let subId = act.subcontractor_id;
      if (!subId) {
        const matchingAssign = assignments?.find(a => a.boq_item_id === act.boq_item_id);
        subId = matchingAssign?.subcontractor_id;
      }
      if (!subId || !act.boq_item_id) return;
      const key = `${subId}_${act.boq_item_id}`;
      subProgressMap.set(key, (subProgressMap.get(key) || 0) + (Number(act.progress_qty) || 0));
    });

    // C. Reconstruct the view rows
    const results: SubcontractorProgressItem[] = [];

    subs.forEach(s => {
      boqItems.forEach(bi => {
        const assignment = assignments?.find(a => a.subcontractor_id === s.id && a.boq_item_id === bi.id);
        const cumulativeQty = subProgressMap.get(`${s.id}_${bi.id}`) || 0;

        // Where cumulative progress exists OR they are assigned to this items
        if (cumulativeQty > 0 || assignment) {
          const agreedQty = assignment?.contract_qty ?? bi.contract_qty ?? 0;
          const agreedRate = assignment?.contract_rate ?? bi.contract_rate ?? 0;
          const finalAgreedQty = Number(agreedQty) > 0 ? Number(agreedQty) : (Number(bi.contract_qty) || 0);
          
          results.push({
            subcontractor_id: s.id,
            subcontractor_name: s.company_name,
            boq_item_id: bi.id,
            boq_description: bi.description,
            unit: bi.unit,
            agreed_qty: finalAgreedQty,
            cumulative_progress_qty: Number(cumulativeQty),
            progress_pct: finalAgreedQty > 0 ? (cumulativeQty / finalAgreedQty) * 100 : 0,
            earned_value: cumulativeQty * Number(agreedRate),
            agreed_amount: finalAgreedQty * Number(agreedRate),
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
