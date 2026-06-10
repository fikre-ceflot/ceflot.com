import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Project, Role, UserProfile } from '../types';
import { 
  CheckCircle2, 
  Circle, 
  ClipboardList, 
  LayoutDashboard, 
  Loader2, 
  Plus, 
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Calendar,
  User,
  Info,
  Settings,
  Users,
  GitBranch,
  Trash2,
  Save,
  Building2,
  MapPin,
  Briefcase,
  DollarSign,
  Hash,
  X,
  Shield,
  Search,
  Check
} from 'lucide-react';
import { cn, cleanRichText } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface SetupTask {
  id: string;
  project_id: string;
  task_name: string;
  description: string | null;
  is_required: boolean;
  is_complete: boolean;
  completed_at: string | null;
  completed_by: string | null;
  display_order: number;
}

interface ProjectSetupProps {
  project: Project;
  onCreateProject?: () => void;
  onUpdate?: (updated: Project) => void;
  onDelete?: () => void;
}

type SetupTab = 'checklist' | 'parameters';

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

export function ProjectSetup({ project, onCreateProject, onUpdate, onDelete }: ProjectSetupProps) {
  const [activeTab, setActiveTab] = useState<SetupTab>('checklist');
  const [tasks, setTasks] = useState<SetupTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parameter Edit state
  const [editData, setEditData] = useState({ ...project });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Staff Assignment state
  const [tenantUsers, setTenantUsers] = useState<UserProfile[]>([]);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [isStaffLoading, setIsStaffLoading] = useState(false);
  const [selectedUserToAssign, setSelectedUserToAssign] = useState<string>('');
  const [assignedPosition, setAssignedPosition] = useState<string>('Project Manager');
  const [isAssigning, setIsAssigning] = useState(false);

  // Approval Chain state
  const [approvalChains, setApprovalChains] = useState<any[]>(() => {
    const saved = localStorage.getItem(`local_approval_chains_${project.id}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [isApprovalsLoading, setIsApprovalsLoading] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [editingChain, setEditingChain] = useState<any>(null);

  // Governance, Custom Categories & Amendments state extension
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem(`custom_categories_${project.id}`);
    return saved ? JSON.parse(saved) : ["Supplier Agreement", "Site Safety Manifest"];
  });

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
  const [newCategoryName, setNewCategoryName] = useState('');

  // Sync Checklist with Source of Truth Assets
  const syncChecklistWithAssets = async () => {
    if (!tasks || tasks.length === 0) return;
    
    let updated = false;
    const nextTasks = [...tasks];
    
    for (let i = 0; i < nextTasks.length; i++) {
      const task = nextTasks[i];
      const matchedAsset = assetsSot.find(a => a.checklist_task.toLowerCase() === task.task_name.toLowerCase());
      
      if (matchedAsset) {
        const expectedComplete = matchedAsset.status === 'APPROVED';
        if (task.is_complete !== expectedComplete) {
          task.is_complete = expectedComplete;
          task.completed_at = expectedComplete ? new Date().toISOString() : null;
          task.completed_by = expectedComplete ? "ADMIN_BOT" : null;
          updated = true;
          
          // update in supabase best effort
          try {
            await supabase
              .from('project_setup_tasks')
              .update({
                is_complete: expectedComplete,
                completed_at: expectedComplete ? new Date().toISOString() : null,
                completed_by: expectedComplete ? (await supabase.auth.getUser()).data.user?.id || 'System' : null
              })
              .eq('id', task.id);
          } catch (e) {
            console.warn("Checklist sync Supabase error", e);
          }
        }
      }
    }
    
    if (updated) {
      setTasks(nextTasks);
    }
  };

  const handleFreezeBaseline = (assetId: string) => {
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

    const targetAsset = assetsSot.find(a => a.id === assetId);
    
    // Add audit entry
    const newAudit = {
      timestamp: new Date().toISOString(),
      asset: targetAsset?.name || 'Asset',
      version: targetAsset?.version || '1.0',
      action: "SoT Version Frozen",
      userId: 'fikreerp@gmail.com',
      description: `Baseline was successfully validated and structurally frozen.`
    };

    setAssetsSot(updatedAssets);
    setAuditTrailLogs([newAudit, ...auditTraillogs]);
    alert(`${targetAsset?.name} is now structurally frozen as the active Source of Truth.`);
  };

  const handleRevokeBaseline = (assetId: string) => {
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

    const targetAsset = assetsSot.find(a => a.id === assetId);

    // Add audit entry
    const newAudit = {
      timestamp: new Date().toISOString(),
      asset: targetAsset?.name || 'Asset',
      version: targetAsset?.version || '1.0',
      action: "Baseline Revoked",
      userId: 'fikreerp@gmail.com',
      description: `Approval revoked. Unlocked for modification and corresponding checklist tasks reversed to unchecked state.`
    };

    setAssetsSot(updatedAssets);
    setAuditTrailLogs([newAudit, ...auditTraillogs]);
    alert(`${targetAsset?.name} has been unlocked successfully.`);
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

  const handleDecideAmendment = (amendmentId: string, decision: 'approved' | 'rejected') => {
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
    }
    setAuditTrailLogs([newAudit, ...auditTraillogs]);
    alert(`Change request successfully ${decision}.`);
  };

  const handleCloneTemplate = (tpl: any) => {
    const chainId = 'chain_' + Math.random().toString(36).substr(2, 9);
    const clonedChain = {
      id: chainId,
      project_id: project.id,
      tenant_id: project.tenant_id,
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
      supabase
        .from('approval_chains')
        .insert({
          chain_name: clonedChain.chain_name,
          module_type: clonedChain.module_type,
          steps_json: clonedChain.steps_json,
          project_id: project.id,
          tenant_id: project.tenant_id
        }).then(({ error }) => {
          if (error) console.warn("Supabase insert template error", error);
        });
    } catch (e) {
      console.warn("Supabase clone error", e);
    }

    setApprovalChains(prev => [...prev, clonedChain]);
    alert(`Successfully cloned standard blueprint: "${tpl.chain_name}" into your project's active approval chains!`);
  };

  const handleRegisterCategory = (catName: string) => {
    const clean = catName.trim();
    if (!clean) return;
    if (customCategories.includes(clean)) {
      alert('This module category has already been registered.');
      return;
    }
    setCustomCategories([...customCategories, clean]);
    alert(`Successfully registered custom module "${clean}" on the fly! It is now fully integrated and available for approval workflows.`);
    setNewCategoryName('');
  };

  // Persist State Extensions
  useEffect(() => {
    localStorage.setItem(`custom_categories_${project.id}`, JSON.stringify(customCategories));
  }, [customCategories, project.id]);

  useEffect(() => {
    localStorage.setItem(`assets_sot_${project.id}`, JSON.stringify(assetsSot));
    syncChecklistWithAssets();
  }, [assetsSot, project.id]);

  useEffect(() => {
    localStorage.setItem(`amendments_${project.id}`, JSON.stringify(amendments));
  }, [amendments, project.id]);

  useEffect(() => {
    localStorage.setItem(`audit_logs_${project.id}`, JSON.stringify(auditTraillogs));
  }, [auditTraillogs, project.id]);

  useEffect(() => {
    loadTasks();
    if (activeTab === 'parameters') setEditData({ ...project });
  }, [project.id, activeTab]);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('project_setup_tasks')
        .select('*')
        .eq('project_id', project.id)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (e: any) {
      console.error('Error loading setup tasks:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async () => {
    setIsStaffLoading(true);
    try {
      // Load all tenant users
      const { data: users, error: uErr } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('tenant_id', project.tenant_id)
        .order('full_name');
      
      if (uErr) throw uErr;
      setTenantUsers(users || []);

      // Load existing project members specifically for THIS project
      const { data: members, error: mErr } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', project.id);
      
      if (mErr) throw mErr;
      setProjectMembers(members || []);
    } catch (e: any) {
      console.error('Error loading staff:', e);
    } finally {
      setIsStaffLoading(false);
    }
  };

  const handleAssignStaff = async () => {
    if (!selectedUserToAssign) return;
    setIsAssigning(true);
    try {
      const user = tenantUsers.find(u => u.id === selectedUserToAssign);
      if (!user) return;

      const { data, error } = await supabase
        .from('project_members')
        .insert([{
          project_id: project.id,
          tenant_id: project.tenant_id,
          user_id: user.id,
          assigned_role: assignedPosition
        }])
        .select()
        .single();

      if (error) throw error;
      setProjectMembers(prev => [...prev, data]);
      setSelectedUserToAssign('');
    } catch (e: any) {
      alert('Error assigning member: ' + e.message);
    } finally {
      setIsAssigning(false);
    }
  };

  const updateMemberPosition = async (userId: string, position: string) => {
    try {
      const { error } = await supabase
        .from('project_members')
        .update({ assigned_role: position })
        .match({ project_id: project.id, user_id: userId });

      if (error) throw error;
      setProjectMembers(prev => prev.map(m => m.user_id === userId ? { ...m, assigned_role: position } : m));
    } catch (e: any) {
      alert('Error updating position: ' + e.message);
    }
  };

  const handleRemoveStaff = async (userId: string) => {
    if (!window.confirm('Are you sure you want to remove this staff member from this project?')) return;
    try {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .match({ project_id: project.id, user_id: userId });

      if (error) throw error;
      setProjectMembers(prev => prev.filter(m => m.user_id !== userId));
    } catch (e: any) {
      alert('Error removing member: ' + e.message);
    }
  };

  const loadApprovals = async () => {
    setIsApprovalsLoading(true);
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
      
      if (error) throw error;

      if (data && data.length > 0) {
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
    } finally {
      setIsApprovalsLoading(false);
    }
  };

  const handleSaveApprovalChain = async (chainData: any) => {
    try {
      // 1. Maintain in localStorage for full responsiveness/offline persistence
      const localChainsStr = localStorage.getItem(`local_approval_chains_${project.id}`);
      let localChains = localChainsStr ? JSON.parse(localChainsStr) : [];

      if (editingChain) {
        // Edit existing
        localChains = localChains.map((c: any) => c.id === editingChain.id ? { ...c, ...chainData } : c);
      } else {
        // Create new
        const newId = chainData.id || 'chain_' + Math.random().toString(36).substr(2, 9);
        localChains.push({
          id: newId,
          project_id: project.id,
          tenant_id: project.tenant_id,
          created_at: new Date().toISOString(),
          ...chainData
        });
      }
      localStorage.setItem(`local_approval_chains_${project.id}`, JSON.stringify(localChains));

      // 2. Sync to Supabase best effort using 'approval_chains' table
      try {
        if (editingChain) {
          const { error } = await supabase
            .from('approval_chains')
            .update(chainData)
            .eq('id', editingChain.id);
          if (error) console.warn("Supabase update chain warning:", error);
        } else {
          const { error } = await supabase
            .from('approval_chains')
            .insert({
              ...chainData,
              project_id: project.id,
              tenant_id: project.tenant_id
            });
          if (error) console.warn("Supabase insert chain warning:", error);
        }
      } catch (dbErr) {
        console.warn("Supabase save chain failed:", dbErr);
      }

      setShowApprovalModal(false);
      setEditingChain(null);
      loadApprovals();
    } catch (e: any) {
      alert('Error saving approval chain: ' + e.message);
    }
  };

  const handleDeleteApprovalChain = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this approval chain?')) return;
    try {
      // 1. Delete from localStorage
      const localChainsStr = localStorage.getItem(`local_approval_chains_${project.id}`);
      if (localChainsStr) {
        const localChains = JSON.parse(localChainsStr);
        const filtered = localChains.filter((c: any) => c.id !== id);
        localStorage.setItem(`local_approval_chains_${project.id}`, JSON.stringify(filtered));
      }

      // 2. Try delete from Supabase using 'approval_chains'
      try {
        const { error } = await supabase
          .from('approval_chains')
          .delete()
          .eq('id', id);
        if (error) console.warn("Supabase delete chain warning:", error);
      } catch (dbErr) {
        console.warn("Supabase delete chain failed:", dbErr);
      }

      loadApprovals();
    } catch (e: any) {
      alert('Error deleting approval chain: ' + e.message);
    }
  };

  const initializeFromGlobal = async () => {
    setIsInitializing(true);
    try {
      // 1. Fetch global checklist matching project type if possible
      const { data: globalChecklist, error: globalError } = await supabase
        .from('global_project_checklists')
        .select('*')
        .eq('is_active', true)
        .ilike('checklist_name', `%${project.project_type}%`)
        .limit(1)
        .single();

      // Fallback
      const { data: fallbackChecklist } = !globalChecklist ? await supabase
        .from('global_project_checklists')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single() : { data: null };

      const targetChecklist = globalChecklist || fallbackChecklist;
      if (!targetChecklist) throw new Error('No global checklist templates found');

      // 2. Map tasks to project_setup_tasks
      const tasksToInsert = targetChecklist.tasks_json.map((task: any, index: number) => ({
        project_id: project.id,
        tenant_id: project.tenant_id,
        task_name: task.task_name || task.name,
        description: task.description,
        is_required: task.required !== false && task.is_required !== false,
        is_complete: false,
        display_order: index
      }));

      // 3. Insert into project_setup_tasks
      const { error: insertError } = await supabase
        .from('project_setup_tasks')
        .insert(tasksToInsert);

      if (insertError) throw insertError;

      await loadTasks();
    } catch (e: any) {
      alert('Error initializing setup: ' + e.message);
    } finally {
      setIsInitializing(false);
    }
  };

  const toggleTaskStatus = async (task: SetupTask) => {
    const nextVal = !task.is_complete;
    try {
      const { error } = await supabase
        .from('project_setup_tasks')
        .update({ 
          is_complete: nextVal,
          completed_at: nextVal ? new Date().toISOString() : null,
          completed_by: nextVal ? (await supabase.auth.getUser()).data.user?.id : null
        })
        .eq('id', task.id);

      if (error) throw error;
      
      setTasks(tasks.map(t => t.id === task.id ? { 
        ...t, 
        is_complete: nextVal,
        completed_at: nextVal ? new Date().toISOString() : null
      } : t));
    } catch (e: any) {
      alert('Error updating task: ' + e.message);
    }
  };

  const handleUpdateProject = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: editData.name,
          project_code: editData.project_code,
          location: editData.location,
          project_type: editData.project_type,
          start_date: editData.start_date,
          end_date: editData.end_date,
          contract_value: editData.contract_value,
          status: editData.status
        })
        .eq('id', project.id);

      if (error) throw error;
      if (onUpdate) onUpdate(editData as Project);
      alert('Project parameters updated successfully.');
    } catch (e: any) {
      alert('Error updating project: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id);

      if (error) throw error;
      if (onDelete) onDelete();
    } catch (e: any) {
      alert('Error deleting project: ' + e.message);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleArchiveProject = async () => {
    const reason = window.prompt('Please provide a reason for archiving (e.g. Completed, Suspended, Cancelled):', 'Completed');
    if (reason === null) return;

    if (!window.confirm(`Are you sure you want to archive this project for the following reason: "${reason}"? It will be moved to the archives and becomes read-only in many views.`)) {
      return;
    }

    setIsArchiving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ 
          status: 'archived',
          notes: (project.notes ? project.notes + '\n\n' : '') + `Archived on ${new Date().toLocaleDateString()} for reason: ${reason}`
        })
        .eq('id', project.id);

      if (error) throw error;
      if (onUpdate) onUpdate({ ...project, status: 'archived' });
      alert('Project archived successfully.');
    } catch (e: any) {
      alert('Error archiving project: ' + e.message);
    } finally {
      setIsArchiving(false);
    }
  };

  const completedCount = tasks.filter(t => t.is_complete).length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  if (loading && activeTab === 'checklist') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-ghost">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm font-medium">Loading project setup checklist...</span>
      </div>
    );
  }

  const renderChecklist = () => {
    if (tasks.length === 0) {
      return (
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-12 text-center flex flex-col items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-surface-2 border border-border-subtle flex items-center justify-center text-ghost">
            <ClipboardList className="w-10 h-10 opacity-20" />
          </div>
          <div className="flex flex-col gap-2 max-w-md">
            <h2 className="text-xl font-bold text-main">Project Setup Not Initialized</h2>
            <p className="text-sm text-dim">
              This project doesn't have a setup checklist yet. Initialize it from the global standard template to begin.
            </p>
          </div>
          <button 
            onClick={initializeFromGlobal}
            disabled={isInitializing}
            className="btn btn-accent px-8"
          >
            {isInitializing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Initialize Setup Checklist
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface-1 border border-border-subtle rounded-2xl p-6 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-bold text-main">Setup Progress</h2>
                <p className="text-sm text-dim">Complete these tasks to transition the project to active status</p>
              </div>
              <div className="text-3xl font-black text-primary">{progress}%</div>
            </div>

            <div className="h-3 bg-surface-2 rounded-full overflow-hidden border border-border-subtle">
              <div 
                className="h-full bg-primary transition-all duration-500 ease-out shadow-[0_0_12px_rgba(0,200,150,0.3)]" 
                style={{ width: `${progress}%` }} 
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-surface-2 rounded-xl p-3 border border-border-subtle">
                <div className="text-[10px] font-mono uppercase tracking-widest text-ghost mb-1">Total Tasks</div>
                <div className="text-xl font-bold text-main">{tasks.length}</div>
              </div>
              <div className="bg-surface-2 rounded-xl p-3 border border-border-subtle">
                <div className="text-[10px] font-mono uppercase tracking-widest text-ghost mb-1">Completed</div>
                <div className="text-xl font-bold text-primary">{completedCount}</div>
              </div>
              <div className="bg-surface-2 rounded-xl p-3 border border-border-subtle">
                <div className="text-[10px] font-mono uppercase tracking-widest text-ghost mb-1">Remaining</div>
                <div className="text-xl font-bold text-warning">{tasks.length - completedCount}</div>
              </div>
            </div>
          </div>

          <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-main flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              Setup Guidelines
            </h3>
            <ul className="flex flex-col gap-3">
              <li className="flex gap-3 text-xs text-dim">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1 flex-shrink-0" />
                All required tasks must be completed before site logging begins.
              </li>
              <li className="flex gap-3 text-xs text-dim">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1 flex-shrink-0" />
                Trade codes must be assigned to at least 90% of BOQ items.
              </li>
              <li className="flex gap-3 text-xs text-dim">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1 flex-shrink-0" />
                Internal budget must be approved by the Finance Manager.
              </li>
            </ul>
          </div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border-subtle bg-surface-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-main">Setup Checklist</h3>
            <span className="text-[10px] font-mono text-ghost uppercase tracking-widest">Standard Template v1.0</span>
          </div>
          <div className="divide-y divide-border-subtle">
            {tasks.map((task) => (
              <div 
                key={task.id}
                className={cn(
                  "p-4 flex items-start gap-4 transition-colors group",
                  task.is_complete ? "bg-primary/5" : "hover:bg-surface-2/10"
                )}
              >
                <button 
                  onClick={() => toggleTaskStatus(task)}
                  className={cn(
                    "mt-0.5 transition-all duration-200",
                    task.is_complete ? "text-primary" : "text-ghost hover:text-primary"
                  )}
                >
                  {task.is_complete ? (
                    <CheckCircle2 className="w-6 h-6 fill-primary/10" />
                  ) : (
                    <Circle className="w-6 h-6" />
                  )}
                </button>
                
                <div className="flex-1 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm font-bold transition-colors",
                      task.is_complete ? "text-dim line-through" : "text-main"
                    )}>
                      {cleanRichText(task.task_name)}
                    </span>
                    {task.is_required && (
                      <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-danger/10 text-danger border border-danger/20">
                        Required
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className={cn(
                      "text-xs leading-relaxed",
                      task.is_complete ? "text-ghost" : "text-dim"
                    )}>
                      {cleanRichText(task.description)}
                    </p>
                  )}

                  {(() => {
                    const matchedAsset = assetsSot.find(a => a.checklist_task.toLowerCase() === task.task_name.toLowerCase());
                    if (matchedAsset) {
                      return (
                        <div className="flex items-center gap-1.5 mt-1.5 text-[10px]">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 font-mono px-2 py-0.5 rounded border uppercase tracking-wide",
                            matchedAsset.status === 'APPROVED' 
                              ? "bg-primary/10 text-primary border-primary/20" 
                              : "bg-warning/10 text-warning border-warning/20"
                          )}>
                            <span className={cn(
                              "w-1.5 h-1.5 rounded-full bg-current",
                              matchedAsset.status === 'APPROVED' ? "" : "animate-pulse"
                            )} />
                            {matchedAsset.status === 'APPROVED' ? `🔒 v${matchedAsset.version} LOCKED` : '🔓 DRAFT UNLOCKED'}
                          </span>
                          <span className="text-secondary">| Auto-synchronized baseline</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {task.is_complete && task.completed_at && (
                    <div className="flex items-center gap-3 mt-1 font-mono">
                      <div className="flex items-center gap-1 text-[10px] text-ghost">
                        <Calendar className="w-3 h-3" />
                        {new Date(task.completed_at).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="text-[10px] font-bold uppercase tracking-widest text-ghost hover:text-main">
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderParameters = () => {
    return (
      <div className="flex flex-col gap-8">
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-8 max-w-4xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-main">Project Parameters</h2>
              <p className="text-sm text-dim">Define core project identifiers and contract details</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-ghost">Project Name</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                <input 
                  type="text"
                  value={editData.name}
                  onChange={(e) => setEditData({...editData, name: e.target.value})}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-primary transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-ghost">Code</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                  <input 
                    type="text"
                    value={editData.project_code || ''}
                    onChange={(e) => setEditData({...editData, project_code: e.target.value})}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-primary transition-all"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-ghost">Type</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                  <select 
                    value={editData.project_type || 'Building'}
                    onChange={(e) => setEditData({...editData, project_type: e.target.value})}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-primary transition-all appearance-none"
                  >
                    <option value="Building">Building</option>
                    <option value="Road">Road</option>
                    <option value="Water">Water</option>
                    <option value="Industrial">Industrial</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-ghost">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                <input 
                  type="text"
                  value={editData.location || ''}
                  onChange={(e) => setEditData({...editData, location: e.target.value})}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-primary transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-ghost">Contract Value (USD)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                <input 
                  type="number"
                  value={editData.contract_value || 0}
                  onChange={(e) => setEditData({...editData, contract_value: parseFloat(e.target.value) || 0})}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm font-mono outline-none focus:border-primary transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-ghost">Start Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                  <input 
                    type="date"
                    value={editData.start_date || ''}
                    onChange={(e) => setEditData({...editData, start_date: e.target.value})}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-primary transition-all"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-ghost">End Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                  <input 
                    type="date"
                    value={editData.end_date || ''}
                    onChange={(e) => setEditData({...editData, end_date: e.target.value})}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-primary transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-ghost">Current Status</label>
              <select 
                value={editData.status}
                onChange={(e) => setEditData({...editData, status: e.target.value as any})}
                className="w-full bg-surface-2 border border-border-subtle rounded-xl py-3 px-4 text-sm outline-none focus:border-primary transition-all appearance-none"
              >
                <option value="planning">Phase 1: Planning / Setup</option>
                <option value="active">Phase 2: Execution / Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed / Handed Over</option>
                <option value="archived">Archived / Suspended</option>
              </select>
            </div>
          </div>

          <div className="mt-10 flex justify-end">
            <button 
              onClick={handleUpdateProject}
              disabled={isSaving}
              className="btn btn-accent px-8"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </div>

        <div className="bg-danger/5 border border-danger/10 rounded-2xl p-8 max-w-4xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center text-danger">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-danger">Danger Zone</h3>
              <p className="text-sm text-ghost">Permanent and destructive actions for this project</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between p-4 bg-surface-1 border border-border-subtle rounded-xl">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-main">Archive Project</span>
                <span className="text-xs text-ghost">Move this project to the archives. It will be hidden from main dashboards but preserved.</span>
              </div>
              <button 
                onClick={handleArchiveProject}
                disabled={isArchiving || project.status === 'archived'}
                className="px-6 py-2.5 rounded-xl bg-accent/10 text-accent border border-accent/20 text-xs font-bold uppercase tracking-widest hover:bg-accent/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isArchiving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-4 h-4" />}
                Archive Project
              </button>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-surface-1 border border-border-subtle rounded-xl">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-main">Delete Entire Project</span>
                <span className="text-xs text-ghost">Remove all BOQ data, site logs, costs, and project members forever.</span>
              </div>
              <button 
                onClick={() => setShowDeleteModal(true)}
                disabled={isDeleting}
                className="px-6 py-2.5 rounded-xl bg-danger/10 text-danger border border-danger/20 text-xs font-bold uppercase tracking-widest hover:bg-danger/20 transition-all flex items-center gap-2"
              >
                {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Destroy Project
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStaff = () => {
    const assignedUserIds = projectMembers.map(m => m.user_id);
    const unassignedUsers = tenantUsers.filter(u => !assignedUserIds.includes(u.id));

    return (
      <div className="flex flex-col gap-6">
        {/* Assign New Staff Card */}
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-main">Staff Assignments</h2>
              <p className="text-sm text-dim">Assign company personnel and define their project-specific responsibilities</p>
            </div>
          </div>

          <div className="bg-surface-2 p-4 rounded-xl border border-border-subtle/60 flex flex-col md:flex-row items-end gap-4 max-w-4xl">
            <div className="flex-1 min-w-0 w-full flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-ghost">Select Team Member</label>
              <select 
                value={selectedUserToAssign}
                onChange={(e) => setSelectedUserToAssign(e.target.value)}
                className="w-full bg-surface-1 border border-border-subtle rounded-xl py-2.5 px-3 text-xs outline-none focus:border-primary text-main"
              >
                <option value="">-- Choose an unassigned employee --</option>
                {unassignedUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.email}) - {user.role?.replace(/_/g, ' ').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full md:w-64 flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-ghost">Project specific position</label>
              <select 
                value={assignedPosition}
                onChange={(e) => setAssignedPosition(e.target.value)}
                className="w-full bg-surface-1 border border-border-subtle rounded-xl py-2.5 px-3 text-xs outline-none focus:border-primary text-main"
              >
                <option value="Project Director">Project Director</option>
                <option value="Project Coordinator">Project Coordinator</option>
                <option value="Project Manager">Project Manager</option>
                <option value="Site Supervisor">Site Supervisor</option>
                <option value="Storeman">Storeman</option>
                <option value="QS">QS</option>
                <option value="Finance Officer">Finance Officer</option>
                <option value="Procurement Officer">Procurement Officer</option>
                <option value="Client Representative">Client Representative</option>
              </select>
            </div>

            <button 
              onClick={handleAssignStaff}
              disabled={isAssigning || !selectedUserToAssign}
              className="btn btn-primary px-6 py-2.5 text-xs h-10 w-full md:w-auto"
            >
              {isAssigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Assign to Team
            </button>
          </div>
        </div>

        {/* Assigned Project Staff Table */}
        <div className="bg-surface-1 border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-border-subtle bg-surface-2 flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase tracking-widest text-ghost">Currently Assigned Project Staff</h3>
            <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              {projectMembers.length} Members
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-1 border-b border-border-subtle">
                  <th className="font-mono text-[10px] uppercase tracking-widest text-dim px-6 py-3.5">Team Member</th>
                  <th className="font-mono text-[10px] uppercase tracking-widest text-dim px-6 py-3.5">Company Role</th>
                  <th className="font-mono text-[10px] uppercase tracking-widest text-dim px-6 py-3.5">Project Assignment Position</th>
                  <th className="px-6 py-3.5 text-right font-mono text-[10px] uppercase tracking-widest text-dim">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/40">
                {isStaffLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-xs text-dim">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2 opacity-50" />
                      Loading staff profile records...
                    </td>
                  </tr>
                ) : projectMembers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-dim text-xs">
                      No personnel currently assigned to this project directory. Select a user above to assign them.
                    </td>
                  </tr>
                ) : (
                  projectMembers.map((member) => {
                    const user = tenantUsers.find(u => u.id === member.user_id);
                    if (!user) return null;
                    return (
                      <tr key={member.id} className="hover:bg-white/[0.01] transition-colors group/row">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-surface-2 border border-border-subtle flex items-center justify-center text-primary font-bold text-xs animate-in fade-in duration-200">
                              {user.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-main">{user.full_name}</span>
                              <span className="text-[10px] text-dim">{user.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-accent/5 text-accent text-[10px] font-bold uppercase tracking-wider border border-accent/10">
                            {user.role?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={member.assigned_role || 'Project Manager'}
                            onChange={(e) => updateMemberPosition(user.id, e.target.value)}
                            className="bg-surface-2 border border-border-subtle rounded-xl text-xs py-1.5 px-3 outline-none focus:border-primary text-main transition-all font-bold"
                          >
                            <option value="Project Director">Project Director</option>
                            <option value="Project Coordinator">Project Coordinator</option>
                            <option value="Project Manager">Project Manager</option>
                            <option value="Site Supervisor">Site Supervisor</option>
                            <option value="Storeman">Storeman</option>
                            <option value="QS">QS</option>
                            <option value="Finance Officer">Finance Officer</option>
                            <option value="Procurement Officer">Procurement Officer</option>
                            <option value="Client Representative">Client Representative</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleRemoveStaff(user.id)}
                            className="p-2 hover:bg-danger/10 text-dim hover:text-danger rounded-lg transition-colors"
                            title="Remove project member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6">
          <h3 className="text-sm font-bold text-main mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-accent" />
            Project Specific Access Overrides
          </h3>
          <p className="text-xs text-ghost mb-6">
            Assigned members gain baseline access based on their company role. Use role management to define project-specific granular capabilities.
          </p>
          <div className="flex justify-end">
            <button className="btn btn-ghost btn-sm gap-2">
              <Settings className="w-4 h-4" />
              Configure Capability Overrides
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderApprovals = () => {
    return (
      <div className="flex flex-col gap-6">

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
                      className="px-3 py-1.5 rounded-lg bg-accent text-white hover:brightness-110 font-black text-[9px] uppercase tracking-wider transition-all self-end"
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
                  className="bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs text-main placeholder-ghost outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-semibold"
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
              className="btn btn-accent btn-sm"
            >
              <Plus className="w-4 h-4" />
              New Approval Chain
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {isApprovalsLoading ? (
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
                <div key={chain.id} className="bg-surface-2 border border-border-subtle rounded-xl p-5 flex items-center justify-between group hover:border-accent transition-all">
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
  };

  const renderGovernance = () => {
    return (
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
                  <tr key={idx} className="hover:bg-white/[0.005] leading-relaxed">
                    <td className="px-6 py-3 text-ghost whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-6 py-3 text-main font-bold">{log.asset}</td>
                    <td className="px-6 py-3 text-primary font-bold">v{log.version}</td>
                    <td className="px-6 py-3">
                      <span className={cn(
                        "px-1.5 py-0.25 rounded text-[8px] font-black uppercase border tracking-tighter",
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
                    <GitBranch className="w-4 h-4 text-accent animate-pulse" />
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
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 px-1 mb-8">
        <div className="flex flex-col gap-0.5 md:mt-auto">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-black text-ghost uppercase tracking-[0.3em]">System Setup & Parameters</span>
          </div>
          <h1 className="text-[19px] font-black tracking-tight text-main -ml-0.5">{cleanRichText(project.name)}</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-2 text-[10px] font-bold text-ghost">
              <span className="text-accent font-black uppercase tracking-widest decoration-accent/30 underline-offset-4">Setup Dashboard</span>
              <span className="w-1 h-1 rounded-full bg-border-subtle" />
              <span className="uppercase">{project.status || 'Planning'}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-5">
          <div className="flex flex-col items-end min-w-[120px]">
            <span className="text-[8px] font-bold text-ghost uppercase tracking-[0.2em] mb-1 opacity-60">Reference ID</span>
            <div className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center w-full">
              <span className="text-xs font-black text-accent tracking-widest">{project.project_code}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onCreateProject && (
              <button 
                onClick={onCreateProject}
                className="btn btn-accent btn-sm"
              >
                <Plus className="w-4 h-4" />
                New Project
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-surface-1 border border-border-subtle p-1 rounded-xl w-full lg:w-fit overflow-x-auto custom-scrollbar whitespace-nowrap">
        <button 
          onClick={() => setActiveTab('checklist')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
            activeTab === 'checklist' ? "bg-surface-2 text-primary shadow-sm" : "text-ghost hover:text-main"
          )}
        >
          <ClipboardList className="w-4 h-4" />
          Setup Checklist
        </button>
        <button 
          onClick={() => setActiveTab('parameters')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
            activeTab === 'parameters' ? "bg-surface-2 text-accent shadow-sm" : "text-ghost hover:text-main"
          )}
        >
          <Settings className="w-4 h-4" />
          Parameters
        </button>
      </div>

      {activeTab === 'checklist' && renderChecklist()}
      {activeTab === 'parameters' && renderParameters()}

      <AnimatePresence>
        {showDeleteModal && (
          <DeleteConfirmationModal 
            onConfirm={handleDeleteProject}
            onClose={() => setShowDeleteModal(false)}
            projectName={project.name}
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
                className="text-accent hover:text-main transition-colors"
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

const DeleteConfirmationModal = ({ onConfirm, onClose, projectName }: { onConfirm: () => void; onClose: () => void; projectName: string }) => {
  const [countdown, setCountdown] = useState(5);
  const [canDelete, setCanDelete] = useState(false);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanDelete(true);
    }
  }, [countdown]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-surface-1 border border-danger/30 rounded-2xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(255,50,50,0.2)]"
      >
        <div className="p-8 flex flex-col items-center text-center gap-6">
          <div className="w-20 h-20 rounded-full bg-danger/10 flex items-center justify-center text-danger animate-pulse">
            <Trash2 className="w-10 h-10" />
          </div>
          
          <div className="flex flex-col gap-2">
            <h3 className="text-xl font-black text-main uppercase tracking-tight">Irreversible Action</h3>
            <p className="text-sm text-dim leading-relaxed">
              You are about to permanently delete <span className="text-main font-bold">"{projectName}"</span>. 
              This will destroy all BOQ items, budget data, site logs, and resources associated with this project.
            </p>
          </div>

          <div className="w-full bg-surface-2 border border-border-subtle rounded-xl p-4 flex flex-col gap-3">
            <div className="text-[10px] font-black text-ghost uppercase tracking-[0.2em]">Safety Delay</div>
            <div className="flex items-center justify-center gap-4">
              {[5, 4, 3, 2, 1].map((num) => (
                <div 
                  key={num}
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-black border transition-all duration-300",
                    countdown === num 
                      ? "bg-danger text-white border-danger scale-110 shadow-lg shadow-danger/20" 
                      : (5 - countdown >= 5 - num + 1)
                        ? "bg-danger/10 text-danger border-danger/20 opacity-40"
                        : "bg-surface-3 text-ghost border-border-subtle"
                  )}
                >
                  {num}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full">
            <button 
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl bg-surface-2 border border-border-subtle text-sm font-bold text-main hover:bg-surface-3 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={onConfirm}
              disabled={!canDelete}
              className={cn(
                "flex-1 px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                canDelete 
                  ? "bg-danger text-white shadow-lg shadow-danger/20 hover:bg-danger/90" 
                  : "bg-danger/10 text-danger/30 cursor-not-allowed border border-danger/10"
              )}
            >
              <Trash2 className="w-4 h-4" />
              Delete Forever
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
