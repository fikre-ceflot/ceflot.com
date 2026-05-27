import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Users, 
  Plus, 
  Search, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  ExternalLink, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Database,
  Globe,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn, cleanRichText } from '../lib/utils';
import { usePermissions } from '../hooks/usePermissions';
import { TRADE_GROUPS } from '../lib/constants';

interface Subcontractor {
  id: string;
  tenant_id: string;
  company_name: string;
  trade_category: string;
  contact_person: string;
  email: string;
  phone: string;
  status: 'active' | 'blacklisted' | 'pending';
  rating: number;
  created_at: string;
}

interface SubcontractorLibraryProps {
  userRole: any;
  tenantId: any;
  isGodMode?: boolean;
}

export function SubcontractorLibrary({ userRole, tenantId, isGodMode }: SubcontractorLibraryProps) {
  const { hasCapability } = usePermissions(userRole, tenantId);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    company_name: '',
    trade_category: '',
    contact_person: '',
    email: '',
    phone: '',
    status: 'active' as 'active' | 'blacklisted' | 'pending'
  });

  useEffect(() => {
    loadSubcontractors();
  }, [tenantId]);

  const loadSubcontractors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subcontractors')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('company_name');

      if (error) throw error;
      setSubcontractors(data || []);
    } catch (e: any) {
      console.error('Error loading subcontractors:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (id?: string) => {
    try {
      if (id) {
        const { error } = await supabase
          .from('subcontractors')
          .update(formData)
          .eq('id', id);
        if (error) throw error;
        setEditingId(null);
      } else {
        const { error } = await supabase
          .from('subcontractors')
          .insert([{
            ...formData,
            tenant_id: tenantId,
            rating: 5
          }]);
        if (error) throw error;
        setIsAdding(false);
      }
      
      setFormData({ company_name: '', trade_category: '', contact_person: '', email: '', phone: '', status: 'active' });
      loadSubcontractors();
    } catch (e: any) {
      alert('Error saving subcontractor: ' + e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this partner?')) return;
    try {
      const { error } = await supabase
        .from('subcontractors')
        .delete()
        .eq('id', id);
      if (error) throw error;
      loadSubcontractors();
    } catch (e: any) {
      alert('Error deleting: ' + e.message);
    }
  };

  const filtered = subcontractors.filter(s => 
    s.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.trade_category?.toLowerCase().includes(search.toLowerCase()) ||
    s.contact_person?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold">Partner Network</h1>
          <p className="text-sm text-dim">Central registry for certified subcontractors and external partners</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsAdding(true)}
            className="btn btn-accent btn-sm shadow-xl shadow-accent/20"
          >
            <Plus className="w-4 h-4" />
            Register Partner
          </button>
        </div>
      </div>

      <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border-subtle flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
            <input 
              type="text"
              placeholder="Search by name, trade or contact…"
              className="w-full bg-surface-2 border border-border-subtle rounded-md py-2 pl-10 pr-4 text-sm outline-none focus:border-primary transition-colors"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isAdding && (
          <div className="p-6 bg-surface-2 border-b border-border-subtle animate-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black text-main uppercase tracking-tight">New Partner Registration</h3>
              <button onClick={() => setIsAdding(false)} className="text-ghost hover:text-main transition-colors"><XCircle className="w-5 h-5" /></button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-ghost">Company Name</label>
                <input 
                  type="text"
                  className="bg-surface-base border border-border-subtle rounded-xl text-sm p-3 outline-none focus:border-accent text-main font-bold"
                  value={formData.company_name}
                  onChange={e => setFormData({...formData, company_name: e.target.value})}
                  placeholder="Legal Entity Name"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-ghost">Trade Category</label>
                <select 
                  className="bg-surface-base border border-border-subtle rounded-xl text-sm p-3 outline-none focus:border-accent text-main font-bold"
                  value={formData.trade_category}
                  onChange={e => setFormData({...formData, trade_category: e.target.value})}
                >
                  <option value="">Select Category...</option>
                  {TRADE_GROUPS.map(g => (
                    <option key={g.code} value={g.label}>{g.label}</option>
                  ))}
                  <option value="General">General Contractor</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-ghost">Contact Person</label>
                <input 
                  type="text"
                  className="bg-surface-base border border-border-subtle rounded-xl text-sm p-3 outline-none focus:border-accent text-main font-bold"
                  value={formData.contact_person}
                  onChange={e => setFormData({...formData, contact_person: e.target.value})}
                  placeholder="Primary Liaison"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-ghost">Email Address</label>
                <input 
                  type="email"
                  className="bg-surface-base border border-border-subtle rounded-xl text-sm p-3 outline-none focus:border-accent text-main font-bold"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  placeholder="office@partner.com"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-ghost">Contact Number</label>
                <input 
                  type="text"
                  className="bg-surface-base border border-border-subtle rounded-xl text-sm p-3 outline-none focus:border-accent text-main font-bold"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  placeholder="+251..."
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-ghost">Status</label>
                <select 
                  className="bg-surface-base border border-border-subtle rounded-xl text-sm p-3 outline-none focus:border-accent text-main font-bold"
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value as any})}
                >
                  <option value="active">Active Verified</option>
                  <option value="pending">Awaiting Review</option>
                  <option value="blacklisted">Restricted Access</option>
                </select>
              </div>
              
              <div className="md:col-span-3 flex justify-end gap-3 pt-4 border-t border-border-subtle">
                <button onClick={() => setIsAdding(false)} className="btn btn-ghost btn-sm">Discard</button>
                <button onClick={() => handleSave()} className="btn btn-accent btn-sm">Authorize & Register</button>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2 border-b border-border-subtle">
                <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-widest text-ghost">Partner Company</th>
                <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-widest text-ghost">Trade</th>
                <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-widest text-ghost">Contact</th>
                <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-widest text-ghost">Status</th>
                <th className="px-6 py-4 font-mono text-[10px] uppercase tracking-widest text-ghost text-right">Rating</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center animate-pulse">
                    <div className="w-8 h-8 border-2 border-accent/20 border-t-accent rounded-full animate-spin mx-auto mb-4" />
                    <span className="text-[10px] text-ghost font-black uppercase tracking-widest">Syncing Partner Registry...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-32 text-center text-ghost opacity-50">
                    <Building2 className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-xs font-bold uppercase tracking-widest">No matching partners in network</p>
                  </td>
                </tr>
              ) : (
                filtered.map(sub => (
                  <tr key={sub.id} className="group hover:bg-main/5 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-surface-2 border border-border-subtle flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-all duration-500 shadow-sm">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-main tracking-tight leading-none group-hover:text-accent transition-colors">{cleanRichText(sub.company_name)}</span>
                          <span className="text-[10px] text-ghost font-bold uppercase tracking-widest mt-1.5 opacity-60">Partner ID: {sub.id.split('-')[0]}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="inline-flex px-2 py-0.5 rounded-lg bg-accent/10 border border-accent/20 text-[10px] font-black uppercase tracking-widest text-accent">
                        {cleanRichText(sub.trade_category)}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-black text-main uppercase tracking-tight">{cleanRichText(sub.contact_person)}</span>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-ghost" />
                            <span className="font-mono text-[10px] text-ghost font-bold">{sub.phone}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className={cn(
                        "inline-flex items-center gap-2 px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border shadow-sm",
                        sub.status === 'active' ? "bg-primary/10 text-primary border-primary/20" :
                        sub.status === 'blacklisted' ? "bg-danger/10 text-danger border-danger/20" :
                        "bg-surface-2 text-ghost border-border-subtle"
                      )}>
                        <div className={cn("w-1 h-1 rounded-full", sub.status === 'active' ? "bg-primary animate-pulse" : sub.status === 'blacklisted' ? "bg-danger" : "bg-ghost")} />
                        {sub.status}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        {[1,2,3,4,5].map(star => (
                          <div key={star} className={cn(
                            "w-1.5 h-0.5 rounded-full",
                            star <= (sub.rating || 5) ? "bg-warning" : "bg-border-subtle"
                          )} />
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingId(sub.id);
                            setFormData({ ...sub });
                          }}
                          className="p-1.5 text-dim hover:bg-surface-2 hover:text-main rounded-md transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(sub.id)}
                          className="p-1.5 text-ghost hover:bg-danger/10 hover:text-danger rounded-md transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
