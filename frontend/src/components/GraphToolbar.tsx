import type { GraphLayoutMode, GraphNode, ThemeMode } from "../types";
import { GRAPH_LAYOUT_OPTIONS } from "../types";

type GraphToolbarProps = {
  layoutMode: GraphLayoutMode;
  themeMode: ThemeMode;
  debugMode: boolean;
  filterQuery: string;
  showOnlyMatches: boolean;
  selectedNode: GraphNode | null;
  isSelectedNodeExpanded: boolean;
  pathStartLabel: string | null;
  pathEndLabel: string | null;
  visibleNodeCount: number;
  visibleEdgeCount: number;
  onLayoutModeChange: (mode: GraphLayoutMode) => void;
  onThemeToggle: () => void;
  onDebugToggle: () => void;
  onFilterQueryChange: (value: string) => void;
  onShowOnlyMatchesChange: (value: boolean) => void;
  onFitView: () => void;
  onExpandSelected: () => void;
  onCollapseSelected: () => void;
  onSetPathStart: () => void;
  onSetPathEnd: () => void;
  onRunPathAnalysis: () => void;
  onClearPath: () => void;
};

export function GraphToolbar({
  layoutMode,
  themeMode,
  debugMode,
  filterQuery,
  showOnlyMatches,
  selectedNode,
  isSelectedNodeExpanded,
  pathStartLabel,
  pathEndLabel,
  visibleNodeCount,
  visibleEdgeCount,
  onLayoutModeChange,
  onThemeToggle,
  onDebugToggle,
  onFilterQueryChange,
  onShowOnlyMatchesChange,
  onFitView,
  onExpandSelected,
  onCollapseSelected,
  onSetPathStart,
  onSetPathEnd,
  onRunPathAnalysis,
  onClearPath
}: GraphToolbarProps) {
  const canRunPathAnalysis = Boolean(pathStartLabel && pathEndLabel);

  return (
    <div className="panel-card toolbar-card">
      <div className="toolbar-row">
        <div className="toolbar-block toolbar-block--grow">
          <label className="toolbar-field toolbar-field--wide">
            <span>Graph filter</span>
            <input
              className="app-input"
              placeholder="Highlight nodes by name, kind, namespace or ID"
              value={filterQuery}
              onChange={(event) => onFilterQueryChange(event.target.value)}
            />
          </label>
          <label className="toolbar-check">
            <input
              type="checkbox"
              checked={showOnlyMatches}
              onChange={(event) => onShowOnlyMatchesChange(event.target.checked)}
            />
            <span>Only show matches</span>
          </label>
        </div>

        <div className="toolbar-block">
          <label className="toolbar-field">
            <span>Layout</span>
            <select
              className="app-select"
              value={layoutMode}
              onChange={(event) => onLayoutModeChange(event.target.value as GraphLayoutMode)}
            >
              {GRAPH_LAYOUT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button className="app-button secondary" onClick={onFitView}>
            Fit view
          </button>
        </div>
      </div>

      <div className="toolbar-row toolbar-row--compact">
        <div className="toolbar-chip-row">
          <span className="info-chip">{visibleNodeCount} nodes</span>
          <span className="info-chip">{visibleEdgeCount} edges</span>
          {pathStartLabel ? <span className="info-chip info-chip--accent">Start: {pathStartLabel}</span> : null}
          {pathEndLabel ? <span className="info-chip info-chip--accent">End: {pathEndLabel}</span> : null}
        </div>

        <div className="toolbar-actions">
          <button className="app-button ghost" onClick={onThemeToggle}>
            {themeMode === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button className={`app-button ghost ${debugMode ? "active" : ""}`} onClick={onDebugToggle}>
            {debugMode ? "Hide debug" : "Show debug"}
          </button>
        </div>
      </div>

      {selectedNode ? (
        <div className="toolbar-row toolbar-row--actions">
          <div className="toolbar-context">
            <strong>{selectedNode.kind}</strong>
            <span>{selectedNode.name}</span>
          </div>
          <div className="toolbar-actions toolbar-actions--wrap">
            {isSelectedNodeExpanded ? (
              <button className="app-button secondary" onClick={onCollapseSelected}>
                Collapse subgraph
              </button>
            ) : (
              <button className="app-button" onClick={onExpandSelected}>
                Expand neighbors
              </button>
            )}
            <button className="app-button ghost" onClick={onSetPathStart}>
              Set path start
            </button>
            <button className="app-button ghost" onClick={onSetPathEnd}>
              Set path end
            </button>
            <button className="app-button ghost" onClick={onRunPathAnalysis} disabled={!canRunPathAnalysis}>
              Highlight shortest path
            </button>
            <button className="app-button ghost" onClick={onClearPath}>
              Clear path
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
