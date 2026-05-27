import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, TrendingUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { usePermissions } from '../hooks/usePermissions';
import { SubcontractorContractManager } from './SubcontractorContractManager';
import { SubcontractorProgress } from './SubcontractorProgress';
import { Project } from '../types';

interface SubcontractorManagementProps {
  userRole: any;
  tenantId: any;
  project: Project | null;
  onSelectProject?: () => void;
}

export function SubcontractorManagement({ userRole, tenantId, project, onSelectProject }: SubcontractorManagementProps) {
  const { hasCapability } = usePermissions(userRole, tenantId);
  const [activeTab, setActiveTab] = useState<'performance' | 'contracts'>('contracts');

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-4 px-1">
        <div className="flex flex-col gap-0.5 md:mt-auto">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-black text-ghost uppercase tracking-[0.3em]">Project Control</span>
          </div>
          <h1 className="text-[19px] font-black tracking-tight text-main -ml-0.5">Subcontractor Oversight</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-2 text-[10px] font-bold text-ghost">
              <span className="text-accent font-black uppercase tracking-widest decoration-accent/30 underline-offset-4">Execution Partners</span>
              <span className="w-1 h-1 rounded-full bg-border-subtle" />
              <span className="px-1.5 py-0.25 rounded bg-surface-2 border border-border-subtle opacity-80">{project?.name || 'All Projects'} Overview</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-5">
          <div className="flex bg-surface-2 p-1 rounded-xl border border-border-subtle shadow-inner">
            <button 
              onClick={() => setActiveTab('contracts')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'contracts' ? "bg-surface-1 text-accent shadow-sm border border-border-subtle" : "text-ghost hover:text-main"
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              Contracts
            </button>
            <button 
              onClick={() => setActiveTab('performance')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'performance' ? "bg-surface-1 text-accent shadow-sm border border-border-subtle" : "text-ghost hover:text-main"
              )}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Performance
            </button>
          </div>
        </div>
      </header>

      {activeTab === 'contracts' ? (
        <SubcontractorContractManager project={project} tenantId={tenantId} onSelectProject={onSelectProject} />
      ) : project ? (
        <SubcontractorProgress projectId={project.id} />
      ) : (
        <div className="py-24 text-center bg-surface-1 border border-dashed border-border-subtle rounded-3xl mx-1 animate-in fade-in duration-700">
          <TrendingUp className="w-12 h-12 text-ghost mx-auto mb-4 opacity-20" />
          <h3 className="text-lg font-black text-main tracking-tight px-1">Project Context Required</h3>
          <p className="text-sm text-dim mt-2 max-w-sm mx-auto">Performance metrics are project-specific. Please select a project to view active subcontractor efficiency.</p>
          <button 
            onClick={onSelectProject}
            className="btn btn-accent btn-sm mt-6 shadow-xl shadow-accent/20"
          >
            Open Project Selection
          </button>
        </div>
      )}
    </div>
  );
}
