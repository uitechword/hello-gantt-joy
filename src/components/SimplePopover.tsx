import { useState, useRef, useEffect } from 'react';

interface SimplePopoverProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  width?: number;
  className?: string;
}

export function SimplePopover({ trigger, children, align = 'start', width, className = '' }: SimplePopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const triggerWrapperStyle = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'stretch' as const,
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex', width: '100%', height: '100%' }}>
      <div style={triggerWrapperStyle} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        {trigger}
      </div>
      {open && (
        <div
          ref={popoverRef}
          className={`popover ${className}`}
          style={{
            position: 'absolute',
            top: '100%',
            marginTop: 4,
            ...(align === 'start' ? { left: 0 } : align === 'end' ? { right: 0 } : { left: '50%', transform: 'translateX(-50%)' }),
            ...(width ? { width } : {}),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface ControlledPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  width?: number;
  className?: string;
}

export function ControlledPopover({ open, onOpenChange, trigger, children, align = 'start', width, className = '' }: ControlledPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const triggerWrapperStyle = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'stretch' as const,
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open, onOpenChange]);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex', width: '100%', height: '100%' }}>
      <div style={triggerWrapperStyle} onClick={(e) => { e.stopPropagation(); onOpenChange(!open); }}>
        {trigger}
      </div>
      {open && (
        <div
          className={`popover ${className}`}
          style={{
            position: 'absolute',
            top: '100%',
            marginTop: 4,
            ...(align === 'start' ? { left: 0 } : align === 'end' ? { right: 0 } : { left: '50%', transform: 'translateX(-50%)' }),
            ...(width ? { width } : {}),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
  );
}
