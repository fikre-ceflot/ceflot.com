import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, DollarSign, CheckCircle2, Clock } from 'lucide-react';
import { cn, cleanRichText } from './utils';
import { fetchSubcontractorProgress } from './progressService';

interface SubcontractorProgressProps {
  projectId: string;
}

export function SubcontractorProgress({ projectId }: SubcontractorProgressProps) {
  const [progressData, setProgressData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();
  }, [projectId]);

  async function loadProgress() {
    setLoading(true);
    try {
      const data = await fetchSubcontractorProgress(projectId);
      setProgressData(data || []);
    } catch (e: any) {
      console.error('Error loading sub progress:', e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-ghost animate-pulse">Loading subcontractor performance...</div>;
  }

  if (progressData.length === 0) {
    return (
      <div className="bg-surface-1 border border-border-subtle rounded-xl p-12 text-center">
        <Users className="w-12 h-12 text-ghost opacity-20 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-main">No Subcontractor Progress Found</h3>
        <p className="text-sm text-dim max-w-md mx-auto mt-2">
          Ensure subcontractors are assigned to BOQ items and daily logs are reviewed to see progress here.
        </p>
      </div>
    );
  }

  // Group by subcontractor
  const groupedData = progressData.reduce((acc: any, item: any) => {
    if (!acc[item.subcontractor_name]) {
      acc[item.subcontractor_name] = {
        name: item.subcontractor_name,
        items: [],
        totalEarned: 0,
        totalAgreed: 0
      };
    }
    acc[item.subcontractor_name].items.push(item);
    acc[item.subcontractor_name].totalEarned += item.earned_value;
    acc[item.subcontractor_name].totalAgreed += item.agreed_amount;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      {Object.values(groupedData).map((sub: any) => (
        <div key={sub.name} className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border-subtle bg-surface-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-surface-3 flex items-center justify-center text-primary">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-main">{sub.name}</h3>
                <span className="text-[10px] text-ghost uppercase font-bold tracking-wider">Performance Overview</span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-[10px] text-ghost uppercase font-bold">Earned Value</div>
                <div className="text-sm font-mono font-bold text-primary">${(sub.totalEarned || 0).toLocaleString()}</div>
              </div>
              <div className="w-px h-8 bg-border-subtle" />
              <div className="text-right">
                <div className="text-[10px] text-ghost uppercase font-bold">Completion</div>
                <div className="text-sm font-mono font-bold text-main">
                  {Math.round((sub.totalEarned / sub.totalAgreed) * 100)}%
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-base border-b border-border-subtle">
                  <th className="px-4 py-3 text-[10px] font-bold text-ghost uppercase tracking-wider">Activity Description</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-ghost uppercase tracking-wider text-center">Unit</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-ghost uppercase tracking-wider text-right">Agreed Qty</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-ghost uppercase tracking-wider text-right">Actual Qty</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-ghost uppercase tracking-wider">Progress</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-ghost uppercase tracking-wider text-right">Earned Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {sub.items.map((item: any) => (
                  <tr key={item.boq_item_id} className="hover:bg-surface-2/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-main font-medium">{cleanRichText(item.boq_description)}</td>
                    <td className="px-4 py-3 text-xs text-ghost text-center">{cleanRichText(item.unit)}</td>
                    <td className="px-4 py-3 text-xs text-main text-right font-mono">{(item.agreed_qty || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-primary text-right font-mono">{(item.cumulative_progress_qty || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 min-w-[120px]">
                      <div className="flex flex-col gap-1.5">
                        <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-500" 
                            style={{ width: `${Math.min(100, item.progress_pct)}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-bold text-ghost">{Math.round(item.progress_pct)}% Complete</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-main text-right font-mono font-bold">${(item.earned_value || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
