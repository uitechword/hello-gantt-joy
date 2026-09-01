import { useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface DurationEditorProps {
  duration: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

export function DurationEditor({ duration, disabled, onChange }: DurationEditorProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(duration);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(duration);
  }, [duration]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const clamp = (v: number) => Math.max(0, isNaN(v) ? 0 : Math.round(v));

  const commit = (v: number) => {
    const clamped = clamp(v);
    setLocalValue(clamped);
    onChange(clamped);
  };

  const step = (delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = clamp(localValue + delta);
    setLocalValue(next);
    onChange(next);
  };

  if (disabled) {
    return <span className="duration-display">{duration}d</span>;
  }

  return (
    <div className="duration-editor" onClick={e => e.stopPropagation()}>
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          min={0}
          className="duration-input"
          value={localValue}
          onChange={e => {
            const v = parseInt(e.target.value);
            if (!isNaN(v)) setLocalValue(v);
          }}
          onBlur={() => { commit(localValue); setEditing(false); }}
          onKeyDown={e => {
            if (e.key === 'Enter') { commit(localValue); setEditing(false); }
            if (e.key === 'Escape') { setLocalValue(duration); setEditing(false); }
          }}
        />
      ) : (
        <span
          className="duration-value"
          onDoubleClick={() => setEditing(true)}
        >
          {localValue}d
        </span>
      )}
      <div className="duration-steppers">
        <button type="button" className="duration-step-btn" onClick={e => step(1, e)} title="Increase">
          <ChevronUp />
        </button>
        <button type="button" className="duration-step-btn" onClick={e => step(-1, e)} title="Decrease">
          <ChevronDown />
        </button>
      </div>
    </div>
  );
}
