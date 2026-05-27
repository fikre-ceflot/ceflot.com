import React from 'react';
import { Project } from '../../types';
import { PortfolioSummary } from './PortfolioSummary';
import { ProjectHealthGrid } from './ProjectHealthGrid';
import { CrossProjectFinancials } from './CrossProjectFinancials';
import { RecentActivity } from './RecentActivity';
import { DashboardPanel } from './DashboardPanel';
import { Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';

interface DirectorDashboardProps {
  projects: Project[];
  counts: any;
  onSelectProject: (id: string) => void;
  onSelectModule: (id: string) => void;
}

export function DirectorDashboard({ 
  projects, 
  counts, 
  onSelectProject, 
  onSelectModule 
}: DirectorDashboardProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* Header Section */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-main">Executive Command Center</h1>
          <div className="px-2 py-0.5 bg-accent/10 border border-accent/20 rounded text-[10px] font-bold text-accent uppercase tracking-widest">
            Director View
          </div>
        </div>
        <p className="text-sm text-dim">Real-time portfolio oversight and financial intelligence</p>
      </div>

      {/* Top Stats Row */}
      <PortfolioSummary 
        counts={{
          projects: counts.projects,
          resources: counts.resources_company + counts.resources_global,
          trades: counts.trades_company + counts.trades_global,
          suppliers: counts.suppliers_company + counts.suppliers_global,
          users: counts.users
        }} 
        onSelectModule={onSelectModule}
      />

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Project Health */}
        <ProjectHealthGrid 
          projects={projects} 
          onSelectProject={onSelectProject} 
        />

        {/* Right Column: Financials */}
        <CrossProjectFinancials />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <RecentActivity />

        {/* AI Insights Panel */}
        <DashboardPanel 
          title="Director's Intelligence" 
          subtitle="AI-Powered Portfolio Analysis"
          icon={Sparkles}
          className="lg:col-span-2 border-accent/20 bg-gradient-to-br from-surface-1 to-surface-2"
        >
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-4 p-4 bg-accent/5 border border-accent/10 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-bold text-main">Portfolio Risk Assessment</h4>
                <p className="text-xs text-ghost leading-relaxed">
                  Based on current site logs and variation trends, <span className="text-main font-bold">Project Alpha</span> is showing a 12% increase in resource consumption over the last 7 days. This may impact the Q3 delivery schedule if not addressed.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-main">Optimization Opportunities</span>
                </div>
                <ul className="flex flex-col gap-2">
                  <li className="text-[11px] text-ghost flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-primary" />
                    Bulk purchase of Grade 42.5 Cement could save 8% across 3 projects.
                  </li>
                  <li className="text-[11px] text-ghost flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-primary" />
                    Subcontractor 'BuildRight' is consistently 15% faster than average.
                  </li>
                </ul>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  <span className="text-xs font-bold text-main">Critical Alerts</span>
                </div>
                <ul className="flex flex-col gap-2">
                  <li className="text-[11px] text-ghost flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-warning" />
                    2 Variations pending approval for over 14 days in 'City Mall'.
                  </li>
                  <li className="text-[11px] text-ghost flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-warning" />
                    Weather forecast predicts heavy rain; prepare site drainage.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </DashboardPanel>
      </div>
    </div>
  );
}
