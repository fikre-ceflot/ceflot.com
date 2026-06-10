import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Project } from '../types';
import { 
  GitBranch, 
  Plus, 
  Trash2, 
  Loader2, 
  Building2, 
  Shield, 
  Check, 
  X,
  ArrowRight,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const GLOBAL_APPROVAL_TEMPLATES = [
  {
    id: 'tpl_procurement',
    chain_name: 'Nairobi Standard Procurement Chain',
    module_type: 'PO',
    steps_json: [
      { role: 'procurement', name: 'Procurement Specialist' },
      { role: 'project_manager', name: 'Project Manager' },
      { role: 'finance', name: 'Finance and CFO' }
    ]
  },
  {
    id: 'tpl_variation',
    chain_name: 'High-Value Variation Escalation Pipeline',
    module_type: 'VO',
    steps_json: [
      { role: 'qs', name: 'Quantity Surveyor' },
      { role: 'project_manager', name: 'Project Manager' },
      { role: 'director', name: 'Managing Director' }
    ]
  },
  {
    id: 'tpl_payment_cert',
    chain_name: 'Payment Certificate Two-Tier Audit',
    module_type: 'PC',
    steps_json: [
      { role: 'qs', name: 'Quantity Surveyor (QS)' },
      { role: 'finance', name: 'Finance Controller' }
    ]
  },
  {
    id: 'tpl_daily_report',
    chain_name: 'Direct Minor Progress Audit Workflow',
    module_type: 'DPR',
    steps_json: [
      { role: 'site_supervisor', name: 'Site Supervisor' },
      { role: 'project_coordinator', name: 'Project Coordinator' }
    ]
  }
];

interface ApprovalChainsProps {
  project: Project;
  userRole: string;
  tenantId: string;
}

export function ApprovalChains({ project, userRole, tenantId }: ApprovalChainsProps) {
  const [approvalChains, setApprovalChains] = useState<any[]>(() => {
    const saved = localStorage.getItem(`local_approval_chains_${project.id}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [editingChain, setEditingChain] = useState<any>(null);

  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem(`custom_categories_${project.id}`);
    return saved ? JSON.parse(saved) : ["Supplier Agreement", "Site Safety Manifest"];
  });
  const [newCategoryName, setNewCategoryName] = useState('');

  const [auditTraillogs, setAuditTrailLogs] = useState<any[]>(() => {
    const saved = localStorage.getItem(`audit_logs_${project.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    loadApprovals();
  }, [project.id]);

  useEffect(() => {
    localStorage.setItem(`custom_categories_${project.id}`, JSON.stringify(customCategories));
  }, [customCategories, project.id]);

  const loadApprovals = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('approval_chains')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;

      if (data) {
        setApprovalChains(data);
        localStorage.setItem(`local_approval_chains_${project.id}`, JSON.stringify(data));
      }
    } catch (e: any) {
      console.warn('DB query error for approval_chains, using local cache fallback:', e);
      const localChainsStr = localStorage.getItem(`local_approval_chains_${project.id}`);
      setApprovalChains(localChainsStr ? JSON.parse(localChainsStr) : []);
    } finally {
      setIsLoading(false);
    }
  };

  const logAuditAction = (action: string, description: string) => {
    const newLog = {
      timestamp: new Date().toISOString(),
      asset: 'Governance Integration',
      version: '1.2',
      action,
      userId: 'fikreerp@gmail.com',
      description
    };
    const updatedLogs = [newLog, ...auditTraillogs];
    setAuditTrailLogs(updatedLogs);
    localStorage.setItem(`audit_logs_${project.id}`, JSON.stringify(updatedLogs));
  };

  const handleSaveApprovalChain = async (chainData: any) => {
    try {
      const newId = editingChain ? editingChain.id : (chainData.id || 'chain_' + Math.random().toString(36).substr(2, 9));
      
      // Perform database operation FIRST
      if (editingChain) {
        const { error } = await supabase
          .from('approval_chains')
          .update(chainData)
          .eq('id', editingChain.id);
        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }
      } else {
        const { error } = await supabase
          .from('approval_chains')
          .insert({
            id: newId,
            ...chainData,
            project_id: project.id,
            tenant_id: tenantId
          });
        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }
      }

      // Sync local state / cache only after DB success
      const localChainsStr = localStorage.getItem(`local_approval_chains_${project.id}`);
      let localChains = localChainsStr ? JSON.parse(localChainsStr) : [];
      if (editingChain) {
        localChains = localChains.map((c: any) => c.id === editingChain.id ? { ...c, ...chainData } : c);
      } else {
        localChains.push({
          id: newId,
          project_id: project.id,
          tenant_id: tenantId,
          created_at: new Date().toISOString(),
          ...chainData
        });
      }
      localStorage.setItem(`local_approval_chains_${project.id}`, JSON.stringify(localChains));

      logAuditAction('Workflow Configuration', `Saved approval workflow chain for module category "${chainData.module_type}"`);
      setShowApprovalModal(false);
      setEditingChain(null);
      await loadApprovals();
    } catch (e: any) {
      console.error(e);
      alert('Error saving workflow pathway. Database Write is the sole authority. Action blocked: ' + e.message);
    }
  };

  const handleDeleteApprovalChain = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this approval chain?')) return;
    try {
      // DB action first
      const { error } = await supabase
        .from('approval_chains')
        .delete()
        .eq('id', id);
      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Synchronize cache only after DB success
      const localChainsStr = localStorage.getItem(`local_approval_chains_${project.id}`);
      if (localChainsStr) {
        const localChains = JSON.parse(localChainsStr);
        const filtered = localChains.filter((c: any) => c.id !== id);
        localStorage.setItem(`local_approval_chains_${project.id}`, JSON.stringify(filtered));
      }

      logAuditAction('Workflow Revoked', `Permanently deleted project approval workflow rule`);
      await loadApprovals();
    } catch (e: any) {
      console.error(e);
      alert('Error deleting approval chain. Database Write is the sole authority. Action blocked: ' + e.message);
    }
  };

  const handleCloneTemplate = async (tpl: any) => {
    const chainId = 'chain_' + Math.random().toString(36).substr(2, 9);
    const clonedChain = {
      id: chainId,
      project_id: project.id,
      tenant_id: tenantId,
      chain_name: tpl.chain_name + " (Cloned)",
      module_type: tpl.module_type,
      steps_json: tpl.steps_json,
      is_active: true,
      created_at: new Date().toISOString()
    };

    try {
      // DB operation first
      const { error } = await supabase
        .from('approval_chains')
        .insert({
          id: chainId,
          chain_name: clonedChain.chain_name,
          module_type: clonedChain.module_type,
          steps_json: clonedChain.steps_json,
          project_id: project.id,
          tenant_id: tenantId
        });
      
      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Local state / cache only after DB success
      const localChainsStr = localStorage.getItem(`local_approval_chains_${project.id}`);
      const localChains = localChainsStr ? JSON.parse(localChainsStr) : [];
      localChains.push(clonedChain);
      localStorage.setItem(`local_approval_chains_${project.id}`, JSON.stringify(localChains));

      logAuditAction('Blueprint Cloned', `Cloned Nairobi Standard pattern for ${tpl.module_type}`);
      setApprovalChains(prev => [...prev, clonedChain]);
      alert(`Successfully cloned standard blueprint: "${tpl.chain_name}" into your project's active approval chains!`);
    } catch (e: any) {
      console.error(e);
      alert('Error cloning blueprint template. Database Write is the sole authority. Action blocked: ' + e.message);
    }
  };

  const handleRegisterCategory = (catName: string) => {
    const clean = catName.trim();
    if (!clean) return;
    if (customCategories.includes(clean)) {
      alert('This module category has already been registered.');
      return;
    }
    setCustomCategories([...customCategories, clean]);
    logAuditAction('Modality Extension', `Configured dynamic custom action modality "${clean}"`);
    alert(`Successfully registered custom module "${clean}" on the fly! It is now fully integrated and available for approval workflows.`);
    setNewCategoryName('');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-main">Approval Chains</h1>
        <p className="text-sm text-dim">
          Establish dual-authorization policies, configure custom project checkpoints, and manage sign-off chains.
        </p>
      </div>

      {/* Sourcing Pathways & Custom Registration Module Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 bg-surface-1 border border-border-subtle rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-5 h-5 text-accent" />
              <h3 className="text-xs font-black text-main uppercase tracking-widest">Clone Approval Blueprints</h3>
            </div>
            <p className="text-[11px] text-ghost mb-4 font-medium">Select and copy standard verification paths directly from Nairobi Corporate Approval library to your active project:</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {GLOBAL_APPROVAL_TEMPLATES.map(tpl => (
                <div key={tpl.id} className="p-3 bg-surface-2 hover:bg-surface-3 transition-colors rounded-xl border border-border-subtle flex flex-col justify-between gap-3">
                  <div>
                    <span className="text-[8px] font-bold text-accent uppercase tracking-wider">{tpl.module_type} Template Pathway</span>
                    <h4 className="text-xs font-black text-main mt-1">{tpl.chain_name}</h4>
                    <div className="flex items-center gap-1 mt-2.5 flex-wrap text-[9px] text-ghost gap-y-1">
                      <span className="font-bold">Steps:</span>
                      {tpl.steps_json.map((st: any, idx) => (
                        <span key={idx} className="font-bold px-1.5 py-0.5 bg-surface-1 rounded text-dim border border-border-subtle/40">
                          {idx + 1}.{st.role}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCloneTemplate(tpl)}
                    className="px-3 py-1.5 rounded-lg bg-accent text-white hover:brightness-110 font-black text-[9px] uppercase tracking-wider transition-all self-end animate-in fade-in"
                  >
                    Clone Workflow
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-primary" />
              <h3 className="text-xs font-black text-main uppercase tracking-widest">Register Custom Category</h3>
            </div>
            <p className="text-[11px] text-ghost mb-4 font-medium">Register completely brand-new, customized project modalities as needed. They will support full approval routing identically to predefined modules:</p>

            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. Subcontractor Liability"
                className="bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs text-main placeholder-ghost outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-semibold animate-in fade-in"
              />

              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                <span className="text-[8px] font-bold text-ghost uppercase tracking-widest mr-1">Active:</span>
                {["PO", "PC", "VO", "DPR"].map(b => (
                  <span key={b} className="text-[8px] font-mono font-black px-1.5 py-0.5 bg-surface-2 text-ghost rounded uppercase border border-border-subtle">{b}</span>
                ))}
                {customCategories.map(c => (
                  <span key={c} className="text-[8px] font-mono font-black px-1.5 py-0.5 bg-primary/10 text-primary rounded uppercase border border-primary/20">{c}</span>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => handleRegisterCategory(newCategoryName)}
            className="mt-4 px-4 py-2.5 rounded-xl bg-primary text-black hover:brightness-110 text-[10px] uppercase font-black tracking-wider transition-all border border-primary font-mono"
          >
            + Register Modality
          </button>
        </div>

      </div>

      <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <GitBranch className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-main">Approval Chains</h2>
              <p className="text-sm text-dim">Define verification and authorization workflows for this project</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setEditingChain(null);
              setShowApprovalModal(true);
            }}
            className="btn btn-accent btn-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Approval Chain
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-24 bg-surface-2 animate-pulse rounded-xl" />
            ))
          ) : approvalChains.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-border-subtle rounded-2xl flex flex-col items-center gap-4">
              <GitBranch className="w-10 h-10 text-border-subtle" />
              <div className="flex flex-col gap-1">
                <h4 className="text-main font-bold">No custom chains defined</h4>
                <p className="text-xs text-ghost">Load standard workflows from your company library to begin</p>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-ghost btn-sm border-border-subtle">
                  Load from Library
                </button>
                <button 
                  onClick={() => {
                    setEditingChain(null);
                    setShowApprovalModal(true);
                  }}
                  className="btn btn-accent btn-sm"
                >
                  Create New
                </button>
              </div>
            </div>
          ) : (
            approvalChains.map((chain) => (
              <div key={chain.id} className="bg-surface-2 border border-border-subtle rounded-xl p-5 flex items-center justify-between group hover:border-accent transition-all animate-in fade-in">
                <div className="flex items-center gap-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-ghost">{chain.module_type} workflow</span>
                    <h4 className="text-sm font-bold text-main">{chain.chain_name}</h4>
                  </div>
                  <div className="h-10 w-px bg-border-subtle" />
                  <div className="flex items-center gap-3">
                    {(chain.steps_json || []).map((step: any, idx: number) => (
                      <React.Fragment key={idx}>
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-surface-1 border border-border-subtle flex items-center justify-center text-[10px] font-bold text-accent">
                            {idx + 1}
                          </div>
                          <span className="text-[9px] font-bold uppercase tracking-tighter text-ghost mt-1">{step.role || 'User'}</span>
                        </div>
                        {idx < (chain.steps_json.length - 1) && (
                          <ArrowRight className="w-3 h-3 text-border-subtle" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={() => {
                      setEditingChain(chain);
                      setShowApprovalModal(true);
                    }}
                    className="p-2 hover:bg-border-subtle rounded-lg text-ghost hover:text-main"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteApprovalChain(chain.id)}
                    className="p-2 hover:bg-border-subtle rounded-lg text-danger"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <AnimatePresence>
        {showApprovalModal && (
          <ApprovalChainModal
            chain={editingChain}
            onClose={() => {
              setShowApprovalModal(false);
              setEditingChain(null);
            }}
            onSave={handleSaveApprovalChain}
            customCategories={customCategories}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const ApprovalChainModal = ({ chain, onClose, onSave, customCategories = [] }: { chain: any; onClose: () => void; onSave: (data: any) => void; customCategories?: string[] }) => {
  const [name, setName] = useState(chain?.chain_name || '');
  const [module, setModule] = useState(chain?.module_type || 'PO');
  const [steps, setSteps] = useState<any[]>(chain?.steps_json || [{ role: 'project_manager' }]);

  const addStep = () => setSteps([...steps, { role: 'qs' }]);
  const removeStep = (idx: number) => setSteps(steps.filter((_, i) => i !== idx));
  const updateStep = (idx: number, role: string) => {
    const newSteps = [...steps];
    newSteps[idx].role = role;
    setSteps(newSteps);
  };

  const handleSave = () => {
    if (!name.trim()) return alert('Name is required');
    if (steps.length === 0) return alert('At least one step is required');
    onSave({
      chain_name: name,
      module_type: module,
      steps_json: steps,
      is_active: true
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
      >
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
          <h3 className="text-lg font-bold text-main">
            {chain ? 'Edit Approval Chain' : 'New Approval Chain'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-border-subtle rounded-lg text-ghost">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-ghost uppercase tracking-wider">Workflow Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard PO Approval"
              className="bg-surface-2 border border-border-subtle rounded-xl px-4 py-3 text-sm text-main focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-ghost uppercase tracking-wider">Module Type</label>
            <select
              value={module}
              onChange={(e) => setModule(e.target.value)}
              className="bg-surface-2 border border-border-subtle rounded-xl px-4 py-3 text-sm text-main focus:border-accent outline-none transition-all appearance-none"
            >
              <optgroup label="Standard Modalities">
                <option value="PO">Purchase Order</option>
                <option value="PC">Payment Certificate</option>
                <option value="VO">Variation Order</option>
                <option value="DPR">Daily Progress Report</option>
              </optgroup>
              {customCategories.length > 0 && (
                <optgroup label="Custom Registered Modules">
                  {customCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div className="flex flex-col gap-4">
            <label className="text-xs font-bold text-ghost uppercase tracking-wider flex items-center justify-between">
              Approval Steps
              <button 
                onClick={addStep}
                className="text-accent hover:text-main transition-colors text-xs font-bold uppercase tracking-wide"
              >
                + Add Step
              </button>
            </label>
            <div className="flex-col gap-3 flex">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl border border-border-subtle">
                  <div className="w-6 h-6 rounded-full bg-surface-1 flex items-center justify-center text-[10px] font-bold text-accent">
                    {idx + 1}
                  </div>
                  <select
                    value={step.role}
                    onChange={(e) => updateStep(idx, e.target.value)}
                    className="flex-1 bg-transparent border-none text-sm text-main focus:ring-0 outline-none"
                  >
                    <option value="project_manager">Project Manager</option>
                    <option value="qs">Quantity Surveyor (QS)</option>
                    <option value="finance">Finance</option>
                    <option value="procurement">Procurement</option>
                    <option value="director">Director</option>
                    <option value="contract_admin">Contract Administrator</option>
                  </select>
                  <button 
                    onClick={() => removeStep(idx)}
                    className="p-1.5 hover:bg-border-subtle rounded-lg text-danger"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-surface-2 border-t border-border-subtle flex items-center justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-ghost hover:text-main transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-sm font-bold shadow-lg shadow-accent/20 transition-all flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            {chain ? 'Update Chain' : 'Create Chain'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
