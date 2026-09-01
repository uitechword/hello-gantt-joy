import { Plus, Trash2, IndentIncrease, IndentDecrease, ChevronDown, ChevronUp, Search, Users, CalendarDays, Sparkles } from 'lucide-react';
import { WorkCalendarConfig } from '@/lib/work-calendar';

interface GanttToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onAddTask: () => void;
  onDeleteTask: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onToggleResources: () => void;
  showResources: boolean;
  hasSelection: boolean;
  showCriticalPath: boolean;
  onToggleCriticalPath: (on: boolean) => void;
  workCalendar: WorkCalendarConfig;
  onCalendarChange: (update: Partial<WorkCalendarConfig>) => void;
  onOpenHolidays: () => void;
  onOpenAIPlanner: () => void;
}

export function GanttToolbar({
  searchQuery, onSearchChange, onAddTask, onDeleteTask,
  onIndent, onOutdent, onExpandAll, onCollapseAll,
  onToggleResources, showResources, hasSelection,
  showCriticalPath, onToggleCriticalPath,
  workCalendar, onCalendarChange, onOpenHolidays, onOpenAIPlanner,
}: GanttToolbarProps) {
  return (
    <div className="toolbar">
      <button className="btn btn-ghost btn-sm" onClick={onAddTask}>
        <Plus /> Add Task
      </button>
      <button className="btn btn-ghost btn-sm" onClick={onDeleteTask} disabled={!hasSelection}>
        <Trash2 /> Delete
      </button>

      <div className="toolbar-divider" />

      <button className="btn btn-ghost btn-icon btn-sm" onClick={onIndent} disabled={!hasSelection} title="Indent">
        <IndentIncrease />
      </button>
      <button className="btn btn-ghost btn-icon btn-sm" onClick={onOutdent} disabled={!hasSelection} title="Outdent">
        <IndentDecrease />
      </button>

      <div className="toolbar-divider" />

      <button className="btn btn-ghost btn-icon btn-sm" onClick={onExpandAll} title="Expand All">
        <ChevronDown />
      </button>
      <button className="btn btn-ghost btn-icon btn-sm" onClick={onCollapseAll} title="Collapse All">
        <ChevronUp />
      </button>

      <div className="toolbar-divider" />

      <div className="toolbar-switch-group">
        <label className="switch">
          <input
            type="checkbox"
            checked={showCriticalPath}
            onChange={e => onToggleCriticalPath(e.target.checked)}
          />
          <span className="switch-slider" />
        </label>
        <span className="toolbar-label">Critical Path</span>
      </div>

      <div className="toolbar-divider" />

      {/* Weekend exclusion controls */}
      <div className="toolbar-switch-group">
        <label className="switch">
          <input
            type="checkbox"
            checked={workCalendar.excludeSaturday}
            onChange={e => onCalendarChange({ excludeSaturday: e.target.checked })}
          />
          <span className="switch-slider" />
        </label>
        <span className="toolbar-label">Excl. Sat</span>
      </div>

      <div className="toolbar-switch-group">
        <label className="switch">
          <input
            type="checkbox"
            checked={workCalendar.excludeSunday}
            onChange={e => onCalendarChange({ excludeSunday: e.target.checked })}
          />
          <span className="switch-slider" />
        </label>
        <span className="toolbar-label">Excl. Sun</span>
      </div>

      <button className="btn btn-ghost btn-sm" onClick={onOpenHolidays} title="Manage Holidays">
        <CalendarDays size={16} /> Holidays{workCalendar.holidays.length > 0 && ` (${workCalendar.holidays.length})`}
      </button>

      <div className="toolbar-spacer" />

      <button className="btn btn-sm ai-toolbar-btn" onClick={onOpenAIPlanner}>
        <Sparkles size={14} /> Generate with AI
      </button>

      <button
        className={`btn btn-sm ${showResources ? 'btn-primary' : 'btn-ghost'}`}
        onClick={onToggleResources}
      >
        <Users /> Resources
      </button>

      <div className="toolbar-search-wrapper">
        <Search className="toolbar-search-icon" />
        <input
          className="input toolbar-search-input"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>
    </div>
  );
}
