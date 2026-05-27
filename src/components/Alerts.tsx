import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, AlertCircle, Info, CheckCircle, X, Filter, Search, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

import { Project } from '../types';

interface AlertsProps {
  tenantId?: string;
  project?: Project;
}

export function Alerts({ tenantId, project }: AlertsProps) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');
  const [search, setSearch] = useState('');
  const [selectedAlert, setSelectedAlert] = useState<any | null>(null);

  useEffect(() => {
    loadAlerts();
  }, [tenantId, filter]);

  const loadAlerts = async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from('alerts')
        .select(`
          *,
          projects(name)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (filter === 'unread') {
        query = query.eq('is_read', false);
      }

      const { data, error } = await query;
      if (error) {
         if (error.message?.includes('projects')) {
            const { data: fallback, error: fErr } = await supabase.from('alerts').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
            if (fErr) throw fErr;
            setAlerts(fallback || []);
         } else {
            throw error;
         }
      } else {
        setAlerts(data || []);
      }
    } catch (e: any) {
      console.error('Error loading alerts:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const markAllAsRead = async () => {
     try {
      const { error } = await supabase
        .from('alerts')
        .update({ is_read: true })
        .eq('tenant_id', tenantId)
        .eq('is_read', false);

      if (error) throw error;
      loadAlerts();
    } catch (e: any) {
      alert('Error marking alerts as read: ' + e.message);
    }
  };

  const clearAll = async () => {
    if (!window.confirm('Are you sure you want to delete all your alerts?')) return;
    try {
      const { error } = await supabase
        .from('alerts')
        .delete()
        .eq('tenant_id', tenantId);

      if (error) throw error;
      setAlerts([]);
    } catch (e: any) {
      alert('Error clearing alerts: ' + e.message);
    }
  };

  const deleteAlert = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('alerts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setAlerts(alerts.filter(a => a.id !== id));
    } catch (e: any) {
      alert('Error deleting alert: ' + e.message);
    }
  };

  const toggleRead = async (id: string, currentStatus: boolean, e: React.MouseEvent) => {
     e.stopPropagation();
     try {
      const { error } = await supabase
        .from('alerts')
        .update({ is_read: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      loadAlerts();
    } catch (e: any) {
      alert('Error updating alert: ' + e.message);
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const filtered = alerts.filter(a => 
    (a.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.message || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.projects?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8 px-1">
        <div className="flex flex-col gap-0.5 md:mt-auto">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-black text-ghost uppercase tracking-[0.3em]">System Monitoring</span>
          </div>
          <h1 className="text-[19px] font-black tracking-tight text-main -ml-0.5">{project?.name || 'Critical System Alerts'}</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-2 text-[10px] font-bold text-ghost">
              <span className="text-danger font-black uppercase tracking-widest decoration-danger/30 underline-offset-4">Alert Dashboard</span>
              <span className="w-1 h-1 rounded-full bg-border-subtle" />
              <span className="px-1.5 py-0.25 rounded bg-surface-2 border border-border-subtle opacity-80">{alerts.filter(a => !a.is_read).length} Unread</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-5">
          <div className="flex flex-col items-end min-w-[120px]">
            <span className="text-[8px] font-bold text-ghost uppercase tracking-[0.2em] mb-1 opacity-60">Reference ID</span>
            <div className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center w-full">
              <span className="text-xs font-black text-danger tracking-widest">{project?.project_code || 'GLOBAL'}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-surface-1 border border-border-subtle p-1 rounded-lg">
              <button 
                onClick={() => setFilter('unread')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all",
                  filter === 'unread' ? "bg-surface-2 text-primary" : "text-ghost hover:text-dim"
                )}
              >
                Unread ({alerts.filter(a => !a.is_read).length})
              </button>
              <button 
                onClick={() => setFilter('all')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all",
                  filter === 'all' ? "bg-surface-2 text-primary" : "text-ghost hover:text-dim"
                )}
              >
                All
              </button>
            </div>
            <button 
              onClick={markAllAsRead}
              className="btn btn-secondary btn-sm"
              disabled={!alerts.some(a => !a.is_read)}
            >
              Mark all read
            </button>
          </div>
        </div>
      </header>

      <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-surface-2">
          <div className="flex items-center gap-4">
            <button 
              onClick={markAllAsRead}
              className="text-[11px] font-bold uppercase tracking-widest text-primary hover:underline"
            >
              Mark all as read
            </button>
            <button 
              onClick={clearAll}
              className="text-[11px] font-bold uppercase tracking-widest text-danger hover:underline"
            >
              Clear all
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ghost" />
              <input 
                type="text"
                placeholder="Search alerts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-surface-1 border border-border-subtle rounded-md py-1.5 pl-9 pr-3 text-xs outline-none focus:border-primary text-main"
              />
            </div>
            <button className="btn btn-ghost btn-sm text-dim">
              <Filter className="w-4 h-4" />
              Filter
            </button>
          </div>
        </div>

        <div className="divide-y divide-border-subtle">
          {loading ? (
            <div className="py-24 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm text-dim">Syncing real-time alerts...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-24 text-center text-ghost">
              <Bell className="w-10 h-10 opacity-10 mx-auto mb-3" />
              <div className="text-sm font-medium">No new alerts</div>
              <p className="text-xs mt-1">Everything is running smoothly</p>
            </div>
          ) : (
            filtered.map((alert) => (
              <div key={alert.id} className={cn(
                "p-5 flex items-start justify-between hover:bg-white/5 transition-colors group",
                !alert.is_read && "bg-primary/5"
              )}>
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                    alert.type === 'critical' ? "bg-danger/10 text-danger" :
                    alert.type === 'warning' ? "bg-warning/10 text-warning" :
                    "bg-accent/10 text-accent"
                  )}>
                    {alert.type === 'critical' ? <AlertCircle className="w-5 h-5" /> : 
                     alert.type === 'warning' ? <AlertTriangle className="w-5 h-5" /> : 
                     <Info className="w-5 h-5" />}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-bold text-main">{alert.title}</h3>
                      <span className="text-[10px] font-mono text-ghost">{getTimeAgo(alert.created_at)}</span>
                    </div>
                    <p className="text-xs text-ghost leading-relaxed max-w-2xl">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                       <span className="text-[10px] font-bold uppercase tracking-widest text-ghost">{alert.projects?.name || 'Global'}</span>
                       <div className="w-1 h-1 rounded-full bg-border-subtle" />
                       <button 
                         onClick={() => setSelectedAlert(alert)}
                         className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline"
                       >
                         View Details
                       </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!alert.is_read && (
                    <button 
                      onClick={(e) => toggleRead(alert.id, alert.is_read, e)}
                      className="p-1.5 text-primary hover:bg-primary/10 rounded-md transition-colors" title="Mark as read"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={(e) => deleteAlert(alert.id, e)}
                    className="p-1.5 text-ghost hover:bg-surface-2 hover:text-main rounded-md transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {/* Alert Detail Side Panel */}
      {selectedAlert && (
        <div className="fixed inset-0 z-[200] overflow-hidden">
           <div 
             className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
             onClick={() => setSelectedAlert(null)}
           />
           <div className="absolute top-0 right-0 h-full w-full max-w-lg bg-surface-1 border-l border-border-subtle shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <div className="flex items-center justify-between p-6 border-b border-border-subtle bg-surface-base">
                 <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      selectedAlert.type === 'critical' ? "bg-danger/10 text-danger" :
                      selectedAlert.type === 'warning' ? "bg-warning/10 text-warning" :
                      "bg-accent/10 text-accent"
                    )}>
                      {selectedAlert.type === 'critical' ? <AlertCircle className="w-6 h-6" /> : 
                       selectedAlert.type === 'warning' ? <AlertTriangle className="w-6 h-6" /> : 
                       <Info className="w-6 h-6" />}
                    </div>
                    <div>
                       <h3 className="text-lg font-black text-main tracking-tight uppercase">{selectedAlert.type} Alert</h3>
                       <p className="text-[10px] text-ghost font-bold uppercase tracking-widest">{getTimeAgo(selectedAlert.created_at)}</p>
                    </div>
                 </div>
                 <button onClick={() => setSelectedAlert(null)} className="p-2 hover:bg-surface-2 rounded-xl text-ghost">
                    <X className="w-6 h-6" />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                 <div className="mb-8">
                    <div className="text-[10px] font-black uppercase tracking-widest text-ghost mb-2">Subject</div>
                    <div className="text-xl font-black text-main leading-tight">{selectedAlert.title}</div>
                 </div>

                 <div className="mb-8">
                    <div className="text-[10px] font-black uppercase tracking-widest text-ghost mb-2">Message Payload</div>
                    <div className="p-6 bg-surface-2 border border-border-subtle rounded-2xl text-sm text-dim leading-relaxed whitespace-pre-wrap font-medium italic">
                       "{selectedAlert.message}"
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-surface-base border border-border-subtle rounded-2xl">
                       <div className="text-[9px] font-black uppercase tracking-widest text-ghost mb-1">Project</div>
                       <div className="text-xs font-bold text-main">{selectedAlert.projects?.name || 'Global System'}</div>
                    </div>
                    <div className="p-4 bg-surface-base border border-border-subtle rounded-2xl">
                       <div className="text-[9px] font-black uppercase tracking-widest text-ghost mb-1">Severity</div>
                       <div className="text-xs font-bold text-main">{selectedAlert.severity || 'Medium'}</div>
                    </div>
                 </div>

                 {selectedAlert.metadata && Object.keys(selectedAlert.metadata).length > 0 && (
                   <div className="mt-8">
                      <div className="text-[10px] font-black uppercase tracking-widest text-ghost mb-4">Diagnostics Metadata</div>
                      <div className="space-y-2">
                         {Object.entries(selectedAlert.metadata).map(([key, val]) => (
                           <div key={key} className="flex items-center justify-between p-3 bg-surface-2/50 border border-border-subtle rounded-xl">
                              <span className="text-[10px] font-bold text-ghost uppercase">{key}</span>
                              <span className="text-xs font-mono text-main">{String(val)}</span>
                           </div>
                         ))}
                      </div>
                   </div>
                 )}
              </div>

              <div className="p-8 border-t border-border-subtle bg-surface-base flex items-center gap-3">
                 {!selectedAlert.is_read && (
                   <button 
                     onClick={(e) => {
                        toggleRead(selectedAlert.id, false, e as any);
                        setSelectedAlert(null);
                     }}
                     className="flex-1 btn btn-primary h-14 rounded-2xl text-xs font-black tracking-widest shadow-lg shadow-primary/20"
                   >
                      Mark as Resolved
                   </button>
                 )}
                 <button 
                    onClick={() => setSelectedAlert(null)}
                    className="flex-1 btn btn-secondary h-14 rounded-2xl text-xs font-black tracking-widest"
                 >
                    Close
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
