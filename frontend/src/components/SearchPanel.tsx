import type { GraphNode } from "../types";
import { SUPPORTED_KINDS } from "../types";
import { useI18n } from "../i18n";

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
  const { t } = useI18n();
  const hasResults = results.length > 0;

  return (
    <div className="panel-card search-panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">{t("searchPanel.title")}</div>
          <p className="panel-description">{t("searchPanel.description")}</p>
        </div>
        {hasResults ? <span className="info-chip">{results.length}</span> : null}
      </div>

      <input
        className="app-input"
        placeholder={t("searchPanel.placeholder")}
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
            {kindOption || t("searchPanel.allKinds")}
          </option>
        ))}
      </select>

      <button className="app-button" onClick={onSearch} disabled={loading}>
        {loading ? t("searchPanel.searching") : t("searchPanel.searchResources")}
      </button>

      <div className="search-results">
        {results.map((node) => (
          <button key={node.id} className="result-item" onClick={() => onSelect(node)}>
            <div className="result-item__meta">
              <span className="result-item__kind">{node.kind}</span>
              <strong>{node.name}</strong>
            </div>
            <span className="result-item__namespace">{node.namespace || t("common.cluster")}</span>
          </button>
        ))}
        {!loading && !hasResults ? <div className="empty-hint">{t("searchPanel.empty")}</div> : null}
      </div>
    </div>
  );
}
