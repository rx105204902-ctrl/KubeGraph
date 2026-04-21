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
      <div className="panel-title">Namespace</div>
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
    </div>
  );
}
