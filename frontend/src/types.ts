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

export type GraphLayoutMode = "force" | "hierarchical" | "circular";

export type ThemeMode = "light" | "dark";

export type GraphLogLevel = "info" | "warn" | "error";

export type GraphLogScope = "fetch" | "graph" | "layout" | "path" | "ui";

export type GraphAnomalyKind = "duplicate-node" | "duplicate-edge" | "dangling-edge";

export type GraphAnomaly = {
  id: string;
  kind: GraphAnomalyKind;
  severity: "warning" | "error";
  message: string;
  relatedId?: string;
};

export type GraphLogEntry = {
  id: string;
  level: GraphLogLevel;
  scope: GraphLogScope;
  message: string;
  timestamp: number;
  context?: Record<string, string | number | boolean | null>;
};

export type GraphPerformanceSnapshot = {
  normalizationMs: number;
  lastLayoutMs: number | null;
  fps: number | null;
  renderNodeCount: number;
  renderEdgeCount: number;
  hiddenNodeCount: number;
  hiddenEdgeCount: number;
  anomalyCount: number;
};

export type GraphPathResult = {
  startId: string;
  endId: string;
  nodeIds: string[];
  edgeIds: string[];
  found: boolean;
};

export type GraphExpansionRecord = {
  originNodeId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  fetchedAt: number;
};

export const GRAPH_LAYOUT_OPTIONS: Array<{ value: GraphLayoutMode; label: string }> = [
  { value: "force", label: "Force" },
  { value: "hierarchical", label: "Hierarchical" },
  { value: "circular", label: "Circular" }
];

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
