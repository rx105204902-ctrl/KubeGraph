import type { NamespaceOption } from "../types";

type NamespaceSelectorProps = {
  namespaces: NamespaceOption[];
  selectedNamespace: string;
  loading: boolean;
  onChange: (namespace: string) => void;
};

export function NamespaceSelector({ namespaces, selectedNamespace, loading, onChange }: NamespaceSelectorProps) {
  return (
    <div className="panel-card">
      <div className="panel-header">
        <div>
          <div className="panel-title">Namespace</div>
          <p className="panel-description">Scope graph exploration to one Kubernetes namespace.</p>
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

      {loading ? <div className="field-hint">Loading namespaces…</div> : null}
    </div>
  );
}
