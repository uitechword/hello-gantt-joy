import { Fragment } from 'react';
import { computeTaskChanges, sortFields, FIELD_LABELS } from './compareGanttData';

const STATUS_LABEL = { added: 'Added', removed: 'Removed', modified: 'Modified' };

export default function ViewMyChangesModal({ initialTasks, currentTasks, onClose }) {
  const changes = computeTaskChanges(initialTasks, currentTasks);

  // Columns are data driven: every field that changed (plus name for context).
  const fields = new Set(['name']);
  changes.forEach(task => {
    task.changedFields.forEach(f => fields.add(f));
    if (task.status !== 'modified') {
      Object.keys(task.before).forEach(f => fields.add(f));
      Object.keys(task.after).forEach(f => fields.add(f));
    }
  });
  const columns = sortFields(Array.from(fields));

  return (
    <div className="gcr-overlay" onMouseDown={onClose}>
      <div className="gcr-modal gcr-modal-summary" onMouseDown={e => e.stopPropagation()}>
        <div className="gcr-modal-header">
          <div>
            <h2 className="gcr-modal-title">Gantt Changes</h2>
            <div className="gcr-modal-sub">
              {changes.length === 0
                ? 'Comparing the current plan with the original plan'
                : `${changes.length} task${changes.length === 1 ? '' : 's'} changed since the plan was loaded`}
            </div>
          </div>
          <button className="gcr-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="gcr-modal-body gcr-summary-body">
          {changes.length === 0 ? (
            <div className="gcr-empty">No changes have been made to the Gantt plan.</div>
          ) : (
            <div className="gcr-table-wrap">
              <table className="gcr-summary-table">
                <thead>
                  <tr>
                    <th className="gcr-col-task">Task ID</th>
                    <th className="gcr-col-type">Type</th>
                    {columns.map(f => <th key={f}>{FIELD_LABELS[f] ?? f}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {changes.map(task => (
                    <Fragment key={task.id}>
                      <tr className="gcr-row-old">
                        <td className="gcr-cell-task" rowSpan={2}>
                          <span className="gcr-task-id">{task.id}</span>
                          <span className={`gcr-task-status gcr-status-${task.status}`}>
                            {STATUS_LABEL[task.status]}
                          </span>
                        </td>
                        <td className="gcr-cell-type">Existing</td>
                        {columns.map(f => (
                          <td key={f} className={`gcr-cell-value ${task.changedFields.has(f) ? 'gcr-changed' : ''}`}>
                            {task.status === 'added' ? '—' : task.before[f] ?? '—'}
                          </td>
                        ))}
                      </tr>
                      <tr className="gcr-row-new">
                        <td className="gcr-cell-type">Modified</td>
                        {columns.map(f => (
                          <td key={f} className={`gcr-cell-value ${task.changedFields.has(f) ? 'gcr-changed' : ''}`}>
                            {task.status === 'removed' ? '—' : task.after[f] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
