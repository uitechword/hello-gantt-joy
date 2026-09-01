// Read-only comparison helpers for the Gantt Change Review feature.
// Plain JavaScript, no dependencies.

/** UI-only / derived properties that are never business data. */
const IGNORED_FIELDS = new Set([
  'expanded', 'hasChildren', 'visible', 'selected', 'index', 'styles',
  'isDisabled', 'hideChildren', 'displayOrder', 'barChildren',
  'x1', 'x2', 'y', 'height', 'width',
  'earlyStart', 'earlyFinish', 'lateStart', 'lateFinish', 'slack', 'isCritical',
]);

export const FIELD_LABELS = {
  name: 'Task Name',
  type: 'Type',
  start: 'Start Date',
  end: 'End Date',
  duration: 'Duration',
  dependencies: 'Dependency',
  progress: 'Progress',
  resources: 'Resources',
  parentId: 'Parent',
  level: 'Level',
  milestone: 'Milestone',
};

const FIELD_ORDER = [
  'name', 'type', 'start', 'end', 'duration', 'dependencies',
  'progress', 'resources', 'parentId', 'level', 'milestone',
];

function toDate(value) {
  const d = value instanceof Date ? value : new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

function toISODate(value) {
  const d = toDate(value);
  if (!d) return String(value ?? '');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prettyDate(value) {
  const d = toDate(value);
  if (!d) return String(value ?? '');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isDateField(field, value) {
  return field === 'start' || field === 'end' || value instanceof Date;
}

function depToString(dep) {
  if (dep && typeof dep === 'object') {
    if ('predecessorId' in dep) {
      const lag = Number(dep.lag ?? 0);
      const lagStr = lag > 0 ? `+${lag}d` : lag < 0 ? `${lag}d` : '';
      return `${dep.predecessorId}${dep.type ?? 'FS'}${lagStr}`;
    }
    return JSON.stringify(dep);
  }
  return String(dep ?? '');
}

/** Order-insensitive normalization used for change detection. */
function normalizeValue(field, value) {
  if (value === null || value === undefined || value === '') return '';
  if (isDateField(field, value)) return toISODate(value);
  if (Array.isArray(value)) {
    return value.map(depToString).slice().sort().join('|');
  }
  if (typeof value === 'object') {
    return Object.keys(value).sort().map(k => `${k}=${normalizeValue(k, value[k])}`).join('|');
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value).trim();
}

/** Human readable cell value. */
function displayField(field, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (isDateField(field, value)) return prettyDate(value);
  if (field === 'progress') return `${value}%`;
  if (field === 'duration') return `${value} d`;
  if (Array.isArray(value)) return value.length ? value.map(depToString).join(', ') : '—';
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

/** Business fields of a task (all meaningful keys + derived duration). */
function businessFields(task) {
  const out = {};
  Object.keys(task).forEach(key => {
    if (key === 'id' || key.startsWith('_') || IGNORED_FIELDS.has(key)) return;
    out[key] = task[key];
  });
  const dur = daysBetween(task.start, task.end);
  if (dur !== null) out.duration = dur;
  return out;
}

function displayRecord(fields) {
  const out = {};
  Object.keys(fields).forEach(k => { out[k] = displayField(k, fields[k]); });
  return out;
}

export function sortFields(fields) {
  return fields.slice().sort((a, b) => {
    const ia = FIELD_ORDER.indexOf(a);
    const ib = FIELD_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

/**
 * Compare initial vs current tasks by id.
 * Returns [{ id, status, changedFields:Set, before, after }]
 */
export function computeTaskChanges(initial, current) {
  const initialMap = new Map(initial.map(t => [t.id, t]));
  const currentMap = new Map(current.map(t => [t.id, t]));
  const result = [];

  current.forEach(cur => {
    const curFields = businessFields(cur);
    const prev = initialMap.get(cur.id);
    if (!prev) {
      result.push({ id: cur.id, status: 'added', changedFields: new Set(), before: {}, after: displayRecord(curFields) });
      return;
    }
    const prevFields = businessFields(prev);
    const keys = new Set([...Object.keys(prevFields), ...Object.keys(curFields)]);
    const changedFields = new Set();
    keys.forEach(key => {
      if (normalizeValue(key, prevFields[key]) !== normalizeValue(key, curFields[key])) changedFields.add(key);
    });
    if (changedFields.size) {
      result.push({
        id: cur.id,
        status: 'modified',
        changedFields,
        before: displayRecord(prevFields),
        after: displayRecord(curFields),
      });
    }
  });

  initial.forEach(prev => {
    if (!currentMap.has(prev.id)) {
      result.push({
        id: prev.id,
        status: 'removed',
        changedFields: new Set(),
        before: displayRecord(businessFields(prev)),
        after: {},
      });
    }
  });

  return result;
}

/** Stable, JSON-friendly text of the tasks (dates as YYYY-MM-DD, keys sorted). */
export function toJSONText(tasks) {
  const plain = tasks.map(task => {
    const out = {};
    Object.keys(task).sort().forEach(key => {
      const v = task[key];
      out[key] = v instanceof Date ? toISODate(v) : v;
    });
    return out;
  });
  return JSON.stringify(plain, null, 2);
}

/** Simple LCS line diff — no external dependency. */
export function diffLines(leftText, rightText) {
  const a = leftText.split('\n');
  const b = rightText.split('\n');
  const n = a.length;
  const m = b.length;

  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows = [];
  const pendingLeft = [];
  const pendingRight = [];
  const flush = () => {
    const len = Math.max(pendingLeft.length, pendingRight.length);
    for (let k = 0; k < len; k++) {
      rows.push({
        left: pendingLeft[k],
        right: pendingRight[k],
        leftKind: pendingLeft[k] ? 'removed' : 'empty',
        rightKind: pendingRight[k] ? 'added' : 'empty',
      });
    }
    pendingLeft.length = 0;
    pendingRight.length = 0;
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      flush();
      rows.push({
        left: { num: i + 1, text: a[i] },
        right: { num: j + 1, text: b[j] },
        leftKind: 'same',
        rightKind: 'same',
      });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      pendingLeft.push({ num: i + 1, text: a[i] }); i++;
    } else {
      pendingRight.push({ num: j + 1, text: b[j] }); j++;
    }
  }
  while (i < n) { pendingLeft.push({ num: i + 1, text: a[i] }); i++; }
  while (j < m) { pendingRight.push({ num: j + 1, text: b[j] }); j++; }
  flush();

  return rows;
}
