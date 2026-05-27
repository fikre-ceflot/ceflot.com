import React, { useState, useEffect } from 'react';
import { X, Calculator, Check, AlertCircle, ChevronRight, Info, Plus, Trash2, Settings2, Table as TableIcon } from 'lucide-react';
import { cn, cleanRichText } from '../lib/utils';

interface ConsumptionCalculatorProps {
  resourceName: string;
  resourceUnit: string;
  boqUnit: string;
  resourceType?: string;
  onConfirm: (rate: number) => void;
  onClose: () => void;
}

type CalcMode = 'standard' | 'reinforcement' | 'roofing' | 'tiles' | 'fabrication';

interface CalcRow {
  id: string;
  description: string;
  count: number;
  length: number;
  width: number;
  depth: number;
  spacing: number;
  lap_pct: number;
  wastage_pct: number;
  // Specialized fields
  diameter?: number; // for rebar
  pitch?: number; // for roofing
  gap?: number; // for tiles
  panes?: number; // for windows
}

export function ConsumptionCalculator({ resourceName, resourceUnit, boqUnit, resourceType, onConfirm, onClose }: ConsumptionCalculatorProps) {
  const [mode, setMode] = useState<CalcMode>(
    resourceName.toLowerCase().includes('rebar') || resourceName.toLowerCase().includes('steel') ? 'reinforcement' :
    resourceName.toLowerCase().includes('sheet') || resourceName.toLowerCase().includes('roof') ? 'roofing' :
    resourceName.toLowerCase().includes('tile') || resourceName.toLowerCase().includes('block') ? 'tiles' : 'standard'
  );

  const [rows, setRows] = useState<CalcRow[]>([
    { id: '1', description: 'Main Element', count: 1, length: 0, width: 0, depth: 0, spacing: 0, lap_pct: 0, wastage_pct: 5 }
  ]);
  const [standardSize, setStandardSize] = useState<number>(6); 
  const [density, setDensity] = useState<number>(0); 
  const [result, setResult] = useState<number>(0);

  const addRow = () => {
    setRows([...rows, { 
      id: Math.random().toString(36).substr(2, 9), 
      description: 'Additional Element', 
      count: 1, 
      length: 0, 
      width: 0, 
      depth: 0, 
      spacing: 0, 
      lap_pct: 0, 
      wastage_pct: 5,
      diameter: mode === 'reinforcement' ? 12 : undefined
    }]);
  };

  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter(r => r.id !== id));
    }
  };

  const updateRow = (id: string, field: keyof CalcRow, value: any) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const calculate = () => {
    let totalRate = 0;

    rows.forEach(row => {
      let rowRate = 0;
      const waste = 1 + (row.wastage_pct / 100);
      const lap = 1 + (row.lap_pct / 100);

      switch (mode) {
        case 'reinforcement':
          // Rebar weight calculation: (d^2 / 162.2) * length
          if (row.diameter && row.length) {
            const unitWeight = (row.diameter * row.diameter) / 162.2;
            rowRate = unitWeight * row.length * row.count * waste * lap;
          }
          break;

        case 'roofing':
          // Area coverage with slope and overlap
          // Total Area = Base Area / Cos(Pitch)
          const slopeFactor = row.pitch ? 1 / Math.cos((row.pitch * Math.PI) / 180) : 1;
          if (row.width && row.length) {
             const effectiveArea = row.width * row.length;
             rowRate = (effectiveArea * slopeFactor * row.count * waste * lap);
          } else if (row.spacing > 0) {
             // Linear roofing members (Purlins/Rafters)
             rowRate = (1 / row.spacing) * slopeFactor * row.count * waste * lap;
          }
          break;

        case 'tiles':
          // Tile count calculation: Area / ( (L+Gap) * (W+Gap) )
          if (row.length && row.width) {
            const gap = (row.gap || 0) / 1000; // mm to m
            const tileArea = (row.length + gap) * (row.width + gap);
            rowRate = (1 / tileArea) * row.count * waste;
          }
          break;

        case 'fabrication':
          // Window/Door perimeter/frame calc
          if (row.length && row.width) {
             const perimeter = (row.length * 2) + (row.width * 2);
             const panes = row.panes || 1;
             rowRate = (perimeter + (panes > 1 ? row.length * (panes - 1) : 0)) * row.count * waste;
          }
          break;

        default:
          // Standard Logic
          const bUnit = (boqUnit || '').toLowerCase();
          const rUnit = (resourceUnit || '').toLowerCase();

          const isArea = bUnit.includes('m2');
          const isVolume = bUnit.includes('m3');
          const isLinear = bUnit.includes('m') && !isArea && !isVolume;

          if (isArea) {
            if (row.spacing > 0) rowRate = (1 / row.spacing) * waste * lap * row.count;
            else if (row.depth > 0) rowRate = row.depth * waste * row.count;
            else rowRate = row.count * waste * lap;
          } else if (isVolume) {
            rowRate = row.count * waste;
          } else {
            rowRate = (row.length || 1) * (row.width || 1) * (row.depth || 1) * row.count * waste * lap;
          }
          break;
      }

      totalRate += rowRate;
    });

    setResult(Number(totalRate.toFixed(4)));
  };

  useEffect(() => {
    calculate();
  }, [rows, density, standardSize]);

  return (
    <div className="fixed inset-0 bg-surface-base/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
      <div className="bg-surface-base border border-border-subtle rounded-2xl w-full max-w-6xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border-subtle flex items-center justify-between bg-surface-1 rounded-t-2xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-main tracking-tight">Engineering Consumption Calculator</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-dim font-mono uppercase tracking-widest">Resource:</span>
                <span className="text-[10px] font-bold text-accent uppercase">{cleanRichText(resourceName)} ({cleanRichText(resourceUnit)})</span>
                <span className="text-border-subtle">|</span>
                <span className="text-[10px] text-dim font-mono uppercase tracking-widest">Per BOQ Unit:</span>
                <span className="text-[10px] font-bold text-primary uppercase">{cleanRichText(boqUnit)}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-2 rounded-lg transition-colors">
            <X className="w-6 h-6 text-dim" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar Settings */}
          <div className="w-64 border-r border-border-subtle p-6 bg-surface-1/30 flex flex-col gap-6">
            <div>
              <div className="flex items-center gap-2 text-dim mb-3">
                <Settings2 className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Calculator Mode</span>
              </div>
              <div className="flex flex-col gap-2">
                {(['standard', 'reinforcement', 'roofing', 'tiles', 'fabrication'] as CalcMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={cn(
                      "text-left px-3 py-2 rounded-lg text-xs font-bold transition-all border",
                      mode === m 
                        ? "bg-accent/10 text-accent border-accent/20" 
                        : "text-ghost border-transparent hover:bg-surface-2"
                    )}
                  >
                    {m.charAt(0) + m.slice(1).replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full h-px bg-border-subtle" />

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-widest text-dim">Global Parameter</label>
                <div className="relative">
                  <input 
                    type="number"
                    className="w-full bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-main outline-none focus:border-accent transition-colors"
                    value={mode === 'reinforcement' ? density || 7850 : standardSize}
                    onChange={e => mode === 'reinforcement' ? setDensity(parseFloat(e.target.value) || 0) : setStandardSize(parseFloat(e.target.value) || 0)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-ghost font-mono">
                    {mode === 'reinforcement' ? 'kg/m³' : 'm'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-auto bg-surface-2 p-4 rounded-xl border border-border-subtle">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-3.5 h-3.5 text-accent" />
                <span className="text-[10px] font-bold text-main uppercase">Pro Tip</span>
              </div>
              <p className="text-[10px] text-dim leading-relaxed">
                For linear members like rafters, use 'Spacing' to calculate LM/m². For items like doors, use 'Length' and 'Count' to sum up members.
              </p>
            </div>
          </div>

          {/* Main Excel-like Grid */}
          <div className="flex-1 flex flex-col bg-surface-base">
            <div className="flex-1 overflow-auto p-6">
              <div className="min-w-[800px]">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <th className="text-left py-3 px-4 text-[10px] font-mono uppercase tracking-widest text-dim">Description</th>
                      <th className="text-center py-3 px-2 text-[10px] font-mono uppercase tracking-widest text-dim w-20">Qty/Count</th>
                      
                      {mode === 'reinforcement' && (
                        <th className="text-center py-3 px-2 text-[10px] font-mono uppercase tracking-widest text-dim w-24">Diam (mm)</th>
                      )}
                      
                      {(mode === 'standard' || mode === 'roofing' || mode === 'fabrication' || mode === 'tiles') && (
                        <th className="text-center py-3 px-2 text-[10px] font-mono uppercase tracking-widest text-dim w-24">Length (m)</th>
                      )}
                      
                      {(mode === 'standard' || mode === 'roofing' || mode === 'fabrication' || mode === 'tiles') && (
                        <th className="text-center py-3 px-2 text-[10px] font-mono uppercase tracking-widest text-dim w-24">Width (m)</th>
                      )}

                      {mode === 'standard' && (
                        <th className="text-center py-3 px-2 text-[10px] font-mono uppercase tracking-widest text-dim w-24">Depth (m)</th>
                      )}

                      {mode === 'roofing' && (
                        <th className="text-center py-3 px-2 text-[10px] font-mono uppercase tracking-widest text-dim w-24">Pitch (°)</th>
                      )}

                      {mode === 'tiles' && (
                        <th className="text-center py-3 px-2 text-[10px] font-mono uppercase tracking-widest text-dim w-24">Grout (mm)</th>
                      )}

                      {mode === 'fabrication' && (
                        <th className="text-center py-3 px-2 text-[10px] font-mono uppercase tracking-widest text-dim w-24">Panes/Div</th>
                      )}

                      {(mode === 'standard' || mode === 'roofing') && (
                        <th className="text-center py-3 px-2 text-[10px] font-mono uppercase tracking-widest text-dim w-24">Spacing (m)</th>
                      )}

                      {(mode === 'standard' || mode === 'roofing' || mode === 'reinforcement') && (
                        <th className="text-center py-3 px-2 text-[10px] font-mono uppercase tracking-widest text-dim w-20">Lap %</th>
                      )}
                      
                      <th className="text-center py-3 px-2 text-[10px] font-mono uppercase tracking-widest text-dim w-20">Waste %</th>
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50">
                    {rows.map((row) => (
                      <tr key={row.id} className="group hover:bg-surface-1/30 transition-colors">
                        <td className="py-3 px-4">
                          <input 
                            type="text"
                            className="w-full bg-transparent border-none text-sm text-main outline-none focus:text-accent"
                            value={row.description}
                            onChange={e => updateRow(row.id, 'description', e.target.value)}
                          />
                        </td>
                        <td className="py-3 px-2">
                          <input 
                            type="number"
                            className="w-full bg-surface-1 border border-border-subtle rounded px-2 py-1 text-center text-sm text-main outline-none focus:border-accent"
                            value={row.count}
                            onChange={e => updateRow(row.id, 'count', parseFloat(e.target.value) || 0)}
                          />
                        </td>

                        {mode === 'reinforcement' && (
                          <td className="py-3 px-2">
                            <input 
                              type="number"
                              className="w-full bg-surface-1 border border-border-subtle rounded px-2 py-1 text-center text-sm text-accent outline-none focus:border-accent font-bold"
                              value={row.diameter}
                              onChange={e => updateRow(row.id, 'diameter', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                        )}

                        {(mode === 'standard' || mode === 'roofing' || mode === 'fabrication' || mode === 'tiles' || mode === 'reinforcement') && (
                          <td className="py-3 px-2">
                            <input 
                              type="number"
                              className="w-full bg-surface-1 border border-border-subtle rounded px-2 py-1 text-center text-sm text-main outline-none focus:border-accent"
                              value={row.length}
                              onChange={e => updateRow(row.id, 'length', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                        )}

                        {(mode === 'standard' || mode === 'roofing' || mode === 'fabrication' || mode === 'tiles') && (
                          <td className="py-3 px-2">
                            <input 
                              type="number"
                              className="w-full bg-surface-1 border border-border-subtle rounded px-2 py-1 text-center text-sm text-main outline-none focus:border-accent"
                              value={row.width}
                              onChange={e => updateRow(row.id, 'width', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                        )}

                        {mode === 'standard' && (
                          <td className="py-3 px-2">
                            <input 
                              type="number"
                              className="w-full bg-surface-1 border border-border-subtle rounded px-2 py-1 text-center text-sm text-main outline-none focus:border-accent"
                              value={row.depth}
                              onChange={e => updateRow(row.id, 'depth', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                        )}

                        {mode === 'roofing' && (
                          <td className="py-3 px-2">
                            <input 
                              type="number"
                              className="w-full bg-surface-1 border border-border-subtle rounded px-2 py-1 text-center text-sm text-main outline-none focus:border-accent"
                              value={row.pitch}
                              onChange={e => updateRow(row.id, 'pitch', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                        )}

                        {mode === 'tiles' && (
                          <td className="py-3 px-2">
                            <input 
                              type="number"
                              className="w-full bg-surface-1 border border-border-subtle rounded px-2 py-1 text-center text-sm text-main outline-none focus:border-accent"
                              value={row.gap}
                              onChange={e => updateRow(row.id, 'gap', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                        )}

                        {mode === 'fabrication' && (
                          <td className="py-3 px-2">
                            <input 
                              type="number"
                              className="w-full bg-surface-1 border border-border-subtle rounded px-2 py-1 text-center text-sm text-main outline-none focus:border-accent"
                              value={row.panes}
                              onChange={e => updateRow(row.id, 'panes', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                        )}

                        {(mode === 'standard' || mode === 'roofing') && (
                          <td className="py-3 px-2">
                            <input 
                              type="number"
                              className="w-full bg-surface-1 border border-border-subtle rounded px-2 py-1 text-center text-sm text-main outline-none focus:border-accent"
                              value={row.spacing}
                              onChange={e => updateRow(row.id, 'spacing', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                        )}

                        {(mode === 'standard' || mode === 'roofing' || mode === 'reinforcement') && (
                          <td className="py-3 px-2">
                            <input 
                              type="number"
                              className="w-full bg-surface-1 border border-border-subtle rounded px-2 py-1 text-center text-sm text-main outline-none focus:border-accent"
                              value={row.lap_pct}
                              onChange={e => updateRow(row.id, 'lap_pct', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                        )}

                        <td className="py-3 px-2">
                          <input 
                            type="number"
                            className="w-full bg-surface-1 border border-border-subtle rounded px-2 py-1 text-center text-sm text-main outline-none focus:border-accent"
                            value={row.wastage_pct}
                            onChange={e => updateRow(row.id, 'wastage_pct', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="py-3 px-2 text-center">
                          <button 
                            onClick={() => removeRow(row.id)}
                            className="p-1.5 text-ghost hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <button 
                  onClick={addRow}
                  className="mt-4 flex items-center gap-2 text-[10px] font-bold text-accent hover:text-accent/80 transition-colors px-4 py-2 rounded-lg border border-dashed border-border-subtle hover:border-accent w-full justify-center"
                >
                  <Plus className="w-3.5 h-3.5" />
                  ADD CALCULATION LINE
                </button>
              </div>
            </div>

            {/* Bottom Results Bar */}
            <div className="p-8 border-t border-border-subtle bg-surface-1/50 flex items-center justify-between">
              <div className="flex items-center gap-8">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-dim uppercase tracking-widest mb-1">Total Consumption Rate</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-mono font-black text-primary">{result.toFixed(4)}</span>
                    <span className="text-sm font-bold text-ghost">{cleanRichText(resourceUnit)} / {cleanRichText(boqUnit)}</span>
                  </div>
                </div>
                
                <div className="h-12 w-px bg-border-subtle" />

                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-dim uppercase tracking-widest mb-1">Calculation Logic</span>
                  <div className="text-[11px] text-main font-medium bg-surface-base px-3 py-1.5 rounded-lg border border-border-subtle">
                    {mode === 'reinforcement' ? 'Σ ( (D² / 162.2) * Length * (1+Waste) * (1+Lap) * Count )' :
                     mode === 'roofing' ? 'Σ ( Area / Cos(Pitch) * (1+Waste) * (1+Lap) * Count )' :
                     mode === 'tiles' ? 'Σ ( 1 / ((L+Gap)*(W+Gap)) * Count * (1+Waste) )' :
                     mode === 'fabrication' ? 'Σ ( Perimeter + Internal * Count * (1+Waste) )' :
                     'Σ ( Elements * (1+Waste) * (1+Lap) * Count )'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={onClose}
                  className="px-6 py-3 rounded-xl text-sm font-bold text-dim hover:text-main transition-colors"
                >
                  Discard
                </button>
                <button 
                  onClick={() => onConfirm(result)}
                  className="bg-primary text-surface-base px-8 py-3 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Apply Engineering Rate
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

