import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Project, UserProfile } from '../types';
import { 
  Users, 
  Plus, 
  Trash2, 
  Loader2, 
  UserPlus, 
  Shield, 
  Settings 
} from 'lucide-react';
import { cn } from '../lib/utils';

interface StaffAssignmentProps {
  project: Project;
  userRole: string;
  tenantId: string;
}

export function StaffAssignment({ project, userRole, tenantId }: StaffAssignmentProps) {
  const [tenantUsers, setTenantUsers] = useState<UserProfile[]>([]);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUserToAssign, setSelectedUserToAssign] = useState<string>('');
  const [assignedPosition, setAssignedPosition] = useState<string>('Project Manager');
  const [isAssigning, setIsAssigning] = useState(false);

  // audit trail logs
  const [auditTraillogs, setAuditTrailLogs] = useState<any[]>(() => {
    const saved = localStorage.getItem(`audit_logs_${project.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    loadStaff();
  }, [project.id]);

  const loadStaff = async () => {
    setIsLoading(true);
    try {
      const { data: users, error: uErr } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('full_name');
      
      if (uErr) throw uErr;
      setTenantUsers(users || []);

      const { data: members, error: mErr } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', project.id);
      
      if (mErr) throw mErr;
      setProjectMembers(members || []);
    } catch (e: any) {
      console.error('Error loading staff:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const logAuditAction = (action: string, description: string) => {
    const newLog = {
      timestamp: new Date().toISOString(),
      asset: 'Personnel Integration',
      version: '1.2',
      action,
      userId: 'fikreerp@gmail.com',
      description
    };
    const updatedLogs = [newLog, ...auditTraillogs];
    setAuditTrailLogs(updatedLogs);
    localStorage.setItem(`audit_logs_${project.id}`, JSON.stringify(updatedLogs));
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
          tenant_id: tenantId,
          user_id: user.id,
          assigned_role: assignedPosition
        }])
        .select()
        .single();

      if (error) throw error;
      setProjectMembers(prev => [...prev, data]);
      setSelectedUserToAssign('');
      
      logAuditAction('Staff Assignment', `Assigned ${user.full_name} as ${assignedPosition}`);
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
      
      const user = tenantUsers.find(u => u.id === userId);
      if (user) {
        logAuditAction('Staff Update', `Updated ${user.full_name}'s project position assignment to ${position}`);
      }
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
      
      const user = tenantUsers.find(u => u.id === userId);
      if (user) {
        logAuditAction('Staff Removal', `Revoked ${user.full_name}'s project directory access`);
      }
    } catch (e: any) {
      alert('Error removing member: ' + e.message);
    }
  };

  const assignedUserIds = projectMembers.map(m => m.user_id);
  const unassignedUsers = tenantUsers.filter(u => !assignedUserIds.includes(u.id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-main">Staff Assignments</h1>
        <p className="text-sm text-dim">
          Configure project organizational structures, assign company personnel, and map domain specific roles.
        </p>
      </div>

      {/* Assign New Staff Card */}
      <div className="bg-surface-1 border border-border-subtle rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-main">Add Project Staff</h2>
            <p className="text-sm text-dim">Map tenant personnel directories into active roles on this project</p>
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
            className="btn btn-primary px-6 py-2.5 text-xs h-10 w-full md:w-auto flex items-center justify-center gap-2"
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
              {isLoading ? (
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
                          className="bg-surface-2 border border-border-subtle rounded-xl text-xs py-1.5 px-3 outline-none focus:border-primary text-main transition-all font-bold opacity-90 hover:opacity-100"
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
          Assigned members gain baseline access based on their company role. Use role management inside Settings to define fine-grained security policies.
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
}
