import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  FileText, 
  TrendingUp, 
  Users, 
  Phone, 
  Mail, 
  User, 
  Tag, 
  Star, 
  Plus, 
  X, 
  ShieldCheck, 
  Search, 
  Building2,
  CheckCircle
} from 'lucide-react';
import { cn, cleanRichText } from '../lib/utils';
import { usePermissions } from '../hooks/usePermissions';
import { SubcontractorContractManager } from './SubcontractorContractManager';
import { SubcontractorProgress } from './SubcontractorProgress';
import { Project } from '../types';

interface SubcontractorManagementProps {
  userRole: any;
  tenantId: any;
  project: Project | null;
  onSelectProject?: () => void;
}

interface SubcontractorRecord {
  id: string;
  company_name: string;
  trade_category: string;
  contact_person: string;
  email: string;
  phone: string;
  status: 'active' | 'suspended' | 'inactive';
  rating: number;
  created_at: string;
}

export function SubcontractorManagement({ userRole, tenantId, project, onSelectProject }: SubcontractorManagementProps) {
  const { hasCapability } = usePermissions(userRole, tenantId);
  
  // 3-tab model: directory, contracts, performance
  const [activeTab, setActiveTab] = useState<'directory' | 'contracts' | 'performance'>('directory');
  
  // Directory state
  const [subcons, setSubcons] = useState<SubcontractorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTrade, setSelectedTrade] = useState<string>('All');
  
  // Modal for adding new subcontractor
  const [showRegModal, setShowRegModal] = useState(false);
  const [regForm, setRegForm] = useState({
    company_name: '',
    trade_category: 'Concrete Works',
    contact_person: '',
    email: '',
    phone: '',
    status: 'active' as 'active' | 'suspended' | 'inactive'
  });

  useEffect(() => {
    loadSubcontractors();
  }, [tenantId]);

  async function loadSubcontractors() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subcontractors')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('company_name');
      
      if (error) throw error;
      setSubcons(data || []);
    } catch (err) {
      console.error('Error loading subcontractors:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleRegisterSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasCapability('res:subcon_manage')) {
      alert("Unauthorized: You do not have 'res:subcon_manage' permission rights.");
      return;
    }
    if (!regForm.company_name) {
      alert("Company Name is required.");
      return;
    }

    try {
      const { error } = await supabase
        .from('subcontractors')
        .insert({
          company_name: regForm.company_name,
          trade_category: regForm.trade_category,
          contact_person: regForm.contact_person,
          email: regForm.email,
          phone: regForm.phone,
          status: regForm.status,
          tenant_id: tenantId,
          rating: 5
        });

      if (error) throw error;
      
      alert('Subcontractor successfully registered!');
      setShowRegModal(false);
      setRegForm({
        company_name: '',
        trade_category: 'Concrete Works',
        contact_person: '',
        email: '',
        phone: '',
        status: 'active'
      });
      loadSubcontractors();
    } catch (err) {
      console.error('Registration failed:', err);
      alert('Failed to register subcontractor.');
    }
  };

  const tradeCategories = ['All', 'Concrete Works', 'Electrical', 'Plumbings', 'Plastering', 'Masonry', 'Structural Steel', 'Roofing', 'Finishes'];

  const filteredSubcons = subcons.filter(s => {
    const matchesSearch = s.company_name.toLowerCase().includes(search.toLowerCase()) ||
                          s.contact_person.toLowerCase().includes(search.toLowerCase()) ||
                          s.trade_category.toLowerCase().includes(search.toLowerCase());
    const matchesTrade = selectedTrade === 'All' || s.trade_category === selectedTrade;
    return matchesSearch && matchesTrade;
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-4 px-1">
        <div className="flex flex-col gap-0.5 md:mt-auto">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-semibold text-ghost uppercase tracking-[0.2em]">Resource Coordination</span>
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-main -ml-0.5">Subcontractor Oversight</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-2 text-[10px] font-medium text-ghost">
              <span className="text-accent font-semibold uppercase tracking-wider">Lifecycle Management</span>
              <span className="w-1 h-1 rounded-full bg-border-subtle" />
              <span className="px-1.5 py-0.25 rounded bg-surface-2 border border-border-subtle opacity-80">
                {project ? `Project: ${project.name}` : 'Company-Wide Directory'} 
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 ml-auto flex-wrap">
          {/* Dynamic Helpful Information Card (Aligned Right) */}
          <div className="flex flex-col gap-1 text-right border-r border-border-subtle pr-4 h-10 justify-center">
            <div className="text-[10px] font-semibold text-ghost uppercase tracking-wider font-mono">SUBCONTRACTOR REGISTRY</div>
            <div className="flex items-center gap-2 justify-end">
              <span className="px-1.5 py-0.25 rounded bg-purple-500/10 border border-purple-500/20 text-[9px] font-semibold text-purple-400 select-none uppercase tracking-wider font-mono">COORDINATED</span>
              <div className="h-1 w-1 rounded-full bg-border-subtle" />
              <span className="text-[9px] font-medium text-dim uppercase tracking-wider font-mono">{filteredSubcons.length} Firms Registered</span>
            </div>
          </div>

          {/* Tab switchers */}
          <div className="flex bg-surface-2 p-1 rounded-xl border border-border-subtle shadow-inner">
          <button 
            onClick={() => setActiveTab('directory')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'directory' ? "bg-surface-1 text-accent shadow-sm border border-border-subtle" : "text-ghost hover:text-main"
            )}
          >
            <Users className="w-3.5 h-3.5" />
            Firm Directory
          </button>
          <button 
            onClick={() => setActiveTab('contracts')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'contracts' ? "bg-surface-1 text-accent shadow-sm border border-border-subtle" : "text-ghost hover:text-main"
            )}
          >
            <FileText className="w-3.5 h-3.5" />
            Contracts Tree
          </button>
          <button 
            onClick={() => setActiveTab('performance')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'performance' ? "bg-surface-1 text-accent shadow-sm border border-border-subtle" : "text-ghost hover:text-main"
            )}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Site Progress
          </button>
        </div>
      </div>
    </header>

      {/* RENDER VIEW ACCORDING TO TABS */}

      {activeTab === 'directory' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Controls Bar */}
          <div className="bg-surface-1 border border-border-subtle p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col md:flex-row gap-2 flex-1 max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                <input
                  type="text"
                  placeholder="Search subcontractors by name, person or trade..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-surface-2 border border-border-subtle rounded-lg text-xs font-bold text-main focus:outline-none"
                />
              </div>
              <select
                value={selectedTrade}
                onChange={(e) => setSelectedTrade(e.target.value)}
                className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-xs font-bold text-main focus:outline-none"
              >
                {tradeCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {hasCapability('res:subcon_manage') && (
              <button
                onClick={() => setShowRegModal(true)}
                className="btn btn-primary btn-xs h-9 px-4 flex items-center gap-1.5 rounded-lg"
              >
                <Plus className="w-4 h-4" /> Register New Partner
              </button>
            )}
          </div>

          {/* Directory Listings */}
          {loading ? (
            <div className="py-24 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
              <div className="text-dim text-xs font-mono">Querying subcontractors databases...</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredSubcons.map(sub => (
                <div 
                  key={sub.id}
                  className="bg-surface-1 border border-border-subtle p-5 rounded-2xl flex flex-col justify-between hover:border-accent/25 transition-all group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-surface-2 border border-border-subtle flex items-center justify-center text-primary font-black text-sm">
                        {sub.company_name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            className={cn(
                              "w-3.5 h-3.5",
                              i < (sub.rating || 5) ? "text-warning fill-warning" : "text-border-subtle"
                            )} 
                          />
                        ))}
                      </div>
                    </div>

                    <h3 className="text-xs font-black text-main uppercase select-none tracking-tight">{cleanRichText(sub.company_name)}</h3>
                    
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-surface-2 border border-border-subtle rounded text-[9px] font-black uppercase tracking-widest text-ghost mt-2">
                      <Tag className="w-3 h-3 text-primary" />
                      {cleanRichText(sub.trade_category)}
                    </div>

                    {/* Contact lines */}
                    <div className="mt-4 space-y-2 border-t border-border-subtle/40 pt-3">
                      <div className="flex items-center gap-2 text-[10px] text-dim">
                        <User className="w-3.5 h-3.5 text-primary" />
                        <span>Person: <strong>{cleanRichText(sub.contact_person || 'N/A')}</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-dim">
                        <Phone className="w-3.5 h-3.5 text-accent" />
                        <span>Phone: <strong className="font-mono">{sub.phone || 'N/A'}</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-dim">
                        <Mail className="w-3.5 h-3.5 text-ghost" />
                        <span className="truncate">Email: <strong>{sub.email || 'N/A'}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-border-subtle/30 flex items-center justify-between">
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border",
                      sub.status === 'active' ? "border-primary/20 bg-primary/5 text-primary" : "border-danger/20 bg-danger/5 text-danger"
                    )}>
                      {sub.status || 'Active'}
                    </span>

                    <span className="text-[9px] font-mono font-black text-ghost">
                      ID: {sub.id.substring(0, 8).toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}

              {filteredSubcons.length === 0 && (
                <div className="col-span-full py-16 text-center bg-surface-1 border border-border-subtle border-dashed rounded-3xl">
                  <Users className="w-12 h-12 text-ghost mx-auto opacity-20 mb-3" />
                  <h3 className="text-sm font-black text-main uppercase">No subcontractors registered</h3>
                  <p className="text-xs text-dim mt-2 max-w-sm mx-auto">There are no subcontractor partners who correspond to your filters. Try adjusting them or record a new profile.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'contracts' && (
        <div className="animate-in fade-in duration-350">
          <SubcontractorContractManager project={project} tenantId={tenantId} onSelectProject={onSelectProject} />
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="animate-in fade-in duration-350">
          {project ? (
            <SubcontractorProgress projectId={project.id} />
          ) : (
            <div className="py-24 text-center bg-surface-1 border border-dashed border-border-subtle rounded-3xl mx-1">
              <TrendingUp className="w-12 h-12 text-ghost mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-black text-main tracking-tight px-1">Project Context Required</h3>
              <p className="text-sm text-dim mt-2 max-w-sm mx-auto">Performance metrics are project-specific. Please select a project to view active subcontractor efficiency.</p>
              <button 
                onClick={onSelectProject}
                className="btn btn-accent btn-sm mt-6 shadow-xl shadow-accent/20"
              >
                Open Project Selection
              </button>
            </div>
          )}
        </div>
      )}

      {/* Registration Modal */}
      {showRegModal && (
        <div className="fixed inset-0 bg-surface-base/85 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in duration-250">
            <div className="p-6 border-b border-border-subtle flex items-center justify-between">
              <h2 className="text-sm font-black text-main uppercase flex items-center gap-2">
                <Building2 className="w-5 h-5 text-accent animate-pulse" /> Register executing partner
              </h2>
              <button onClick={() => setShowRegModal(false)} className="text-ghost hover:text-main">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterSub} className="p-6 space-y-4">
              <div>
                <label className="block text-[9px] font-black uppercase text-ghost tracking-widest mb-1">Company Registered Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kenya Masonry Ltd"
                  value={regForm.company_name}
                  onChange={e => setRegForm({ ...regForm, company_name: e.target.value })}
                  className="w-full bg-surface-2 border border-border-subtle rounded-lg px-4 py-2.5 text-xs font-bold text-main focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase text-ghost tracking-widest mb-1">Trade Specialization Category</label>
                <select
                  value={regForm.trade_category}
                  onChange={e => setRegForm({ ...regForm, trade_category: e.target.value })}
                  className="w-full bg-surface-2 border border-border-subtle rounded-lg px-4 py-2.5 text-xs font-bold text-main focus:outline-none"
                >
                  {tradeCategories.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c} className="bg-surface-1">{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase text-ghost tracking-widest mb-1">Contact Person Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Kamau"
                  value={regForm.contact_person}
                  onChange={e => setRegForm({ ...regForm, contact_person: e.target.value })}
                  className="w-full bg-surface-2 border border-border-subtle rounded-lg px-4 py-2.5 text-xs font-bold text-main focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black uppercase text-ghost tracking-widest mb-1">Corporate Email</label>
                  <input
                    type="email"
                    placeholder="e.g. partner@site.co.ke"
                    value={regForm.email}
                    onChange={e => setRegForm({ ...regForm, email: e.target.value })}
                    className="w-full bg-surface-2 border border-border-subtle rounded-lg px-4 py-2.5 text-xs font-bold text-main focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-ghost tracking-widest mb-1">Telephone Contact</label>
                  <input
                    type="text"
                    placeholder="e.g. +254 700 000000"
                    value={regForm.phone}
                    onChange={e => setRegForm({ ...regForm, phone: e.target.value })}
                    className="w-full bg-surface-2 border border-border-subtle rounded-lg px-4 py-2.5 text-xs font-bold text-main focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase text-ghost tracking-widest mb-1">Engagement Status</label>
                <select
                  value={regForm.status}
                  onChange={e => setRegForm({ ...regForm, status: e.target.value as any })}
                  className="w-full bg-surface-2 border border-border-subtle rounded-lg px-4 py-2.5 text-xs font-bold text-main focus:outline-none"
                >
                  <option value="active" className="bg-surface-1">Active Partnership</option>
                  <option value="inactive" className="bg-surface-1">Inactive / Pending</option>
                  <option value="suspended" className="bg-surface-1">On-Hold / Suspended</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRegModal(false)}
                  className="flex-1 px-4 py-2.5 bg-surface-2 hover:bg-surface-3 border border-border-subtle text-main font-bold rounded-xl text-xs"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/95 text-surface-base font-black rounded-xl text-xs"
                >
                  Verify & Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
