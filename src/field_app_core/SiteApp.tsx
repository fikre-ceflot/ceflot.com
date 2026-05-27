import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ClipboardCheck, 
  Package, 
  Calculator, 
  Bell, 
  History,
  CloudSun,
  Truck,
  Users,
  Search,
  ChevronRight,
  Menu,
  X,
  Plus,
  ArrowLeft,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './supabase';
import { Project, BOQItem } from './types';
import { cn } from './utils';
import { DailyResourceLogger } from './DailyResourceLogger';

interface SiteAppProps {
  project: Project;
  tenantId: string;
}

export function SiteApp({ project, tenantId }: SiteAppProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reporting' | 'store' | 'guide' | 'alerts' | 'history'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLogger, setShowLogger] = useState(false);
  const [stats, setStats] = useState({
    executed_today: 0,
    active_labour: 0,
    materials_received: 0,
    open_alerts: 0
  });

  useEffect(() => {
    loadTodayStats();
  }, [project.id]);

  async function loadTodayStats() {
    const today = new Date().toISOString().split('T')[0];
    try {
      const { data: logs } = await supabase
        .from('daily_progress')
        .select(`
          id,
          daily_activities (progress_qty),
          daily_labour (headcount)
        `)
        .eq('project_id', project.id)
        .eq('report_date', today);

      if (logs) {
        const totalLabour = logs.reduce((acc, log) => acc + (log.daily_labour?.reduce((sum: number, l: any) => sum + l.headcount, 0) || 0), 0);
        setStats(prev => ({ ...prev, active_labour: totalLabour }));
      }

      const { count: alertsCount } = await supabase
        .from('alerts')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id)
        .eq('status', 'unread');
      
      setStats(prev => ({ ...prev, open_alerts: alertsCount || 0 }));
    } catch (e) {
      console.error('Error loading site stats:', e);
    }
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'reporting', label: 'Daily Reporting', icon: ClipboardCheck },
    { id: 'store', label: 'Storekeeping', icon: Package },
    { id: 'guide', label: 'Trade Guide', icon: Calculator },
    { id: 'alerts', label: 'Alerts', icon: Bell },
    { id: 'history', label: 'History', icon: History },
  ];

  const renderDashboard = () => (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      {/* Weather & Project Banner */}
      <div className="bg-surface-1 border border-border-subtle rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 transition-transform group-hover:scale-110">
          <CloudSun className="w-32 h-32 text-primary" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-ghost mb-2">
            <CloudSun className="w-4 h-4" />
            <span className="text-xs font-mono">24°C • Overcast • Nairobi, Kenya</span>
          </div>
          <h2 className="text-2xl font-black text-main tracking-tight">{project.name}</h2>
          <p className="text-sm text-ghost mt-1 uppercase tracking-widest font-bold">Field Operations Hub</p>
        </div>
        <button 
          onClick={() => setShowLogger(true)}
          className="relative z-10 btn btn-primary h-14 rounded-2xl px-8 text-base font-bold shadow-xl shadow-primary/20 flex items-center gap-3 transition-transform hover:scale-[1.02]"
        >
          <Plus className="w-6 h-6" />
          Create Daily Report
        </button>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Executed Today', value: '450m²', icon: ClipboardCheck, color: 'text-primary' },
          { label: 'Active Labour', value: stats.active_labour.toString(), icon: Users, color: 'text-accent' },
          { label: 'Material Deliveries', value: '3', icon: Truck, color: 'text-warning' },
          { label: 'Site Alerts', value: stats.open_alerts.toString(), icon: AlertCircle, color: 'text-danger' },
        ].map((stat, i) => (
          <div key={i} className="bg-surface-base border border-border-subtle rounded-3xl p-5 flex flex-col gap-4 transition-colors hover:bg-surface-1">
            <div className={cn("w-10 h-10 rounded-2xl bg-surface-base flex items-center justify-center", stat.color)}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-ghost mb-1">{stat.label}</div>
              <div className="text-xl font-black text-main">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Featured Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-1 border border-border-subtle rounded-3xl p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-main">Upcoming Tasks</h3>
            <button className="text-xs font-bold text-primary hover:underline">View Schedule</button>
          </div>
          <div className="space-y-3">
             {['Excavation for Foundation', 'Bricks Delivery Coordination', 'Site Clearing - Block B'].map((task, i) => (
               <div key={i} className="p-4 rounded-2xl bg-surface-base border border-border-subtle flex items-center justify-between group cursor-pointer hover:border-primary transition-all">
                 <div className="flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-xs font-bold text-main">{task}</span>
                 </div>
                 <ChevronRight className="w-4 h-4 text-ghost group-hover:text-primary transition-colors" />
               </div>
             ))}
          </div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-3xl p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-main">Critical Alerts</h3>
            <span className="px-2 py-1 rounded bg-danger/10 text-danger text-[10px] font-bold uppercase tracking-tighter">Action Required</span>
          </div>
          <div className="space-y-4">
            <div className="flex gap-4 p-4 rounded-2xl bg-danger/5 border border-danger/10">
               <AlertCircle className="w-5 h-5 text-danger shrink-0" />
               <div>
                  <h4 className="text-xs font-bold text-main">Fuel Shortage Looming</h4>
                  <p className="text-[10px] text-ghost mt-1 leading-relaxed">Diesel stocks estimated to run out in 48 hours based on current consumption rates.</p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const [reportHistory, setReportHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, project.id]);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_progress')
        .select(`
          *,
          daily_activities (boq_item_id, progress_qty)
        `)
        .eq('project_id', project.id)
        .order('report_date', { ascending: false });
      
      if (error) throw error;
      setReportHistory(data || []);
    } catch (e: any) {
      console.error('Error loading history:', e.message);
    } finally {
      setHistoryLoading(false);
    }
  }

  const renderHistory = () => (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
       <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-main tracking-tight">Report History</h2>
            <p className="text-sm text-ghost mt-1 uppercase tracking-widest font-bold">Archives for {project.name}</p>
          </div>
          <button 
            onClick={loadHistory}
            className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            <RefreshCw className={cn("w-5 h-5", historyLoading && "animate-spin")} />
          </button>
       </div>

       {historyLoading ? (
         <div className="py-20 text-center animate-pulse text-ghost">Loading history...</div>
       ) : reportHistory.length === 0 ? (
         <div className="bg-surface-1 border border-border-subtle rounded-3xl p-20 text-center">
            <History className="w-12 h-12 text-ghost opacity-20 mx-auto mb-4" />
            <p className="text-xs text-ghost italic">No records found for this project.</p>
         </div>
       ) : (
         <div className="flex flex-col gap-4">
           {reportHistory.map((report) => (
             <div key={report.id} className="bg-surface-1 border border-border-subtle rounded-2xl p-5 hover:border-primary/30 transition-all group">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center text-primary">
                      <ClipboardCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-main">{report.report_date}</div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest",
                          report.status === 'submitted' ? "text-primary" : "text-ghost"
                        )}>
                          {report.status}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-border-subtle" />
                        <span className="text-[9px] text-ghost font-mono">
                          {report.daily_activities?.length || 0} Activities
                        </span>
                      </div>
                    </div>
                  </div>
                  <button className="p-2 text-ghost group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                {report.progress_notes && (
                  <p className="text-[11px] text-dim line-clamp-2 italic border-l-2 border-border-subtle pl-3 mt-2">
                    "{report.progress_notes}"
                  </p>
                )}
             </div>
           ))}
         </div>
       )}
    </div>
  );

  const renderReporting = () => (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-surface-1 border border-border-subtle rounded-3xl p-8 text-center flex flex-col items-center gap-6">
         <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <ClipboardCheck className="w-10 h-10" />
         </div>
         <div className="max-w-md">
            <h2 className="text-2xl font-black text-main">Daily Field Reporting</h2>
            <p className="text-sm text-ghost mt-2 leading-relaxed">
              Log progress, labour attendance, machinery hours and material usage directly from the site. Data is synced in real-time.
            </p>
         </div>
         <button 
           onClick={() => setShowLogger(true)}
           className="btn btn-primary h-14 rounded-2xl px-12 text-base font-bold shadow-xl shadow-primary/20"
         >
           Begin Today's Log
         </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
         <button 
           onClick={() => setActiveTab('history')}
           className="bg-surface-1 border border-border-subtle rounded-3xl p-6 flex flex-col items-center text-center gap-3 hover:border-primary/50 transition-all group"
         >
            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
               <History className="w-6 h-6" />
            </div>
            <div>
               <h3 className="text-xs font-black uppercase tracking-widest text-main">Log History</h3>
               <p className="text-[10px] text-ghost mt-1">View previous reports</p>
            </div>
         </button>
         <button className="bg-surface-1 border border-border-subtle rounded-3xl p-6 flex flex-col items-center text-center gap-3 hover:border-primary/50 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-warning/10 flex items-center justify-center text-warning group-hover:scale-110 transition-transform">
               <Users className="w-6 h-6" />
            </div>
            <div>
               <h3 className="text-xs font-black uppercase tracking-widest text-main">Sub Performance</h3>
               <p className="text-[10px] text-ghost mt-1">Subcontractor sync</p>
            </div>
         </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-base flex flex-col font-sans selection:bg-primary selection:text-white">
      {/* Mobile Top Nav */}
      <header className="md:hidden px-6 py-4 border-b border-border-subtle flex items-center justify-between sticky top-0 bg-surface-base z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
            <LayoutDashboard className="w-4 h-4" />
          </div>
          <span className="text-sm font-black uppercase tracking-widest">PrecisionField</span>
        </div>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-ghost">
          <Menu className="w-6 h-6" />
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar / Mobile Drawer */}
        <AnimatePresence>
          {(isSidebarOpen || window.innerWidth >= 768) && (
            <motion.aside 
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -200 }}
              className={cn(
                "fixed inset-0 z-[60] bg-surface-base md:relative md:flex md:w-64 md:border-r md:border-border-subtle flex-col",
                !isSidebarOpen && "hidden"
              )}
            >
              <div className="p-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                    <LayoutDashboard className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="text-sm font-black uppercase tracking-tighter">PrecisionSite</h1>
                    <span className="text-[9px] text-ghost font-mono uppercase tracking-widest">Enterprise v2.4</span>
                  </div>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="flex-1 px-4 py-4 space-y-2">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setIsSidebarOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all group",
                      activeTab === item.id 
                        ? "bg-primary text-white shadow-xl shadow-primary/20" 
                        : "text-ghost hover:bg-surface-1 hover:text-main"
                    )}
                  >
                    <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-white" : "text-ghost group-hover:text-primary transition-colors")} />
                    <span className="text-xs font-bold uppercase tracking-widest">{item.label}</span>
                    {item.id === 'alerts' && stats.open_alerts > 0 && (
                      <span className={cn(
                        "ml-auto w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                        activeTab === 'alerts' ? "bg-white text-primary" : "bg-danger text-white"
                      )}>
                        {stats.open_alerts}
                      </span>
                    )}
                  </button>
                ))}
              </nav>

              <div className="p-6 bg-surface-base border-t border-border-subtle mt-auto">
                 <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-1 border border-border-subtle">
                   <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center text-ghost">
                     <Users className="w-4 h-4" />
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-main truncate">Site Supervisor</div>
                      <div className="text-[9px] text-ghost font-mono">ID: PS-24-99</div>
                   </div>
                 </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Viewport */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10 relative">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'reporting' && renderReporting()}
            {activeTab === 'history' && renderHistory()}
            
            {activeTab === 'store' && (
              <div className="flex flex-col gap-6 py-20 text-center items-center h-full justify-center animate-in zoom-in-95 duration-500">
                <Package className="w-16 h-16 text-ghost opacity-20 mb-4" />
                <h2 className="text-xl font-black text-main">Store Management</h2>
                <p className="text-xs text-ghost max-w-xs">GRN, material isolation and inventory tracking modules are loading...</p>
              </div>
            )}
          </div>

          {/* Activity Overlays (e.g. Daily Resource Logger) */}
          <AnimatePresence>
            {showLogger && (
              <DailyResourceLogger 
                project={project} 
                onClose={() => {
                  setShowLogger(false);
                  loadTodayStats();
                }} 
              />
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* APK Hub / Background Sync Notice */}
      <div className="hidden lg:flex fixed bottom-8 right-8 z-[100] gap-4">
         <div className="bg-surface-base border border-border-subtle p-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md bg-opacity-80">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-bold text-main uppercase tracking-tighter">Site Sync Online</span>
         </div>
      </div>
    </div>
  );
}
