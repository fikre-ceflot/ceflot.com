import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, MessageSquare, X, Send, ShieldAlert, ShieldCheck, 
  ArrowRight, LayoutDashboard, FileText, Bell, BookOpen, 
  History, Eye, User, Terminal, Trash2
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AIAssistantProps {
  onRoleSwitch?: (role: any) => void;
  activeRole: string;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  weather: string;
  setWeather: (weather: string) => void;
  remarks: string;
  setRemarks: (remarks: string) => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  profile: any;
  project: any;
  tenantId: string;
  isPlatformGod: boolean;
  loadInitialData?: () => void;
  materials: any[];
  setMaterials: React.Dispatch<React.SetStateAction<any[]>>;
  manpower: any[];
  setManpower: React.Dispatch<React.SetStateAction<any[]>>;
  executedQty?: number;
  setExecutedQty?: (qty: number) => void;
  selectedActivity?: any;
  setSelectedActivity?: (activity: any) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  commandExecuted?: {
    action: string;
    params: any;
    isAuthorized: boolean;
  };
  pendingCommand?: {
    action: string;
    params: any;
    isAuthorized: boolean;
  };
  confirmationStatus?: 'pending' | 'confirmed' | 'cancelled';
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  onRoleSwitch,
  activeRole,
  activeTab,
  setActiveTab,
  weather,
  setWeather,
  remarks,
  setRemarks,
  currentStep,
  setCurrentStep,
  profile,
  project,
  tenantId,
  isPlatformGod,
  loadInitialData,
  materials,
  setMaterials,
  manpower,
  setManpower,
  executedQty,
  setExecutedQty,
  selectedActivity,
  setSelectedActivity,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Hello ${profile?.full_name?.split(' ')[0] || 'Operator'}! I am your Ceflot Site Assistant. I read project boundaries, active warehouse stock ledger capabilities, and permissions. Write any instruction or ask me to navigate or record parameters.`,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Handle quick actions/suggestions
  const handleSuggestionClick = (text: string) => {
    setInputText(text);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome-cleared',
        role: 'assistant',
        text: "Conversation cleared. Ready for new commands.",
        timestamp: new Date()
      }
    ]);
  };

  const executeCommandOnClient = async (command: any, isAuthorized: boolean) => {
    if (!command) return null;
    if (!isAuthorized) return { status: 'denied', command: command.action };

    try {
      switch (command.action) {
        case 'SET_WEATHER':
          if (command.params?.weather) {
            const formatted = command.params.weather.charAt(0).toUpperCase() + command.params.weather.slice(1);
            setWeather(formatted);
            return { status: 'success', detail: `Weather adjusted to "${formatted}" on report draft` };
          }
          break;

        case 'SET_REMARKS':
          if (command.params?.remarks) {
            setRemarks(command.params.remarks);
            return { status: 'success', detail: `Draft remarks set: "${command.params.remarks}"` };
          }
          break;

        case 'SET_STEP':
          if (command.params?.step) {
            const stepVal = Number(command.params.step);
            if (stepVal >= 1 && stepVal <= 7) {
              setCurrentStep(stepVal);
              setActiveTab('report');
              return { status: 'success', detail: `Progress Wizard jumped directly to Step ${stepVal}` };
            }
          }
          break;

        case 'SWITCH_TAB':
          if (command.params?.tab) {
            setActiveTab(command.params.tab);
            return { status: 'success', detail: `View switched to "${command.params.tab}" tab` };
          }
          break;

        case 'SIMULATE_ROLE_SWITCH':
          if (command.params?.role && onRoleSwitch) {
            onRoleSwitch(command.params.role);
            return { status: 'success', detail: `Switched active role emulator to: ${command.params.role}` };
          }
          break;

        case 'ADD_MATERIAL_LOG':
          if (command.params?.material && command.params?.quantity) {
            const matName = command.params.material;
            const matQty = command.params.quantity;
            setMaterials(prev => {
              const existing = prev.find(m => m.name.toLowerCase() === matName.toLowerCase());
              if (existing) {
                return prev.map(m => m.name.toLowerCase() === matName.toLowerCase() ? { ...m, qty: m.qty + matQty } : m);
              }
              return [...prev, { name: matName, qty: matQty, unit: 'units' }];
            });
            setActiveTab('report');
            setCurrentStep(4);
            return { status: 'success', detail: `Added ${matQty} of ${matName} to daily draft usages` };
          }
          break;

        case 'ADD_MANPOWER_LOG':
          if (command.params?.labourGrade && command.params?.headcount) {
            const grade = command.params.labourGrade;
            const count = command.params.headcount;
            setManpower(prev => {
              const el = prev.find(m => m.skill.toLowerCase() === grade.toLowerCase());
              if (el) {
                return prev.map(m => m.skill.toLowerCase() === grade.toLowerCase() ? { ...m, count: m.count + count } : m);
              }
              return [...prev, { skill: grade, group: 'Direct Basis', count, idle: false }];
            });
            setActiveTab('report');
            setCurrentStep(5);
            return { status: 'success', detail: `Added headcount ${count} of ${grade} to site manpower log` };
          }
          break;

        case 'FILE_ALERT':
          if (command.params?.alertType && command.params?.severity && command.params?.alertRemarks) {
            const { data: { user } } = await supabase.auth.getUser();
            const typeValue = command.params.severity.toLowerCase() === 'critical' ? 'critical' : command.params.severity.toLowerCase() === 'high' ? 'warning' : 'info';
            const { error } = await supabase.from('alerts').insert({
              project_id: project.id,
              tenant_id: tenantId,
              title: `[AI Bot Alert - ${command.params.alertType}]`,
              message: command.params.alertRemarks,
              type: typeValue,
              severity: command.params.severity,
              metadata: { sub_category: command.params.alertType, generated_by_ai: true },
              submitted_by: user?.id,
              created_at: new Date().toISOString()
            });
            if (error) throw error;
            if (loadInitialData) loadInitialData();
            return { status: 'success', detail: `Submitted real database flag: [${command.params.severity}] ${command.params.alertType}` };
          }
          break;

        case 'UPDATE_ACTIVITY_INFO':
          if (setExecutedQty && command.params?.executedQty !== undefined) {
            setExecutedQty(Number(command.params.executedQty));
            setActiveTab('report');
            setCurrentStep(3);
            return { status: 'success', detail: `Activity executed quantity set to ${command.params.executedQty}` };
          }
          break;

        case 'UPDATE_DRAFT_MATERIAL':
          if (command.params?.material && command.params?.quantity !== undefined) {
            const matName = command.params.material;
            const matQty = Number(command.params.quantity);
            setMaterials(prev => {
              const el = prev.find(m => m.name.toLowerCase() === matName.toLowerCase());
              if (el) {
                return prev.map(m => m.name.toLowerCase() === matName.toLowerCase() ? { ...m, qty: matQty } : m);
              }
              return [...prev, { name: matName, qty: matQty, unit: 'units' }];
            });
            setActiveTab('report');
            setCurrentStep(4);
            return { status: 'success', detail: `Draft material log updated: set "${matName}" to ${matQty}` };
          }
          break;

        case 'UPDATE_DRAFT_LABOR':
          if (command.params?.labourGrade && command.params?.headcount !== undefined) {
            const grade = command.params.labourGrade;
            const count = Number(command.params.headcount);
            setManpower(prev => {
              const el = prev.find(m => m.skill.toLowerCase() === grade.toLowerCase());
              if (el) {
                return prev.map(m => m.skill.toLowerCase() === grade.toLowerCase() ? { ...m, count } : m);
              }
              return [...prev, { skill: grade, group: 'Direct Basis', count, idle: false }];
            });
            setActiveTab('report');
            setCurrentStep(5);
            return { status: 'success', detail: `Draft labor crew updated: set "${grade}" headcount to ${count}` };
          }
          break;

        case 'CLEAR_CHAT':
          setTimeout(() => handleClearHistory(), 100);
          return { status: 'success', detail: 'Cleared active chat buffer' };

        default:
          return null;
      }
    } catch (err: any) {
      console.error('AI command execution failed:', err);
      return { status: 'failed', detail: `Failed to commit command: ${err.message || err}` };
    }
    return null;
  };

  const handleApproveProposal = async (messageId: string, cmd: any) => {
    const feedback = await executeCommandOnClient(cmd, cmd.isAuthorized);
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        return {
          ...m,
          confirmationStatus: 'confirmed',
          commandExecuted: {
            action: cmd.action,
            params: cmd.params,
            isAuthorized: cmd.isAuthorized
          },
          text: m.text + (feedback?.detail ? `\n\n✅ **Action Confirmed**: ${feedback.detail}` : `\n\n✅ **Action Confirmed and Applied**`)
        };
      }
      return m;
    }));
  };

  const handleCancelProposal = (messageId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        return {
          ...m,
          confirmationStatus: 'cancelled',
          text: m.text + `\n\n❌ **Action Cancelled** by user choice.`
        };
      }
      return m;
    }));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg = inputText.trim();
    setInputText('');

    const newMsg: ChatMessage = {
      id: Math.random().toString(),
      role: 'user',
      text: userMsg,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMsg]);
    setIsLoading(true);

    try {
      // Map prior messages into a lightweight history format
      const historyPayload = messages.slice(-10).map(m => ({
        role: m.role,
        text: m.text
      }));

      const contextPayload = {
        role: activeRole,
        userName: profile?.full_name || 'Field Operator',
        projectName: project?.name || 'Ceflot Field',
        weather,
        remarks,
        step: currentStep,
        activeTab,
        isPlatformGod
      };

      // Fetch user's Supabase JWT securely and place it in authorization header
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMsg,
          chatHistory: historyPayload,
          context: contextPayload
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      
      const confirmationRequiredActions = [
        'SET_WEATHER',
        'SET_REMARKS',
        'ADD_MATERIAL_LOG',
        'ADD_MANPOWER_LOG',
        'FILE_ALERT',
        'UPDATE_ACTIVITY_INFO',
        'UPDATE_DRAFT_MATERIAL',
        'UPDATE_DRAFT_LABOR'
      ];

      const needsConfirmation = data.command && confirmationRequiredActions.includes(data.command.action);

      // Execute command on client if the server validated one and no confirmation is needed
      let executionFeedback = null;
      if (data.command && !needsConfirmation) {
        executionFeedback = await executeCommandOnClient(data.command, data.isAuthorized);
      }

      const botMsg: ChatMessage = {
        id: Math.random().toString(),
        role: 'assistant',
        text: data.response || "No response received.",
        timestamp: new Date(),
        commandExecuted: (data.command && !needsConfirmation) ? {
          action: data.command.action,
          params: data.command.params,
          isAuthorized: data.isAuthorized
        } : undefined,
        pendingCommand: (data.command && needsConfirmation) ? {
          action: data.command.action,
          params: data.command.params,
          isAuthorized: data.isAuthorized
        } : undefined,
        confirmationStatus: (data.command && needsConfirmation) ? 'pending' : undefined
      };

      setMessages(prev => [...prev, botMsg]);

    } catch (error: any) {
      console.error('Failed to chat with AI:', error);
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        role: 'assistant',
        text: `Unable to process request: ${error.message || 'Check connection to server.ts dev instance.'}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Pre-configured role-based quick command chips
  const getSuggestionChips = () => {
    if (activeRole === 'site_encoder') {
      return [
        "Set weather to Rainy",
        "Set remarks to concrete pouring completed",
        "Add 5 carpenters to manpower",
        "Navigate to alerts page",
        "What are my encoder role capabilities?"
      ];
    } else if (activeRole === 'storeman' || activeRole === 'procurement') {
      return [
        "Go to warehouse store to check stock",
        "Receive materials from supplier",
        "File a safety hazard alert",
        "Show current inventory status"
      ];
    } else {
      return [
        "Switch model view to Storeman View",
        "Set weather to Sunny",
        "File critical alert for design conflict",
        "Go to step 7 of report"
      ];
    }
  };

  const chips = getSuggestionChips();

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <motion.button
        id="ai-assistant-toggle"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 z-[1200] w-12 h-12 rounded-full bg-gradient-to-tr from-primary to-accent border border-border-subtle shadow-2xl flex items-center justify-center text-white cursor-pointer active:scale-90 transition-transform group"
      >
        <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-surface-base" />
      </motion.button>

      {/* Floating sliding chat sheet inside mobile scope */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[1500] flex justify-end bg-black/45 backdrop-blur-xs" onClick={() => setIsOpen(false)}>
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="w-full max-w-sm h-full bg-surface-base border-l border-border-subtle flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 bg-surface-1 border-b border-border-subtle flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary/20 to-accent/20 flex items-center justify-center border border-primary/30">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-widest text-main flex items-center gap-1.5 leading-none">
                      Ceflot AI Bot
                    </h2>
                    <span className="text-[9px] font-mono font-bold text-ghost uppercase tracking-wide">
                      Active: {activeRole.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={handleClearHistory}
                    title="Clear history"
                    className="p-1.5 text-ghost hover:text-danger rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-ghost hover:text-main rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Message Display Area */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
                {messages.map((m) => {
                  const isBot = m.role === 'assistant';
                  return (
                    <div key={m.id} className={`flex flex-col ${isBot ? 'items-start' : 'items-end'} space-y-1`}>
                      <div className={`p-4 rounded-3xl text-xs max-w-[85%] leading-relaxed ${
                        isBot 
                          ? 'bg-surface-1 text-main border border-border-subtle rounded-tl-sm' 
                          : 'bg-primary text-white rounded-tr-sm'
                      }`}>
                        {m.text}

                        {/* Visual indicator of execution or auth locks */}
                        {m.commandExecuted && (
                          <div className="mt-3 border-t border-border-subtle/50 pt-2 font-mono text-[9px] uppercase tracking-wider space-y-1">
                            {m.commandExecuted.isAuthorized ? (
                              <div className="flex items-center gap-1 text-emerald-400 font-bold">
                                <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                                <span>Executed: [{m.commandExecuted.action}]</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-orange-400 font-bold">
                                <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-orange-400" />
                                <span>Unauthorized view constraint caught</span>
                              </div>
                            )}
                            <div className="text-[8px] text-ghost normal-case text-dim line-clamp-2 leading-snug">
                              Params: {JSON.stringify(m.commandExecuted.params)}
                            </div>
                          </div>
                        )}

                        {/* Pending Confirmation Block */}
                        {m.pendingCommand && m.confirmationStatus === 'pending' && (
                          <div className="mt-4 p-3 bg-surface-2 rounded-2xl border border-amber-500/30 space-y-3 shadow-md">
                            <div className="flex items-center gap-1.5 text-amber-500 font-sans font-bold text-[11px] leading-tight uppercase tracking-wider">
                              <ShieldAlert className="w-4 h-4 text-amber-500 select-none" />
                              <span>Proposed Agent Change</span>
                            </div>
                            
                            <div className="text-[10px] text-main border-y border-border-subtle/50 py-2 space-y-1 bg-surface-3/30 px-2 rounded-lg font-mono">
                              <div className="text-primary font-bold">Action: {m.pendingCommand.action}</div>
                              {m.pendingCommand.params && (
                                <div className="space-y-0.5 text-ghost">
                                  {Object.entries(m.pendingCommand.params).map(([key, val]) => (
                                    <div key={key}>• {key}: <span className="text-main font-bold">{String(val)}</span></div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => handleApproveProposal(m.id, m.pendingCommand)}
                                className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer text-center select-none shadow hover:brightness-105 active:scale-95"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleCancelProposal(m.id)}
                                className="px-2.5 py-1.5 rounded-xl bg-surface-3 hover:bg-surface-4 text-ghost hover:text-main font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer text-center select-none"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <span className="text-[8px] text-ghost font-mono">
                        {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex items-start gap-2">
                    <div className="p-4 bg-surface-1 border border-border-subtle rounded-3xl rounded-tl-sm text-xs max-w-[85%] flex items-center gap-2">
                      <div className="flex space-x-1">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-ghost animate-pulse">Scanning permissions...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Command chips suggestions */}
              <div className="p-3 bg-surface-1/40 border-t border-border-subtle/50">
                <div className="text-[8px] font-black uppercase text-ghost tracking-widest mb-1.5">Suggested commands:</div>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5 custom-scrollbar">
                  {chips.map((chip, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(chip)}
                      className="px-2.5 py-1 bg-surface-1 hover:bg-surface-2 border border-border-subtle text-[10px] text-ghost hover:text-main rounded-full whitespace-nowrap cursor-pointer transition-all active:scale-[0.97]"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input section */}
              <form onSubmit={handleSendMessage} className="p-4 bg-surface-1 border-t border-border-subtle flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Ask bot or issue command..."
                  disabled={isLoading}
                  className="flex-1 h-11 bg-surface-2 border border-border-subtle rounded-2xl px-4 text-xs text-main placeholder:text-dim outline-none focus:border-primary focus:bg-surface-3 transition-colors disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isLoading}
                  className="w-11 h-11 rounded-2xl bg-primary text-white flex items-center justify-center active:scale-95 hover:bg-primary/95 transition-all outline-none disabled:opacity-40 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
