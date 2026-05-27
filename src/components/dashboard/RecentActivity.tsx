import React from 'react';
import { DashboardPanel } from './DashboardPanel';
import { History, User, Clock, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';

export function RecentActivity() {
  const activities = [
    { id: 1, user: 'John Doe', action: 'Approved Variation', project: 'Project Alpha', time: '2h ago', type: 'approval' },
    { id: 2, user: 'Sarah Smith', action: 'Submitted Daily Log', project: 'Bridge Construction', time: '4h ago', type: 'submission' },
    { id: 3, user: 'Mike Ross', action: 'Certified IPC #04', project: 'Project Alpha', time: '5h ago', type: 'payment' },
    { id: 4, user: 'Jane Doe', action: 'Updated BOQ', project: 'City Mall', time: '1d ago', type: 'update' },
  ];

  return (
    <DashboardPanel 
      title="Recent Activity" 
      subtitle="System-wide Event Log"
      icon={History}
    >
      <div className="flex flex-col">
        {/* Header - Recipe 1 style */}
        <div className="grid grid-cols-[1fr_2fr_1fr] px-2 py-2 border-b border-border-subtle">
          <span className="text-[10px] font-serif italic text-dim uppercase tracking-wider">User</span>
          <span className="text-[10px] font-serif italic text-dim uppercase tracking-wider">Action / Project</span>
          <span className="text-[10px] font-serif italic text-dim uppercase tracking-wider text-right">Time</span>
        </div>

        <div className="flex flex-col">
          {activities.map((activity) => (
            <div 
              key={activity.id}
              className="grid grid-cols-[1fr_2fr_1fr] px-2 py-3 border-b border-border-subtle last:border-0 hover:bg-surface-2 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-surface-2 border border-border-subtle flex items-center justify-center text-[10px] font-bold text-main">
                  {activity.user.split(' ').map(n => n[0]).join('')}
                </div>
                <span className="text-[11px] font-medium text-main truncate">{activity.user}</span>
              </div>
              
              <div className="flex flex-col">
                <span className="text-[11px] text-main">{activity.action}</span>
                <span className="text-[10px] text-primary font-mono">{activity.project}</span>
              </div>

              <div className="flex flex-col items-end justify-center">
                <span className="text-[10px] text-dim font-mono">{activity.time}</span>
                <ExternalLink className="w-3 h-3 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}
        </div>

        <button className="mt-4 text-[10px] font-bold text-accent uppercase tracking-widest hover:underline text-center">
          View Full Audit Trail
        </button>
      </div>
    </DashboardPanel>
  );
}
