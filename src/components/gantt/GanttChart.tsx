import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GanttTask, FlatTask, Resource, Dependency, addDays, getDuration, parsePredecessorString } from '@/lib/gantt-types';
import { createSampleData, flattenTasks, rollupParentDates, hasCircularDependency } from '@/lib/gantt-store';
import { calculateCriticalPath, CPMResult } from '@/lib/gantt-cpm';
import { WorkCalendarConfig, defaultWorkCalendar, addWorkingDays, getWorkingDaysDuration, Holiday } from '@/lib/work-calendar';
import { GanttToolbar } from './GanttToolbar';
import { TreeGrid } from './TreeGrid';
import { TimelineChart } from './TimelineChart';
import { ResourcePanel, COLORS } from './ResourcePanel';
import { GanttContextMenu } from './ContextMenu';
import { HolidayManager } from './HolidayManager';
import { AIPlannerPanel } from './AIPlannerPanel';
import { AIProjectPlan, convertPlanToTasks } from '@/lib/ai-plan';
import { useToast } from '@/hooks/use-toast-simple';
import { GanttChangeActions } from '@/gantt-change-review';
import { GanttModifiedChangesButton } from '@/gantt-change-view';
import { GanttCrudButton } from '@/gantt-crud-view';


const ROW_HEIGHT = 36;
const DAY_WIDTH = 28;

export function GanttChart() {
  const { toast } = useToast();
  const sampleData = useRef(createSampleData());
  const [tasks, setTasks] = useState<GanttTask[]>(sampleData.current.tasks);
  const [resources, setResources] = useState<Resource[]>(sampleData.current.resources);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  const [clipboard, setClipboard] = useState<GanttTask[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showResources, setShowResources] = useState(false);
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; taskId: number } | null>(null);
  const [dividerX, setDividerX] = useState(840);
  const [highlightTaskId, setHighlightTaskId] = useState<number | null>(null);
  const [showHolidayManager, setShowHolidayManager] = useState(false);
  const [showAIPlanner, setShowAIPlanner] = useState(false);
  const dividerDragging = useRef(false);

  // Work calendar state
  const [workCalendar, setWorkCalendar] = useState<WorkCalendarConfig>(defaultWorkCalendar);

  const treeScrollRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  const firstSelectedId = selectedTaskIds.size > 0 ? [...selectedTaskIds][0] : null;

  useEffect(() => {
    const treeSec = treeScrollRef.current;
    const timelineSec = timelineScrollRef.current;
    if (!treeSec || !timelineSec) return;
    let syncing = false;
    const syncScroll = (source: HTMLElement, target: HTMLElement) => () => {
      if (syncing) return;
      syncing = true;
      target.scrollTop = source.scrollTop;
      syncing = false;
    };
    const treeHandler = syncScroll(treeSec, timelineSec);
    const timelineHandler = syncScroll(timelineSec, treeSec);
    treeSec.addEventListener('scroll', treeHandler);
    timelineSec.addEventListener('scroll', timelineHandler);
    return () => {
      treeSec.removeEventListener('scroll', treeHandler);
      timelineSec.removeEventListener('scroll', timelineHandler);
    };
  }, []);

  const flatTasks = flattenTasks(tasks).map(t => ({
    ...t,
    visible: t.visible && (searchQuery === '' || t.name.toLowerCase().includes(searchQuery.toLowerCase())),
  }));

  const cpmResults = useMemo(() => calculateCriticalPath(tasks), [tasks]);

  const updateTasks = useCallback((updater: (prev: GanttTask[]) => GanttTask[]) => {
    setTasks(prev => rollupParentDates(updater(prev), workCalendar));
  }, [workCalendar]);

  // Re-schedule all tasks when calendar config changes
  useEffect(() => {
    setTasks(prev => rollupParentDates(prev, workCalendar));
  }, [workCalendar]);

  const handleCalendarChange = useCallback((update: Partial<WorkCalendarConfig>) => {
    setWorkCalendar(prev => ({ ...prev, ...update }));
  }, []);

  const addHoliday = useCallback((holiday: Holiday) => {
    setWorkCalendar(prev => ({
      ...prev,
      holidays: prev.holidays.some(h => h.date === holiday.date)
        ? prev.holidays.map(h => h.date === holiday.date ? holiday : h)
        : [...prev.holidays, holiday],
    }));
  }, []);

  const deleteHoliday = useCallback((date: string) => {
    setWorkCalendar(prev => ({
      ...prev,
      holidays: prev.holidays.filter(h => h.date !== date),
    }));
  }, []);

  const scrollToTask = useCallback((taskId: number) => {
    setHighlightTaskId(taskId);
    setTimeout(() => {
      const flat = flattenTasks(tasks);
      const idx = flat.findIndex(t => t.id === taskId);
      if (idx >= 0 && treeScrollRef.current) {
        treeScrollRef.current.scrollTop = idx * ROW_HEIGHT;
      }
    }, 50);
    setTimeout(() => setHighlightTaskId(null), 1500);
  }, [tasks]);

  const handleSelectTask = useCallback((id: number | null) => {
    if (id === null) setSelectedTaskIds(new Set());
    else setSelectedTaskIds(new Set([id]));
  }, []);

  const handleMultiSelect = useCallback((id: number, ctrlKey: boolean, shiftKey: boolean) => {
    setSelectedTaskIds(prev => {
      if (shiftKey && prev.size > 0) {
        const visibleIds = flatTasks.filter(t => t.visible).map(t => t.id);
        const lastSelected = [...prev][prev.size - 1];
        const lastIdx = visibleIds.indexOf(lastSelected);
        const curIdx = visibleIds.indexOf(id);
        if (lastIdx === -1 || curIdx === -1) return new Set([id]);
        const start = Math.min(lastIdx, curIdx);
        const end = Math.max(lastIdx, curIdx);
        const rangeIds = visibleIds.slice(start, end + 1);
        const next = new Set(prev);
        rangeIds.forEach(rid => next.add(rid));
        return next;
      }
      if (ctrlKey) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      return new Set([id]);
    });
  }, [flatTasks]);

  const copySelectedTasks = useCallback(() => {
    if (selectedTaskIds.size === 0) return;
    const selectedTasks = tasks.filter(t => selectedTaskIds.has(t.id));
    setClipboard(selectedTasks);
    toast({ title: 'Copied', description: `${selectedTasks.length} task(s) copied to clipboard` });
  }, [selectedTaskIds, tasks, toast]);

  const pasteClipboard = useCallback(() => {
    if (clipboard.length === 0) return;
    let maxId = Math.max(0, ...tasks.map(t => t.id));
    const idMap = new Map<number, number>();
    const clipboardIds = new Set(clipboard.map(t => t.id));
    const copiedRootIds = new Set(
      clipboard.filter(t => t.parentId === null || !clipboardIds.has(t.parentId)).map(t => t.id)
    );

    const getCopiedRootId = (task: GanttTask) => {
      let current: GanttTask | undefined = task;
      while (current && current.parentId !== null && clipboardIds.has(current.parentId)) {
        current = clipboard.find(candidate => candidate.id === current?.parentId);
      }
      return current?.id ?? task.id;
    };

    const newTasks: GanttTask[] = clipboard.map(t => {
      maxId += 1;
      idMap.set(t.id, maxId);
      return { ...t, id: maxId, name: `${t.name} (copy)`, start: new Date(t.start), end: new Date(t.end), dependencies: [], resources: [...t.resources] };
    });

    updateTasks(prev => {
      const flatPrev = flattenTasks(prev);
      const lastSelectedFlatIndex = flatPrev.reduce(
        (lastIndex, task, index) => (selectedTaskIds.has(task.id) ? index : lastIndex), -1
      );
      const anchorTask = lastSelectedFlatIndex >= 0 ? flatPrev[lastSelectedFlatIndex] : null;
      const targetParentId = anchorTask?.parentId ?? null;
      const targetLevel = anchorTask?.level ?? 0;

      const adjustedNewTasks = newTasks.map(task => {
        const originalTask = clipboard.find(item => idMap.get(item.id) === task.id)!;
        const originalRootId = getCopiedRootId(originalTask);
        const originalRoot = clipboard.find(item => item.id === originalRootId)!;
        const levelOffset = targetLevel - originalRoot.level;
        if (originalTask.parentId !== null && idMap.has(originalTask.parentId)) {
          return { ...task, parentId: idMap.get(originalTask.parentId)!, level: Math.max(0, originalTask.level + levelOffset) };
        }
        return { ...task, parentId: targetParentId, level: Math.max(0, targetLevel) };
      }).map(task => {
        const originalTask = clipboard.find(item => idMap.get(item.id) === task.id)!;
        return {
          ...task,
          dependencies: originalTask.dependencies
            .filter(dep => idMap.has(dep.predecessorId))
            .map(dep => ({ ...dep, predecessorId: idMap.get(dep.predecessorId)! })),
        };
      });

      if (!anchorTask) return [...prev, ...adjustedNewTasks];

      let blockEndFlatIndex = lastSelectedFlatIndex;
      while (blockEndFlatIndex + 1 < flatPrev.length && flatPrev[blockEndFlatIndex + 1].level > anchorTask.level) {
        blockEndFlatIndex += 1;
      }
      const nextFlatTask = flatPrev[blockEndFlatIndex + 1];
      const insertIdx = nextFlatTask ? prev.findIndex(task => task.id === nextFlatTask.id) : prev.length;
      const result = [...prev];
      result.splice(insertIdx, 0, ...adjustedNewTasks);
      return result;
    });

    const newIds = new Set(newTasks.map(t => t.id));
    setSelectedTaskIds(newIds);
    toast({ title: 'Pasted', description: `${newTasks.length} task(s) pasted` });
  }, [clipboard, tasks, selectedTaskIds, updateTasks, toast]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        copySelectedTasks();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        pasteClipboard();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [copySelectedTasks, pasteClipboard]);

  const addTask = useCallback(() => {
    const maxId = Math.max(0, ...tasks.map(t => t.id));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const flatPrev = flattenTasks(tasks);
    let anchorTask: FlatTask | null = null;
    if (selectedTaskIds.size > 0) {
      for (let i = flatPrev.length - 1; i >= 0; i--) {
        if (selectedTaskIds.has(flatPrev[i].id)) { anchorTask = flatPrev[i]; break; }
      }
    }
    const newTask: GanttTask = {
      id: maxId + 1, name: 'New Task', start: today, end: addDays(today, 5),
      progress: 0, resources: [], dependencies: [],
      parentId: anchorTask ? anchorTask.parentId : null,
      expanded: false, level: anchorTask ? anchorTask.level : 0,
    };
    updateTasks(prev => {
      if (!anchorTask) return [...prev, newTask];
      const anchorIdx = prev.findIndex(t => t.id === anchorTask!.id);
      if (anchorIdx === -1) return [...prev, newTask];
      const descendantIds = new Set<number>();
      const collectDescendants = (parentId: number) => {
        prev.forEach(t => { if (t.parentId === parentId) { descendantIds.add(t.id); collectDescendants(t.id); } });
      };
      collectDescendants(anchorTask!.id);
      let insertIdx = anchorIdx + 1;
      for (let i = anchorIdx + 1; i < prev.length; i++) {
        if (descendantIds.has(prev[i].id)) insertIdx = i + 1;
        else break;
      }
      const result = [...prev];
      result.splice(insertIdx, 0, newTask);
      return result;
    });
    setSelectedTaskIds(new Set([maxId + 1]));
    setTimeout(() => scrollToTask(maxId + 1), 100);
  }, [tasks, updateTasks, selectedTaskIds, scrollToTask]);

  const addParallelTask = useCallback((refTaskId: number) => {
    const refTask = tasks.find(t => t.id === refTaskId);
    if (!refTask) return;
    const maxId = Math.max(0, ...tasks.map(t => t.id));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const newTask: GanttTask = {
      id: maxId + 1, name: 'New Parallel Task', start: today, end: addDays(today, 5),
      progress: 0, resources: [], dependencies: [], parentId: refTask.parentId, expanded: false, level: refTask.level,
    };
    updateTasks(prev => [...prev, newTask]);
    setSelectedTaskIds(new Set([maxId + 1]));
    setTimeout(() => scrollToTask(maxId + 1), 100);
  }, [tasks, updateTasks, scrollToTask]);

  const addSubtask = useCallback((parentTaskId: number) => {
    const maxId = Math.max(0, ...tasks.map(t => t.id));
    const parent = tasks.find(t => t.id === parentTaskId);
    if (!parent) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const newTask: GanttTask = {
      id: maxId + 1, name: 'New Sub-task', start: today, end: addDays(today, 3),
      progress: 0, resources: [], dependencies: [], parentId: parentTaskId, expanded: false, level: parent.level + 1,
    };
    updateTasks(prev => prev.map(t => t.id === parentTaskId ? { ...t, expanded: true } : t).concat(newTask));
    setSelectedTaskIds(new Set([maxId + 1]));
    setTimeout(() => scrollToTask(maxId + 1), 100);
  }, [tasks, updateTasks, scrollToTask]);

  const deleteTask = useCallback((taskId?: number) => {
    const idsToProcess = taskId !== undefined ? [taskId] : [...selectedTaskIds];
    if (idsToProcess.length === 0) return;
    updateTasks(prev => {
      const idsToRemove = new Set<number>();
      function collectIds(id: number) {
        idsToRemove.add(id);
        prev.filter(t => t.parentId === id).forEach(c => collectIds(c.id));
      }
      idsToProcess.forEach(id => collectIds(id));
      return prev.filter(t => !idsToRemove.has(t.id)).map(t => ({
        ...t, dependencies: t.dependencies.filter(d => !idsToRemove.has(d.predecessorId)),
      }));
    });
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      idsToProcess.forEach(id => next.delete(id));
      return next;
    });
  }, [selectedTaskIds, updateTasks]);

  const indentTask = useCallback(() => {
    if (firstSelectedId === null) return;
    const flat = flattenTasks(tasks);
    const idx = flat.findIndex(t => t.id === firstSelectedId);
    if (idx <= 0) return;
    const prevSibling = flat.slice(0, idx).reverse().find(t => t.level === flat[idx].level || t.level === flat[idx].level - 1);
    if (!prevSibling || prevSibling.level < flat[idx].level - 1) return;
    const newParentId = prevSibling.id;
    updateTasks(prev => prev.map(t => {
      if (t.id === firstSelectedId) return { ...t, parentId: newParentId, level: t.level + 1 };
      return t;
    }).map(t => {
      if (t.id === newParentId) return { ...t, expanded: true };
      return t;
    }));
  }, [firstSelectedId, tasks, updateTasks]);

  const outdentTask = useCallback(() => {
    if (firstSelectedId === null) return;
    const task = tasks.find(t => t.id === firstSelectedId);
    if (!task || task.parentId === null) return;
    const parent = tasks.find(t => t.id === task.parentId);
    updateTasks(prev => prev.map(t => {
      if (t.id === firstSelectedId) return { ...t, parentId: parent?.parentId ?? null, level: Math.max(0, t.level - 1) };
      return t;
    }));
  }, [firstSelectedId, tasks, updateTasks]);

  const expandAll = useCallback(() => { updateTasks(prev => prev.map(t => ({ ...t, expanded: true }))); }, [updateTasks]);
  const collapseAll = useCallback(() => { updateTasks(prev => prev.map(t => ({ ...t, expanded: false }))); }, [updateTasks]);

  const toggleExpand = useCallback((id: number) => {
    updateTasks(prev => prev.map(t => t.id === id ? { ...t, expanded: !t.expanded } : t));
  }, [updateTasks]);

  const updateTaskField = useCallback((id: number, field: string, value: string) => {
    updateTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      switch (field) {
        case 'name': return { ...t, name: value };
        case 'start': {
          const d = new Date(value + 'T00:00:00');
          if (isNaN(d.getTime())) return t;
          const dur = getWorkingDaysDuration(t.start, t.end, workCalendar);
          return { ...t, start: d, end: addWorkingDays(d, dur, workCalendar) };
        }
        case 'end': {
          const d = new Date(value + 'T00:00:00');
          if (isNaN(d.getTime()) || d < t.start) return t;
          return { ...t, end: d };
        }
        case 'duration': {
          const dur = parseInt(value);
          if (isNaN(dur) || dur < 0) return t;
          return { ...t, end: addWorkingDays(t.start, dur, workCalendar) };
        }
        case 'baselineStart':
        case 'baselineEnd':
        case 'actualStart':
        case 'actualEnd': {
          // Informational tracking dates: never touch start/end, dependencies or scheduling
          if (!value) return { ...t, [field]: null };
          const d = new Date(value + 'T00:00:00');
          if (isNaN(d.getTime())) return t;
          if (field === 'baselineEnd' && t.baselineStart instanceof Date && d < t.baselineStart) {
            toast({ title: 'Invalid date', description: 'Baseline End Date must be on or after Baseline Start Date.', variant: 'destructive' });
            return t;
          }
          if (field === 'baselineStart' && t.baselineEnd instanceof Date && d > t.baselineEnd) {
            toast({ title: 'Invalid date', description: 'Baseline Start Date must be on or before Baseline End Date.', variant: 'destructive' });
            return t;
          }
          if (field === 'actualEnd' && t.actualStart instanceof Date && d < t.actualStart) {
            toast({ title: 'Invalid date', description: 'Actual End Date must be on or after Actual Start Date.', variant: 'destructive' });
            return t;
          }
          if (field === 'actualStart' && t.actualEnd instanceof Date && d > t.actualEnd) {
            toast({ title: 'Invalid date', description: 'Actual Start Date must be on or before Actual End Date.', variant: 'destructive' });
            return t;
          }
          return { ...t, [field]: d };
        }
        case 'progress': { const p = parseInt(value); if (isNaN(p)) return t; return { ...t, progress: Math.max(0, Math.min(100, p)) }; }

        case 'predecessors': {
          const newDeps = parsePredecessorString(value);
          if (hasCircularDependency(prev, id, newDeps)) {
            toast({ title: 'Circular Dependency', description: 'This dependency would create a cycle and cannot be added.', variant: 'destructive' });
            return t;
          }
          return { ...t, dependencies: newDeps };
        }
        default: return t;
      }
    }));
  }, [updateTasks, toast, workCalendar]);

  const updateTaskResources = useCallback((id: number, resourceIds: string[]) => {
    updateTasks(prev => prev.map(t => t.id === id ? { ...t, resources: resourceIds } : t));
  }, [updateTasks]);

  const moveTask = useCallback((id: number, newStart: Date) => {
    updateTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const dur = getWorkingDaysDuration(t.start, t.end, workCalendar);
      return { ...t, start: newStart, end: addWorkingDays(newStart, dur, workCalendar) };
    }));
  }, [updateTasks, workCalendar]);

  const resizeTask = useCallback((id: number, newEnd: Date) => {
    updateTasks(prev => prev.map(t => t.id !== id ? t : { ...t, end: newEnd }));
  }, [updateTasks]);

  const addResource = useCallback((name: string) => {
    const color = COLORS[resources.length % COLORS.length];
    setResources(prev => [...prev, { id: `r${Date.now()}`, name, color }]);
  }, [resources]);

  const deleteResource = useCallback((id: string) => {
    setResources(prev => prev.filter(r => r.id !== id));
    updateTasks(prev => prev.map(t => ({ ...t, resources: t.resources.filter(r => r !== id) })));
  }, [updateTasks]);

  const handleLoadAIPlan = useCallback((plan: AIProjectPlan) => {
    const maxId = Math.max(0, ...tasks.map(t => t.id));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newTasks = convertPlanToTasks(plan, workCalendar, maxId, today);

    // Create resources for suggested roles that don't already exist
    const existingNames = new Set(resources.map(r => r.name.toLowerCase()));
    const newResources: Resource[] = [];
    (plan.resourceRoles || []).forEach((role, i) => {
      if (!existingNames.has(role.toLowerCase())) {
        newResources.push({
          id: `r${Date.now()}_${i}`,
          name: role,
          color: COLORS[(resources.length + newResources.length) % COLORS.length],
        });
      }
    });
    if (newResources.length > 0) setResources(prev => [...prev, ...newResources]);
    updateTasks(prev => [...prev, ...newTasks]);
  }, [tasks, resources, workCalendar, updateTasks]);


  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dividerDragging.current) return;
      setDividerX(Math.max(300, Math.min(e.clientX, window.innerWidth - 300)));
    };
    const handleMouseUp = () => { dividerDragging.current = false; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className="gantt-app">
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '8px 12px' }}>
        <GanttChangeActions tasks={tasks} />
        <GanttModifiedChangesButton tasks={tasks} resources={resources} />
        <GanttCrudButton tasks={tasks} resources={resources} />
      </div>

      <GanttToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddTask={addTask}
        onDeleteTask={() => deleteTask()}
        onIndent={indentTask}
        onOutdent={outdentTask}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        onToggleResources={() => setShowResources(!showResources)}
        showResources={showResources}
        hasSelection={selectedTaskIds.size > 0}
        showCriticalPath={showCriticalPath}
        onToggleCriticalPath={setShowCriticalPath}
        workCalendar={workCalendar}
        onCalendarChange={handleCalendarChange}
        onOpenHolidays={() => setShowHolidayManager(true)}
        onOpenAIPlanner={() => setShowAIPlanner(true)}
      />

      <div className="gantt-content">
        <div ref={treeScrollRef} style={{ width: dividerX, overflow: 'auto', flexShrink: 0 }} className="gantt-scrollbar">
          <TreeGrid
            tasks={flatTasks}
            resources={resources}
            selectedTaskIds={selectedTaskIds}
            onSelectTask={handleMultiSelect}
            onToggleExpand={toggleExpand}
            onUpdateTask={updateTaskField}
            onUpdateResources={updateTaskResources}
            cpmResults={cpmResults}
            showCriticalPath={showCriticalPath}
            highlightTaskId={highlightTaskId}
            rowHeight={ROW_HEIGHT}
          />
        </div>

        <div
          className="gantt-divider"
          onMouseDown={() => { dividerDragging.current = true; }}
        />

        <div ref={timelineScrollRef} style={{ flex: 1, overflow: 'auto' }} className="gantt-scrollbar">
          <TimelineChart
            tasks={flatTasks}
            resources={resources}
            selectedTaskIds={selectedTaskIds}
            onSelectTask={handleSelectTask}
            onMoveTask={moveTask}
            onResizeTask={resizeTask}
            onContextMenu={(e, id) => { setContextMenu({ x: e.clientX, y: e.clientY, taskId: id }); handleSelectTask(id); }}
            cpmResults={cpmResults}
            showCriticalPath={showCriticalPath}
            rowHeight={ROW_HEIGHT}
            dayWidth={DAY_WIDTH}
            workCalendar={workCalendar}
          />
        </div>

        {showResources && (
          <ResourcePanel
            resources={resources}
            onAddResource={addResource}
            onDeleteResource={deleteResource}
          />
        )}
      </div>

      {contextMenu && (
        <GanttContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onDelete={() => { deleteTask(contextMenu.taskId); setContextMenu(null); }}
          onSetProgress={p => updateTaskField(contextMenu.taskId, 'progress', String(p))}
          onAddParallel={() => { addParallelTask(contextMenu.taskId); setContextMenu(null); }}
          onAddSubtask={() => { addSubtask(contextMenu.taskId); setContextMenu(null); }}
        />
      )}

      {showHolidayManager && (
        <HolidayManager
          holidays={workCalendar.holidays}
          onAddHoliday={addHoliday}
          onDeleteHoliday={deleteHoliday}
          onClose={() => setShowHolidayManager(false)}
        />
      )}

      <AIPlannerPanel
        open={showAIPlanner}
        onClose={() => setShowAIPlanner(false)}
        onLoadPlan={handleLoadAIPlan}
      />
    </div>
  );
}
