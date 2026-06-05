import { BOQItem } from '../types';

export async function recalculateBOQTreeProgress(projectId: string, supabase: any) {
  try {
    console.log(`[DEBUG] Recalculating BOQ tree progress for project ${projectId}...`);

    // 1. Fetch all BOQ items
    const { data: boqItems, error: fetchBoqErr } = await supabase
      .from('boq_items')
      .select('*')
      .eq('project_id', projectId);

    if (fetchBoqErr) {
      console.error('[ERROR] Failed to fetch BOQ items:', fetchBoqErr);
      return;
    }
    if (!boqItems || boqItems.length === 0) {
      console.log('[DEBUG] No BOQ items found for project:', projectId);
      return;
    }

    // 2. Fetch all daily activities for this project to get history-backed actual quantities
    const { data: progressRows, error: fetchProgErr } = await supabase
      .from('daily_progress')
      .select('id')
      .eq('project_id', projectId);

    if (fetchProgErr) {
      console.error('[ERROR] Failed to fetch daily progress rows:', fetchProgErr);
      return;
    }

    const progressIds = (progressRows || []).map(p => p.id);
    let activities: any[] = [];
    if (progressIds.length > 0) {
      const { data: actRows, error: fetchActErr } = await supabase
        .from('daily_activities')
        .select('boq_item_id, progress_qty')
        .in('daily_progress_id', progressIds);
      
      if (fetchActErr) {
        console.error('[ERROR] Failed to fetch daily activities:', fetchActErr);
      } else {
        activities = actRows || [];
      }
    }

    // Calculate sum of progress_qty for each BOQ item
    const qtyMap = new Map<string, number>();
    activities.forEach(act => {
      if (act.boq_item_id) {
        qtyMap.set(act.boq_item_id, (qtyMap.get(act.boq_item_id) || 0) + (act.progress_qty || 0));
      }
    });

    const clonedItems: BOQItem[] = JSON.parse(JSON.stringify(boqItems));

    // Helper to find direct children of P in the cloned array
    const getDirectChildren = (parent: BOQItem, allItems: BOQItem[]) => {
      const parentNo = parent.item_no || '';
      if (!parentNo) return [];
      return allItems.filter(child => {
        const childNo = child.item_no || '';
        if (childNo === parentNo) return false;
        if (!childNo.startsWith(parentNo + '.')) return false;
        
        // Ensure no intermediate node exists'
        const intermediateExists = allItems.some(inter => {
          const interNo = inter.item_no || '';
          return interNo !== parentNo && interNo !== childNo &&
                 childNo.startsWith(interNo + '.') && interNo.startsWith(parentNo + '.');
        });
        return !intermediateExists;
      });
    };

    const computedNodeIds = new Set<string>();
    const memoAmount = new Map<string, number>();

    const getNodeContractAmount = (n: BOQItem, allNodes: BOQItem[]): number => {
      if (memoAmount.has(n.id)) return memoAmount.get(n.id)!;
      const children = getDirectChildren(n, allNodes);
      if (children.length === 0) {
        const amt = n.contract_amount || ((n.contract_qty || 0) * (n.contract_rate || 0)) || 0;
        memoAmount.set(n.id, amt);
        return amt;
      }
      let total = 0;
      children.forEach(c => {
        total += getNodeContractAmount(c, allNodes);
      });
      memoAmount.set(n.id, total);
      return total;
    };

    // Recursive calculation function
    const computeNodeProgress = (node: BOQItem, allNodes: BOQItem[]): { pct: number; status: string } => {
      if (computedNodeIds.has(node.id)) {
        return { pct: node.progress_pct || 0, status: node.status || 'draft' };
      }

      const children = getDirectChildren(node, allNodes);
      if (children.length === 0) {
        // Leaf node: set actual_qty from sum of daily activities if logs exist, otherwise preserve existing actual_qty
        const hasLogs = qtyMap.has(node.id);
        if (hasLogs) {
          node.actual_qty = qtyMap.get(node.id) || 0;
        }

        const contractQty = node.contract_qty || 0;
        const currentActual = node.actual_qty || 0;
        const leafPct = contractQty > 0 ? Math.min(100, (currentActual / contractQty) * 100) : (node.progress_pct || 0);
        node.progress_pct = Math.round(leafPct * 100) / 100;

        let leafStatus = node.status;
        if (node.progress_pct >= 100) {
          leafStatus = node.status === 'certified' ? 'certified' : 'complete';
        } else if (node.progress_pct > 0) {
          leafStatus = 'in_progress';
        } else {
          leafStatus = node.status === 'recipe_pending' ? 'recipe_pending' : 'draft';
        }
        node.status = leafStatus;
        computedNodeIds.add(node.id);
        return { pct: node.progress_pct, status: node.status };
      }

      // Compute status & progress of direct children recursively first
      children.forEach(c => {
        computeNodeProgress(c, allNodes);
      });

      // Parent node: calculate progress weighted by children's contract weight
      let weightedProgressSum = 0;
      let totalContractAmount = 0;

      const childrenData = children.map(child => {
        // Child is already calculated
        const amount = getNodeContractAmount(child, allNodes);
        totalContractAmount += amount;
        return { child, amount, pct: child.progress_pct || 0 };
      });

      if (totalContractAmount > 0) {
        childrenData.forEach(cd => {
          const weight = cd.amount / totalContractAmount;
          weightedProgressSum += cd.pct * weight;
        });
      } else {
        // Fallback to equal weight
        childrenData.forEach(cd => {
          weightedProgressSum += cd.pct / children.length;
        });
      }

      const finalPct = Math.min(100, Math.max(0, weightedProgressSum));
      node.progress_pct = Math.round(finalPct * 100) / 100;

      // Also compute an illustrative parent actual_qty based on progress_pct if useful
      if (node.contract_qty > 0) {
        node.actual_qty = Math.round((node.contract_qty * (finalPct / 100)) * 100) / 100;
      } else {
        node.actual_qty = 0;
      }

      let parentStatus = node.status;
      if (node.progress_pct >= 100) {
        parentStatus = node.status === 'certified' ? 'certified' : 'complete';
      } else if (node.progress_pct > 0) {
        parentStatus = 'in_progress';
      } else {
        parentStatus = node.status === 'recipe_pending' ? 'recipe_pending' : 'draft';
      }
      node.status = parentStatus;

      computedNodeIds.add(node.id);
      return { pct: node.progress_pct, status: node.status };
    };

    // Calculate progress for all nodes (starts with root but safer to compute on all to make sure we hit every node)
    clonedItems.forEach(node => {
      computeNodeProgress(node, clonedItems);
    });

    // 3. Find items with changed progress_pct, actual_qty, or status
    const updates = clonedItems.filter(item => {
      const original = boqItems.find(o => o.id === item.id);
      if (!original) return false;
      return (
        original.progress_pct !== item.progress_pct ||
        original.actual_qty !== item.actual_qty ||
        original.status !== item.status
      );
    });

    console.log(`[DEBUG] Recalculation complete. Updating ${updates.length} items in DB...`);

    if (updates.length > 0) {
      await Promise.all(
        updates.map(async item => {
          const { error: updateErr } = await supabase
            .from('boq_items')
            .update({
              progress_pct: item.progress_pct,
              actual_qty: item.actual_qty,
              status: item.status,
            })
            .eq('id', item.id);
          
          if (updateErr) {
            console.error(`[ERROR] Failed to update BOQ item ${item.item_no}:`, updateErr);
          }
        })
      );
    }
  } catch (err) {
    console.error('[ERROR] Unexpected in recalculateBOQTreeProgress:', err);
  }
}
