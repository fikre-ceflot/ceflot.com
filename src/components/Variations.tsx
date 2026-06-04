import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { GitBranch, Plus, Search, FileText, AlertTriangle, CheckCircle, Clock, MoreHorizontal, ArrowRight, DollarSign, X, Calendar } from 'lucide-react';
import { cn, cleanRichText } from '../lib/utils';
import { Project } from '../types';
import { EoTClaims } from './EoTClaims';

interface Variation {
  id: string;
  project_id: string;
  tenant_id: string;
  title: string;
  description: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  estimated_cost: number;
  impact_days: number;
  created_at: string;
  reference_no: string;
}

interface VariationsProps {
  project: Project;
  tenantId: string;
}

export function Variations({ project, tenantId }: VariationsProps) {
  const [activeSubtab, setActiveSubtab] = useState<'variations' | 'eot'>('variations');
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedVariation, setSelectedVariation] = useState<Variation | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    estimated_cost: 0,
    impact_days: 0,
    reference_no: `VO-${Math.floor(Math.random() * 10000)}`
  });

  const updateVariationStatus = async (voId: string, status: 'approved' | 'rejected' | 'pending_approval') => {
    try {
      const { error } = await supabase
        .from('variations')
        .update({ status })
        .eq('id', voId);
      if (error) throw error;
      alert(`Variation Order status successfully updated to ${status.replace('_', ' ')}!`);
      loadVariations();
      setActiveMenuId(null);
    } catch (err: any) {
      alert(`Error updating variation status: ${err.message}`);
    }
  };

  useEffect(() => {
    loadVariations();
  }, [project.id]);

  const loadVariations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('variations')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.message?.includes('public.variations')) {
          setVariations([]);
          return;
        }
        throw error;
      }
      setVariations(data || []);
    } catch (e: any) {
      console.error('Error loading variations:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('variations')
        .insert([{
          ...formData,
          project_id: project.id,
          tenant_id: tenantId,
          status: 'draft'
        }]);

      if (error) throw error;
      
      setIsAdding(false);
      setFormData({ title: '', description: '', estimated_cost: 0, impact_days: 0, reference_no: `VO-${Math.floor(Math.random() * 10000)}` });
      loadVariations();
      alert('Variation order drafted successfully!');
    } catch (e: any) {
      alert('Error saving variation: ' + e.message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8 px-1">
        <div className="flex flex-col gap-0.5 md:mt-auto">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-semibold text-ghost uppercase tracking-[0.2em]">Contractual Claims Hub</span>
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-main -ml-0.5">{cleanRichText(project.name)}</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-2 text-[10px] font-medium text-ghost">
              <span className="text-primary font-semibold uppercase tracking-wider">
                {activeSubtab === 'variations' ? 'Variation Orders' : 'Extension of Time (EoT)'}
              </span>
              <span className="w-1 h-1 rounded-full bg-border-subtle" />
              <span className="px-1.5 py-0.25 rounded bg-surface-2 border border-border-subtle opacity-80">
                {activeSubtab === 'variations' ? `${variations.length} items logged` : 'active cases'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 ml-auto flex-wrap">
          {/* Dynamic Helpful Information Card (Aligned Right) */}
          <div className="flex flex-col gap-1 text-right border-r border-border-subtle pr-4 h-10 justify-center">
            <div className="text-[10px] font-semibold text-ghost uppercase tracking-wider font-mono">CONTRACT CLAIMS & CLAUSE CENTRAL</div>
            <div className="flex items-center gap-2 justify-end">
              <span className="px-1.5 py-0.25 rounded bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[9px] font-semibold text-[var(--color-primary)] select-none uppercase tracking-wider font-mono">AUTHORIZED</span>
              <div className="h-1 w-1 rounded-full bg-border-subtle" />
              <span className="text-[9px] font-medium text-dim uppercase tracking-wider font-mono">CODE: {project.project_code} | {variations.length} Tracked Claims</span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
          {/* Inline Toggle */}
          <div className="flex bg-surface-2 p-1 rounded-xl border border-border-subtle shadow-inner">
            <button 
              onClick={() => setActiveSubtab('variations')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                activeSubtab === 'variations' ? "bg-surface-1 text-accent shadow-sm border border-border-subtle" : "text-ghost hover:text-main"
              )}
            >
              <GitBranch className="w-3.5 h-3.5" />
              Variations
            </button>
            <button 
              onClick={() => setActiveSubtab('eot')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                activeSubtab === 'eot' ? "bg-surface-1 text-accent shadow-sm border border-border-subtle" : "text-ghost hover:text-main"
              )}
            >
              <Clock className="w-3.5 h-3.5" />
              EoT Claims
            </button>
          </div>

          {activeSubtab === 'variations' && (
            <button 
              onClick={() => setIsAdding(true)}
              className="btn btn-accent btn-sm h-10 px-4"
            >
              <Plus className="w-4 h-4" />
              Draft Variation
            </button>
          )}
        </div>
      </div>
    </header>

      {activeSubtab === 'eot' ? (
        <EoTClaims project={project} embedded={true} />
      ) : (
        <>
          {isAdding && (
        <div className="bg-surface-1 border border-border-subtle rounded-xl p-6 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-main">Draft New Variation Order</h3>
            <button onClick={() => setIsAdding(false)} className="text-ghost hover:text-main"><FileText className="w-5 h-5" /></button>
          </div>
          
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-ghost">Title</label>
                <input 
                  type="text"
                  required
                  className="bg-surface-2 border border-border-subtle rounded-md text-sm p-2.5 outline-none focus:border-primary text-main"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g. Additional Foundation Reinforcement"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-ghost">Description</label>
                <textarea 
                  required
                  rows={4}
                  className="bg-surface-2 border border-border-subtle rounded-md text-sm p-2.5 outline-none focus:border-primary text-main resize-none"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder="Detailed explanation of the change..."
                />
              </div>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-ghost">Estimated Cost (USD)</label>
                  <input 
                    type="number"
                    required
                    className="bg-surface-2 border border-border-subtle rounded-md text-sm p-2.5 outline-none focus:border-primary text-main"
                    value={formData.estimated_cost}
                    onChange={e => setFormData({...formData, estimated_cost: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-ghost">Schedule Impact (Days)</label>
                  <input 
                    type="number"
                    required
                    className="bg-surface-2 border border-border-subtle rounded-md text-sm p-2.5 outline-none focus:border-primary text-main"
                    value={formData.impact_days}
                    onChange={e => setFormData({...formData, impact_days: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-ghost">Reference Number</label>
                <input 
                  type="text"
                  readOnly
                  className="bg-surface-2 border border-border-subtle rounded-md text-sm p-2.5 outline-none text-ghost"
                  value={formData.reference_no}
                />
              </div>
              
              <div className="flex justify-end gap-3 mt-auto">
                <button type="button" onClick={() => setIsAdding(false)} className="btn btn-ghost btn-sm">Cancel</button>
                <button type="submit" className="btn btn-accent btn-sm px-6">Create Draft</button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="py-12 text-center">
            <div className="w-6 h-6 border-2 border-border-subtle border-t-primary rounded-full animate-spin mx-auto" />
          </div>
        ) : variations.length === 0 ? (
          <div className="bg-surface-1 border border-border-subtle border-dashed rounded-xl p-12 text-center text-ghost">
            <GitBranch className="w-10 h-10 opacity-10 mx-auto mb-3" />
            <div className="text-sm font-medium">No variation orders found</div>
            <p className="text-xs mt-1">Scope changes will appear here once drafted</p>
          </div>
        ) : (
          variations.map((vo) => (
            <div key={vo.id} className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden hover:border-ghost transition-all group">
              <div className="p-5 flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                    vo.status === 'approved' ? "bg-primary/10 text-primary" :
                    vo.status === 'rejected' ? "bg-danger/10 text-danger" :
                    "bg-surface-2 text-ghost"
                  )}>
                    <GitBranch className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono font-bold text-ghost bg-surface-base px-1.5 py-0.5 rounded border border-border-subtle">
                        {vo.reference_no}
                      </span>
                      <h3 className="text-sm font-bold text-main">{cleanRichText(vo.title)}</h3>
                    </div>
                    <p className="text-xs text-ghost line-clamp-1 max-w-2xl">{cleanRichText(vo.description)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-end">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-ghost">Estimated Cost</div>
                    <div className="text-sm font-bold text-primary">${vo.estimated_cost.toLocaleString()}</div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-ghost">Schedule Impact</div>
                    <div className="text-sm font-bold text-warning">{vo.impact_days} Days</div>
                  </div>
                  <div className={cn(
                    "px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border",
                    vo.status === 'approved' ? "bg-primary/10 text-primary border-primary/20" :
                    vo.status === 'rejected' ? "bg-danger/10 text-danger border-danger/20" :
                    vo.status === 'pending_approval' ? "bg-accent/10 text-accent border-accent/20" :
                    "bg-surface-base text-ghost border-border-subtle"
                  )}>
                    {vo.status.replace('_', ' ')}
                  </div>
                  <div className="relative">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === vo.id ? null : vo.id);
                      }}
                      className={cn(
                        "p-1.5 text-ghost hover:bg-surface-2 hover:text-main rounded-md transition-colors",
                        activeMenuId === vo.id && "bg-surface-2 text-main"
                      )}
                      title="Actions"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {activeMenuId === vo.id && (
                      <>
                        <div 
                          className="fixed inset-0 z-[120] bg-transparent" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(null);
                          }}
                        />
                        <div 
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-8 w-44 bg-surface-1 border border-border-muted rounded-xl shadow-xl z-[130] p-1.5 flex flex-col gap-0.5 text-xs select-none"
                        >
                          <button 
                            onClick={() => {
                              setSelectedVariation(vo);
                              setActiveMenuId(null);
                            }}
                            className="w-full text-left px-2.5 py-1.5 hover:bg-surface-2 hover:text-main rounded-lg text-ghost transition-colors flex items-center gap-2 font-semibold"
                          >
                            <span>Read Full Log</span>
                          </button>
                          
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(vo.reference_no);
                              alert(`Reference code "${vo.reference_no}" successfully copied!`);
                              setActiveMenuId(null);
                            }}
                            className="w-full text-left px-2.5 py-1.5 hover:bg-surface-2 hover:text-main rounded-lg text-ghost transition-colors flex items-center gap-2 font-semibold"
                          >
                            <span>Copy Ref Code</span>
                          </button>

                          <button 
                            onClick={() => {
                              alert(`Drafted claim invoice for ${vo.reference_no} comprising an estimated $${vo.estimated_cost.toLocaleString()}.`);
                              setActiveMenuId(null);
                            }}
                            className="w-full text-left px-2.5 py-1.5 hover:bg-surface-2 hover:text-main rounded-lg text-ghost transition-colors flex items-center gap-2 font-semibold border-b border-border-subtle pb-1.5 mb-1"
                          >
                            <span>Draft Invoice</span>
                          </button>

                          {vo.status === 'pending_approval' || vo.status === 'draft' ? (
                            <>
                              <button 
                                onClick={() => updateVariationStatus(vo.id, 'approved')}
                                className="w-full text-left px-2.5 py-1.5 hover:bg-primary/20 text-primary hover:text-primary font-bold rounded-lg transition-colors flex items-center gap-2"
                              >
                                <span>Approve (Simulated Client)</span>
                              </button>
                              <button 
                                onClick={() => updateVariationStatus(vo.id, 'rejected')}
                                className="w-full text-left px-2.5 py-1.5 hover:bg-danger/20 text-danger hover:text-danger font-bold rounded-lg transition-colors flex items-center gap-2"
                              >
                                <span>Reject Claims</span>
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={() => updateVariationStatus(vo.id, 'pending_approval')}
                              className="w-full text-left px-2.5 py-1.5 hover:bg-accent/20 text-accent font-bold rounded-lg transition-colors flex items-center gap-2"
                            >
                              <span>Reset to Pending</span>
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-5 py-3 bg-surface-2 border-t border-border-subtle flex items-center justify-between">
                <div className="flex items-center gap-4 text-[10px] text-ghost">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Created {new Date(vo.created_at).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> 0 Attachments</span>
                </div>
                <button 
                  onClick={() => setSelectedVariation(vo)}
                  className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline flex items-center gap-1"
                >
                  View Details <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {/* Detail Slide-over */}
      {selectedVariation && (
        <div className="fixed inset-0 z-[200] overflow-hidden">
           <div 
             className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
             onClick={() => setSelectedVariation(null)}
           />
           <div className="absolute top-0 right-0 h-full w-full max-w-xl bg-surface-1 border-l border-border-subtle shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <div className="flex items-center justify-between p-8 border-b border-border-subtle bg-surface-base">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                       <GitBranch className="w-6 h-6" />
                    </div>
                    <div>
                       <div className="text-[10px] font-black text-ghost uppercase tracking-[0.2em] mb-1">Variation Details</div>
                       <h3 className="text-xl font-black text-main tracking-tight uppercase">{selectedVariation.reference_no}</h3>
                    </div>
                 </div>
                 <button onClick={() => setSelectedVariation(null)} className="p-3 hover:bg-surface-2 rounded-2xl text-ghost">
                    <X className="w-6 h-6" />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                 <div className="mb-10">
                    <h2 className="text-2xl font-black text-main leading-tight mb-8">{cleanRichText(selectedVariation.title)}</h2>
                    
                    <div className="grid grid-cols-2 gap-6 mb-10">
                       <div className="p-5 bg-surface-2 border border-border-subtle rounded-2xl">
                          <div className="text-[9px] font-black uppercase tracking-widest text-ghost mb-2">Estimated Cost</div>
                          <div className="text-xl font-black text-primary">${selectedVariation.estimated_cost.toLocaleString()}</div>
                       </div>
                       <div className="p-5 bg-surface-2 border border-border-subtle rounded-2xl">
                          <div className="text-[9px] font-black uppercase tracking-widest text-ghost mb-2">Schedule Impact</div>
                          <div className="text-xl font-black text-warning">{selectedVariation.impact_days} Days</div>
                       </div>
                    </div>

                    <div className="space-y-6">
                       <section>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-ghost mb-3 flex items-center gap-2">
                             <FileText className="w-3.5 h-3.5" />
                             Description & Justification
                          </h4>
                          <div className="p-6 bg-surface-base border border-border-subtle rounded-2xl text-sm text-dim leading-relaxed whitespace-pre-wrap font-medium">
                             {cleanRichText(selectedVariation.description)}
                          </div>
                       </section>

                       <div className="flex items-center justify-between p-4 bg-surface-2/50 border border-border-subtle rounded-2xl">
                          <span className="text-xs font-bold text-ghost uppercase">Request Status</span>
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                            selectedVariation.status === 'approved' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                            selectedVariation.status === 'rejected' ? "bg-danger/10 text-danger border-danger/20" :
                            "bg-warning/10 text-warning border-warning/20"
                          )}>
                             {selectedVariation.status}
                          </span>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="p-10 border-t border-border-subtle bg-surface-base flex items-center gap-4">
                 {selectedVariation.status === 'draft' && (
                   <button className="flex-1 btn btn-primary h-14 rounded-2xl text-xs font-black tracking-widest shadow-lg shadow-primary/20">
                      Submit for Approval
                   </button>
                 )}
                 <button 
                    onClick={() => setSelectedVariation(null)}
                    className="flex-1 btn btn-secondary h-14 rounded-2xl text-xs font-black tracking-widest"
                 >
                    Dismiss View
                 </button>
              </div>
           </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
