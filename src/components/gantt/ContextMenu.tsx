import { useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onDelete: () => void;
  onSetProgress: (progress: number) => void;
  onAddParallel: () => void;
  onAddSubtask: () => void;
}

export function GanttContextMenu({ x, y, onClose, onDelete, onSetProgress, onAddParallel, onAddSubtask }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items = [
    { label: 'Add Parallel Task', action: onAddParallel },
    { label: 'Add Sub-task', action: onAddSubtask },
    { label: '—', action: () => {} },
    { label: 'Set Progress: 0%', action: () => onSetProgress(0) },
    { label: 'Set Progress: 50%', action: () => onSetProgress(50) },
    { label: 'Set Progress: 100%', action: () => onSetProgress(100) },
    { label: '—', action: () => {} },
    { label: 'Delete Task', action: onDelete, destructive: true },
  ];

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) =>
        item.label === '—' ? (
          <div key={i} className="context-menu-separator" />
        ) : (
          <button
            key={i}
            className={`context-menu-item${item.destructive ? ' destructive' : ''}`}
            onClick={() => { item.action(); onClose(); }}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  );
}
