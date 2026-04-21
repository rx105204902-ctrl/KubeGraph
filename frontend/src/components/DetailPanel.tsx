import { useEffect, useMemo, useState } from "react";
import type { GraphEdge, GraphNode, GraphPathResult, ManifestPayload, NodeDetail } from "../types";
import { useI18n } from "../i18n";

type MetadataSortMode = "original" | "field-asc" | "field-desc";

type MetadataRow = {
  field: string;
  rawValue: unknown;
  displayValue: string;
  index: number;
};

type DetailPanelProps = {
  selectedNode: GraphNode | null;
  nodeDetail: NodeDetail | null;
  manifest: ManifestPayload | null;
  selectedEdge: GraphEdge | null;
  detailLoading: boolean;
  manifestLoading: boolean;
  debugMode: boolean;
  isSelectedNodeExpanded: boolean;
  pathStartId: string | null;
  pathEndId: string | null;
  pathResult: GraphPathResult | null;
  onLoadManifest: () => void;
  onExpandNode: () => void;
  onCollapseNode: () => void;
  onSetPathStart: () => void;
  onSetPathEnd: () => void;
  onRunPathAnalysis: () => void;
  onClearPath: () => void;
};

function renderJson(data: Record<string, unknown> | undefined) {
  if (!data || Object.keys(data).length === 0) {
    return "{}";
  }

  return JSON.stringify(data, null, 2);
}

function formatMetadataValue(value: unknown) {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return value === "" ? '""' : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "undefined") {
    return "undefined";
  }

  return JSON.stringify(value, null, 2);
}

function buildMetadataRows(metadata: Record<string, unknown> | undefined): MetadataRow[] {
  if (!metadata) {
    return [];
  }

  return Object.entries(metadata).map(([field, rawValue], index) => ({
    field,
    rawValue,
    displayValue: formatMetadataValue(rawValue),
    index
  }));
}

export function DetailPanel({
  selectedNode,
  nodeDetail,
  manifest,
  selectedEdge,
  detailLoading,
  manifestLoading,
  debugMode,
  isSelectedNodeExpanded,
  pathStartId,
  pathEndId,
  pathResult,
  onLoadManifest,
  onExpandNode,
  onCollapseNode,
  onSetPathStart,
  onSetPathEnd,
  onRunPathAnalysis,
  onClearPath
}: DetailPanelProps) {
  const { t } = useI18n();
  const [metadataFilter, setMetadataFilter] = useState("");
  const [metadataSortMode, setMetadataSortMode] = useState<MetadataSortMode>("original");
  const isPathStart = Boolean(selectedNode && pathStartId === selectedNode.id);
  const isPathEnd = Boolean(selectedNode && pathEndId === selectedNode.id);
  const metadataRows = useMemo(() => buildMetadataRows(nodeDetail?.metadata), [nodeDetail?.metadata]);

  useEffect(() => {
    setMetadataFilter("");
    setMetadataSortMode("original");
  }, [selectedNode?.id]);

  const visibleMetadataRows = useMemo(() => {
    const normalizedFilter = metadataFilter.trim().toLowerCase();
    const filteredRows = normalizedFilter === ""
      ? metadataRows
      : metadataRows.filter((row) =>
          row.field.toLowerCase().includes(normalizedFilter) || row.displayValue.toLowerCase().includes(normalizedFilter)
        );

    if (metadataSortMode === "field-asc") {
      return [...filteredRows].sort((left, right) => left.field.localeCompare(right.field));
    }

    if (metadataSortMode === "field-desc") {
      return [...filteredRows].sort((left, right) => right.field.localeCompare(left.field));
    }

    return [...filteredRows].sort((left, right) => left.index - right.index);
  }, [metadataFilter, metadataRows, metadataSortMode]);

  return (
    <div className="panel-card detail-panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">{t("detail.title")}</div>
          <p className="panel-description">{t("detail.description")}</p>
        </div>
      </div>

      {selectedEdge ? (
        <div className="detail-block">
          <div className="detail-heading">{t("detail.relationship")}</div>
          <div><strong>{t("detail.type")}:</strong> {selectedEdge.type}</div>
          <div><strong>{t("detail.category")}:</strong> {selectedEdge.category}</div>
          <div><strong>{t("detail.reason")}:</strong> {selectedEdge.reason}</div>
          {debugMode ? <div><strong>{t("detail.id")}:</strong> <code>{selectedEdge.id}</code></div> : null}
          <div className="detail-heading">{t("detail.evidence")}</div>
          {(selectedEdge.evidence ?? []).length > 0 ? (
            <ul className="evidence-list">
              {(selectedEdge.evidence ?? []).map((item) => (
                <li key={`${item.field}-${item.value}-${item.description}`}>
                  <code>{item.field}</code>
                  {item.value ? <span> = {item.value}</span> : null}
                  {item.description ? <div>{item.description}</div> : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-hint">{t("detail.noEvidence")}</div>
          )}
        </div>
      ) : null}

      {!selectedEdge && selectedNode ? (
        <div className="detail-block">
          <div className="detail-heading">{t("detail.node")}</div>
          <div><strong>{t("detail.kind")}:</strong> {selectedNode.kind}</div>
          <div><strong>{t("detail.name")}:</strong> {selectedNode.name}</div>
          <div><strong>{t("detail.namespace")}:</strong> {selectedNode.namespace || t("common.clusterScoped")}</div>
          <div><strong>{t("detail.category")}:</strong> {selectedNode.category}</div>
          {debugMode ? <div><strong>{t("detail.id")}:</strong> <code>{selectedNode.id}</code></div> : null}

          <div className="action-row">
            {isSelectedNodeExpanded ? (
              <button className="app-button secondary" onClick={onCollapseNode}>
                {t("detail.collapseSubgraph")}
              </button>
            ) : (
              <button className="app-button" onClick={onExpandNode}>
                {t("detail.expandNeighbors")}
              </button>
            )}
            <button className="app-button ghost" onClick={onSetPathStart}>
              {isPathStart ? t("detail.pathStartSet") : t("detail.setPathStart")}
            </button>
            <button className="app-button ghost" onClick={onSetPathEnd}>
              {isPathEnd ? t("detail.pathEndSet") : t("detail.setPathEnd")}
            </button>
          </div>

          <div className="action-row">
            <button className="app-button ghost" onClick={onRunPathAnalysis} disabled={!pathStartId || !pathEndId}>
              {t("detail.highlightShortestPath")}
            </button>
            <button className="app-button ghost" onClick={onClearPath}>
              {t("detail.clearPath")}
            </button>
          </div>
        </div>
      ) : null}

      {pathStartId || pathEndId || pathResult ? (
        <div className="detail-block detail-block--soft">
          <div className="detail-heading">{t("detail.pathAnalysis")}</div>
          <div><strong>{t("detail.start")}:</strong> {pathStartId || t("detail.notSelected")}</div>
          <div><strong>{t("detail.end")}:</strong> {pathEndId || t("detail.notSelected")}</div>
          {pathResult ? (
            <div>
              <strong>{t("detail.status")}:</strong> {pathResult.found ? t("detail.pathFound", { hops: pathResult.edgeIds.length }) : t("detail.noPathFound")}
            </div>
          ) : null}
        </div>
      ) : null}

      {!selectedEdge && detailLoading ? <div className="empty-hint">{t("detail.loadingDetails")}</div> : null}

      {!selectedEdge && !detailLoading && nodeDetail ? (
        <>
          <div className="detail-block">
            <div className="detail-heading-row">
              <div className="detail-heading">{t("detail.metadata")}</div>
              <span className="info-chip">{metadataRows.length}</span>
            </div>

            {metadataRows.length > 0 ? (
              <>
                <div className="metadata-controls">
                  <input
                    className="app-input"
                    placeholder={t("detail.metadataSearchPlaceholder")}
                    value={metadataFilter}
                    onChange={(event) => setMetadataFilter(event.target.value)}
                  />
                  <label className="toolbar-field metadata-sort-field">
                    <span>{t("common.sort")}</span>
                    <select
                      className="app-select"
                      value={metadataSortMode}
                      onChange={(event) => setMetadataSortMode(event.target.value as MetadataSortMode)}
                    >
                      <option value="original">{t("detail.metadataSortOriginal")}</option>
                      <option value="field-asc">{t("detail.metadataSortFieldAsc")}</option>
                      <option value="field-desc">{t("detail.metadataSortFieldDesc")}</option>
                    </select>
                  </label>
                </div>

                {visibleMetadataRows.length > 0 ? (
                  <div className="metadata-table-shell">
                    <table className="metadata-table">
                      <thead>
                        <tr>
                          <th>{t("common.field")}</th>
                          <th>{t("common.value")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleMetadataRows.map((row) => (
                          <tr key={row.field}>
                            <td><code>{row.field}</code></td>
                            <td>
                              {typeof row.rawValue === "object" && row.rawValue !== null ? (
                                <pre className="metadata-value">{row.displayValue}</pre>
                              ) : (
                                <span className="metadata-value metadata-value--inline">{row.displayValue}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-hint">{t("detail.noMetadataMatches")}</div>
                )}
              </>
            ) : (
              <div className="empty-hint">{t("detail.noMetadata")}</div>
            )}
          </div>
          <div className="detail-block">
            <div className="detail-heading">{t("detail.statusSection")}</div>
            <pre>{renderJson(nodeDetail.status)}</pre>
          </div>
          <button className="app-button secondary" onClick={onLoadManifest} disabled={manifestLoading}>
            {manifestLoading ? t("detail.loadingManifest") : t("detail.loadManifest")}
          </button>
          {manifest ? (
            <div className="detail-block">
              <div className="detail-heading">{t("detail.manifest")}</div>
              <pre>{JSON.stringify(manifest.manifest, null, 2)}</pre>
            </div>
          ) : null}
        </>
      ) : null}

      {!selectedEdge && !detailLoading && !selectedNode && !nodeDetail ? (
        <div className="empty-hint">{t("detail.emptyHint")}</div>
      ) : null}
    </div>
  );
}
