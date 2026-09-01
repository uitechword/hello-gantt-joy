import { useRef, useState } from 'react';
import GanttModifiedChangesModal from './GanttModifiedChangesModal';
import './ganttModifiedChanges.css';

/**
 * Read-only button that captures the first non-empty tasks array as an
 * immutable baseline and shows only the current modified values.
 */
export default function GanttModifiedChangesButton({ tasks, resources }) {
  const initialRef = useRef(null);
  if (initialRef.current === null && tasks && tasks.length > 0) {
    initialRef.current = tasks.map(task => {
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
  const initialTasks = initialRef.current || [];
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="gmc-btn" onClick={() => setOpen(true)}>
        View Only Modified Changes
      </button>
      {open && (
        <GanttModifiedChangesModal
          initialTasks={initialTasks}
          currentTasks={tasks}
          resources={resources}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
