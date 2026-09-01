import { GanttTask, FlatTask, Dependency, getDuration, addDays } from './gantt-types';

export interface CPMResult {
  taskId: number;
  es: number; // earliest start (days from project start)
  ef: number; // earliest finish
  ls: number; // latest start
  lf: number; // latest finish
  totalFloat: number;
  isCritical: boolean;
}

export function calculateCriticalPath(tasks: GanttTask[]): Map<number, CPMResult> {
  // Only process leaf tasks (non-parents)
  const parentIds = new Set(tasks.filter(t => t.parentId !== null).map(t => t.parentId!));
  const leafTasks = tasks.filter(t => !parentIds.has(t.id));
  
  if (leafTasks.length === 0) return new Map();

  // Find project start
  const projectStart = Math.min(...leafTasks.map(t => t.start.getTime()));
  
  const taskMap = new Map(leafTasks.map(t => [t.id, t]));
  const results = new Map<number, CPMResult>();

  // Initialize
  for (const t of leafTasks) {
    const duration = getDuration(t.start, t.end);
    results.set(t.id, {
      taskId: t.id,
      es: 0,
      ef: duration,
      ls: 0,
      lf: 0,
      totalFloat: 0,
      isCritical: false,
    });
  }

  // Build adjacency for topological sort
  const successors = new Map<number, number[]>();
  const inDegree = new Map<number, number>();
  for (const t of leafTasks) {
    if (!successors.has(t.id)) successors.set(t.id, []);
    const validDeps = t.dependencies.filter(d => taskMap.has(d.predecessorId));
    inDegree.set(t.id, validDeps.length);
    for (const dep of validDeps) {
      if (!successors.has(dep.predecessorId)) successors.set(dep.predecessorId, []);
      successors.get(dep.predecessorId)!.push(t.id);
    }
  }

  // Topological order
  const queue: number[] = [];
  for (const t of leafTasks) {
    if ((inDegree.get(t.id) || 0) === 0) queue.push(t.id);
  }
  const order: number[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const s of successors.get(id) || []) {
      inDegree.set(s, (inDegree.get(s) || 1) - 1);
      if (inDegree.get(s) === 0) queue.push(s);
    }
  }

  // Forward pass
  for (const id of order) {
    const task = taskMap.get(id)!;
    const r = results.get(id)!;
    const duration = getDuration(task.start, task.end);
    let es = 0;

    for (const dep of task.dependencies) {
      const predR = results.get(dep.predecessorId);
      if (!predR) continue;
      let constraint = 0;
      switch (dep.type) {
        case 'FS': constraint = predR.ef + dep.lag; break;
        case 'SS': constraint = predR.es + dep.lag; break;
        case 'FF': constraint = predR.ef + dep.lag - duration; break;
        case 'SF': constraint = predR.es + dep.lag - duration; break;
      }
      if (constraint > es) es = constraint;
    }

    r.es = es;
    r.ef = es + duration;
  }

  // Project finish
  const projectFinish = Math.max(...Array.from(results.values()).map(r => r.ef));

  // Backward pass
  for (const id of [...order].reverse()) {
    const task = taskMap.get(id)!;
    const r = results.get(id)!;
    const duration = getDuration(task.start, task.end);
    const succs = successors.get(id) || [];

    if (succs.length === 0) {
      r.lf = projectFinish;
    } else {
      let lf = Infinity;
      for (const succId of succs) {
        const succTask = taskMap.get(succId)!;
        const succR = results.get(succId)!;
        const succDep = succTask.dependencies.find(d => d.predecessorId === id);
        if (!succDep) continue;
        let constraint = Infinity;
        const succDuration = getDuration(succTask.start, succTask.end);
        switch (succDep.type) {
          case 'FS': constraint = succR.ls - succDep.lag; break;
          case 'SS': constraint = succR.ls - succDep.lag + duration; break;
          case 'FF': constraint = succR.lf - succDep.lag; break;
          case 'SF': constraint = succR.lf - succDep.lag + duration; break;
        }
        if (constraint < lf) lf = constraint;
      }
      r.lf = lf;
    }
    r.ls = r.lf - duration;
    r.totalFloat = r.ls - r.es;
    r.isCritical = Math.abs(r.totalFloat) < 0.001;
  }

  return results;
}
