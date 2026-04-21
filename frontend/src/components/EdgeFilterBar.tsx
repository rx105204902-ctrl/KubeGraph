import { SUPPORTED_EDGE_TYPES } from "../types";
import { useI18n } from "../i18n";

type EdgeFilterBarProps = {
  activeEdgeTypes: string[];
  onToggle: (edgeType: string) => void;
  onEnableAll: () => void;
  onClearAll: () => void;
};

export function EdgeFilterBar({ activeEdgeTypes, onToggle, onEnableAll, onClearAll }: EdgeFilterBarProps) {
  const { t } = useI18n();

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div>
          <div className="panel-title">{t("edgeFilters.title")}</div>
          <p className="panel-description">{t("edgeFilters.description")}</p>
        </div>
        <div className="panel-actions">
          <button className="text-button" onClick={onEnableAll}>
            {t("common.all")}
          </button>
          <button className="text-button" onClick={onClearAll}>
            {t("common.clear")}
          </button>
        </div>
      </div>

      <div className="filter-grid">
        {SUPPORTED_EDGE_TYPES.map((edgeType) => (
          <label key={edgeType} className="filter-item">
            <input
              type="checkbox"
              checked={activeEdgeTypes.includes(edgeType)}
              onChange={() => onToggle(edgeType)}
            />
            <span>{t(`edgeTypes.${edgeType}`)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
