import { SUPPORTED_EDGE_TYPES } from "../types";

type EdgeFilterBarProps = {
  activeEdgeTypes: string[];
  onToggle: (edgeType: string) => void;
  onEnableAll: () => void;
  onClearAll: () => void;
};

export function EdgeFilterBar({ activeEdgeTypes, onToggle, onEnableAll, onClearAll }: EdgeFilterBarProps) {
  return (
    <div className="panel-card">
      <div className="panel-header">
        <div>
          <div className="panel-title">Relationship filters</div>
          <p className="panel-description">Focus the graph on selected edge categories.</p>
        </div>
        <div className="panel-actions">
          <button className="text-button" onClick={onEnableAll}>
            All
          </button>
          <button className="text-button" onClick={onClearAll}>
            Clear
          </button>
        </div>
      </div>

      <div className="filter-grid">
        {SUPPORTED_EDGE_TYPES.map((edgeType) => (
          <label key={edgeType} className="filter-item">
            <input
              type="checkbox"
              checked={activeEdgeTypes.includes(edgeType)}
              onChange={() => onToggle(edgeType)}
            />
            <span>{edgeType}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
