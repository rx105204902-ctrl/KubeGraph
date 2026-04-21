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
  const hasResults = results.length > 0;

  return (
    <div className="panel-card search-panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">Resource search</div>
          <p className="panel-description">Find an entrypoint resource, then open its neighborhood graph.</p>
        </div>
        {hasResults ? <span className="info-chip">{results.length}</span> : null}
      </div>

      <input
        className="app-input"
        placeholder="Search by kind or resource name"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onSearch();
          }
        }}
      />

      <select className="app-select" value={kind} onChange={(event) => onKindChange(event.target.value)}>
        {SUPPORTED_KINDS.map((kindOption) => (
          <option key={kindOption || "all"} value={kindOption}>
            {kindOption || "All kinds"}
          </option>
        ))}
      </select>

      <button className="app-button" onClick={onSearch} disabled={loading}>
        {loading ? "Searching…" : "Search resources"}
      </button>

      <div className="search-results">
        {results.map((node) => (
          <button key={node.id} className="result-item" onClick={() => onSelect(node)}>
            <div className="result-item__meta">
              <span className="result-item__kind">{node.kind}</span>
              <strong>{node.name}</strong>
            </div>
            <span className="result-item__namespace">{node.namespace || "cluster"}</span>
          </button>
        ))}
        {!loading && !hasResults ? <div className="empty-hint">Search for a resource to start graph exploration.</div> : null}
      </div>
    </div>
  );
}
