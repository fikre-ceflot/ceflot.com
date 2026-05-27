import React, { useState } from 'react';
import { Clock, Plus, Search, Calendar, FileText, CheckCircle, XCircle, MoreVertical, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { Project } from '../types';

interface EoTClaim {
  id: string;
  reference: string;
  title: string;
  daysRequested: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  date: string;
  reason: string;
}

const SAMPLE_CLAIMS: EoTClaim[] = [
  { id: '1', reference: 'EOT-001', title: 'Inclement Weather - March', daysRequested: 5, status: 'approved', date: '2026-03-25', reason: 'Unusually heavy rainfall prevented site access for 5 working days.' },
  { id: '2', reference: 'EOT-002', title: 'Delayed Site Access - Phase 2', daysRequested: 12, status: 'submitted', date: '2026-04-02', reason: 'Client delayed handover of Phase 2 area by 12 days.' },
];

interface EoTClaimsProps {
  project: Project;
}

export function EoTClaims({ project }: EoTClaimsProps) {
  return (
    <div className="flex flex-col gap-6 text-main ml-[60px]">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8 px-1">
        <div className="flex flex-col gap-0.5 md:mt-auto">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-black text-ghost uppercase tracking-[0.3em]">Temporal Claims</span>
          </div>
          <h1 className="text-[19px] font-black tracking-tight text-main -ml-0.5">{project.name}</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-2 text-[10px] font-bold text-ghost">
              <span className="text-primary font-black uppercase tracking-widest decoration-primary/30 underline-offset-4">Extension of Time (EoT)</span>
              <span className="w-1 h-1 rounded-full bg-border-subtle" />
              <span className="px-1.5 py-0.25 rounded bg-surface-2 border border-border-subtle opacity-80">{SAMPLE_CLAIMS.length} Claims</span>
            </div>
            <div className="h-1 w-1 rounded-full bg-border-subtle" />
            <span className="text-[10px] font-bold text-dim uppercase tracking-wider">{project.status || 'Active'}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-5">
          <div className="flex flex-col items-end min-w-[120px]">
            <span className="text-[8px] font-bold text-ghost uppercase tracking-[0.2em] mb-1 opacity-60">Reference ID</span>
            <div className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center w-full">
              <span className="text-xs font-black text-primary tracking-widest">{project.project_code}</span>
            </div>
          </div>

          <button className="btn btn-accent btn-sm">
            <Plus className="w-4 h-4" />
            New EoT Claim
          </button>
        </div>
      </header>

      <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-surface-2">
          <div className="flex items-center gap-4">
             <div className="text-xs font-bold text-main">Total Days Approved: <span className="text-primary">5 Days</span></div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm text-dim">
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="divide-y divide-border-subtle">
          {SAMPLE_CLAIMS.map((claim) => (
            <div key={claim.id} className="p-5 flex items-center justify-between hover:bg-main/5 transition-colors group">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                  claim.status === 'approved' ? "bg-primary/10 text-primary" : "bg-surface-2 text-dim"
                )}>
                  <Clock className="w-6 h-6" />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono font-bold text-dim bg-surface-2 px-1.5 py-0.5 rounded border border-border-subtle">
                      {claim.reference}
                    </span>
                    <h3 className="text-sm font-bold text-main">{claim.title}</h3>
                  </div>
                  <p className="text-xs text-dim line-clamp-1 max-w-xl">{claim.reason}</p>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="flex flex-col items-end">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-dim">Requested</div>
                  <div className="text-sm font-bold text-warning">{claim.daysRequested} Days</div>
                </div>
                
                <div className={cn(
                  "px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider border",
                  claim.status === 'approved' ? "bg-primary/10 text-primary border-primary/20" :
                  claim.status === 'rejected' ? "bg-error/10 text-error border-error/20" :
                  "bg-surface-2 text-dim border-border-subtle"
                )}>
                  {claim.status}
                </div>
                
                <button className="p-2 text-dim hover:text-main transition-colors">
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
