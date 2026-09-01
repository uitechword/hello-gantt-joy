import { toJSONText, diffLines } from './compareGanttData';

export default function CompareJsonModal({ initialTasks, currentTasks, onClose }) {
  const rows = diffLines(toJSONText(initialTasks), toJSONText(currentTasks));
  const changed = rows.filter(r => r.leftKind !== 'same' || r.rightKind !== 'same').length;

  return (
    <div className="gcr-overlay" onMouseDown={onClose}>
      <div className="gcr-modal gcr-modal-wide" onMouseDown={e => e.stopPropagation()}>
        <div className="gcr-modal-header">
          <div>
            <h2 className="gcr-modal-title">Compare Gantt JSON</h2>
            <div className="gcr-modal-sub">
              {changed === 0 ? 'No differences found' : `${changed} differing line${changed === 1 ? '' : 's'}`}
            </div>
          </div>
          <button className="gcr-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="gcr-diff-head">
          <div>Initial Gantt JSON</div>
          <div>Current Gantt JSON</div>
        </div>

        <div className="gcr-diff-body">
          <table className="gcr-diff-table">
            <colgroup>
              <col style={{ width: 46 }} />
              <col style={{ width: '50%' }} />
              <col style={{ width: 46 }} />
              <col />
            </colgroup>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="gcr-num">{r.left ? r.left.num : ''}</td>
                  <td className={`gcr-code gcr-line-${r.leftKind}`}>{r.left ? r.left.text : ''}</td>
                  <td className="gcr-num gcr-pane-split">{r.right ? r.right.num : ''}</td>
                  <td className={`gcr-code gcr-line-${r.rightKind}`}>{r.right ? r.right.text : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="gcr-legend">
          <span><span className="gcr-swatch gcr-swatch-removed" />Removed / old</span>
          <span><span className="gcr-swatch gcr-swatch-added" />Added / new</span>
          <span><span className="gcr-swatch gcr-swatch-same" />Unchanged</span>
        </div>
      </div>
    </div>
  );
}
