import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { BOQItem } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  X, 
  Sparkles, 
  Check, 
  AlertCircle, 
  Loader2, 
  ChevronRight,
  Search
} from 'lucide-react';
import { TradePickerModal } from './TradePickerModal';
import { cn, cleanRichText } from '../lib/utils';

import { TRADE_GROUPS, getGroupLabel, getGroupEmoji } from '../lib/constants';

interface TradeAssignmentModalProps {
  items: BOQItem[];
  onClose: () => void;
  onSuccess: () => void;
  tenantId: string;
}

interface Suggestion {
  id: string;
  bill_no: string;
  item_no: string;
  description: string;
  unit: string;
  contract_qty: number;
  contract_rate: number;
  contract_amount: number;
  suggested_code: string;
  confidence: number;
  confirmed: boolean;
}

export function TradeAssignmentModal({ items, onClose, onSuccess, tenantId }: TradeAssignmentModalProps) {
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTrade, setSearchTrade] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [pickingIdx, setPickingIdx] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    generateSuggestions();
  }, []);

  const generateSuggestions = async () => {
    setLoading(true);
    setProgress(0);
    setErrorCount(0);
    try {
      // 1. Fetch Trade Library
      let tradeQuery = supabase.from('trade_items')
        .select('trade_code, trade_item, description, trade_group, library_tier')
        .eq('is_active', true);
      
      if (tenantId && tenantId !== 'null') {
        tradeQuery = tradeQuery.or(`library_tier.eq.global,tenant_id.eq.${tenantId}`);
      } else if (!tenantId || tenantId === 'null') {
        tradeQuery = tradeQuery.eq('library_tier', 'global');
      }

      const { data: tradeData, error: tradeError } = await tradeQuery;

      if (tradeError) throw tradeError;
      
      // Ensure unique trades by code (prefer company tier if both exist)
      const uniqueMap = new Map();
      (tradeData || []).forEach(t => {
        const existing = uniqueMap.get(t.trade_code);
        if (!existing || (existing.library_tier === 'global' && t.library_tier === 'company')) {
          uniqueMap.set(t.trade_code, t);
        }
      });
      const uniqueTrades = Array.from(uniqueMap.values());
      setTrades(uniqueTrades);

      // 2. Initialize Gemini
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const tradeList = uniqueTrades.map(t => `${t.trade_code}: ${t.trade_item} (${t.description})`).join('\n');
      
      // 3. Sequential Batch processing (20 items per batch) to avoid rate limits
      const BATCH_SIZE = 20;
      const batches = [];
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        batches.push(items.slice(i, i + BATCH_SIZE));
      }

      const allResults = [];
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        try {
          const startIndex = i * BATCH_SIZE;
          const itemList = batch.map((item, idx) => {
            const globalIdx = startIndex + idx;
            const context = items.slice(Math.max(0, globalIdx - 3), globalIdx)
              .map(prev => `[Context: ${prev.item_no} ${cleanRichText(prev.description)}]`)
              .join(' ');
            return `ID: ${item.id}, ItemNo: ${item.item_no}, Desc: ${cleanRichText(item.description)}, Unit: ${cleanRichText(item.unit)}, Context: ${context}`;
          }).join('\n');

          const prompt = `
            You are a construction expert and quantity surveyor. Match the following BOQ items to the most appropriate trade codes from the provided library.
            
            HIERARCHY & CONTEXT RULES:
            1. BOQ items are often hierarchical. A sub-item (e.g., 1.1.2) inherits the context of its parent items (e.g., 1.1 and 1.0).
            2. Descriptions like "ditto", "as above", or "similar to item X" refer to preceding items in the sequence.
            3. Use the provided [Context] lines to understand the full scope of the work for each item.
            
            TRADE LIBRARY:
            ${tradeList}
            
            BOQ ITEMS (WITH CONTEXT):
            ${itemList}
            
            Return a JSON array of objects with "id", "trade_code", and "confidence" (0-1). 
          `;

          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    trade_code: { type: Type.STRING },
                    confidence: { type: Type.NUMBER }
                  },
                  required: ["id", "trade_code", "confidence"]
                }
              }
            }
          });

          const result = JSON.parse(response.text || '[]');
          allResults.push(...result);
          
          setProgress(Math.round(((i + 1) / batches.length) * 100));
          
          // Small delay to prevent hitting rate limits (especially TPM/RPM)
          if (i < batches.length - 1) {
            await delay(1000); 
          }
        } catch (err) {
          console.error(`Batch ${i} failed:`, err);
          setErrorCount(prev => prev + 1);
          // Still advance progress even on error
          setProgress(Math.round(((i + 1) / batches.length) * 100));
        }
      }

      const newSuggestions = items.map(item => {
        const match = allResults.find((m: any) => m.id === item.id);
        return {
          id: item.id,
          bill_no: item.bill_no,
          item_no: item.item_no,
          description: item.description,
          unit: item.unit,
          contract_qty: item.contract_qty,
          contract_rate: item.contract_rate,
          contract_amount: item.contract_amount,
          suggested_code: match?.trade_code || '',
          confidence: match?.confidence || 0,
          confirmed: !!match
        };
      });

      setSuggestions(newSuggestions);
    } catch (err: any) {
      console.error('AI Suggestion Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const confirmed = suggestions.filter(s => s.confirmed && s.suggested_code);
    if (confirmed.length === 0) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      // Use the atomic bulk RPC for assignment and resource population
      const assignments = confirmed.map(s => ({
        id: s.id,
        trade_code: s.suggested_code
      }));

      const { error } = await supabase.rpc('bulk_assign_trade_codes', {
        p_assignments: assignments,
        p_tenant_id: tenantId
      });

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Save failed:', err);
      alert('Error saving assignments: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const groupedTrades = useMemo(() => {
    const groups: Record<string, any[]> = {};
    trades.forEach(t => {
      const cat = t.trade_group || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [trades]);

  const filteredGroupedTrades = useMemo(() => {
    if (!searchTrade) return groupedTrades;
    const lowerSearch = searchTrade.toLowerCase();
    return groupedTrades.map(([cat, items]) => {
      const filtered = items.filter(t => 
        t.trade_code.toLowerCase().includes(lowerSearch) || 
        t.trade_item.toLowerCase().includes(lowerSearch) ||
        (t.description && t.description.toLowerCase().includes(lowerSearch))
      );
      return [cat, filtered] as [string, any[]];
    }).filter(([_, items]) => items.length > 0);
  }, [groupedTrades, searchTrade]);

  const toggleCategory = (cat: string) => {
    const next = new Set(expandedCategories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setExpandedCategories(next);
  };

  const recheckItem = async (idx: number) => {
    const item = suggestions[idx];
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const tradeList = trades.map(t => `${t.trade_code}: ${t.trade_item} (${t.description})`).join('\n');
    
    // Find context from suggestions
    const context = suggestions.slice(Math.max(0, idx - 3), idx)
      .map(prev => `[Context: ${prev.item_no} ${prev.description}]`)
      .join(' ');

    const prompt = `
      Match this BOQ item to the most appropriate trade code.
      Item: ${item.item_no} ${item.description} (${item.unit})
      Context: ${context}
      
      TRADE LIBRARY:
      ${tradeList}
      
      Return JSON: {"trade_code": "CODE", "confidence": 0.9}
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const result = JSON.parse(response.text || '{}');
      if (result.trade_code) {
        const next = [...suggestions];
        next[idx].suggested_code = result.trade_code;
        next[idx].confidence = result.confidence || 1;
        next[idx].confirmed = true;
        setSuggestions(next);
      }
    } catch (err) {
      console.error('Recheck error:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-main">AI Trade Assignment</h2>
              <p className="text-xs text-dim">Review and confirm trade codes suggested by Gemini</p>
            </div>
          </div>
          <button onClick={onClose} className="text-ghost hover:text-main transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-24 flex flex-col items-center gap-6">
              <div className="relative">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-primary">
                  {Math.round(progress)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-main mb-1">Analysing BOQ with Gemini AI</div>
                <div className="text-xs text-ghost">
                  Processing {items.length} items in parallel batches...
                </div>
                {errorCount > 0 && (
                  <div className="text-[10px] text-danger mt-2 font-mono">
                    Warning: {errorCount} batches encountered issues and were skipped
                  </div>
                )}
              </div>
              <div className="w-64 h-1.5 bg-surface-base rounded-full overflow-hidden border border-border-subtle">
                <div 
                  className="h-full bg-primary transition-all duration-500 shadow-[0_0_10px_rgba(0,200,150,0.5)]" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="px-4 py-3 w-10">
                      <input 
                        type="checkbox" 
                        className="rounded border-border-subtle bg-surface-base text-primary focus:ring-primary"
                        checked={suggestions.length > 0 && suggestions.every(s => s.confirmed)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSuggestions(suggestions.map(s => ({ ...s, confirmed: checked })));
                        }}
                      />
                    </th>
                    <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-ghost">Bill</th>
                    <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-ghost">Item No</th>
                    <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-ghost">Description</th>
                    <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-ghost text-center">Unit</th>
                    <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-ghost text-right">Qty</th>
                    <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-ghost text-right">Rate</th>
                    <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-ghost text-right">Amount</th>
                    <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-ghost">Suggested Trade</th>
                    <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-ghost text-center">Confidence</th>
                    <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-ghost text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {suggestions.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-main/5 transition-colors">
                      <td className="px-4 py-4">
                        <input 
                          type="checkbox" 
                          className="rounded border-border-subtle bg-surface-base text-primary focus:ring-primary"
                          checked={s.confirmed}
                          onChange={() => {
                            const next = [...suggestions];
                            next[idx].confirmed = !next[idx].confirmed;
                            setSuggestions(next);
                          }}
                        />
                      </td>
                      <td className="px-4 py-4 text-[10px] font-mono text-primary">
                        {s.bill_no}
                      </td>
                      <td className="px-4 py-4 font-mono text-[11px] text-ghost">
                        {s.item_no}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-main line-clamp-2 hover:line-clamp-none transition-all">{cleanRichText(s.description)}</div>
                      </td>
                      <td className="px-4 py-4 text-center text-xs text-dim">
                        {cleanRichText(s.unit) || '—'}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-xs text-dim">
                        {s.contract_qty?.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-xs text-dim">
                        {s.contract_rate?.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-xs text-dim">
                        {s.contract_amount?.toLocaleString()}
                      </td>
                      <td className="px-4 py-4">
                        <button 
                          onClick={() => setPickingIdx(idx)}
                          className="w-full text-left bg-surface-2 border border-border-subtle rounded-md text-xs py-1.5 px-2 hover:border-primary transition-all min-w-[280px]"
                        >
                          {s.suggested_code ? (
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-primary">
                                {s.suggested_code}: {cleanRichText(trades.find(t => t.trade_code === s.suggested_code)?.trade_item) || '...'}
                              </span>
                              <ChevronRight className="w-3 h-3 text-ghost" />
                            </div>
                          ) : (
                            <span className="text-ghost">Select Trade...</span>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {s.suggested_code ? (
                          <div className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold",
                            s.confidence > 0.8 ? "bg-primary/10 text-primary" :
                            s.confidence > 0.5 ? "bg-warning/10 text-warning" :
                            "bg-danger/10 text-danger"
                          )}>
                            {Math.round(s.confidence * 100)}%
                          </div>
                        ) : (
                          <span className="text-ghost text-[10px] italic">No match</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => recheckItem(idx)}
                            className="p-1.5 text-ghost hover:text-primary hover:bg-primary/10 rounded-md transition-all"
                            title="Re-analyze with AI"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border-subtle flex items-center justify-between bg-surface-2/30">
          <div className="text-xs text-dim">
            {suggestions.filter(s => s.confirmed && s.suggested_code).length} items ready to assign
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
            <button 
              onClick={handleSave} 
              disabled={loading || isSaving || suggestions.filter(s => s.confirmed && s.suggested_code).length === 0}
              className="btn btn-accent btn-sm px-8 text-surface-base"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Assignments'}
            </button>
          </div>
        </div>
      </div>

      {pickingIdx !== null && (
        <TradePickerModal 
          tenantId={tenantId} 
          onClose={() => setPickingIdx(null)}
          onSelect={(trade) => {
            const next = [...suggestions];
            next[pickingIdx].suggested_code = trade.trade_code;
            next[pickingIdx].confirmed = true;
            next[pickingIdx].confidence = 1;
            setSuggestions(next);
            setPickingIdx(null);
          }}
        />
      )}
    </div>
  );
}
