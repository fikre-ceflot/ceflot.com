import React from 'react';
import { Building2, Package, Calculator, Truck, Users } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PortfolioSummaryProps {
  counts: {
    projects: number;
    resources: number;
    trades: number;
    suppliers: number;
    users: number;
  };
  onSelectModule: (id: string) => void;
}

export function PortfolioSummary({ counts, onSelectModule }: PortfolioSummaryProps) {
  const stats = [
    { id: 'projects', label: 'Projects', value: counts.projects, icon: Building2, color: 'text-primary', bg: 'bg-primary/10' },
    { id: 'resources', label: 'Resources', value: counts.resources, icon: Package, color: 'text-accent', bg: 'bg-accent/10' },
    { id: 'trades', label: 'Trade Items', value: counts.trades, icon: Calculator, color: 'text-warning', bg: 'bg-warning/10' },
    { id: 'library', label: 'Suppliers', value: counts.suppliers, icon: Truck, color: 'text-accent-purple', bg: 'bg-accent-purple/10' },
    { id: 'users', label: 'Team', value: counts.users, icon: Users, color: 'text-accent-pink', bg: 'bg-accent-pink/10' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {stats.map((stat) => (
        <button
          key={stat.id}
          onClick={() => onSelectModule(stat.id)}
          className="bg-surface-1 border border-border-subtle rounded-xl p-5 text-left hover:border-accent/50 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center transition-colors", stat.bg, stat.color)}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-dim">Live</div>
          </div>
          <div className="text-2xl font-bold text-main mb-1">{stat.value}</div>
          <div className="text-[11px] font-bold text-dim uppercase tracking-wider">{stat.label}</div>
        </button>
      ))}
    </div>
  );
}
