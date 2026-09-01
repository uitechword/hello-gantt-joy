import { useState } from 'react';
import { Holiday } from '@/lib/work-calendar';
import { Plus, Trash2, CalendarDays, X } from 'lucide-react';

interface HolidayManagerProps {
  holidays: Holiday[];
  onAddHoliday: (holiday: Holiday) => void;
  onDeleteHoliday: (date: string) => void;
  onClose: () => void;
}

export function HolidayManager({ holidays, onAddHoliday, onDeleteHoliday, onClose }: HolidayManagerProps) {
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');

  const handleAdd = () => {
    if (!newDate || !newName.trim()) return;
    onAddHoliday({ date: newDate, name: newName.trim() });
    setNewDate('');
    setNewName('');
  };

  const sortedHolidays = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="holiday-manager-overlay" onClick={onClose}>
      <div className="holiday-manager" onClick={e => e.stopPropagation()}>
        <div className="holiday-manager-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarDays size={18} />
            <h3>Holiday Management</h3>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="holiday-add-form">
          <input
            type="date"
            className="input"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            style={{ flex: '0 0 160px' }}
          />
          <input
            type="text"
            className="input"
            placeholder="Holiday name..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={!newDate || !newName.trim()}>
            <Plus size={14} /> Add
          </button>
        </div>

        <div className="holiday-list">
          {sortedHolidays.length === 0 ? (
            <div className="holiday-empty">No holidays defined. Add holidays to exclude them from scheduling.</div>
          ) : (
            sortedHolidays.map(h => (
              <div key={h.date} className="holiday-item">
                <span className="holiday-date">{new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span className="holiday-name">{h.name}</span>
                <button className="btn btn-ghost btn-icon btn-sm holiday-delete" onClick={() => onDeleteHoliday(h.date)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
