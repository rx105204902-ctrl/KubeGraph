import type {
  GraphAnomaly,
  GraphLogEntry,
  GraphPerformanceSnapshot,
  GraphLayoutMode,
  ThemeMode
} from "../types";
import { useI18n } from "../i18n";

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

function formatTimestamp(timestamp: number, language: string) {
  return new Intl.DateTimeFormat(language, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(timestamp));
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
  const { language, t } = useI18n();

  if (!visible) {
    return null;
  }

  return (
    <div className="panel-card detail-panel debug-panel">
      <div className="panel-title">{t("debug.title")}</div>
      <div className="debug-grid">
        <div className="debug-stat">
          <span>{t("debug.totalNodes")}</span>
          <strong>{totalNodeCount}</strong>
        </div>
        <div className="debug-stat">
          <span>{t("debug.totalEdges")}</span>
          <strong>{totalEdgeCount}</strong>
        </div>
        <div className="debug-stat">
          <span>{t("debug.visibleNodes")}</span>
          <strong>{metrics.renderNodeCount}</strong>
        </div>
        <div className="debug-stat">
          <span>{t("debug.visibleEdges")}</span>
          <strong>{metrics.renderEdgeCount}</strong>
        </div>
        <div className="debug-stat">
          <span>{t("debug.normalization")}</span>
          <strong>{metrics.normalizationMs.toFixed(1)} ms</strong>
        </div>
        <div className="debug-stat">
          <span>{t("debug.layout")}</span>
          <strong>{metrics.lastLayoutMs ? `${metrics.lastLayoutMs.toFixed(1)} ms` : t("common.notAvailable")}</strong>
        </div>
        <div className="debug-stat">
          <span>{t("debug.fps")}</span>
          <strong>{metrics.fps ? `${metrics.fps.toFixed(0)}` : t("common.notAvailable")}</strong>
        </div>
        <div className="debug-stat">
          <span>{t("debug.anomalies")}</span>
          <strong>{metrics.anomalyCount}</strong>
        </div>
      </div>

      <div className="debug-block">
        <div className="detail-heading">{t("debug.workspace")}</div>
        <div>{t("debug.layout")}: <strong>{t(`toolbar.layoutOptions.${layoutMode}`)}</strong></div>
        <div>{t("debug.theme")}: <strong>{themeMode === "dark" ? t("toolbar.darkMode") : t("toolbar.lightMode")}</strong></div>
        <div>{t("debug.expandedNodes")}: <strong>{expandedNodeCount}</strong></div>
        <div>{t("debug.hiddenNodes")}: <strong>{metrics.hiddenNodeCount}</strong></div>
        <div>{t("debug.hiddenEdges")}: <strong>{metrics.hiddenEdgeCount}</strong></div>
      </div>

      <div className="debug-block">
        <div className="detail-heading">{t("debug.anomaliesTitle")}</div>
        {anomalies.length === 0 ? <div className="empty-hint">{t("debug.noAnomalies")}</div> : null}
        <div className="debug-list">
          {anomalies.map((anomaly) => (
            <div key={anomaly.id} className={`debug-log debug-log--${anomaly.severity}`}>
              <strong>{t(`debug.anomalyKinds.${anomaly.kind}`)}</strong>
              <span>{anomaly.message}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="debug-block">
        <div className="detail-heading">{t("debug.recentLogs")}</div>
        {logs.length === 0 ? <div className="empty-hint">{t("debug.noLogs")}</div> : null}
        <div className="debug-list">
          {logs.map((entry) => (
            <div key={entry.id} className={`debug-log debug-log--${entry.level === "error" ? "error" : entry.level === "warn" ? "warning" : "info"}`}>
              <div className="debug-log-row">
                <strong>{t(`debug.scopes.${entry.scope}`)}</strong>
                <span>{formatTimestamp(entry.timestamp, language)}</span>
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
