// Read-only CRUD change detection for Gantt tasks.
// Plain JavaScript, no dependencies. Never mutates the input data.

/** UI-only / derived properties that are not user business data. */
const IGNORED_FIELDS = new Set([
  'expanded', 'hasChildren', 'visible', 'selected', 'index', 'styles',
  'isDisabled', 'hideChildren', 'displayOrder', 'barChildren',
  'x1', 'x2', 'y', 'height', 'width',
  'earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'slack', 'isCritical',
]);

export const FIELD_LABELS = {
  name: 'Task Name',
  type: 'Task Type',
  start: 'Start Date',
  end: 'End Date',
  duration: 'Duration',
  dependencies: 'Dependency',
  progress: 'Progress',
  resources: 'Resources',
  assignee: 'Assignee',
  parentId: 'Parent',
  level: 'Level',
  milestone: 'Milestone',
  notes: 'Notes',
};

const FIELD_ORDER = [
  'name', 'type', 'start', 'end', 'duration', 'dependencies',
  'progress', 'resources', 'assignee', 'parentId', 'level', 'milestone',
  'notes',
];

function toDate(value) {
  const d = value instanceof Date ? value : new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

function toISODate(value) {
  const d = toDate(value);
  if (!d) return String(value == null ? '' : value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prettyDate(value) {
  const d = toDate(value);
  if (!d) return String(value == null ? '' : value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isDateField(field, value) {
  return field === 'start' || field === 'end' || value instanceof Date;
}

function depToString(dep) {
  if (dep && typeof dep === 'object') {
    if ('predecessorId' in dep) {
      const type = dep.type || 'FS';
      const lag = Number(dep.lag || 0);
      const lagStr = lag > 0 ? `+${lag}d` : lag < 0 ? `${lag}d` : '';
      const typeStr = type === 'FS' && lag === 0 ? '' : type;
      return `${dep.predecessorId}${typeStr}${lagStr}`;
    }
    return JSON.stringify(dep);
  }
  return String(dep == null ? '' : dep);
}

/** Order-insensitive, type-tolerant normalization for change detection. */
function normalizeValue(field, value) {
  if (value === null || value === undefined || value === '') return '';
  if (isDateField(field, value)) return toISODate(value);
  if (Array.isArray(value)) return value.map(depToString).slice().sort().join('|');
  if (typeof value === 'object') {
    return Object.keys(value).sort().map(k => `${k}=${normalizeValue(k, value[k])}`).join('|');
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value).trim();
}

/** Human readable value. */
export function displayField(field, value, resources = []) {
  if (value === null || value === undefined || value === '') return '';
  if (isDateField(field, value)) return prettyDate(value);
  if (field === 'progress') return `${value}%`;
  if (field === 'duration') return `${value} d`;
  if (field === 'resources' || field === 'assignee') {
    const list = Array.isArray(value) ? value : [value];
    if (!list.length) return '';
    return list
      .map(id => {
        const res = resources.find(r => r.id === id || r.id === String(id));
        return res ? res.name : String(id);
      })
      .join(', ');
  }
  if (field === 'dependencies') {
    const list = Array.isArray(value) ? value : [value];
    return list.length ? list.map(depToString).join(', ') : '';
  }
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

/** Calendar-day difference (time of day ignored). */
function daysBetween(start, end) {
  const a = toDate(start);
  const b = toDate(end);
  if (!a || !b) return null;
  const day = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.max(0, Math.round((day(b) - day(a)) / 86400000));
}

/** All meaningful business fields of a task (+ derived duration). */
function businessFields(task) {
  const out = {};
  Object.keys(task || {}).forEach(key => {
    if (key === 'id' || key.charAt(0) === '_' || IGNORED_FIELDS.has(key)) return;
    out[key] = task[key];
  });
  const dur = daysBetween(task && task.start, task && task.end);
  if (dur !== null) out.duration = dur;
  return out;
}

function sortFields(fields) {
  return fields.slice().sort((a, b) => {
    const ia = FIELD_ORDER.indexOf(a);
    const ib = FIELD_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export function fieldLabel(field) {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, c => c.toUpperCase())
    .trim();
}

/**
 * Resolve the full parent chain for a task, top-level parent first.
 * Guards against missing parents and circular references.
 */
export function resolveHierarchy(task, byId) {
  if (!task || !byId) return '';
  const chain = [];
  const seen = new Set([task.id]);
  let cursor = task;
  let guard = 0;
  while (cursor && cursor.parentId !== undefined && cursor.parentId !== null && cursor.parentId !== '') {
    if (guard++ > 100) break; // safety net
    const pid = cursor.parentId;
    if (seen.has(pid)) break; // circular reference
    seen.add(pid);
    const parent = byId.get(pid) || byId.get(String(pid)) || byId.get(Number(pid));
    if (!parent) break; // missing parent
    chain.unshift(parent.name != null ? String(parent.name) : String(pid));
    cursor = parent;
  }
  return chain.join(' --> ');
}

/**
 * Classify tasks into new / modified / deleted buckets by stable id.
 *
 * @param {Array} initialTasks baseline snapshot
 * @param {Array} currentTasks current tasks
 * @param {Array} [resources=[]] resource definitions for name lookups
 * @returns {{ columns: string[], newTasks: Array, modifiedTasks: Array, deletedTasks: Array }}
 */
export function getGanttCrudChanges(initialTasks, currentTasks, resources = []) {
  const initial = Array.isArray(initialTasks) ? initialTasks : [];
  const current = Array.isArray(currentTasks) ? currentTasks : [];

  const initialById = new Map();
  initial.forEach(t => { if (t && t.id !== undefined) initialById.set(t.id, t); });
  const currentById = new Map();
  current.forEach(t => { if (t && t.id !== undefined) currentById.set(t.id, t); });

  const columnSet = new Set();
  const collect = fields => Object.keys(fields).forEach(f => { if (f !== 'name') columnSet.add(f); });

  const newTasks = [];
  const modifiedTasks = [];
  const deletedTasks = [];

  const buildRow = (task, before, options) => {
    const nowFields = businessFields(task);
    const prevFields = before ? businessFields(before) : {};
    const allFields = sortFields([...new Set(Object.keys(prevFields).concat(Object.keys(nowFields)))]);

    const values = {};
    const changed = new Set();
    let anyChanged = false;

    allFields.forEach(field => {
      const currentValue = nowFields[field];
      values[field] = displayField(field, currentValue, resources);
      if (!before) {
        if (normalizeValue(field, currentValue) !== '') changed.add(field);
        return;
      }
      if (normalizeValue(field, prevFields[field]) !== normalizeValue(field, currentValue)) {
        changed.add(field);
        anyChanged = true;
      }
    });

    return {
      row: {
        id: task.id,
        name: task.name,
        values,
        changed,
        kind: options.kind,
        hierarchy: resolveHierarchy(task, currentById),
      },
      fields: nowFields,
      anyChanged,
    };
  };

  current.forEach(task => {
    if (!task || task.id === undefined) return;
    const before = initialById.get(task.id);
    if (!before) {
      const built = buildRow(task, null, { kind: 'new' });
      collect(built.fields);
      newTasks.push(built.row);
      return;
    }
    const built = buildRow(task, before, { kind: 'modified' });
    if (built.anyChanged) {
      collect(built.fields);
      modifiedTasks.push(built.row);
    }
  });

  initial.forEach(task => {
    if (!task || task.id === undefined) return;
    if (currentById.has(task.id)) return;
    const fields = businessFields(task);
    const values = {};
    Object.keys(fields).forEach(f => { values[f] = displayField(f, fields[f], resources); });
    collect(fields);
    deletedTasks.push({
      id: task.id,
      name: task.name,
      values,
      changed: new Set(),
      kind: 'deleted',
      hierarchy: resolveHierarchy(task, initialById),
    });
  });

  return { columns: sortFields([...columnSet]), newTasks, modifiedTasks, deletedTasks };
}
