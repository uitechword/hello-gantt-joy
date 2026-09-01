export type LinkType = 'FS' | 'SS' | 'FF' | 'SF';

export interface Resource {
  id: string;
  name: string;
  color: string;
  avatar?: string;
}

export interface Dependency {
  predecessorId: number;
  type: LinkType;
  lag: number; // in days
}

export interface GanttTask {
  id: number;
  name: string;
  start: Date;
  end: Date;
  progress: number;
  resources: string[]; // resource IDs
  dependencies: Dependency[];
  parentId: number | null;
  expanded: boolean;
  level: number;
}

export interface FlatTask extends GanttTask {
  hasChildren: boolean;
  visible: boolean;
}

export function parsePredecessorString(input: string): Dependency[] {
  if (!input.trim()) return [];
  const parts = input.split(',').map(s => s.trim());
  const deps: Dependency[] = [];
  for (const part of parts) {
    const match = part.match(/^(\d+)(FS|SS|FF|SF)?([+-]\d+d)?$/i);
    if (match) {
      const predecessorId = parseInt(match[1]);
      const type = (match[2]?.toUpperCase() as LinkType) || 'FS';
      const lag = match[3] ? parseInt(match[3].replace('d', '')) : 0;
      deps.push({ predecessorId, type, lag });
    }
  }
  return deps;
}

export function dependencyToString(deps: Dependency[]): string {
  return deps.map(d => {
    let s = `${d.predecessorId}${d.type}`;
    if (d.lag > 0) s += `+${d.lag}d`;
    else if (d.lag < 0) s += `${d.lag}d`;
    return s;
  }).join(', ');
}

export function getDuration(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
