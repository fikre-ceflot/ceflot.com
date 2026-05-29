import React, { useState } from 'react';
import { Project } from '../types';
import { 
  Building2, 
  MapPin, 
  Calendar, 
  Plus, 
  ChevronRight,
  Archive,
  Layers
} from 'lucide-react';
import { cn } from '../lib/utils';

interface ProjectSelectionProps {
  projects: Project[];
  onSelect: (projectId: string) => void;
  onCreateNew?: () => void;
  canCreate?: boolean;
  pendingModule?: string | null;
}

export function ProjectSelection({ 
  projects, 
  onSelect, 
  onCreateNew, 
  canCreate,
  pendingModule
}: ProjectSelectionProps) {
  const [showArchived, setShowArchived] = useState(false);

  const NAV_ITEMS = [
    { id: 'project-setup', label: 'Project Setup' },
    { id: 'planning', label: 'BOQ Management' },
    { id: 'schedule', label: 'Project Schedule' },
    { id: 'budget', label: 'Cost Breakdown (CBD) & Budget' },
    { id: 'site-app', label: 'Daily Progress' },
    { id: 'approvals', label: 'Approvals' },
    { id: 'alerts', label: 'Alerts' },
    { id: 'variations', label: 'Variations' },
    { id: 'eot', label: 'EoT Claims' },
    { id: 'subcontractors', label: 'Subcontractors' },
    { id: 'procurement', label: 'Procurement' },
    { id: 'warehouse', label: 'Warehouse' },
  ];

  const activeToolLabel = NAV_ITEMS.find(t => t.id === pendingModule)?.label || 'Module';

  const filteredProjects = projects.filter(p => 
    showArchived ? p.status === 'archived' : p.status !== 'archived'
  );

  return (
    <div className="max-w-6xl mx-auto py-4 sm:py-8 px-4">
      <div className="flex flex-col gap-8 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1 sm:gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-main tracking-tight">Select Project</h1>
            <p className="text-dim text-xs sm:text-sm flex items-center gap-2">
              Opening <span className="text-primary font-bold px-2 py-0.5 bg-primary/10 rounded-md border border-primary/20">{activeToolLabel}</span> for:
            </p>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[9px] sm:text-[10px] font-mono text-primary uppercase tracking-widest">Active Search</span>
            </div>
            {canCreate && onCreateNew && !showArchived && (
              <button 
                onClick={onCreateNew}
                className="btn btn-primary btn-sm whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                New Project
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 bg-surface-1 border border-border-subtle p-1 rounded-xl w-full sm:w-fit overflow-x-auto whitespace-nowrap custom-scrollbar">
          <button 
            onClick={() => setShowArchived(false)}
            className={cn(
              "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold transition-all",
              !showArchived ? "bg-surface-2 text-primary shadow-sm" : "text-ghost hover:text-main"
            )}
          >
            <Layers className="w-4 h-4" />
            Active Projects
            <span className={cn(
              "ml-1 px-1.5 py-0.5 rounded text-[10px]",
              !showArchived ? "bg-primary/20 text-primary" : "bg-surface-3 text-ghost"
            )}>
              {projects.filter(p => p.status !== 'archived').length}
            </span>
          </button>
          <button 
            onClick={() => setShowArchived(true)}
            className={cn(
              "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold transition-all",
              showArchived ? "bg-surface-2 text-accent shadow-sm" : "text-ghost hover:text-main"
            )}
          >
            <Archive className="w-4 h-4" />
            Archived
            <span className={cn(
              "ml-1 px-1.5 py-0.5 rounded text-[10px]",
              showArchived ? "bg-accent/20 text-accent" : "bg-surface-3 text-ghost"
            )}>
              {projects.filter(p => p.status === 'archived').length}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {filteredProjects.map((project) => (
            <button
              key={project.id}
              onClick={() => onSelect(project.id)}
              className={cn(
                "group relative flex flex-col bg-surface-1 border border-border-subtle rounded-2xl p-6 text-left transition-all duration-300 overflow-hidden",
                showArchived 
                  ? "hover:border-accent hover:bg-accent/5" 
                  : "hover:border-primary hover:bg-primary/5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)]"
              )}
            >
              <div className="absolute top-0 right-0">
                <div className={cn(
                  "text-surface-base text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-1.5 rounded-bl-xl shadow-lg",
                  project.status === 'archived' ? "bg-accent" : "bg-primary"
                )}>
                  {project.status.replace(/_/g, ' ').toUpperCase()}
                </div>
              </div>

              <div className="flex items-start gap-5 mb-6">
                <div className="w-14 h-14 rounded-xl bg-surface-2 border border-border-subtle flex items-center justify-center text-primary group-hover:bg-primary/10 transition-all duration-300 group-hover:scale-110">
                  <Building2 className="w-7 h-7" />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-main group-hover:text-primary transition-colors truncate">
                      {project.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-ghost">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="text-xs truncate">{project.location || 'No location set'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-6 border-t border-border-subtle/50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-ghost">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(project.created_at).toLocaleDateString()}
                  </div>
                  <div className="w-px h-3 bg-border-subtle" />
                  <div className="text-[11px] font-mono text-ghost uppercase tracking-wider">
                    {project.project_code}
                  </div>
                </div>
                <div className={cn(
                  "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-all translate-x-2 group-hover:translate-x-0",
                  showArchived ? "text-accent" : "text-primary opacity-0 group-hover:opacity-100"
                )}>
                  {showArchived ? 'View Archive' : 'Launch Module'}
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </button>
          ))}

          {filteredProjects.length === 0 && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed border-border-subtle rounded-2xl bg-surface-1/50">
              {showArchived ? (
                <>
                  <Archive className="w-12 h-12 text-border-subtle mb-4" />
                  <p className="text-ghost text-sm">No archived projects found.</p>
                </>
              ) : (
                <>
                  <Building2 className="w-12 h-12 text-border-subtle mb-4" />
                  <p className="text-ghost text-sm">No projects found. Create your first project to get started.</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
