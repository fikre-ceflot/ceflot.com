import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, MessageSquare, X, Send, ShieldCheck, ShieldAlert,
  Sliders, Layout, Activity, FolderOpen, Sun, Moon, HelpCircle,
  Building, Library, FileText, CheckSquare, Trash2
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface GlobalAIAssistantProps {
  activePanel: string;
  setActivePanel: (panel: string) => void;
  activeProject: string | null;
  setActiveProject: (projectId: string) => void;
  projects: any[];
  profile: any;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
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
}

export const GlobalAIAssistant: React.FC<GlobalAIAssistantProps> = ({
  activePanel,
  setActivePanel,
  activeProject,
  setActiveProject,
  projects,
  profile,
  theme,
  setTheme
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-global',
      role: 'assistant',
      text: `Welcome to the Ceflot Portfolio AI Control Panel, ${profile?.full_name?.split(' ')[0] || 'Administrator'}. I am your corporate ERP assistance agent. You can ask me to open modules (e.g. "go to budget", "navigate to schedule milestones"), change theme presentation layers, select company projects, or ask administrative questions!`,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSuggestionClick = (text: string) => {
    setInputText(text);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome-cleared',
        role: 'assistant',
        text: "Portfolio command feed cleared. Awaiting instructions.",
        timestamp: new Date()
      }
    ]);
  };

  const executePortalCommand = (command: any, isAuthorized: boolean) => {
    if (!command) return null;
    if (!isAuthorized) {
      return { status: 'denied', detail: `Access forbidden for action: ${command.action}` };
    }

    try {
      switch (command.action) {
        case 'SET_PANEL':
          if (command.params?.panel) {
            setActivePanel(command.params.panel);
            return { status: 'success', detail: `Navigated workspace panel directly to: ${command.params.panel}` };
          }
          break;

        case 'SET_PROJECT':
          if (command.params?.projectName && projects.length > 0) {
            const queryName = command.params.projectName.toLowerCase();
            // Fuzzy search project list
            const matched = projects.find(p => 
              p.name.toLowerCase().includes(queryName) || 
              (p.project_code && p.project_code.toLowerCase().includes(queryName))
            );

            if (matched) {
              setActiveProject(matched.id);
              return { status: 'success', detail: `Workspace project scope locked on: "${matched.name}"` };
            } else {
              return { status: 'failed', detail: `Could not identify project matching "${command.params.projectName}"` };
            }
          }
          break;

        case 'SET_THEME':
          if (command.params?.theme) {
            const target = command.params.theme as 'dark' | 'light';
            setTheme(target);
            return { status: 'success', detail: `Interface visual output altered to: "${target}" layout` };
          }
          break;

        default:
          return null;
      }
    } catch (e: any) {
      console.error('Failed to execute global portal command:', e);
      return { status: 'failed', detail: `Exception raised of level: ${e.message || e}` };
    }
    return null;
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
      const historyPayload = messages.slice(-8).map(m => ({
        role: m.role,
        text: m.text
      }));

      // Gather current project list names for AI to look up on fuzzy queries
      const availableProjectsName = projects.map(p => p.name);

      const contextPayload = {
        role: profile?.role || 'tenant_admin',
        userName: profile?.full_name || 'System User',
        projectName: projects.find(p => p.id === activeProject)?.name || 'None Active',
        activePanel,
        appMode: 'global-portal',
        availableProjects: availableProjectsName,
        theme
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
      
      let feedback = null;
      if (data.command) {
        feedback = executePortalCommand(data.command, data.isAuthorized);
      }

      let appendText = data.response || "No response received.";
      if (feedback) {
        if (feedback.status === 'success') {
          appendText += ` (${feedback.detail})`;
        } else if (feedback.status === 'failed') {
          appendText += ` (Notice: ${feedback.detail})`;
        }
      }

      const botMsg: ChatMessage = {
        id: Math.random().toString(),
        role: 'assistant',
        text: appendText,
        timestamp: new Date(),
        commandExecuted: data.command ? {
          action: data.command.action,
          params: data.command.params,
          isAuthorized: data.isAuthorized
        } : undefined
      };

      setMessages(prev => [...prev, botMsg]);

    } catch (error: any) {
      console.error('Failed to communicate with Enterprise Assistant:', error);
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        role: 'assistant',
        text: `Integration Timeout: ${error.message || 'Check connection to port 3000 node server.'}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickSuggestionChips = [
    "Open the Budget module",
    "Switch active theme to light",
    "Go to Project setup checklist",
    "Show Procurement dashboard",
    "View subcontractors contracts",
    "Open schedule milestones"
  ];

  return (
    <>
      {/* Absolute Portal FAB */}
      <motion.button
        id="global-ai-portal-trigger"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[1200] w-14 h-14 rounded-2xl bg-gradient-to-tr from-accent to-primary border border-white/10 shadow-2xl flex items-center justify-center text-white cursor-pointer group active:scale-90 transition-transform"
      >
        <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform text-white animate-pulse" />
        <span className="absolute top-1.5 right-1.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#121214]" />
      </motion.button>

      {/* Floating Chat Panel Sheet */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[1500] flex justify-end bg-black/40 backdrop-blur-xs" onClick={() => setIsOpen(false)}>
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="w-full max-w-md h-full bg-surface-base border-l border-border-subtle flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Top Banner Header */}
              <div className="p-4 bg-surface-1 border-b border-border-subtle flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-primary/35 shadow-sm">
                    <Sparkles className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-widest text-main flex items-center gap-1.5 leading-none">
                      CEFLOT Copilot
                    </h2>
                    <span className="text-[9px] font-mono font-bold text-ghost uppercase tracking-wider block mt-1">
                      Enterprise Management Node
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={handleClearHistory}
                    title="Clear history"
                    className="p-1.5 text-ghost hover:text-danger rounded-xl hover:bg-surface-2 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-ghost hover:text-main rounded-xl hover:bg-surface-2 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Chat history list */}
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

                        {/* Executed indicator with specific status colors */}
                        {m.commandExecuted && (
                          <div className="mt-3 border-t border-border-subtle/45 pt-2.5 font-mono text-[9px] uppercase tracking-wider space-y-1">
                            {m.commandExecuted.isAuthorized ? (
                              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                                <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                                <span>Action Processed: {m.commandExecuted.action}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-orange-400 font-bold">
                                <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-orange-400" />
                                <span>Role Clearance Denied</span>
                              </div>
                            )}
                            <div className="text-[8px] text-ghost normal-case text-dim font-sans leading-snug">
                              Payload parameters: {JSON.stringify(m.commandExecuted.params)}
                            </div>
                          </div>
                        )}
                      </div>
                      <span className="text-[8px] text-ghost font-mono pl-1 pr-1">
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
                      <span className="font-mono text-[9px] uppercase tracking-widest text-[#a1a1aa] animate-pulse">Computing workspace parameters...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Instant suggested chips */}
              <div className="p-3 bg-surface-1/40 border-t border-border-subtle/50">
                <div className="text-[8px] font-black uppercase text-ghost tracking-widest mb-2">Portfolio Commands:</div>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5 custom-scrollbar">
                  {quickSuggestionChips.map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(chip)}
                      className="px-2.5 py-1.5 bg-surface-1 hover:bg-surface-2 border border-border-subtle text-[10px] text-ghost hover:text-main rounded-full whitespace-nowrap cursor-pointer transition-all active:scale-[0.97]"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action input bar */}
              <form onSubmit={handleSendMessage} className="p-4 bg-surface-1 border-t border-border-subtle flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Navigate portals, switch themes..."
                  disabled={isLoading}
                  className="flex-1 h-11 bg-surface-2 border border-border-subtle rounded-2xl px-4 text-xs text-main placeholder:text-dim outline-none focus:border-primary focus:bg-surface-3 transition-colors disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isLoading}
                  className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-primary to-accent text-white flex items-center justify-center active:scale-95 hover:brightness-105 transition-all outline-none disabled:opacity-40 cursor-pointer shadow"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
