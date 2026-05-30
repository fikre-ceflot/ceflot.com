import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Project, Role, UserProfile } from '../types';
import { 
  Shield, 
  Info, 
  CheckCircle, 
  X, 
  ArrowRight, 
  GitBranch, 
  User, 
  Save, 
  ClipboardList 
} from 'lucide-react';
import { cn, cleanRichText } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface GovernanceProps {
  project: Project;
}

const DEFAULT_ASSETS_SOT = [
  {
    id: "boq",
    name: "Upload BOQ and Assign Trade Codes",
    module_type: "BOQ",
    version: "1.0",
    status: "APPROVED",
    locked: true,
    approved_by: "fikreerp@gmail.com",
    approved_at: "2026-05-24T10:00:00Z",
    checklist_task: "Upload BOQ and Assign Trade Codes"
  },
  {
    id: "budget",
    name: "Establish Budget & Resource Baselines",
    module_type: "PO",
    version: "1.0",
    status: "APPROVED",
    locked: true,
    approved_by: "fikreerp@gmail.com",
    approved_at: "2026-05-25T14:30:00Z",
    checklist_task: "Establish Budget & Resource Baselines"
  },
  {
    id: "schedule",
    name: "Confirm Schedule Recipes",
    module_type: "DPR",
    version: "1.0",
    status: "APPROVED",
    locked: true,
    approved_by: "fikreerp@gmail.com",
    approved_at: "2026-05-26T09:15:00Z",
    checklist_task: "Confirm Schedule Recipes"
  },
  {
    id: "procurement",
    name: "Configure Setup Parameters",
    module_type: "PC",
    version: "1.0",
    status: "DRAFT",
    locked: false,
    checklist_task: "Configure Setup Parameters"
  }
];

const DEFAULT_AUDIT_TRAIL = [
  {
    timestamp: "2026-05-24T10:00:00Z",
    asset: "Upload BOQ and Assign Trade Codes",
    version: "1.0",
    action: "SoT Version Frozen",
    userId: "fikreerp@gmail.com",
    description: "Initial import and allocation of base trade codes validated."
  },
  {
    timestamp: "2026-05-25T14:30:00Z",
    asset: "Establish Budget & Resource Baselines",
    version: "1.0",
    action: "SoT Version Frozen",
    userId: "fikreerp@gmail.com",
    description: "Cost metrics integrated with company templates."
  },
  {
    timestamp: "2026-05-26T09:15:00Z",
    asset: "Confirm Schedule Recipes",
    version: "1.0",
    action: "SoT Version Frozen",
    userId: "fikreerp@gmail.com",
    description: "Activity sequences and production cycles calibrated."
  }
];

export function Governance({ project }: GovernanceProps) {
  const [assetsSot, setAssetsSot] = useState<any[]>(() => {
    const saved = localStorage.getItem(`assets_sot_${project.id}`);
    return saved ? JSON.parse(saved) : DEFAULT_ASSETS_SOT;
  });

  const [amendments, setAmendments] = useState<any[]>(() => {
    const saved = localStorage.getItem(`amendments_${project.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  const [auditTraillogs, setAuditTrailLogs] = useState<any[]>(() => {
    const saved = localStorage.getItem(`audit_logs_${project.id}`);
    return saved ? JSON.parse(saved) : DEFAULT_AUDIT_TRAIL;
  });

  const [showAmendmentModal, setShowAmendmentModal] = useState(false);
  const [selectedAssetForAmendment, setSelectedAssetForAmendment] = useState<any>(null);
  const [amendmentJustification, setAmendmentJustification] = useState('');

  // Persist State
  useEffect(() => {
    localStorage.setItem(`assets_sot_${project.id}`, JSON.stringify(assetsSot));
  }, [assetsSot, project.id]);

  useEffect(() => {
    localStorage.setItem(`amendments_${project.id}`, JSON.stringify(amendments));
  }, [amendments, project.id]);

  useEffect(() => {
    localStorage.setItem(`audit_logs_${project.id}`, JSON.stringify(auditTraillogs));
  }, [auditTraillogs, project.id]);

  // Synchronize a task status best-effort with the db setup checklist
  const syncTaskInSupabase = async (taskName: string, expectedComplete: boolean) => {
    try {
      const { data: tasks, error: fetchErr } = await supabase
        .from('project_setup_tasks')
        .select('*')
        .eq('project_id', project.id);
      if (fetchErr) throw fetchErr;

      if (tasks) {
        const task = tasks.find(t => t.task_name.toLowerCase() === taskName.toLowerCase());
        if (task) {
          await supabase
            .from('project_setup_tasks')
            .update({
              is_complete: expectedComplete,
              completed_at: expectedComplete ? new Date().toISOString() : null,
              by_user: expectedComplete ? "ADMIN_BOT" : null
            })
            .eq('id', task.id);
        }
      }
    } catch (err) {
      console.warn("Sync task error in Governance:", err);
    }
  };

  const handleFreezeBaseline = async (assetId: string) => {
    const targetAsset = assetsSot.find(a => a.id === assetId);
    if (!targetAsset) return;

    const updatedAssets = assetsSot.map((asset) => {
      if (asset.id === assetId) {
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

    // Add audit entry
    const newAudit = {
      timestamp: new Date().toISOString(),
      asset: targetAsset.name,
      version: targetAsset.version || '1.0',
      action: "SoT Version Frozen",
      userId: 'fikreerp@gmail.com',
      description: `Baseline was successfully validated and structurally frozen.`
    };

    setAssetsSot(updatedAssets);
    setAuditTrailLogs([newAudit, ...auditTraillogs]);
    await syncTaskInSupabase(targetAsset.checklist_task, true);
    alert(`${targetAsset.name} is now structurally frozen as the active Source of Truth.`);
  };

  const handleRevokeBaseline = async (assetId: string) => {
    const targetAsset = assetsSot.find(a => a.id === assetId);
    if (!targetAsset) return;

    const confirmation = window.confirm(`Are you sure you want to revoke sign-off for this baseline? Doing so will unlock standard editing, and instantly reset its completion in the project setup checklist.`);
    if (!confirmation) return;

    const updatedAssets = assetsSot.map((asset) => {
      if (asset.id === assetId) {
        return {
          ...asset,
          status: 'DRAFT',
          locked: false,
          approved_by: null,
          approved_at: null
        };
      }
      return asset;
    });

    // Add audit entry
    const newAudit = {
      timestamp: new Date().toISOString(),
      asset: targetAsset.name,
      version: targetAsset.version || '1.0',
      action: "Baseline Revoked",
      userId: 'fikreerp@gmail.com',
      description: `Approval revoked. Unlocked for modification and corresponding checklist tasks reversed to unchecked state.`
    };

    setAssetsSot(updatedAssets);
    setAuditTrailLogs([newAudit, ...auditTraillogs]);
    await syncTaskInSupabase(targetAsset.checklist_task, false);
    alert(`${targetAsset.name} has been unlocked successfully.`);
  };

  const handleInitiateAmendment = (asset: any) => {
    setSelectedAssetForAmendment(asset);
    setAmendmentJustification('');
    setShowAmendmentModal(true);
  };

  const handleSubmitAmendment = () => {
    if (!amendmentJustification.trim()) {
      alert('A valid change justification is required to initiate an amendment pipeline.');
      return;
    }

    const nextVer = (parseFloat(selectedAssetForAmendment.version) + 0.1).toFixed(1);
    const newAmendment = {
      id: 'amend_' + Math.random().toString(36).substr(2, 9),
      asset_id: selectedAssetForAmendment.id,
      asset_name: selectedAssetForAmendment.name,
      original_version: selectedAssetForAmendment.version,
      new_version: nextVer,
      justification: amendmentJustification,
      requester_id: 'fikreerp@gmail.com',
      requester_name: 'Fikre PM',
      status: 'pending',
      created_at: new Date().toISOString(),
      decided_at: null,
      decided_by: null
    };

    const newAudit = {
      timestamp: new Date().toISOString(),
      asset: selectedAssetForAmendment.name,
      version: nextVer,
      action: "Amendment Initiated",
      userId: 'fikreerp@gmail.com',
      description: `Request for v${nextVer} submitted. Justification: "${amendmentJustification}"`
    };

    setAmendments([newAmendment, ...amendments]);
    setAuditTrailLogs([newAudit, ...auditTraillogs]);
    setShowAmendmentModal(false);
    setSelectedAssetForAmendment(null);
    setAmendmentJustification('');
    alert('Formal change request submitted successfully. It has been routed to the governance queue below.');
  };

  const handleDecideAmendment = async (amendmentId: string, decision: 'approved' | 'rejected') => {
    const am = amendments.find(a => a.id === amendmentId);
    if (!am) return;

    const decisionConfirmation = window.confirm(`Confirm your choice to ${decision} the amendment request for "${am.asset_name}"?`);
    if (!decisionConfirmation) return;

    // Update amendment status
    const updatedAmendments = amendments.map(a => {
      if (a.id === amendmentId) {
        return {
          ...a,
          status: decision,
          decided_at: new Date().toISOString(),
          decided_by: 'fikreerp@gmail.com'
        };
      }
      return a;
    });

    // If approved, update active baseline version & lock it
    let updatedAssets = [...assetsSot];
    if (decision === 'approved') {
      updatedAssets = assetsSot.map(asset => {
        if (asset.id === am.asset_id) {
          return {
            ...asset,
            version: am.new_version,
            status: 'APPROVED',
            locked: true,
            approved_by: 'fikreerp@gmail.com',
            approved_at: new Date().toISOString()
          };
        }
        return asset;
      });
    }

    // Add audit entry
    const newAudit = {
      timestamp: new Date().toISOString(),
      asset: am.asset_name,
      version: am.new_version,
      action: decision === 'approved' ? "Amendment Approved" : "Amendment Rejected",
      userId: 'fikreerp@gmail.com',
      description: decision === 'approved' 
        ? `Amendment approved. Generated and locked new version: v${am.new_version}. Original remains immutable.` 
        : `Amendment request for version v${am.new_version} rejected.`
    };

    setAmendments(updatedAmendments);
    if (decision === 'approved') {
      setAssetsSot(updatedAssets);
      const targetAsset = assetsSot.find(a => a.id === am.asset_id);
      if (targetAsset) {
        await syncTaskInSupabase(targetAsset.checklist_task, true);
      }
    }
    setAuditTrailLogs([newAudit, ...auditTraillogs]);
    alert(`Change request successfully ${decision}.`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 px-1 mb-2">
        <div className="flex flex-col gap-0.5 md:mt-auto">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-black text-ghost uppercase tracking-[0.3em]">Project Integrity & Compliance</span>
          </div>
          <h1 className="text-[19px] font-black tracking-tight text-main -ml-0.5">{cleanRichText(project.name)}</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-2 text-[10px] font-bold text-ghost">
              <span>Code: <span className="text-dim font-bold font-mono">{project.project_code}</span></span>
              <span>•</span>
              <span>Type: <span className="text-dim font-bold">{project.project_type}</span></span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 animate-in fade-in duration-300">
        
        {/* Top Intro card */}
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
            <Shield className="w-32 h-32 text-primary" />
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Shield className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-main">Governance, SoT Version Lock & Change Matrices</h2>
              <p className="text-xs text-dim mt-0.5">Enforce audit trails and immutability for approved project milestones</p>
            </div>
          </div>
          <p className="text-xs text-dim leading-relaxed max-w-4xl">
            Upon final approval, core parameters, BOQ items, trade structures, and milestones secure an instant lock state as the official Source of Truth (SoT). Restrictive roles are enforced. Standard dashboards across the platform will reference this active frozen version. Revisions require a formal amendment pipeline with justificatory matrices, generating an independent version index without modifying existing logs.
          </p>
        </div>

        {/* 1. Base Modalities & Lock Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {assetsSot.map((asset) => (
            <div key={asset.id} className={cn(
              "bg-surface-1 border rounded-2xl p-5 flex flex-col justify-between transition-all relative overflow-hidden",
              asset.status === 'APPROVED' ? "border-primary/20 bg-primary/[0.01]/10" : "border-border-subtle bg-surface-1/40"
            )}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-ghost uppercase tracking-widest">{asset.module_type || 'Custom'} Baseline</span>
                  <h3 className="text-sm font-bold text-main flex items-center gap-2">
                    {asset.name}
                    {asset.status === 'APPROVED' ? (
                      <span className="px-1.5 py-0.5 text-[9px] font-black rounded bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest flex items-center gap-1">
                        🔒 v{asset.version}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 text-[9px] font-black rounded bg-warning/10 text-warning border border-warning/20 uppercase tracking-widest">
                        🔓 DRAFT
                      </span>
                    )}
                  </h3>
                  <div className="text-[11px] text-ghost leading-relaxed">
                    Connected Task: <span className="text-dim font-bold">{asset.checklist_task}</span>
                  </div>
                </div>

                <div className={cn(
                  "px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider shadow-sm",
                  asset.status === 'APPROVED' ? "bg-primary/15 border-primary/20 text-primary" : "bg-warning/15 border-warning/20 text-warning"
                )}>
                  {asset.status === 'APPROVED' ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      Locked SoT
                    </>
                  ) : (
                    <>
                      <Info className="w-3.5 h-3.5" />
                      Draft Base
                    </>
                  )}
                </div>
              </div>

              {/* Approval Metadata */}
              {asset.status === 'APPROVED' && (
                <div className="mt-4 pt-3.5 border-t border-border-subtle/40 flex items-center justify-between text-[10px] text-ghost">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 text-primary" />
                    <span>Freezer ID: <span className="text-main font-semibold">{asset.approved_by}</span></span>
                  </div>
                  <div>
                    <span>Approved: <span className="text-main font-semibold">{new Date(asset.approved_at).toLocaleString()}</span></span>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-5 flex gap-2 justify-end">
                {asset.status === 'APPROVED' ? (
                  <>
                    <button
                      onClick={() => handleInitiateAmendment(asset)}
                      className="px-4 py-2 rounded-xl bg-accent text-white hover:brightness-110 text-[10.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-[0_2px_10px_rgba(240,74,90,0.15)]"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      Request Revision
                    </button>
                    <button
                      onClick={() => handleRevokeBaseline(asset.id)}
                      className="px-4 py-2 rounded-xl border border-danger/30 text-danger hover:bg-danger/10 text-[10.5px] font-bold uppercase tracking-wider transition-all"
                    >
                      Revoke Sign-off
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleFreezeBaseline(asset.id)}
                    className="px-5 py-2 rounded-xl bg-primary text-black font-black hover:brightness-110 text-[10.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border border-primary"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Freeze & Lock
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 2. Amendment & Change Requests Log */}
        <div className="bg-surface-1 border border-border-subtle rounded-2xl overflow-hidden mt-2">
          <div className="px-6 py-4.5 border-b border-border-subtle bg-surface-2 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black text-main uppercase tracking-widest flex items-center gap-1.5">
                <GitBranch className="w-4 h-4 text-accent" />
                Change request pipelines & active amendments
              </h3>
              <p className="text-[10px] text-ghost mt-0.5 font-medium">Evaluate and approve adjustments to locked baseline specifications</p>
            </div>
            <span className="bg-accent/10 text-accent border border-accent/20 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              {amendments.filter(a => a.status === 'pending').length} Pending
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-1 border-b border-border-subtle">
                  <th className="font-mono text-[9px] uppercase tracking-widest text-dim px-6 py-3">Asset</th>
                  <th className="font-mono text-[9px] uppercase tracking-widest text-dim px-6 py-3">Versions</th>
                  <th className="font-mono text-[9px] uppercase tracking-widest text-dim px-6 py-3">Justification Matrix</th>
                  <th className="font-mono text-[9px] uppercase tracking-widest text-dim px-6 py-3">Identity / Time</th>
                  <th className="font-mono text-[9px] uppercase tracking-widest text-dim px-6 py-3">State</th>
                  <th className="px-6 py-3 text-right font-mono text-[9px] uppercase tracking-widest text-dim">Verification Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50 text-xs text-dim">
                {amendments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-dim font-medium">
                      No formal change requests have been initiated. Create a revision on a locked asset to populate this register.
                    </td>
                  </tr>
                ) : (
                  amendments.map((am) => (
                    <tr key={am.id} className="hover:bg-white/[0.005]">
                      <td className="px-6 py-4 font-bold text-main">{am.asset_name}</td>
                      <td className="px-6 py-4 font-mono font-semibold text-ghost flex items-center gap-1.5">
                        <span>v{am.original_version}</span>
                        <ArrowRight className="w-3 h-3 text-dim" />
                        <span className="text-primary font-bold">v{am.new_version}</span>
                      </td>
                      <td className="px-6 py-4 text-dim max-w-xs truncate" title={am.justification}>
                        {am.justification}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-main font-semibold flex items-center gap-1">
                            <User className="w-2.5 h-2.5 text-accent" />
                            {am.requester_name || am.requester_id}
                          </span>
                          <span className="text-[10px] text-ghost">{new Date(am.created_at).toLocaleDateString()} {new Date(am.created_at).toLocaleTimeString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border",
                          am.status === 'pending' ? "bg-warning/10 text-warning border-warning/20" :
                          am.status === 'approved' ? "bg-primary/10 text-primary border-primary/20" :
                          "bg-danger/10 text-danger border-danger/20"
                        )}>
                          {am.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {am.status === 'pending' ? (
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => handleDecideAmendment(am.id, 'rejected')}
                              className="px-2.5 py-1 rounded bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 text-[10px] font-black uppercase tracking-wider transition-all"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleDecideAmendment(am.id, 'approved')}
                              className="px-2.5 py-1 rounded bg-primary text-black hover:brightness-110 text-[10px] font-black uppercase tracking-wider transition-all border border-primary"
                            >
                              Approve & Increment
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-ghost">
                            Decided: {new Date(am.decided_at || '').toLocaleDateString()}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Audit Log Matrix */}
        <div className="bg-surface-1 border border-border-subtle rounded-2xl overflow-hidden mt-2">
          <div className="px-6 py-4.5 border-b border-border-subtle bg-surface-2 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black text-main uppercase tracking-widest flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-primary" />
                Immutable governance audit history
              </h3>
              <p className="text-[10px] text-ghost mt-0.5 font-medium font-mono">CRITICAL SECURITY ENCRYPTED FOOTPRINT ENFORCED</p>
            </div>
            <div className="text-[8px] font-bold py-1 px-2.5 rounded bg-surface-3 border border-border-subtle text-ghost tracking-widest uppercase">
              SHA-256 SECURED LOG
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-[10px]">
              <thead>
                <tr className="bg-surface-1 border-b border-border-subtle">
                  <th className="text-dim px-6 py-3 uppercase tracking-wider">Timestamp</th>
                  <th className="text-dim px-6 py-3 uppercase tracking-wider">Asset Modality</th>
                  <th className="text-dim px-6 py-3 uppercase tracking-wider">Version</th>
                  <th className="text-dim px-6 py-3 uppercase tracking-wider">Action Type</th>
                  <th className="text-dim px-6 py-3 uppercase tracking-wider">Security Identity</th>
                  <th className="text-dim px-6 py-3 uppercase tracking-wider">Justification Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50 text-dim">
                {auditTraillogs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.005] leading-relaxed font-mono">
                    <td className="px-6 py-3 text-ghost whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-6 py-3 text-main font-bold">{log.asset}</td>
                    <td className="px-6 py-3 text-primary font-bold">v{log.version}</td>
                    <td className="px-6 py-3">
                      <span className={cn(
                        "px-1.5 py-0.25 rounded text-[8px] font-black uppercase border tracking-tighter col-span-1",
                        log.action.includes('Frozen') ? "bg-primary/10 text-primary border-primary/20" :
                        log.action.includes('Approved') ? "bg-accent/10 text-accent border-accent/20" :
                        "bg-warning/10 text-warning border-warning/20"
                      )}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-main font-semibold whitespace-nowrap">{log.userId}</td>
                    <td className="px-6 py-3 text-dim max-w-sm truncate" title={log.description}>{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Revision Request Modal */}
        <AnimatePresence>
          {showAmendmentModal && selectedAssetForAmendment && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative"
              >
                <div className="px-6 py-4.5 border-b border-border-subtle flex items-center justify-between bg-surface-2">
                  <h3 className="text-sm font-black text-main uppercase tracking-wider flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-accent" />
                    Request Version Amendment
                  </h3>
                  <button onClick={() => setShowAmendmentModal(false)} className="p-1.5 hover:bg-border-subtle rounded-lg text-ghost">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5 p-3.5 bg-surface-2 rounded-xl border border-border-subtle/40">
                    <span className="text-[10px] font-bold text-ghost uppercase tracking-wider">Asset Baseline Target</span>
                    <span className="text-xs font-black text-main">{selectedAssetForAmendment.name}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-ghost">Active Version: <span className="font-bold font-mono">v{selectedAssetForAmendment.version}</span></span>
                      <ArrowRight className="w-2.5 h-2.5 text-dim" />
                      <span className="text-[10px] text-primary">New Incremented Version: <span className="font-bold font-mono">v{(parseFloat(selectedAssetForAmendment.version) + 0.1).toFixed(1)}</span></span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-ghost uppercase tracking-wider">Formal Amendment Justification Matrix</label>
                    <textarea
                      value={amendmentJustification}
                      onChange={(e) => setAmendmentJustification(e.target.value)}
                      placeholder="Input comprehensive technical and procurement justification (e.g., Raw steel tariffs increased spot price by +12%, requiring revised trade rate allocations.)"
                      rows={4}
                      className="bg-surface-2 border border-border-subtle rounded-xl p-3.5 text-xs text-main placeholder-ghost outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all leading-relaxed custom-scrollbar font-sans resize-none"
                    />
                    <span className="text-[9px] text-ghost font-mono">A permanent, immutably recorded change footprint will be logged upon submission.</span>
                  </div>
                </div>

                <div className="px-6 py-4 bg-surface-2 border-t border-border-subtle flex items-center justify-end gap-2.5">
                  <button 
                    onClick={() => setShowAmendmentModal(false)}
                    className="px-4 py-2 text-xs font-bold text-ghost hover:text-main"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSubmitAmendment}
                    className="px-5 py-2 rounded-xl bg-accent text-white font-black hover:brightness-110 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-[0_2px_10px_rgba(240,74,90,0.25)]"
                  >
                    <Save className="w-4 h-4" />
                    Submit Request
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
