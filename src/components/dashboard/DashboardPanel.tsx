import React from 'react';
import { cn } from '../../lib/utils';
import { MoreVertical, Maximize2 } from 'lucide-react';

interface DashboardPanelProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ElementType;
  actions?: React.ReactNode;
}

export function DashboardPanel({ 
  title, 
  subtitle, 
  children, 
  className, 
  icon: Icon,
  actions 
}: DashboardPanelProps) {
  return (
    <div className={cn(
      "bg-surface-1 border border-border-subtle rounded-xl flex flex-col overflow-hidden transition-all hover:border-accent/30",
      className
    )}>
      <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between bg-surface-2/30">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center text-accent">
              <Icon className="w-4 h-4" />
            </div>
          )}
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-main tracking-tight">{title}</h3>
            {subtitle && <span className="text-[10px] text-dim font-mono uppercase tracking-wider">{subtitle}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <button className="p-1.5 text-dim hover:text-main transition-colors">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 text-dim hover:text-main transition-colors">
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 p-5">
        {children}
      </div>
    </div>
  );
}
