import React, { useState } from 'react';
import { Package, BookOpen, Truck, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import { ResourceLibrary } from './ResourceLibrary';
import { TradeLibrary } from './TradeLibrary';
import SupplierLibrary from './SupplierLibrary';
import { SubcontractorLibrary } from './SubcontractorLibrary';

interface LibraryProps {
  userRole: string;
  tenantId: string;
  isGodMode: boolean;
}

export function Library({ userRole, tenantId, isGodMode }: LibraryProps) {
  const [activeTab, setActiveTab] = useState<'resources' | 'trades' | 'suppliers' | 'partners'>('resources');

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex items-center justify-between bg-surface-1 border border-border-subtle p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('resources')}
          className={cn(
            "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === 'resources' 
              ? "bg-primary text-surface-base shadow-lg" 
              : "text-dim hover:text-main"
          )}
        >
          <Package className="w-4 h-4" />
          Resource Library
        </button>
        <button
          onClick={() => setActiveTab('trades')}
          className={cn(
            "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === 'trades' 
              ? "bg-primary text-surface-base shadow-lg" 
              : "text-dim hover:text-main"
          )}
        >
          <BookOpen className="w-4 h-4" />
          Trade Library
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={cn(
            "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === 'suppliers' 
              ? "bg-primary text-surface-base shadow-lg" 
              : "text-dim hover:text-main"
          )}
        >
          <Truck className="w-4 h-4" />
          Supplier Library
        </button>
        <button
          onClick={() => setActiveTab('partners')}
          className={cn(
            "flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all",
            activeTab === 'partners' 
              ? "bg-primary text-surface-base shadow-lg" 
              : "text-dim hover:text-main"
          )}
        >
          <Users className="w-4 h-4" />
          Partner Network
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'resources' ? (
          <ResourceLibrary userRole={userRole} tenantId={tenantId} isGodMode={isGodMode} />
        ) : activeTab === 'trades' ? (
          <TradeLibrary userRole={userRole} tenantId={tenantId} isGodMode={isGodMode} />
        ) : activeTab === 'suppliers' ? (
          <SupplierLibrary userRole={userRole} tenantId={tenantId} isGodMode={isGodMode} />
        ) : (
          <SubcontractorLibrary userRole={userRole} tenantId={tenantId} isGodMode={isGodMode} />
        )}
      </div>
    </div>
  );
}
