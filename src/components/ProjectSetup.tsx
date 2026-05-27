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

type SetupTab = 'checklist' | 'parameters' | 'staff' | 'approvals';

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

  // Approval Chain state
  const [approvalChains, setApprovalChains] = useState<any[]>([]);
  const [isApprovalsLoading, setIsApprovalsLoading] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [editingChain, setEditingChain] = useState<any>(null);

  useEffect(() => {
    loadTasks();
    if (activeTab === 'parameters') setEditData({ ...project });
    if (activeTab === 'staff') loadStaff();
    if (activeTab === 'approvals') loadApprovals();
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

  const toggleStaff = async (user: UserProfile) => {
    const isMember = projectMembers.some(m => m.user_id === user.id);
    
    try {
      if (isMember) {
        const { error } = await supabase
          .from('project_members')
          .delete()
          .match({ project_id: project.id, user_id: user.id });
        
        if (error) throw error;
        setProjectMembers(prev => prev.filter(m => m.user_id !== user.id));
      } else {
        const { data, error } = await supabase
          .from('project_members')
          .insert([{
            project_id: project.id,
            tenant_id: project.tenant_id,
            user_id: user.id,
            assigned_role: user.role
          }])
          .select()
          .single();
          
        if (error) throw error;
        setProjectMembers(prev => [...prev, data]);
      }
    } catch (e: any) {
      alert('Error updating assignment: ' + e.message);
    }
  };

  const loadApprovals = async () => {
    setIsApprovalsLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_approval_chains')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at');
      
      if (error) throw error;
      setApprovalChains(data || []);
    } catch (e: any) {
      console.error('Error loading approvals:', e);
    } finally {
      setIsApprovalsLoading(false);
    }
  };

  const handleSaveApprovalChain = async (chainData: any) => {
    try {
      if (editingChain) {
        const { error } = await supabase
          .from('project_approval_chains')
          .update(chainData)
          .eq('id', editingChain.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('project_approval_chains')
          .insert({
            ...chainData,
            project_id: project.id,
            tenant_id: project.tenant_id
          });
        if (error) throw error;
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
      const { error } = await supabase
        .from('project_approval_chains')
        .delete()
        .eq('id', id);
      if (error) throw error;
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
                  
                  {task.is_complete && task.completed_at && (
                    <div className="flex items-center gap-3 mt-1">
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
    return (
      <div className="flex flex-col gap-6">
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-main">Staff Assignments</h2>
                <p className="text-sm text-dim">Assign company personnel to this project team</p>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
              <input 
                type="text"
                placeholder="Search team members..."
                className="bg-surface-2 border border-border-subtle rounded-xl py-2 pl-9 pr-4 text-xs outline-none focus:border-primary w-64"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isStaffLoading ? (
              Array(6).fill(0).map((_, i) => (
                <div key={i} className="h-20 bg-surface-2 animate-pulse rounded-xl border border-border-subtle" />
              ))
            ) : tenantUsers.length === 0 ? (
              <div className="col-span-full py-12 text-center text-ghost">
                No company users found. Add users in User Management first.
              </div>
            ) : (
              tenantUsers.map((user) => {
                const isAssigned = projectMembers.some(m => m.user_id === user.id);
                return (
                  <button 
                    key={user.id}
                    onClick={() => toggleStaff(user)}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-xl border transition-all text-left",
                      isAssigned 
                        ? "bg-primary/5 border-primary/20" 
                        : "bg-surface-2 border-border-subtle hover:border-ghost"
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-surface-1 border border-border-subtle flex items-center justify-center text-primary font-bold relative">
                      {user.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                      {isAssigned && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center border-2 border-surface-1">
                          <Check className="w-3 h-3 text-surface-base stroke-[4]" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col min-w-0">
                      <span className="text-sm font-bold text-main truncate">{user.full_name}</span>
                      <span className="text-[10px] text-ghost uppercase tracking-wider font-bold">
                        {user.role?.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
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
            />
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
        <button 
          onClick={() => setActiveTab('staff')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
            activeTab === 'staff' ? "bg-surface-2 text-warning shadow-sm" : "text-ghost hover:text-main"
          )}
        >
          <Users className="w-4 h-4" />
          Staff Assignments
        </button>
        <button 
          onClick={() => setActiveTab('approvals')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
            activeTab === 'approvals' ? "bg-surface-2 text-primary shadow-sm" : "text-ghost hover:text-main"
          )}
        >
          <GitBranch className="w-4 h-4" />
          Approval Chains
        </button>
      </div>

      {activeTab === 'checklist' && renderChecklist()}
      {activeTab === 'parameters' && renderParameters()}
      {activeTab === 'staff' && renderStaff()}
      {activeTab === 'approvals' && renderApprovals()}

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

const ApprovalChainModal = ({ chain, onClose, onSave }: { chain: any; onClose: () => void; onSave: (data: any) => void }) => {
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
              <option value="PO">Purchase Order</option>
              <option value="PC">Payment Certificate</option>
              <option value="VO">Variation Order</option>
              <option value="DPR">Daily Progress Report</option>
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
