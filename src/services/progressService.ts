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
    // Attempt to query the optimized database view FIRST
    const { data: viewData, error: viewErr } = await supabase
      .from('v_subcontractor_progress')
      .select('*')
      .eq('project_id', projectId);

    if (!viewErr && viewData) {
      console.log(`[DEBUG] Successfully fetched ${viewData.length} subcontractor progress rows from v_subcontractor_progress view`);
      return viewData.map((row: any) => ({
        subcontractor_name: row.subcontractor_name,
        boq_item_id: row.boq_item_id,
        boq_description: row.boq_description,
        unit: row.unit,
        agreed_qty: Number(row.agreed_qty) || 0,
        cumulative_progress_qty: Number(row.cumulative_progress_qty) || 0,
        progress_pct: Number(row.progress_pct) || 0,
        earned_value: Number(row.earned_value) || 0,
        agreed_amount: Number(row.agreed_amount) || 0,
        agreed_rate: Number(row.agreed_rate) || 0,
        project_id: row.project_id,
        tenant_id: row.tenant_id
      }));
    }

    console.warn('[WARN] v_subcontractor_progress view unavailable or error occurred, falling back to manual client-side join:', viewErr);

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

    // Map subcontractors for O(1) lookup
    const subMap = new Map((subs || []).map(s => [s.id, s]));
    // Map assignments for O(1) lookup
    const assignmentMap = new Map<string, any>();
    assignments?.forEach(a => {
      assignmentMap.set(`${a.subcontractor_id}_${a.boq_item_id}`, a);
    });

    // Map BOQ items for O(1) lookup
    const boqMap = new Map((boqItems || []).map(b => [b.id, b]));

    // Collect all unique active pairs (subcontractor_id, boq_item_id) where there is either progress or assignment
    const activePairs = new Set<string>();

    assignments?.forEach(a => {
      if (a.subcontractor_id && a.boq_item_id) {
        activePairs.add(`${a.subcontractor_id}_${a.boq_item_id}`);
      }
    });

    for (const key of subProgressMap.keys()) {
      activePairs.add(key);
    }

    // Build flat pre-aggregated rows strictly for the active assignments and progress tuples
    activePairs.forEach(pair => {
      const [subId, boqId] = pair.split('_');
      const s = subMap.get(subId);
      const bi = boqMap.get(boqId);
      if (!s || !bi) return;

      const assignment = assignmentMap.get(`${subId}_${boqId}`);
      const cumulativeQty = subProgressMap.get(pair) || 0;

      const agreedQty = assignment?.contract_qty ?? bi.contract_qty ?? 0;
      const agreedRate = assignment?.contract_rate ?? bi.contract_rate ?? 0;
      const finalAgreedQty = Number(agreedQty) > 0 ? Number(agreedQty) : (Number(bi.contract_qty) || 0);
      
      results.push({
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
    });

    return results;
  } catch (err: any) {
    console.error('Error in fetchSubcontractorProgress:', err.message);
    throw err;
  }
}
