import React, { useState, useRef } from 'react';
import { X, Building2, MapPin, Hash, Calendar, DollarSign, User, Briefcase, FileUp, Download } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

export function ProjectModal({ isOpen, onClose, onSave }: ProjectModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    project_code: '',
    location: 'Addis Ababa',
    project_type: 'Building',
    start_date: '',
    end_date: '',
    contract_value: 0,
    client_name: '',
    status: 'active'
  });

  const [boqData, setBoqData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[ProjectModal] handleExcelImport triggered');
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);
      
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) throw new Error('No worksheet found in file.');

      const data: any[] = [];
      const headerRow = worksheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value);
      });

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip headers
        const rowData: any = {};
        row.eachCell((cell, colNumber) => {
          rowData[headers[colNumber]] = cell.value;
        });
        data.push(rowData);
      });

      console.log('[ProjectModal] Parsed rows:', data.length);
      
      // Basic validation and mapping for BOQ
      const formattedBoq = data.map((row: any) => ({
        item_no: row['Item No'] || row['item_no'] || row['No'] || row['Item'] || '',
        description: row['Description'] || row['description'] || row['Name'] || row['Item Name'] || '',
        unit: row['Unit'] || row['unit'] || 'Unit',
        contract_qty: parseFloat(row['Qty'] || row['qty'] || row['Quantity'] || 0),
        contract_rate: parseFloat(row['Rate'] || row['rate'] || row['Unit Rate'] || 0),
        contract_amount: parseFloat(row['Amount'] || row['amount'] || row['Total'] || 0),
        bill_no: row['Bill No'] || row['bill_no'] || row['Bill'] || 'Bill 1'
      })).filter(item => item.description);

      if (formattedBoq.length === 0) {
        alert('No valid BOQ items found. Ensure you have a "Description" or "Name" column.');
        return;
      }

      setBoqData(formattedBoq);
      alert(`Successfully parsed ${formattedBoq.length} BOQ items from Excel.`);
    } catch (err: any) {
      console.error('[ProjectModal] Error parsing BOQ:', err);
      alert('Error parsing BOQ: ' + err.message);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const downloadBoqTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('BOQ_Template');
    
    sheet.columns = [
      { header: 'Bill No', key: 'bill_no' },
      { header: 'Item No', key: 'item_no' },
      { header: 'Description', key: 'description' },
      { header: 'Unit', key: 'unit' },
      { header: 'Qty', key: 'qty' },
      { header: 'Rate', key: 'rate' },
      { header: 'Amount', key: 'amount' }
    ];

    sheet.addRow({ bill_no: 'Bill 1', item_no: '1.1', description: 'Excavation in bulk', unit: 'm3', qty: 150, rate: 450, amount: 67500 });
    sheet.addRow({ bill_no: 'Bill 1', item_no: '1.2', description: 'Concrete C-25', unit: 'm3', qty: 45, rate: 12500, amount: 562500 });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'BOQ_Import_Template.xlsx');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-4xl my-8 overflow-hidden shadow-2xl flex flex-col">
        <div className="p-6 border-b border-border-subtle flex items-center justify-between bg-surface-2/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-main">Create New Project</h2>
              <p className="text-[11px] text-dim uppercase tracking-widest">Project Initialization & BOQ Setup</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-2 rounded-lg transition-colors text-dim">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8 text-main">
          {/* Left Column: Basic Info */}
          <div className="flex flex-col gap-5">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-2">Basic Information</h3>
            
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-dim">Project Name</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                <input 
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Riverside Apartments"
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-primary transition-all text-main placeholder:text-ghost"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-dim">Project Code</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                  <input 
                    type="text"
                    value={formData.project_code}
                    onChange={(e) => setFormData({...formData, project_code: e.target.value})}
                    placeholder="PRJ-001"
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-primary transition-all text-main placeholder:text-ghost"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-dim">Type</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                  <select 
                    value={formData.project_type}
                    onChange={(e) => setFormData({...formData, project_type: e.target.value})}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-primary transition-all appearance-none text-main"
                  >
                    <option value="Building">Building</option>
                    <option value="Road">Road</option>
                    <option value="Water">Water</option>
                    <option value="Industrial">Industrial</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-dim">Client Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                <input 
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                  placeholder="e.g. Ministry of Urban Development"
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-primary transition-all text-main placeholder:text-ghost"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-dim">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                <input 
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="e.g. Addis Ababa"
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-primary transition-all text-main placeholder:text-ghost"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Contract & BOQ */}
          <div className="flex flex-col gap-5">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-info mb-2">Contract & BOQ Setup</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-dim">Start Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                  <input 
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-primary transition-all text-main"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-dim">End Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                  <input 
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm outline-none focus:border-primary transition-all text-main"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-dim">Contract Value (USD)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ghost" />
                <input 
                  type="number"
                  value={formData.contract_value}
                  onChange={(e) => setFormData({...formData, contract_value: parseFloat(e.target.value) || 0})}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm font-mono outline-none focus:border-primary transition-all text-main"
                />
              </div>
            </div>

            <div className="mt-4 p-5 bg-surface-2 border border-dashed border-border-subtle rounded-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-widest text-dim">BOQ Excel Import</label>
                <button 
                  type="button"
                  onClick={downloadBoqTemplate}
                  className="text-[10px] font-bold text-info hover:underline flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  Template
                </button>
              </div>
              
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border-subtle hover:border-primary rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-all group bg-transparent"
              >
                <FileUp className="w-8 h-8 text-ghost group-hover:text-primary transition-colors" />
                <span className="text-xs font-medium text-ghost group-hover:text-main">
                  {boqData.length > 0 ? `${boqData.length} items loaded` : 'Click to upload BOQ Excel'}
                </span>
              </button>
              <input 
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".xlsx, .xls"
                onChange={handleExcelImport}
              />
              <p className="text-[10px] text-dim leading-relaxed">
                Importing a BOQ here will automatically populate the project's Bill of Quantities upon creation.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-surface-2/50 border-t border-border-subtle flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase text-dim">Total Contract Value</span>
            <span className="text-lg font-mono font-bold text-primary">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(formData.contract_value)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-bold text-dim hover:text-main transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => onSave({ ...formData, boq: boqData })}
              disabled={!formData.name || !formData.project_code}
              className="bg-primary text-black px-8 py-2.5 rounded-xl text-sm font-bold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(0,200,150,0.2)]"
            >
              Initialize Project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
