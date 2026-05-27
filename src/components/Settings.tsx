import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Bell, Shield, Sliders, CheckCircle, Save, Plus, Trash2, Loader2, AlertCircle, Mail, Smartphone } from 'lucide-react';
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

export function Settings({ tenantId }: { tenantId?: string }) {
  const [activeTab, setActiveTab] = useState<'approvals' | 'alerts'>('approvals');
  const { roles: allAvailableRoles } = useRoles(tenantId);
  const [chains, setChains] = useState<ApprovalChain[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tenantId && activeTab === 'approvals') {
      loadChains();
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
        if (error.message?.includes('public.tenant_approval_chains')) {
           // Fallback if table doesn't exist yet
           setChains([
             { module_type: 'budget', chain_name: 'Budget Approval', steps_json: [{ level: 1, role: 'director', threshold_min: 0 }] },
             { module_type: 'variation', chain_name: 'Variation Approval', steps_json: [{ level: 1, role: 'contract_admin', threshold_min: 0 }] }
           ]);
           return;
        }
        throw error;
      }

      if (data && data.length > 0) {
        setChains(data);
      } else {
        // Initial defaults
        setChains([
          { module_type: 'budget', chain_name: 'Budget Approval', steps_json: [{ level: 1, role: 'director', threshold_min: 0 }] },
          { module_type: 'variation', chain_name: 'Variation Approval', steps_json: [{ level: 1, role: 'contract_admin', threshold_min: 0 }] }
        ]);
      }
    } catch (e: any) {
      console.error('Error loading chains:', e.message);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    setError(null);
    try {
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

        if (error) throw error;
      }
      alert('Settings saved successfully!');
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
        return {
          ...c,
          steps_json: [...c.steps_json, { level: nextLevel, role: allAvailableRoles[0], threshold_min: 0 }]
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-main">System Settings</h1>
          <p className="text-sm text-ghost">Configure global workflows and notification rules</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving || loading}
          className="btn btn-accent btn-sm shadow-lg shadow-accent/20"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="flex gap-1 bg-surface-1 border border-border-subtle p-1 rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab('approvals')}
          className={cn(
            "px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
            activeTab === 'approvals' ? "bg-surface-2 text-primary" : "text-ghost hover:text-dim"
          )}
        >
          Approval Workflows
        </button>
        <button 
          onClick={() => setActiveTab('alerts')}
          className={cn(
            "px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
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

      <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden shadow-sm">
        {activeTab === 'approvals' ? (
          <div className="p-6 flex flex-col gap-10">
            {loading ? (
              <div className="py-24 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto opacity-40 mb-3" />
                <p className="text-xs font-medium text-dim">Loading workflows...</p>
              </div>
            ) : chains.map(chain => (
              <div key={chain.module_type} className="flex flex-col gap-5">
                <div className="flex items-center justify-between border-b border-border-subtle pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-main capitalize">{chain.chain_name}</h3>
                    <p className="text-xs text-ghost mt-1">Define authorization flow for {chain.module_type} changes</p>
                  </div>
                  <button 
                    onClick={() => addStep(chain.module_type)}
                    className="btn btn-ghost btn-sm text-primary hover:bg-primary/5"
                  >
                    <Plus className="w-4 h-4" />
                    Add Approval Level
                  </button>
                </div>
                
                <div className="flex flex-col gap-3">
                  {chain.steps_json.length === 0 ? (
                    <div className="py-8 text-center bg-surface-base/30 rounded-xl border border-dashed border-border-subtle">
                      <p className="text-xs text-ghost italic text-center">No approval steps defined. Items will be auto-approved.</p>
                    </div>
                  ) : chain.steps_json.map((step) => (
                    <div key={step.level} className="flex items-center gap-6 bg-surface-2/50 border border-border-subtle p-4 rounded-xl group hover:border-primary/30 transition-all">
                      <div className="w-10 h-10 rounded-full bg-surface-base flex items-center justify-center text-[11px] font-black text-primary border border-border-subtle shadow-sm">
                        {step.level}
                      </div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-ghost">Authorized Role</label>
                          <select 
                            value={step.role}
                            onChange={(e) => updateStep(chain.module_type, step.level, 'role', e.target.value)}
                            className="bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm font-medium outline-none focus:border-primary transition-all text-main capitalize"
                          >
                            {allAvailableRoles.map(r => (
                              <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-ghost">Minimum Threshold (USD)</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ghost text-sm font-bold">$</span>
                            <input 
                              type="number"
                              value={step.threshold_min}
                              onChange={(e) => updateStep(chain.module_type, step.level, 'threshold_min', Number(e.target.value))}
                              className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 pl-8 text-sm font-bold outline-none focus:border-primary transition-all text-main"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeStep(chain.module_type, step.level)}
                        className="p-3 text-dim hover:text-danger hover:bg-danger/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        title="Remove Step"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 flex flex-col gap-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
               <div className="flex flex-col gap-5">
                  <div className="border-b border-border-subtle pb-4">
                    <h3 className="text-sm font-bold text-main">Budget Compliance Thresholds</h3>
                    <p className="text-xs text-ghost mt-1">Configure automated triggers for cost alerts</p>
                  </div>
                  <div className="flex flex-col gap-3">
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
    </div>
  );
}

