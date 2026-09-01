import { fieldLabel } from './getGanttCrudChanges';

/** Read-only table rendering full task rows for one CRUD bucket. */
export default function GanttCrudTable({ columns, rows, mode, emptyText }) {
  if (!rows.length) {
    return <div className="gcv-empty">{emptyText}</div>;
  }

  return (
    <div className="gcv-table-wrap">
      <table className="gcv-table">
        <thead>
          <tr>
            <th>Task ID</th>
            <th>Task Name</th>
            {columns.map(col => <th key={col}>{fieldLabel(col)}</th>)}
            <th>Parent Hierarchy</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className={mode === 'deleted' ? 'gcv-row-deleted' : ''}>
              <td className="gcv-id">{row.id}</td>
              <td className={mode === 'modified' && row.changed.has('name') ? 'gcv-changed' : ''}>
                {row.name || <span className="gcv-empty-cell">—</span>}
              </td>
              {columns.map(col => {
                const isChanged = mode === 'modified' && row.changed.has(col);
                const value = row.values[col];
                return (
                  <td key={col} className={isChanged ? 'gcv-changed' : ''}>
                    {value ? value : <span className="gcv-empty-cell">—</span>}
                  </td>
                );
              })}
              <td className={mode === 'modified' && row.changed.has('parentId') ? 'gcv-changed' : ''}>
                {row.hierarchy ? row.hierarchy : <span className="gcv-empty-cell">-</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
