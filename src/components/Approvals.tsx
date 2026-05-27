import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, FileText, User, ArrowRight, Filter, Search, GitBranch, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

import { Project } from '../types';

interface ApprovalsProps {
  tenantId?: string;
  userRole?: string;
  project?: Project;
}

export function Approvals({ tenantId, userRole, project }: ApprovalsProps) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadRequests();
  }, [tenantId, filter]);

  const loadRequests = async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from('approvals')
        .select(`
          *,
          projects (name)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (filter === 'pending') {
        query = query.eq('status', 'pending');
      } else if (filter === 'completed') {
        query = query.neq('status', 'pending');
      }

      const { data, error } = await query;
      
      if (error) {
        // Fallback for missing joins or other schema issues
        if (error.message?.includes('projects')) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('approvals')
            .select('*')
            .eq('tenant_id', tenantId);
          if (fallbackError) throw fallbackError;
          setRequests(fallbackData || []);
        } else {
          throw error;
        }
      } else {
        setRequests(data || []);
      }
    } catch (e: any) {
      console.error('Error loading approvals:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (req: any, status: 'approved' | 'rejected') => {
    const confirmMsg = `Are you sure you want to ${status} this request: "${req.title}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      // 1. Update approval record
      const { error: approvalError } = await supabase
        .from('approvals')
        .update({ 
          status,
          decided_at: new Date().toISOString()
        })
        .eq('id', req.id);

      if (approvalError) throw approvalError;

      // 2. Perform side effects (Client-side implementation of triggers)
      if (req.type === 'budget') {
        await supabase
          .from('projects')
          .update({ budget_status: status === 'approved' ? 'approved' : 'rejected' })
          .eq('id', req.project_id);
      } else if (req.type === 'variation') {
        // Assumption: variation reference is in title or metadata
        // For now, let's just refresh. 
        // In a real system, we'd update the specific variation record.
      }
      
      alert(`Request has been ${status}.`);
      loadRequests();
    } catch (e: any) {
      alert('Error updating approval: ' + e.message);
    }
  };

  const filtered = requests.filter(r => 
    (r.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.requester_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.projects?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8 px-1">
        <div className="flex flex-col gap-0.5 md:mt-auto">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-black text-ghost uppercase tracking-[0.3em]">Governance & Control</span>
          </div>
          <h1 className="text-[19px] font-black tracking-tight text-main -ml-0.5">{project?.name || 'Pending Approvals'}</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-2 text-[10px] font-bold text-ghost">
              <span className="text-primary font-black uppercase tracking-widest decoration-primary/30 underline-offset-4">Approval Dashboard</span>
              <span className="w-1 h-1 rounded-full bg-border-subtle" />
              <span className="px-1.5 py-0.25 rounded bg-surface-2 border border-border-subtle opacity-80">{requests.filter(a => a.status === 'pending').length} Pending Tasks</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-5">
          <div className="flex flex-col items-end min-w-[120px]">
            <span className="text-[8px] font-bold text-ghost uppercase tracking-[0.2em] mb-1 opacity-60">Reference ID</span>
            <div className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center w-full">
              <span className="text-xs font-black text-primary tracking-widest">{project?.project_code || 'GLOBAL'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-surface-1 border border-border-subtle p-1 rounded-lg">
            <button 
              onClick={() => setFilter('pending')}
              className={cn(
                "px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all",
                filter === 'pending' ? "bg-surface-2 text-primary" : "text-dim hover:text-ghost"
              )}
            >
              Pending ({requests.filter(a => a.status === 'pending').length})
            </button>
            <button 
              onClick={() => setFilter('completed')}
              className={cn(
                "px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all",
                filter === 'completed' ? "bg-surface-2 text-primary" : "text-dim hover:text-ghost"
              )}
            >
              Completed
            </button>
            <button 
              onClick={() => setFilter('all')}
              className={cn(
                "px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all",
                filter === 'all' ? "bg-surface-2 text-primary" : "text-dim hover:text-ghost"
              )}
            >
              All
            </button>
          </div>
        </div>
      </header>

      <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border-subtle flex items-center gap-4 bg-surface-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
            <input 
              type="text"
              placeholder="Search requests…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-1 border border-border-subtle rounded-md py-2 pl-10 pr-4 text-sm outline-none focus:border-primary transition-colors text-main"
            />
          </div>
          <button className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ghost hover:text-main text-xs font-bold transition-colors">
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </div>

        <div className="divide-y divide-border-subtle">
          {loading ? (
            <div className="py-24 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm text-ghost">Fetching approval queue...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-24 text-center text-dim">
              <CheckCircle className="w-10 h-10 opacity-10 mx-auto mb-3" />
              <div className="text-sm font-medium">No pending approvals</div>
              <p className="text-xs mt-1">You're all caught up!</p>
            </div>
          ) : (
            filtered.map((req) => (
              <div key={req.id} className="p-5 flex items-center justify-between hover:bg-white/[0.01] transition-colors group">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                    req.type === 'budget' ? "bg-accent/10 text-accent" : "bg-warning/10 text-warning"
                  )}>
                    {req.type === 'budget' ? <FileText className="w-6 h-6" /> : <GitBranch className="w-6 h-6" />}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-dim">{req.type}</span>
                      <h3 className="text-sm font-bold text-main">{req.title}</h3>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-ghost">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" /> {req.requester_name || 'System'}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(req.created_at).toLocaleDateString()}</span>
                      <span className="text-dim">{req.projects?.name || 'Global'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="flex flex-col items-end">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-dim">Value</div>
                    <div className="text-sm font-bold text-main">USD {(req.amount || 0).toLocaleString()}</div>
                  </div>
                  
                  {req.status === 'pending' ? (
                    <div className="flex items-center gap-2">
                       <button 
                        onClick={() => handleDecision(req, 'rejected')}
                        className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors" title="Reject">
                        <XCircle className="w-6 h-6" />
                      </button>
                      <button 
                        onClick={() => handleDecision(req, 'approved')}
                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Approve">
                        <CheckCircle className="w-6 h-6" />
                      </button>
                    </div>
                  ) : (
                    <div className={cn(
                      "px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider border",
                      req.status === 'approved' ? "bg-primary/10 text-primary border-primary/20" : "bg-danger/10 text-danger border-danger/20"
                    )}>
                      {req.status}
                    </div>
                  )}
                  
                  <button className="p-2 text-dim hover:text-main transition-colors">
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
