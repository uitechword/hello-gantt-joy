import { useMemo, useState } from 'react';
import GanttCrudTabs from './GanttCrudTabs';
import GanttCrudTable from './GanttCrudTable';
import { getGanttCrudChanges } from './getGanttCrudChanges';
import './ganttCrudView.css';

/** Standalone read-only page showing New / Modified / Deleted Gantt tasks. */
export default function GanttCrudPage({ initialTasks, currentTasks, resources, onClose }) {
  const [active, setActive] = useState('new');

  const { columns, newTasks, modifiedTasks, deletedTasks } = useMemo(
    () => getGanttCrudChanges(initialTasks, currentTasks, resources),
    [initialTasks, currentTasks, resources]
  );

  const rows = active === 'new' ? newTasks : active === 'modified' ? modifiedTasks : deletedTasks;
  const emptyText =
    active === 'new' ? 'No new tasks found.'
      : active === 'modified' ? 'No modified tasks found.'
        : 'No deleted tasks found.';

  return (
    <div className="gcv-page">
      <div className="gcv-page-head">
        <h2 className="gcv-page-title">Gantt CRUD Changes</h2>
        <button className="gcv-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      <GanttCrudTabs
        active={active}
        onChange={setActive}
        counts={{ new: newTasks.length, modified: modifiedTasks.length, deleted: deletedTasks.length }}
      />

      <div className="gcv-page-body">
        <GanttCrudTable columns={columns} rows={rows} mode={active} emptyText={emptyText} />
      </div>
    </div>
  );
}
