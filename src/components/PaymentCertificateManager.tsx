import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Download,
  ChevronRight,
  ArrowLeft,
  DollarSign,
  User,
  Building2,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { cn, cleanRichText } from '../lib/utils';
import { fetchSubcontractorProgress } from '../services/progressService';

interface PaymentCertificateManagerProps {
  projectId: string;
  tenantId: string;
}

export function PaymentCertificateManager({ projectId, tenantId }: PaymentCertificateManagerProps) {
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCert, setSelectedCert] = useState<any | null>(null);
  
  // Create Modal State
  const [subcontractors, setSubcontractors] = useState<any[]>([]);
  const [selectedSubId, setSelectedSubId] = useState('');
  const [certNo, setCertNo] = useState('');
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadCertificates();
    loadSubcontractors();
  }, [projectId]);

  async function loadCertificates() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_certificates')
        .select(`
          *,
          subcontractors (company_name)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCertificates(data || []);
    } catch (e: any) {
      console.error('Error loading certificates:', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadSubcontractors() {
    try {
      const { data, error } = await supabase
        .from('subcontractors')
        .select('id, company_name')
        .eq('status', 'active');
      if (error) throw error;
      setSubcontractors(data || []);
    } catch (e: any) {
      console.error('Error loading subs:', e.message);
    }
  }

  async function handleCreateCert() {
    if (!selectedSubId || !certNo) return;
    
    try {
      // 1. Create Header
      const { data: cert, error: certError } = await supabase
        .from('payment_certificates')
        .insert({
          project_id: projectId,
          tenant_id: tenantId,
          subcontractor_id: selectedSubId,
          certificate_no: certNo,
          period_end: periodEnd,
          status: 'draft'
        })
        .select()
        .single();

      if (certError) throw certError;

      // 2. Fetch Progress Data to generate items
      const subName = subcontractors.find(s => s.id === selectedSubId)?.company_name;
      const allProgress = await fetchSubcontractorProgress(projectId);
      const progress = allProgress.filter(p => p.subcontractor_name === subName);

      // 3. Fetch Previous IPC for this sub to get previous_qty
      const { data: prevIpc, error: prevError } = await supabase
        .from('payment_certificates')
        .select('id')
        .eq('subcontractor_id', selectedSubId)
        .eq('status', 'certified')
        .lt('created_at', cert.created_at)
        .order('created_at', { ascending: false })
        .limit(1);

      let prevItems: any[] = [];
      if (prevIpc && prevIpc.length > 0) {
        const { data: items } = await supabase
          .from('payment_certificate_items')
          .select('boq_item_id, total_qty_to_date')
          .eq('certificate_id', prevIpc[0].id);
        prevItems = items || [];
      }

      // 4. Generate Items
      const itemsToInsert = progress?.map(p => {
        const prev = prevItems.find(i => i.boq_item_id === p.boq_item_id);
        return {
          certificate_id: cert.id,
          boq_item_id: p.boq_item_id,
          tenant_id: tenantId,
          previous_qty: prev?.total_qty_to_date || 0,
          total_qty_to_date: p.cumulative_progress_qty,
          rate: p.agreed_rate
        };
      }) || [];

      if (itemsToInsert.length > 0) {
        const { error: itemError } = await supabase
          .from('payment_certificate_items')
          .insert(itemsToInsert);
        if (itemError) throw itemError;
      }

      setShowCreateModal(false);
      loadCertificates();
      alert('Payment certificate generated successfully!');
    } catch (e: any) {
      alert('Error creating certificate: ' + e.message);
    }
  }

  if (selectedCert) {
    return <CertificateDetail cert={selectedCert} onBack={() => { setSelectedCert(null); loadCertificates(); }} />;
  }

  return (
    <div className={cn(
      "flex flex-col gap-6 animate-in fade-in duration-500",
      isFullscreen ? "fixed top-0 bottom-0 right-0 left-0 lg:left-16 z-[150] bg-surface-base p-8 overflow-hidden" : ""
    )}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-main uppercase tracking-tighter">Interim Payment Certificates</h2>
          <p className="text-[10px] font-bold text-ghost uppercase tracking-widest leading-none mt-1">Financial Certification Hub</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full border transition-all font-bold uppercase tracking-widest text-[10px]",
              isFullscreen 
                ? "bg-primary/20 border-primary text-primary" 
                : "bg-surface-1 border-border-subtle text-ghost hover:border-primary hover:text-primary"
            )}
          >
            {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            {isFullscreen ? 'Shrink' : 'Expand'}
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn btn-accent btn-sm shadow-xl shadow-accent/20 h-10 px-6 font-black uppercase tracking-widest text-[10px]"
          >
            <Plus className="w-4 h-4 mr-1" />
            Generate IPC
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Certified', value: certificates.filter(c => c.status === 'certified').reduce((acc, c) => acc + c.net_amount, 0), icon: CheckCircle2, color: 'text-primary' },
          { label: 'Pending Approval', value: certificates.filter(c => c.status === 'submitted').reduce((acc, c) => acc + c.net_amount, 0), icon: Clock, color: 'text-warning' },
          { label: 'Draft Claims', value: certificates.filter(c => c.status === 'draft').reduce((acc, c) => acc + c.net_amount, 0), icon: FileText, color: 'text-dim' },
          { label: 'Total Paid', value: certificates.filter(c => c.status === 'paid').reduce((acc, c) => acc + c.net_amount, 0), icon: DollarSign, color: 'text-info' },
        ].map((stat, i) => (
          <div key={i} className="bg-surface-1 border border-border-subtle rounded-xl p-4 flex items-center gap-4">
            <div className={cn("w-10 h-10 rounded-lg bg-surface-2 flex items-center justify-center", stat.color)}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-dim uppercase tracking-wider">{stat.label}</div>
              <div className="text-lg font-mono font-bold text-main">${stat.value.toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Certificates List */}
      <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden ml-[60px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-surface-base border-b border-border-subtle sticky top-0 z-10">
                <th className="px-6 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost w-32 bg-surface-base border-b border-border-subtle relative group/col">
                  Ref No.
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer">
                    <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                  </div>
                </th>
                <th className="px-6 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost bg-surface-base border-b border-border-subtle relative group/col">
                  Subcontractor
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer">
                    <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                  </div>
                </th>
                <th className="px-6 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost w-40 bg-surface-base border-b border-border-subtle relative group/col">
                  Period End
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer">
                    <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                  </div>
                </th>
                <th className="px-6 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost w-32 bg-surface-base border-b border-border-subtle relative group/col">
                  Status
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer">
                    <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                  </div>
                </th>
                <th className="px-6 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost text-right w-40 bg-surface-base border-b border-border-subtle">Financials</th>
                <th className="px-6 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost w-20 bg-surface-base border-b border-border-subtle"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-dim animate-pulse">Loading certificates...</td></tr>
              ) : certificates.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-dim italic text-main">No payment certificates found.</td></tr>
              ) : (
                certificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-primary/[0.02] border-b border-border-subtle/20 transition-colors group text-main h-auto min-h-[2.5rem]">
                    <td className="px-6 py-3 border-r border-border-subtle/20">
                       <div className="text-[10px] font-black text-accent font-mono truncate">{cert.certificate_no}</div>
                       <div className="text-[8px] text-ghost font-black font-mono uppercase tracking-widest truncate">{cert.id.split('-')[0]}</div>
                    </td>
                    <td className="px-6 py-3 border-r border-border-subtle/20">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-ghost" />
                        <span className="text-[11px] font-black text-main uppercase truncate">{cleanRichText(cert.subcontractors?.company_name)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-[10px] font-black text-ghost font-mono border-r border-border-subtle/20">{cert.period_end}</td>
                    <td className="px-6 py-3 border-r border-border-subtle/20">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest",
                        cert.status === 'certified' ? "bg-primary/10 text-primary border-primary/20" :
                        cert.status === 'submitted' ? "bg-warning/10 text-warning border-warning/20" :
                        cert.status === 'paid' ? "bg-info/10 text-info border-info/20" :
                        "bg-surface-2 text-ghost border-border-subtle"
                      )}>
                        {cert.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right border-r border-border-subtle/20">
                      <div className="text-[11px] font-mono font-black text-main leading-tight">${(cert.net_amount || 0).toLocaleString()}</div>
                      <div className="text-[9px] text-ghost font-black uppercase tracking-widest">Gross: ${(cert.gross_amount || 0).toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedCert(cert)}
                        className="p-2 text-dim hover:text-primary hover:bg-surface-2 rounded-lg transition-all"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border-subtle bg-surface-2 flex items-center justify-between">
              <h3 className="text-lg font-bold text-main">Generate Payment Certificate</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-dim hover:text-main transition-colors">
                <AlertCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-dim uppercase tracking-widest">Subcontractor</label>
                <select 
                  value={selectedSubId}
                  onChange={e => setSelectedSubId(e.target.value)}
                  className="w-full bg-surface-3 border border-border-subtle rounded-lg px-3 py-2 text-sm text-main focus:border-primary outline-none"
                >
                  <option value="">Select Subcontractor...</option>
                  {subcontractors.map(s => <option key={s.id} value={s.id}>{cleanRichText(s.company_name)}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-dim uppercase tracking-widest">Certificate Number</label>
                <input 
                  type="text"
                  placeholder="e.g. IPC-001"
                  value={certNo}
                  onChange={e => setCertNo(e.target.value)}
                  className="w-full bg-surface-3 border border-border-subtle rounded-lg px-3 py-2 text-sm text-main focus:border-primary outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-dim uppercase tracking-widest">Period End Date</label>
                <input 
                  type="date"
                  value={periodEnd}
                  onChange={e => setPeriodEnd(e.target.value)}
                  className="w-full bg-surface-3 border border-border-subtle rounded-lg px-3 py-2 text-sm text-main focus:border-primary outline-none"
                />
              </div>
              <div className="mt-4 p-4 bg-surface-2 rounded-xl border border-border-subtle">
                <p className="text-[11px] text-dim leading-relaxed">
                  Generating a certificate will automatically pull cumulative progress data from reviewed daily logs and calculate current claim quantities based on previous certified certificates.
                </p>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowCreateModal(false)} className="flex-1 btn btn-ghost">Cancel</button>
                <button 
                  onClick={handleCreateCert}
                  disabled={!selectedSubId || !certNo}
                  className="flex-1 btn btn-accent"
                >
                  Generate Claim
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CertificateDetail({ cert, onBack }: { cert: any, onBack: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, [cert.id]);

  async function loadItems() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_certificate_items')
        .select(`
          *,
          boq_items (description, unit)
        `)
        .eq('certificate_id', cert.id);
      if (error) throw error;
      setItems(data || []);
    } catch (e: any) {
      console.error('Error loading items:', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(newStatus: string) {
    try {
      const { error } = await supabase
        .from('payment_certificates')
        .update({ 
          status: newStatus,
          certified_at: newStatus === 'certified' ? new Date().toISOString() : null
        })
        .eq('id', cert.id);
      if (error) throw error;
      alert(`Certificate ${newStatus} successfully!`);
      onBack();
    } catch (e: any) {
      alert('Error updating status: ' + e.message);
    }
  }

  return (
    <div className="flex flex-col gap-6 text-main">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-surface-2 rounded-lg transition-all text-dim hover:text-main">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-main">{cert.certificate_no}</h2>
              <span className={cn(
                "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
                cert.status === 'certified' ? "bg-primary/10 text-primary border-primary/20" :
                cert.status === 'submitted' ? "bg-warning/10 text-warning border-warning/20" :
                "bg-surface-2 text-dim border-border-subtle"
              )}>
                {cert.status}
              </span>
            </div>
            <p className="text-sm text-dim">{cleanRichText(cert.subcontractors?.company_name)} • Period End: {cert.period_end}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-sm">
            <Download className="w-4 h-4" />
            Export PDF
          </button>
          {cert.status === 'draft' && (
            <button onClick={() => updateStatus('submitted')} className="btn btn-accent btn-sm">Submit for Review</button>
          )}
          {cert.status === 'submitted' && (
            <button onClick={() => updateStatus('certified')} className="btn btn-accent btn-sm">Certify Payment</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 flex flex-col gap-6">
          <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border-subtle bg-surface-2">
              <h3 className="text-sm font-bold text-main">Claim Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-surface-base border-b border-border-subtle">
                    <th className="px-4 py-2.5 text-[9px] font-mono font-black text-ghost uppercase tracking-widest bg-surface-base border-b border-border-subtle relative group/col">
                      Activity
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer">
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                      </div>
                    </th>
                    <th className="px-4 py-2.5 text-[9px] font-mono font-black text-ghost uppercase tracking-widest text-right bg-surface-base border-b border-border-subtle w-24 relative group/col">
                      Prev Qty
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer">
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                      </div>
                    </th>
                    <th className="px-4 py-2.5 text-[9px] font-mono font-black text-ghost uppercase tracking-widest text-right bg-surface-base border-b border-border-subtle w-24 relative group/col">
                      To Date
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer">
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                      </div>
                    </th>
                    <th className="px-4 py-2.5 text-[9px] font-mono font-black text-ghost uppercase tracking-widest text-right bg-surface-base border-b border-border-subtle w-24 relative group/col">
                      Current
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer">
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                      </div>
                    </th>
                    <th className="px-4 py-2.5 text-[9px] font-mono font-black text-ghost uppercase tracking-widest text-right bg-surface-base border-b border-border-subtle w-24 relative group/col">
                      Rate
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-20 group/resizer">
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-border-subtle group-hover/resizer:bg-primary transition-all opacity-40 group-hover/resizer:opacity-100" />
                      </div>
                    </th>
                    <th className="px-4 py-2.5 text-[9px] font-mono font-black text-ghost uppercase tracking-widest text-right bg-surface-base border-b border-border-subtle w-32 relative group/col">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/30">
                  {loading ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-dim animate-pulse font-mono text-[10px]">Loading items...</td></tr>
                  ) : items.map((item) => {
                    const currentQty = (item.total_qty_to_date || 0) - (item.previous_qty || 0);
                    const amount = currentQty * (item.rate || 0);
                    return (
                      <tr key={item.id} className="hover:bg-primary/[0.02] transition-colors border-b border-border-subtle/20 group">
                        <td className="px-4 py-1.5 border-r border-border-subtle/20">
                          <div className="text-[12px] font-medium text-dim/90 whitespace-normal break-words leading-tight">{cleanRichText(item.boq_items?.description)}</div>
                          <div className="text-[9px] text-ghost font-mono uppercase tracking-widest mt-0.5">{cleanRichText(item.boq_items?.unit)}</div>
                        </td>
                        <td className="px-4 py-1.5 text-[11px] text-dim text-right font-mono border-r border-border-subtle/20">{(item.previous_qty || 0).toLocaleString()}</td>
                        <td className="px-4 py-1.5 text-[11px] text-main text-right font-mono border-r border-border-subtle/20">{(item.total_qty_to_date || 0).toLocaleString()}</td>
                        <td className="px-4 py-1.5 text-[11px] text-primary text-right font-mono font-bold border-r border-border-subtle/20">{currentQty.toLocaleString()}</td>
                        <td className="px-4 py-1.5 text-[11px] text-dim text-right font-mono border-r border-border-subtle/20">${(item.rate || 0).toLocaleString()}</td>
                        <td className="px-4 py-1.5 text-[11px] text-main text-right font-mono font-bold">${amount.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-surface-1 border border-border-subtle rounded-xl p-6 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-main">Financial Summary</h3>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-dim">Gross Amount</span>
                <span className="text-sm font-mono font-bold text-main">${(cert.gross_amount || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-dim">Retention (10%)</span>
                <span className="text-sm font-mono font-bold text-error">-${(cert.retention_amount || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-dim">Deductions</span>
                <span className="text-sm font-mono font-bold text-error">-${(cert.deductions_amount || 0).toLocaleString()}</span>
              </div>
              <div className="h-px bg-border-subtle my-2" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-main">Net Payable</span>
                <span className="text-lg font-mono font-bold text-primary">${(cert.net_amount || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-1 border border-border-subtle rounded-xl p-6">
            <h3 className="text-sm font-bold text-main mb-4">Certification Details</h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-dim">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-dim uppercase font-bold">Prepared By</div>
                  <div className="text-xs text-main">Site Supervisor</div>
                </div>
              </div>
              {cert.certified_at && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] text-dim uppercase font-bold">Certified At</div>
                    <div className="text-xs text-main">{new Date(cert.certified_at).toLocaleString()}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
