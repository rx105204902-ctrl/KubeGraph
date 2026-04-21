import { useEffect, useMemo, useState } from "react";
import { fetchManifest, fetchNamespaces, fetchNeighbors, fetchNodeDetail, searchResources } from "./api";
import { DetailPanel } from "./components/DetailPanel";
import { EdgeFilterBar } from "./components/EdgeFilterBar";
import { GraphCanvas } from "./components/GraphCanvas";
import { NamespaceSelector } from "./components/NamespaceSelector";
import { SearchPanel } from "./components/SearchPanel";
import type {
  GraphEdge,
  GraphNode,
  ManifestPayload,
  NamespaceOption,
  NodeDetail
} from "./types";
import { SUPPORTED_EDGE_TYPES } from "./types";

const defaultNamespaceFromEnv = import.meta.env.VITE_DEFAULT_NAMESPACE ?? "default";

function mergeById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export default function App() {
  const [namespaces, setNamespaces] = useState<NamespaceOption[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState(defaultNamespaceFromEnv);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [searchResults, setSearchResults] = useState<GraphNode[]>([]);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [nodeDetail, setNodeDetail] = useState<NodeDetail | null>(null);
  const [manifest, setManifest] = useState<ManifestPayload | null>(null);
  const [activeEdgeTypes, setActiveEdgeTypes] = useState<string[]>([...SUPPORTED_EDGE_TYPES]);
  const [namespaceLoading, setNamespaceLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [manifestLoading, setManifestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setNamespaceLoading(true);
    fetchNamespaces()
      .then((response) => {
        if (cancelled) {
          return;
        }

        setNamespaces(response.items);
        const preferredNamespace = response.items.some((item) => item.name === selectedNamespace)
          ? selectedNamespace
          : response.defaultNamespace || response.items[0]?.name || defaultNamespaceFromEnv;
        setSelectedNamespace(preferredNamespace);
      })
      .catch((requestError: Error) => {
        if (!cancelled) {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setNamespaceLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedNamespace]);

  useEffect(() => {
    if (!selectedNodeId) {
      setNodeDetail(null);
      setManifest(null);
      return;
    }

    const selectedNode = graphNodes.find((node) => node.id === selectedNodeId);
    if (!selectedNode) {
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    fetchNodeDetail(selectedNode.kind, selectedNode.name, selectedNode.namespace)
      .then((response) => {
        if (!cancelled) {
          setNodeDetail(response);
        }
      })
      .catch((requestError: Error) => {
        if (!cancelled) {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [graphNodes, selectedNodeId]);

  const selectedEdge = useMemo(
    () => graphEdges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [graphEdges, selectedEdgeId]
  );

  const visibleEdges = useMemo(
    () => graphEdges.filter((edge) => activeEdgeTypes.includes(edge.type)),
    [activeEdgeTypes, graphEdges]
  );

  const visibleNodes = useMemo(() => {
    if (visibleEdges.length === 0) {
      return graphNodes;
    }

    const ids = new Set<string>();
    visibleEdges.forEach((edge) => {
      ids.add(edge.source);
      ids.add(edge.target);
    });
    if (selectedNodeId) {
      ids.add(selectedNodeId);
    }
    if (selectedEdge) {
      ids.add(selectedEdge.source);
      ids.add(selectedEdge.target);
    }

    return graphNodes.filter((node) => ids.has(node.id));
  }, [graphNodes, selectedEdge, selectedNodeId, visibleEdges]);

  async function handleSearch() {
    if (!selectedNamespace) {
      return;
    }

    setSearchLoading(true);
    setError(null);
    try {
      const response = await searchResources(selectedNamespace, query, kind);
      setSearchResults(response.items);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setSearchLoading(false);
    }
  }

  async function expandNode(node: GraphNode, reset: boolean) {
    setError(null);
    try {
      const payload = await fetchNeighbors(selectedNamespace, node.kind, node.name, activeEdgeTypes);
      setSelectedNodeId(payload.center.id);
      setSelectedEdgeId(null);
      setManifest(null);
      setGraphNodes((current) => (reset ? mergeById(payload.nodes) : mergeById([...current, ...payload.nodes])));
      setGraphEdges((current) => (reset ? mergeById(payload.edges) : mergeById([...current, ...payload.edges])));
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  }

  function handleSelectSearchResult(node: GraphNode) {
    void expandNode(node, true);
  }

  function handleNodeSelect(nodeId: string) {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
  }

  function handleNodeExpand(nodeId: string) {
    const node = graphNodes.find((item) => item.id === nodeId);
    if (node) {
      void expandNode(node, false);
    }
  }

  function handleEdgeSelect(edgeId: string) {
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
  }

  function handleClearSelection() {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }

  function handleToggleEdgeType(edgeType: string) {
    setActiveEdgeTypes((current) =>
      current.includes(edgeType) ? current.filter((item) => item !== edgeType) : [...current, edgeType]
    );
  }

  async function handleLoadManifest() {
    if (!nodeDetail) {
      return;
    }

    setManifestLoading(true);
    setError(null);
    try {
      const response = await fetchManifest(nodeDetail.node.kind, nodeDetail.node.name, nodeDetail.node.namespace);
      setManifest(response);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setManifestLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>kube-graph</h1>
          <p>Namespace-scoped Kubernetes resource graph exploration</p>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <main className="app-grid">
        <aside className="left-column">
          <NamespaceSelector
            namespaces={namespaces}
            selectedNamespace={selectedNamespace}
            loading={namespaceLoading}
            onChange={(namespace) => {
              setSelectedNamespace(namespace);
              setSearchResults([]);
              setGraphNodes([]);
              setGraphEdges([]);
              setSelectedNodeId(null);
              setSelectedEdgeId(null);
              setNodeDetail(null);
              setManifest(null);
            }}
          />
          <SearchPanel
            query={query}
            kind={kind}
            loading={searchLoading}
            results={searchResults}
            onQueryChange={setQuery}
            onKindChange={setKind}
            onSearch={handleSearch}
            onSelect={handleSelectSearchResult}
          />
          <EdgeFilterBar activeEdgeTypes={activeEdgeTypes} onToggle={handleToggleEdgeType} />
        </aside>

        <section className="center-column">
          <div className="panel-card graph-panel">
            <div className="panel-title">Graph</div>
            <GraphCanvas
              nodes={visibleNodes}
              edges={visibleEdges}
              selectedNodeId={selectedNodeId}
              selectedEdgeId={selectedEdgeId}
              onNodeSelect={handleNodeSelect}
              onNodeExpand={handleNodeExpand}
              onEdgeSelect={handleEdgeSelect}
              onClearSelection={handleClearSelection}
            />
          </div>
        </section>

        <aside className="right-column">
          <DetailPanel
            nodeDetail={nodeDetail}
            manifest={manifest}
            selectedEdge={selectedEdge}
            detailLoading={detailLoading}
            manifestLoading={manifestLoading}
            onLoadManifest={handleLoadManifest}
          />
        </aside>
      </main>
    </div>
  );
}
