import { useRef, useState, useCallback, useEffect } from 'react';
import { FlatTask, Resource, Dependency, addDays, getDuration, formatDate } from '@/lib/gantt-types';
import { CPMResult } from '@/lib/gantt-cpm';
import { WorkCalendarConfig, defaultWorkCalendar, isNonWorkingDay, getHolidayName } from '@/lib/work-calendar';

interface TimelineChartProps {
  tasks: FlatTask[];
  resources: Resource[];
  selectedTaskIds: Set<number>;
  onSelectTask: (id: number | null) => void;
  onMoveTask: (id: number, newStart: Date) => void;
  onResizeTask: (id: number, newEnd: Date) => void;
  onContextMenu: (e: React.MouseEvent, taskId: number) => void;
  cpmResults: Map<number, CPMResult>;
  showCriticalPath: boolean;
  rowHeight: number;
  dayWidth: number;
  workCalendar?: WorkCalendarConfig;
}

export function TimelineChart({
  tasks, resources, selectedTaskIds, onSelectTask,
  onMoveTask, onResizeTask, onContextMenu, cpmResults, showCriticalPath, rowHeight, dayWidth,
  workCalendar = defaultWorkCalendar,
}: TimelineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ taskId: number; mode: 'move' | 'resize'; startX: number; origStart: Date; origEnd: Date } | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; task: FlatTask; kind: 'planned' | 'baseline' | 'actual' } | null>(null);

  const visibleTasks = tasks.filter(t => t.visible);

  const isValidDate = (d: Date | null | undefined): d is Date => d instanceof Date && !isNaN(d.getTime());

  const allDates = visibleTasks.flatMap(t =>
    [t.start, t.end, t.baselineStart, t.baselineEnd, t.actualStart, t.actualEnd].filter(isValidDate)
  );
  if (allDates.length === 0) return <div className="timeline-container" />;

  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
  const startDate = addDays(minDate, -3);
  const endDate = addDays(maxDate, 7);
  const totalDays = getDuration(startDate, endDate);
  const totalWidth = totalDays * dayWidth;
  const totalHeight = visibleTasks.length * rowHeight;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayX = getDuration(startDate, today) * dayWidth;

  function dateToX(date: Date): number {
    return getDuration(startDate, date) * dayWidth;
  }

  const days: { date: Date; x: number }[] = [];
  for (let i = 0; i < totalDays; i++) {
    days.push({ date: addDays(startDate, i), x: i * dayWidth });
  }

  const months: { label: string; x: number; width: number }[] = [];
  let currentMonth = -1;
  let monthStart = 0;
  for (let i = 0; i <= totalDays; i++) {
    const d = addDays(startDate, i);
    const m = d.getMonth();
    if (m !== currentMonth) {
      if (currentMonth >= 0) {
        const prevDate = addDays(startDate, i - 1);
        months.push({
          label: prevDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          x: monthStart * dayWidth,
          width: (i - monthStart) * dayWidth,
        });
      }
      currentMonth = m;
      monthStart = i;
    }
  }
  if (currentMonth >= 0) {
    const lastDate = addDays(startDate, totalDays - 1);
    months.push({
      label: lastDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      x: monthStart * dayWidth,
      width: (totalDays - monthStart) * dayWidth,
    });
  }

  const handleMouseDown = useCallback((e: React.MouseEvent, taskId: number, mode: 'move' | 'resize') => {
    e.stopPropagation();
    const task = visibleTasks.find(t => t.id === taskId);
    if (!task || task.hasChildren) return;
    setDragging({ taskId, mode, startX: e.clientX, origStart: task.start, origEnd: task.end });
    onSelectTask(taskId);
  }, [visibleTasks, onSelectTask]);

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragging.startX;
      const dayDelta = Math.round(dx / dayWidth);
      if (dragging.mode === 'move') {
        onMoveTask(dragging.taskId, addDays(dragging.origStart, dayDelta));
      } else {
        const newEnd = addDays(dragging.origEnd, dayDelta);
        if (newEnd > dragging.origStart) onResizeTask(dragging.taskId, newEnd);
      }
    };
    const handleMouseUp = () => setDragging(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, dayWidth, onMoveTask, onResizeTask]);

  function renderDependency(task: FlatTask, dep: Dependency, taskIndex: number) {
    const predIndex = visibleTasks.findIndex(t => t.id === dep.predecessorId);
    if (predIndex === -1) return null;
    const pred = visibleTasks[predIndex];
    const halfRow = rowHeight / 2;
    const fromY = predIndex * rowHeight + halfRow;
    const toY = taskIndex * rowHeight + halfRow;
    const fromEnd = dep.type === 'FS' || dep.type === 'FF';
    const toEnd = dep.type === 'SF' || dep.type === 'FF';
    const fromX = fromEnd ? dateToX(pred.end) : dateToX(pred.start);
    const toX = toEnd ? dateToX(task.end) : dateToX(task.start);
    const margin = 12;
    const exitX = fromEnd ? fromX + margin : fromX - margin;
    const enterX = toEnd ? toX + margin : toX - margin;

    let pathD: string;
    if ((fromEnd && toX >= fromX + margin) || (!fromEnd && toX <= fromX - margin)) {
      pathD = `M${fromX},${fromY} H${exitX} V${toY} H${toX}`;
    } else {
      const routeY = (fromY + toY) / 2;
      pathD = `M${fromX},${fromY} H${exitX} V${routeY} H${enterX} V${toY} H${toX}`;
    }

    const arrowDir = toEnd ? 1 : -1;
    return (
      <g key={`dep-${task.id}-${dep.predecessorId}-${dep.type}`}>
        <path d={pathD} fill="none" stroke="var(--gantt-link)" strokeWidth={1.5} />
        <polygon
          points={`${toX},${toY} ${toX - arrowDir * 6},${toY - 3.5} ${toX - arrowDir * 6},${toY + 3.5}`}
          fill="var(--gantt-link)"
        />
      </g>
    );
  }

  // Read-only tracking bars (baseline/actual). No drag/resize/scheduling handlers.
  const renderTrackingBar = (
    task: FlatTask,
    start: Date | null | undefined,
    end: Date | null | undefined,
    barY: number,
    kind: 'baseline' | 'actual',
  ) => {
    if (!isValidDate(start) || !isValidDate(end) || end < start) return null;
    const bx = dateToX(start);
    const bw = Math.max(dateToX(end) - bx, 6);
    const fill = kind === 'baseline' ? 'var(--gantt-bar-baseline)' : 'var(--gantt-bar-actual)';
    const label = kind === 'baseline' ? 'Baseline' : 'Actual';
    if (start.getTime() === end.getTime()) {
      // Milestone-style compact marker for zero-duration tracking dates
      const cx = bx + 3;
      const cy = barY + 2.5;
      return (
        <polygon
          key={`${kind}-${task.id}`}
          points={`${cx},${cy - 4} ${cx + 4},${cy} ${cx},${cy + 4} ${cx - 4},${cy}`}
          fill={fill}
          style={{ cursor: 'default' }}
          onMouseEnter={e => { if (!dragging) setTooltip({ x: e.clientX, y: e.clientY, task, kind }); }}
          onMouseMove={e => { if (!dragging && tooltip?.task.id === task.id && tooltip.kind === kind) setTooltip({ x: e.clientX, y: e.clientY, task, kind }); }}
          onMouseLeave={() => setTooltip(null)}
        >
          <title>{label}</title>
        </polygon>
      );
    }
    return (
      <rect
        key={`${kind}-${task.id}`}
        x={bx} y={barY} width={bw} height={5} rx={2}
        fill={fill}
        style={{ cursor: 'default' }}
        onMouseEnter={e => { if (!dragging) setTooltip({ x: e.clientX, y: e.clientY, task, kind }); }}
        onMouseMove={e => { if (!dragging && tooltip?.task.id === task.id && tooltip.kind === kind) setTooltip({ x: e.clientX, y: e.clientY, task, kind }); }}
        onMouseLeave={() => setTooltip(null)}
      >
        <title>{label}</title>
      </rect>
    );
  };

  return (
    <div ref={containerRef} className="timeline-container gantt-scrollbar">
      <svg ref={svgRef} width={totalWidth} height={totalHeight + rowHeight * 2} style={{ userSelect: 'none' }}>
        {/* Month header */}
        <g>
          <rect x={0} y={0} width={totalWidth} height={rowHeight} fill="var(--gantt-header)" />
          {months.map((m, i) => (
            <g key={i}>
              <text x={m.x + m.width / 2} y={rowHeight / 2 + 4} textAnchor="middle" className="timeline-month-text">{m.label}</text>
              <line x1={m.x} y1={0} x2={m.x} y2={rowHeight} stroke="var(--gantt-header-fg)" strokeOpacity={0.15} />
            </g>
          ))}
        </g>

        {/* Day header */}
        <g>
          <rect x={0} y={rowHeight} width={totalWidth} height={rowHeight} fill="var(--gantt-header)" fillOpacity={0.85} />
          {days.map((d, i) => {
            const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6;
            const isNonWorking = isNonWorkingDay(d.date, workCalendar);
            const holidayName = getHolidayName(d.date, workCalendar);
            const dayNum = d.date.getDate();
            return (
              <g key={i}>
                {dayWidth >= 20 && (
                  <>
                    <text
                      x={d.x + dayWidth / 2}
                      y={rowHeight + rowHeight / 2 + 4}
                      textAnchor="middle"
                      className={`timeline-day-text${isWeekend ? ' weekend' : ''}${holidayName ? ' holiday' : ''}`}
                    >
                      {dayNum}
                    </text>
                    {holidayName && (
                      <title>{holidayName}</title>
                    )}
                  </>
                )}
              </g>
            );
          })}
        </g>

        {/* Grid */}
        <g transform={`translate(0, ${rowHeight * 2})`}>
          {days.map((d, i) => {
            const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6;
            const isNonWorking = isNonWorkingDay(d.date, workCalendar);
            const holidayName = getHolidayName(d.date, workCalendar);
            return (
              <g key={i}>
                {isNonWorking && (
                  <rect
                    x={d.x} y={0} width={dayWidth} height={totalHeight}
                    fill={holidayName ? 'var(--gantt-holiday)' : 'var(--gantt-weekend)'}
                  >
                    {holidayName && <title>{holidayName}</title>}
                  </rect>
                )}
                <line x1={d.x} y1={0} x2={d.x} y2={totalHeight} stroke="var(--gantt-grid-line)" strokeWidth={0.5} />
              </g>
            );
          })}

          {visibleTasks.map((_, i) => (
            <line key={i} x1={0} y1={(i + 1) * rowHeight} x2={totalWidth} y2={(i + 1) * rowHeight} stroke="var(--gantt-grid-line)" strokeWidth={0.5} />
          ))}

          <line x1={todayX} y1={0} x2={todayX} y2={totalHeight} stroke="var(--gantt-today)" strokeWidth={1.5} strokeDasharray="4 2" />

          {visibleTasks.map((task, idx) =>
            task.dependencies.map(dep => renderDependency(task, dep, idx))
          )}

          {visibleTasks.map((task, idx) => {
            const x = dateToX(task.start);
            const width = Math.max(dateToX(task.end) - x, dayWidth * 0.5);
            const y = idx * rowHeight;
            // Three stacked slots per row: Planned (top, primary), Baseline (middle), Actual (bottom)
            const barHeight = task.hasChildren ? 6 : 12;
            const barY = y + 3;
            const baselineY = y + rowHeight - 14;
            const actualY = y + rowHeight - 7;
            const isSelected = selectedTaskIds.has(task.id);
            const cpm = cpmResults.get(task.id);
            const isCritical = showCriticalPath && (cpm?.isCritical ?? false);

            if (task.hasChildren) {
              return (
                <g key={task.id} onClick={() => onSelectTask(task.id)} style={{ cursor: 'pointer' }}>
                  <rect x={x} y={barY} width={width} height={barHeight} rx={1} fill="var(--gantt-bar-parent)" opacity={0.8} />
                  <rect x={x} y={barY} width={3} height={barHeight + 4} fill="var(--gantt-bar-parent)" />
                  <rect x={x + width - 3} y={barY} width={3} height={barHeight + 4} fill="var(--gantt-bar-parent)" />
                  <rect x={x} y={barY} width={width * (task.progress / 100)} height={barHeight} rx={1} fill="var(--gantt-bar-progress)" opacity={0.5} />
                  {isSelected && <rect x={x - 1} y={barY - 1} width={width + 2} height={barHeight + 2} rx={2} fill="none" stroke="var(--ring)" strokeWidth={2} />}
                  {renderTrackingBar(task, task.baselineStart, task.baselineEnd, baselineY, 'baseline')}
                  {renderTrackingBar(task, task.actualStart, task.actualEnd, actualY, 'actual')}
                </g>
              );
            }

            return (
              <g key={task.id} style={{ cursor: 'pointer' }}>
                {isSelected && (
                  <rect x={0} y={y} width={totalWidth} height={rowHeight} fill="var(--gantt-row-selected)" />
                )}
                <rect
                  x={x} y={barY} width={width} height={barHeight} rx={3}
                  fill={isCritical ? 'var(--gantt-critical)' : 'var(--gantt-bar)'}
                  style={{ cursor: 'grab' }}
                  onMouseDown={e => handleMouseDown(e, task.id, 'move')}
                  onClick={() => onSelectTask(task.id)}
                  onContextMenu={e => onContextMenu(e, task.id)}
                  onMouseEnter={e => { if (!dragging) setTooltip({ x: e.clientX, y: e.clientY, task, kind: 'planned' }); }}
                  onMouseMove={e => { if (!dragging && tooltip?.task.id === task.id) setTooltip({ x: e.clientX, y: e.clientY, task, kind: 'planned' }); }}
                  onMouseLeave={() => setTooltip(null)}
                />
                {isCritical && (
                  <rect x={x - 2} y={barY - 2} width={width + 4} height={barHeight + 4} rx={5} fill="none" stroke="var(--gantt-critical)" strokeWidth={1.5} strokeOpacity={0.5}>
                    <animate attributeName="stroke-opacity" values="0.5;0.2;0.5" dur="2s" repeatCount="indefinite" />
                  </rect>
                )}
                <rect
                  x={x} y={barY} width={width * (task.progress / 100)} height={barHeight} rx={3}
                  fill="var(--gantt-bar-progress)"
                  style={{ pointerEvents: 'none' }}
                />
                {task.progress > 0 && task.progress < 100 && (
                  <rect
                    x={x + width * (task.progress / 100) - 3} y={barY}
                    width={3} height={barHeight}
                    fill="var(--gantt-bar-progress)"
                    style={{ pointerEvents: 'none' }}
                  />
                )}
                <rect
                  x={x + width - 6} y={barY} width={6} height={barHeight} rx={0}
                  fill="transparent"
                  style={{ cursor: 'ew-resize' }}
                  onMouseDown={e => handleMouseDown(e, task.id, 'resize')}
                />
                {width > 60 && (
                  <text
                    x={x + 6} y={barY + barHeight / 2 + 4}
                    className="timeline-task-label"
                  >
                    {task.name.length > width / 7 ? task.name.slice(0, Math.floor(width / 7)) + '…' : task.name}
                  </text>
                )}
                {task.resources.slice(0, 2).map((rid, ri) => {
                  const r = resources.find(x => x.id === rid);
                  if (!r) return null;
                  return (
                    <g key={rid}>
                      <circle cx={x + width + 12 + ri * 18} cy={y + rowHeight / 2} r={8} fill={r.color} />
                      <text
                        x={x + width + 12 + ri * 18}
                        y={y + rowHeight / 2 + 3}
                        textAnchor="middle"
                        className="timeline-resource-label"
                      >
                        {r.name.split(' ').map(w => w[0]).join('')}
                      </text>
                    </g>
                  );
                })}
                {isSelected && (
                  <rect x={x - 1} y={barY - 1} width={width + 2} height={barHeight + 2} rx={4} fill="none" stroke="var(--ring)" strokeWidth={2} />
                )}
                {renderTrackingBar(task, task.baselineStart, task.baselineEnd, baselineY, 'baseline')}
                {renderTrackingBar(task, task.actualStart, task.actualEnd, actualY, 'actual')}
              </g>
            );
          })}
        </g>
      </svg>

      {tooltip && !dragging && (() => {
        const tipStart = tooltip.kind === 'baseline' ? tooltip.task.baselineStart : tooltip.kind === 'actual' ? tooltip.task.actualStart : tooltip.task.start;
        const tipEnd = tooltip.kind === 'baseline' ? tooltip.task.baselineEnd : tooltip.kind === 'actual' ? tooltip.task.actualEnd : tooltip.task.end;
        const kindLabel = tooltip.kind === 'baseline' ? 'Baseline' : tooltip.kind === 'actual' ? 'Actual' : 'Planned';
        return (
        <div
          className="gantt-tooltip"
          style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
        >
          <div className="gantt-tooltip-title">{tooltip.task.name} — {kindLabel}</div>
          <div className="gantt-tooltip-row">
            <span className="gantt-tooltip-label">Start:</span>
            <span>{isValidDate(tipStart) ? formatDate(tipStart) : '—'}</span>
          </div>
          <div className="gantt-tooltip-row">
            <span className="gantt-tooltip-label">End:</span>
            <span>{isValidDate(tipEnd) ? formatDate(tipEnd) : '—'}</span>
          </div>
          <div className="gantt-tooltip-row">
            <span className="gantt-tooltip-label">Duration:</span>
            <span>{isValidDate(tipStart) && isValidDate(tipEnd) ? `${getDuration(tipStart, tipEnd)}d` : '—'}</span>
          </div>
          {tooltip.kind === 'planned' && (
            <div className="gantt-tooltip-row">
              <span className="gantt-tooltip-label">Progress:</span>
              <span>{tooltip.task.progress}%</span>
            </div>
          )}
          {tooltip.kind === 'planned' && tooltip.task.resources.length > 0 && (
            <div className="gantt-tooltip-row">
              <span className="gantt-tooltip-label">Resources:</span>
              <span>{tooltip.task.resources.map(rid => resources.find(r => r.id === rid)?.name || rid).join(', ')}</span>
            </div>
          )}
        </div>
        );
      })()}
    </div>
  );
}
