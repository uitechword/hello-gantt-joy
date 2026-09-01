import { useState, useRef } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { FlatTask, Resource, formatDate, getDuration, dependencyToString, toDateString } from '@/lib/gantt-types';
import { CPMResult } from '@/lib/gantt-cpm';
import { ResourceSelect } from './ResourceSelect';
import { ProgressEditor } from './ProgressEditor';
import { DurationEditor } from './DurationEditor';

interface TreeGridProps {
  tasks: FlatTask[];
  resources: Resource[];
  selectedTaskIds: Set<number>;
  onSelectTask: (id: number, ctrlKey: boolean, shiftKey: boolean) => void;
  onToggleExpand: (id: number) => void;
  onUpdateTask: (id: number, field: string, value: any) => void;
  onUpdateResources: (id: number, resourceIds: string[]) => void;
  cpmResults: Map<number, CPMResult>;
  showCriticalPath: boolean;
  highlightTaskId: number | null;
  rowHeight: number;
}

export function TreeGrid({ tasks, resources, selectedTaskIds, onSelectTask, onToggleExpand, onUpdateTask, onUpdateResources, cpmResults, showCriticalPath, highlightTaskId, rowHeight }: TreeGridProps) {
  const [editingCell, setEditingCell] = useState<{ id: number; field: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const visibleTasks = tasks.filter(t => t.visible);

  const columns = [
    { key: 'id', label: 'ID', width: 45 },
    { key: 'name', label: 'Task Name', width: 200 },
    { key: 'start', label: 'Start Date', width: 110 },
    { key: 'end', label: 'End Date', width: 110 },
    { key: 'duration', label: 'Duration', width: 72 },
    { key: 'progress', label: 'Progress', width: 72 },
    { key: 'resources', label: 'Resources', width: 120 },
    { key: 'predecessors', label: 'Predecessors', width: 110 },
  ];

  const totalWidth = columns.reduce((s, c) => s + c.width, 0);

  function startEdit(id: number, field: string) {
    const task = visibleTasks.find(t => t.id === id);
    if (!task || task.hasChildren && ['start', 'end', 'duration'].includes(field)) return;
    setEditingCell({ id, field });
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commitEdit(value: string) {
    if (!editingCell) return;
    const { id, field } = editingCell;
    onUpdateTask(id, field, value);
    setEditingCell(null);
  }

  function getCellValue(task: FlatTask, key: string): string {
    switch (key) {
      case 'id': return String(task.id);
      case 'name': return task.name;
      case 'start': return toDateString(task.start);
      case 'end': return toDateString(task.end);
      case 'duration': return `${getDuration(task.start, task.end)}d`;
      case 'progress': return `${task.progress}%`;
      case 'resources': return task.resources.map(rid => resources.find(r => r.id === rid)?.name || rid).join(', ');
      case 'predecessors': return dependencyToString(task.dependencies);
      default: return '';
    }
  }

  function getDisplayValue(task: FlatTask, key: string): string {
    switch (key) {
      case 'start': return formatDate(task.start);
      case 'end': return formatDate(task.end);
      default: return getCellValue(task, key);
    }
  }

  const editableFields = ['name', 'start', 'end', 'predecessors'];

  return (
    <div className="treegrid gantt-scrollbar">
      {/* Header */}
      <div className="treegrid-sticky-header" style={{ minWidth: totalWidth }}>
        <div className="treegrid-header-top" style={{ minWidth: totalWidth }}>
          <div
            className="treegrid-header-top-cell"
            style={{ width: totalWidth, height: rowHeight }}
          >
            Task Details
          </div>
        </div>
        <div className="treegrid-header-bottom" style={{ minWidth: totalWidth }}>
          {columns.map(col => (
            <div
              key={col.key}
              className="treegrid-header-col"
              style={{ width: col.width, height: rowHeight }}
            >
              {col.label}
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      {visibleTasks.map(task => {
        const cpm = cpmResults.get(task.id);
        const isCritical = showCriticalPath && (cpm?.isCritical ?? false);
        const isHighlighted = highlightTaskId === task.id;
        const isSelected = selectedTaskIds.has(task.id);

        let rowClass = 'treegrid-row';
        if (isHighlighted) rowClass += ' highlighted';
        else if (isSelected) rowClass += ' selected';
        else if (isCritical) rowClass += ' critical';

        return (
          <div
            key={task.id}
            data-task-id={task.id}
            className={rowClass}
            style={{ minWidth: totalWidth, height: rowHeight, minHeight: rowHeight, maxHeight: rowHeight, boxSizing: 'border-box' }}
            onClick={(e) => onSelectTask(task.id, e.ctrlKey || e.metaKey, e.shiftKey)}
            onContextMenu={e => { e.preventDefault(); onSelectTask(task.id, e.ctrlKey || e.metaKey, e.shiftKey); }}
          >
            {columns.map(col => {
              const isEditing = editingCell?.id === task.id && editingCell?.field === col.key;

              return (
                <div
                  key={col.key}
                  className="treegrid-cell"
                  style={{ width: col.width }}
                  onDoubleClick={() => editableFields.includes(col.key) && startEdit(task.id, col.key)}
                >
                  {col.key === 'name' ? (
                    <div className="treegrid-name-content" style={{ paddingLeft: task.level * 16 }}>
                      {task.hasChildren ? (
                        <button
                          onClick={e => { e.stopPropagation(); onToggleExpand(task.id); }}
                          className="treegrid-expand-btn"
                        >
                          {task.expanded ? <ChevronDown /> : <ChevronRight />}
                        </button>
                      ) : (
                        <span className="treegrid-indent-spacer" />
                      )}
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          defaultValue={getCellValue(task, col.key)}
                          onBlur={e => commitEdit(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') commitEdit((e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditingCell(null); }}
                          className="treegrid-inline-input"
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span className={`treegrid-name${task.hasChildren ? ' parent' : ''}${isCritical ? ' critical' : ''}`}>
                          {task.name}
                        </span>
                      )}
                    </div>
                  ) : col.key === 'duration' ? (
                    <DurationEditor
                      duration={getDuration(task.start, task.end)}
                      disabled={task.hasChildren}
                      onChange={(v) => onUpdateTask(task.id, 'duration', String(v))}
                    />
                  ) : col.key === 'progress' ? (
                    <ProgressEditor
                      progress={task.progress}
                      onChange={(v) => onUpdateTask(task.id, 'progress', String(v))}
                    />
                  ) : col.key === 'resources' ? (
                    <ResourceSelect
                      resources={resources}
                      selected={task.resources}
                      onChange={(ids) => onUpdateResources(task.id, ids)}
                    />
                  ) : isEditing ? (
                    <input
                      ref={inputRef}
                      defaultValue={getCellValue(task, col.key)}
                      type={['start', 'end'].includes(col.key) ? 'date' : 'text'}
                      onBlur={e => commitEdit(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit((e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditingCell(null); }}
                      className="treegrid-inline-input"
                      style={{ width: '100%' }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className={`treegrid-cell-text${col.key === 'id' ? ' treegrid-cell-id' : ''}`}>
                      {getDisplayValue(task, col.key)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
