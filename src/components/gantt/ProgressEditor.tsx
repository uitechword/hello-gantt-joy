import { useEffect, useState } from 'react';
import { ControlledPopover } from '@/components/SimplePopover';

interface ProgressEditorProps {
  progress: number;
  onChange: (value: number) => void;
}

export function ProgressEditor({ progress, onChange }: ProgressEditorProps) {
  const [open, setOpen] = useState(false);
  const [localValue, setLocalValue] = useState(progress ?? 0);

  useEffect(() => {
    setLocalValue(progress ?? 0);
  }, [progress]);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) setLocalValue(progress ?? 0);
    setOpen(isOpen);
  };

  const clamp = (v: number) => Math.max(0, Math.min(100, isNaN(v) ? 0 : Math.round(v)));

  const commit = (v: number) => {
    const clamped = clamp(v);
    setLocalValue(clamped);
    onChange(clamped);
  };

  return (
    <ControlledPopover
      open={open}
      onOpenChange={handleOpen}
      className="progress-popover"
      trigger={
        <button type="button" className="progress-trigger">
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="progress-value">{progress}%</span>
        </button>
      }
      width={224}
    >
      <div onClick={e => e.stopPropagation()}>
        <div className="progress-popover-row">
          <label className="progress-popover-label">Progress</label>
          <input
            type="number"
            min={0}
            max={100}
            value={localValue}
            onChange={e => {
              const nextValue = clamp(parseInt(e.target.value));
              setLocalValue(nextValue);
              onChange(nextValue);
            }}
            onBlur={() => setLocalValue(clamp(localValue))}
            onKeyDown={e => { if (e.key === 'Enter') commit(localValue); }}
            className="input input-sm progress-popover-input"
          />
          <span className="progress-popover-unit">%</span>
        </div>
        <input
          type="range"
          className="range-slider"
          min={0}
          max={100}
          step={1}
          value={localValue}
          onChange={e => {
            const v = clamp(parseInt(e.target.value));
            setLocalValue(v);
            onChange(v);
          }}
        />
        <div className="progress-popover-ticks">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>
    </ControlledPopover>
  );
}
