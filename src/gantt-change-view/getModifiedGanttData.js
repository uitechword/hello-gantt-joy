// Read-only helpers: compute the CURRENT values of changed/new tasks,
// including a flag for each field that actually changed.
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

/** Human readable current value. */
export function displayField(field, value, resources = []) {
  if (value === null || value === undefined || value === '') return '—';
  if (isDateField(field, value)) return prettyDate(value);
  if (field === 'progress') return `${value}%`;
  if (field === 'duration') return `${value} d`;
  if (field === 'resources' || field === 'assignee') {
    const list = Array.isArray(value) ? value : [value];
    if (!list.length) return '—';
    return list
      .map(id => {
        const res = resources.find(r => r.id === id || r.id === String(id));
        return res ? res.name : String(id);
      })
      .join(', ');
  }
  if (field === 'dependencies') {
    const list = Array.isArray(value) ? value : [value];
    return list.length ? list.map(depToString).join(', ') : '—';
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
 * Compare baseline vs current tasks by stable id and return the full current
 * row for every changed/new task. Deleted tasks are intentionally excluded.
 *
 * @param {Array} initialTasks - baseline task snapshot
 * @param {Array} currentTasks - current task list
 * @param {Array} [resources=[]] - resource definitions for name lookups
 * @returns {{ columns: string[], rows: Array }}
 */
export function getModifiedGanttData(initialTasks, currentTasks, resources = []) {
  const initial = Array.isArray(initialTasks) ? initialTasks : [];
  const current = Array.isArray(currentTasks) ? currentTasks : [];

  const initialById = new Map();
  initial.forEach(t => { if (t && t.id !== undefined) initialById.set(t.id, t); });

  const rows = [];
  const columnSet = new Set();

  current.forEach(task => {
    if (!task || task.id === undefined) return;
    const before = initialById.get(task.id);
    const nowFields = businessFields(task);

    const allFields = before
      ? sortFields([...new Set(Object.keys(businessFields(before)).concat(Object.keys(nowFields)))])
      : sortFields(Object.keys(nowFields));

    const values = {};
    const changed = new Set();
    let anyChanged = false;

    allFields.forEach(field => {
      const currentValue = nowFields[field];
      values[field] = displayField(field, currentValue, resources);

      if (!before) {
        if (normalizeValue(field, currentValue) !== '') {
          changed.add(field);
        }
        return;
      }

      const prevValue = businessFields(before)[field];
      if (normalizeValue(field, prevValue) !== normalizeValue(field, currentValue)) {
        changed.add(field);
        anyChanged = true;
      }
    });

    // Dynamic columns: only fields actually modified by at least one row.
    // Task Name is always rendered as its own mandatory column.
    changed.forEach(field => {
      if (field !== 'name') columnSet.add(field);
    });

    if (!before || anyChanged) {
      rows.push({ id: task.id, isNew: !before, name: task.name, values, changed });
    }
  });

  return { columns: sortFields([...columnSet]), rows };
}
