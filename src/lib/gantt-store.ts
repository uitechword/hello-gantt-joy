import { GanttTask, Resource, FlatTask, Dependency, addDays, getDuration } from './gantt-types';
import { WorkCalendarConfig, defaultWorkCalendar, addWorkingDays, getWorkingDaysDuration, nextWorkingDay, isNonWorkingDay } from './work-calendar';

// Check for circular dependencies using DFS
export function hasCircularDependency(tasks: GanttTask[], taskId: number, newDeps: Dependency[]): boolean {
  const adjacency = new Map<number, number[]>();
  for (const t of tasks) {
    const deps = t.id === taskId ? newDeps : t.dependencies;
    adjacency.set(t.id, deps.map(d => d.predecessorId));
  }

  const visited = new Set<number>();
  const stack = new Set<number>();

  function dfs(id: number): boolean {
    if (stack.has(id)) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    stack.add(id);
    for (const pred of adjacency.get(id) || []) {
      if (dfs(pred)) return true;
    }
    stack.delete(id);
    return false;
  }

  return dfs(taskId);
}

// Schedule tasks based on dependency constraints (topological order)
// Uses work calendar to skip non-working days
export function scheduleDependencies(tasks: GanttTask[], calendar: WorkCalendarConfig = defaultWorkCalendar): GanttTask[] {
  const result = tasks.map(t => ({ ...t, start: new Date(t.start), end: new Date(t.end) }));
  const taskMap = new Map(result.map(t => [t.id, t]));

  // Identify parent tasks (summary tasks don't get scheduled by deps)
  const parentIds = new Set<number>();
  for (const t of result) {
    if (t.parentId !== null) parentIds.add(t.parentId);
  }

  // Build adjacency: task -> list of successors
  const successors = new Map<number, number[]>();
  const inDegree = new Map<number, number>();
  for (const t of result) {
    if (!successors.has(t.id)) successors.set(t.id, []);
    const validDeps = t.dependencies.filter(d => taskMap.has(d.predecessorId));
    inDegree.set(t.id, validDeps.length);
    for (const dep of validDeps) {
      if (!successors.has(dep.predecessorId)) successors.set(dep.predecessorId, []);
      successors.get(dep.predecessorId)!.push(t.id);
    }
  }

  // Topological sort (Kahn's algorithm)
  const queue: number[] = [];
  for (const t of result) {
    if ((inDegree.get(t.id) || 0) === 0) queue.push(t.id);
  }

  const order: number[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const succId of successors.get(id) || []) {
      inDegree.set(succId, (inDegree.get(succId) || 1) - 1);
      if (inDegree.get(succId) === 0) queue.push(succId);
    }
  }

  // Process in topological order
  for (const id of order) {
    const task = taskMap.get(id)!;
    const validDeps = task.dependencies.filter(d => taskMap.has(d.predecessorId));
    if (validDeps.length === 0) {
      // Snap standalone tasks to working days
      const snappedStart = nextWorkingDay(task.start, calendar);
      if (snappedStart.getTime() !== task.start.getTime()) {
        const duration = getWorkingDaysDuration(task.start, task.end, calendar);
        task.start = snappedStart;
        task.end = addWorkingDays(snappedStart, duration, calendar);
      }
      continue;
    }

    // Skip parent/summary tasks
    if (parentIds.has(id)) continue;

    const duration = getWorkingDaysDuration(task.start, task.end, calendar);

    let earliestStart = new Date(0);

    for (const dep of validDeps) {
      const pred = taskMap.get(dep.predecessorId)!;

      let constraintDate: Date;
      switch (dep.type) {
        case 'FS':
          constraintDate = addWorkingDays(pred.end, dep.lag, calendar);
          break;
        case 'SS':
          constraintDate = addWorkingDays(pred.start, dep.lag, calendar);
          break;
        case 'FF':
          // succ.end >= pred.end + lag => succ.start = pred.end + lag - duration (in working days)
          constraintDate = addWorkingDays(pred.end, dep.lag - duration, calendar);
          break;
        case 'SF':
          constraintDate = addWorkingDays(pred.start, dep.lag - duration, calendar);
          break;
        default:
          constraintDate = new Date(0);
      }
      // Snap constraint to working day
      constraintDate = nextWorkingDay(constraintDate, calendar);
      if (constraintDate > earliestStart) earliestStart = constraintDate;
    }

    task.start = earliestStart;
    task.end = addWorkingDays(earliestStart, duration, calendar);
  }

  return result;
}

// Rollup parent dates from children
export function rollupParentDates(tasks: GanttTask[], calendar: WorkCalendarConfig = defaultWorkCalendar): GanttTask[] {
  const scheduled = scheduleDependencies(tasks, calendar);

  const parentIds = new Set(scheduled.filter(t => t.parentId !== null).map(t => t.parentId!));
  const parentList = scheduled.filter(t => parentIds.has(t.id));
  parentList.sort((a, b) => b.level - a.level);

  const trackingMin = (children: GanttTask[], field: 'baselineStart' | 'actualStart') => {
    const times = children
      .map(c => c[field])
      .filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()))
      .map(d => d.getTime());
    return times.length ? new Date(Math.min(...times)) : null;
  };
  const trackingMax = (children: GanttTask[], field: 'baselineEnd' | 'actualEnd') => {
    const times = children
      .map(c => c[field])
      .filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()))
      .map(d => d.getTime());
    return times.length ? new Date(Math.max(...times)) : null;
  };

  for (const parent of parentList) {
    const children = scheduled.filter(t => t.parentId === parent.id);
    if (children.length === 0) continue;

    const minStart = new Date(Math.min(...children.map(c => c.start.getTime())));
    const maxEnd = new Date(Math.max(...children.map(c => c.end.getTime())));
    const totalDuration = children.reduce((sum, c) => sum + getDuration(c.start, c.end), 0);
    const weightedProgress = children.reduce((sum, c) => sum + c.progress * getDuration(c.start, c.end), 0);

    parent.start = minStart;
    parent.end = maxEnd;
    parent.progress = totalDuration > 0 ? Math.round(weightedProgress / totalDuration) : 0;

    // Independent tracking-date rollup (deepest levels first, so it is recursive)
    parent.baselineStart = trackingMin(children, 'baselineStart');
    parent.baselineEnd = trackingMax(children, 'baselineEnd');
    parent.actualStart = trackingMin(children, 'actualStart');
    parent.actualEnd = trackingMax(children, 'actualEnd');
  }


  return scheduled;
}

// Flatten tree into ordered list
export function flattenTasks(tasks: GanttTask[]): FlatTask[] {
  const result: FlatTask[] = [];
  const childMap = new Map<number | null, GanttTask[]>();

  for (const t of tasks) {
    const key = t.parentId;
    if (!childMap.has(key)) childMap.set(key, []);
    childMap.get(key)!.push(t);
  }

  function walk(parentId: number | null, visible: boolean) {
    const children = childMap.get(parentId) || [];
    for (const child of children) {
      const hasKids = childMap.has(child.id) && (childMap.get(child.id)!.length > 0);
      result.push({ ...child, hasChildren: hasKids, visible });
      walk(child.id, visible && child.expanded);
    }
  }

  walk(null, true);
  return result;
}

// Create sample data
export function createSampleData(): { tasks: GanttTask[]; resources: Resource[] } {
  const resources: Resource[] = [
    { id: 'r1', name: 'Alice Chen', color: 'hsl(213 60% 52%)' },
    { id: 'r2', name: 'Bob Smith', color: 'hsl(152 55% 42%)' },
    { id: 'r3', name: 'Carol Wu', color: 'hsl(32 90% 55%)' },
    { id: 'r4', name: 'David Lee', color: 'hsl(280 60% 55%)' },
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tasks: GanttTask[] = [
    { id: 1, name: 'Project Planning', start: today, end: addDays(today, 15), progress: 65, resources: [], dependencies: [], parentId: null, expanded: true, level: 0 },
    { id: 2, name: 'Requirements Gathering', start: today, end: addDays(today, 5), progress: 100, resources: ['r1'], dependencies: [], parentId: 1, expanded: false, level: 1 },
    { id: 3, name: 'Architecture Design', start: addDays(today, 5), end: addDays(today, 10), progress: 80, resources: ['r1', 'r2'], dependencies: [{ predecessorId: 2, type: 'FS', lag: 0 }], parentId: 1, expanded: false, level: 1 },
    { id: 4, name: 'Technical Review', start: addDays(today, 10), end: addDays(today, 15), progress: 0, resources: ['r3'], dependencies: [{ predecessorId: 3, type: 'FS', lag: 0 }], parentId: 1, expanded: false, level: 1 },

    { id: 5, name: 'Development Phase', start: addDays(today, 15), end: addDays(today, 45), progress: 30, resources: [], dependencies: [], parentId: null, expanded: true, level: 0 },
    { id: 6, name: 'Frontend Development', start: addDays(today, 15), end: addDays(today, 30), progress: 50, resources: ['r2'], dependencies: [{ predecessorId: 4, type: 'FS', lag: 0 }], parentId: 5, expanded: false, level: 1 },
    { id: 7, name: 'Backend API', start: addDays(today, 15), end: addDays(today, 35), progress: 30, resources: ['r1', 'r4'], dependencies: [{ predecessorId: 4, type: 'FS', lag: 0 }], parentId: 5, expanded: false, level: 1 },
    { id: 8, name: 'Database Setup', start: addDays(today, 15), end: addDays(today, 20), progress: 100, resources: ['r4'], dependencies: [{ predecessorId: 7, type: 'SS', lag: 0 }], parentId: 5, expanded: false, level: 1 },
    { id: 9, name: 'Integration Testing', start: addDays(today, 35), end: addDays(today, 45), progress: 0, resources: ['r3'], dependencies: [{ predecessorId: 6, type: 'FF', lag: 0 }, { predecessorId: 7, type: 'FS', lag: 0 }], parentId: 5, expanded: false, level: 1 },

    { id: 10, name: 'Deployment', start: addDays(today, 45), end: addDays(today, 55), progress: 0, resources: [], dependencies: [], parentId: null, expanded: true, level: 0 },
    { id: 11, name: 'Staging Release', start: addDays(today, 45), end: addDays(today, 48), progress: 0, resources: ['r2', 'r4'], dependencies: [{ predecessorId: 9, type: 'FS', lag: 0 }], parentId: 10, expanded: false, level: 1 },
    { id: 12, name: 'Production Release', start: addDays(today, 50), end: addDays(today, 55), progress: 0, resources: ['r1', 'r2', 'r3'], dependencies: [{ predecessorId: 11, type: 'FS', lag: 2 }], parentId: 10, expanded: false, level: 1 },
  ];

  return { tasks: rollupParentDates(tasks), resources };
}
