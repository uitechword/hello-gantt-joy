import { useState } from 'react';
import { Resource } from '@/lib/gantt-types';
import { Plus, Trash2 } from 'lucide-react';

interface ResourcePanelProps {
  resources: Resource[];
  onAddResource: (name: string) => void;
  onDeleteResource: (id: string) => void;
}

const COLORS = [
  'hsl(213 60% 52%)', 'hsl(152 55% 42%)', 'hsl(32 90% 55%)',
  'hsl(280 60% 55%)', 'hsl(340 70% 55%)', 'hsl(180 55% 42%)',
];

export function ResourcePanel({ resources, onAddResource, onDeleteResource }: ResourcePanelProps) {
  const [newName, setNewName] = useState('');

  const handleAdd = () => {
    if (newName.trim()) {
      onAddResource(newName.trim());
      setNewName('');
    }
  };

  return (
    <div className="resource-panel gantt-scrollbar">
      <h3 className="resource-panel-title">Team Resources</h3>

      <div className="resource-panel-add">
        <input
          className="input"
          placeholder="New resource name..."
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button className="btn btn-primary btn-sm" onClick={handleAdd}>
          <Plus />
        </button>
      </div>

      <div className="resource-list">
        {resources.map(r => (
          <div key={r.id} className="resource-item">
            <span
              className="resource-avatar resource-avatar-lg"
              style={{ backgroundColor: r.color }}
            >
              {r.name.split(' ').map(w => w[0]).join('')}
            </span>
            <span className="resource-item-name">{r.name}</span>
            <button
              className="resource-delete-btn"
              onClick={() => onDeleteResource(r.id)}
            >
              <Trash2 />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export { COLORS };
