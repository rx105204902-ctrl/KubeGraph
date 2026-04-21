import type { GraphEdge, GraphNode, GraphPathResult, ManifestPayload, NodeDetail } from "../types";

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
  const isPathStart = Boolean(selectedNode && pathStartId === selectedNode.id);
  const isPathEnd = Boolean(selectedNode && pathEndId === selectedNode.id);

  return (
    <div className="panel-card detail-panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">Details</div>
          <p className="panel-description">Inspect graph context, relationships and manifests.</p>
        </div>
      </div>

      {selectedEdge ? (
        <div className="detail-block">
          <div className="detail-heading">Relationship</div>
          <div><strong>Type:</strong> {selectedEdge.type}</div>
          <div><strong>Category:</strong> {selectedEdge.category}</div>
          <div><strong>Reason:</strong> {selectedEdge.reason}</div>
          {debugMode ? <div><strong>ID:</strong> <code>{selectedEdge.id}</code></div> : null}
          <div className="detail-heading">Evidence</div>
          <ul className="evidence-list">
            {(selectedEdge.evidence ?? []).map((item) => (
              <li key={`${item.field}-${item.value}-${item.description}`}>
                <code>{item.field}</code>
                {item.value ? <span> = {item.value}</span> : null}
                {item.description ? <div>{item.description}</div> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!selectedEdge && selectedNode ? (
        <div className="detail-block">
          <div className="detail-heading">Node</div>
          <div><strong>Kind:</strong> {selectedNode.kind}</div>
          <div><strong>Name:</strong> {selectedNode.name}</div>
          <div><strong>Namespace:</strong> {selectedNode.namespace || "cluster-scoped"}</div>
          <div><strong>Category:</strong> {selectedNode.category}</div>
          {debugMode ? <div><strong>ID:</strong> <code>{selectedNode.id}</code></div> : null}

          <div className="action-row">
            {isSelectedNodeExpanded ? (
              <button className="app-button secondary" onClick={onCollapseNode}>
                Collapse subgraph
              </button>
            ) : (
              <button className="app-button" onClick={onExpandNode}>
                Expand neighbors
              </button>
            )}
            <button className="app-button ghost" onClick={onSetPathStart}>
              {isPathStart ? "Path start set" : "Set path start"}
            </button>
            <button className="app-button ghost" onClick={onSetPathEnd}>
              {isPathEnd ? "Path end set" : "Set path end"}
            </button>
          </div>

          <div className="action-row">
            <button className="app-button ghost" onClick={onRunPathAnalysis} disabled={!pathStartId || !pathEndId}>
              Highlight shortest path
            </button>
            <button className="app-button ghost" onClick={onClearPath}>
              Clear path
            </button>
          </div>
        </div>
      ) : null}

      {pathStartId || pathEndId || pathResult ? (
        <div className="detail-block detail-block--soft">
          <div className="detail-heading">Path analysis</div>
          <div><strong>Start:</strong> {pathStartId || "not selected"}</div>
          <div><strong>End:</strong> {pathEndId || "not selected"}</div>
          {pathResult ? (
            <div>
              <strong>Status:</strong> {pathResult.found ? `Path found (${pathResult.edgeIds.length} hops)` : "No path found"}
            </div>
          ) : null}
        </div>
      ) : null}

      {!selectedEdge && detailLoading ? <div className="empty-hint">Loading resource details…</div> : null}

      {!selectedEdge && !detailLoading && nodeDetail ? (
        <>
          <div className="detail-block">
            <div className="detail-heading">Metadata</div>
            <pre>{renderJson(nodeDetail.metadata)}</pre>
          </div>
          <div className="detail-block">
            <div className="detail-heading">Status</div>
            <pre>{renderJson(nodeDetail.status)}</pre>
          </div>
          <button className="app-button secondary" onClick={onLoadManifest} disabled={manifestLoading}>
            {manifestLoading ? "Loading manifest…" : "Load manifest"}
          </button>
          {manifest ? (
            <div className="detail-block">
              <div className="detail-heading">Manifest</div>
              <pre>{JSON.stringify(manifest.manifest, null, 2)}</pre>
            </div>
          ) : null}
        </>
      ) : null}

      {!selectedEdge && !detailLoading && !selectedNode && !nodeDetail ? (
        <div className="empty-hint">Select a node or relationship to inspect it.</div>
      ) : null}
    </div>
  );
}
