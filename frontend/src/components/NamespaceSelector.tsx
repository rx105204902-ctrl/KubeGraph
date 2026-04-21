import type { NamespaceOption } from "../types";
import { useI18n } from "../i18n";

type NamespaceSelectorProps = {
  namespaces: NamespaceOption[];
  selectedNamespace: string;
  loading: boolean;
  onChange: (namespace: string) => void;
};

export function NamespaceSelector({ namespaces, selectedNamespace, loading, onChange }: NamespaceSelectorProps) {
  const { t } = useI18n();

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div>
          <div className="panel-title">{t("namespacePanel.title")}</div>
          <p className="panel-description">{t("namespacePanel.description")}</p>
        </div>
        <span className="info-chip">{namespaces.length}</span>
      </div>

      <select
        className="app-select"
        value={selectedNamespace}
        onChange={(event) => onChange(event.target.value)}
        disabled={loading || namespaces.length === 0}
      >
        {namespaces.map((namespace) => (
          <option key={namespace.name} value={namespace.name}>
            {namespace.name}
          </option>
        ))}
      </select>

      {loading ? <div className="field-hint">{t("namespacePanel.loading")}</div> : null}
    </div>
  );
}
