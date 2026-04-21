import type { GraphNode } from "../types";
import { SUPPORTED_KINDS } from "../types";

type SearchPanelProps = {
  query: string;
  kind: string;
  loading: boolean;
  results: GraphNode[];
  onQueryChange: (value: string) => void;
  onKindChange: (value: string) => void;
  onSearch: () => void;
  onSelect: (node: GraphNode) => void;
};

export function SearchPanel({
  query,
  kind,
  loading,
  results,
  onQueryChange,
  onKindChange,
  onSearch,
  onSelect
}: SearchPanelProps) {
  return (
    <div className="panel-card search-panel">
      <div className="panel-title">Resource Search</div>
      <input
        className="app-input"
        placeholder="Search by kind or name"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <select className="app-select" value={kind} onChange={(event) => onKindChange(event.target.value)}>
        {SUPPORTED_KINDS.map((kindOption) => (
          <option key={kindOption || "all"} value={kindOption}>
            {kindOption || "All kinds"}
          </option>
        ))}
      </select>
      <button className="app-button" onClick={onSearch} disabled={loading}>
        {loading ? "Searching..." : "Search"}
      </button>
      <div className="search-results">
        {results.map((node) => (
          <button key={node.id} className="result-item" onClick={() => onSelect(node)}>
            <span>{node.kind}</span>
            <strong>{node.name}</strong>
          </button>
        ))}
        {!loading && results.length === 0 ? <div className="empty-hint">No results yet.</div> : null}
      </div>
    </div>
  );
}
