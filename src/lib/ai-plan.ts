// Convert AI-generated plan to Gantt tasks
import { GanttTask, Dependency, addDays } from "./gantt-types";
import { WorkCalendarConfig, addWorkingDays } from "./work-calendar";

export interface AIPlanTask {
  id: number;
  name: string;
  parentId: number | null;
  durationDays: number;
  isMilestone?: boolean;
  resourceRole?: string;
  dependencies?: { predecessorId: number; type?: "FS" | "SS" | "FF" | "SF"; lag?: number }[];
}

export interface AIProjectPlan {
  projectName: string;
  summary: string;
  assumptions: string[];
  warnings: string[];
  resourceRoles: string[];
  tasks: AIPlanTask[];
}

/** Compute nesting level for each task by walking parentId chain */
function computeLevel(taskId: number, byId: Map<number, AIPlanTask>): number {
  let lvl = 0;
  let cur = byId.get(taskId);
  while (cur && cur.parentId !== null) {
    lvl += 1;
    cur = byId.get(cur.parentId);
    if (lvl > 20) break;
  }
  return lvl;
}

export function convertPlanToTasks(
  plan: AIProjectPlan,
  calendar: WorkCalendarConfig,
  idOffset = 0,
  startDate: Date = new Date(),
): GanttTask[] {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const byId = new Map<number, AIPlanTask>();
  plan.tasks.forEach(t => byId.set(t.id, t));

  const parentIds = new Set<number>();
  plan.tasks.forEach(t => {
    if (t.parentId !== null && t.parentId !== undefined) parentIds.add(t.parentId);
  });

  const idMap = new Map<number, number>();
  plan.tasks.forEach((t, i) => idMap.set(t.id, idOffset + i + 1));

  return plan.tasks.map((t) => {
    const isParent = parentIds.has(t.id);
    const duration = isParent ? 0 : Math.max(0, Math.round(t.durationDays || 1));
    const end = duration === 0 ? start : addWorkingDays(start, duration, calendar);
    const level = computeLevel(t.id, byId);

    const deps: Dependency[] = (t.dependencies || [])
      .filter(d => idMap.has(d.predecessorId))
      .map(d => ({
        predecessorId: idMap.get(d.predecessorId)!,
        type: (d.type || "FS") as Dependency["type"],
        lag: d.lag || 0,
      }));

    return {
      id: idMap.get(t.id)!,
      name: t.name,
      start: new Date(start),
      end,
      progress: 0,
      resources: [],
      dependencies: deps,
      parentId: t.parentId !== null && t.parentId !== undefined && idMap.has(t.parentId)
        ? idMap.get(t.parentId)!
        : null,
      expanded: true,
      level,
    };
  });
}

export function totalMilestones(plan: AIProjectPlan): number {
  return plan.tasks.filter(t => t.isMilestone).length;
}

export function totalDependencies(plan: AIProjectPlan): number {
  return plan.tasks.reduce((sum, t) => sum + (t.dependencies?.length || 0), 0);
}

export function estimateTotalDurationDays(plan: AIProjectPlan): number {
  // Sum only leaf task durations
  const parentIds = new Set<number>();
  plan.tasks.forEach(t => { if (t.parentId !== null) parentIds.add(t.parentId); });
  return plan.tasks
    .filter(t => !parentIds.has(t.id))
    .reduce((sum, t) => sum + (t.durationDays || 0), 0);
}
