import { getModifiedGanttData, fieldLabel } from './getModifiedGanttData';
import './ganttModifiedChanges.css';

/** Read-only modal showing the full current row for each modified/new task,
 *  with only the actually-changed cells highlighted. */
export default function GanttModifiedChangesModal({ initialTasks, currentTasks, resources, onClose }) {
  const { columns, rows } = getModifiedGanttData(initialTasks, currentTasks, resources);

  return (
    <div className="gmc-overlay" onClick={onClose}>
      <div className="gmc-modal" onClick={e => e.stopPropagation()}>
        <div className="gmc-head">
          <h3 className="gmc-title">
            Modified Changes
            {rows.length > 0 && <span className="gmc-count">{rows.length} task(s)</span>}
          </h3>
          <button className="gmc-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {rows.length === 0 ? (
          <div className="gmc-empty">No modified changes found.</div>
        ) : (
          <div className="gmc-body">
            <table className="gmc-table">
              <thead>
                <tr>
                  <th>Task ID</th>
                  <th>Task Name</th>
                  {columns.map(col => <th key={col}>{fieldLabel(col)}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <td className="gmc-id">
                      {row.id}
                      {row.isNew && <span className="gmc-new-tag">NEW</span>}
                    </td>
                    <td className={row.changed.has('name') ? 'gmc-changed' : ''}>
                      {row.name ?? <span className="gmc-empty-cell">—</span>}
                    </td>
                    {columns.map(col => {
                      const isChanged = row.changed.has(col);
                      return (
                        <td key={col} className={isChanged ? 'gmc-changed' : ''}>
                          {isChanged && row.values[col] !== undefined
                            ? row.values[col]
                            : <span className="gmc-empty-cell">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
