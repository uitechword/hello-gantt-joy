/** Simple plain-CSS tab strip with counts. */
export default function GanttCrudTabs({ active, onChange, counts }) {
  const tabs = [
    { key: 'new', label: 'New', count: counts.new },
    { key: 'modified', label: 'Modified', count: counts.modified },
    { key: 'deleted', label: 'Deleted', count: counts.deleted },
  ];

  return (
    <div className="gcv-tabs" role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          className={`gcv-tab${active === tab.key ? ' gcv-tab-active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label} <span className="gcv-tab-count">({tab.count})</span>
        </button>
      ))}
    </div>
  );
}
