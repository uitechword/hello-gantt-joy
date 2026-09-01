import { useRef, useState } from 'react';
import './ganttChangeReview.css';
import ViewMyChangesModal from './ViewMyChangesModal';
import CompareJsonModal from './CompareJsonModal';

/**
 * Read-only change-review actions.
 * Captures the first non-empty tasks array as the immutable baseline snapshot.
 */
export default function GanttChangeActions({ tasks }) {
  const initialRef = useRef(null);
  if (initialRef.current === null && tasks && tasks.length > 0) {
    // Deep snapshot so later Gantt edits can never mutate the baseline.
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

  const [openChanges, setOpenChanges] = useState(false);
  const [openJson, setOpenJson] = useState(false);

  return (
    <div className="gcr-actions">
      <button className="gcr-btn gcr-btn-primary" onClick={() => setOpenChanges(true)}>
        View My Changes
      </button>
      <button className="gcr-btn" onClick={() => setOpenJson(true)}>
        Compare Gantt JSON
      </button>

      {openChanges && (
        <ViewMyChangesModal
          initialTasks={initialTasks}
          currentTasks={tasks}
          onClose={() => setOpenChanges(false)}
        />
      )}
      {openJson && (
        <CompareJsonModal
          initialTasks={initialTasks}
          currentTasks={tasks}
          onClose={() => setOpenJson(false)}
        />
      )}
    </div>
  );
}
