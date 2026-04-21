export type NamespaceOption = {
  name: string;
};

export type GraphNode = {
  id: string;
  type: string;
  category: string;
  kind: string;
  namespace?: string;
  name: string;
  clusterScoped: boolean;
  labels?: Record<string, string>;
};

export type Evidence = {
  field: string;
  value?: string;
  description?: string;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
  category: string;
  reason: string;
  evidence?: Evidence[];
};

export type GraphPayload = {
  center: GraphNode;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type NodeDetail = {
  node: GraphNode;
  metadata?: Record<string, unknown>;
  status?: Record<string, unknown>;
};

export type ManifestPayload = {
  node: GraphNode;
  manifest: Record<string, unknown>;
};

export type NamespaceResponse = {
  defaultNamespace: string;
  items: NamespaceOption[];
};

export type SearchResponse = {
  items: GraphNode[];
};

export const SUPPORTED_KINDS = [
  "",
  "Ingress",
  "Service",
  "Deployment",
  "ReplicaSet",
  "Pod",
  "ConfigMap",
  "Secret",
  "PersistentVolumeClaim",
  "PersistentVolume",
  "ServiceAccount",
  "Node",
  "HorizontalPodAutoscaler"
] as const;

export const SUPPORTED_EDGE_TYPES = [
  "owns",
  "selects",
  "references",
  "mounts",
  "runs_on",
  "routes_to"
] as const;
