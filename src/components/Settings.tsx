import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  Sliders, 
  CheckCircle, 
  Save, 
  Plus, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  Mail, 
  Smartphone,
  GitBranch,
  ArrowRight,
  Edit,
  X,
  XCircle,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useRoles } from '../hooks/useRoles';
import { supabase } from '../lib/supabase';

interface ApprovalStep {
  level: number;
  role: string;
  threshold_min: number;
}

interface ApprovalChain {
  id?: string;
  module_type: string;
  chain_name: string;
  steps_json: ApprovalStep[];
}

interface CompanyWorkflowChain {
  id: string;
  chain_name: string;
  module_type: string;
  steps_json: { role: string }[];
  tenant_id: string;
  created_at?: string;
}

const GLOBAL_APPROVAL_TEMPLATES = [
  {
    id: 'tpl_procurement',
    chain_name: 'Nairobi Standard Procurement Chain',
    module_type: 'PO',
    steps_json: [
      { role: 'procurement' },
      { role: 'project_manager' },
      { role: 'finance' }
    ]
  },
  {
    id: 'tpl_variations',
    chain_name: 'Risk & Variation Board Verification',
    module_type: 'VO',
    steps_json: [
      { role: 'contract_admin' },
      { role: 'site_engineer' },
      { role: 'director' }
    ]
  }
];

export function Settings({ tenantId }: { tenantId?: string }) {
  const [activeTab, setActiveTab] = useState<'approvals' | 'alerts'>('approvals');
  const { roles: allAvailableRoles } = useRoles(tenantId);
  const [chains, setChains] = useState<ApprovalChain[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reusable company pathways state
  const [customChains, setCustomChains] = useState<CompanyWorkflowChain[]>([]);
  const [loadingCustom, setLoadingCustom] = useState(false);
  const [showChainModal, setShowChainModal] = useState(false);
  const [editingCustomChain, setEditingCustomChain] = useState<CompanyWorkflowChain | null>(null);

  // Filter out any "platform_god" references at the tenant level
  const filteredAvailableRoles = allAvailableRoles.filter(r => r !== 'platform_god');

  // Modal form states for Custom Company Pathways
  const [newPathName, setNewPathName] = useState('');
  const [newPathModule, setNewPathModule] = useState('PO');
  const [newPathSteps, setNewPathSteps] = useState<{ role: string }[]>([{ role: 'project_manager' }]);

  useEffect(() => {
    if (tenantId && activeTab === 'approvals') {
      loadChains();
      loadCustomChains();
    }
  }, [tenantId, activeTab]);

  const loadChains = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenant_approval_chains')
        .select('*')
        .eq('tenant_id', tenantId);

      if (error) {
        if (error.message?.includes('public.tenant_approval_chains') || error.message?.includes('does not exist')) {
           // Fallback if table doesn't exist yet
           setChains([
             { module_type: 'budget', chain_name: 'Budget Approval', steps_json: [{ level: 1, role: 'director', threshold_min: 0 }] },
             { module_type: 'variation', chain_name: 'Variation Approval', steps_json: [{ level: 1, role: 'contract_admin', threshold_min: 0 }] }
           ]);
           return;
         }
         throw error;
      }

      const initialDefaults = [
        { module_type: 'budget', chain_name: 'Budget Approval', steps_json: [{ level: 1, role: 'director', threshold_min: 0 }] },
        { module_type: 'variation', chain_name: 'Variation Approval', steps_json: [{ level: 1, role: 'contract_admin', threshold_min: 0 }] }
      ];

      if (data && data.length > 0) {
        setChains(data);
      } else {
        setChains(initialDefaults);
      }
    } catch (e: any) {
      console.error('Error loading chains:', e.message);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomChains = async () => {
    if (!tenantId) return;
    setLoadingCustom(true);
    try {
      const { data, error } = await supabase
        .from('approval_chains')
        .select('*')
        .eq('tenant_id', tenantId);

      const localCachedStr = localStorage.getItem(`company_approval_chains_${tenantId}`);
      let localCached: CompanyWorkflowChain[] = localCachedStr ? JSON.parse(localCachedStr) : [];

      if (error) {
        if (!error.message?.includes('schema cache') && !error.message?.includes('does not exist')) {
          throw error;
        }
      }

      if (data && data.length > 0) {
        // Merge DB data with local cache
        const merged = [...localCached];
        data.forEach((dbItem: any) => {
          if (!merged.some(m => m.id === dbItem.id)) {
            merged.push(dbItem as CompanyWorkflowChain);
          }
        });
        localCached = merged;
        localStorage.setItem(`company_approval_chains_${tenantId}`, JSON.stringify(localCached));
      }

      // Safeguard: Ensure no platform_god role leaks in loaded steps
      const cleanedCached = localCached.map(c => ({
        ...c,
        steps_json: (c.steps_json || []).map(s => ({
          role: s.role === 'platform_god' ? 'director' : s.role
        }))
      }));

      setCustomChains(cleanedCached);
    } catch (e: any) {
      console.error('Error loading corporate approval chains:', e);
      const localCachedStr = localStorage.getItem(`company_approval_chains_${tenantId}`);
      setCustomChains(localCachedStr ? JSON.parse(localCachedStr) : []);
    } finally {
      setLoadingCustom(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    setError(null);
    try {
      // Save adaptive cost-based thresholds
      for (const chain of chains) {
        const { error } = await supabase
          .from('tenant_approval_chains')
          .upsert({
            tenant_id: tenantId,
            module_type: chain.module_type,
            chain_name: chain.chain_name,
            steps_json: chain.steps_json,
            updated_at: new Date().toISOString()
          }, { onConflict: 'tenant_id, module_type' });

        if (error && !error.message?.includes('public.tenant_approval_chains') && !error.message?.includes('does not exist')) {
          throw error;
        }
      }
      alert('Threshold workflows saved successfully!');
    } catch (e: any) {
      console.error('Error saving settings:', e.message);
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const addStep = (moduleType: string) => {
    setChains(prev => prev.map(c => {
      if (c.module_type === moduleType) {
        const nextLevel = c.steps_json.length + 1;
        const defaultRole = filteredAvailableRoles[0] || 'director';
        return {
          ...c,
          steps_json: [...c.steps_json, { level: nextLevel, role: defaultRole, threshold_min: 0 }]
        };
      }
      return c;
    }));
  };

  const removeStep = (moduleType: string, level: number) => {
    setChains(prev => prev.map(c => {
      if (c.module_type === moduleType) {
        return {
          ...c,
          steps_json: c.steps_json
            .filter(s => s.level !== level)
            .map((s, idx) => ({ ...s, level: idx + 1 }))
        };
      }
      return c;
    }));
  };

  const updateStep = (moduleType: string, level: number, field: keyof ApprovalStep, value: any) => {
    setChains(prev => prev.map(c => {
      if (c.module_type === moduleType) {
        return {
          ...c,
          steps_json: c.steps_json.map(s => s.level === level ? { ...s, [field]: value } : s)
        };
      }
      return c;
    }));
  };

  // Reusable Company pathways modifiers
  const handleCloneBlueprint = async (tpl: any) => {
    if (!tenantId) return;
    const pathId = 'chain_' + Math.random().toString(36).substr(2, 9);
    const clonedObj: CompanyWorkflowChain = {
      id: pathId,
      chain_name: tpl.chain_name + ' (Corporate Cloned)',
      module_type: tpl.module_type,
      steps_json: tpl.steps_json.map((st: any) => ({ role: st.role })),
      tenant_id: tenantId,
      created_at: new Date().toISOString()
    };

    const updated = [...customChains, clonedObj];
    setCustomChains(updated);
    localStorage.setItem(`company_approval_chains_${tenantId}`, JSON.stringify(updated));

    try {
      await supabase.from('approval_chains').insert(clonedObj);
    } catch (dbErr) {
      console.warn('DB backup insert bypassed:', dbErr);
    }

    alert(`Successfully cloned blueprint standard: "${tpl.chain_name}" as a company-wide active validation pathway!`);
  };

  const handleDeleteCustomChain = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this company approval chain?')) return;
    const updated = customChains.filter(c => c.id !== id);
    setCustomChains(updated);
    localStorage.setItem(`company_approval_chains_${tenantId}`, JSON.stringify(updated));

    try {
      await supabase.from('approval_chains').delete().eq('id', id);
    } catch (dbErr) {
      console.warn('DB delete bypassed:', dbErr);
    }
  };

  const handleOpenNewChainModal = () => {
    setEditingCustomChain(null);
    setNewPathName('');
    setNewPathModule('PO');
    setNewPathSteps([{ role: filteredAvailableRoles[0] || 'project_manager' }]);
    setShowChainModal(true);
  };

  const handleOpenEditChainModal = (chain: CompanyWorkflowChain) => {
    setEditingCustomChain(chain);
    setNewPathName(chain.chain_name);
    setNewPathModule(chain.module_type);
    setNewPathSteps(chain.steps_json.length > 0 ? chain.steps_json : [{ role: filteredAvailableRoles[0] || 'project_manager' }]);
    setShowChainModal(true);
  };

  const handleSaveCustomChain = async () => {
    if (!newPathName.trim()) {
      alert('Pathway title is required.');
      return;
    }
    if (!tenantId) return;

    const savedId = editingCustomChain?.id || 'chain_' + Math.random().toString(36).substr(2, 9);
    const payload: CompanyWorkflowChain = {
      id: savedId,
      chain_name: newPathName,
      module_type: newPathModule,
      steps_json: newPathSteps,
      tenant_id: tenantId,
      created_at: editingCustomChain?.created_at || new Date().toISOString()
    };

    let updated = [...customChains];
    if (editingCustomChain) {
      updated = updated.map(c => c.id === editingCustomChain.id ? payload : c);
    } else {
      updated.push(payload);
    }

    setCustomChains(updated);
    localStorage.setItem(`company_approval_chains_${tenantId}`, JSON.stringify(updated));

    try {
      if (editingCustomChain) {
        await supabase.from('approval_chains').update({
          chain_name: payload.chain_name,
          module_type: payload.module_type,
          steps_json: payload.steps_json
        }).eq('id', editingCustomChain.id);
      } else {
        await supabase.from('approval_chains').insert(payload);
      }
    } catch (dbErr) {
      console.warn('DB pathway sync bypassed:', dbErr);
    }

    setShowChainModal(false);
    setEditingCustomChain(null);
    alert('Pathway configured successfully!');
  };

  const handleAddModalStep = () => {
    setNewPathSteps([...newPathSteps, { role: filteredAvailableRoles[0] || 'project_manager' }]);
  };

  const handleRemoveModalStep = (index: number) => {
    setNewPathSteps(newPathSteps.filter((_, idx) => idx !== index));
  };

  const handleUpdateModalStepRole = (index: number, val: string) => {
    setNewPathSteps(newPathSteps.map((st, idx) => idx === index ? { role: val } : st));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-main">System Settings & Approval Config</h1>
          <p className="text-sm text-ghost">Configure corporate workflow thresholds, reusable pathway chains and event notification rules</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving || loading}
          className="btn btn-accent btn-sm shadow-lg shadow-accent/20"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving thresholds...' : 'Save Cost Thresholds'}
        </button>
      </div>

      <div className="flex gap-1 bg-surface-1 border border-border-subtle p-1 rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab('approvals')}
          className={cn(
            "px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer",
            activeTab === 'approvals' ? "bg-surface-2 text-primary" : "text-ghost hover:text-dim"
          )}
        >
          Approval Workflows & Chains
        </button>
        <button 
          onClick={() => setActiveTab('alerts')}
          className={cn(
            "px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer",
            activeTab === 'alerts' ? "bg-surface-2 text-primary" : "text-ghost hover:text-dim"
          )}
        >
          Alert Settings
        </button>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 flex items-center gap-3 text-danger text-xs font-medium">
          <AlertCircle className="w-5 h-5 opacity-80 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-transparent flex flex-col gap-8">
        {activeTab === 'approvals' ? (
          <div className="flex flex-col gap-8">
            
            {/* SECTION 1: COST-BASED GATEWAY THRESHOLDS */}
            <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col gap-1 mb-6 border-b border-border-subtle pb-4">
                <span className="text-[10px] font-mono tracking-widest uppercase text-primary font-black">Category 1</span>
                <h2 className="text-sm font-black text-main uppercase tracking-tight">Adaptive Value-Based Role Gates</h2>
                <p className="text-xs text-ghost">Establish minimal monetary limits for sequential role authorizations across cost centers.</p>
              </div>

              {loading ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto opacity-40 mb-2" />
                  <p className="text-xs font-medium text-dim">Loading thresholds...</p>
                </div>
              ) : (
                <div className="flex flex-col gap-8 text-left">
                  {chains.map(chain => (
                    <div key={chain.module_type} className="flex flex-col gap-4">
                      <div className="flex items-center justify-between border-b border-border-subtle/40 pb-2">
                        <div>
                          <h3 className="text-xs font-black text-main capitalize">{chain.chain_name}</h3>
                          <p className="text-[11px] text-ghost mt-0.5">Define monetary clearance gates for {chain.module_type} changes</p>
                        </div>
                        <button 
                          onClick={() => addStep(chain.module_type)}
                          className="btn btn-ghost btn-sm text-primary hover:bg-primary/5 text-xs font-bold cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Level Gate
                        </button>
                      </div>

                      <div className="flex flex-col gap-2.5">
                        {chain.steps_json.length === 0 ? (
                          <div className="py-6 text-center bg-surface-2/30 rounded-xl border border-dashed border-border-subtle">
                            <p className="text-xs text-ghost italic">No thresholds specified. Items will bypass monetary verification.</p>
                          </div>
                        ) : chain.steps_json.map((step) => (
                          <div key={step.level} className="flex items-center gap-4 bg-surface-2/50 border border-border-subtle p-3 rounded-xl group hover:border-primary/20 transition-all">
                            <div className="w-8 h-8 rounded-full bg-surface-base flex items-center justify-center text-[10px] font-black text-primary border border-border-subtle">
                              Level {step.level}
                            </div>
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] uppercase tracking-widest font-black text-ghost">Authorized Designee Role</label>
                                <select 
                                  value={step.role}
                                  onChange={(e) => updateStep(chain.module_type, step.level, 'role', e.target.value)}
                                  className="bg-surface-base border border-border-subtle rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:border-primary transition-all text-main capitalize"
                                >
                                  {filteredAvailableRoles.map(r => (
                                    <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] uppercase tracking-widest font-black text-ghost">Minimum Gate Threshold (USD)</label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ghost text-xs font-bold">$</span>
                                  <input 
                                    type="number"
                                    value={step.threshold_min}
                                    onChange={(e) => updateStep(chain.module_type, step.level, 'threshold_min', Number(e.target.value))}
                                    className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-1.5 pl-6 text-xs font-bold outline-none focus:border-primary transition-all text-main"
                                    placeholder="0"
                                  />
                                </div>
                              </div>
                            </div>
                            <button 
                              onClick={() => removeStep(chain.module_type, step.level)}
                              className="p-2 text-dim hover:text-danger hover:bg-danger/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                              title="Delete gate"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION 2: COMPANY-WIDE CHAIN PATHWAYS */}
            <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6 shadow-sm">
              <div className="flex items-start justify-between mb-8 border-b border-border-subtle pb-4">
                <div className="flex flex-col gap-1 text-left">
                  <span className="text-[10px] font-mono tracking-widest uppercase text-accent font-black">Category 2</span>
                  <h2 className="text-sm font-black text-main uppercase tracking-tight">Enterprise Reusable Pathways (Approval Chains)</h2>
                  <p className="text-xs text-ghost">Establish corporate blueprint paths of consecutive signatures that operate across company departments and projects.</p>
                </div>
                <button 
                  onClick={handleOpenNewChainModal}
                  className="bg-accent text-surface-base text-xs font-bold px-4 py-2 rounded-xl hover:bg-accent/90 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-accent/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Formulate Pathway
                </button>
              </div>

              {/* Template Bluestep Library Preview */}
              <div className="mb-8">
                <div className="flex items-center gap-1.5 mb-4">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span className="text-[10px] uppercase tracking-widest font-black text-dim">Blueprint Standard Libraries</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {GLOBAL_APPROVAL_TEMPLATES.map((tpl) => (
                    <div key={tpl.id} className="p-4 bg-surface-2/40 border border-dashed border-border-subtle rounded-xl flex flex-col justify-between items-start gap-4 hover:bg-surface-2/65 transition-all text-left">
                      <div>
                        <span className="text-[8px] font-mono px-1.5 py-0.5 bg-surface-1 text-dim border border-border-subtle rounded uppercase tracking-wide font-bold">
                          {tpl.module_type} Standard Template
                        </span>
                        <h4 className="text-xs font-black text-main mt-2 tracking-tight">{tpl.chain_name}</h4>
                        <div className="flex items-center gap-1 mt-2.5 flex-wrap">
                          {tpl.steps_json.map((st, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <span className="px-1.5 py-0.5 bg-surface-base border border-border-subtle text-[8.5px] font-bold text-ghost rounded uppercase">
                                {st.role}
                              </span>
                              {i < tpl.steps_json.length - 1 && <ArrowRight className="w-2.5 h-2.5 text-ghost/40" />}
                            </div>
                          ))}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleCloneBlueprint(tpl)}
                        className="text-[9px] font-black uppercase tracking-widest text-primary hover:text-primary-dark cursor-pointer mt-1"
                      >
                        Clone Template & Activate ↗
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Company Level Custom Pathways list */}
              <div className="text-left">
                <div className="flex items-center gap-1.5 mb-4">
                  <GitBranch className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] uppercase tracking-widest font-black text-dim">Active Company Verification Routes ({customChains.length})</span>
                </div>

                {loadingCustom ? (
                  <div className="py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto opacity-30 mb-2" />
                    <p className="text-xs text-ghost italic">Indexing routes...</p>
                  </div>
                ) : customChains.length === 0 ? (
                  <div className="py-12 rounded-xl border border-dashed border-border-subtle flex flex-col items-center justify-center p-6 text-center bg-surface-2/20">
                    <GitBranch className="w-8 h-8 text-dim/30 mb-2" />
                    <span className="text-xs font-black text-main uppercase tracking-wide">No Active pathways Configured</span>
                    <p className="text-[10px] text-ghost mt-1 max-w-sm">
                      Cloned templates or customized pathways will be synchronized here corporate-wide for projects to reference.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customChains.map((way) => (
                      <div key={way.id} className="p-4 bg-surface-2 border border-border-subtle rounded-xl flex flex-col justify-between hover:border-primary/20 transition-all text-left group">
                        <div>
                          <div className="flex items-start justify-between">
                            <span className="px-2 py-0.5 bg-surface-base border border-border-subtle rounded text-[8px] font-mono tracking-wide uppercase font-bold text-ghost">
                              {way.module_type} Pathways
                            </span>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => handleOpenEditChainModal(way)}
                                className="p-1 hover:bg-surface-3 rounded text-ghost hover:text-main cursor-pointer"
                                title="Edit settings"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleDeleteCustomChain(way.id)}
                                className="p-1 hover:bg-danger/10 rounded text-ghost hover:text-danger cursor-pointer"
                                title="Delete pathway"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <h4 className="text-xs font-black text-main mt-2 tracking-tight">{way.chain_name}</h4>
                          <div className="mt-4 pt-3 border-t border-border-subtle/50">
                            <span className="text-[8px] font-black tracking-widest text-ghost uppercase block mb-2">Signature sequence steps:</span>
                            <div className="flex items-center gap-1 flex-wrap">
                              {way.steps_json?.map((st: any, idxOrder: number) => (
                                <div key={idxOrder} className="flex items-center gap-1">
                                  <div className="px-2 py-0.5 bg-surface-1 border border-border-subtle text-dim rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                                    {st.role?.replace(/_/g, ' ')}
                                  </div>
                                  {idxOrder < way.steps_json.length - 1 && <ArrowRight className="w-3 h-3 text-ghost/30" />}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        ) : (
          <div className="p-6 bg-surface-1 border border-border-subtle rounded-2xl flex flex-col gap-8 text-left shadow-sm animate-in fade-in-50 duration-200">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
               <div className="flex flex-col gap-5">
                  <div className="border-b border-border-subtle pb-4">
                    <h3 className="text-sm font-bold text-main">Budget Compliance Thresholds</h3>
                    <p className="text-xs text-ghost mt-1">Configure automated triggers for cost alerts</p>
                  </div>
                  <div className="flex flex-col gap-4">
                     {[
                       { label: 'Variance Warning', threshold: '90%', colorClass: 'bg-warning', desc: 'Triggered when project reaches near-budget' },
                       { label: 'Over-Budget Critical', threshold: '100%', colorClass: 'bg-danger', desc: 'Instant alert when budget is breached' }
                     ].map(item => (
                       <div key={item.label} className="flex flex-col gap-3 bg-surface-2/50 border border-border-subtle p-5 rounded-xl">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                               <div className={cn("w-2 h-2 rounded-full", item.colorClass)} />
                               <span className="text-sm font-bold text-main">{item.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                               <input type="text" defaultValue={item.threshold} className="w-16 bg-surface-base border border-border-subtle rounded-lg p-2 text-center text-xs font-black text-primary outline-none focus:border-primary transition-all" />
                               <span className="text-[10px] font-bold text-ghost">CAP</span>
                            </div>
                          </div>
                          <p className="text-[11px] text-ghost font-medium">{item.desc}</p>
                       </div>
                     ))}
                  </div>
               </div>
               <div className="flex flex-col gap-5">
                  <div className="border-b border-border-subtle pb-4">
                    <h3 className="text-sm font-bold text-main">Notification Intelligence</h3>
                    <p className="text-xs text-ghost mt-1">Manage where system alerts are routed</p>
                  </div>
                  <div className="bg-surface-2/50 border border-border-subtle rounded-xl divide-y divide-border-subtle">
                     {[
                       { label: 'In-App Alerts', enabled: true, icon: Bell },
                       { label: 'Direct Email', enabled: true, icon: Mail },
                       { label: 'Mobile SMS (Coming Soon)', enabled: false, icon: Smartphone }
                     ].map(item => (
                       <div key={item.label} className={cn(
                          "p-4 flex items-center justify-between transition-opacity",
                          !item.enabled && "opacity-50"
                       )}>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-surface-base border border-border-subtle flex items-center justify-center text-ghost">
                              <item.icon className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold text-dim">{item.label}</span>
                          </div>
                          <button 
                            disabled={!item.enabled && item.label.includes('Coming Soon')}
                            className={cn(
                            "w-12 h-6 rounded-full relative transition-all cursor-pointer",
                            item.enabled ? "bg-primary" : "bg-surface-base border border-border-subtle"
                          )}>
                             <div className={cn(
                               "w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm",
                               item.enabled ? "right-1" : "left-1"
                             )} />
                          </button>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>

      {/* Pathway Designer/Configurator Modal */}
      {showChainModal && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
              <div className="flex items-center gap-2.5 text-left">
                <div className="p-2 bg-accent/10 rounded-lg text-accent">
                  <GitBranch className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-main uppercase tracking-tight">
                    {editingCustomChain ? 'Edit Validation Pathway' : 'Design Custom Pathway'}
                  </h3>
                  <p className="text-[10px] text-ghost">Setup sequence steps for company validations.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowChainModal(false)}
                className="p-1.5 hover:bg-surface-2 rounded-full text-dim hover:text-main transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4 text-left max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-ghost">Pathway Title</label>
                <input 
                  type="text"
                  value={newPathName}
                  onChange={(e) => setNewPathName(e.target.value)}
                  className="bg-surface-2 border border-border-subtle rounded-xl p-3 text-xs outline-none focus:border-accent font-bold text-main"
                  placeholder="e.g. Risk & Boards Signoff Route"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-ghost">Module Capability Category</label>
                <select 
                  value={newPathModule}
                  onChange={(e) => setNewPathModule(e.target.value)}
                  className="bg-surface-2 border border-border-subtle rounded-xl p-3 text-xs outline-none focus:border-accent font-bold text-main"
                >
                  <option value="PO">PO - Purchase Order</option>
                  <option value="VO">VO - Variation Order</option>
                  <option value="EOT">EOT - Extension of Time</option>
                  <option value="WR">WR - Work Requisitions</option>
                  <option value="MR">MR - Material Requests</option>
                </select>
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between border-b border-border-subtle pb-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-ghost">Verification Signature Sequence</label>
                  <button 
                    onClick={handleAddModalStep}
                    className="text-[9px] font-black uppercase text-accent hover:text-accent-dark tracking-wider flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Add Step
                  </button>
                </div>

                {newPathSteps.length === 0 ? (
                  <p className="text-xs text-ghost italic text-center py-4">No validation steps defined. Items will auto-approve.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {newPathSteps.map((st, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-surface-2 p-2 rounded-xl border border-border-subtle">
                        <div className="w-6 h-6 rounded-full bg-surface-base text-[9px] font-mono font-black border border-border-subtle flex items-center justify-center text-accent">
                          {idx + 1}
                        </div>
                        <select 
                          value={st.role}
                          onChange={(e) => handleUpdateModalStepRole(idx, e.target.value)}
                          className="flex-1 bg-surface-base border border-border-subtle rounded-lg p-2 text-xs font-bold text-main outline-none capitalize"
                        >
                          {filteredAvailableRoles.map(r => (
                            <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                        <button 
                          onClick={() => handleRemoveModalStep(idx)}
                          className="p-1.5 text-ghost hover:text-danger rounded-lg hover:bg-danger/10 cursor-pointer"
                          title="delete step"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border-subtle bg-surface-2 flex items-center justify-end gap-2">
              <button 
                onClick={() => setShowChainModal(false)}
                className="px-4 py-2 bg-surface-3 hover:bg-surface-base border border-border-subtle rounded-xl text-xs font-bold text-dim transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveCustomChain}
                className="px-5 py-2 bg-accent text-surface-base rounded-xl text-xs font-bold hover:bg-accent/90 transition-all cursor-pointer shadow-sm shadow-accent/15 flex items-center gap-1"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                {editingCustomChain ? 'Update Pathway' : 'Design Pathway'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
