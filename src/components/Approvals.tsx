import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText, 
  User, 
  ArrowRight, 
  Filter, 
  Search, 
  GitBranch, 
  Loader2, 
  Plus, 
  Shield, 
  AlertTriangle,
  FileCheck,
  X,
  CreditCard,
  ChevronsRight,
  Edit,
  Trash2,
  Building2,
  Check,
  Settings
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { Project } from '../types';

interface ApprovalsProps {
  tenantId?: string;
  userRole?: string;
  project?: Project;
}

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
    id: 'tpl_variations',
    chain_name: 'Risk & Variation Board Verification',
    module_type: 'VO',
    steps_json: [
      { role: 'contract_admin', name: 'Contract Administrator' },
      { role: 'site_engineer', name: 'Lead Site Engineer' },
      { role: 'director', name: 'Managing Director' }
    ]
  }
];

export function Approvals({ tenantId, userRole, project }: ApprovalsProps) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [search, setSearch] = useState('');

  // Sourcing & Category References
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [approvalChains, setApprovalChains] = useState<any[]>([]);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Configuration workspace states
  const [showConfigWorkspace, setShowConfigWorkspace] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [editingChain, setEditingChain] = useState<any>(null);

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('PO');
  const [newAmount, setNewAmount] = useState('');
  const [selectedChainId, setSelectedChainId] = useState('');

  const loadApprovalChains = async () => {
    if (!project?.id) return;
    try {
      // 1. Initial load from local memory/localStorage
      const localChainsStr = localStorage.getItem(`local_approval_chains_${project.id}`);
      let localChains = localChainsStr ? JSON.parse(localChainsStr) : [];

      // 2. Load from Supabase (using corrected 'approval_chains' table name)
      const { data, error } = await supabase
        .from('approval_chains')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: true });
      
      if (!error && data && data.length > 0) {
        // Merge DB data into localChains cleanly
        const merged = [...localChains];
        data.forEach((dbItem: any) => {
          if (!merged.some(m => m.id === dbItem.id)) {
            merged.push(dbItem);
          }
        });
        localChains = merged;
        localStorage.setItem(`local_approval_chains_${project.id}`, JSON.stringify(localChains));
      }
      setApprovalChains(localChains);
    } catch (e: any) {
      console.warn('Supabase query error for approval_chains, using local storage fallback:', e);
      const localChainsStr = localStorage.getItem(`local_approval_chains_${project.id}`);
      setApprovalChains(localChainsStr ? JSON.parse(localChainsStr) : []);
    }
  };

  useEffect(() => {
    loadRequests();
    if (project?.id) {
      // Load custom categories registered in Project Setup
      const savedCats = localStorage.getItem(`custom_categories_${project.id}`);
      if (savedCats) {
        setCustomCategories(JSON.parse(savedCats));
      } else {
        const defaultCats = ["Supplier Agreement", "Site Safety Manifest"];
        setCustomCategories(defaultCats);
        localStorage.setItem(`custom_categories_${project.id}`, JSON.stringify(defaultCats));
      }

      loadApprovalChains();
    }
  }, [tenantId, filter, project?.id]);

  const handleRegisterCategory = (catName: string) => {
    const clean = catName.trim();
    if (!clean) return;
    if (customCategories.includes(clean)) {
      alert('This module category has already been registered.');
      return;
    }
    const updated = [...customCategories, clean];
    setCustomCategories(updated);
    if (project?.id) {
      localStorage.setItem(`custom_categories_${project.id}`, JSON.stringify(updated));
    }
    alert(`Successfully registered custom module "${clean}" on the fly! It is now fully integrated and available for approval workflows.`);
    setNewCategoryName('');
  };

  const handleCloneTemplate = async (tpl: any) => {
    if (!project?.id) return;
    const chainId = 'chain_' + Math.random().toString(36).substr(2, 9);
    const clonedChain = {
      id: chainId,
      project_id: project.id,
      tenant_id: project.tenant_id || tenantId,
      chain_name: tpl.chain_name + " (Cloned)",
      module_type: tpl.module_type,
      steps_json: tpl.steps_json,
      is_active: true,
      created_at: new Date().toISOString()
    };

    // Save locally
    const localChainsStr = localStorage.getItem(`local_approval_chains_${project.id}`);
    const localChains = localChainsStr ? JSON.parse(localChainsStr) : [];
    localChains.push(clonedChain);
    localStorage.setItem(`local_approval_chains_${project.id}`, JSON.stringify(localChains));

    // Try Supabase best effort
    try {
      await supabase
        .from('approval_chains')
        .insert({
          id: chainId,
          chain_name: clonedChain.chain_name,
          module_type: clonedChain.module_type,
          steps_json: clonedChain.steps_json,
          project_id: project.id,
          tenant_id: project.tenant_id || tenantId
        });
    } catch (e) {
      console.warn("Supabase clone error", e);
    }

    loadApprovalChains();
    alert(`Successfully cloned standard blueprint: "${tpl.chain_name}" into your project's active approval chains!`);
  };

  const handleSaveApprovalChain = async (chainData: any) => {
    if (!project?.id) return;
    try {
      const localChainsStr = localStorage.getItem(`local_approval_chains_${project.id}`);
      let localChains = localChainsStr ? JSON.parse(localChainsStr) : [];

      if (editingChain) {
        localChains = localChains.map((c: any) => c.id === editingChain.id ? { ...c, ...chainData } : c);
      } else {
        const newId = chainData.id || 'chain_' + Math.random().toString(36).substr(2, 9);
        localChains.push({
          id: newId,
          project_id: project.id,
          tenant_id: project.tenant_id || tenantId,
          created_at: new Date().toISOString(),
          ...chainData
        });
      }
      localStorage.setItem(`local_approval_chains_${project.id}`, JSON.stringify(localChains));

      // Sync to Supabase
      try {
        if (editingChain) {
          await supabase
            .from('approval_chains')
            .update(chainData)
            .eq('id', editingChain.id);
        } else {
          await supabase
            .from('approval_chains')
            .insert({
              ...chainData,
              project_id: project.id,
              tenant_id: project.tenant_id || tenantId
            });
        }
      } catch (dbErr) {
        console.warn("Supabase save chain failed:", dbErr);
      }

      setShowApprovalModal(false);
      setEditingChain(null);
      loadApprovalChains();
    } catch (e: any) {
      alert('Error saving workflow pathway: ' + e.message);
    }
  };

  const handleDeleteApprovalChain = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this approval chain?')) return;
    if (!project?.id) return;
    try {
      const localChainsStr = localStorage.getItem(`local_approval_chains_${project.id}`);
      if (localChainsStr) {
        const localChains = JSON.parse(localChainsStr);
        const filtered = localChains.filter((c: any) => c.id !== id);
        localStorage.setItem(`local_approval_chains_${project.id}`, JSON.stringify(filtered));
      }

      try {
        await supabase
          .from('approval_chains')
          .delete()
          .eq('id', id);
      } catch (dbErr) {
        console.warn("Supabase delete chain failed:", dbErr);
      }

      loadApprovalChains();
    } catch (e: any) {
      alert('Error deleting approval chain: ' + e.message);
    }
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      // 1. Fetch from Supabase approvals table
      let dbRequests: any[] = [];
      if (tenantId) {
        try {
          let query = supabase
            .from('approvals')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

          if (filter === 'pending') {
            query = query.eq('status', 'pending');
          } else if (filter === 'completed') {
            query = query.neq('status', 'pending');
          }

          const { data, error } = await query;
          if (!error && data) {
            dbRequests = data;
          }
        } catch (e) {
          console.warn("Supabase query warn:", e);
        }
      }

      // 2. Fetch from Local Storage for complete offline backup integration
      const localReqsStr = localStorage.getItem(`local_approvals_${project?.id || 'global'}`);
      let localRequests = localReqsStr ? JSON.parse(localReqsStr) : [];
      if (filter === 'pending') {
        localRequests = localRequests.filter((r: any) => r.status === 'pending');
      } else if (filter === 'completed') {
        localRequests = localRequests.filter((r: any) => r.status !== 'pending');
      }

      // 3. Merge both cleanly preventing duplication
      const merged = [...localRequests];
      dbRequests.forEach((dr) => {
        if (!merged.some(mr => mr.id === dr.id)) {
          merged.push(dr);
        }
      });

      // Sort by creation time
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRequests(merged);
    } catch (e: any) {
      console.error('Error loading approvals:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (req: any, decisionStatus: 'approved' | 'rejected') => {
    // Locate the matching approval chain configuration
    const matchedChain = approvalChains.find(c => c.module_type === req.type || c.id === req.chain_id);
    const steps = matchedChain?.steps_json || [];
    const currentStepIdx = req.current_step_index || 0;
    const requiredRole = steps[currentStepIdx]?.role;

    // Enforce role permission if present
    if (requiredRole && userRole !== requiredRole && userRole !== 'platform_god' && userRole !== 'tenant_admin') {
      alert(`Access Warning: Only users holding the "${requiredRole.toUpperCase().replace(/_/g, ' ')}" role are authorized to sign off on Step ${currentStepIdx + 1} of this validation workflow.`);
      return;
    }

    const confirmMsg = `Are you sure you want to log your signature to ${decisionStatus} this request: "${req.title}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      let finalStatus: string = decisionStatus;
      let nextStepIdx = currentStepIdx;
      const signatureEntry = {
        role: userRole || 'any',
        name: 'Authorized Signee',
        signed_at: new Date().toISOString(),
        status: decisionStatus
      };

      const updatedSignatures = [...(req.signatures || []), signatureEntry];

      // Multi-step sign-off routing path evaluations
      if (decisionStatus === 'approved') {
        if (matchedChain && currentStepIdx + 1 < steps.length) {
          // Send to next step
          nextStepIdx = currentStepIdx + 1;
          finalStatus = 'pending';
          alert(`Step ${currentStepIdx + 1} Approved. Request was successfully routed to next validation authority: ${steps[nextStepIdx].role.toUpperCase().replace(/_/g, ' ')}.`);
        } else {
          // Final sign-off complete
          finalStatus = 'approved';
          alert(`Final clearance achieved! The baseline modality was structurally approved & frozen into Source of Truth.`);
          
          // SIDE EFFECT 1: sync with matching project setup baseline so it gets frozen automatically
          try {
            const savedAssetsStr = localStorage.getItem(`assets_sot_${project?.id}`);
            if (savedAssetsStr) {
              const assets = JSON.parse(savedAssetsStr);
              const updatedAssets = assets.map((asset: any) => {
                const lowerTask = asset.checklist_task.toLowerCase();
                const lowerTitle = req.title.toLowerCase();
                // Check matching baseline
                if (lowerTask.includes(req.type?.toLowerCase()) || lowerTitle.includes(asset.name.toLowerCase())) {
                  return {
                    ...asset,
                    status: 'APPROVED',
                    locked: true,
                    approved_by: 'fikreerp@gmail.com',
                    approved_at: new Date().toISOString(),
                    version: asset.version || '1.0'
                  };
                }
                return asset;
              });
              localStorage.setItem(`assets_sot_${project?.id}`, JSON.stringify(updatedAssets));
            }
          } catch (asErr) {
            console.warn(asErr);
          }
        }
      } else {
        // Rejection halts workflows
        finalStatus = 'rejected';
        alert('Validation request has been officially rejected. Modality draft remains open for edits.');
      }

      // Update local storage
      const localReqsStr = localStorage.getItem(`local_approvals_${project?.id || 'global'}`);
      const localRequests = localReqsStr ? JSON.parse(localReqsStr) : [];
      const updatedLocal = localRequests.map((r: any) => {
        if (r.id === req.id) {
          return {
            ...r,
            status: finalStatus,
            current_step_index: nextStepIdx,
            signatures: updatedSignatures,
            decided_at: finalStatus !== 'pending' ? new Date().toISOString() : null
          };
        }
        return r;
      });
      localStorage.setItem(`local_approvals_${project?.id || 'global'}`, JSON.stringify(updatedLocal));

      // Try update in Supabase best effort
      try {
        await supabase
          .from('approvals')
          .update({ 
            status: finalStatus,
            current_step_index: nextStepIdx,
            signatures: updatedSignatures,
            decided_at: finalStatus !== 'pending' ? new Date().toISOString() : null
          })
          .eq('id', req.id);

        if (req.type === 'budget' && finalStatus !== 'pending') {
          await supabase
            .from('projects')
            .update({ budget_status: finalStatus })
            .eq('id', req.project_id);
        }
      } catch (dbErr) {
        console.warn("Supabase update error", dbErr);
      }

      loadRequests();
    } catch (e: any) {
      alert('Error logging approval signature: ' + e.message);
    }
  };

  const handleCreateRequest = () => {
    if (!newTitle.trim()) {
      alert('A descriptive request title is required.');
      return;
    }

    const reqId = 'req_' + Math.random().toString(36).substr(2, 9);
    const chainObj = approvalChains.find(c => c.id === selectedChainId);

    const newReq = {
      id: reqId,
      project_id: project?.id || 'global',
      tenant_id: tenantId || 'default',
      title: newTitle,
      type: newType,
      amount: parseFloat(newAmount) || 0,
      requester_name: 'Fikre PM Coordinator',
      status: 'pending',
      current_step_index: 0,
      chain_id: selectedChainId || null,
      signatures: [],
      created_at: new Date().toISOString(),
      decided_at: null
    };

    // Save locally
    const localReqsStr = localStorage.getItem(`local_approvals_${project?.id || 'global'}`);
    const localRequests = localReqsStr ? JSON.parse(localReqsStr) : [];
    localRequests.push(newReq);
    localStorage.setItem(`local_approvals_${project?.id || 'global'}`, JSON.stringify(localRequests));

    // Try Supabase best effort
    try {
      supabase
        .from('approvals')
        .insert({
          id: reqId,
          project_id: project?.id,
          tenant_id: tenantId,
          title: newTitle,
          type: newType,
          amount: parseFloat(newAmount) || 0,
          requester_name: 'Fikre PM Coordinator',
          status: 'pending',
          current_step_index: 0,
          chain_id: selectedChainId || null,
          signatures: []
        }).then(({ error }) => {
          if (error) console.warn("Supabase insert approval warning", error);
        });
    } catch (e) {
      console.warn("Supabase insert approval error", e);
    }

    setShowSubmitModal(false);
    setNewTitle('');
    setNewAmount('');
    alert('Descriptive validation request has been logged and routed to authorization queue.');
    loadRequests();
  };

  const filtered = requests.filter(r => 
    (r.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.type || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.requester_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-4 px-1">
        <div className="flex flex-col gap-0.5 md:mt-auto">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-black text-ghost uppercase tracking-[0.3em]">Governance & Source of Truth (SoT)</span>
          </div>
          <h1 className="text-[19px] font-black tracking-tight text-main -ml-0.5">{project?.name || 'Pending Approvals'}</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-2 text-[10px] font-bold text-ghost">
              <span className="text-primary font-black uppercase tracking-widest decoration-primary/30 underline-offset-4 font-mono">Workflow Queue</span>
              <span className="w-1 h-1 rounded-full bg-border-subtle" />
              <span className="px-1.5 py-0.25 rounded bg-surface-2 border border-border-subtle opacity-80">{requests.filter(a => a.status === 'pending').length} Active Items</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-surface-1 border border-border-subtle p-1 rounded-xl w-full justify-between md:w-auto">
            <div className="flex gap-1">
              <button 
                onClick={() => setFilter('pending')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                  filter === 'pending' ? "bg-surface-2 text-primary shadow-sm" : "text-ghost hover:text-main"
                )}
              >
                Active ({requests.filter(a => a.status === 'pending').length})
              </button>
              <button 
                onClick={() => setFilter('completed')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                  filter === 'completed' ? "bg-surface-2 text-primary shadow-sm" : "text-ghost hover:text-main"
                )}
              >
                Signature History
              </button>
            </div>
            
            <button
              onClick={() => setShowConfigWorkspace(!showConfigWorkspace)}
              className={cn(
                "ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-black uppercase tracking-wider transition-all",
                showConfigWorkspace 
                  ? "bg-primary text-black border-primary font-black shadow-sm" 
                  : "bg-surface-2 text-ghost border-border-subtle hover:text-main"
              )}
            >
              <Settings className="w-4 h-4" />
              ⚙️ Settings
            </button>

            <button
              onClick={() => {
                if (approvalChains.length === 0) {
                  alert("Please setup approval chains in the Configuration panel above or Project Setup first before initiating requests.");
                  return;
                }
                setShowSubmitModal(true);
              }}
              className="ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white hover:brightness-110 text-xs font-black uppercase tracking-wider transition-all shadow-[0_2px_10px_rgba(240,74,90,0.15)]"
            >
              <Plus className="w-4 h-4" />
              Request Audit
            </button>
          </div>
        </div>
      </header>

      {/* Dynamic Inline Waveway Configuration Workspace */}
      <AnimatePresence>
        {showConfigWorkspace && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6 flex flex-col gap-6"
          >
            <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6 shadow-sm flex flex-col gap-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle/50 pb-4">
                <div>
                  <h3 className="text-xs font-black text-main uppercase tracking-widest flex items-center gap-2">
                    <Settings className="w-4 h-4 text-primary animate-spin-slow" />
                    Approval Routing pathways configuration
                  </h3>
                  <p className="text-[11px] text-ghost mt-1 font-semibold">
                    Configure multi-step sign-off structures, register custom categories, and clone Nairobi templates libraries.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingChain(null);
                    setShowApprovalModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-primary text-black hover:brightness-110 text-[10.5px] font-black uppercase tracking-wider transition-all border border-primary flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Create Chain Route
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Clone Library & Category Register */}
                <div className="flex flex-col gap-6 lg:border-r lg:border-border-subtle/50 lg:pr-6">
                  {/* Clone Standard blueprints library */}
                  <div className="flex flex-col gap-3">
                    <span className="text-[10px] font-black text-main uppercase tracking-widest flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-accent" />
                      Clone Nairobi templates library
                    </span>
                    <div className="flex flex-col gap-2.5">
                      {GLOBAL_APPROVAL_TEMPLATES.map(tpl => (
                        <div key={tpl.id} className="p-3 bg-surface-2 rounded-xl border border-border-subtle flex flex-col justify-between gap-3">
                          <div>
                            <span className="text-[8px] font-bold text-accent uppercase tracking-wider">{tpl.module_type} Preset Pathway</span>
                            <h4 className="text-xs font-black text-main mt-0.5">{tpl.chain_name}</h4>
                            <div className="flex items-center gap-1 mt-2 flex-wrap text-[9px] text-ghost">
                              <span className="font-bold">Steps:</span>
                              {tpl.steps_json.map((st: any, idx) => (
                                <span key={idx} className="font-bold px-1.5 py-0.25 bg-surface-1 rounded text-dim border border-border-subtle/40">
                                  {idx + 1}.{st.role}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={() => handleCloneTemplate(tpl)}
                            className="px-2.5 py-1.5 rounded-lg bg-accent text-white hover:brightness-110 font-bold text-[9px] uppercase tracking-wider transition-all self-end"
                          >
                            Clone pathway
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Register Custom Category Modality on the fly */}
                  <div className="flex flex-col gap-3 pt-4 border-t border-border-subtle/30">
                    <span className="text-[10px] font-black text-main uppercase tracking-widest flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-primary" />
                      Register custom modalities
                    </span>
                    <p className="text-[10.5px] text-ghost leading-relaxed font-semibold">
                      Establish custom registered modalities to route safety protocols, supplier listings or local milestones.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. Supplier Agreement"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="flex-1 bg-surface-2 border border-border-subtle rounded-xl px-3 py-2 text-xs text-main placeholder-ghost outline-none focus:border-accent font-semibold"
                      />
                      <button
                        onClick={() => handleRegisterCategory(newCategoryName)}
                        className="px-3 py-2 bg-primary text-black rounded-xl hover:brightness-110 text-[9.5px] uppercase font-black tracking-wider transition-all border border-primary font-mono"
                      >
                        Register
                      </button>
                    </div>
                    {/* Active indicators */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      <span className="text-[8px] font-bold text-ghost uppercase tracking-widest mr-1">Active Categories:</span>
                      {["PO", "PC", "VO", "DPR"].map(b => (
                        <span key={b} className="text-[8px] font-mono font-black px-1.5 py-0.5 bg-surface-2 text-ghost rounded uppercase border border-border-subtle">{b}</span>
                      ))}
                      {customCategories.map(c => (
                        <span key={c} className="text-[8px] font-mono font-black px-1.5 py-0.5 bg-primary/10 text-primary rounded uppercase border border-primary/20">{c}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. List of Active Approval Chains Configuration (takes 2 columns) */}
                <div className="lg:col-span-2 flex flex-col gap-3">
                  <span className="text-[10px] font-black text-main uppercase tracking-widest flex items-center gap-1.5">
                    <GitBranch className="w-4 h-4 text-primary" />
                    Active project validation pathways ({approvalChains.length})
                  </span>
                  
                  {approvalChains.length === 0 ? (
                    <div className="flex-1 min-h-[180px] rounded-xl border border-dashed border-border-subtle flex flex-col items-center justify-center p-6 text-center bg-surface-2/40">
                      <GitBranch className="w-8 h-8 text-dim/45 mb-2.5 animate-pulse" />
                      <span className="text-xs font-black text-main uppercase tracking-wide">No Custom Chains Configured</span>
                      <p className="text-[10.5px] text-ghost mt-1 max-w-sm">
                        Verify custom routes by cloning templates in the library on the left, or click "Create Chain Route" to construct one.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[400px] overflow-y-auto pr-1">
                      {approvalChains.map((chain) => (
                        <div key={chain.id} className="p-4 bg-surface-2 rounded-xl border border-border-subtle flex flex-col justify-between hover:border-accent/40 transition-colors group">
                          <div>
                            <div className="flex items-start justify-between">
                              <span className="px-2 py-0.5 bg-surface-1 text-dim border border-border-subtle rounded text-[9px] font-mono uppercase font-black">
                                {chain.module_type} Modality
                              </span>
                              <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => {
                                    setEditingChain(chain);
                                    setShowApprovalModal(true);
                                  }}
                                  className="p-1.5 hover:bg-surface-3 rounded text-ghost hover:text-main"
                                  title="Edit Chain Settings"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteApprovalChain(chain.id)}
                                  className="p-1.5 hover:bg-danger/10 rounded text-ghost hover:text-danger"
                                  title="Delete Chain"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <h4 className="text-xs font-black text-main mt-2 tracking-tight">{chain.chain_name}</h4>
                            
                            {/* Visual steps chain representation */}
                            <div className="mt-3.5 pt-3 border-t border-border-subtle/50">
                              <span className="text-[8.5px] font-black tracking-widest text-ghost uppercase block mb-2">Signature Route:</span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {chain.steps_json?.map((st: any, idx: number) => (
                                  <div key={idx} className="flex items-center gap-1">
                                    <div className="px-2 py-0.75 bg-surface-1 border border-border-subtle text-dim rounded-lg text-[9px] font-bold uppercase tracking-wide flex items-center gap-1 shadow-sm">
                                      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                                      {st.role?.replace(/_/g, ' ')}
                                    </div>
                                    {idx < chain.steps_json.length - 1 && (
                                      <ArrowRight className="w-3 h-3 text-ghost/40" />
                                    )}
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main List Table */}
      <div className="bg-surface-1 border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border-subtle flex items-center gap-4 bg-surface-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
            <input 
              type="text"
              placeholder="Search specifications, types, builders…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-1 border border-border-subtle rounded-xl py-2.5 pl-10 pr-4 text-xs outline-none focus:border-primary transition-colors text-main font-semibold placeholder-ghost"
            />
          </div>
          <span className="text-[10px] font-mono text-ghost">
            Enforcing strict multi-step approvals for role permissions holding authority.
          </span>
        </div>

        <div className="divide-y divide-border-subtle/50">
          {loading ? (
            <div className="py-24 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-xs text-ghost font-medium">Validating security signatures from server...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-24 text-center text-dim bg-surface-1/40">
              <CheckCircle className="w-12 h-12 opacity-10 mx-auto mb-3 text-primary animate-pulse" />
              <div className="text-xs font-black uppercase tracking-widest text-main">Your Desk is Clean</div>
              <p className="text-xs mt-1 text-dim">No pending validation requests requiring your signature.</p>
            </div>
          ) : (
            filtered.map((req) => {
              // Locate matching chain step roles dynamically
              const matchedChain = approvalChains.find(c => c.module_type === req.type || c.id === req.chain_id);
              const steps = matchedChain?.steps_json || [];
              const currentStepIdx = req.current_step_index || 0;
              const nextRole = steps[currentStepIdx]?.role;
              const hasAuthority = nextRole && (userRole === nextRole || userRole === 'platform_god' || userRole === 'tenant_admin');

              return (
                <div key={req.id} className="p-6 flex flex-col lg:flex-row lg:items-center justify-between hover:bg-white/[0.005] transition-colors gap-6 group">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border",
                      req.status === 'approved' ? "bg-primary/5 text-primary border-primary/25" :
                      req.status === 'rejected' ? "bg-danger/5 text-danger border-danger/25" :
                      "bg-warning/5 text-warning border-warning/25 animate-pulse"
                    )}>
                      {req.type === 'budget' || req.type === 'PO' ? <FileText className="w-5.5 h-5.5" /> : <GitBranch className="w-5.5 h-5.5" />}
                    </div>
                    
                    <div className="flex flex-col gap-1.5 flex-1 max-w-xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-surface-2 border border-border-subtle text-dim tracking-wider">
                          {req.type} Modality
                        </span>
                        <h3 className="text-xs font-bold text-main">{req.title}</h3>
                      </div>

                      <div className="flex items-center gap-3 text-[10.5px] text-ghost flex-wrap">
                        <span className="flex items-center gap-1"><User className="w-3 h-3 text-secondary" /> {req.requester_name || 'System Operator'}</span>
                        <span className="w-1 h-1 rounded-full bg-border-subtle" />
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(req.created_at).toLocaleString()}</span>
                      </div>

                      {/* Multistep Chain Flow Stepper Indicators */}
                      {steps.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border-subtle/50 flex flex-col gap-1.5">
                          <span className="text-[9px] font-bold text-ghost uppercase tracking-wider">Approval Routing Roadmap</span>
                          <div className="flex items-center gap-2 flex-wrap">
                            {steps.map((st: any, idx: number) => {
                              const isSigned = idx < currentStepIdx;
                              const isActive = idx === currentStepIdx && req.status === 'pending';
                              return (
                                <React.Fragment key={idx}>
                                  <div className={cn(
                                    "flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-wider transition-all",
                                    isSigned ? "bg-primary/10 border-primary/20 text-primary" :
                                    isActive ? "bg-warning/10 border-warning/25 text-warning ring-1 ring-warning/30" :
                                    "bg-surface-2 border-border-subtle text-ghost"
                                  )}>
                                    <span className={cn(
                                      "w-1.5 h-1.5 rounded-full",
                                      isSigned ? "bg-primary" :
                                      isActive ? "bg-warning animate-ping" :
                                      "bg-ghost"
                                    )} />
                                    <span>{st.role?.replace(/_/g, ' ')}</span>
                                  </div>
                                  {idx < steps.length - 1 && (
                                    <ChevronsRight className="w-3.5 h-3.5 text-dim/50" />
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 justify-between lg:justify-end border-t lg:border-t-0 pt-4 lg:pt-0 border-border-subtle/40">
                    <div className="flex flex-col items-start lg:items-end min-w-[90px]">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-ghost">Value Metrics</span>
                      <span className="text-xs font-black text-main">KES {(req.amount || 0).toLocaleString()}</span>
                    </div>

                    {req.status === 'pending' ? (
                      <div className="flex items-center gap-3">
                        {/* Dynamic Sign-off Authorization check notice block */}
                        {nextRole && !hasAuthority ? (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/5 border border-warning/20 rounded-xl text-warning text-[10px] font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Awaiting {nextRole.toUpperCase().replace(/_/g, ' ')} sign-off</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={() => handleDecision(req, 'rejected')}
                              className="px-3.5 py-1.5 rounded-xl border border-danger/20 text-danger hover:bg-danger/10 text-[10px] font-black uppercase tracking-wider transition-all"
                              title="Reject Verification"
                            >
                              Reject
                            </button>
                            <button 
                              onClick={() => handleDecision(req, 'approved')}
                              className="px-4 py-1.5 rounded-xl bg-primary text-black font-black hover:brightness-110 text-[10px] uppercase font-black tracking-wider transition-all border border-primary flex items-center gap-1"
                              title="Approve Signature"
                            >
                              Sign-off
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={cn(
                        "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border flex items-center gap-1.5",
                        req.status === 'approved' ? "bg-primary/10 text-primary border-primary/20" : "bg-danger/10 text-danger border-danger/20"
                      )}>
                        {req.status === 'approved' ? <FileCheck className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span>{req.status === 'approved' ? 'Locked SOT Clear' : 'Disapproved'}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Request Submission Modal */}
      <AnimatePresence>
        {showSubmitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative"
            >
              <div className="px-6 py-4.5 border-b border-border-subtle flex items-center justify-between bg-surface-2">
                <h3 className="text-sm font-black text-main uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary animate-pulse" />
                  Request Baseline Verification Audit
                </h3>
                <button onClick={() => setShowSubmitModal(false)} className="p-1.5 hover:bg-border-subtle rounded-lg text-ghost">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 flex flex-col gap-5 text-xs">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-ghost uppercase tracking-wider">Descriptive specification Title</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Verify Nairobi Raw Sand Suppliers List"
                    className="bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-3 text-xs text-main placeholder-ghost outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-ghost uppercase tracking-wider">Baseline category</label>
                    <select
                      value={newType}
                      onChange={(e) => {
                        setNewType(e.target.value);
                        // Pre-select matching chain if any
                        const preChain = approvalChains.find(c => c.module_type === e.target.value);
                        if (preChain) setSelectedChainId(preChain.id);
                      }}
                      className="bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-3 text-xs text-main outline-none focus:border-accent transition-all appearance-none font-semibold"
                    >
                      <optgroup label="Core Modals">
                        <option value="PO">Purchase Order</option>
                        <option value="PC">Payment Certificate</option>
                        <option value="VO">Variation Order</option>
                        <option value="DPR">Daily Progress Report</option>
                      </optgroup>
                      {customCategories.length > 0 && (
                        <optgroup label="Custom Registered Modules">
                          {customCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-ghost uppercase tracking-wider">Incurred Cost (KES)</label>
                    <input
                      type="number"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      placeholder="e.g. 500000"
                      className="bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-3 text-xs text-main placeholder-ghost outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-semibold font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-ghost uppercase tracking-wider">Active Approval Chain Routing pathway</label>
                  <select
                    value={selectedChainId}
                    onChange={(e) => setSelectedChainId(e.target.value)}
                    className="bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-3 text-xs text-main outline-none focus:border-accent transition-all appearance-none font-semibold"
                  >
                    <option value="">Select custom chain...</option>
                    {approvalChains.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.chain_name} ({c.module_type})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="px-6 py-4 bg-surface-2 border-t border-border-subtle flex items-center justify-end gap-2.5">
                <button 
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 text-xs font-bold text-ghost hover:text-main"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateRequest}
                  className="px-5 py-2 rounded-xl bg-accent text-white font-black hover:brightness-110 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-[0_2px_10px_rgba(240,74,90,0.25)]"
                >
                  <GitBranch className="w-4 h-4" />
                  Initiate Audit
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pathway Designer Editor Modal */}
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

interface ApprovalChainModalProps {
  chain: any;
  onClose: () => void;
  onSave: (chainData: any) => void;
  customCategories: string[];
}

function ApprovalChainModal({ chain, onClose, onSave, customCategories }: ApprovalChainModalProps) {
  const [chainName, setChainName] = useState(chain?.chain_name || '');
  const [moduleType, setModuleType] = useState(chain?.module_type || 'PO');
  const [steps, setSteps] = useState<any[]>(chain?.steps_json || []);

  const roles = [
    { value: 'procurement', label: 'Procurement Specialist' },
    { value: 'project_manager', label: 'Project Manager' },
    { value: 'finance', label: 'Finance and CFO' },
    { value: 'site_engineer', label: 'Lead Site Engineer' },
    { value: 'contract_admin', label: 'Contract Administrator' },
    { value: 'director', label: 'Managing Director' },
    { value: 'tenant_admin', label: 'Tenant Master Administrator' }
  ];

  const handleAddStep = () => {
    setSteps([...steps, { role: 'project_manager', name: 'Validator' }]);
  };

  const handleRemoveStep = (idx: number) => {
    setSteps(steps.filter((_, i) => i !== idx));
  };

  const handleStepRoleChange = (idx: number, roleVal: string) => {
    const updated = [...steps];
    const foundLabel = roles.find(r => r.value === roleVal)?.label || 'Validator';
    updated[idx] = { role: roleVal, name: foundLabel };
    setSteps(updated);
  };

  const handleSave = () => {
    if (!chainName.trim()) {
      alert('Approval chain title is required');
      return;
    }
    if (steps.length === 0) {
      alert('At least one routing step is required for baseline verification routing.');
      return;
    }
    onSave({
      chain_name: chainName,
      module_type: moduleType,
      steps_json: steps,
      is_active: true
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative"
      >
        <div className="px-6 py-4.5 border-b border-border-subtle flex items-center justify-between bg-surface-2">
          <h3 className="text-sm font-black text-main uppercase tracking-wider flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-accent" />
            {chain ? 'Edit Pathway Details' : 'Design New Verification Route'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-border-subtle rounded-lg text-ghost">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-ghost uppercase tracking-wider">Pathway / Chain Name</label>
              <input
                type="text"
                placeholder="e.g. Finance Major Disbursement Route"
                value={chainName}
                onChange={(e) => setChainName(e.target.value)}
                className="bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-3 text-xs text-main placeholder-ghost outline-none focus:border-accent transition-all font-semibold"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-ghost uppercase tracking-wider">Target Modality / Category</label>
              <select
                value={moduleType}
                onChange={(e) => setModuleType(e.target.value)}
                className="bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-3 text-xs text-main outline-none focus:border-accent transition-all appearance-none font-semibold"
              >
                <optgroup label="Standard Modalities">
                  <option value="PO">Purchase Order</option>
                  <option value="PC">Payment Certificate</option>
                  <option value="VO">Variation Order</option>
                  <option value="DPR">Daily Progress Report</option>
                </optgroup>
                {customCategories.length > 0 && (
                  <optgroup label="Custom Registered Modalities">
                    {customCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ghost uppercase tracking-wider">Approval Routing Roadmap</span>
              <button
                onClick={handleAddStep}
                className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border-subtle text-accent hover:bg-surface-3 transition-colors text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Stage Step
              </button>
            </div>

            <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto pr-1">
              {steps.length === 0 ? (
                <div className="py-8 text-center text-ghost/50 border border-dashed border-border-subtle rounded-xl bg-surface-2/40">
                  No authorization steps configured yet. Click "Add Stage Step" above.
                </div>
              ) : (
                steps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl border border-border-subtle">
                    <span className="w-5 h-5 rounded-full bg-accent/10 border border-accent/20 text-accent text-[10px] font-black flex items-center justify-center font-mono">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <select
                        value={step.role}
                        onChange={(e) => handleStepRoleChange(idx, e.target.value)}
                        className="bg-surface-1 border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-main font-semibold w-full outline-none focus:border-accent"
                      >
                        {roles.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => handleRemoveStep(idx)}
                      className="p-1 text-ghost hover:text-danger rounded hover:bg-danger/5 transition-colors"
                      title="Remove stage step"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-surface-2 border-t border-border-subtle flex items-center justify-end gap-2.5">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-ghost hover:text-main">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-primary text-black font-black hover:brightness-110 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 border border-primary"
          >
            <Check className="w-4 h-4" />
            Save pathway
          </button>
        </div>
      </motion.div>
    </div>
  );
}
