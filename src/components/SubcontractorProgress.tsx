import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  ChevronDown,
  FileText,
  Briefcase
} from 'lucide-react';
import { cn, cleanRichText } from '../lib/utils';
import { fetchSubcontractorProgress } from '../services/progressService';

interface SubcontractorProgressProps {
  projectId: string;
}

export function SubcontractorProgress({ projectId }: SubcontractorProgressProps) {
  const [progressData, setProgressData] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [allBoqItems, setAllBoqItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSub = (subId: string) => {
    const next = new Set(expandedSubs);
    if (next.has(subId)) next.delete(subId);
    else next.add(subId);
    setExpandedSubs(next);
  };

  const toggleSection = (subId: string, itemNo: string) => {
    const next = new Set(collapsedSections);
    const key = `${subId}_${itemNo}`;
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setCollapsedSections(next);
  };

  const isHiddenByCollapse = (subId: string, itemNo: string) => {
    if (!itemNo) return false;
    const parts = itemNo.split('.');
    for (let i = 1; i < parts.length; i++) {
      const ancestor = parts.slice(0, i).join('.');
      if (collapsedSections.has(`${subId}_${ancestor}`)) {
        return true;
      }
    }
    return false;
  };

  useEffect(() => {
    loadProgress();
  }, [projectId]);

  async function loadProgress() {
    setLoading(true);
    try {
      const [data, assignmentsRes, boqRes] = await Promise.all([
        fetchSubcontractorProgress(projectId),
        supabase
          .from('subcontractor_assignments')
          .select('*, subcontractor:subcontractor_id(*)')
          .eq('project_id', projectId),
        supabase
          .from('boq_items')
          .select('id, item_no, description, unit, contract_qty, contract_rate')
          .eq('project_id', projectId)
      ]);

      const boqMap = new Map((boqRes.data || []).map(b => [b.id, b.item_no]));
      const enrichedData = (data || []).map(item => ({
        ...item,
        item_no: (item as any).item_no || boqMap.get(item.boq_item_id) || ''
      }));

      setProgressData(enrichedData);
      setAssignments(assignmentsRes.data || []);
      setAllBoqItems(boqRes.data || []);
    } catch (e: any) {
      console.error('Error loading sub progress:', e.message);
    } finally {
      setLoading(false);
    }
  }

  // Group progress data by subcontractor company name AND the specific contract batch name + assignment type
  const groupedData = useMemo(() => {
    const result: Record<string, {
      id: string;
      subName: string;
      contractName: string;
      type: 'unit_rate' | 'lumpsum';
      trade: string;
      items: any[];
      totalEarned: number;
      totalAgreed: number;
    }> = {};

    progressData.forEach((item: any) => {
      const subName = item.subcontractor_name;
      // Find matching assignment in this project
      const assign = assignments.find(a => 
        a.boq_item_id === item.boq_item_id && 
        a.subcontractor?.company_name === subName
      );

      const type = assign?.assignment_type || 'unit_rate';
      const isLS = type === 'lumpsum';
      const contractName = assign?.group_name || (isLS ? 'General Lump Sum Contract' : 'General Unit Rate Contract');
      
      const key = `${subName}_${contractName}_${type}`;

      if (!result[key]) {
        result[key] = {
          id: key,
          subName: subName,
          contractName: contractName,
          type: type,
          trade: assign?.subcontractor?.trade_category || 'General Works',
          items: [],
          totalEarned: 0,
          totalAgreed: 0
        };
      }

      result[key].items.push(item);
      result[key].totalEarned += (item.earned_value || 0);
      result[key].totalAgreed += (item.agreed_amount || 0);
    });

    return Object.values(result).sort((a, b) => {
      const cmp = a.subName.localeCompare(b.subName);
      if (cmp !== 0) return cmp;
      return a.contractName.localeCompare(b.contractName);
    });
  }, [progressData, assignments]);

  if (loading) {
    return (
      <div className="py-20 text-center animate-pulse">
        <Clock className="w-8 h-8 text-primary mx-auto mb-2 animate-spin" />
        <span className="text-xs text-ghost font-bold uppercase tracking-widest leading-none">Scanning Progress and Valuations...</span>
      </div>
    );
  }

  if (groupedData.length === 0) {
    return (
      <div className="bg-surface-1 border border-border-subtle rounded-3xl p-16 text-center max-w-xl mx-auto my-12 shadow-sm">
        <Users className="w-12 h-12 text-ghost opacity-20 mx-auto mb-4" />
        <h3 className="text-lg font-black text-main tracking-tight">No Subcontractor Performance Data</h3>
        <p className="text-xs text-dim max-w-md mx-auto mt-2 leading-relaxed">
          Ensure subcontractors are assigned to BOQ items and daily activities are logged and reviewed to see progress details here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      {groupedData.map((sub) => {
        const isExpanded = expandedSubs.has(sub.id);
        const completionPct = sub.totalAgreed > 0 ? Math.round((sub.totalEarned / sub.totalAgreed) * 100) : 0;

        // Construct tree hierarchical list of activities
        const subItemsByNo = new Map<string, any>();
        sub.items.forEach((item: any) => {
          if (item.item_no) {
            subItemsByNo.set(item.item_no, item);
          }
        });

        // Get relative BOQ items (direct assignments + any ancestor of active assignments)
        const relevantBoqItems = allBoqItems.filter(boq => {
          const itemNo = boq.item_no || '';
          if (!itemNo) return false;
          if (subItemsByNo.has(itemNo)) return true;
          for (const assignedNo of subItemsByNo.keys()) {
            if (assignedNo.startsWith(itemNo + '.')) {
              return true;
            }
          }
          return false;
        });

        // Sort by item_no naturally
        relevantBoqItems.sort((a, b) => {
          return (a.item_no || '').localeCompare(b.item_no || '', undefined, { numeric: true, sensitivity: 'base' });
        });

        // Transform to rows we can render, matching collapsibility and rolled-up properties
        const allRows: any[] = [];
        relevantBoqItems.forEach(boq => {
          const itemNo = boq.item_no || '';
          const depth = itemNo.split('.').filter(Boolean).length - 1;
          
          const isParent = relevantBoqItems.some(other => 
            other.item_no !== itemNo && 
            (other.item_no || '').startsWith(itemNo + '.')
          );

          // Find descendants belonging to this sub
          const activeDescendants = sub.items.filter((item: any) => 
            item.item_no === itemNo || 
            (item.item_no || '').startsWith(itemNo + '.')
          );

          const rolledEarned = activeDescendants.reduce((acc: number, d: any) => acc + (d.earned_value || 0), 0);
          const rolledAgreedAmount = activeDescendants.reduce((acc: number, d: any) => acc + (d.agreed_amount || 0), 0);
          const progressPct = rolledAgreedAmount > 0 ? (rolledEarned / rolledAgreedAmount) * 100 : 0;

          const matchedItem = subItemsByNo.get(itemNo) || sub.items.find((item: any) => item.boq_item_id === boq.id);

          allRows.push({
            id: boq.id,
            item_no: itemNo,
            description: boq.description,
            unit: matchedItem ? matchedItem.unit : boq.unit,
            agreed_qty: matchedItem ? matchedItem.agreed_qty : null,
            cumulative_progress_qty: matchedItem ? matchedItem.cumulative_progress_qty : null,
            isParent,
            depth,
            progress_pct: isParent ? progressPct : (matchedItem ? matchedItem.progress_pct : 0),
            earned_value: isParent ? rolledEarned : (matchedItem ? matchedItem.earned_value : 0),
            matchedItem
          });
        });

        // Add any items mapped from database progress but missing valid item_no on BOQ mapping just in case
        sub.items.forEach((item: any) => {
          if (!item.item_no && !allRows.some(row => row.id === item.boq_item_id)) {
            allRows.push({
              id: item.boq_item_id,
              item_no: '',
              description: item.boq_description,
              unit: item.unit,
              agreed_qty: item.agreed_qty,
              cumulative_progress_qty: item.cumulative_progress_qty,
              isParent: false,
              depth: 0,
              progress_pct: item.progress_pct || 0,
              earned_value: item.earned_value || 0,
              matchedItem: item
            });
          }
        });

        const visibleRows = allRows.filter(row => !isHiddenByCollapse(sub.id, row.item_no));
        
        return (
          <div 
            key={sub.id} 
            className="bg-surface-1 border border-border-subtle rounded-[2rem] overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 border-l-4 border-l-accent"
          >
            <div 
              className="p-6 bg-surface-base/50 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-main/5 transition-colors select-none"
              onClick={() => toggleSub(sub.id)}
            >
              <div className="flex items-center gap-5">
                <div className={cn(
                  "w-12 h-12 rounded-[1.25rem] flex items-center justify-center transition-colors border",
                  isExpanded 
                    ? "bg-accent text-white border-accent shadow-lg shadow-accent/20" 
                    : "bg-surface-2 text-accent border-border-subtle hover:bg-accent/10"
                )}>
                  <Briefcase className="w-5 h-5" />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-black text-main tracking-tight">{sub.contractName}</h3>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                      sub.type === 'lumpsum' ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-blue-100 text-blue-700 border-blue-200"
                    )}>
                      {sub.type === 'lumpsum' ? 'Lump Sum' : 'Unit Rate'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-ghost font-bold uppercase tracking-widest">
                    <span className="text-accent underline decoration-accent/10 underline-offset-2">{sub.subName}</span>
                    <span className="w-1 h-1 rounded-full bg-border-subtle" />
                    <span>{sub.trade}</span>
                    <span className="w-1 h-1 rounded-full bg-border-subtle" />
                    <span className="text-primary">{sub.items.length} Tracked Item(s)</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-8 border-t md:border-t-0 border-border-subtle/50 pt-4 md:pt-0">
                <div className="text-right">
                  <div className="text-[10px] text-ghost uppercase font-black tracking-widest mb-1">Earned Value</div>
                  <div className="text-lg font-mono font-black text-primary">${Math.round(sub.totalEarned).toLocaleString()}</div>
                </div>
                <div className="w-px h-10 bg-border-subtle" />
                <div className="text-right min-w-[70px]">
                  <div className="text-[10px] text-ghost uppercase font-black tracking-widest mb-1">Completion</div>
                  <div className="text-lg font-mono font-black text-main">{completionPct}%</div>
                </div>
                <div className="w-px h-10 bg-border-subtle hidden md:block" />
                <button className="p-2 rounded-xl hover:bg-surface-3 transition-colors hidden md:block">
                  {isExpanded ? <ChevronDown className="w-5 h-5 text-ghost" /> : <ChevronRight className="w-5 h-5 text-ghost" />}
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-300">
                <div className="bg-surface-2/50 rounded-2xl border border-border-subtle/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse table-fixed min-w-[900px]">
                      <thead>
                        <tr className="bg-surface-base border-b border-border-subtle sticky top-0 z-10">
                          <th className="px-5 py-3 font-mono text-[9px] font-black uppercase tracking-widest text-ghost bg-surface-base border-b border-border-subtle">Activity Description</th>
                          <th className="px-5 py-3 font-mono text-[9px] font-black uppercase tracking-widest text-ghost text-center bg-surface-base border-b border-border-subtle w-24">Unit</th>
                          <th className="px-5 py-3 font-mono text-[9px] font-black uppercase tracking-widest text-ghost text-right bg-surface-base border-b border-border-subtle w-32">Agreed Qty</th>
                          <th className="px-5 py-3 font-mono text-[9px] font-black uppercase tracking-widest text-ghost text-right bg-surface-base border-b border-border-subtle w-32">Actual Qty</th>
                          <th className="px-5 py-3 font-mono text-[9px] font-black uppercase tracking-widest text-ghost bg-surface-base border-b border-border-subtle w-48">Progress</th>
                          <th className="px-5 py-3 font-mono text-[9px] font-black uppercase tracking-widest text-ghost text-right bg-surface-base border-b border-border-subtle w-36">Earned Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle/20">
                        {visibleRows.map((row: any, idx: number) => {
                          const isOpen = !collapsedSections.has(`${sub.id}_${row.item_no}`);
                          const bgClass = (() => {
                            if (!row.isParent) return 'hover:bg-primary/[0.02] transition-colors border-b border-border-subtle/10';
                            if (row.depth === 0) return 'bg-surface-base/80 font-black border-b border-border-subtle/30 text-main';
                            if (row.depth === 1) return 'bg-surface-base/55 font-bold border-b border-border-subtle/20 text-main/90';
                            return 'bg-surface-base/30 font-semibold border-b border-border-subtle/10 text-main/85';
                          })();

                          return (
                            <tr key={`${sub.id}-${row.id}-${row.item_no}-${idx}`} className={bgClass}>
                              <td className="px-5 py-3" style={{ paddingLeft: `${16 + row.depth * 20}px` }}>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {row.isParent ? (
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleSection(sub.id, row.item_no);
                                      }}
                                      className="p-1 rounded hover:bg-main/10 text-accent/80 hover:text-accent transition-colors focus:outline-none shrink-0"
                                    >
                                      {isOpen ? <ChevronDown className="w-3.5 h-3.5 animate-in fade-in" /> : <ChevronRight className="w-3.5 h-3.5 animate-in fade-in" />}
                                    </button>
                                  ) : (
                                    <div className="w-6 shrink-0" />
                                  )}
                                  <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-2">
                                      {row.item_no && (
                                        <span className={cn("font-mono font-black text-accent tracking-tighter shrink-0", row.isParent ? "text-[11px]" : "text-[10px] opacity-70")}>
                                          {row.item_no}
                                        </span>
                                      )}
                                    </div>
                                    <span className={cn(
                                      "leading-tight transition-colors whitespace-normal break-words mt-0.5", 
                                      row.isParent 
                                        ? "text-xs text-main font-extrabold" 
                                        : "text-[11px] text-dim font-medium"
                                    )}>
                                      {cleanRichText(row.description)}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-[11px] text-center font-mono border-l border-r border-border-subtle/10">
                                {row.isParent ? (
                                  <span className="text-ghost/30">—</span>
                                ) : (
                                  cleanRichText(row.unit || '—')
                                )}
                              </td>
                              <td className="px-5 py-3 text-[11px] text-dim text-right font-mono border-r border-border-subtle/10">
                                {row.isParent ? (
                                  <span className="text-ghost/30">—</span>
                                ) : (
                                  Number(row.agreed_qty || 0).toLocaleString()
                                )}
                              </td>
                              <td className="px-5 py-3 text-[11px] text-primary text-right font-mono font-bold border-r border-border-subtle/10">
                                {row.isParent ? (
                                  <span className="text-ghost/30">—</span>
                                ) : (
                                  Number(row.cumulative_progress_qty || 0).toLocaleString()
                                )}
                              </td>
                              <td className="px-5 py-3 min-w-[150px] border-r border-border-subtle/10">
                                <div className="flex flex-col gap-1.5">
                                  <div className="h-1 bg-surface-base rounded-full overflow-hidden">
                                    <div 
                                      className={cn(
                                        "h-full transition-all duration-500",
                                        row.isParent ? "bg-accent" : "bg-primary"
                                      )}
                                      style={{ width: `${Math.min(100, row.progress_pct || 0)}%` }}
                                    />
                                  </div>
                                  <span className="text-[9px] font-black text-ghost uppercase tracking-wider">
                                    {Math.round(row.progress_pct || 0)}% {row.isParent ? 'Rollup' : 'Complete'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-[12px] text-main text-right font-mono font-bold">
                                ${Math.round(row.earned_value || 0).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
