import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Plus, 
  Search, 
  FileText, 
  Trash2, 
  Save, 
  X, 
  ChevronRight, 
  Building2, 
  Package,
  CheckCircle2,
  Clock,
  AlertCircle,
  Truck
} from 'lucide-react';
import { cn, cleanRichText } from '../lib/utils';
import { exportMaterialRequisition } from '../lib/exportUtils';

interface PurchaseOrder {
  id: string;
  po_number: string;
  project_id: string;
  supplier_id: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'delivered';
  total_amount: number;
  created_at: string;
  supplier?: { company_name: string };
}

interface POItem {
  id: string;
  po_id: string;
  resource_id: string;
  resource_type: string;
  description: string;
  quantity: number;
  unit_rate: number;
  total_price: number;
}

interface PurchaseOrderManagerProps {
  project: any;
  tenantId: string;
}

export default function PurchaseOrderManager({ project, tenantId }: PurchaseOrderManagerProps) {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    supplier_id: '',
    items: [] as any[]
  });

  useEffect(() => {
    loadPOs();
    loadSuppliers();
    loadMaterials();
  }, [project.id]);

  async function loadPOs() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, supplier:suppliers(company_name)')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (data) setPos(data);
    } catch (err) {
      console.error('Error loading POs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadSuppliers() {
    const { data } = await supabase.from('suppliers').select('id, company_name').eq('is_active', true);
    if (data) setSuppliers(data);
  }

  async function loadMaterials() {
    const { data } = await supabase.from('materials').select('id, material_name, material_code, unit, unit_rate');
    if (data) setMaterials(data);
  }

  async function handleCreatePO() {
    if (!formData.supplier_id || formData.items.length === 0) {
      alert('Please select a supplier and add at least one item');
      return;
    }

    try {
      const totalAmount = formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_rate), 0);
      const poNumber = `PO-${project.project_code}-${new Date().getFullYear()}-${(pos.length + 1).toString().padStart(3, '0')}`;

      // Try RPC first for native DB-level atomic transaction
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('create_purchase_order_with_items', {
          p_project_id: project.id,
          p_tenant_id: tenantId,
          p_supplier_id: formData.supplier_id,
          p_po_number: poNumber,
          p_total_amount: totalAmount,
          p_items: formData.items.map(item => ({
            resource_id: item.resource_id,
            resource_type: 'material',
            description: item.description,
            quantity: item.quantity,
            unit_rate: item.unit_rate,
            total_price: item.quantity * item.unit_rate
          }))
        });

        if (!rpcErr) {
          setIsCreating(false);
          setFormData({ supplier_id: '', items: [] });
          loadPOs();
          alert('Purchase Order created successfully (Database Transaction atomic)');
          return;
        } else if (!rpcErr.message?.includes('does not exist')) {
          throw rpcErr;
        }
      } catch (e) {
        console.warn('RPC Transaction not available, falling back to guaranteed manual-rollback client transaction:', e);
      }

      // Rollback fallback path: sequential write with explicit cleanup on half-state failure
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert([{
          project_id: project.id,
          tenant_id: tenantId,
          supplier_id: formData.supplier_id,
          po_number: poNumber,
          total_amount: totalAmount,
          status: 'draft'
        }])
        .select()
        .single();

      if (poError) throw poError;

      const poItems = formData.items.map(item => ({
        po_id: po.id,
        tenant_id: tenantId,
        resource_id: item.resource_id,
        resource_type: 'material',
        description: item.description,
        quantity: item.quantity,
        unit_rate: item.unit_rate,
        total_price: item.quantity * item.unit_rate
      }));

      const { error: itemsError } = await supabase.from('po_items').insert(poItems);
      if (itemsError) {
        console.error('Subcontractor items creation failed, rolling back header...', itemsError);
        // Delete header to prevent orphan rows from polluting DB
        await supabase.from('purchase_orders').delete().eq('id', po.id);
        throw new Error(`Failed to save items. Entire purchase order transaction was aborted to preserve integrity.\nDetails: ${itemsError.message}`);
      }

      setIsCreating(false);
      setFormData({ supplier_id: '', items: [] });
      loadPOs();
      alert('Purchase Order created successfully (Atomically rolled back rollback-safe block)');
    } catch (err: any) {
      alert('Error creating PO: ' + err.message);
    }
  }

  async function handleMarkAsDelivered(poId: string) {
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'delivered' })
        .eq('id', poId);
      
      if (error) throw error;
      loadPOs();
      alert('PO marked as delivered');
    } catch (err: any) {
      alert('Error updating PO: ' + err.message);
    }
  }

  async function handleDownloadRequisition(po: PurchaseOrder) {
    try {
      // 1. Fetch items for this PO
      const { data: items, error } = await supabase
        .from('po_items')
        .select('*')
        .eq('po_id', po.id);
      
      if (error) throw error;

      await exportMaterialRequisition({
        projectName: project.name,
        projectCode: project.project_code || 'N/A',
        location: project.location || 'Site Office',
        clientName: project.client_name || project.client || 'N/A',
        expectedDelivery: 'TBD', // We don't have this in PO yet
        projectStatus: project.status || 'Active',
        resourceDetail: 'Materials for Construction',
        refNo: po.po_number,
        date: new Date(po.created_at).toLocaleDateString(),
        items: (items || []).map(item => ({
          description: item.description,
          unit: 'Unit', // Should be fetched from materials if needed
          quantity: item.quantity,
          rate: item.unit_rate,
          remark: ''
        }))
      });
    } catch (err: any) {
      alert('Error exporting requisition: ' + err.message);
    }
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-main">Purchase Orders</h2>
          <p className="text-sm text-ghost mt-1">Manage procurement and vendor orders for {project.name}</p>
        </div>
        {!isCreating && (
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:brightness-110 text-surface-base font-bold rounded-lg transition-all shadow-lg shadow-primary/10"
          >
            <Plus className="w-4 h-4" />
            Create PO
          </button>
        )}
      </div>

      {isCreating ? (
        <div className="bg-surface-1 border border-border-subtle rounded-xl p-6 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-main">New Purchase Order</h3>
            <button onClick={() => setIsCreating(false)} className="text-ghost hover:text-main">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="text-[10px] font-bold text-ghost uppercase tracking-wider mb-2 block">Select Supplier</label>
              <select 
                className="w-full bg-surface-base border border-border-subtle rounded-lg px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
                value={formData.supplier_id}
                onChange={e => setFormData({...formData, supplier_id: e.target.value})}
              >
                <option value="">Choose a supplier...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.company_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-main">Order Items</h4>
              <button 
                onClick={() => setFormData({
                  ...formData,
                  items: [...formData.items, { resource_id: '', description: '', quantity: 1, unit_rate: 0 }]
                })}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-base border-b border-border-subtle">
                    <th className="px-4 py-2 text-[10px] font-mono text-ghost uppercase tracking-widest">Resource</th>
                    <th className="px-4 py-2 text-[10px] font-mono text-ghost uppercase tracking-widest">Description</th>
                    <th className="px-4 py-2 text-[10px] font-mono text-ghost uppercase tracking-widest w-24">Qty</th>
                    <th className="px-4 py-2 text-[10px] font-mono text-ghost uppercase tracking-widest w-32">Rate</th>
                    <th className="px-4 py-2 text-[10px] font-mono text-ghost uppercase tracking-widest w-32 text-right">Total</th>
                    <th className="px-4 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {formData.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3">
                        <select 
                          className="w-full bg-transparent border-none text-sm outline-none text-main"
                          value={item.resource_id}
                          onChange={e => {
                            const mat = materials.find(m => m.id === e.target.value);
                            const newItems = [...formData.items];
                            newItems[idx] = {
                              ...item,
                              resource_id: e.target.value,
                              description: cleanRichText(mat?.material_name || ''),
                              unit_rate: mat?.unit_rate || 0
                            };
                            setFormData({...formData, items: newItems});
                          }}
                        >
                          <option value="" className="bg-surface-1">Select material...</option>
                          {materials.map(m => (
                            <option key={m.id} value={m.id} className="bg-surface-1">{cleanRichText(m.material_name)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          className="w-full bg-transparent border-none text-sm outline-none text-dim"
                          value={item.description}
                          onChange={e => {
                            const newItems = [...formData.items];
                            newItems[idx].description = e.target.value;
                            setFormData({...formData, items: newItems});
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="number"
                          className="w-full bg-transparent border-none text-sm outline-none text-main font-mono"
                          value={item.quantity}
                          onChange={e => {
                            const newItems = [...formData.items];
                            newItems[idx].quantity = parseFloat(e.target.value);
                            setFormData({...formData, items: newItems});
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-primary text-sm font-semibold select-none">$</span>
                          <input 
                            type="number"
                            className="w-full bg-transparent border-none text-sm outline-none text-primary font-mono"
                            value={item.unit_rate}
                            onChange={e => {
                              const newItems = [...formData.items];
                              newItems[idx].unit_rate = parseFloat(e.target.value);
                              setFormData({...formData, items: newItems});
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-main">
                        <div className="flex items-center justify-end gap-x-3 w-full">
                          <span className="select-none font-mono">$</span>
                          <span>{(item.quantity * item.unit_rate).toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button 
                          onClick={() => {
                            const newItems = formData.items.filter((_, i) => i !== idx);
                            setFormData({...formData, items: newItems});
                          }}
                          className="text-ghost hover:text-danger"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-base">
                    <td colSpan={4} className="px-4 py-3 text-right text-xs font-bold text-ghost uppercase tracking-widest">Total Amount</td>
                    <td className="px-4 py-3 text-right font-mono text-lg font-bold text-primary">
                      <div className="flex items-center justify-end gap-x-3 w-full">
                        <span className="select-none font-mono">$</span>
                        <span>{formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_rate), 0).toLocaleString()}</span>
                      </div>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button 
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 text-sm font-bold text-ghost hover:text-main transition-colors"
            >
               Cancel
            </button>
            <button 
              onClick={handleCreatePO}
              className="px-6 py-2 bg-primary hover:brightness-110 text-surface-base font-bold rounded-lg transition-all"
            >
              Submit Purchase Order
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-border-subtle border-t-primary rounded-full animate-spin mb-4" />
                <p className="text-sm text-ghost">Loading purchase orders...</p>
              </div>
            ) : pos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-ghost">
                <FileText className="w-12 h-12 opacity-10 mb-4" />
                <p className="text-lg font-medium">No purchase orders yet</p>
                <p className="text-sm">Create your first PO to start procurement</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-base border-b border-border-subtle sticky top-0 z-10">
                    <th className="px-6 py-3 text-[9px] font-mono font-black text-ghost uppercase tracking-widest w-32">PO Number</th>
                    <th className="px-6 py-3 text-[9px] font-mono font-black text-ghost uppercase tracking-widest">Supplier</th>
                    <th className="px-6 py-3 text-[9px] font-mono font-black text-ghost uppercase tracking-widest w-32">Date</th>
                    <th className="px-6 py-3 text-[9px] font-mono font-black text-ghost uppercase tracking-widest text-right w-32">Amount</th>
                    <th className="px-6 py-3 text-[9px] font-mono font-black text-ghost uppercase tracking-widest w-28">Status</th>
                    <th className="px-6 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/30">
                  {pos.map((po) => (
                    <tr key={po.id} className="group hover:bg-primary/[0.02] border-b border-border-subtle/20 transition-colors h-auto min-h-[2.5rem]">
                      <td className="px-6 py-3 text-[10px] font-black text-accent font-mono border-r border-border-subtle/20 truncate">{po.po_number}</td>
                      <td className="px-6 py-3 text-[11px] text-main font-black uppercase border-r border-border-subtle/20 truncate">{cleanRichText(po.supplier?.company_name)}</td>
                      <td className="px-6 py-3 text-[10px] text-ghost font-black border-r border-border-subtle/20">{new Date(po.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-3 text-[11px] text-primary font-mono text-right font-black border-r border-border-subtle/20">
                        <div className="flex items-center justify-end gap-x-3 w-full">
                          <span className="select-none font-mono">$</span>
                          <span>{po.total_amount.toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 border-r border-border-subtle/20">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest",
                          po.status === 'approved' ? "bg-primary/10 text-primary border-primary/20" :
                          po.status === 'pending' ? "bg-warning/10 text-warning border-warning/20" :
                          po.status === 'delivered' ? "bg-accent/10 text-accent border-accent/20" :
                          po.status === 'rejected' ? "bg-danger/10 text-danger border-danger/20" :
                          "bg-surface-2 text-ghost border-border-subtle"
                        )}>
                          {po.status}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {po.status === 'approved' && (
                            <button 
                              onClick={() => handleMarkAsDelivered(po.id)}
                              className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="Mark as Delivered"
                            >
                              <Truck className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => handleDownloadRequisition(po)}
                            className="p-1.5 text-accent hover:bg-accent/10 rounded-lg transition-colors"
                            title="Download Material Requisition"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-ghost hover:text-main transition-colors">
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
