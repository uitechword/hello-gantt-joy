import { Resource } from '@/lib/gantt-types';
import { Check, UserPlus } from 'lucide-react';
import { SimplePopover } from '@/components/SimplePopover';

interface ResourceSelectProps {
  resources: Resource[];
  selected: string[];
  onChange: (resourceIds: string[]) => void;
}

export function ResourceSelect({ resources, selected, onChange }: ResourceSelectProps) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(r => r !== id) : [...selected, id]);
  };

  return (
    <SimplePopover
      trigger={
        <button type="button" className="resource-select-trigger">
          {selected.length === 0 ? (
            <span className="resource-select-empty">
              <UserPlus />
              Assign
            </span>
          ) : (
            <>
              {selected.slice(0, 3).map(rid => {
                const r = resources.find(x => x.id === rid);
                return r ? (
                  <span
                    key={rid}
                    className="resource-avatar"
                    style={{ backgroundColor: r.color }}
                    title={r.name}
                  >
                    {r.name.split(' ').map(w => w[0]).join('')}
                  </span>
                ) : null;
              })}
              {selected.length > 3 && (
                <span className="resource-more">+{selected.length - 3}</span>
              )}
              <UserPlus className="resource-assign-icon" />
            </>
          )}
        </button>
      }
      width={200}
      className="resource-popover"
    >
      {resources.length === 0 ? (
        <div className="resource-empty-msg">No resources available</div>
      ) : (
        resources.map(r => (
          <button
            key={r.id}
            type="button"
            className="resource-option"
            onClick={(e) => { e.stopPropagation(); toggle(r.id); }}
          >
            <span
              className="resource-avatar"
              style={{ backgroundColor: r.color }}
            >
              {r.name.split(' ').map(w => w[0]).join('')}
            </span>
            <span className="resource-option-name">{r.name}</span>
            {selected.includes(r.id) && <Check className="resource-option-check" />}
          </button>
        ))
      )}
    </SimplePopover>
  );
}
