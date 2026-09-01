import { useRef, useState } from 'react';
import GanttCrudPage from './GanttCrudPage';
import './ganttCrudView.css';

function cloneTasks(tasks) {
  return tasks.map(task => {
    const copy = {};
    Object.keys(task).forEach(key => {
      const v = task[key];
      if (v instanceof Date) copy[key] = new Date(v.getTime());
      else if (v && typeof v === 'object') copy[key] = JSON.parse(JSON.stringify(v));
      else copy[key] = v;
    });
    return copy;
  });
}

/**
 * Read-only button that captures the first non-empty tasks array as an
 * immutable baseline and opens the CRUD changes page.
 */
export default function GanttCrudButton({ tasks, resources }) {
  const initialRef = useRef(null);
  if (initialRef.current === null && tasks && tasks.length > 0) {
    initialRef.current = cloneTasks(tasks);
  }
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="gcv-btn" onClick={() => setOpen(true)}>
        By CRUD
      </button>
      {open && (
        <GanttCrudPage
          initialTasks={initialRef.current || []}
          currentTasks={tasks || []}
          resources={resources || []}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
