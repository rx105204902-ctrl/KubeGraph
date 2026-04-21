import { SUPPORTED_EDGE_TYPES } from "../types";

type EdgeFilterBarProps = {
  activeEdgeTypes: string[];
  onToggle: (edgeType: string) => void;
};

export function EdgeFilterBar({ activeEdgeTypes, onToggle }: EdgeFilterBarProps) {
  return (
    <div className="panel-card">
      <div className="panel-title">Edge Filters</div>
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
