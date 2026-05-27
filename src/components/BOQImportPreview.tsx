import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, AlertCircle, Table, ChevronRight, Loader2 } from 'lucide-react';
import { cn, cleanRichText } from '../lib/utils';

interface BOQImportPreviewProps {
  data: any[];
  onConfirm: (mappedData: any[]) => void;
  onCancel: () => void;
}

export function BOQImportPreview({ data, onConfirm, onCancel }: BOQImportPreviewProps) {
  const targetFields = [
    { key: 'item_no', label: 'Item No', required: false },
    { key: 'description', label: 'Description', required: true },
    { key: 'unit', label: 'Unit', required: false },
    { key: 'contract_qty', label: 'Quantity', required: true },
    { key: 'contract_rate', label: 'Rate', required: false },
    { key: 'contract_amount', label: 'Amount', required: false },
    { key: 'surveyed_qty', label: 'Surveyed Quantity', required: false },
    { key: 'bill_no', label: 'Bill No', required: false }
  ];

  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [previewData, setPreviewData] = useState<any[]>([]);
  
  const columns = useMemo(() => data.length > 0 ? Object.keys(data[0]) : [], [data]);
  
  // Ensure we show at least 8 columns in the preview if they exist
  const previewColumns = useMemo(() => columns.length > 8 ? columns : columns, [columns]); 

  useEffect(() => {
    // Auto-map based on common names
    const newMapping: Record<string, string> = {};
    columns.forEach(col => {
      const lowerCol = col.toLowerCase();
      if (lowerCol.includes('no') && !lowerCol.includes('bill')) newMapping['item_no'] = col;
      if (lowerCol.includes('description') || lowerCol.includes('item name') || lowerCol.includes('name')) newMapping['description'] = col;
      if (lowerCol.includes('unit')) newMapping['unit'] = col;
      if (lowerCol.includes('qty') || lowerCol.includes('quantity')) {
        if (lowerCol.includes('surveyed')) {
          newMapping['surveyed_qty'] = col;
        } else {
          newMapping['contract_qty'] = col;
        }
      }
      if (lowerCol.includes('rate') || lowerCol.includes('unit rate')) newMapping['contract_rate'] = col;
      if (lowerCol.includes('amount') || lowerCol.includes('total')) newMapping['contract_amount'] = col;
      if (lowerCol.includes('bill')) newMapping['bill_no'] = col;
    });
    setMapping(newMapping);
  }, [columns]);

  const handleConfirm = () => {
    const formattedData = data.map((row, index) => {
      const item: any = {
        status: 'draft',
        item_sequence: index
      };
      targetFields.forEach(field => {
        const sourceCol = mapping[field.key];
        if (sourceCol) {
          let value = row[sourceCol];
          if (field.key.includes('qty') || field.key.includes('rate') || field.key.includes('amount') || field.key === 'surveyed_qty') {
            value = parseFloat(value) || 0;
          }
          item[field.key] = value ?? (field.key === 'unit' ? '' : null);
        } else if (field.key === 'unit') {
          item[field.key] = '';
        } else if (field.key.includes('qty') || field.key.includes('rate') || field.key.includes('amount') || field.key === 'surveyed_qty') {
          item[field.key] = 0;
        }
      });
      return item;
    }).filter(item => item.description);

    onConfirm(formattedData);
  };

  const isReady = targetFields.filter(f => f.required).every(f => mapping[f.key]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-border-subtle flex items-center justify-between bg-surface-2/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-main">Import Preview</h2>
              <p className="text-xs text-dim font-mono uppercase tracking-widest mt-0.5">Map columns and verify data</p>
              <p className="text-[11px] text-warning mt-2 bg-warning/10 border border-warning/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Make sure the first row has all the column names and you have a clean and ready BoQ file.</span>
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-border-subtle rounded-lg transition-colors">
            <X className="w-5 h-5 text-dim" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Mapping Side */}
          <div className="w-full lg:w-80 border-r border-border-subtle p-6 bg-surface-2/20 overflow-y-auto text-main text-[11px]">
            <h3 className="text-xs font-bold text-main uppercase tracking-widest mb-4 flex items-center gap-2">
              <ChevronRight className="w-3 h-3 text-primary" />
              Column Mapping
            </h3>
            <p className="text-[10px] text-dim mb-4 leading-relaxed">
              We've attempted to auto-detect your columns. Please verify and adjust the mappings below to match your Excel file.
            </p>
            <div className="flex flex-col gap-5">
              {targetFields.map(field => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-ghost uppercase tracking-wider flex items-center justify-between">
                    {field.label}
                    {field.required && <span className="text-error text-[9px]">* Required</span>}
                  </label>
                  <select
                    className={cn(
                      "bg-surface-3 border rounded-lg text-sm p-2.5 outline-none transition-all",
                      mapping[field.key] ? "border-primary/50 text-main" : "border-border-subtle text-dim"
                    )}
                    value={mapping[field.key] || ''}
                    onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                  >
                    <option value="">Select column...</option>
                    {columns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview Side */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 bg-surface-1 border-b border-border-subtle flex items-center justify-between">
              <span className="text-xs font-mono text-dim uppercase tracking-widest">Data Preview (First 35 rows)</span>
              <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 font-bold">
                {data.length} Total Items
              </span>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-surface-2 z-10 shadow-sm">
                  <tr>
                    {columns.map(col => (
                      <th key={col} className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-dim border-b border-border-subtle whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-main">
                  {data.slice(0, 35).map((row, i) => (
                    <tr key={i} className="hover:bg-surface-2/30 transition-colors">
                      {columns.map(col => (
                        <td key={col} className="px-4 py-3 text-[12px] text-ghost whitespace-nowrap">
                          {cleanRichText(row[col]) || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-border-subtle flex items-center justify-between bg-surface-2/50 rounded-b-2xl">
          <div className="flex items-center gap-3 text-error text-xs">
            {!isReady && (
              <>
                <AlertCircle className="w-4 h-4" />
                <span>Please map all required fields to continue</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onCancel}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-dim hover:text-main transition-colors"
            >
              Cancel
            </button>
            <button 
              disabled={!isReady}
              onClick={handleConfirm}
              className={cn(
                "px-8 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg",
                isReady 
                  ? "bg-primary text-surface-base hover:bg-primary/90 active:scale-95 shadow-[0_0_20px_rgba(var(--color-primary),0.15)]" 
                  : "bg-surface-2 text-ghost cursor-not-allowed"
              )}
            >
              <Check className="w-4 h-4" />
              Import {data.length} Items
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
