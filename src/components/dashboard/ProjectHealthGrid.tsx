import React from 'react';
import { Project } from '../../types';
import { DashboardPanel } from './DashboardPanel';
import { Activity, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ProjectHealthGridProps {
  projects: Project[];
  onSelectProject: (id: string) => void;
}

export function ProjectHealthGrid({ projects, onSelectProject }: ProjectHealthGridProps) {
  return (
    <DashboardPanel 
      title="Project Health & Performance" 
      subtitle="Portfolio Execution Status"
      icon={Activity}
      className="lg:col-span-2"
    >
      <div className="flex flex-col gap-4">
        {projects.length === 0 ? (
          <div className="py-12 text-center text-dim text-sm italic">No active projects found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((project) => (
              <div 
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className="bg-surface-2/50 border border-border-subtle rounded-xl p-4 hover:border-accent/30 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-main group-hover:text-accent transition-colors">{project.name}</span>
                    <span className="text-[10px] text-dim font-mono">{project.project_code}</span>
                  </div>
                  <div className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
                    project.status === 'active' ? "bg-primary/10 text-primary border-primary/20" : "bg-dim/10 text-dim border-dim/20"
                  )}>
                    {project.status}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                      <span className="text-dim">Schedule Progress</span>
                      <span className="text-main">{project.progress_pct || 0}%</span>
                    </div>
                    <div className="h-1.5 bg-surface-1 rounded-full overflow-hidden border border-border-subtle">
                      <div className="h-full bg-accent" style={{ width: `${project.progress_pct || 0}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3 h-3 text-primary" />
                      <span className="text-[10px] font-bold text-dim uppercase">On Track</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] text-dim uppercase">Budget</span>
                        <span className="text-[10px] font-mono font-bold text-main">
                          ${(project.contract_value / 1000000).toFixed(1)}M
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardPanel>
  );
}
