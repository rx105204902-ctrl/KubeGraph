import type {
  GraphAnomaly,
  GraphLogEntry,
  GraphPerformanceSnapshot,
  GraphLayoutMode,
  ThemeMode
} from "../types";

type DebugPanelProps = {
  visible: boolean;
  anomalies: GraphAnomaly[];
  logs: GraphLogEntry[];
  metrics: GraphPerformanceSnapshot;
  totalNodeCount: number;
  totalEdgeCount: number;
  expandedNodeCount: number;
  layoutMode: GraphLayoutMode;
  themeMode: ThemeMode;
};

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString();
}

export function DebugPanel({
  visible,
  anomalies,
  logs,
  metrics,
  totalNodeCount,
  totalEdgeCount,
  expandedNodeCount,
  layoutMode,
  themeMode
}: DebugPanelProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="panel-card detail-panel debug-panel">
      <div className="panel-title">Debug</div>
      <div className="debug-grid">
        <div className="debug-stat">
          <span>Total nodes</span>
          <strong>{totalNodeCount}</strong>
        </div>
        <div className="debug-stat">
          <span>Total edges</span>
          <strong>{totalEdgeCount}</strong>
        </div>
        <div className="debug-stat">
          <span>Visible nodes</span>
          <strong>{metrics.renderNodeCount}</strong>
        </div>
        <div className="debug-stat">
          <span>Visible edges</span>
          <strong>{metrics.renderEdgeCount}</strong>
        </div>
        <div className="debug-stat">
          <span>Normalization</span>
          <strong>{metrics.normalizationMs.toFixed(1)} ms</strong>
        </div>
        <div className="debug-stat">
          <span>Layout</span>
          <strong>{metrics.lastLayoutMs ? `${metrics.lastLayoutMs.toFixed(1)} ms` : "n/a"}</strong>
        </div>
        <div className="debug-stat">
          <span>FPS</span>
          <strong>{metrics.fps ? `${metrics.fps.toFixed(0)}` : "n/a"}</strong>
        </div>
        <div className="debug-stat">
          <span>Anomalies</span>
          <strong>{metrics.anomalyCount}</strong>
        </div>
      </div>

      <div className="debug-block">
        <div className="detail-heading">Workspace</div>
        <div>Layout: <strong>{layoutMode}</strong></div>
        <div>Theme: <strong>{themeMode}</strong></div>
        <div>Expanded nodes: <strong>{expandedNodeCount}</strong></div>
        <div>Hidden nodes: <strong>{metrics.hiddenNodeCount}</strong></div>
        <div>Hidden edges: <strong>{metrics.hiddenEdgeCount}</strong></div>
      </div>

      <div className="debug-block">
        <div className="detail-heading">Anomalies</div>
        {anomalies.length === 0 ? <div className="empty-hint">No graph anomalies detected.</div> : null}
        <div className="debug-list">
          {anomalies.map((anomaly) => (
            <div key={anomaly.id} className={`debug-log debug-log--${anomaly.severity}`}>
              <strong>{anomaly.kind}</strong>
              <span>{anomaly.message}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="debug-block">
        <div className="detail-heading">Recent logs</div>
        {logs.length === 0 ? <div className="empty-hint">No debug logs yet.</div> : null}
        <div className="debug-list">
          {logs.map((entry) => (
            <div key={entry.id} className={`debug-log debug-log--${entry.level === "error" ? "error" : entry.level === "warn" ? "warning" : "info"}`}>
              <div className="debug-log-row">
                <strong>{entry.scope}</strong>
                <span>{formatTimestamp(entry.timestamp)}</span>
              </div>
              <div>{entry.message}</div>
              {entry.context ? <code>{JSON.stringify(entry.context)}</code> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
