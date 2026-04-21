import type { GraphLayoutMode, GraphNode, ThemeMode } from "../types";
import { GRAPH_LAYOUT_OPTIONS } from "../types";
import { useI18n } from "../i18n";

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
  const { language, t, toggleLanguage } = useI18n();
  const canRunPathAnalysis = Boolean(pathStartLabel && pathEndLabel);

  return (
    <div className="panel-card toolbar-card">
      <div className="toolbar-row">
        <div className="toolbar-block toolbar-block--grow">
          <label className="toolbar-field toolbar-field--wide">
            <span>{t("toolbar.graphFilter")}</span>
            <input
              className="app-input"
              placeholder={t("toolbar.graphFilterPlaceholder")}
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
            <span>{t("toolbar.onlyShowMatches")}</span>
          </label>
        </div>

        <div className="toolbar-block">
          <label className="toolbar-field">
            <span>{t("toolbar.layout")}</span>
            <select
              className="app-select"
              value={layoutMode}
              onChange={(event) => onLayoutModeChange(event.target.value as GraphLayoutMode)}
            >
              {GRAPH_LAYOUT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(`toolbar.layoutOptions.${option}`)}
                </option>
              ))}
            </select>
          </label>
          <button className="app-button secondary" onClick={onFitView}>
            {t("toolbar.fitView")}
          </button>
        </div>
      </div>

      <div className="toolbar-row toolbar-row--compact">
        <div className="toolbar-chip-row">
          <span className="info-chip">{t("toolbar.visibleNodes", { count: visibleNodeCount })}</span>
          <span className="info-chip">{t("toolbar.visibleEdges", { count: visibleEdgeCount })}</span>
          {pathStartLabel ? <span className="info-chip info-chip--accent">{t("toolbar.start", { label: pathStartLabel })}</span> : null}
          {pathEndLabel ? <span className="info-chip info-chip--accent">{t("toolbar.end", { label: pathEndLabel })}</span> : null}
        </div>

        <div className="toolbar-actions">
          <button className="app-button ghost" onClick={onThemeToggle}>
            {themeMode === "dark" ? t("toolbar.lightMode") : t("toolbar.darkMode")}
          </button>
          <button className="app-button ghost" onClick={toggleLanguage}>
            {language === "zh-CN" ? t("toolbar.switchToEnglish") : t("toolbar.switchToChinese")}
          </button>
          <button className={`app-button ghost ${debugMode ? "active" : ""}`} onClick={onDebugToggle}>
            {debugMode ? t("toolbar.hideDebug") : t("toolbar.showDebug")}
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
                {t("toolbar.collapseSubgraph")}
              </button>
            ) : (
              <button className="app-button" onClick={onExpandSelected}>
                {t("toolbar.expandNeighbors")}
              </button>
            )}
            <button className="app-button ghost" onClick={onSetPathStart}>
              {t("toolbar.setPathStart")}
            </button>
            <button className="app-button ghost" onClick={onSetPathEnd}>
              {t("toolbar.setPathEnd")}
            </button>
            <button className="app-button ghost" onClick={onRunPathAnalysis} disabled={!canRunPathAnalysis}>
              {t("toolbar.highlightShortestPath")}
            </button>
            <button className="app-button ghost" onClick={onClearPath}>
              {t("toolbar.clearPath")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
