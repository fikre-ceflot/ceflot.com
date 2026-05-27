import React from 'react';
import { cn } from '../../lib/utils';

interface Tab {
  id: string;
  label: string;
  icon?: React.ElementType;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: any) => void;
  className?: string;
}

export function TabBar({ tabs, activeTab, onChange, className }: TabBarProps) {
  return (
    <div className={cn(
      "flex bg-surface-1 border border-border-subtle p-1 rounded-xl w-full lg:w-fit overflow-x-auto custom-scrollbar",
      className
    )}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap",
              isActive 
                ? "bg-accent text-surface-0 shadow-lg shadow-accent/10" 
                : "text-text-ghost hover:text-text-main"
            )}
          >
            {Icon && <Icon className="w-4 h-4" />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
