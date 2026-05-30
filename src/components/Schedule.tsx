import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Calendar, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  MoreHorizontal, 
  Loader2, 
  AlertCircle,
  GanttChart,
  List,
  CheckCircle2,
  CalendarDays,
  Trash2,
  Edit2,
  Zap,
  ArrowRight,
  Sparkles,
  FileDown,
  Layers,
  ChevronDown,
  CheckSquare,
  Square,
  X,
  Save,
  Maximize2,
  Minimize2,
  ShoppingCart,
  Truck,
  Users,
  DollarSign,
  Award,
  Target,
  SlidersHorizontal,
  Briefcase,
  Lock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn, cleanRichText } from '../lib/utils';
import { TabBar } from './ui/TabBar';
import { Project, BOQItem, TaskDependency } from '../types';
import { generateAISchedule } from '../services/aiScheduling';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ScheduleTask extends BOQItem {
  // We use the full BOQItem and map it to simpler names if needed, 
  // but better to just use the actual item properties
}

interface ScheduleMilestone {
  id: string;
  name: string;
  target_date: string | null;
  status: 'pending' | 'achieved';
}

interface ScheduleProps {
  project: Project;
}

function GanttView({ 
  tasks, 
  dependencies, 
  projectStart, 
  projectEnd, 
  selectedIds, 
  onToggleSelect, 
  isBulkEditMode, 
  pendingChanges, 
  onBulkChange, 
  taskTree, 
  expandedGroups, 
  onToggleGroup,
  calculateDuration,
  getPredecessorsString,
  scheduleScope,
  scheduleType,
  subAssignments = [],
  purchaseOrders = [],
  paymentCertificates = [],
  timelineStart = null,
  timelineEnd = null,
  siteAccessibility = 'urban',
  currentSeason = 'dry',
  materialLeadTime = 21,
  manpowerLeadTime = 14,
  companyDesireAdjust = 0,
  taskOverrides = {},
  criticalTaskIds = new Set(),
  taskResources = {}
}: { 
  tasks: BOQItem[], 
  dependencies: TaskDependency[], 
  projectStart: string | null, 
  projectEnd: string | null,
  selectedIds: Set<string>,
  onToggleSelect: (id: string) => void,
  isBulkEditMode: boolean,
  pendingChanges: Record<string, Partial<BOQItem>>,
  onBulkChange: (taskId: string, field: keyof BOQItem, value: any) => void,
  taskTree: TaskTreeNode[],
  expandedGroups: Set<string>,
  onToggleGroup: (id: string) => void,
  calculateDuration: (start: string | null, end: string | null) => number | string,
  getPredecessorsString: (taskId: string) => string,
  scheduleScope: string,
  scheduleType: string,
  subAssignments?: any[],
  purchaseOrders?: any[],
  paymentCertificates?: any[],
  timelineStart?: string | null,
  timelineEnd?: string | null,
  siteAccessibility?: 'urban'|'gravel'|'restricted',
  currentSeason?: 'dry'|'rainy'|'winter',
  materialLeadTime?: number,
  manpowerLeadTime?: number,
  companyDesireAdjust?: number,
  taskOverrides?: Record<string, any>,
  criticalTaskIds?: Set<string>,
  taskResources?: Record<string, string[]>
}) {
  const getProcurementStartDate = (taskStart: string | null, taskId: string) => {
    if (!taskStart) return null;
    const d = new Date(taskStart);
    
    // Check for task-specific override or use global configuration
    const override = taskOverrides[taskId] || {};
    const actualLeadTime = override.customLeadDays !== undefined ? override.customLeadDays : materialLeadTime;
    const actualAccessibility = override.customAccessibility || siteAccessibility;
    const actualSeason = override.customSeason || currentSeason;

    const accAdj = actualAccessibility === 'gravel' ? 7 : actualAccessibility === 'restricted' ? 18 : 0;
    const ssnAdj = actualSeason === 'rainy' ? 8 : actualSeason === 'winter' ? 12 : 0;
    const totalLeadDays = Number(actualLeadTime) + accAdj + ssnAdj + Number(companyDesireAdjust);
    
    d.setDate(d.getDate() - totalLeadDays);
    return d.toISOString().split('T')[0];
  };

  const getDeliveryReceiptDate = (taskStart: string | null, taskId: string) => {
    if (!taskStart) return null;
    const d = new Date(taskStart);
    const override = taskOverrides[taskId] || {};
    const actualSeason = override.customSeason || currentSeason;
    const ssnAdj = actualSeason === 'rainy' ? 8 : actualSeason === 'winter' ? 12 : 0;
    
    const deliveryLeadDays = 3 + ssnAdj;
    d.setDate(d.getDate() - deliveryLeadDays);
    return d.toISOString().split('T')[0];
  };

  const getSubcontractorMobilizationDate = (taskStart: string | null, taskId: string) => {
    if (!taskStart) return null;
    const d = new Date(taskStart);
    const override = taskOverrides[taskId] || {};
    const actualLeadTime = override.customLeadDays !== undefined ? override.customLeadDays : manpowerLeadTime;
    const actualAccessibility = override.customAccessibility || siteAccessibility;

    const accAdj = actualAccessibility === 'gravel' ? 7 : actualAccessibility === 'restricted' ? 15 : 0;
    const totalSubLeadDays = Number(actualLeadTime) + accAdj;
    
    d.setDate(d.getDate() - totalSubLeadDays);
    return d.toISOString().split('T')[0];
  };

  const [containerWidth, setContainerWidth] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);

  const [ganttColWidths, setGanttColWidths] = useState({
    structure: 350,
    days: 80,
    predecessors: 200,
  });

  const totalGanttLeftWidth = ganttColWidths.structure + ganttColWidths.days + ganttColWidths.predecessors;

  const ganttResizerRef = useRef<{ col: 'structure' | 'days' | 'predecessors', startX: number, startWidth: number } | null>(null);

  const startGanttResize = (col: 'structure' | 'days' | 'predecessors', e: React.MouseEvent) => {
    e.preventDefault();
    ganttResizerRef.current = {
      col,
      startX: e.clientX,
      startWidth: ganttColWidths[col]
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (ganttResizerRef.current) {
        const delta = moveEvent.clientX - ganttResizerRef.current.startX;
        const newWidth = Math.max(50, ganttResizerRef.current.startWidth + delta);
        setGanttColWidths(prev => ({ ...prev, [ganttResizerRef.current!.col]: newWidth }));
      }
    };

    const onMouseUp = () => {
      ganttResizerRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(Math.max(400, entry.contentRect.width));
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const start = useMemo(() => {
    if (timelineStart) return new Date(timelineStart);
    return projectStart ? new Date(projectStart) : new Date();
  }, [timelineStart, projectStart]);

  const end = useMemo(() => {
    if (timelineEnd) return new Date(timelineEnd);
    if (projectEnd) return new Date(projectEnd);
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d;
  }, [timelineEnd, projectEnd]);
  
  const totalDays = useMemo(() => {
    const diff = end.getTime() - start.getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [start, end]);

  const ticks = useMemo(() => {
    let numTicks = 6;
    if (scheduleScope === 'daily') {
      numTicks = 4;
      return Array.from({ length: numTicks }).map((_, i) => {
        const h = 6 + i * 4; // 6:00, 10:00, 14:00, 18:00
        return {
          label: `${h}:00`,
          position: (i / (numTicks - 1)) * 100
        };
      });
    }

    if (scheduleScope === 'weekly') {
      return Array.from({ length: 7 }).map((_, i) => {
        const date = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
        return {
          label: date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
          position: (i / 6) * 100
        };
      });
    }

    if (scheduleScope === 'monthly') {
      return Array.from({ length: 5 }).map((_, i) => {
        const date = new Date(start.getTime() + i * 7 * 24 * 60 * 60 * 1000);
        return {
          label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          position: Math.min(100, (i / 4) * 100)
        };
      });
    }

    return Array.from({ length: numTicks }).map((_, i) => {
      const date = new Date(start.getTime() + (i / (numTicks - 1)) * (end.getTime() - start.getTime()));
      return {
        label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        position: (i / (numTicks - 1)) * 100
      };
    });
  }, [start, end, scheduleScope]);

  const getPosition = (dateStr: string | null) => {
    if (!dateStr) return 0;
    const date = new Date(dateStr);
    const diff = date.getTime() - start.getTime();
    return (diff / (1000 * 60 * 60 * 24)) / totalDays * 100;
  };

  const getWidth = (startStr: string | null, endStr: string | null) => {
    if (!startStr || !endStr) return 0;
    const s = new Date(startStr);
    const e = new Date(endStr);
    const diff = e.getTime() - s.getTime();
    return (diff / (1000 * 60 * 60 * 24)) / totalDays * 100;
  };

  // Flatten the tree for rendering in Gantt - respecting expansion state
  const flattenedRows = useMemo(() => {
    const rows: { node: TaskTreeNode; depth: number }[] = [];
    const traverse = (node: TaskTreeNode, depth: number) => {
      rows.push({ node, depth });
      if (expandedGroups.has(node.item_no)) {
        node.children.forEach(c => traverse(c, depth + 1));
      }
    };
    taskTree.forEach(n => traverse(n, 0));
    return rows;
  }, [taskTree, expandedGroups]);

  return (
    <div className="card-default overflow-x-auto min-h-[500px] custom-scrollbar shadow-inner bg-surface-base">
      <div className="min-w-[1200px] flex flex-col">
        {/* Timeline Header */}
        <div className="flex border-b border-border-subtle bg-surface-2/40 sticky top-0 z-20">
          <div 
            style={{ width: `${totalGanttLeftWidth}px` }} 
            className="p-4 text-[10px] font-black uppercase tracking-widest text-ghost border-r border-border-subtle flex items-center shrink-0"
          >
            <div style={{ width: `${ganttColWidths.structure}px` }} className="relative group/col h-full flex items-center pr-2">
              <span className="truncate">Structure & Schedule</span>
              <div 
                onMouseDown={(e) => startGanttResize('structure', e)}
                className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize hover:bg-primary/40 transition-colors z-30"
              />
            </div>
            <div style={{ width: `${ganttColWidths.days}px` }} className="relative group/col h-full flex items-center justify-center text-center border-l border-border-subtle/30 ml-2 px-1">
              <span className="truncate">Days</span>
              <div 
                onMouseDown={(e) => startGanttResize('days', e)}
                className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize hover:bg-primary/40 transition-colors z-30"
              />
            </div>
            <div style={{ width: `${ganttColWidths.predecessors}px` }} className="relative group/col h-full flex items-center pl-4 border-l border-border-subtle/30">
              <span className="truncate">Predecessors</span>
              <div 
                onMouseDown={(e) => startGanttResize('predecessors', e)}
                className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize hover:bg-primary/40 transition-colors z-30"
              />
            </div>
          </div>
          <div className="flex-1 relative h-12 px-2">
            {ticks.map((tick, i) => (
              <div 
                key={i} 
                className="absolute flex flex-col items-center gap-1" 
                style={{ left: `${tick.position}%`, transform: 'translateX(-50%)' }}
              >
                <div className="w-px h-12 bg-border-subtle/30" />
                <span className="text-[10px] font-mono text-ghost font-black whitespace-nowrap uppercase tracking-tighter pt-1 bg-surface-base px-1">
                  {tick.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* SVG Connection Layer */}
        <div className="relative">
          <svg className="absolute inset-0 pointer-events-none w-full h-full select-none z-[8]" style={{ minHeight: `${flattenedRows.length * 44}px` }}>
            <defs>
              <marker id="arrow-indigo" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 2.5 L 7 5 L 0 7.5 z" fill="#6366f1" />
              </marker>
              <marker id="arrow-critical" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 2.5 L 7 5 L 0 7.5 z" fill="#ef4444" />
              </marker>
            </defs>
            {dependencies.map((dep, didx) => {
              const predIdx = flattenedRows.findIndex(r => r.node.item?.id === dep.predecessor_id);
              const taskIdx = flattenedRows.findIndex(r => r.node.item?.id === dep.task_id);
              if (predIdx < 0 || taskIdx < 0) return null;

              const predRow = flattenedRows[predIdx];
              const taskRow = flattenedRows[taskIdx];
              const predTask = predRow.node.item;
              const taskItem = taskRow.node.item;
              if (!predTask || !taskItem) return null;

              const predCurrent = { ...predTask, ...(pendingChanges[predTask.id] || {}) };
              const taskCurrent = { ...taskItem, ...(pendingChanges[taskItem.id] || {}) };

              const predStartVal = getPosition(predCurrent.planned_start_date);
              const predEndVal = getPosition(predCurrent.planned_start_date) + getWidth(predCurrent.planned_start_date, predCurrent.planned_end_date);

              const taskStartVal = getPosition(taskCurrent.planned_start_date);
              const taskEndVal = getPosition(taskCurrent.planned_start_date) + getWidth(taskCurrent.planned_start_date, taskCurrent.planned_end_date);

              let startPct = 0;
              let endPct = 0;

              if (dep.link_type === 'SS') {
                startPct = predStartVal;
                endPct = taskStartVal;
              } else if (dep.link_type === 'FF') {
                startPct = predEndVal;
                endPct = taskEndVal;
              } else if (dep.link_type === 'SF') {
                startPct = predStartVal;
                endPct = taskEndVal;
              } else {
                startPct = predEndVal;
                endPct = taskStartVal;
              }

              const x1 = totalGanttLeftWidth + (startPct / 100) * containerWidth;
              const x2 = totalGanttLeftWidth + (endPct / 100) * containerWidth;

              const y1 = (predIdx * 44) + 22;
              const y2 = (taskIdx * 44) + 22;

              const isCritical = criticalTaskIds.has(predTask.id) && criticalTaskIds.has(taskItem.id);
              const strokeColor = isCritical ? '#ef4444' : '#6366f1';
              const markerId = isCritical ? 'url(#arrow-critical)' : 'url(#arrow-indigo)';
              const strokeWidth = isCritical ? 2.5 : 1.5;

              let d = '';
              if (x2 > x1) {
                const midX = x1 + (x2 - x1) / 2;
                d = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
              } else {
                const offset = 12;
                d = `M ${x1} ${y1} H ${x1 + offset} V ${(y1 + y2) / 2} H ${x2 - offset} V ${y2} H ${x2}`;
              }

              return (
                <path 
                  key={`dep-arrow-${didx}`} 
                  d={d} 
                  fill="none" 
                  stroke={strokeColor} 
                  strokeWidth={strokeWidth} 
                  markerEnd={markerId}
                  className="transition-all duration-300 opacity-60 hover:opacity-100 hover:stroke-width-3"
                />
              );
            })}
          </svg>

          {/* Task Rows */}
          <div className="flex flex-col divide-y divide-border-subtle/30">
            {flattenedRows.map(({ node, depth }, idx) => {
              const task = node.item;
              const currentTask = task ? { ...task, ...(pendingChanges[task.id] || {}) } : null;
              
              const startDate = task ? currentTask?.planned_start_date : node.earliest;
              const endDate = task ? currentTask?.planned_end_date : node.latest;

              const left = Math.max(0, Math.min(getPosition(startDate || null), 100));
              const width = Math.max(0.5, Math.min(getWidth(startDate || null, endDate || null), 100 - left));
              const progress = (task ? (currentTask?.progress_pct || 0) : 0);

              const isCriticalTask = task ? criticalTaskIds.has(task.id) : false;

              return (
                <div key={node.item_no} className="flex group/row h-11 hover:bg-primary/[0.02] transition-colors items-center relative">
                  <div 
                    style={{ width: `${totalGanttLeftWidth}px` }}
                    className="flex items-center border-r border-border-subtle/50 h-full bg-surface-base/50 relative py-1 shrink-0"
                  >
                    <div 
                      style={{ width: `${ganttColWidths.structure}px`, paddingLeft: `${depth * 20 + 16}px` }}
                      className="flex items-center gap-2 h-full min-w-0 pr-4 shrink-0 relative"
                    >
                        {/* Connector line for hierarchy */}
                        {depth > 0 && (
                          <div className="absolute left-[-10px] top-1/2 w-2.5 border-t border-dashed border-border-subtle" />
                        )}

                        {node.children.length > 0 && (
                          <button 
                            onClick={() => onToggleGroup(node.item_no)}
                            className="p-1 hover:bg-surface-3 rounded transition-all text-primary z-10 bg-surface-base shrink-0"
                          >
                            {expandedGroups.has(node.item_no) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </button>
                        )}

                        {!node.children.length && !task && (
                           <div className="w-5 flex items-center justify-center shrink-0">
                             <div className="w-1 h-1 rounded-full bg-border-muted" />
                           </div>
                        )}

                        {task && (
                        <button 
                          onClick={() => onToggleSelect(task.id)}
                          className="shrink-0 text-ghost hover:text-primary transition-colors mr-1"
                        >
                          {selectedIds.has(task.id) ? <CheckSquare className="w-3.5 h-3.5 text-primary" /> : <Square className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      {isBulkEditMode && task ? (
                        <div className="text-[11px] font-bold text-indigo-700/80 italic leading-tight truncate py-0.5 min-w-0" title={cleanRichText(currentTask?.description || '')}>
                          {cleanRichText(currentTask?.description || '')}
                        </div>
                      ) : (
                        <div className={cn(
                          "text-[11px] font-bold transition-colors leading-tight min-w-0 py-0.5 flex items-center gap-1.5 truncate pr-2",
                          !task ? "text-ghost uppercase font-black tracking-tighter" : "text-main"
                        )} title={task ? cleanRichText(task.description) : node.item_no}>
                          <span className="truncate">
                            {task ? cleanRichText(task.description) : node.item_no}
                          </span>
                          {isCriticalTask && (
                            <span className="px-1 py-0.2 text-[7px] font-black uppercase text-red-600 bg-red-50 dark:bg-red-950/20 border border-red-250 rounded shrink-0">CRITICAL</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div 
                      style={{ width: `${ganttColWidths.days}px` }}
                      className="text-center font-mono text-[10px] text-dim border-l border-border-subtle/30 h-full flex items-center justify-center shrink-0"
                    >
                      {task ? (calculateDuration(currentTask?.planned_start_date, currentTask?.planned_end_date) || '—') : '—'}
                    </div>

                    <div 
                      style={{ width: `${ganttColWidths.predecessors}px` }}
                      className="pl-4 font-mono text-[9px] text-ghost truncate border-l border-border-subtle/30 h-full flex items-center shrink-0" 
                      title={getPredecessorsString(task?.id || '')}
                    >
                       {task ? (getPredecessorsString(task.id) || '—') : '—'}
                    </div>
                  </div>
                  <div className="flex-1 relative h-full flex items-center px-4 border-b border-border-subtle/20">
                    {(startDate && endDate) && (
                      <div 
                        className={cn(
                          "relative transition-all flex items-center px-2 group/bar animate-in fade-in duration-300",
                          task ? "shadow-md z-10" : "opacity-60 z-0",
                          scheduleType === 'milestone' && task ? "h-3 w-3 rotate-45 rounded-sm" : "h-6 rounded-md animate-in slide-in-from-left-2",
                          isCriticalTask && "ring-2 ring-red-400 dark:ring-red-500 shadow-lg ring-offset-1 dark:ring-offset-slate-900"
                        )}
                        style={{ 
                          left: `${left}%`, 
                          width: scheduleType === 'milestone' && task ? '12px' : `${width}%`, 
                          minWidth: '12px',
                          backgroundColor: task ? (
                            scheduleType === 'milestone' ? '#f43f5e' : (
                              isCriticalTask ? '#ef4444' : (
                                task.status === 'complete' ? '#0ea5e9' : '#06b6d4'
                              )
                            )
                          ) : '#cbd5e1'
                        }}
                      >
                         {!task && (
                           <>
                             {/* Brackets for group nodes */}
                             <div className="absolute inset-y-0 left-0 w-1.5 bg-ghost/40 rounded-l-sm" />
                             <div className="absolute inset-y-0 right-0 w-1.5 bg-ghost/40 rounded-r-sm" />
                             <div className="absolute top-1/2 left-0 right-0 h-px bg-ghost/20 -translate-y-1/2" />
                           </>
                         )}

                         {/* Date Tooltip on hover */}
                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-main text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-xl border border-white/10 backdrop-blur-sm">
                           {startDate} — {endDate}
                         </div>

                        {task && scheduleType !== 'milestone' && (
                          <>
                            <div 
                              className="absolute inset-y-0 left-0 bg-white/20 rounded-l-md" 
                              style={{ width: `${progress}%` }} 
                            />
                            {width > 12 && (
                              <span className="text-[9px] font-black text-white relative truncate drop-shadow-sm pointer-events-none">
                                {progress}%
                              </span>
                            )}
                          </>
                        )}

                        {/* Comma-delimited resource overlay right after the Gautt bar */}
                        {task && taskResources[task.id] && taskResources[task.id].length > 0 && (
                          <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-90">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                            <span 
                              className="text-[8.5px] font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap bg-indigo-50/70 dark:bg-indigo-950/40 px-1 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/40"
                              title={taskResources[task.id].join(', ')}
                            >
                              {taskResources[task.id].join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                  {/* Lead Time Procurement Overlays */}
                  {scheduleType === 'procurement' && task && (() => {
                    const procDate = getProcurementStartDate(startDate, task.id);
                    if (!procDate) return null;
                    const diffDays = startDate ? Math.round((new Date(startDate).getTime() - new Date(procDate).getTime()) / (1000 * 60 * 60 * 24)) : 21;
                    return (
                      <div 
                        className="absolute h-4 rounded-md bg-amber-500/20 border border-amber-500/40 flex items-center px-1.5 cursor-pointer z-[5] group/proc-bar whitespace-nowrap overflow-hidden hover:bg-amber-500/35 hover:border-amber-500 transition-colors animate-in fade-in shadow-sm"
                        style={{ 
                          left: `${Math.max(0, Math.min(getPosition(procDate), 100))}%`, 
                          width: `${Math.max(0.5, Math.min(getWidth(procDate, startDate || null), 100))}%`,
                          top: '2px'
                        }}
                      >
                        <ShoppingCart className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 mr-1 shrink-0" />
                        <span className="text-[7.5px] font-black uppercase text-amber-800 dark:text-amber-400 font-mono tracking-tighter truncate leading-none">
                          PO Lead: {diffDays}d
                        </span>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-950 text-white text-[9.5px] p-3 rounded-xl opacity-0 group-hover/proc-bar:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-2xl border border-white/10 flex flex-col gap-1">
                          <span className="font-bold text-amber-400 flex items-center gap-1.5 leading-none">
                            <ShoppingCart className="w-3.5 h-3.5" /> Automated Procurement Schedule
                          </span>
                          <span className="text-white/85">Place Material PO before: <strong>{new Date(procDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</strong></span>
                          <span className="text-[8.5px] text-white/50 border-t border-white/10 pt-1 mt-1">Calculated based on {diffDays} days safety and delivery lead times.</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Material Delivery Logistics Overlays */}
                  {scheduleType === 'delivery' && task && (() => {
                    const recDate = getDeliveryReceiptDate(startDate, task.id);
                    if (!recDate) return null;
                    return (
                      <div 
                        className="absolute h-4 rounded-md bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/25 hover:border-emerald-500 flex items-center justify-center gap-1 px-1.5 cursor-pointer z-25 group/del-bar transition-all shadow-sm animate-in fade-in"
                        style={{ 
                          left: `${Math.max(0, Math.min(getPosition(recDate), 100))}%`,
                          width: '55px',
                          top: '3px'
                        }}
                      >
                        <Truck className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                        <span className="text-[8px] font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-tighter">REC</span>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-950 text-white text-[9.5px] p-3 rounded-xl opacity-0 group-hover/del-bar:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-2xl border border-white/10 flex flex-col gap-1">
                          <span className="font-bold text-emerald-400 flex items-center gap-1.5 leading-none">
                            <Truck className="w-3.5 h-3.5" /> Automated Arrival Expectation
                          </span>
                          <span className="text-white/85">On-Site Logistics Receipt tick: <strong>{new Date(recDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</strong></span>
                          <span className="text-[8.5px] text-white/50 border-t border-white/10 pt-1 mt-1">Reflects transport access conditions & weather factors.</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Subcontractor Assignment Overlays */}
                  {scheduleType === 'manpower' && task && (() => {
                    const assignment = subAssignments?.find(a => a.boq_item_id === task.id);
                    const subName = assignment?.subcontractor?.company_name || 'Subcontractor Assigned (MOCK)';
                    const mobDate = getSubcontractorMobilizationDate(startDate, task.id);
                    if (!mobDate) return null;
                    const diffMobDays = startDate ? Math.round((new Date(startDate).getTime() - new Date(mobDate).getTime()) / (1000 * 60 * 60 * 24)) : 14;
                    return (
                      <>
                        {/* Mobilization Contract Agreement Lead time limit overlay */}
                        <div 
                          className="absolute h-3 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center px-1.5 cursor-pointer z-[5] group/sub-bar whitespace-nowrap overflow-hidden hover:bg-indigo-500/25 transition-all"
                          style={{ 
                            left: `${Math.max(0, Math.min(getPosition(mobDate), 100))}%`, 
                            width: `${Math.max(0.5, Math.min(getWidth(mobDate, startDate || null), 100))}%`,
                            top: '2px'
                          }}
                        >
                          <Users className="w-2 h-2 text-indigo-400 mr-1 shrink-0" />
                          <span className="text-[7px] font-bold font-mono text-indigo-500 uppercase leading-none truncate">
                            Con Agreement Lead ({diffMobDays}d)
                          </span>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-950 text-white text-[9.5px] p-3 rounded-xl opacity-0 group-hover/sub-bar:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-2xl border border-white/10 flex flex-col gap-1">
                            <span className="font-bold text-indigo-400 flex items-center gap-1.5 leading-none">
                              <Users className="w-3.5 h-3.5" /> Subcontractor Procurement Timeline
                            </span>
                            <span className="text-white/85">Con Agreement Date: <strong>{new Date(mobDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</strong></span>
                            <span className="text-white/85">Active Mobilization: <strong>{startDate}</strong></span>
                            <span className="text-[8.5px] text-white/50 border-t border-white/10 pt-1 mt-1">Calculated automation based on subcontractor acquisition lead.</span>
                          </div>
                        </div>
                        {assignment && (
                          <div 
                            className="absolute text-[8.5px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-500/20 border border-indigo-500/30 rounded px-1.5 py-0.5 pointer-events-none truncate max-w-[150px] shadow-sm flex items-center gap-1 animate-in fade-in"
                            style={{ 
                              left: `${left + width + 1}%`,
                              top: '10px'
                            }}
                          >
                            <Users className="w-2.5 h-2.5" />
                            {subName}
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Payment Cycles & claims overlay */}
                  {scheduleType === 'payment' && task && (
                    <div 
                      className="absolute h-4 px-1.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 font-mono text-[8.5px] font-black flex items-center justify-center shadow-sm z-20 group/pay cursor-help animate-in fade-in"
                      style={{ 
                        left: `${left + width + 1}%`,
                        top: '10px'
                      }}
                    >
                      <DollarSign className="w-2.5 h-2.5 mr-0.5" />
                      <span>Claim ${(task.contract_qty * task.contract_rate).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-900 text-white text-[9px] px-2.5 py-1 rounded opacity-0 group-hover/pay:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl border border-white/10 flex flex-col gap-0.5">
                        <span className="font-bold flex items-center gap-1 text-emerald-400"><DollarSign className="w-3 h-3" /> Claim Handover Value</span>
                        <span>Contract Rate: ${task.contract_rate.toLocaleString()} / {task.unit || 'unit'}</span>
                        <span>Target Claim Date: <strong>{endDate}</strong></span>
                      </div>
                    </div>
                  )}
                  {isBulkEditMode && task && (
                    <div className="absolute inset-0 flex items-center justify-end px-4 gap-2 pointer-events-none">
                       <div className="flex items-center gap-1 bg-indigo-50/95 dark:bg-indigo-950/95 border border-indigo-200/50 rounded-lg p-1 px-2 shadow-xl backdrop-blur-md pointer-events-auto ring-2 ring-indigo-500/20">
                          <input 
                            type="date"
                            value={currentTask?.planned_start_date || ''}
                            onChange={(e) => onBulkChange(task.id, 'planned_start_date', e.target.value)}
                            className="bg-transparent text-[9px] font-mono border-0 p-0 focus:ring-0 outline-none w-20 text-indigo-900 dark:text-indigo-100"
                          />
                          <span className="text-[9px] text-indigo-400 font-bold">→</span>
                          <input 
                            type="date"
                            value={currentTask?.planned_end_date || ''}
                            onChange={(e) => onBulkChange(task.id, 'planned_end_date', e.target.value)}
                            className="bg-transparent text-[9px] font-mono border-0 p-0 focus:ring-0 outline-none w-20 text-indigo-900 dark:text-indigo-100"
                          />
                          <div className="w-px h-3 bg-indigo-200 mx-1" />
                          <input 
                            type="number"
                            value={currentTask?.progress_pct || 0}
                            onChange={(e) => onBulkChange(task.id, 'progress_pct', parseInt(e.target.value) || 0)}
                            className="bg-transparent text-[9px] font-mono border-0 p-0 focus:ring-0 outline-none w-8 text-right text-indigo-900 dark:text-indigo-100 font-bold"
                          />
                          <span className="text-[9px] text-indigo-400 font-bold">%</span>
                       </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </div>
  );
}

const getDaysBetween = (d1Str: string, d2Str: string) => {
  const d1 = new Date(d1Str);
  const d2 = new Date(d2Str);
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
};

const getDurationDays = (startStr: string | null, endStr: string | null) => {
  if (!startStr || !endStr) return 1;
  const s = new Date(startStr);
  const e = new Date(endStr);
  const diff = e.getTime() - s.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
};

interface TaskTreeNode {
  item: BOQItem | null;
  item_no: string;
  children: TaskTreeNode[];
  earliest: string | null;
  latest: string | null;
  depth: number;
}

export function Schedule({ project }: ScheduleProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [colWidths, setColWidths] = useState({
    item_no: 120,
    description: 250,
    start_date: 100,
    no_days: 70,
    end_date: 100,
    predecessors: 130,
    progress: 100,
    contract_qty: 100,
    surveyed_qty: 100,
    actual_qty: 100,
    amount: 110,
    trade_name: 120,
    resources: 180,
    actions: 100,
    timeline: 450
  });

  const handleResize = (col: keyof typeof colWidths, width: number) => {
    setColWidths(prev => ({ ...prev, [col]: Math.max(50, width) }));
  };

  const resizerRef = useRef<{ col: string, startX: number, startWidth: number } | null>(null);

  const startResize = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    resizerRef.current = { 
      col, 
      startX: e.clientX, 
      startWidth: colWidths[col as keyof typeof colWidths] 
    };
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (resizerRef.current) {
        const delta = moveEvent.clientX - resizerRef.current.startX;
        handleResize(resizerRef.current.col as any, resizerRef.current.startWidth + delta);
      }
    };
    
    const onMouseUp = () => {
      resizerRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('toggle-focus-mode', { detail: isFullscreen }));
  }, [isFullscreen]);
  const [tasks, setTasks] = useState<BOQItem[]>([]);
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [editingTask, setEditingTask] = useState<Partial<BOQItem> | null>(null);
  const [milestones, setMilestones] = useState<ScheduleMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Advanced Scope and Classification States
  const [scheduleScope, setScheduleScope] = useState<'daily'|'weekly'|'monthly'|'quarterly'|'yearly'|'start-to-finish'|'custom'|'1-day'|'2-days'|'3-days'|'4-days'|'5-days'|'1-week'|'1-month'>('start-to-finish');
  const [scheduleType, setScheduleType] = useState<'detailed'|'crushed'|'procurement'|'delivery'|'manpower'|'milestone'|'payment'>('detailed');
  const [refDate, setRefDate] = useState<Date>(new Date());
  
  // Custom interactive drop-downs states
  const [isScopeDropdownOpen, setIsScopeDropdownOpen] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [isLogisticsOpen, setIsLogisticsOpen] = useState(false);
  const [isColFilterOpen, setIsColFilterOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState({
    start_date: true,
    no_days: true,
    end_date: true,
    predecessors: true,
    progress: true,
    contract_qty: true,
    surveyed_qty: true,
    actual_qty: true,
    amount: true,
    trade_name: true,
    resources: true,
  });
  const scopeDropdownRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const colFilterRef = useRef<HTMLDivElement>(null);

  // State for comma-delimited resource list grouping
  const [taskResources, setTaskResources] = useState<Record<string, string[]>>({});

  // Single-task edit predecessor controls (modal)
  const [modalPredecessorId, setModalPredecessorId] = useState<string>('');
  const [modalLinkType, setModalLinkType] = useState<'FS'|'SS'|'FF'|'SF'>('FS');
  const [modalLagDays, setModalLagDays] = useState<number>(0);

  // Synchronise modal dependency states with the edited task's current dependency
  useEffect(() => {
    if (!editingTask?.id) {
      setModalPredecessorId('');
      setModalLinkType('FS');
      setModalLagDays(0);
      return;
    }
    const isEditingAuto = typeof editingTask.id === 'string' && editingTask.id.startsWith('auto_');
    const editingTargetId = isEditingAuto 
      ? editingTask.id.replace(/^auto_(proc|del|man|ms|pay)_/, '')
      : editingTask.id;

    const existingDep = dependencies.find(d => d.task_id === editingTargetId);
    if (existingDep) {
      setModalPredecessorId(existingDep.predecessor_id || '');
      setModalLinkType(existingDep.link_type || 'FS');
      setModalLagDays(existingDep.lag_days || 0);
    } else {
      setModalPredecessorId('');
      setModalLinkType('FS');
      setModalLagDays(0);
    }
  }, [editingTask, dependencies]);

  // Bulk-edit mode pending predecessor states
  const [pendingDepChanges, setPendingDepChanges] = useState<Record<string, { predecessor_id: string; link_type: 'FS'|'SS'|'FF'|'SF'; lag_days: number } | null>>({});

  // Configurable bounds
  const [customTimelineStart, setCustomTimelineStart] = useState<string>(project.start_date || new Date().toISOString().split('T')[0]);
  const [customTimelineEnd, setCustomTimelineEnd] = useState<string>(project.end_date || new Date().toISOString().split('T')[0]);

  // Project site and logistics parameters
  const [siteAccessibility, setSiteAccessibility] = useState<'urban'|'gravel'|'restricted'>('urban');
  const [currentSeason, setCurrentSeason] = useState<'dry'|'rainy'|'winter'>('dry');
  const [materialLeadTime, setMaterialLeadTime] = useState<number>(21);
  const [manpowerLeadTime, setManpowerLeadTime] = useState<number>(14);
  const [companyDesireAdjust, setCompanyDesireAdjust] = useState<number>(0);

  // Overrides list for customized company desires
  const [taskOverrides, setTaskOverrides] = useState<Record<string, {
    customLeadDays?: number;
    customAccessibility?: string;
    customSeason?: string;
  }>>(() => {
    try {
      const saved = localStorage.getItem(`schedule_overrides_${project.id}`);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Individual task override edits
  const [customLead, setCustomLead] = useState<number | undefined>(undefined);
  const [customAccess, setCustomAccess] = useState<string>('default');
  const [customSeasonOverride, setCustomSeasonOverride] = useState<string>('default');

  const [subAssignments, setSubAssignments] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [paymentCertificates, setPaymentCertificates] = useState<any[]>([]);

  // Close dropdowns on outside click helper
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (scopeDropdownRef.current && !scopeDropdownRef.current.contains(event.target as Node)) {
        setIsScopeDropdownOpen(false);
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
        setIsTypeDropdownOpen(false);
      }
      if (colFilterRef.current && !colFilterRef.current.contains(event.target as Node)) {
        setIsColFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleNavigateScope = (direction: 'prev' | 'next') => {
    const factor = direction === 'next' ? 1 : -1;
    const nextDate = new Date(refDate);
    switch (scheduleScope) {
      case '1-day':
      case 'daily':
        nextDate.setDate(nextDate.getDate() + factor);
        break;
      case '2-days':
        nextDate.setDate(nextDate.getDate() + 2 * factor);
        break;
      case '3-days':
        nextDate.setDate(nextDate.getDate() + 3 * factor);
        break;
      case '4-days':
        nextDate.setDate(nextDate.getDate() + 4 * factor);
        break;
      case '5-days':
        nextDate.setDate(nextDate.getDate() + 5 * factor);
        break;
      case '1-week':
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7 * factor);
        break;
      case '1-month':
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + factor);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3 * factor);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + factor);
        break;
      default:
        break;
    }
    setRefDate(nextDate);
  };

  const scopeRange = useMemo(() => {
    let earliestTaskStart: string | null = null;
    let latestTaskEnd: string | null = null;
    tasks.forEach(t => {
      if (t.planned_start_date) {
        if (!earliestTaskStart || t.planned_start_date < earliestTaskStart) {
          earliestTaskStart = t.planned_start_date;
        }
      }
      if (t.planned_end_date) {
        if (!latestTaskEnd || t.planned_end_date > latestTaskEnd) {
          latestTaskEnd = t.planned_end_date;
        }
      }
    });
    const fallbackStart = project.start_date || new Date().toISOString().split('T')[0];
    const fallbackEnd = project.end_date || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const fullStart = earliestTaskStart || fallbackStart;
    const fullEnd = latestTaskEnd || fallbackEnd;

    if (scheduleScope === 'custom') {
      return { start: customTimelineStart || fullStart, end: customTimelineEnd || fullEnd };
    }

    return {
      start: fullStart,
      end: fullEnd
    };
  }, [scheduleScope, customTimelineStart, customTimelineEnd, tasks, project]);

  const scopeRangeLabel = useMemo(() => {
    if (scheduleScope === 'start-to-finish') return 'Full Span of Project';
    if (scheduleScope === 'custom') {
      const startD = customTimelineStart ? new Date(customTimelineStart) : null;
      const endD = customTimelineEnd ? new Date(customTimelineEnd) : null;
      if (!startD || !endD) return 'Custom Timeframe';
      return `Custom Interval: ${startD.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})} — ${endD.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}`;
    }
    if (!scopeRange.start || !scopeRange.end) return '';

    const startD = new Date(scopeRange.start);
    const endD = new Date(scopeRange.end);

    const optionsShort: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    const optionsMonthOnly: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };

    switch (scheduleScope) {
      case '1-day':
      case 'daily':
        return startD.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
      case '2-days':
        return `${startD.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${endD.toLocaleDateString(undefined, optionsShort)}`;
      case '3-days':
        return `${startD.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${endD.toLocaleDateString(undefined, optionsShort)}`;
      case '4-days':
        return `${startD.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${endD.toLocaleDateString(undefined, optionsShort)}`;
      case '5-days':
        return `${startD.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${endD.toLocaleDateString(undefined, optionsShort)}`;
      case '1-week':
      case 'weekly':
        return `${startD.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${endD.toLocaleDateString(undefined, optionsShort)}`;
      case '1-month':
      case 'monthly':
        return startD.toLocaleDateString(undefined, optionsMonthOnly);
      case 'quarterly': {
        const qIndex = Math.floor(startD.getMonth() / 3) + 1;
        return `Quarter ${qIndex} (${startD.getFullYear()}) • ${startD.toLocaleDateString(undefined, { month: 'short' })} — ${endD.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
      }
      case 'yearly':
        return `${startD.getFullYear()}`;
      default:
        return `${scopeRange.start} to ${scopeRange.end}`;
    }
  }, [scheduleScope, scopeRange, customTimelineStart, customTimelineEnd]);

  const timelineStart = scopeRange.start;
  const timelineEnd = scopeRange.end;

  const start = useMemo(() => {
    if (timelineStart) return new Date(timelineStart);
    return project.start_date ? new Date(project.start_date) : new Date();
  }, [timelineStart, project.start_date]);

  const end = useMemo(() => {
    if (timelineEnd) return new Date(timelineEnd);
    if (project.end_date) return new Date(project.end_date);
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d;
  }, [timelineEnd, project.end_date]);

  const totalDays = useMemo(() => {
    const diff = end.getTime() - start.getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [start, end]);

  // Dynamically set timeline column width based on selected timescale and totalDays
  useEffect(() => {
    let dayWidth = 3.33; // Default fallback (monthly)
    switch (scheduleScope) {
      case '1-day':
      case 'daily':
        dayWidth = 120; // super wide zoom for fine-grained day view
        break;
      case '2-days':
        dayWidth = 60;
        break;
      case '3-days':
        dayWidth = 40;
        break;
      case '4-days':
        dayWidth = 30;
        break;
      case '5-days':
        dayWidth = 24;
        break;
      case '1-week':
      case 'weekly':
        dayWidth = 100 / 7; // ~14.3px
        break;
      case '1-month':
      case 'monthly':
        dayWidth = 100 / 30; // ~3.33px
        break;
      case 'quarterly':
        dayWidth = 100 / 92; // ~1.08px
        break;
      case 'yearly':
        dayWidth = 100 / 365; // ~0.27px
        break;
      case 'custom':
      case 'start-to-finish':
      default:
        dayWidth = 100 / 15; // default scale (~6.67px per day)
        break;
    }

    const calculatedWidth = Math.round(totalDays * dayWidth);
    // reasonable bounds: minimum of 600px wide, maximum of 15000px
    const clampedWidth = Math.max(600, Math.min(15000, calculatedWidth));
    
    setColWidths(prev => ({
      ...prev,
      timeline: clampedWidth
    }));
  }, [scheduleScope, totalDays]);

  const getPosition = useCallback((dateStr: string | null) => {
    if (!dateStr) return 0;
    const date = new Date(dateStr);
    const diff = date.getTime() - start.getTime();
    return (diff / (1000 * 60 * 60 * 24)) / totalDays * 100;
  }, [start, totalDays]);

  const getWidth = useCallback((startStr: string | null, endStr: string | null) => {
    if (!startStr || !endStr) return 0;
    const s = new Date(startStr);
    const e = new Date(endStr);
    const diff = e.getTime() - s.getTime();
    return (diff / (1000 * 60 * 60 * 24)) / totalDays * 100;
  }, [totalDays]);

  const ticks = useMemo(() => {
    const list: Array<{ label: string; position: number }> = [];
    const totalMs = end.getTime() - start.getTime();
    if (totalMs <= 0) return [];

    const startYear = start.getFullYear();
    const startMonth = start.getMonth();
    const startMDate = start.getDate();

    const getPosPct = (time: number) => {
      const diff = time - start.getTime();
      return (diff / totalMs) * 100;
    };

    // Day scales
    if (['1-day', 'daily', '2-days', '3-days', '4-days', '5-days'].includes(scheduleScope)) {
      const steps = Math.ceil(totalMs / (1000 * 60 * 60 * 24));
      const stepInterval = scheduleScope === '1-day' || scheduleScope === 'daily' ? 1 
                         : scheduleScope === '2-days' ? 2
                         : scheduleScope === '3-days' ? 3
                         : scheduleScope === '4-days' ? 4 : 5;
      
      for (let i = 0; i <= steps; i += stepInterval) {
        const d = new Date(startYear, startMonth, startMDate + i);
        if (d.getTime() > end.getTime() + 12 * 60 * 60 * 1000) break;
        list.push({
          label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          position: getPosPct(d.getTime())
        });
      }
    } 
    // Week scale
    else if (scheduleScope === '1-week' || scheduleScope === 'weekly') {
      const steps = Math.ceil(totalMs / (1000 * 60 * 60 * 24));
      for (let i = 0; i <= steps; i += 7) {
        const d = new Date(startYear, startMonth, startMDate + i);
        if (d.getTime() > end.getTime() + 12 * 60 * 60 * 1000) break;
        list.push({
          label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          position: getPosPct(d.getTime())
        });
      }
    } 
    // Month / Quarter scales
    else if (scheduleScope === '1-month' || scheduleScope === 'monthly' || scheduleScope === 'quarterly') {
      const current = new Date(startYear, startMonth, 1);
      const limit = new Date(end.getTime());
      limit.setMonth(limit.getMonth() + 1);

      while (current.getTime() <= limit.getTime()) {
        if (current.getTime() >= start.getTime() && current.getTime() <= end.getTime()) {
          const mLabel = current.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
          list.push({
            label: mLabel,
            position: getPosPct(current.getTime())
          });
        }
        current.setMonth(current.getMonth() + 1);
      }
    } 
    // Year / Start-to-finish / Custom scales
    else {
      const diffYears = end.getFullYear() - start.getFullYear();
      if (diffYears < 2) {
        const current = new Date(startYear, startMonth, 1);
        while (current.getTime() <= end.getTime()) {
          if (current.getTime() >= start.getTime()) {
            list.push({
              label: current.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
              position: getPosPct(current.getTime())
            });
          }
          current.setMonth(current.getMonth() + 1);
        }
      } else {
        for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
          const d = new Date(y, 0, 1);
          if (d.getTime() >= start.getTime() && d.getTime() <= end.getTime()) {
            list.push({
              label: String(y),
              position: getPosPct(d.getTime())
            });
          }
        }
      }
    }

    if (list.length === 0) {
      list.push({ label: start.toLocaleDateString(), position: 0 });
      list.push({ label: end.toLocaleDateString(), position: 100 });
    }

    return list;
  }, [start, end, scheduleScope]);

  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDurInput, setModalDurInput] = useState<string>('1');

  // Synchronize modalDurInput when modal opens or editingTask changes originally
  useEffect(() => {
    if (isModalOpen && editingTask) {
      const dur = (editingTask.planned_start_date && editingTask.planned_end_date)
        ? getDurationDays(editingTask.planned_start_date, editingTask.planned_end_date)
        : 1;
      setModalDurInput(String(dur));
    }
  }, [isModalOpen, editingTask?.id]);

  useEffect(() => {
    if (isModalOpen && editingTask?.planned_start_date && editingTask?.planned_end_date) {
      const actualDur = getDurationDays(editingTask.planned_start_date, editingTask.planned_end_date);
      const inputDur = parseInt(modalDurInput, 10);
      if (actualDur !== inputDur && !isNaN(inputDur)) {
        setModalDurInput(String(actualDur));
      }
    }
  }, [isModalOpen, editingTask?.planned_start_date, editingTask?.planned_end_date]);
  
  // Bulk/Mass Edit States
  const [isBulkEditMode, setIsBulkEditMode] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<BOQItem>>>({});
  
  // New States
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isMassEditLoading, setIsMassEditLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [newDep, setNewDep] = useState<{ predecessor_id: string; link_type: 'FS'|'SS'|'FF'|'SF'; lag_days: number }>({
    predecessor_id: '',
    link_type: 'FS',
    lag_days: 0
  });

  const calculateDuration = useCallback((start: string | null, end: string | null) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    const diff = e.getTime() - s.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  }, []);

  // Standalone inline helper functions for schedule focus mappings
  const getProcurementStartDate = useCallback((taskStart: string | null, taskId: string) => {
    if (!taskStart) return null;
    const d = new Date(taskStart);
    
    const override = taskOverrides[taskId] || {};
    const actualLeadTime = override.customLeadDays !== undefined ? override.customLeadDays : materialLeadTime;
    const actualAccessibility = override.customAccessibility || siteAccessibility;
    const actualSeason = override.customSeason || currentSeason;

    const accAdj = actualAccessibility === 'gravel' ? 7 : actualAccessibility === 'restricted' ? 18 : 0;
    const ssnAdj = actualSeason === 'rainy' ? 8 : actualSeason === 'winter' ? 12 : 0;
    const totalLeadDays = Number(actualLeadTime) + accAdj + ssnAdj + Number(companyDesireAdjust);
    
    d.setDate(d.getDate() - totalLeadDays);
    return d.toISOString().split('T')[0];
  }, [taskOverrides, materialLeadTime, siteAccessibility, currentSeason, companyDesireAdjust]);

  const getDeliveryReceiptDate = useCallback((taskStart: string | null, taskId: string) => {
    if (!taskStart) return null;
    const d = new Date(taskStart);
    const override = taskOverrides[taskId] || {};
    const actualSeason = override.customSeason || currentSeason;
    const ssnAdj = actualSeason === 'rainy' ? 8 : actualSeason === 'winter' ? 12 : 0;
    
    const deliveryLeadDays = 3 + ssnAdj;
    d.setDate(d.getDate() - deliveryLeadDays);
    return d.toISOString().split('T')[0];
  }, [taskOverrides, currentSeason]);

  const getSubcontractorMobilizationDate = useCallback((taskStart: string | null, taskId: string) => {
    if (!taskStart) return null;
    const d = new Date(taskStart);
    const override = taskOverrides[taskId] || {};
    const actualLeadTime = override.customLeadDays !== undefined ? override.customLeadDays : manpowerLeadTime;
    const actualAccessibility = override.customAccessibility || siteAccessibility;

    const accAdj = actualAccessibility === 'gravel' ? 7 : actualAccessibility === 'restricted' ? 15 : 0;
    const totalSubLeadDays = Number(actualLeadTime) + accAdj;
    
    d.setDate(d.getDate() - totalSubLeadDays);
    return d.toISOString().split('T')[0];
  }, [taskOverrides, manpowerLeadTime, siteAccessibility]);

  // Merged dependencies (raw DB + pending bulk modifications)
  const mergedDependencies = useMemo(() => {
    const depsMap = new Map<string, TaskDependency>();
    dependencies.forEach(d => {
      depsMap.set(d.task_id, d);
    });
    
    Object.entries(pendingDepChanges).forEach(([taskId, update]) => {
      if (update === null) {
        depsMap.delete(taskId);
      } else {
        const existing = depsMap.get(taskId);
        depsMap.set(taskId, {
          id: existing?.id || `pending_${taskId}`,
          project_id: project.id,
          tenant_id: project.tenant_id || '',
          task_id: taskId,
          predecessor_id: update.predecessor_id,
          link_type: update.link_type,
          lag_days: update.lag_days
        } as TaskDependency);
      }
    });
    
    return Array.from(depsMap.values());
  }, [dependencies, pendingDepChanges, project.id, project.tenant_id]);

  // Pure CPM dates propagator & Critical Path identifier runs on ALL tasks
  const { calculatedTasks, criticalTaskIds } = useMemo(() => {
    if (tasks.length === 0) {
      return { calculatedTasks: [], criticalTaskIds: new Set<string>() };
    }

    const projectStart = project.start_date || new Date().toISOString().split('T')[0];
    const taskMap = new Map<string, BOQItem>();
    
    // Merge pending changes to tasks first
    tasks.forEach(t => {
      taskMap.set(t.id, {
        ...t,
        ...(pendingChanges[t.id] || {})
      });
    });

    const depMap = new Map<string, TaskDependency>();
    mergedDependencies.forEach(d => {
      // Deduplicate so only one dependency per task is respected
      depMap.set(d.task_id, d);
    });

    // Solve start & end dates in Forward Pass (topological Date propagation)
    const visiting = new Set<string>();
    const visited = new Set<string>();

    function solveDates(taskId: string) {
      if (visited.has(taskId)) return;
      if (visiting.has(taskId)) {
        // Break cycle
        visited.add(taskId);
        return;
      }

      visiting.add(taskId);

      const t = taskMap.get(taskId);
      if (!t) {
        visiting.delete(taskId);
        return;
      }

      const dur = getDurationDays(t.planned_start_date, t.planned_end_date);

      const dep = depMap.get(taskId);
      // Ensure predecessor is valid and not self
      if (!dep || !dep.predecessor_id || dep.predecessor_id === taskId || !taskMap.has(dep.predecessor_id)) {
        const start = t.planned_start_date || projectStart;
        const sD = new Date(start);
        const eD = new Date(sD);
        eD.setDate(sD.getDate() + (dur - 1));

        t.planned_start_date = start;
        t.planned_end_date = eD.toISOString().split('T')[0];

        visiting.delete(taskId);
        visited.add(taskId);
        return;
      }

      // Recursively solve predecessor dates
      solveDates(dep.predecessor_id);

      const pred = taskMap.get(dep.predecessor_id);
      if (!pred || !pred.planned_start_date || !pred.planned_end_date) {
        const start = t.planned_start_date || projectStart;
        const sD = new Date(start);
        const eD = new Date(sD);
        eD.setDate(sD.getDate() + (dur - 1));

        t.planned_start_date = start;
        t.planned_end_date = eD.toISOString().split('T')[0];

        visiting.delete(taskId);
        visited.add(taskId);
        return;
      }

      const pStart = new Date(pred.planned_start_date);
      const pEnd = new Date(pred.planned_end_date);
      const lag = dep.lag_days || 0;

      let calculatedStart = new Date(projectStart);
      let calculatedEnd = new Date(projectStart);

      switch (dep.link_type) {
        case 'FS':
          calculatedStart = new Date(pEnd);
          calculatedStart.setDate(pEnd.getDate() + 1 + lag);
          calculatedEnd = new Date(calculatedStart);
          calculatedEnd.setDate(calculatedStart.getDate() + (dur - 1));
          break;
        case 'SS':
          calculatedStart = new Date(pStart);
          calculatedStart.setDate(pStart.getDate() + lag);
          calculatedEnd = new Date(calculatedStart);
          calculatedEnd.setDate(calculatedStart.getDate() + (dur - 1));
          break;
        case 'FF':
          calculatedEnd = new Date(pEnd);
          calculatedEnd.setDate(pEnd.getDate() + lag);
          calculatedStart = new Date(calculatedEnd);
          calculatedStart.setDate(calculatedEnd.getDate() - (dur - 1));
          break;
        case 'SF':
          calculatedEnd = new Date(pStart);
          calculatedEnd.setDate(pStart.getDate() + lag);
          calculatedStart = new Date(calculatedEnd);
          calculatedStart.setDate(calculatedEnd.getDate() - (dur - 1));
          break;
        default:
          calculatedStart = t.planned_start_date ? new Date(t.planned_start_date) : new Date(projectStart);
          calculatedEnd = new Date(calculatedStart);
          calculatedEnd.setDate(calculatedStart.getDate() + (dur - 1));
      }

      // Write-back computed dates
      t.planned_start_date = calculatedStart.toISOString().split('T')[0];
      t.planned_end_date = calculatedEnd.toISOString().split('T')[0];

      visiting.delete(taskId);
      visited.add(taskId);
    }

    // Pass 1: Solve Forward Pass Dates for all tasks
    tasks.forEach(t => solveDates(t.id));

    // Pass 2: Backward Pass CPM to find Critical Path
    const solvedTasks = Array.from(taskMap.values());
    
    // Find absolute overall project start and minimum finish among terminal nodes
    let earliestStartUnix = Infinity;
    let latestEndUnix = -Infinity;
    solvedTasks.forEach(t => {
      if (t.planned_start_date) {
        const u = new Date(t.planned_start_date).getTime();
        if (u < earliestStartUnix) earliestStartUnix = u;
      }
      if (t.planned_end_date) {
        const u = new Date(t.planned_end_date).getTime();
        if (u > latestEndUnix) latestEndUnix = u;
      }
    });

    if (earliestStartUnix === Infinity) earliestStartUnix = new Date(projectStart).getTime();
    const resolvedProjectStart = new Date(earliestStartUnix).toISOString().split('T')[0];
    const T_max = latestEndUnix !== -Infinity 
      ? getDaysBetween(resolvedProjectStart, new Date(latestEndUnix).toISOString().split('T')[0])
      : 0;

    // Initialize LF mapping to T_max
    const LF = new Map<string, number>();
    solvedTasks.forEach(t => {
      const ef = getDaysBetween(resolvedProjectStart, t.planned_end_date || resolvedProjectStart);
      LF.set(t.id, Math.max(ef, T_max));
    });

    // Constraint relaxation iteration
    for (let iter = 0; iter < solvedTasks.length + 5; iter++) {
      let changed = false;
      mergedDependencies.forEach(dep => {
        const succId = dep.task_id;
        const predId = dep.predecessor_id;
        const pred = taskMap.get(predId);
        const succ = taskMap.get(succId);
        if (!pred || !succ) return;

        const succLF = LF.get(succId) ?? T_max;
        const succDur = getDurationDays(succ.planned_start_date, succ.planned_end_date);
        const succLS = succLF - succDur + 1;

        const predDur = getDurationDays(pred.planned_start_date, pred.planned_end_date);
        const lag = dep.lag_days || 0;

        let maxPredLF = LF.get(predId) ?? T_max;

        switch (dep.link_type) {
          case 'FS':
            maxPredLF = Math.min(maxPredLF, succLS - 1 - lag);
            break;
          case 'SS':
            maxPredLF = Math.min(maxPredLF, succLS - lag + predDur - 1);
            break;
          case 'FF':
            maxPredLF = Math.min(maxPredLF, succLF - lag);
            break;
          case 'SF':
            maxPredLF = Math.min(maxPredLF, succLF - lag + predDur - 1);
            break;
        }

        if (maxPredLF !== LF.get(predId)) {
          LF.set(predId, maxPredLF);
          changed = true;
        }
      });
      if (!changed) break;
    }

    // Critical Path tasks have slack <= 0
    const critIds = new Set<string>();
    solvedTasks.forEach(t => {
      const ef = getDaysBetween(resolvedProjectStart, t.planned_end_date || resolvedProjectStart);
      const lf = LF.get(t.id) ?? T_max;
      const slack = lf - ef;
      if (slack <= 1) { // 1 day tolerance for date roundings
        critIds.add(t.id);
      }
    });

    return { calculatedTasks: solvedTasks, criticalTaskIds: critIds };
  }, [tasks, mergedDependencies, pendingChanges, project.start_date]);

  // Synchronize modal predecessor state whenever editingTask changes
  useEffect(() => {
    if (editingTask && editingTask.id) {
      const isAuto = typeof editingTask.id === 'string' && editingTask.id.startsWith('auto_');
      const targetId = isAuto 
        ? editingTask.id.replace(/^auto_(proc|del|man|ms|pay)_/, '')
        : editingTask.id;

      const dep = dependencies.find(d => d.task_id === targetId);
      if (dep) {
        setModalPredecessorId(dep.predecessor_id || '');
        setModalLinkType(dep.link_type || 'FS');
        setModalLagDays(dep.lag_days || 0);
      } else {
        setModalPredecessorId('');
        setModalLinkType('FS');
        setModalLagDays(0);
      }
    } else {
      setModalPredecessorId('');
      setModalLinkType('FS');
      setModalLagDays(0);
    }
  }, [editingTask, dependencies]);

  // Combines date-scope and schedule-type filters
  const filteredTasks = useMemo(() => {
    if (calculatedTasks.length === 0) return [];

    // Separate user custom inserted items from standard plan tasks
    const customInsertedItems = calculatedTasks.filter(t => 
      t.trade_code && typeof t.trade_code === 'string' && t.trade_code.startsWith('custom_')
    );
    
    const baseConstructionTasks = calculatedTasks.filter(t => 
      !(t.trade_code && typeof t.trade_code === 'string' && t.trade_code.startsWith('custom_')) &&
      !(scheduleType === 'crushed' && (t.item_no || '').split('.').length > 2)
    );

    let result: BOQItem[] = [];

    if (scheduleType === 'detailed' || scheduleType === 'crushed') {
      result = baseConstructionTasks;
    } 
    else if (scheduleType === 'procurement') {
      // 1. Auto-generate Procurement Tasks from active construction plan
      const autoProcurements = baseConstructionTasks
        .filter(t => t.planned_start_date)
        .map(t => {
          const procStart = getProcurementStartDate(t.planned_start_date, t.id);
          const matLabel = t.trade_name ? `${t.trade_name} Materials` : 'Construction Materials';
          return {
            ...t,
            id: `auto_proc_${t.id}`,
            original_task_id: t.id,
            description: `Procure ${matLabel} (for ${t.description})`,
            planned_start_date: procStart,
            planned_end_date: t.planned_start_date,
            trade_code: 'auto_procurement',
          } as BOQItem;
        });

      // 2. Mix in user explicitly added custom procurement items
      const customProcurements = customInsertedItems.filter(t => t.trade_code === 'custom_procurement');
      result = [...autoProcurements, ...customProcurements];
    } 
    else if (scheduleType === 'delivery') {
      // 1. Auto-generate Deliveries from construction plan
      const autoDeliveries = baseConstructionTasks
        .filter(t => t.planned_start_date)
        .map(t => {
          const delDate = getDeliveryReceiptDate(t.planned_start_date, t.id);
          const matLabel = t.trade_name ? `${t.trade_name} Shipment` : 'Material Shipment';
          return {
            ...t,
            id: `auto_del_${t.id}`,
            original_task_id: t.id,
            description: `On-site Arrival: ${matLabel} (for ${t.description})`,
            planned_start_date: delDate,
            planned_end_date: t.planned_start_date,
            trade_code: 'auto_delivery',
          } as BOQItem;
        });

      const customDeliveries = customInsertedItems.filter(t => t.trade_code === 'custom_delivery');
      result = [...autoDeliveries, ...customDeliveries];
    } 
    else if (scheduleType === 'manpower') {
      // 1. Auto-generate Subcontractor Mobilizations
      const autoManpower = baseConstructionTasks
        .filter(t => t.planned_start_date)
        .map(t => {
          const mobDate = getSubcontractorMobilizationDate(t.planned_start_date, t.id);
          const tradeLabel = t.trade_name ? `${t.trade_name} Subcontractor` : 'Specialist Crew';
          return {
            ...t,
            id: `auto_man_${t.id}`,
            original_task_id: t.id,
            description: `Mobilize ${tradeLabel} (for ${t.description})`,
            planned_start_date: mobDate,
            planned_end_date: t.planned_start_date,
            trade_code: 'auto_manpower',
          } as BOQItem;
        });

      const customManpowers = customInsertedItems.filter(t => t.trade_code === 'custom_manpower');
      result = [...autoManpower, ...customManpowers];
    } 
    else if (scheduleType === 'milestone') {
      // 1. Auto-generate Milestones
      const autoMilestones = baseConstructionTasks
        .filter(t => t.planned_end_date)
        .map(t => {
          return {
            ...t,
            id: `auto_ms_${t.id}`,
            original_task_id: t.id,
            description: `Milestone Gate: Completion of ${t.description}`,
            planned_start_date: t.planned_end_date,
            planned_end_date: t.planned_end_date,
            trade_code: 'auto_milestone',
          } as BOQItem;
        });

      const customMilestones = customInsertedItems.filter(t => t.trade_code === 'custom_milestone');
      result = [...autoMilestones, ...customMilestones];
    } 
    else if (scheduleType === 'payment') {
      // 1. Auto-generate Claims map
      const autoPayments = baseConstructionTasks
        .filter(t => t.planned_end_date)
        .map(t => {
          return {
            ...t,
            id: `auto_pay_${t.id}`,
            original_task_id: t.id,
            description: `Interim Claim Settlement for: ${t.description}`,
            planned_start_date: t.planned_end_date,
            planned_end_date: t.planned_end_date,
            trade_code: 'auto_payment',
          } as BOQItem;
        });

      const customPayments = customInsertedItems.filter(t => t.trade_code === 'custom_payment');
      result = [...autoPayments, ...customPayments];
    }

    // 2. FILTER BY TIME SCOPE
    if (scheduleScope !== 'start-to-finish' && scopeRange.start && scopeRange.end) {
      result = result.filter(t => {
        if (!t.planned_start_date || !t.planned_end_date) return false;
        return (t.planned_start_date <= scopeRange.end) && (t.planned_end_date >= scopeRange.start);
      });
    }

    return result;
  }, [calculatedTasks, scheduleType, scheduleScope, scopeRange, siteAccessibility, currentSeason, materialLeadTime, manpowerLeadTime, companyDesireAdjust, taskOverrides, getProcurementStartDate, getDeliveryReceiptDate, getSubcontractorMobilizationDate]);

  // Helper to parse hierarchy - derived from filteredTasks
  const taskTree = useMemo(() => {
    const tree: Record<string, TaskTreeNode> = {};
    const rootNodes: TaskTreeNode[] = [];

    // Sort tasks by item_no naturally if possible
    const sortedTasks = [...filteredTasks].sort((a, b) => {
      const aNo = a.item_no || '';
      const bNo = b.item_no || '';
      return aNo.localeCompare(bNo, undefined, { numeric: true, sensitivity: 'base' });
    });

    sortedTasks.forEach(task => {
      const parts = (task.item_no || '0').split('.');
      let currentPath = '';
      let parent: TaskTreeNode | null = null;

      parts.forEach((part, idx) => {
        currentPath = currentPath ? `${currentPath}.${part}` : part;
        if (!tree[currentPath]) {
          tree[currentPath] = {
            item: idx === parts.length - 1 ? task : null,
            item_no: currentPath,
            children: [],
            earliest: null,
            latest: null,
            depth: idx
          };
          if (parent) {
            parent.children.push(tree[currentPath]);
          } else {
            rootNodes.push(tree[currentPath]);
          }
        } else if (idx === parts.length - 1) {
          // If we encounter the actual task node that was previously a virtual parent
          tree[currentPath].item = task;
        }
        parent = tree[currentPath];
      });
    });

    // Post-process to calculate dates and rollup values
    const computeDates = (node: TaskTreeNode) => {
      const task = node.item;
      const updates = task ? (pendingChanges[task.id] || {}) : {};
      
      let earliest: string | null = null;
      let latest: string | null = null;

      // If this is a leaf node, use its own dates
      if (node.children.length === 0 && task) {
        earliest = (updates.planned_start_date !== undefined ? updates.planned_start_date : task?.planned_start_date) || null;
        latest = (updates.planned_end_date !== undefined ? updates.planned_end_date : task?.planned_end_date) || null;
      }

      node.children.forEach(child => {
        computeDates(child);
        if (child.earliest) {
          if (!earliest || child.earliest < earliest) earliest = child.earliest;
        }
        if (child.latest) {
          if (!latest || child.latest > latest) latest = child.latest;
        }
      });

      node.earliest = earliest;
      node.latest = latest;
    };

    rootNodes.forEach(computeDates);
    return rootNodes;
  }, [filteredTasks, pendingChanges]);

  const getPredecessorsString = useCallback((taskId: string) => {
    return mergedDependencies
      .filter(d => d.task_id === taskId)
      .map(d => {
        const pred = calculatedTasks.find(t => t.id === d.predecessor_id);
        if (!pred) return '';
        const typeStr = d.link_type !== 'FS' ? d.link_type : '';
        const lagStr = d.lag_days !== 0 ? (d.lag_days > 0 ? `+${d.lag_days}` : d.lag_days) : '';
        return `${pred.item_no || ''}${typeStr}${lagStr}`;
      })
      .filter(Boolean)
      .join(', ');
  }, [mergedDependencies, calculatedTasks]);

  const handleDurationChange = (taskId: string, durationStr: string) => {
    const duration = parseInt(durationStr);
    if (isNaN(duration) || duration < 0) return;
    
    const computedTask = calculatedTasks.find(t => t.id === taskId);
    const startDateVal = computedTask?.planned_start_date;
    if (!startDateVal) return;
    
    const start = new Date(startDateVal);
    const end = new Date(start);
    end.setDate(start.getDate() + (duration - 1));
    
    handleBulkFieldChange(taskId, 'planned_end_date', end.toISOString().split('T')[0]);
  };

  const getTaskPredecessor = (taskId: string) => {
    if (pendingDepChanges[taskId] !== undefined) {
      return pendingDepChanges[taskId];
    }
    const d = dependencies.find(dep => dep.task_id === taskId);
    if (!d) return null;
    return {
      predecessor_id: d.predecessor_id,
      link_type: d.link_type,
      lag_days: d.lag_days
    };
  };

  const handlePendingPredecessorChange = (taskId: string, field: 'predecessor_id' | 'link_type' | 'lag_days', value: any) => {
    const current = getTaskPredecessor(taskId) || { predecessor_id: '', link_type: 'FS', lag_days: 0 };
    const updated = { ...current, [field]: value };
    
    if (!updated.predecessor_id) {
      setPendingDepChanges(prev => ({
        ...prev,
        [taskId]: null
      }));
    } else {
      setPendingDepChanges(prev => ({
        ...prev,
        [taskId]: {
          predecessor_id: updated.predecessor_id,
          link_type: updated.link_type as any,
          lag_days: Number(updated.lag_days) || 0
        }
      }));
    }
  };

  const toggleBulkEdit = () => {
    if (isBulkEditMode) {
      if (Object.keys(pendingChanges).length > 0 || Object.keys(pendingDepChanges).length > 0) {
        if (!window.confirm('You have unsaved changes. Discard them?')) return;
      }
      setPendingChanges({});
      setPendingDepChanges({});
    }
    setIsBulkEditMode(!isBulkEditMode);
  };

  const handleBulkFieldChange = (taskId: string, field: keyof BOQItem, value: any) => {
    setPendingChanges(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        [field]: value
      }
    }));
  };

  const saveBulkChanges = async () => {
    setIsMassEditLoading(true);
    try {
      // 1. Save pending predecessor modifications
      const depEntries = Object.entries(pendingDepChanges);
      for (const [taskId, value] of depEntries) {
        if (value === null) {
          await supabase.from('task_dependencies').delete().eq('task_id', taskId);
        } else {
          const existing = dependencies.find(d => d.task_id === taskId);
          if (existing) {
            await supabase.from('task_dependencies').update({
              predecessor_id: value.predecessor_id,
              link_type: value.link_type,
              lag_days: value.lag_days,
            }).eq('id', existing.id);
          } else {
            await supabase.from('task_dependencies').insert({
              project_id: project.id,
              tenant_id: project.tenant_id || tasks[0]?.tenant_id || '',
              task_id: taskId,
              predecessor_id: value.predecessor_id,
              link_type: value.link_type,
              lag_days: value.lag_days,
            });
          }
        }
      }

      // 2. Discover and update all task changes + CPM propagated dates
      const tasksToUpdate: Record<string, any> = {};
      
      // Manual edits
      Object.entries(pendingChanges).forEach(([id, updates]) => {
        tasksToUpdate[id] = { ...updates };
      });

      // Synchronize propagated CPM start & end dates
      calculatedTasks.forEach(t => {
        const original = tasks.find(ot => ot.id === t.id);
        if (original) {
          if (original.planned_start_date !== t.planned_start_date || original.planned_end_date !== t.planned_end_date) {
            tasksToUpdate[t.id] = {
              ...(tasksToUpdate[t.id] || {}),
              planned_start_date: t.planned_start_date,
              planned_end_date: t.planned_end_date
            };
          }
        }
      });

      // Commit update entries to Supabase
      const updateEntries = Object.entries(tasksToUpdate);
      for (const [id, updates] of updateEntries) {
        if (Object.keys(updates).length > 0) {
          await supabase.from('boq_items').update(updates).eq('id', id);
        }
      }

      alert(`Successfully saved ${updateEntries.length} updated tasks and relationships.`);
      setPendingChanges({});
      setPendingDepChanges({});
      setIsBulkEditMode(false);
      loadData();
    } catch (e: any) {
      alert('Error saving bulk changes: ' + e.message);
    } finally {
      setIsMassEditLoading(false);
    }
  };

  // Handle Mass Select Toggle
  const toggleSelect = (id: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedTaskIds.size === tasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(tasks.map(t => t.id)));
    }
  };

  const toggleGroup = (billNo: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(billNo)) next.delete(billNo);
      else next.add(billNo);
      return next;
    });
  };

  const handleMassUpdate = async (updates: Partial<BOQItem>) => {
    if (selectedTaskIds.size === 0) return;
    setIsMassEditLoading(true);
    try {
      const ids = Array.from(selectedTaskIds);
      const { error } = await supabase
        .from('boq_items')
        .update(updates)
        .in('id', ids);

      if (error) throw error;
      alert(`Updated ${ids.length} tasks successfully.`);
      loadData();
      setSelectedTaskIds(new Set());
    } catch (e: any) {
      alert('Error mass updating: ' + e.message);
    } finally {
      setIsMassEditLoading(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    const element = document.getElementById('schedule-content');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f8fafc'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${project.name}_Schedule_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Primary source for schedule is now boq_items (confirmed items)
      const { data: boqItems, error: boqError } = await supabase
        .from('boq_items')
        .select('*')
        .eq('project_id', project.id)
        .order('item_sequence', { ascending: true });

      if (boqError) throw boqError;

      // Fetch dependencies
      const { data: deps, error: depsError } = await supabase
        .from('task_dependencies')
        .select('*')
        .eq('project_id', project.id);

      if (depsError) throw depsError;

      // Fetch subcontractor assignments
      try {
        const { data: subsData } = await supabase
          .from('subcontractor_assignments')
          .select('*, subcontractor:subcontractor_id(company_name)')
          .eq('project_id', project.id);
        setSubAssignments(subsData || []);
      } catch (e) {
        console.warn('Could not load subcontractor assignments:', e);
      }

      // Fetch purchase orders
      try {
        const { data: posData } = await supabase
          .from('purchase_orders')
          .select('*, supplier:supplier_id(company_name)')
          .eq('project_id', project.id);
        setPurchaseOrders(posData || []);
      } catch (e) {
        console.warn('Could not load purchase orders:', e);
      }

      // Fetch payment certificates
      try {
        const { data: certsData } = await supabase
          .from('payment_certificates')
          .select('*')
          .eq('project_id', project.id);
        setPaymentCertificates(certsData || []);
      } catch (e) {
        console.warn('Could not load payment certificates:', e);
      }

      // Milestones from bills
      const billNames = Array.from(new Set((boqItems || []).map(i => i.bill_name || i.bill_no || 'Standard Section')));
      const transformedMilestones: ScheduleMilestone[] = billNames.map((name, i) => ({
        id: `milestone-${i}`,
        name,
        target_date: project.end_date,
        status: 'pending'
      }));

      setTasks(boqItems || []);
      setDependencies(deps || []);
      setMilestones(transformedMilestones);

      // Fetch resources
      try {
        const itemIds = (boqItems || []).map(i => i.id);
        if (itemIds.length > 0) {
          const { data: resData, error: resError } = await supabase
            .from('boq_item_resources')
            .select('boq_item_id, resource_name, is_excluded')
            .in('boq_item_id', itemIds);
          if (!resError && resData) {
            const mapping: Record<string, string[]> = {};
            resData.forEach(r => {
              if (r.is_excluded) return;
              if (!mapping[r.boq_item_id]) {
                mapping[r.boq_item_id] = [];
              }
              if (r.resource_name && !mapping[r.boq_item_id].includes(r.resource_name)) {
                mapping[r.boq_item_id].push(r.resource_name);
              }
            });
            setTaskResources(mapping);
          } else {
            setTaskResources({});
          }
        } else {
          setTaskResources({});
        }
      } catch (e) {
        console.warn('Could not load task resources:', e);
        setTaskResources({});
      }
    } catch (e: any) {
      console.error('Error loading schedule:', e.message);
      setError(e.message || 'Failed to fetch schedule data');
    } finally {
      setLoading(false);
    }
  }, [project.id, project.start_date, project.end_date]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-expand all groups on initial load of tasks to ensure user can see the details of schedule
  useEffect(() => {
    if (tasks && tasks.length > 0) {
      const groups = new Set<string>();
      tasks.forEach(t => {
        const parts = (t.item_no || '').split('.');
        if (parts.length > 1) {
          let path = '';
          for (let i = 0; i < parts.length - 1; i++) {
            path = path ? `${path}.${parts[i]}` : parts[i];
            groups.add(path);
          }
        }
      });
      setExpandedGroups(groups);
    }
  }, [tasks]);

  const generateFromBOQ = async () => {
    setIsSyncing(true);
    try {
      // 1. Fetch confirmed BOQ items that don't have dates yet
      let { data: boqItems, error: boqError } = await supabase
        .from('boq_items')
        .select('*')
        .eq('project_id', project.id)
        .or('status.eq.confirmed,recipe_confirmed.eq.true');

      if (boqError) throw boqError;
      
      if (!boqItems || boqItems.length === 0) {
        // Fallback: Fetch all BOQ items for this project
        const { data: allBoqItems, error: allBoqError } = await supabase
          .from('boq_items')
          .select('*')
          .eq('project_id', project.id);
          
        if (allBoqError) throw allBoqError;
        if (!allBoqItems || allBoqItems.length === 0) {
          alert('No items found in BOQ. Please import or add items in BOQ Management first.');
          return;
        }
        boqItems = allBoqItems;
      }

      // Update items with project dates as fallback
      const updates = boqItems.map(item => ({
        id: item.id,
        planned_start_date: item.planned_start_date || project.start_date || new Date().toISOString().split('T')[0],
        planned_end_date: item.planned_end_date || project.end_date || new Date().toISOString().split('T')[0]
      }));

      // Supabase perfect update matching IDs
      for (const update of updates) {
          await supabase.from('boq_items').update({
              planned_start_date: update.planned_start_date,
              planned_end_date: update.planned_end_date
          }).eq('id', update.id);
      }

      alert('Schedule dates initialized from BOQ items!');
      loadData();
    } catch (e: any) {
      alert('Error generating schedule: ' + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAIScheduleGenerate = async () => {
    if (tasks.length === 0) {
      alert('No confirmed items found to schedule.');
      return;
    }

    if (!window.confirm('This will use AI to suggest a timeline and dependencies for your project. Current task dates will be overwritten. Continue?')) {
      return;
    }

    setIsAIProcessing(true);
    try {
      const result = await generateAISchedule(
        { 
          name: project.name, 
          start_date: project.start_date || new Date().toISOString().split('T')[0], 
          end_date: project.end_date || new Date().toISOString().split('T')[0] 
        },
        tasks
      );

      // 1. Update tasks with dates
      const taskUpdates = result.tasks.map(t => ({
        id: t.id,
        planned_start_date: t.start_date,
        planned_end_date: t.end_date
      }));

      for (const update of taskUpdates) {
        await supabase.from('boq_items').update(update).eq('id', update.id);
      }

      // 2. Insert dependencies
      // First clear old ones for this project
      await supabase.from('task_dependencies').delete().eq('project_id', project.id);

      const validTaskIds = new Set(tasks.map(t => t.id));
      const tenantId = tasks[0]?.tenant_id;

      if (!tenantId) {
        throw new Error("Unable to determine tenant association for dependencies.");
      }

      const depInserts = result.dependencies
        .filter(d => validTaskIds.has(d.task_id) && validTaskIds.has(d.predecessor_id))
        .map(d => ({
          project_id: project.id,
          tenant_id: tenantId,
          task_id: d.task_id,
          predecessor_id: d.predecessor_id,
          link_type: ['FS', 'SS', 'FF', 'SF'].includes(d.link_type) ? d.link_type : 'FS',
          lag_days: typeof d.lag_days === 'number' ? d.lag_days : 0
        }));

      if (depInserts.length > 0) {
        const { error: depError } = await supabase.from('task_dependencies').insert(depInserts);
        if (depError) throw depError;
      }

      alert('AI Schedule generated successfully!');
      loadData();
    } catch (e: any) {
      console.error('AI Schedule Error:', e);
      alert('Error generating AI schedule: ' + e.message);
    } finally {
      setIsAIProcessing(false);
    }
  };

  useEffect(() => {
    const isAuto = editingTask?.id && typeof editingTask.id === 'string' && editingTask.id.startsWith('auto_');
    const targetId = isAuto 
      ? editingTask.id.replace(/^auto_(proc|del|man|ms|pay)_/, '')
      : editingTask?.id;

    if (targetId) {
      const override = taskOverrides[targetId] || {};
      setCustomLead(override.customLeadDays);
      setCustomAccess(override.customAccessibility || 'default');
      setCustomSeasonOverride(override.customSeason || 'default');

      const existingDep = dependencies.find(d => d.task_id === targetId);
      if (existingDep) {
        setModalPredecessorId(existingDep.predecessor_id || '');
        setModalLinkType((existingDep.link_type as any) || 'FS');
        setModalLagDays(existingDep.lag_days || 0);
      } else {
        setModalPredecessorId('');
        setModalLinkType('FS');
        setModalLagDays(0);
      }
    } else {
      setCustomLead(undefined);
      setCustomAccess('default');
      setCustomSeasonOverride('default');
      setModalPredecessorId('');
      setModalLinkType('FS');
      setModalLagDays(0);
    }
  }, [editingTask, taskOverrides, dependencies]);

  const handleSaveTask = async () => {
    if (!editingTask) return;

    try {
      if (!editingTask.id) {
        // 1. ADD NEW CUSTOM TASK
        let tradeCode = 'custom';
        if (scheduleType === 'procurement') tradeCode = 'custom_procurement';
        else if (scheduleType === 'delivery') tradeCode = 'custom_delivery';
        else if (scheduleType === 'manpower') tradeCode = 'custom_manpower';
        else if (scheduleType === 'milestone') tradeCode = 'custom_milestone';
        else if (scheduleType === 'payment') tradeCode = 'custom_payment';

        // Calculate item_no to sit beautifully under "99 Custom Elements"
        const nextCustomIdx = tasks.filter(t => t.item_no && t.item_no.startsWith('99.')).length + 1;
        const assignedItemNo = `99.${nextCustomIdx}`;

        const { data, error } = await supabase
          .from('boq_items')
          .insert([{
            project_id: project.id,
            tenant_id: project.tenant_id || '',
            description: editingTask.description || 'Unspecified Item',
            planned_start_date: editingTask.planned_start_date || new Date().toISOString().split('T')[0],
            planned_end_date: editingTask.planned_end_date || new Date().toISOString().split('T')[0],
            status: editingTask.status || 'recipe_pending',
            progress_pct: editingTask.progress_pct || 0,
            recipe_confirmed: true,
            trade_code: tradeCode,
            bill_no: 'Custom',
            item_no: assignedItemNo,
            item_sequence: 1000 + tasks.length,
            contract_qty: 1,
            contract_rate: 0,
            contract_amount: 0,
          }])
          .select('id')
          .single();

        if (error) throw error;

        // Save predecessor dependency for new task
        if (data?.id && modalPredecessorId) {
          const { error: depError } = await supabase
            .from('task_dependencies')
            .insert([{
              project_id: project.id,
              tenant_id: project.tenant_id || tasks[0]?.tenant_id || '',
              task_id: data.id,
              predecessor_id: modalPredecessorId,
              link_type: modalLinkType,
              lag_days: modalLagDays
            }]);
          if (depError) throw depError;
        }
      } else {
        // 2. UPDATE EXISTING TASK (BASE OR CUSTOM)
        const isAuto = typeof editingTask.id === 'string' && editingTask.id.startsWith('auto_');
        const targetId = isAuto 
          ? editingTask.id.replace(/^auto_(proc|del|man|ms|pay)_/, '')
          : editingTask.id;

        if (!isAuto) {
          const { error } = await supabase
            .from('boq_items')
            .update({
              planned_start_date: editingTask.planned_start_date,
              planned_end_date: editingTask.planned_end_date,
              progress_pct: editingTask.progress_pct,
              status: editingTask.status,
              description: editingTask.description
            })
            .eq('id', targetId);

          if (error) throw error;
        } else {
          // Keep base description, but allow shifting dates on auto-generated cards!
          // Note that for procurement/delivery/manpower, planned_end_date of the auto task equals the start date of the base task.
          const isProcDelMan = editingTask.trade_code?.includes('procurement') || 
                               editingTask.trade_code?.includes('delivery') || 
                               editingTask.trade_code?.includes('manpower');

          const updateFields: any = {
            progress_pct: editingTask.progress_pct,
            status: editingTask.status
          };

          if (isProcDelMan) {
            updateFields.planned_start_date = editingTask.planned_end_date;
          } else {
            updateFields.planned_end_date = editingTask.planned_end_date;
          }

          const { error } = await supabase
            .from('boq_items')
            .update(updateFields)
            .eq('id', targetId);

          if (error) throw error;
        }

        // Save consolidated predecessor dependency for existing task
        if (targetId) {
          // First clear any existing dependencies for this task to satisfy 'only one item per dependency' rule
          await supabase
            .from('task_dependencies')
            .delete()
            .eq('task_id', targetId);

          if (modalPredecessorId) {
            // Then insert the updated single dependency if set
            const { error: depError } = await supabase
              .from('task_dependencies')
              .insert([{
                project_id: project.id,
                tenant_id: project.tenant_id || tasks[0]?.tenant_id || '',
                task_id: targetId,
                predecessor_id: modalPredecessorId,
                link_type: modalLinkType,
                lag_days: modalLagDays
              }]);
            if (depError) throw depError;
          }
        }

        // Persist the automated company customization/desires overrides per-task
        const updatedOverrides = { ...taskOverrides };
        if (customLead !== undefined || customAccess !== 'default' || customSeasonOverride !== 'default') {
          updatedOverrides[targetId] = {
            customLeadDays: customLead,
            customAccessibility: customAccess === 'default' ? undefined : customAccess,
            customSeason: customSeasonOverride === 'default' ? undefined : customSeasonOverride,
          };
        } else {
          delete updatedOverrides[targetId];
        }
        setTaskOverrides(updatedOverrides);
        localStorage.setItem(`schedule_overrides_${project.id}`, JSON.stringify(updatedOverrides));
      }

      setIsModalOpen(false);
      setEditingTask(null);
      loadData();
    } catch (e: any) {
      alert('Error saving task: ' + e.message);
    }
  };

  const handleAddDependency = async () => {
    if (!editingTask?.id || !newDep.predecessor_id) return;
    
    try {
      const isAuto = typeof editingTask.id === 'string' && editingTask.id.startsWith('auto_');
      const targetId = isAuto 
        ? editingTask.id.replace(/^auto_(proc|del|man|ms|pay)_/, '')
        : editingTask.id;

      const { error } = await supabase
        .from('task_dependencies')
        .insert([{
          project_id: project.id,
          tenant_id: tasks[0]?.tenant_id || '',
          task_id: targetId,
          predecessor_id: newDep.predecessor_id,
          link_type: newDep.link_type,
          lag_days: newDep.lag_days
        }]);

      if (error) throw error;
      setNewDep({ predecessor_id: '', link_type: 'FS', lag_days: 0 });
      loadData();
    } catch (e: any) {
      alert('Error adding dependency: ' + e.message);
    }
  };

  const handleDeleteDependency = async (depId: string) => {
    try {
      const { error } = await supabase
        .from('task_dependencies')
        .delete()
        .eq('id', depId);

      if (error) throw error;
      loadData();
    } catch (e: any) {
      alert('Error deleting dependency: ' + e.message);
    }
  };

  const deleteTask = async (id: string) => {
    const isAuto = id && typeof id === 'string' && id.startsWith('auto_');
    const targetId = isAuto ? id.replace(/^auto_(proc|del|man|ms|pay)_/, '') : id;

    const message = isAuto 
      ? 'Are you sure you want to clear dates for the original construction task corresponding to this automatic item?'
      : 'Are you sure you want to delete this custom task?';

    if (!window.confirm(message)) return;

    try {
      if (isAuto || !id.startsWith('custom')) {
        const { error } = await supabase
          .from('boq_items')
          .update({
            planned_start_date: null,
            planned_end_date: null
          })
          .eq('id', targetId);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('boq_items')
          .delete()
          .eq('id', targetId);

        if (error) throw error;
      }
      loadData();
    } catch (e: any) {
      alert('Error clearing/deleting task: ' + e.message);
    }
  };

  // Precalculate visible nodes to render precise dependency connecting lines across the list
  const listVisibleNodes = useMemo(() => {
    const visibleNodes: TaskTreeNode[] = [];
    const collectVisible = (n: TaskTreeNode) => {
      visibleNodes.push(n);
      if (expandedGroups.has(n.item_no)) {
        n.children.forEach(collectVisible);
      }
    };
    taskTree.forEach(collectVisible);
    return visibleNodes;
  }, [taskTree, expandedGroups]);

  // Solve the total left horizontal spacing to start aligning connections
  const totalLeftWidthToTimeline = useMemo(() => {
    return 40 + colWidths.item_no + colWidths.description + colWidths.actions +
      (visibleCols.start_date ? colWidths.start_date : 0) +
      (visibleCols.no_days ? colWidths.no_days : 0) +
      (visibleCols.end_date ? colWidths.end_date : 0) +
      (visibleCols.predecessors ? colWidths.predecessors : 0) +
      (visibleCols.progress ? colWidths.progress : 0) +
      (visibleCols.contract_qty ? colWidths.contract_qty : 0) +
      (visibleCols.surveyed_qty ? colWidths.surveyed_qty : 0) +
      (visibleCols.actual_qty ? colWidths.actual_qty : 0) +
      (visibleCols.amount ? colWidths.amount : 0) +
      (visibleCols.trade_name ? colWidths.trade_name : 0) +
      (visibleCols.resources ? colWidths.resources : 0);
  }, [colWidths, visibleCols]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 max-w-sm mx-auto text-center px-4">
        <AlertCircle className="w-12 h-12 text-danger animate-pulse" />
        <h3 className="text-sm font-black text-main mt-2 uppercase tracking-wider">Failed to Load Schedule</h3>
        <p className="text-xs text-ghost leading-relaxed">
          The operation system could not fetch the scheduling data. This is typically due to temporary network disruption or a pause on your database connection.
        </p>
        <div className="w-full p-3 rounded-xl bg-surface-2 border border-border-subtle/50 font-mono text-[10px] text-danger mt-1 break-all text-left">
          Error: {error}
        </div>
        <button 
          onClick={() => {
            setError(null);
            loadData();
          }}
          className="btn btn-primary h-10 px-6 mt-4 flex items-center gap-2"
        >
          <span>Retry Loading</span>
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm text-dim">Loading schedule...</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col transition-all duration-300",
      isFullscreen ? "fixed top-0 bottom-0 right-0 left-0 lg:left-16 z-[100] bg-surface-base p-6 overflow-hidden" : "gap-4"
    )}>
      {!isFullscreen && (
        <header className={cn(
          "flex flex-col md:flex-row md:items-start justify-between gap-6 px-1 transition-all relative",
          isFullscreen ? "mb-4" : "mb-8"
        )}>
          <div className="flex flex-col gap-0.5 md:mt-auto">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-black text-ghost uppercase tracking-[0.3em]">Project Schedule</span>
            </div>
            <h1 className="text-[19px] font-black tracking-tight text-main -ml-0.5">{project.name}</h1>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex items-center gap-2 text-[10px] font-bold text-ghost">
                <span className="text-primary font-black uppercase tracking-widest decoration-primary/30 underline-offset-4">Schedule Dashboard</span>
                <span className="w-1 h-1 rounded-full bg-border-subtle" />
                <span className="px-1.5 py-0.25 rounded bg-surface-2 border border-border-subtle opacity-80">
                  {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
                </span>
              </div>
              <div className="h-1 w-1 rounded-full bg-border-subtle" />
              <span className="text-[10px] font-bold text-dim uppercase tracking-wider">{project.status || 'Active'}</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-5 h-full">
            <div className="flex flex-col items-end min-w-[120px]">
              <span className="text-[8px] font-bold text-ghost uppercase tracking-[0.2em] mb-1 opacity-60">Reference ID</span>
              <div className="px-3 py-1.5 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center w-full">
                <span className="text-xs font-black text-primary tracking-widest">{project.project_code}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={handleExportPDF}
                disabled={exporting || tasks.length === 0}
                className="btn btn-secondary btn-sm h-9"
              >
                {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <FileDown className="w-4 h-4 mr-1" />}
                Export PDF
              </button>
              <button 
                onClick={handleAIScheduleGenerate}
                disabled={isAIProcessing || tasks.length === 0}
                className="ai-btn min-w-[130px] h-9"
              >
                {isAIProcessing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                )}
                {isAIProcessing ? 'Analyzing...' : 'AI Schedule'}
              </button>
              <button 
                onClick={() => {
                  setEditingTask({ progress_pct: 0 });
                  setIsModalOpen(true);
                }}
                className="btn btn-primary btn-sm h-9"
              >
                <Plus className="w-4 h-4 mr-1" />
                {scheduleType === 'detailed' || scheduleType === 'crushed' ? 'Add Task' :
                 scheduleType === 'procurement' ? 'Insert Procurement' :
                 scheduleType === 'delivery' ? 'Insert Delivery' :
                 scheduleType === 'manpower' ? 'Insert Manpower' :
                 scheduleType === 'milestone' ? 'Insert Milestone' :
                 scheduleType === 'payment' ? 'Insert Claim' : 'Add Item'}
              </button>
            </div>
          </div>
        </header>
      )}

      {tasks.length === 0 ? (
        <div className={cn(
          "bg-surface-1 border border-border-subtle rounded-xl overflow-hidden flex flex-col transition-all",
          isFullscreen ? "flex-1 min-h-0" : "min-h-[400px]"
        )}>
          <div className="flex-1 flex items-center justify-center text-ghost flex-col gap-4">
            <Clock className="w-12 h-12 opacity-10" />
            <div className="text-center">
              <div className="text-sm font-medium text-dim">No tasks found</div>
              <p className="text-xs mt-1 max-w-xs text-ghost">Start by adding individual tasks or auto-generate from confirmed BOQ items.</p>
            </div>
            <button 
              onClick={generateFromBOQ}
              disabled={isSyncing}
              className="btn btn-secondary"
            >
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
              Auto-Generate from BOQ
            </button>
          </div>
        </div>
      ) : (
        <div className={cn("flex flex-col gap-3", isFullscreen && "h-full flex-1")}>
          {/* Summary Row */}
          {!isFullscreen && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 animate-in fade-in slide-in-from-top-2">
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-3 shadow-sm hover:border-border transition-colors">
                <div className="text-[9px] font-black uppercase text-ghost tracking-wider">Active Tasks</div>
                <div className="text-xl font-black text-main mt-1 flex items-baseline gap-1.5">
                  <span>{filteredTasks.length}</span>
                  <span className="text-[10px] text-dim font-medium normal-case">of {tasks.length} total</span>
                </div>
              </div>
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-3 shadow-sm hover:border-border transition-colors">
                <div className="text-[9px] font-black uppercase text-ghost tracking-wider">Milestones</div>
                <div className="text-xl font-black text-main mt-1">
                  {scheduleType === 'milestone' ? filteredTasks.length : filteredTasks.filter(t => calculateDuration(t.planned_start_date, t.planned_end_date) <= 1).length}
                </div>
              </div>
              <div className="bg-surface-1 border border-border-subtle rounded-xl p-3 shadow-sm hover:border-border transition-colors">
                <div className="text-[9px] font-black uppercase text-ghost tracking-wider">In Progress</div>
                <div className="text-xl font-black text-accent mt-1">
                  {filteredTasks.filter(t => t.status === 'in_progress').length}
                </div>
              </div>
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 shadow-sm hover:border-primary/20 transition-colors">
                <div className="text-[9px] font-black uppercase text-primary tracking-wider">Completed</div>
                <div className="text-xl font-black text-primary mt-1">
                  {filteredTasks.filter(t => t.status === 'complete').length}
                </div>
              </div>
            </div>
          )}

          {/* Main Configure Schedule Trigger Card */}
          {!isFullscreen && (
            <div className="bg-surface-1 border border-border-subtle rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-ghost tracking-[0.2em] mb-1.5 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-primary" /> Active Configuration Parameters
                </span>
                <span className="text-xs font-bold text-dim flex flex-wrap items-center gap-2">
                  <span className="bg-accent/10 border border-accent/20 text-accent px-2 py-0.5 rounded-md text-[10px] font-black uppercase">
                    {scheduleType === 'detailed' ? 'Detailed Activities' : scheduleType === 'crushed' ? 'Crushed Summary' : scheduleType === 'procurement' ? 'Procurement Focus' : scheduleType === 'delivery' ? 'Material Deliveries' : scheduleType === 'manpower' ? 'Manpower Focus' : scheduleType === 'milestone' ? 'Milestones Only' : 'Payments & Claims'}
                  </span>
                  <span className="text-border-subtle">•</span>
                  <span className="bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-md text-[10px] font-black uppercase">
                    {scheduleScope === 'start-to-finish' ? 'Start to Finish Frame' : `${scheduleScope} Timeframe`}
                  </span>
                  <span className="text-border-subtle">•</span>
                  <span className="bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md text-[10px] font-black uppercase">
                    Combined Hybrid Matrix
                  </span>
                </span>
              </div>
              
              <button
                type="button"
                onClick={() => setIsLogisticsOpen(true)}
                className="btn btn-primary btn-sm h-10 px-6 text-[10px] font-black uppercase tracking-widest text-white shadow-md shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center gap-2 self-start sm:self-auto"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Configure Schedule
              </button>
            </div>
          )}

          {/* Scope and Logistics Overlay Window Modal */}
          {isLogisticsOpen && (
            <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
              <div className="bg-surface-1 border border-border-subtle rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="p-6 border-b border-border-subtle flex items-center justify-between bg-surface-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-accent/10 rounded-xl text-accent">
                      <SlidersHorizontal className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-main uppercase tracking-wider">
                        Configure Schedule Setup
                      </h3>
                      <p className="text-[11px] text-dim">
                        Setup active layout representation, view focus, calendar bounds, site mobility accessibility, and transit lead-times
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsLogisticsOpen(false)} 
                    className="p-1.5 hover:bg-surface-3 rounded-xl text-ghost hover:text-main transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto flex flex-col gap-6 bg-surface-base/30">
                  {/* LAYOUT VIEW MODE & FOCUS TYPE SECTION */}
                  <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 flex flex-col gap-5 shadow-sm">
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-ghost">
                        Select View Focus / Schedule Type
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                        {[
                          { id: 'detailed', label: 'Detailed Activities', icon: List, color: 'text-accent', activeBg: 'bg-accent/10 border-accent/40 text-accent shadow-accent/10' },
                          { id: 'crushed', label: 'Crushed Summary', icon: Layers, color: 'text-amber-500', activeBg: 'bg-amber-500/10 border-amber-500/40 text-amber-500 shadow-amber-500/10' },
                          { id: 'procurement', label: 'Procurement Focus', icon: ShoppingCart, color: 'text-amber-500', activeBg: 'bg-amber-600/10 border-amber-600/40 text-amber-600 shadow-amber-600/10' },
                          { id: 'delivery', label: 'Deliveries Tracker', icon: Truck, color: 'text-emerald-500', activeBg: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500 shadow-emerald-500/10' },
                          { id: 'manpower', label: 'Manpower & Subcons', icon: Users, color: 'text-indigo-500', activeBg: 'bg-indigo-500/10 border-indigo-500/40 text-indigo-500 shadow-indigo-500/10' },
                          { id: 'milestone', label: 'Key Milestones', icon: Target, color: 'text-rose-500', activeBg: 'bg-rose-500/10 border-rose-500/40 text-rose-500 shadow-rose-500/10' },
                          { id: 'payment', label: 'Payments & Claims', icon: DollarSign, color: 'text-yellow-500', activeBg: 'bg-yellow-500/10 border-yellow-500/40 text-yellow-500 shadow-yellow-500/10' }
                        ].map(type => (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => {
                              setScheduleType(type.id as any);
                            }}
                            className={cn(
                              "flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center gap-2",
                              scheduleType === type.id 
                                ? `${type.activeBg} border font-black shadow-md`
                                : "bg-surface-base border-border-subtle hover:border-border text-dim hover:text-main"
                            )}
                          >
                            <type.icon className={cn("w-5 h-5 transition-transform group-hover:scale-105", scheduleType === type.id ? "" : "text-ghost")} />
                            <span className="text-[10px] font-bold tracking-tight leading-tight select-none">
                              {type.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* TIMEFRAME & CALENDAR SCOPE */}
                    <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
                      <span className="text-[10px] font-black uppercase text-accent tracking-widest flex items-center gap-1.5 pb-2 border-b border-border-subtle/40">
                        <Clock className="w-4 h-4" /> Timeline Setup
                      </span>

                      {/* Scope Selection */}
                      <div className="flex flex-col gap-2 select-none relative" ref={scopeDropdownRef}>
                        <label className="text-[9px] font-black uppercase tracking-wider text-ghost flex items-center gap-1.5">
                          Timeline Scale (Unit Width)
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsScopeDropdownOpen(!isScopeDropdownOpen)}
                          className="flex items-center justify-between px-4 py-2.5 bg-surface-base border border-border-subtle hover:border-primary/50 rounded-xl text-xs font-bold text-main w-full shadow-sm transition-all text-left"
                        >
                          <span className="flex items-center gap-2">
                            {scheduleScope === 'start-to-finish' && <Maximize2 className="w-4 h-4 text-primary" />}
                            {['1-day', '2-days', '3-days', '4-days', '5-days', 'daily'].includes(scheduleScope) && <Clock className="w-4 h-4 text-primary" />}
                            {['1-week', 'weekly'].includes(scheduleScope) && <CalendarDays className="w-4 h-4 text-primary" />}
                            {['1-month', 'monthly'].includes(scheduleScope) && <Calendar className="w-4 h-4 text-primary" />}
                            {scheduleScope === 'quarterly' && <Layers className="w-4 h-4 text-primary" />}
                            {scheduleScope === 'yearly' && <Award className="w-4 h-4 text-primary" />}
                            {scheduleScope === 'custom' && <SlidersHorizontal className="w-4 h-4 text-primary" />}
                            <span className="capitalize leading-none text-xs font-bold">
                              {scheduleScope === 'start-to-finish' ? 'Full Span of Project' : `${String(scheduleScope).replace('-', ' ')} Unit Scale`}
                            </span>
                          </span>
                          <ChevronDown className={cn("w-4 h-4 text-ghost transition-transform duration-200", isScopeDropdownOpen && "rotate-180")} />
                        </button>

                        {isScopeDropdownOpen && (
                          <div className="absolute top-16 left-0 right-0 z-[300] bg-surface-1 border border-border bg-opacity-95 backdrop-blur-md rounded-xl shadow-xl overflow-hidden py-1 animate-in fade-in slide-in-from-top-1 max-h-72 overflow-y-auto">
                            {[
                              { id: 'start-to-finish', label: 'Full Span', desc: 'Full project start-to-finish lifecycle', icon: Maximize2 },
                              { id: '1-day', label: '1 Day Scale', desc: '1 Day per division view', icon: Clock },
                              { id: '2-days', label: '2 Days Scale', desc: '2 days per division view', icon: Clock },
                              { id: '3-days', label: '3 Days Scale', desc: '3 days per division view', icon: Clock },
                              { id: '4-days', label: '4 Days Scale', desc: '4 days per division view', icon: Clock },
                              { id: '5-days', label: '5 Days Scale', desc: '5 days per division view', icon: Clock },
                              { id: '1-week', label: '1 Week Scale', desc: '7 days per division view', icon: CalendarDays },
                              { id: '1-month', label: '1 Month Scale', desc: 'Monthly blocks of execution', icon: Calendar },
                              { id: 'custom', label: 'Custom Date Frame', desc: 'Set manual custom timeline bounds', icon: SlidersHorizontal }
                            ].map(scope => (
                              <button
                                key={scope.id}
                                type="button"
                                onClick={() => {
                                  setScheduleScope(scope.id as any);
                                  setRefDate(new Date());
                                  setIsScopeDropdownOpen(false);
                                }}
                                className={cn(
                                  "w-full px-4 py-2 text-left text-xs flex items-start gap-3 transition-colors hover:bg-surface-2",
                                  scheduleScope === scope.id ? "bg-primary/5 text-primary" : "text-main"
                                )}
                              >
                                <scope.icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", scheduleScope === scope.id ? "text-primary" : "text-ghost")} />
                                <div className="flex flex-col min-w-0">
                                  <span className="font-bold text-[11px] uppercase tracking-wider">{scope.label}</span>
                                  <span className="text-[9px] text-zinc-500">{scope.desc}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Custom timeframe inputs */}
                      {scheduleScope === 'custom' && (
                        <div className="grid grid-cols-2 gap-3 border-t border-dashed border-border-subtle pt-3 animate-in fade-in">
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[9px] font-black uppercase text-ghost tracking-wider flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-primary" /> Start Bounds
                            </span>
                            <input 
                              type="date"
                              value={customTimelineStart}
                              onChange={(e) => setCustomTimelineStart(e.target.value)}
                              className="bg-surface-base border border-border-subtle hover:border-primary/50 rounded-lg px-2.5 py-1.5 text-xs text-main font-mono outline-none transition-all shadow-sm"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[9px] font-black uppercase text-ghost tracking-wider flex items-center gap-1">
                              <CalendarDays className="w-3 h-3 text-accent" /> End Bounds
                            </span>
                            <input 
                              type="date"
                              value={customTimelineEnd}
                              onChange={(e) => setCustomTimelineEnd(e.target.value)}
                              className="bg-surface-base border border-border-subtle hover:border-accent/50 rounded-lg px-2.5 py-1.5 text-xs text-main font-mono outline-none transition-all shadow-sm"
                            />
                          </div>
                          <div className="col-span-2">
                            <button 
                              type="button"
                              onClick={() => {
                                setCustomTimelineStart(project.start_date || new Date().toISOString().split('T')[0]);
                                setCustomTimelineEnd(project.end_date || new Date().toISOString().split('T')[0]);
                              }}
                              className="w-full py-2 bg-surface-base hover:bg-surface-2 text-[9px] font-black uppercase tracking-wider text-ghost hover:text-main border border-border-subtle rounded-lg transition-all text-center"
                            >
                              Reset to Project Bounds
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Active Date Navigation */}
                      {scheduleScope !== 'start-to-finish' && scheduleScope !== 'custom' && (
                        <div className="flex flex-col gap-2.5 border-t border-dashed border-border-subtle pt-3">
                          <span className="text-[9px] font-black uppercase text-ghost tracking-wider">Timeframe Position</span>
                          <div className="flex items-center justify-between gap-2 bg-surface-base p-1 px-2 rounded-xl border border-border-subtle/60">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleNavigateScope('prev')}
                                className="p-1 px-2 hover:bg-surface-2 bg-surface-1 border border-border-subtle rounded text-main transition-all flex items-center justify-center shadow-sm"
                                title="Previous Frame"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setRefDate(new Date())}
                                className="px-2.5 py-1 hover:bg-surface-2 bg-surface-1 border border-border-subtle rounded text-[9px] font-black uppercase tracking-wider text-ghost transition-all shadow-sm"
                              >
                                Today
                              </button>
                              <button
                                type="button"
                                onClick={() => handleNavigateScope('next')}
                                className="p-1 px-2 hover:bg-surface-2 bg-surface-1 border border-border-subtle rounded text-main transition-all flex items-center justify-center shadow-sm"
                                title="Next Frame"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                            <span className="text-[10px] font-mono font-black text-primary bg-primary/5 border border-primary/10 rounded px-2.5 py-1 uppercase tracking-wide">
                              {scopeRangeLabel}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* INTERACTIVE LOGISTICS ENVIRONMENT */}
                    <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
                      <span className="text-[10px] font-black uppercase text-amber-500 tracking-widest flex items-center gap-1.5 pb-2 border-b border-border-subtle/40">
                        <Sparkles className="w-4 h-4" /> Logistics, Climate & Site Mobility
                      </span>
                      
                      {/* Transport Factor */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-ghost flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-primary" /> Accessibility Mode
                        </label>
                        <div className="grid grid-cols-3 gap-1 bg-surface-base border border-border-subtle rounded-xl p-0.5 select-none text-[9px]">
                          {[
                            { id: 'urban', label: 'Urban', desc: 'Default' },
                            { id: 'gravel', label: 'Gravel', desc: 'Remote (+7d)' },
                            { id: 'restricted', label: 'Restricted', desc: 'Mountain (+18d)' }
                          ].map(acc => (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => setSiteAccessibility(acc.id as any)}
                              className={cn(
                                "py-1.5 rounded text-[10px] font-bold flex flex-col items-center justify-center transition-all",
                                siteAccessibility === acc.id
                                  ? "bg-primary text-white shadow-sm font-black"
                                  : "text-ghost hover:text-main hover:bg-surface-2"
                              )}
                            >
                              <span>{acc.label}</span>
                              <span className="text-[8px] opacity-75 font-normal mt-0.5">{acc.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Seasonality delay */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-ghost flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 text-accent" /> Season Delay Factor
                        </label>
                        <div className="grid grid-cols-3 gap-1 bg-surface-base border border-border-subtle rounded-xl p-0.5 select-none text-[9px]">
                          {[
                            { id: 'dry', label: 'Dry / Mild', desc: 'Standard Path' },
                            { id: 'rainy', label: 'Rainy', desc: 'Flooding (+8d)' },
                            { id: 'winter', label: 'Winter', desc: 'Heavy Snow (+12d)' }
                          ].map(season => (
                            <button
                              key={season.id}
                              type="button"
                              onClick={() => setCurrentSeason(season.id as any)}
                              className={cn(
                                "py-1.5 rounded text-[10px] font-bold flex flex-col items-center justify-center transition-all",
                                currentSeason === season.id
                                  ? "bg-accent text-white shadow-sm font-black"
                                  : "text-ghost hover:text-main hover:bg-surface-2"
                              )}
                            >
                              <span>{season.label}</span>
                              <span className="text-[8px] opacity-75 font-normal mt-0.5">{season.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Safeties margins adjustment & live delays counts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
                    <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
                      <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest flex items-center gap-1.5 pb-2 border-b border-border-subtle/40">
                        <SlidersHorizontal className="w-4 h-4" /> Safety Margins & Material Buffers
                      </span>

                      <div className="flex flex-col gap-3">
                        <div>
                          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-ghost mb-1">
                            <span className="flex items-center gap-1.5">
                              <ShoppingCart className="w-3.5 h-3.5 text-indigo-500" />
                              Base Material Lead-Time
                            </span>
                            <span className="text-xs font-mono text-primary font-bold">{materialLeadTime} Days</span>
                          </div>
                          <input 
                            type="range"
                            min="1"
                            max="60"
                            value={materialLeadTime}
                            onChange={(e) => setMaterialLeadTime(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-surface-base border border-border-subtle rounded-lg appearance-none cursor-pointer accent-primary"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-ghost mb-1">
                            <span className="flex items-center gap-1.5">
                              <Briefcase className="w-3.5 h-3.5 text-amber-500" />
                              Company Desired Buffer
                            </span>
                            <span className="text-xs font-mono text-amber-600 font-bold">{companyDesireAdjust} Days</span>
                          </div>
                          <input 
                            type="range"
                            min="-15"
                            max="30"
                            value={companyDesireAdjust}
                            onChange={(e) => setCompanyDesireAdjust(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-surface-base border border-border-subtle rounded-lg appearance-none cursor-pointer accent-amber-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 flex flex-col gap-2.5 shadow-sm justify-between">
                      <div>
                        <span className="text-[10px] font-black uppercase text-amber-700 tracking-widest flex items-center gap-1.5 pb-2 border-b border-amber-500/20">
                          <Sparkles className="w-4 h-4" /> Live delay aggregation
                        </span>
                        <p className="text-[10.5px] text-zinc-600 dark:text-zinc-400 leading-relaxed mt-2 font-sans">
                          These configuration delays are automatically aggregated into procurement schedules whenever a procurement or material delivery type focus is requested.
                        </p>
                      </div>

                      <div className="flex flex-col gap-1 text-[10.5px] font-mono border-t border-dashed border-amber-500/15 pt-2">
                        <div className="flex items-center justify-between text-dim">
                          <span>Mobility:</span>
                          <span className="text-primary font-bold">+{siteAccessibility === 'gravel' ? 7 : siteAccessibility === 'restricted' ? 18 : 0}d</span>
                        </div>
                        <div className="flex items-center justify-between text-dim">
                          <span>Seasonality delay:</span>
                          <span className="text-accent font-bold font-black">+{currentSeason === 'rainy' ? 8 : currentSeason === 'winter' ? 12 : 0}d</span>
                        </div>
                        <div className="flex items-center justify-between text-dim">
                          <span>Desired core buffer:</span>
                          <span className="text-amber-500 font-bold font-black">{companyDesireAdjust >= 0 ? `+${companyDesireAdjust}` : companyDesireAdjust}d</span>
                        </div>
                        <div className="flex items-center justify-between font-bold text-main pt-1.5 border-t border-border-subtle mt-1 text-[11px]">
                          <span>Aggregate Lead Duration:</span>
                          <span className="text-indigo-600 font-black px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/40 font-mono">
                            {Number(materialLeadTime) + (siteAccessibility === 'gravel' ? 7 : siteAccessibility === 'restricted' ? 18 : 0) + (currentSeason === 'rainy' ? 8 : currentSeason === 'winter' ? 12 : 0) + Number(companyDesireAdjust)} Days
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-surface-2 border-t border-border-subtle flex justify-end gap-3 rounded-b-3xl">
                  <button 
                    type="button"
                    onClick={() => setIsLogisticsOpen(false)} 
                    className="btn btn-primary px-6 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-md shadow-primary/20"
                  >
                    Confirm & Apply
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className={cn(
            "bg-surface-1 border border-border-subtle rounded-lg overflow-hidden shadow-sm relative",
            isFullscreen && "flex-1 flex flex-col min-h-0"
          )}>
            <div className="px-4 py-2 border-b border-border-subtle bg-surface-2 flex flex-col md:flex-row md:items-center justify-between gap-3 min-h-14">
              <div className="flex items-center gap-2 shrink-0">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-sm font-black uppercase tracking-widest text-main truncate max-w-[280px]">
                  {isFullscreen ? project.name : "Project Timeline"}
                </span>
                {isFullscreen && (
                  <span className="ml-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-surface-base border border-border-subtle text-ghost">
                    {tasks.length} {tasks.length === 1 ? 'TASK' : 'TASKS'}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Time Scale Controller */}
                <div className="flex items-center gap-1.5 bg-surface-base px-2.5 py-1 rounded-md border border-border-subtle shadow-sm h-8 animate-pulse hover:animate-none" title="Timeline Zoom/Scaling Viewport">
                  <span className="text-[9px] font-black uppercase text-ghost tracking-[0.1em]">Time Scale</span>
                  <select
                    value={scheduleScope}
                    onChange={(e) => {
                      setScheduleScope(e.target.value as any);
                      setRefDate(new Date());
                    }}
                    className="bg-transparent border-none text-[11px] font-black text-primary outline-none cursor-pointer pr-1"
                  >
                    <option value="start-to-finish">Full Span</option>
                    <option value="1-day">1 Day</option>
                    <option value="2-days">2 Days</option>
                    <option value="3-days">3 Days</option>
                    <option value="4-days">4 Days</option>
                    <option value="5-days">5 Days</option>
                    <option value="1-week">1 Week</option>
                    <option value="1-month">1 Month</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                    <option value="custom">Custom Date</option>
                  </select>
                </div>

                {/* Column Filter Popover */}
                <div className="relative font-sans" ref={colFilterRef}>
                  <button
                    type="button"
                    onClick={() => setIsColFilterOpen(!isColFilterOpen)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 h-8 rounded-md border text-[11px] font-bold uppercase transition-all shadow-sm",
                      isColFilterOpen 
                        ? "bg-accent/10 border-accent/40 text-accent font-black" 
                        : "bg-surface-base border-border-subtle text-main hover:border-accent hover:text-accent"
                    )}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Columns</span>
                  </button>

                  {isColFilterOpen && (
                    <div className="absolute right-0 top-10 z-[150] w-48 bg-surface-1 border border-border rounded-xl shadow-xl overflow-hidden py-1.5 animate-in fade-in slide-in-from-top-2">
                      <div className="px-3 py-1 border-b border-border-subtle text-[9px] font-black uppercase tracking-wider text-ghost mb-1">
                        Toggle Columns
                      </div>
                      {[
                        { key: 'start_date', label: 'Start Date' },
                        { key: 'no_days', label: 'No. Days' },
                        { key: 'end_date', label: 'End Date' },
                        { key: 'predecessors', label: 'Predecessors' },
                        { key: 'progress', label: 'Progress' },
                        { key: 'contract_qty', label: 'Contract Qty' },
                        { key: 'surveyed_qty', label: 'Surveyed Qty' },
                        { key: 'actual_qty', label: 'Actual Qty' },
                        { key: 'amount', label: 'Contract Amount' },
                        { key: 'trade_name', label: 'Assigned Trade' },
                        { key: 'resources', label: 'Resources' },
                      ].map(col => (
                        <label
                          key={col.key}
                          className="flex items-center justify-between px-3 py-1.5 text-xs text-main hover:bg-surface-2 cursor-pointer transition-colors select-none font-medium"
                        >
                          <span>{col.label}</span>
                          <input
                            type="checkbox"
                            checked={(visibleCols as any)[col.key]}
                            onChange={() => {
                              setVisibleCols(prev => ({
                                ...prev,
                                [col.key]: !(prev as any)[col.key]
                              }));
                            }}
                            className="rounded text-primary focus:ring-primary w-3.5 h-3.5 border-border-subtle"
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bulk Edit Button */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={toggleBulkEdit}
                    className={cn(
                      "btn btn-sm h-8 px-3 text-[11px] font-bold uppercase tracking-wider transition-all shadow-sm",
                      isBulkEditMode ? "bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200" : "btn-secondary"
                    )}
                  >
                    {isBulkEditMode ? <X className="w-3.5 h-3.5 mr-1" /> : <Edit2 className="w-3.5 h-3.5 mr-1" />}
                    {isBulkEditMode ? 'Cancel' : 'Bulk Edit'}
                  </button>
                  {isBulkEditMode && Object.keys(pendingChanges).length > 0 && (
                    <button 
                      onClick={saveBulkChanges}
                      disabled={isMassEditLoading}
                      className="btn btn-primary btn-sm h-8 px-3 text-[11px] font-bold uppercase tracking-wider animate-in fade-in"
                    >
                      {isMassEditLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                      Save ({Object.keys(pendingChanges).length})
                    </button>
                  )}
                </div>

                {isFullscreen && (
                  <div className="flex items-center gap-1.5 mr-1 border-r border-border-subtle pr-3">
                    <button 
                      onClick={handleExportPDF}
                      disabled={exporting || tasks.length === 0}
                      className="btn btn-secondary btn-sm h-8 px-2.5 text-[10px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1"
                    >
                      {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                      <span>Export PDF</span>
                    </button>
                    <button 
                      onClick={handleAIScheduleGenerate}
                      disabled={isAIProcessing || tasks.length === 0}
                      className="ai-btn h-8 px-3 text-[10px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1 min-w-[105px]"
                    >
                      {isAIProcessing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3 text-accent-light mr-1" />
                      )}
                      <span>{isAIProcessing ? 'Analyzing...' : 'AI Schedule'}</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingTask({ progress_pct: 0 });
                        setIsModalOpen(true);
                      }}
                      className="btn btn-primary btn-sm h-8 px-2.5 text-[10px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1 text-white border-primary"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>
                        {scheduleType === 'detailed' || scheduleType === 'crushed' ? 'Add Task' :
                         scheduleType === 'procurement' ? 'Procure' :
                         scheduleType === 'delivery' ? 'Deliver' :
                         scheduleType === 'manpower' ? 'Manpower' :
                         scheduleType === 'milestone' ? 'Milestone' :
                         scheduleType === 'payment' ? 'Claim' : 'Add Item'}
                      </span>
                    </button>
                  </div>
                )}

                <div className="h-6 w-px bg-border-subtle" />

                {/* Expand / Shrink Button */}
                <button 
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 h-8 rounded-md border transition-all shadow-inner font-bold uppercase tracking-wider text-[11px]",
                    isFullscreen 
                      ? "bg-primary text-white border-primary hover:bg-primary/95" 
                      : "bg-surface-base border-border-subtle text-main hover:text-primary hover:border-primary/40"
                  )}
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  <span>{isFullscreen ? 'Shrink' : 'Expand'}</span>
                </button>

                {/* Legend items */}
                <div className="hidden lg:flex items-center gap-2 text-[8px] font-mono text-ghost bg-surface-base px-2.5 py-1.5 rounded-md border border-border-subtle/30 shadow-none">
                  <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-warning" /> PLANNED</div>
                  <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-accent" /> PROGRESS</div>
                  <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> DONE</div>
                </div>
              </div>
            </div>

            <div className={cn(
              "overflow-x-auto overflow-y-auto transition-all relative block",
              isFullscreen ? "flex-1" : "max-h-[70vh]"
            )} id="schedule-content">
              <div className="relative" style={{ width: 'max-content', minWidth: '100%' }}>
                {/* Precise Vector Dependency Connecting Arrows Layer */}
                <svg className="absolute inset-0 pointer-events-none select-none z-[12]" style={{ height: '100%', width: '100%' }}>
                  <defs>
                    <marker id="arrow-indigo" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 2.5 L 7 5 L 0 7.5 z" fill="#6366f1" />
                    </marker>
                    <marker id="arrow-critical" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 2.5 L 7 5 L 0 7.5 z" fill="#ef4444" />
                    </marker>
                  </defs>
                  {dependencies.map((dep, didx) => {
                    const predIdx = listVisibleNodes.findIndex(r => r.item?.id === dep.predecessor_id);
                    const taskIdx = listVisibleNodes.findIndex(r => r.item?.id === dep.task_id);
                    if (predIdx < 0 || taskIdx < 0) return null;

                    const predRow = listVisibleNodes[predIdx];
                    const taskRow = listVisibleNodes[taskIdx];
                    const predTask = predRow.item;
                    const taskItem = taskRow.item;

                    const predCurrent = predTask ? { ...predTask, ...(pendingChanges[predTask.id] || {}) } : null;
                    const taskCurrent = taskItem ? { ...taskItem, ...(pendingChanges[taskItem.id] || {}) } : null;

                    const predIsGroup = predRow.children.length > 0;
                    const taskIsGroup = taskRow.children.length > 0;

                    const predStart = predIsGroup ? predRow.earliest : predCurrent?.planned_start_date;
                    const predEnd = predIsGroup ? predRow.latest : predCurrent?.planned_end_date;

                    const taskStart = taskIsGroup ? taskRow.earliest : taskCurrent?.planned_start_date;
                    const taskEnd = taskIsGroup ? taskRow.latest : taskCurrent?.planned_end_date;

                    if (!predStart || !predEnd || !taskStart || !taskEnd) return null;

                    const predStartVal = getPosition(predStart);
                    const predEndVal = predStartVal + getWidth(predStart, predEnd);

                    const taskStartVal = getPosition(taskStart);
                    const taskEndVal = taskStartVal + getWidth(taskStart, taskEnd);

                    const predClampedLeft = Math.max(0, Math.min(100, predStartVal));
                    const predClampedRight = Math.max(predClampedLeft, Math.min(100, predEndVal));

                    const taskClampedLeft = Math.max(0, Math.min(100, taskStartVal));
                    const taskClampedRight = Math.max(taskClampedLeft, Math.min(100, taskEndVal));

                    let startPct = 0;
                    let endPct = 0;

                    if (dep.link_type === 'SS') {
                      startPct = predClampedLeft;
                      endPct = taskClampedLeft;
                    } else if (dep.link_type === 'FF') {
                      startPct = predClampedRight;
                      endPct = taskClampedRight;
                    } else if (dep.link_type === 'SF') {
                      startPct = predClampedLeft;
                      endPct = taskClampedRight;
                    } else {
                      startPct = predClampedRight;
                      endPct = taskClampedLeft;
                    }

                    const x1 = totalLeftWidthToTimeline + 16 + (startPct / 100) * (colWidths.timeline - 32);
                    const x2 = totalLeftWidthToTimeline + 16 + (endPct / 100) * (colWidths.timeline - 32);

                    // 44px sticky thead, 44px individual rows
                    const headerHeight = 44;
                    const y1 = headerHeight + (predIdx * 44) + 21;
                    const y2 = headerHeight + (taskIdx * 44) + 21;

                    const isCritical = predTask && taskItem && criticalTaskIds.has(predTask.id) && criticalTaskIds.has(taskItem.id);
                    const strokeColor = isCritical ? '#ef4444' : '#6366f1';
                    const markerId = isCritical ? 'url(#arrow-critical)' : 'url(#arrow-indigo)';
                    const strokeWidth = isCritical ? 2.5 : 1.5;

                    let d = '';
                    if (x2 > x1) {
                      const midX = x1 + (x2 - x1) / 2;
                      d = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
                    } else {
                      const offset = 12;
                      d = `M ${x1} ${y1} H ${x1 + offset} V ${(y1 + y2) / 2} H ${x2 - offset} V ${y2} H ${x2}`;
                    }

                    return (
                      <path 
                        key={`dep-arrow-${didx}`} 
                        d={d} 
                        fill="none" 
                        stroke={strokeColor} 
                        strokeWidth={strokeWidth} 
                        markerEnd={markerId}
                        className="transition-all duration-300 opacity-60 hover:opacity-100"
                      />
                    );
                  })}
                </svg>

                <table 
                  style={{ width: `${totalLeftWidthToTimeline + colWidths.timeline}px` }} 
                  className="text-left border-collapse table-fixed relative z-10"
                >
                  <thead className="sticky top-0 z-20 bg-surface-base border-b border-border-subtle">
                    <tr style={{ height: '44px' }}>
                      <th className="px-4 py-2.5 w-10 shrink-0 bg-surface-base border-b border-border-subtle">
                        <button 
                          onClick={selectAll}
                          className="text-ghost hover:text-primary transition-colors"
                        >
                          {selectedTaskIds.size === tasks.length && tasks.length > 0 ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost relative group/col bg-surface-base border-b border-border-subtle" style={{ width: colWidths.item_no }}>
                        Item No
                        <div 
                          onMouseDown={(e) => startResize('item_no', e)}
                          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-10"
                        />
                      </th>
                      <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost relative group/col bg-surface-base border-b border-border-subtle" style={{ width: colWidths.description }}>
                        Description
                        <div 
                          onMouseDown={(e) => startResize('description', e)}
                          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-10"
                        />
                      </th>
                      {visibleCols.start_date && (
                        <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost relative group/col bg-surface-base border-b border-border-subtle" style={{ width: colWidths.start_date }}>
                          Start Date
                          <div 
                            onMouseDown={(e) => startResize('start_date', e)}
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-10"
                          />
                        </th>
                      )}
                      {visibleCols.no_days && (
                        <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost relative group/col bg-surface-base border-b border-border-subtle" style={{ width: colWidths.no_days }}>
                          No. Days
                          <div 
                            onMouseDown={(e) => startResize('no_days', e)}
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-10"
                          />
                        </th>
                      )}
                      {visibleCols.end_date && (
                        <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost relative group/col bg-surface-base border-b border-border-subtle" style={{ width: colWidths.end_date }}>
                          End Date
                          <div 
                            onMouseDown={(e) => startResize('end_date', e)}
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-10"
                          />
                        </th>
                      )}
                      {visibleCols.predecessors && (
                        <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost relative group/col bg-surface-base border-b border-border-subtle" style={{ width: colWidths.predecessors }}>
                          Predecessors
                          <div 
                            onMouseDown={(e) => startResize('predecessors', e)}
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-10"
                          />
                        </th>
                      )}
                      {visibleCols.progress && (
                        <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost relative group/col bg-surface-base border-b border-border-subtle" style={{ width: colWidths.progress }}>
                          Progress
                          <div 
                            onMouseDown={(e) => startResize('progress', e)}
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-10"
                          />
                        </th>
                      )}
                      {visibleCols.contract_qty && (
                        <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost relative group/col bg-surface-base border-b border-border-subtle" style={{ width: colWidths.contract_qty }}>
                          Contract Qty
                          <div 
                            onMouseDown={(e) => startResize('contract_qty', e)}
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-10"
                          />
                        </th>
                      )}
                      {visibleCols.surveyed_qty && (
                        <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost relative group/col bg-surface-base border-b border-border-subtle" style={{ width: colWidths.surveyed_qty }}>
                          Surveyed Qty
                          <div 
                            onMouseDown={(e) => startResize('surveyed_qty', e)}
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-10"
                          />
                        </th>
                      )}
                      {visibleCols.actual_qty && (
                        <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost relative group/col bg-surface-base border-b border-border-subtle" style={{ width: colWidths.actual_qty }}>
                          Actual Qty
                          <div 
                            onMouseDown={(e) => startResize('actual_qty', e)}
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-10"
                          />
                        </th>
                      )}
                      {visibleCols.amount && (
                        <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost relative group/col bg-surface-base border-b border-border-subtle" style={{ width: colWidths.amount }}>
                          Amount
                          <div 
                            onMouseDown={(e) => startResize('amount', e)}
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-10"
                          />
                        </th>
                      )}
                      {visibleCols.trade_name && (
                        <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost relative group/col bg-surface-base border-b border-border-subtle" style={{ width: colWidths.trade_name }}>
                          Assigned Trade
                          <div 
                            onMouseDown={(e) => startResize('trade_name', e)}
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-10"
                          />
                        </th>
                      )}
                      {visibleCols.resources && (
                        <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost relative group/col bg-surface-base border-b border-border-subtle" style={{ width: colWidths.resources }}>
                          Resources
                          <div 
                            onMouseDown={(e) => startResize('resources', e)}
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-10"
                          />
                        </th>
                      )}
                      <th className="px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-widest text-ghost text-center relative group/col bg-surface-base border-b border-border-subtle" style={{ width: colWidths.actions }}>
                        Actions
                        <div 
                          onMouseDown={(e) => startResize('actions', e)}
                          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-10"
                        />
                      </th>
                      <th className="px-4 py-2 bg-slate-50 dark:bg-zinc-900 border-l border-border-subtle/30 text-left relative group/col bg-surface-base border-b border-border-subtle" style={{ width: colWidths.timeline }}>
                        <div className="flex flex-col gap-1 w-full relative">
                          <span className="text-primary font-black uppercase tracking-widest text-[9.5px]">Timeline Progress Matrix</span>
                          <span className="text-[8px] text-zinc-500 capitalize normal-case font-medium">
                            {scopeRangeLabel}
                          </span>
                          <div className="flex h-4 items-center relative mt-1 select-none border-t border-dashed border-border-subtle/35">
                            {ticks.map((tick, tid) => (
                              <div 
                                key={`tick-${tid}`} 
                                className="absolute border-l border-border-subtle/40 h-2.5 flex items-center pl-1 text-[8px] font-mono text-zinc-400 font-bold"
                                style={{ left: `${tick.position}%` }}
                              >
                                {tick.label}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div 
                          onMouseDown={(e) => startResize('timeline', e)}
                          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors z-10"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {(() => {
                      const renderNode = (node: TaskTreeNode): React.ReactNode => {
                        const isExpanded = expandedGroups.has(node.item_no);
                        const hasChildren = node.children.length > 0;
                        const task = node.item;
                        const isSelected = task ? selectedTaskIds.has(task.id) : false;
                        
                        // Use pending change if it exists
                        const currentTask = task ? { ...task, ...(pendingChanges[task.id] || {}) } : null;

                        const duration = (hasChildren && node.earliest && node.latest)
                          ? calculateDuration(node.earliest, node.latest)
                          : ((currentTask?.planned_start_date && currentTask?.planned_end_date) 
                            ? calculateDuration(currentTask.planned_start_date, currentTask.planned_end_date) 
                            : (node.earliest && node.latest ? calculateDuration(node.earliest, node.latest) : 0));
                        const predecessorStr = task ? getPredecessorsString(task.id) : '';

                        return (
                          <React.Fragment key={node.item_no}>
                            <tr 
                              style={{ height: '44px' }}
                              className={cn(
                                "transition-all duration-200 group",
                                !task ? "bg-surface-2/30" : (isBulkEditMode ? "hover:bg-indigo-50/10" : "hover:bg-surface-2")
                              )}
                            >
                              <td className="px-4 py-1.5 shrink-0">
                                {task && (
                                  <button 
                                    onClick={() => toggleSelect(task.id)}
                                    className="text-ghost hover:text-primary transition-colors cursor-pointer"
                                  >
                                    {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-primary" /> : <Square className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </td>
                              <td className="px-4 py-1.5 border-r border-border-subtle/20" style={{ width: colWidths.item_no }}>
                                <div 
                                  className="flex items-center gap-2 relative min-w-0"
                                  style={{ paddingLeft: `${node.depth * 20}px` }}
                                >
                                  {/* Connector lines for hierarchy */}
                                  {node.depth > 0 && (
                                    <div className="absolute left-[-10px] top-1/2 w-2 border-t border-dashed border-border-subtle -translate-x-full" />
                                  )}

                                  {hasChildren ? (
                                    <button 
                                      onClick={() => toggleGroup(node.item_no)}
                                      className="p-0.5 rounded hover:bg-surface-2 transition-colors shrink-0 z-10 bg-surface-base/50"
                                    >
                                      {isExpanded ? <ChevronDown className="w-3 h-3 text-primary" /> : <ChevronRight className="w-3 h-3 text-primary" />}
                                    </button>
                                  ) : (
                                    <div className="w-4 shrink-0" />
                                  )}
                                  
                                  <span 
                                    className={cn(
                                      "text-[11px] whitespace-normal break-words cursor-pointer font-mono font-semibold",
                                      hasChildren ? "text-accent hover:underline" : "font-normal text-dim"
                                    )}
                                    onClick={() => hasChildren && toggleGroup(node.item_no)}
                                  >
                                    {cleanRichText(node.item_no)}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-1.5 border-r border-border-subtle/20" style={{ width: colWidths.description }}>
                                <div className="flex items-start gap-2">
                                  {isBulkEditMode && task ? (
                                    <textarea 
                                      className="bg-surface-base border border-border-muted rounded px-2 py-1 text-[11px] text-main w-full outline-none min-h-[40px] leading-tight resize-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-sans"
                                      value={currentTask?.description || ''}
                                      onChange={(e) => handleBulkFieldChange(task.id, 'description', e.target.value)}
                                    />
                                  ) : (
                                    <div className="flex flex-col min-w-0 py-0.5">
                                      <span className={cn(
                                        "whitespace-normal leading-tight py-0.5",
                                        hasChildren ? "text-[13px] font-semibold text-main" : "text-[12px] font-normal text-dim/90"
                                      )}>
                                        {task ? cleanRichText(task.description) : (() => {
                                          const childWithSection = node.children.find(c => c.item?.section_group || c.item?.bill_no);
                                          const fallbackName = childWithSection?.item?.section_group || (childWithSection?.item?.bill_no ? `Bill No. ${childWithSection.item.bill_no}` : '');
                                          return fallbackName || `Section ${node.item_no}`;
                                        })()}
                                      </span>
                                      {!task && (
                                        <div className="flex items-center gap-2 mt-0.5 opacity-60 text-[9px] font-mono">
                                          <span className="text-ghost">{node.earliest || '—'}</span>
                                          <span className="text-border-subtle">→</span>
                                          <span className="text-ghost">{node.latest || '—'}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                              {visibleCols.start_date && (
                                <td className="px-4 py-1.5 border-r border-border-subtle/20" style={{ width: colWidths.start_date }}>
                                  {isBulkEditMode && task ? (
                                    <input 
                                      type="date"
                                      value={currentTask?.planned_start_date || ''}
                                      onChange={(e) => handleBulkFieldChange(task.id, 'planned_start_date', e.target.value)}
                                      className="bg-surface-base border border-border-muted rounded px-2 py-1 text-xs w-full font-mono focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all text-main"
                                    />
                                  ) : (
                                    <span className={cn(
                                      "font-mono truncate block text-[11px]",
                                      (!task || hasChildren) ? "text-primary font-black uppercase tracking-wider bg-primary/10 px-1.5 py-0.5 rounded text-[10px]" : "text-dim"
                                    )}>
                                      {(hasChildren || !task) ? (node.earliest || '—') : (task.planned_start_date || '—')}
                                    </span>
                                  )}
                                </td>
                              )}
                              {visibleCols.no_days && (
                                <td className="px-4 py-1.5 border-r border-border-subtle/20" style={{ width: colWidths.no_days }}>
                                  {isBulkEditMode && task ? (
                                    <input 
                                      type="number"
                                      min="1"
                                      value={duration}
                                      onChange={(e) => handleDurationChange(task.id, e.target.value)}
                                      className="bg-surface-base border border-border-muted rounded px-2 py-1 text-xs w-full font-mono focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all text-main"
                                    />
                                  ) : (
                                    <span className={cn(
                                      "font-mono truncate block text-[11px]",
                                      (!task || hasChildren) ? "text-accent font-black" : "text-dim"
                                    )}>
                                      {duration > 0 ? `${duration} d` : '—'}
                                    </span>
                                  )}
                                </td>
                              )}
                              {visibleCols.end_date && (
                                <td className="px-4 py-1.5 border-r border-border-subtle/20" style={{ width: colWidths.end_date }}>
                                  {isBulkEditMode && task ? (
                                    <input 
                                      type="date"
                                      value={currentTask?.planned_end_date || ''}
                                      onChange={(e) => handleBulkFieldChange(task.id, 'planned_end_date', e.target.value)}
                                      className="bg-surface-base border border-border-muted rounded px-2 py-1 text-xs w-full font-mono focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all text-main"
                                    />
                                  ) : (
                                    <span className={cn(
                                      "font-mono truncate block text-[11px]",
                                      (!task || hasChildren) ? "text-primary font-black uppercase tracking-wider bg-primary/10 px-1.5 py-0.5 rounded text-[10px]" : "text-dim"
                                    )}>
                                      {(hasChildren || !task) ? (node.latest || '—') : (task.planned_end_date || '—')}
                                    </span>
                                  )}
                                </td>
                              )}
                              {visibleCols.predecessors && (
                                <td className="px-4 py-1.5 border-r border-border-subtle/20" style={{ width: colWidths.predecessors }}>
                                  {isBulkEditMode && task ? (() => {
                                    const currentPred = getTaskPredecessor(task.id);
                                    const pendingPredecessorId = currentPred?.predecessor_id || '';
                                    const pendingLinkType = currentPred?.link_type || 'FS';
                                    const pendingLagDays = currentPred?.lag_days || 0;
                                    
                                    return (
                                      <div className="flex flex-col gap-1 min-w-[120px]">
                                        <select
                                          value={pendingPredecessorId}
                                          onChange={(e) => handlePendingPredecessorChange(task.id, 'predecessor_id', e.target.value)}
                                          className="bg-surface-base border border-border-muted rounded text-[11px] px-2 py-1 outline-none font-semibold text-main focus:border-primary transition-all w-full"
                                        >
                                          <option value="">None</option>
                                          {calculatedTasks.filter(t => t.id !== task.id).map(t => (
                                            <option key={t.id} value={t.id}>
                                              {t.item_no ? `[${t.item_no}] ` : ''}{t.description.substring(0, 18)}...
                                            </option>
                                          ))}
                                        </select>
                                        {pendingPredecessorId && (
                                          <div className="flex gap-1.5 items-center bg-surface-base border border-border-muted px-2 py-1 rounded justify-between">
                                            <div className="flex gap-0.5 min-w-[100px] justify-start items-center">
                                              {(['FS', 'SS', 'FF', 'SF'] as const).map(type => {
                                                const isActive = pendingLinkType === type;
                                                const badgeStyles = {
                                                  FS: isActive ? 'bg-primary/20 border border-primary text-primary font-bold animate-in zoom-in-95 duration-100' : 'bg-transparent border border-transparent text-ghost hover:text-main hover:bg-surface-2',
                                                  SS: isActive ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400 font-bold animate-in zoom-in-95 duration-100' : 'bg-transparent border border-transparent text-ghost hover:text-main hover:bg-surface-2',
                                                  FF: isActive ? 'bg-amber-500/20 border border-amber-500 text-amber-400 font-bold animate-in zoom-in-95 duration-100' : 'bg-transparent border border-transparent text-ghost hover:text-main hover:bg-surface-2',
                                                  SF: isActive ? 'bg-indigo-500/20 border border-indigo-500 text-indigo-400 font-bold animate-in zoom-in-95 duration-100' : 'bg-transparent border border-transparent text-ghost hover:text-main hover:bg-surface-2',
                                                };
                                                return (
                                                  <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => handlePendingPredecessorChange(task.id, 'link_type', type)}
                                                    className={cn(
                                                      "text-[9px] px-1 py-0.5 rounded cursor-pointer transition-all font-mono leading-none",
                                                      badgeStyles[type]
                                                    )}
                                                    title={`Set relationship type to ${type}`}
                                                  >
                                                    {type}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                            <span className="text-[8px] text-ghost font-bold">Lag:</span>
                                            <input
                                              type="number"
                                              value={pendingLagDays}
                                              onChange={(e) => handlePendingPredecessorChange(task.id, 'lag_days', parseInt(e.target.value) || 0)}
                                              className="bg-transparent border-none text-[10px] w-8 font-mono outline-none text-right py-0 text-main focus:ring-0"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })() : (
                                    <span className="font-mono text-dim truncate block text-[11px]" title={predecessorStr}>
                                      {predecessorStr || '—'}
                                    </span>
                                  )}
                                </td>
                              )}
                              {visibleCols.progress && (
                                <td className="px-4 py-1.5 border-r border-border-subtle/20" style={{ width: colWidths.progress }}>
                                  {isBulkEditMode && task && !hasChildren ? (
                                    <div className="flex items-center gap-2">
                                      <input 
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={currentTask?.progress_pct || 0}
                                        onChange={(e) => handleBulkFieldChange(task.id, 'progress_pct', parseInt(e.target.value) || 0)}
                                        className="bg-surface-base border border-border-muted rounded px-2 py-1 text-xs w-16 font-mono text-right focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all text-main"
                                      />
                                      <span className="text-[10px] text-primary font-bold">%</span>
                                    </div>
                                  ) : isBulkEditMode && task && hasChildren ? (
                                    <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-amber-500 bg-amber-500/5 border border-amber-500/20 rounded-md px-2 py-1 select-none cursor-not-allowed opacity-85" title="Auto-calculated via weighted contract value">
                                      <Lock className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                                      <span>{Math.round(currentTask?.progress_pct || 0)}%</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 min-w-[60px]">
                                      <div className="flex-1 h-1 bg-surface-2 rounded-full overflow-hidden">
                                        <div 
                                          className={cn(
                                            "h-full transition-all duration-500",
                                            task?.status === 'complete' ? "bg-primary" : "bg-accent"
                                          )}
                                          style={{ width: `${task ? (task.progress_pct || 0) : 0}%` }}
                                        />
                                      </div>
                                      <span className="text-[10px] font-mono font-bold shrink-0">{task ? (task.progress_pct || 0) : 0}%</span>
                                    </div>
                                  )}
                                </td>
                              )}
                              {visibleCols.contract_qty && (
                                <td className="px-4 py-1.5 border-r border-border-subtle/20" style={{ width: colWidths.contract_qty }}>
                                  <span className="font-mono text-dim text-right block text-[11px]">{task ? (task.contract_qty !== undefined ? task.contract_qty : '—') : '—'}</span>
                                </td>
                              )}
                              {visibleCols.surveyed_qty && (
                                <td className="px-4 py-1.5 border-r border-border-subtle/20" style={{ width: colWidths.surveyed_qty }}>
                                  <span className="font-mono text-dim text-right block text-[11px]">{task ? (task.surveyed_qty !== undefined ? task.surveyed_qty : '—') : '—'}</span>
                                </td>
                              )}
                              {visibleCols.actual_qty && (
                                <td className="px-4 py-1.5 border-r border-border-subtle/20" style={{ width: colWidths.actual_qty }}>
                                  {isBulkEditMode && task ? (
                                    <input 
                                      type="number"
                                      value={currentTask?.actual_qty !== undefined ? currentTask.actual_qty : ''}
                                      onChange={(e) => handleBulkFieldChange(task.id, 'actual_qty', parseFloat(e.target.value) || 0)}
                                      className="bg-surface-base border border-border-muted rounded px-2 py-1 text-xs w-full text-right font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-main"
                                    />
                                  ) : (
                                    <span className="font-mono text-dim text-right block text-[11px]">{task ? (task.actual_qty !== undefined ? task.actual_qty : '—') : '—'}</span>
                                  )}
                                </td>
                              )}
                              {visibleCols.amount && (
                                <td className="px-4 py-1.5 border-r border-border-subtle/20" style={{ width: colWidths.amount }}>
                                  <span className="font-mono text-dim text-right block text-[11px]">{task ? `$${(task.contract_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</span>
                                </td>
                              )}
                              {visibleCols.trade_name && (
                                <td className="px-4 py-1.5 border-r border-border-subtle/20" style={{ width: colWidths.trade_name }}>
                                  <span className="text-dim truncate block text-[11px]">{task ? (task.trade_name || '—') : '—'}</span>
                                </td>
                              )}
                              {visibleCols.resources && (
                                <td className="px-4 py-1.5 border-r border-border-subtle/20" style={{ width: colWidths.resources }}>
                                  <span className="text-dim text-[10px] break-words block max-w-[200px]" title={taskResources[task?.id || '']?.join(', ') || '—'}>
                                    {task ? (taskResources[task.id]?.join(', ') || '—') : '—'}
                                  </span>
                                </td>
                              )}
                              <td className="px-4 py-1.5" style={{ width: colWidths.actions }}>
                                {task && !isBulkEditMode && (
                                  <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      onClick={() => {
                                        setEditingTask(task);
                                        setIsModalOpen(true);
                                      }}
                                      className="p-1.5 hover:bg-surface-3 rounded text-ghost hover:text-primary transition-all"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      onClick={() => deleteTask(task.id)}
                                      className="p-1.5 hover:bg-rose-50 rounded text-ghost hover:text-rose-500 transition-all"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </td>
                              {/* Timeline Progress Matrix Column */}
                              <td className="px-4 py-1.5 border-r border-border-subtle/20 relative" style={{ width: colWidths.timeline, height: '44px' }}>
                                {/* Horizontal timeline division ticks */}
                                <div className="absolute inset-0 pointer-events-none flex select-none z-[1]">
                                  {ticks.map((tick, tid) => (
                                    <div 
                                      key={`cell-tick-${tid}`} 
                                      className="absolute border-l border-zinc-200/50 dark:border-zinc-800/10 top-0 bottom-0"
                                      style={{ left: `${tick.position}%` }}
                                    />
                                  ))}
                                </div>

                                <div className="relative w-full h-full flex items-center z-[2]">
                                  {(() => {
                                    const itemStart = (hasChildren || !task) ? node.earliest : currentTask?.planned_start_date;
                                    const itemEnd = (hasChildren || !task) ? node.latest : currentTask?.planned_end_date;

                                    if (!itemStart || !itemEnd) return <span className="text-[10px] text-zinc-400/50 italic">— no schedule —</span>;

                                    const leftPct = getPosition(itemStart);
                                    const rightPct = getPosition(itemStart) + getWidth(itemStart, itemEnd);

                                    const clampedLeft = Math.max(0, Math.min(100, leftPct));
                                    const clampedRight = Math.max(clampedLeft, Math.min(100, rightPct));
                                    const barWidth = clampedRight - clampedLeft;

                                    if (barWidth <= 0) return null;

                                    const isGroup = !task;
                                    const isCritical = task ? criticalTaskIds.has(task.id) : false;

                                    const isProcure = scheduleType === 'procurement';
                                    const isDelivery = scheduleType === 'delivery';
                                    const isManpower = scheduleType === 'manpower';

                                    let bgClass = "bg-primary";
                                    let labelText = task ? `${currentTask?.progress_pct || 0}%` : `${duration} days`;

                                    if (isGroup) {
                                      bgClass = "bg-zinc-700/80 dark:bg-zinc-400/80 rounded";
                                    } else if (isCritical) {
                                      bgClass = "bg-red-500 hover:bg-red-600";
                                    } else {
                                      const progress = currentTask?.progress_pct || 0;
                                      if (progress === 100) {
                                        bgClass = "bg-green-500 hover:bg-green-600";
                                      } else if (progress > 0) {
                                        bgClass = "bg-accent hover:bg-accent/90";
                                      } else {
                                        bgClass = "bg-warning hover:bg-warning/90";
                                      }
                                    }

                                    return (
                                      <div 
                                        className="relative h-6 group/bar transition-all duration-200"
                                        style={{ 
                                          left: `${clampedLeft}%`, 
                                          width: `${barWidth}%`,
                                        }}
                                      >
                                        <div className={cn(
                                          "absolute inset-0 rounded-md flex items-center justify-center text-[10px] text-white font-mono font-bold select-none shadow-sm transition-all overflow-hidden",
                                          bgClass
                                        )}>
                                          <span className="truncate px-1" title={labelText}>{labelText}</span>
                                          
                                          {task && (currentTask?.progress_pct || 0) > 0 && (currentTask?.progress_pct || 0) < 100 && (
                                            <div 
                                              className="absolute left-0 bottom-0 h-1 bg-green-400 opacity-60 rounded-bl-md" 
                                              style={{ width: `${currentTask.progress_pct}%` }} 
                                            />
                                          )}
                                        </div>

                                        {task && isProcure && (() => {
                                          const pStart = getProcurementStartDate(currentTask?.planned_start_date || null, task.id);
                                          const pLeft = getPosition(pStart);
                                          const pWidth = getWidth(pStart, currentTask?.planned_start_date || null);
                                          if (pWidth <= 0) return null;
                                          return (
                                            <div 
                                              className="absolute -top-1 bg-purple-500/20 border-t border-purple-500 h-1 text-[7px] font-mono text-purple-700 font-bold pointer-events-none"
                                              style={{ left: `${pLeft - clampedLeft}%`, width: `${pWidth}%` }}
                                            >
                                              <span className="absolute bottom-1 bg-surface-1/90 px-1 rounded shadow-sm border border-purple-400/20">PROCURE</span>
                                            </div>
                                          );
                                        })()}

                                        {task && isDelivery && (() => {
                                          const dStart = currentTask?.planned_start_date || null;
                                          const dEnd = getDeliveryReceiptDate(currentTask?.planned_start_date || null, task.id);
                                          const dLeft = getPosition(dStart);
                                          const dWidth = getWidth(dStart, dEnd);
                                          if (dWidth <= 0) return null;
                                          return (
                                            <div 
                                              className="absolute -bottom-1 bg-orange-500/20 border-b border-orange-500 h-1 text-[7px] font-mono text-orange-700 font-bold pointer-events-none"
                                              style={{ left: `${dLeft - clampedLeft}%`, width: `${dWidth}%` }}
                                            >
                                              <span className="absolute top-1 bg-surface-1/90 px-1 rounded shadow-sm border border-orange-400/20">DELIVER</span>
                                            </div>
                                          );
                                        })()}

                                        {task && isManpower && (() => {
                                          const mStart = getSubcontractorMobilizationDate(currentTask?.planned_start_date || null, task.id);
                                          const mLeft = getPosition(mStart);
                                          const mWidth = getWidth(mStart, currentTask?.planned_start_date || null);
                                          if (mWidth <= 0) return null;
                                          return (
                                            <div 
                                              className="absolute -top-1 bg-teal-500/20 border-t border-teal-500 h-1 text-[7px] font-mono text-teal-700 font-bold pointer-events-none"
                                              style={{ left: `${mLeft - clampedLeft}%`, width: `${mWidth}%` }}
                                            >
                                              <span className="absolute bottom-1 bg-surface-1/90 px-1 rounded shadow-sm border border-teal-400/20">MOBILIZE</span>
                                            </div>
                                          );
                                        })()}

                                        {/* Hover Tooltip Details */}
                                        <div className="hidden group-hover/bar:flex absolute top-7 left-1/2 -translate-x-1/2 bg-surface-1 border border-border-subtle p-2 rounded-lg shadow-xl z-50 flex-col gap-1 min-w-[200px] text-[10px] text-main">
                                          <div className="font-bold border-b border-zinc-200 pb-1 mb-1 truncate">
                                            {task ? currentTask?.description : `Parent Activity: ${node.item_no}`}
                                          </div>
                                          <div className="flex justify-between font-mono">
                                            <span className="text-zinc-500">Interval:</span>
                                            <span className="font-bold text-primary">{itemStart} → {itemEnd}</span>
                                          </div>
                                          <div className="flex justify-between font-mono">
                                            <span className="text-zinc-500">Span:</span>
                                            <span className="font-bold text-accent">{duration} Days</span>
                                          </div>
                                          {task && (
                                            <div className="flex justify-between font-mono">
                                              <span className="text-zinc-500">Status:</span>
                                              <span className="font-bold">{currentTask?.status?.toUpperCase()} ({currentTask?.progress_pct}%)</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </td>
                            </tr>
                            {isExpanded && node.children.map(renderNode)}
                          </React.Fragment>
                        );
                      };

                      return taskTree.map(renderNode);
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mass Edit Bar */}
      {selectedTaskIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 bg-surface-1 border-2 border-primary rounded-2xl shadow-2xl p-4 flex items-center gap-6 animate-in slide-in-from-bottom-5">
           <div className="flex flex-col gap-0.5">
             <span className="text-[9px] font-black uppercase text-primary tracking-widest">Mass Edit Active</span>
             <span className="text-xs font-bold text-main">{selectedTaskIds.size} tasks selected</span>
           </div>
           
           <div className="h-8 w-px bg-border-subtle" />
           
           <div className="flex items-center gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[8px] font-black uppercase text-ghost">Mark As</label>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleMassUpdate({ status: 'complete', progress_pct: 100 })}
                    className="p-1.5 px-3 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-black uppercase hover:bg-emerald-100 transition-all"
                  >
                    Done
                  </button>
                  <button 
                    onClick={() => handleMassUpdate({ status: 'in_progress' })}
                    className="p-1.5 px-3 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-black uppercase hover:bg-blue-100 transition-all"
                  >
                    Active
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[8px] font-black uppercase text-ghost">Set New Dates</label>
                <div className="flex items-center gap-1">
                   <button 
                     onClick={() => {
                       const start = prompt('Enter start date (YYYY-MM-DD):');
                       const end = prompt('Enter end date (YYYY-MM-DD):');
                       if (start && end) handleMassUpdate({ planned_start_date: start, planned_end_date: end });
                     }}
                     className="p-1.5 px-3 rounded-lg bg-surface-2 border border-border-subtle text-[10px] font-black uppercase text-main hover:bg-surface-3 transition-all"
                   >
                     Batch Dates
                   </button>
                </div>
              </div>

              <button 
                onClick={() => setSelectedTaskIds(new Set())}
                className="p-2 text-ghost hover:text-rose-500 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
           </div>
           
           {isMassEditLoading && (
             <div className="absolute inset-0 bg-surface-1/80 backdrop-blur-sm flex items-center justify-center rounded-2xl">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
             </div>
           )}
        </div>
      )}

      {/* Task Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-1 border border-border-subtle rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-border-subtle flex items-center justify-between">
              <h3 className="text-lg font-bold text-main">
                {editingTask?.id 
                  ? (editingTask.id.toString().startsWith('auto_') ? 'Refine Automated Schedule Details' : 'Edit Schedule Item')
                  : (scheduleType === 'detailed' || scheduleType === 'crushed' ? 'Add New Task' :
                     scheduleType === 'procurement' ? 'Insert Procurement Item' :
                     scheduleType === 'delivery' ? 'Insert Delivery Item' :
                     scheduleType === 'manpower' ? 'Insert Manpower Setup' :
                     scheduleType === 'milestone' ? 'Insert Milestone' :
                     scheduleType === 'payment' ? 'Insert Claim Milestone' : 'Add Item')}
              </h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingTask(null);
                }} 
                className="text-ghost hover:text-main transition-colors"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-ghost">Task Name</label>
                <input 
                  type="text"
                  value={editingTask?.description || ''}
                  onChange={(e) => setEditingTask(prev => ({ ...prev, description: e.target.value }))}
                  className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-all text-main"
                  placeholder="Task name..."
                />
              </div>
              <div className="grid grid-cols-3 gap-3 font-sans">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-ghost">Start Date</label>
                  <input 
                    type="date"
                    value={editingTask?.planned_start_date || ''}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setEditingTask(prev => {
                        if (!prev) return prev;
                        const parsedDur = parseInt(modalDurInput, 10);
                        const d = (!isNaN(parsedDur) && parsedDur > 0) ? parsedDur : 1;
                        const s = new Date(newStart);
                        const end = new Date(s);
                        end.setDate(s.getDate() + (d - 1));
                        return {
                          ...prev,
                          planned_start_date: newStart,
                          planned_end_date: end.toISOString().split('T')[0]
                        };
                      });
                    }}
                    className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-xs outline-none focus:border-primary transition-all text-main font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-ghost font-sans">No. Days</label>
                  <input 
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={modalDurInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d+$/.test(val)) {
                        setModalDurInput(val);
                        const num = parseInt(val, 10);
                        if (!isNaN(num) && num > 0) {
                          setEditingTask(prev => {
                            if (!prev || !prev.planned_start_date) return prev;
                            const s = new Date(prev.planned_start_date);
                            const end = new Date(s);
                            end.setDate(s.getDate() + (num - 1));
                            return {
                              ...prev,
                              planned_end_date: end.toISOString().split('T')[0]
                            };
                          });
                        }
                      }
                    }}
                    onBlur={() => {
                      const num = parseInt(modalDurInput, 10);
                      if (isNaN(num) || num <= 0) {
                        setModalDurInput('1');
                        setEditingTask(prev => {
                          if (!prev || !prev.planned_start_date) return prev;
                          const s = new Date(prev.planned_start_date);
                          const end = new Date(s);
                          end.setDate(s.getDate() + 0); // 1 day
                          return {
                            ...prev,
                            planned_end_date: end.toISOString().split('T')[0]
                          };
                        });
                      }
                    }}
                    className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-xs outline-none focus:border-primary transition-all text-main font-mono text-center font-bold"
                    placeholder="Days"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-ghost">End Date</label>
                  <input 
                    type="date"
                    value={editingTask?.planned_end_date || ''}
                    onChange={(e) => {
                      const newEnd = e.target.value;
                      setEditingTask(prev => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          planned_end_date: newEnd
                        };
                      });
                    }}
                    className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-xs outline-none focus:border-primary transition-all text-main font-mono"
                    disabled={!!modalPredecessorId}
                    title={modalPredecessorId ? "End date is driven by predecessor linkage and duration." : ""}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-ghost">Status</label>
                  <select 
                    value={editingTask?.status || 'recipe_pending'}
                    onChange={(e) => setEditingTask(prev => ({ ...prev, status: e.target.value as any }))}
                    className="bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-all text-main"
                  >
                    <option value="draft">Draft</option>
                    <option value="in_progress">In Progress</option>
                    <option value="complete">Complete</option>
                    <option value="recipe_pending">Recipe Pending</option>
                    <option value="confirmed">Confirmed</option>
                  </select>
                </div>
                 <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-ghost flex items-center justify-between gap-1.5">
                    <span>Progress (%)</span>
                    {editingTask && tasks.some(t => t.item_no && t.item_no !== editingTask.item_no && t.item_no.startsWith((editingTask.item_no || '') + '.')) && (
                      <span className="text-[9px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-1 font-bold">
                        <Lock className="w-2.5 h-2.5" /> Auto-calc
                      </span>
                    )}
                  </label>
                  <input 
                    type="number"
                    min="0"
                    max="100"
                    disabled={editingTask && tasks.some(t => t.item_no && t.item_no !== editingTask.item_no && t.item_no.startsWith((editingTask.item_no || '') + '.'))}
                    value={editingTask?.progress_pct || 0}
                    onChange={(e) => setEditingTask(prev => prev ? ({ ...prev, progress_pct: parseInt(e.target.value) || 0 }) : prev)}
                    className={cn(
                      "bg-surface-2 border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-all text-main",
                      editingTask && tasks.some(t => t.item_no && t.item_no !== editingTask.item_no && t.item_no.startsWith((editingTask.item_no || '') + '.'))
                        ? "border-amber-500/20 bg-surface-base opacity-75 cursor-not-allowed text-amber-500"
                        : "border-border-subtle"
                    )}
                  />
                </div>
              </div>

              {/* Customized Company Desires & Site Mobility Overrides */}
              {editingTask?.id && (
                <div className="flex flex-col gap-3 mt-1 pt-4 border-t border-dashed border-border-subtle bg-surface-base/40 p-3 rounded-xl border border-border-subtle">
                  <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Task-level Logistics Overrides
                  </span>
                  <p className="text-[10px] text-dim leading-relaxed">Customize specific lead times or transport conditions to override project defaults for this task.</p>
                  
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black uppercase tracking-wider text-ghost">Custom Lead Days</label>
                      <input 
                        type="number"
                        placeholder="Default"
                        value={customLead === undefined ? '' : customLead}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomLead(val === '' ? undefined : parseInt(val));
                        }}
                        className="bg-surface-2 border border-border-subtle rounded-lg px-2 py-1 text-xs outline-none focus:border-primary text-main font-mono"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black uppercase tracking-wider text-ghost">Accessibility Override</label>
                      <select 
                        value={customAccess}
                        onChange={(e) => setCustomAccess(e.target.value)}
                        className="bg-surface-2 border border-border-subtle rounded-lg px-2 py-1 text-xs outline-none focus:border-primary text-main"
                      >
                        <option value="default">Use Global Default</option>
                        <option value="urban">Urban (Accessible)</option>
                        <option value="gravel">Gravel Path (+7d)</option>
                        <option value="restricted">Restricted (+18d)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black uppercase tracking-wider text-ghost">Season Delay Override</label>
                      <select 
                        value={customSeasonOverride}
                        onChange={(e) => setCustomSeasonOverride(e.target.value)}
                        className="bg-surface-2 border border-border-subtle rounded-lg px-2 py-1 text-xs outline-none focus:border-primary text-main"
                      >
                        <option value="default">Use Global Default</option>
                        <option value="dry">Dry / Clear Path</option>
                        <option value="rainy">Rainy (+8d Delay)</option>
                        <option value="winter">Winter (+12d Delay)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
              {editingTask?.id && (() => {
                const isEditingAuto = typeof editingTask.id === 'string' && editingTask.id.startsWith('auto_');
                const editingTargetId = isEditingAuto 
                  ? editingTask.id.replace(/^auto_(proc|del|man|ms|pay)_/, '')
                  : editingTask.id;

                return (
                  <div className="flex flex-col gap-3 mt-1 pt-4 border-t border-dashed border-border-subtle">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-ghost">Predecessor Dependency</span>
                    <div className="flex flex-col gap-2 bg-surface-2 p-3 rounded-xl border border-border-subtle">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-black uppercase text-ghost">Select Predecessor (Item No)</label>
                        <select 
                          value={modalPredecessorId}
                          onChange={(e) => setModalPredecessorId(e.target.value)}
                          className="bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-xs outline-none focus:border-primary transition-all text-main font-semibold"
                        >
                          <option value="">None (No Predecessor)</option>
                          {tasks
                            .filter(t => t.id !== editingTargetId) // Cannot depend on self
                            .map(t => (
                              <option key={t.id} value={t.id}>
                                {t.item_no ? `[${t.item_no}] ` : ''}{cleanRichText(t.description || '')}
                              </option>
                            ))
                          }
                        </select>
                      </div>

                      {modalPredecessorId && (
                        <div className="grid grid-cols-2 gap-3 mt-1 animate-in fade-in">
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black uppercase text-ghost mb-0.5">Dependency Link Type</label>
                            <div className="flex gap-1">
                              {(['FS', 'SS', 'FF', 'SF'] as const).map(type => {
                                const isActive = modalLinkType === type;
                                const colors = {
                                  FS: isActive ? 'bg-primary/25 border-primary text-primary font-bold shadow-sm shadow-primary/10 animate-in zoom-in-95 duration-100' : 'bg-surface-base border-border-subtle text-dim hover:text-main hover:bg-surface-2',
                                  SS: isActive ? 'bg-emerald-500/25 border-emerald-500 text-emerald-400 font-bold shadow-sm shadow-emerald-500/10 animate-in zoom-in-95 duration-100' : 'bg-surface-base border-border-subtle text-dim hover:text-main hover:bg-surface-2',
                                  FF: isActive ? 'bg-amber-500/25 border-amber-500 text-amber-400 font-bold shadow-sm shadow-amber-500/10 animate-in zoom-in-95 duration-100' : 'bg-surface-base border-border-subtle text-dim hover:text-main hover:bg-surface-2',
                                  SF: isActive ? 'bg-indigo-500/25 border-indigo-500 text-indigo-400 font-bold shadow-sm shadow-indigo-500/10 animate-in zoom-in-95 duration-100' : 'bg-surface-base border-border-subtle text-dim hover:text-main hover:bg-surface-2',
                                };
                                const labels = {
                                  FS: 'Finish-to-Start (FS)',
                                  SS: 'Start-to-Start (SS)',
                                  FF: 'Finish-to-Finish (FF)',
                                  SF: 'Start-to-Finish (SF)'
                                };
                                return (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() => setModalLinkType(type)}
                                    title={labels[type]}
                                    className={cn(
                                      "flex-1 text-center py-1.5 rounded-lg text-xs border transition-all cursor-pointer font-semibold font-mono",
                                      colors[type]
                                    )}
                                  >
                                    {type}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black uppercase text-ghost">Lag Days</label>
                            <input 
                              type="number"
                              className="bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-xs outline-none focus:border-primary transition-all text-main font-mono"
                              value={modalLagDays}
                              onChange={(e) => setModalLagDays(parseInt(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="p-6 bg-surface-2 border-t border-border-subtle flex justify-end gap-3">
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingTask(null);
                }}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveTask}
                className="btn btn-primary"
              >
                Save Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
