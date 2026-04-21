import type { GraphEdge, ManifestPayload, NodeDetail } from "../types";

type DetailPanelProps = {
  nodeDetail: NodeDetail | null;
  manifest: ManifestPayload | null;
  selectedEdge: GraphEdge | null;
  detailLoading: boolean;
  manifestLoading: boolean;
  onLoadManifest: () => void;
};

function renderJson(data: Record<string, unknown> | undefined) {
  if (!data || Object.keys(data).length === 0) {
    return "{}";
  }

  return JSON.stringify(data, null, 2);
}

export function DetailPanel({
  nodeDetail,
  manifest,
  selectedEdge,
  detailLoading,
  manifestLoading,
  onLoadManifest
}: DetailPanelProps) {
  return (
    <div className="panel-card detail-panel">
      <div className="panel-title">Details</div>
      {selectedEdge ? (
        <div className="detail-block">
          <div className="detail-heading">Edge</div>
          <div><strong>Type:</strong> {selectedEdge.type}</div>
          <div><strong>Category:</strong> {selectedEdge.category}</div>
          <div><strong>Reason:</strong> {selectedEdge.reason}</div>
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

      {!selectedEdge && detailLoading ? <div className="empty-hint">Loading details...</div> : null}

      {!selectedEdge && !detailLoading && nodeDetail ? (
        <>
          <div className="detail-block">
            <div className="detail-heading">Node</div>
            <div><strong>Kind:</strong> {nodeDetail.node.kind}</div>
            <div><strong>Name:</strong> {nodeDetail.node.name}</div>
            <div><strong>Namespace:</strong> {nodeDetail.node.namespace || "cluster-scoped"}</div>
            <div><strong>Category:</strong> {nodeDetail.node.category}</div>
          </div>
          <div className="detail-block">
            <div className="detail-heading">Metadata</div>
            <pre>{renderJson(nodeDetail.metadata)}</pre>
          </div>
          <div className="detail-block">
            <div className="detail-heading">Status</div>
            <pre>{renderJson(nodeDetail.status)}</pre>
          </div>
          <button className="app-button secondary" onClick={onLoadManifest} disabled={manifestLoading}>
            {manifestLoading ? "Loading manifest..." : "Load manifest"}
          </button>
          {manifest ? (
            <div className="detail-block">
              <div className="detail-heading">Manifest</div>
              <pre>{JSON.stringify(manifest.manifest, null, 2)}</pre>
            </div>
          ) : null}
        </>
      ) : null}

      {!selectedEdge && !detailLoading && !nodeDetail ? <div className="empty-hint">Select a node or edge.</div> : null}
    </div>
  );
}
