import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Truck,
  Plus,
  Search,
  Edit2,
  Trash2,
  Globe,
  Building2,
  X,
  Star,
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  ChevronRight,
  Filter,
  CheckCircle2,
  History,
  FileText
} from 'lucide-react';
import { cn } from '../lib/utils';
import { usePermissions } from '../hooks/usePermissions';

interface Supplier {
  id: string;
  tenant_id: string | null;
  supplier_code: string;
  company_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  category: string;
  specialization: string | null;
  rating: number | null;
  preferred: boolean;
  is_active: boolean;
  library_tier: 'global' | 'company';
  region: string | null;
  on_time_delivery_rate: number | null;
  last_quoted_rate: number | null;
  created_at?: string;
}

interface Category {
  id: string;
  category_code: string;
  name: string;
}

interface SupplierLibraryProps {
  userRole: any;
  tenantId: any;
  isGodMode?: boolean;
}

export default function SupplierLibrary({ userRole, tenantId, isGodMode }: SupplierLibraryProps) {
  const { hasCapability } = usePermissions(userRole, tenantId);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [tierFilter, setTierFilter] = useState<'all' | 'global' | 'company'>(isGodMode ? 'all' : 'company');
  const [isAdding, setIsAdding] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<Partial<Supplier>>({
    company_name: '',
    supplier_code: '',
    category: '',
    location: '',
    contact_person: '',
    phone: '',
    email: '',
    specialization: '',
    library_tier: 'company',
    is_active: true,
    preferred: false
  });

  useEffect(() => {
    loadData();
  }, [tenantId, isGodMode]);

  const [showPriceHistory, setShowPriceHistory] = useState<Supplier | null>(null);
  const [showDocuments, setShowDocuments] = useState<Supplier | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      // Load categories
      const { data: catData } = await supabase
        .from('supplier_categories')
        .select('id, category_code, name')
        .order('name');
      
      if (catData) setCategories(catData);

      // Load suppliers
      let query = supabase.from('suppliers').select('*');
      
      if (!isGodMode && tenantId && tenantId !== 'null') {
        // Tenants see their own + global
        query = query.or(`tenant_id.eq.${tenantId},library_tier.eq.global`);
      } else if (!isGodMode && (!tenantId || tenantId === 'null')) {
        // Fallback to only global if no tenant
        query = query.eq('library_tier', 'global');
      }

      const { data: supData, error } = await query.order('company_name');
      if (error) throw error;
      if (supData) setSuppliers(supData);
    } catch (err) {
      console.error('Error loading suppliers:', err);
    } finally {
      setLoading(false);
    }
  }

  const companySupplierCodes = React.useMemo(() => {
    const codes = new Set<string>();
    suppliers.forEach(s => {
      if (s.library_tier === 'company' || (s.tenant_id && s.tenant_id === tenantId)) {
        if (s.supplier_code) codes.add(s.supplier_code.toLowerCase().trim());
      }
    });
    return codes;
  }, [suppliers, tenantId]);

  const companySupplierNames = React.useMemo(() => {
    const names = new Set<string>();
    suppliers.forEach(s => {
      if (s.library_tier === 'company' || (s.tenant_id && s.tenant_id === tenantId)) {
        if (s.company_name) names.add(s.company_name.toLowerCase().trim());
      }
    });
    return names;
  }, [suppliers, tenantId]);

  const filteredSuppliers = React.useMemo(() => {
    return suppliers.filter(s => {
      const matchesSearch = s.company_name.toLowerCase().includes(search.toLowerCase()) ||
                           s.supplier_code.toLowerCase().includes(search.toLowerCase()) ||
                           (s.location?.toLowerCase().includes(search.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'ALL' || s.category === selectedCategory;
      const matchesTier = tierFilter === 'all' || s.library_tier === tierFilter;
      
      // Hide global version if a company-specific one with same name or code exists to keep it company-specific
      const isGlobal = s.library_tier === 'global' || !s.tenant_id;
      if (tierFilter === 'all' && isGlobal) {
        if (s.supplier_code && companySupplierCodes.has(s.supplier_code.toLowerCase().trim())) {
          return false;
        }
        if (s.company_name && companySupplierNames.has(s.company_name.toLowerCase().trim())) {
          return false;
        }
      }

      return matchesSearch && matchesCategory && matchesTier;
    });
  }, [suppliers, search, selectedCategory, tierFilter, companySupplierCodes, companySupplierNames]);

  async function handleSave() {
    if (!formData.company_name || !formData.category) {
      alert('Company Name and Category are required');
      return;
    }

    try {
      const payload = {
        ...formData,
        tenant_id: formData.library_tier === 'global' ? null : tenantId,
        updated_at: new Date().toISOString()
      };

      if (editingSupplier) {
        const { error } = await supabase
          .from('suppliers')
          .update(payload)
          .eq('id', editingSupplier.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('suppliers')
          .insert([payload]);
        if (error) throw error;
      }

      setIsAdding(false);
      setEditingSupplier(null);
      loadData();
    } catch (err: any) {
      alert('Error saving supplier: ' + err.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this supplier?')) return;
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      loadData();
    } catch (err: any) {
      alert('Error deleting: ' + err.message);
    }
  }

  async function cloneToCompany(supplier: Supplier) {
    if (!confirm(`Clone "${supplier.company_name}" to your Company Library?`)) return;
    try {
      const { error } = await supabase.from('suppliers').insert([{
        ...supplier,
        id: undefined,
        tenant_id: tenantId,
        library_tier: 'company',
        origin_id: supplier.id,
        created_at: new Date().toISOString()
      }]);
      if (error) throw error;
      alert('Cloned successfully!');
      loadData();
    } catch (err: any) {
      alert('Error cloning: ' + err.message);
    }
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-main tracking-tight font-sans">Supplier Library</h1>
          <p className="text-sm text-ghost mt-1">Manage global and company-specific suppliers and vendors</p>
        </div>
        <div className="flex items-center gap-3">
          {((isGodMode && hasCapability('sup:global_edit')) || hasCapability('sup:manage')) && (
            <button 
              onClick={() => {
                setFormData({
                  company_name: '',
                  supplier_code: '',
                  category: '',
                  location: '',
                  contact_person: '',
                  phone: '',
                  email: '',
                  specialization: '',
                  library_tier: isGodMode ? 'global' : 'company',
                  is_active: true,
                  preferred: false
                });
                setIsAdding(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-surface-base font-bold rounded-lg transition-all shadow-lg shadow-primary/10"
            >
              <Plus className="w-4 h-4" />
              Add Supplier
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        {/* Sidebar Filters */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-surface-1 border border-border-subtle rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4 text-main">
              <Filter className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Filters</span>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-ghost uppercase tracking-wider mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                  <input 
                    type="text"
                    placeholder="Company, code, location..."
                    className="w-full bg-surface-base border border-border-subtle rounded-lg py-2 pl-10 pr-4 text-sm outline-none focus:border-primary transition-colors text-main"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-ghost uppercase tracking-wider mb-2 block">Library Tier</label>
                <div className="flex p-1 bg-surface-base rounded-lg border border-border-subtle">
                  {['all', 'global', 'company'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setTierFilter(t as any)}
                      className={cn(
                        "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all",
                        tierFilter === t 
                          ? "bg-surface-2 text-primary" 
                          : "text-ghost hover:text-dim"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-ghost uppercase tracking-wider mb-2 block">Categories</label>
                <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  <button
                    onClick={() => setSelectedCategory('ALL')}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-all",
                      selectedCategory === 'ALL' 
                        ? "bg-primary/10 text-primary font-medium" 
                        : "text-dim hover:bg-surface-2 hover:text-main"
                    )}
                  >
                    All Categories
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.category_code)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-all",
                        selectedCategory === cat.category_code 
                          ? "bg-primary/10 text-primary font-medium" 
                          : "text-dim hover:bg-surface-2 hover:text-main"
                      )}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 flex flex-col min-h-0">
          <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden flex flex-col h-full">
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <div className="w-8 h-8 border-2 border-border-subtle border-t-primary rounded-full animate-spin mb-4" />
                  <p className="text-sm text-ghost">Loading suppliers...</p>
                </div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-ghost">
                  <Truck className="w-12 h-12 opacity-10 mb-4" />
                  <p className="text-lg font-medium">No suppliers found</p>
                  <p className="text-sm">Try adjusting your filters or search</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                  {filteredSuppliers.map((supplier) => (
                    <div 
                      key={supplier.id}
                      className="group bg-surface-2 border border-border-subtle rounded-xl p-4 hover:border-primary/30 transition-all relative"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            supplier.library_tier === 'global' ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"
                          )}>
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-main">{supplier.company_name}</h3>
                              {supplier.preferred && (
                                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-mono text-ghost bg-surface-base px-1.5 py-0.5 rounded border border-border-subtle">
                                {supplier.supplier_code}
                              </span>
                              <span className={cn(
                                "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border",
                                supplier.library_tier === 'global' 
                                  ? "bg-accent/5 text-accent border-accent/20" 
                                  : "bg-primary/5 text-primary border-primary/20"
                              )}>
                                {supplier.library_tier}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {supplier.library_tier === 'global' && !isGodMode && (
                            <button 
                              onClick={() => cloneToCompany(supplier)}
                              className="p-1.5 text-accent hover:bg-accent/10 rounded-lg transition-colors"
                              title="Clone to Company"
                            >
                              <Globe className="w-4 h-4" />
                            </button>
                          )}
                          {((supplier.library_tier === 'company' && hasCapability('sup:manage')) || isGodMode) && (
                            <>
                              <button 
                                onClick={() => setShowDocuments(supplier)}
                                className="p-1.5 text-dim hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                                title="Documents"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setShowPriceHistory(supplier)}
                                className="p-1.5 text-dim hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                title="Price History"
                              >
                                <History className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  setEditingSupplier(supplier);
                                  setFormData(supplier);
                                  setIsAdding(true);
                                }}
                                className="p-1.5 text-dim hover:text-main hover:bg-surface-base rounded-lg transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDelete(supplier.id)}
                                className="p-1.5 text-dim hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 mt-4">
                        {supplier.location && (
                          <div className="flex items-center gap-2 text-xs text-dim">
                            <MapPin className="w-3.5 h-3.5 text-ghost" />
                            {supplier.location}
                          </div>
                        )}
                        <div className="flex items-center gap-4">
                          {supplier.phone && (
                            <div className="flex items-center gap-2 text-xs text-dim">
                              <Phone className="w-3.5 h-3.5 text-ghost" />
                              {supplier.phone}
                            </div>
                          )}
                          {supplier.email && (
                            <div className="flex items-center gap-2 text-xs text-dim">
                              <Mail className="w-3.5 h-3.5 text-ghost" />
                              {supplier.email}
                            </div>
                          )}
                        </div>
                      </div>

                      {supplier.specialization && (
                        <div className="mt-4 pt-4 border-t border-border-subtle">
                          <p className="text-[11px] text-ghost leading-relaxed line-clamp-2">
                            {supplier.specialization}
                          </p>
                        </div>
                      )}

                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-ghost uppercase tracking-widest">Category:</span>
                          <span className="text-[11px] text-main font-medium">
                            {categories.find(c => c.category_code === supplier.category)?.name || supplier.category}
                          </span>
                        </div>
                        {supplier.rating && (
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                              <span className="text-xs font-bold text-main">{supplier.rating}</span>
                            </div>
                            {supplier.on_time_delivery_rate && (
                              <div className="flex items-center gap-1.5 border-l border-border-subtle pl-3">
                                <CheckCircle2 className="w-3 h-3 text-primary" />
                                <span className="text-[10px] font-bold text-primary">{supplier.on_time_delivery_rate}% On-time</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border-subtle flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-main">
                  {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
                </h2>
                <p className="text-sm text-ghost mt-1">Enter supplier details and categorization</p>
              </div>
              <button 
                onClick={() => {
                  setIsAdding(false);
                  setEditingSupplier(null);
                }}
                className="w-10 h-10 rounded-full bg-surface-2 border border-border-subtle flex items-center justify-center hover:bg-surface-base transition-colors"
              >
                <X className="w-5 h-5 text-ghost" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] font-bold text-ghost uppercase tracking-wider mb-1.5 block">Company Name *</label>
                <input 
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors text-main"
                  value={formData.company_name}
                  onChange={e => setFormData({...formData, company_name: e.target.value})}
                  placeholder="e.g. Nile Aggregates"
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] font-bold text-ghost uppercase tracking-wider mb-1.5 block">Supplier Code</label>
                <input 
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors text-main"
                  value={formData.supplier_code}
                  onChange={e => setFormData({...formData, supplier_code: e.target.value})}
                  placeholder="e.g. SS-AGG-01"
                />
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] font-bold text-ghost uppercase tracking-wider mb-1.5 block">Category *</label>
                <select 
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors text-main"
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                >
                  <option value="">Select Category...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.category_code}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] font-bold text-ghost uppercase tracking-wider mb-1.5 block">Location</label>
                <input 
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors text-main"
                  value={formData.location}
                  onChange={e => setFormData({...formData, location: e.target.value})}
                  placeholder="City, Region"
                />
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] font-bold text-ghost uppercase tracking-wider mb-1.5 block">Contact Person</label>
                <input 
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors text-main"
                  value={formData.contact_person}
                  onChange={e => setFormData({...formData, contact_person: e.target.value})}
                  placeholder="Full Name"
                />
              </div>

              <div className="col-span-2 md:col-span-1 flex gap-4">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-ghost uppercase tracking-wider mb-1.5 block">Phone</label>
                  <input 
                    className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors text-main"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    placeholder="+211..."
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-ghost uppercase tracking-wider mb-1.5 block">Email</label>
                  <input 
                    className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors text-main"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    placeholder="email@company.com"
                  />
                </div>
              </div>

              <div className="col-span-2">
                <label className="text-[10px] font-bold text-ghost uppercase tracking-wider mb-1.5 block">Specialization / Notes</label>
                <textarea 
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors min-h-[80px] text-main"
                  value={formData.specialization}
                  onChange={e => setFormData({...formData, specialization: e.target.value})}
                  placeholder="What do they supply? Any specific brands or services?"
                />
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] font-bold text-ghost uppercase tracking-wider mb-1.5 block">Rating (1-5)</label>
                <input 
                  type="number"
                  min="1"
                  max="5"
                  step="0.1"
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors text-main"
                  value={formData.rating || ''}
                  onChange={e => setFormData({...formData, rating: parseFloat(e.target.value)})}
                  placeholder="e.g. 4.5"
                />
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] font-bold text-ghost uppercase tracking-wider mb-1.5 block">On-Time Delivery Rate (%)</label>
                <input 
                  type="number"
                  min="0"
                  max="100"
                  className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors text-main"
                  value={formData.on_time_delivery_rate || ''}
                  onChange={e => setFormData({...formData, on_time_delivery_rate: parseFloat(e.target.value)})}
                  placeholder="e.g. 95"
                />
              </div>

              {isGodMode && (
                <div className="col-span-2 md:col-span-1">
                  <label className="text-[10px] font-bold text-ghost uppercase tracking-wider mb-1.5 block">Library Tier</label>
                  <select 
                    className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors text-main"
                    value={formData.library_tier}
                    onChange={e => setFormData({...formData, library_tier: e.target.value as any})}
                  >
                    <option value="company">Company (Tenant Only)</option>
                    <option value="global">Global (All Tenants)</option>
                  </select>
                </div>
              )}

              <div className="col-span-2 flex items-center gap-6 pt-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={cn(
                    "w-5 h-5 rounded border flex items-center justify-center transition-all",
                    formData.preferred ? "bg-primary border-primary" : "border-border-subtle bg-surface-base group-hover:border-ghost"
                  )}>
                    {formData.preferred && <CheckCircle2 className="w-3.5 h-3.5 text-surface-base" />}
                  </div>
                  <input 
                    type="checkbox"
                    className="hidden"
                    checked={formData.preferred}
                    onChange={e => setFormData({...formData, preferred: e.target.checked})}
                  />
                  <span className="text-sm text-main">Preferred Supplier</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={cn(
                    "w-5 h-5 rounded border flex items-center justify-center transition-all",
                    formData.is_active ? "bg-primary border-primary" : "border-border-subtle bg-surface-base group-hover:border-ghost"
                  )}>
                    {formData.is_active && <CheckCircle2 className="w-3.5 h-3.5 text-surface-base" />}
                  </div>
                  <input 
                    type="checkbox"
                    className="hidden"
                    checked={formData.is_active}
                    onChange={e => setFormData({...formData, is_active: e.target.checked})}
                  />
                  <span className="text-sm text-main">Active</span>
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-border-subtle flex justify-end gap-3">
              <button 
                onClick={() => {
                  setIsAdding(false);
                  setEditingSupplier(null);
                }}
                className="px-4 py-2 text-sm font-bold text-ghost hover:text-main transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-2 bg-primary hover:bg-primary/90 text-surface-base font-bold rounded-lg transition-all"
              >
                {editingSupplier ? 'Update Supplier' : 'Save Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Price History Modal */}
      {showPriceHistory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-main">Price History</h2>
                  <p className="text-sm text-ghost mt-1">{showPriceHistory.company_name}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPriceHistory(null)}
                className="w-10 h-10 rounded-full bg-surface-2 border border-border-subtle flex items-center justify-center hover:bg-surface-base transition-colors"
              >
                <X className="w-5 h-5 text-ghost" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-surface-2 rounded-lg border border-border-subtle">
                  <div className="flex flex-col">
                    <span className="text-xs text-ghost">Last Quoted Rate</span>
                    <span className="text-lg font-bold text-primary">
                      {showPriceHistory.last_quoted_rate ? `$${showPriceHistory.last_quoted_rate.toLocaleString()}` : 'N/A'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-ghost uppercase tracking-widest">Updated</span>
                    <div className="text-xs text-main">
                      {new Date(showPriceHistory.created_at as any).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="text-center py-8 border-2 border-dashed border-border-subtle rounded-xl">
                  <p className="text-sm text-ghost">Detailed price history tracking will be available soon.</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-border-subtle flex justify-end">
              <button 
                onClick={() => setShowPriceHistory(null)}
                className="px-6 py-2 bg-surface-base hover:bg-surface-2 text-main font-bold rounded-lg transition-all border border-border-subtle"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Documents Modal */}
      {showDocuments && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-main">Supplier Documents</h2>
                  <p className="text-sm text-ghost mt-1">{showDocuments.company_name}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowDocuments(null)}
                className="w-10 h-10 rounded-full bg-surface-2 border border-border-subtle flex items-center justify-center hover:bg-surface-base transition-colors"
              >
                <X className="w-5 h-5 text-ghost" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-surface-2 rounded-lg border border-border-subtle group hover:border-accent/30 transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-danger/10 flex items-center justify-center text-danger">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-main">Trade License 2024.pdf</span>
                      <span className="text-[10px] text-ghost">Added on 12 Mar 2024 • 1.2 MB</span>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-ghost group-hover:text-accent" />
                </div>

                <div className="flex items-center justify-between p-3 bg-surface-2 rounded-lg border border-border-subtle group hover:border-accent/30 transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center text-accent">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-main">Quality Certification.pdf</span>
                      <span className="text-[10px] text-ghost">Added on 05 Feb 2024 • 2.4 MB</span>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-ghost group-hover:text-accent" />
                </div>

                <button className="w-full py-3 border-2 border-dashed border-border-subtle rounded-xl text-sm text-ghost hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  Upload New Document
                </button>
              </div>
            </div>

            <div className="p-6 border-t border-border-subtle flex justify-end">
              <button 
                onClick={() => setShowDocuments(null)}
                className="px-6 py-2 bg-surface-base hover:bg-surface-2 text-main font-bold rounded-lg transition-all border border-border-subtle"
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
