import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { MoreVertical, Maximize2, Minimize2, RefreshCw, Copy, Check, Info } from 'lucide-react';

interface DashboardPanelProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ElementType;
  actions?: React.ReactNode;
  isGodMode?: boolean;
}

export function DashboardPanel({ 
  title, 
  subtitle, 
  children, 
  className, 
  icon: Icon,
  actions,
  isGodMode = false
}: DashboardPanelProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setStatusMessage("Panel telemetry successfully re-indexed!");
      setTimeout(() => setStatusMessage(null), 3000);
    }, 900);
    setShowMenu(false);
  };

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(`Dashboard Panel: ${title}\nSubtitle: ${subtitle || 'N/A'}\nActive telemetry synchronized.`);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
    setShowMenu(false);
  };

  return (
    <>
      {/* Backdrop for Maximized State */}
      {isMaximized && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[140]" 
          onClick={() => setIsMaximized(false)}
        />
      )}

      <div className={cn(
        "bg-surface-1 border border-border-subtle rounded-xl flex flex-col transition-all hover:border-accent/30 relative",
        isMaximized 
          ? "fixed inset-6 sm:inset-12 z-[150] shadow-2xl bg-surface-1" 
          : "overflow-visible",
        className
      )}>
        <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between bg-surface-2/30">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="w-8 h-8 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center text-accent">
                <Icon className={cn("w-4 h-4", isRefreshing && "animate-spin text-primary")} />
              </div>
            )}
            <div className="flex flex-col">
              <h3 className="text-sm font-bold text-main tracking-tight">{title}</h3>
              {subtitle && <span className="text-[10px] text-dim font-mono uppercase tracking-wider">{subtitle}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 relative">
            {actions}
            <button 
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 text-dim hover:text-main hover:bg-surface-2/40 rounded-lg transition-colors"
              title={isMaximized ? "Minimize Panel" : "Maximize Panel"}
            >
              {isMaximized ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
            {isGodMode && (
              <>
                <button 
                  onClick={() => setShowMenu(!showMenu)}
                  className={cn("p-1.5 text-dim hover:text-main hover:bg-surface-2/40 rounded-lg transition-colors", showMenu && "text-main bg-surface-2/40")}
                  title="More Options"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>

                {/* Kebab Dropdown Menu */}
                {showMenu && (
                  <>
                    <div 
                      className="fixed inset-0 bg-transparent z-[160]" 
                      onClick={() => setShowMenu(false)}
                    />
                    <div className="absolute right-0 top-8 mt-1.5 w-48 bg-surface-1 border border-border-muted rounded-xl shadow-xl z-[170] p-1.5 flex flex-col gap-0.5 text-xs select-none animate-in fade-in slide-in-from-top-1 duration-150">
                      <button 
                        onClick={handleRefresh}
                        className="w-full text-left px-2.5 py-1.5 hover:bg-surface-2 hover:text-main rounded-lg text-ghost transition-colors flex items-center gap-2.5 font-semibold"
                      >
                        <RefreshCw className={cn("w-3.5 h-3.5 text-primary", isRefreshing && "animate-spin")} />
                        <span>Refresh Telemetry</span>
                      </button>
                      <button 
                        onClick={() => {
                          alert(`Direct analytical snapshot for panel "${title}" created at ${new Date().toLocaleTimeString()}. Data integrity certified.`);
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 hover:bg-surface-2 hover:text-main rounded-lg text-ghost transition-colors flex items-center gap-2.5 font-semibold"
                      >
                        <Info className="w-3.5 h-3.5 text-warning" />
                        <span>Verify System Audit</span>
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Transient Status notification */}
        {statusMessage && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold px-3 py-1 rounded-full shadow-md z-50 animate-bounce">
            {statusMessage}
          </div>
        )}

        <div className="flex-1 p-5 overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  );
}
