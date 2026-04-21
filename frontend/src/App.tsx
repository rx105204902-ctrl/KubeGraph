import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchManifest, fetchNamespaces, fetchNeighbors, fetchNodeDetail, searchResources } from "./api";
import {
  buildLogContext,
  createFriendlyError,
  describeNode,
  findShortestPath,
  matchesNode,
  mergeUniqueById,
  normalizeGraphData
} from "./graph-utils";
import { DebugPanel } from "./components/DebugPanel";
import { DetailPanel } from "./components/DetailPanel";
import { EdgeFilterBar } from "./components/EdgeFilterBar";
import { GraphCanvas } from "./components/GraphCanvas";
import { GraphToolbar } from "./components/GraphToolbar";
import { NamespaceSelector } from "./components/NamespaceSelector";
import { SearchPanel } from "./components/SearchPanel";
import type {
  GraphEdge,
  GraphExpansionRecord,
  GraphLayoutMode,
  GraphLogEntry,
  GraphLogLevel,
  GraphLogScope,
  GraphNode,
  GraphPathResult,
  GraphPerformanceSnapshot,
  ManifestPayload,
  NamespaceOption,
  NodeDetail,
  ThemeMode
} from "./types";
import { SUPPORTED_EDGE_TYPES } from "./types";

const defaultNamespaceFromEnv = import.meta.env.VITE_DEFAULT_NAMESPACE ?? "default";

type Notice = {
  tone: "info" | "success" | "warning" | "error";
  title: string;
  description: string;
};

type GraphDataState = {
  namespaces: NamespaceOption[];
  searchResults: GraphNode[];
  baseGraph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  expansions: Record<string, GraphExpansionRecord>;
  rootNodeId: string | null;
  lastRequest: { node: GraphNode; reset: boolean } | null;
};

type InteractionState = {
  selectedNamespace: string;
  query: string;
  kind: string;
  graphFilterQuery: string;
  activeEdgeTypes: string[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  layoutMode: GraphLayoutMode;
  themeMode: ThemeMode;
  debugMode: boolean;
  showOnlyMatches: boolean;
  fitRequestToken: number;
  pathStartId: string | null;
  pathEndId: string | null;
};

type PanelState = {
  nodeDetail: NodeDetail | null;
  manifest: ManifestPayload | null;
  graphError: string | null;
  notice: Notice | null;
};

type LoadingState = {
  namespaces: boolean;
  search: boolean;
  graph: boolean;
  detail: boolean;
  manifest: boolean;
};

const initialMetrics: GraphPerformanceSnapshot = {
  normalizationMs: 0,
  lastLayoutMs: null,
  fps: null,
  renderNodeCount: 0,
  renderEdgeCount: 0,
  hiddenNodeCount: 0,
  hiddenEdgeCount: 0,
  anomalyCount: 0
};

function getInitialThemeMode(): ThemeMode {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

function createLogEntry(
  level: GraphLogLevel,
  scope: GraphLogScope,
  message: string,
  context?: Record<string, unknown>
): GraphLogEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    scope,
    message,
    timestamp: Date.now(),
    context: buildLogContext(context)
  };
}

export default function App() {
  const [graphDataState, setGraphDataState] = useState<GraphDataState>({
    namespaces: [],
    searchResults: [],
    baseGraph: { nodes: [], edges: [] },
    expansions: {},
    rootNodeId: null,
    lastRequest: null
  });
  const [interactionState, setInteractionState] = useState<InteractionState>({
    selectedNamespace: defaultNamespaceFromEnv,
    query: "",
    kind: "",
    graphFilterQuery: "",
    activeEdgeTypes: [...SUPPORTED_EDGE_TYPES],
    selectedNodeId: null,
    selectedEdgeId: null,
    layoutMode: "force",
    themeMode: getInitialThemeMode(),
    debugMode: false,
    showOnlyMatches: false,
    fitRequestToken: 0,
    pathStartId: null,
    pathEndId: null
  });
  const [panelState, setPanelState] = useState<PanelState>({
    nodeDetail: null,
    manifest: null,
    graphError: null,
    notice: null
  });
  const [loadingState, setLoadingState] = useState<LoadingState>({
    namespaces: false,
    search: false,
    graph: false,
    detail: false,
    manifest: false
  });
  const [logs, setLogs] = useState<GraphLogEntry[]>([]);
  const [metrics, setMetrics] = useState<GraphPerformanceSnapshot>(initialMetrics);
  const [pathResult, setPathResult] = useState<GraphPathResult | null>(null);
  const lastAnomalySignatureRef = useRef("");

  const appendLog = useCallback(
    (level: GraphLogLevel, scope: GraphLogScope, message: string, context?: Record<string, unknown>) => {
      setLogs((current) => [createLogEntry(level, scope, message, context), ...current].slice(0, 40));
    },
    []
  );

  const updateMetrics = useCallback((partial: Partial<GraphPerformanceSnapshot>) => {
    setMetrics((current) => ({ ...current, ...partial }));
  }, []);

  const rawGraphNodes = useMemo(
    () =>
      mergeUniqueById([
        ...graphDataState.baseGraph.nodes,
        ...Object.values(graphDataState.expansions).flatMap((record) => record.nodes)
      ]),
    [graphDataState.baseGraph.nodes, graphDataState.expansions]
  );

  const rawGraphEdges = useMemo(
    () =>
      mergeUniqueById([
        ...graphDataState.baseGraph.edges,
        ...Object.values(graphDataState.expansions).flatMap((record) => record.edges)
      ]),
    [graphDataState.baseGraph.edges, graphDataState.expansions]
  );

  const normalizedGraph = useMemo(() => normalizeGraphData(rawGraphNodes, rawGraphEdges), [rawGraphEdges, rawGraphNodes]);
  const selectedNode = useMemo(
    () => normalizedGraph.nodes.find((node) => node.id === interactionState.selectedNodeId) ?? null,
    [interactionState.selectedNodeId, normalizedGraph.nodes]
  );
  const selectedEdge = useMemo(
    () => normalizedGraph.edges.find((edge) => edge.id === interactionState.selectedEdgeId) ?? null,
    [interactionState.selectedEdgeId, normalizedGraph.edges]
  );
  const isSelectedNodeExpanded = Boolean(selectedNode && graphDataState.expansions[selectedNode.id]);

  const activeEdges = useMemo(
    () => normalizedGraph.edges.filter((edge) => interactionState.activeEdgeTypes.includes(edge.type)),
    [interactionState.activeEdgeTypes, normalizedGraph.edges]
  );

  const matchedNodeIds = useMemo(() => {
    if (interactionState.graphFilterQuery.trim() === "") {
      return [];
    }

    return normalizedGraph.nodes.filter((node) => matchesNode(node, interactionState.graphFilterQuery)).map((node) => node.id);
  }, [interactionState.graphFilterQuery, normalizedGraph.nodes]);

  const pathNodeIds = pathResult?.found ? pathResult.nodeIds : [];
  const pathEdgeIds = pathResult?.found ? pathResult.edgeIds : [];
  const matchedNodeIdSet = useMemo(() => new Set(matchedNodeIds), [matchedNodeIds]);
  const pathEdgeIdSet = useMemo(() => new Set(pathEdgeIds), [pathEdgeIds]);

  const visibleGraph = useMemo(() => {
    const importantNodeIds = new Set<string>();
    if (graphDataState.rootNodeId) {
      importantNodeIds.add(graphDataState.rootNodeId);
    }
    if (interactionState.selectedNodeId) {
      importantNodeIds.add(interactionState.selectedNodeId);
    }
    if (selectedEdge) {
      importantNodeIds.add(selectedEdge.source);
      importantNodeIds.add(selectedEdge.target);
    }
    pathNodeIds.forEach((nodeId) => importantNodeIds.add(nodeId));

    const shouldOnlyShowMatches = interactionState.showOnlyMatches && interactionState.graphFilterQuery.trim() !== "";
    const visibleEdges = shouldOnlyShowMatches
      ? activeEdges.filter(
          (edge) =>
            matchedNodeIdSet.has(edge.source) ||
            matchedNodeIdSet.has(edge.target) ||
            pathEdgeIdSet.has(edge.id) ||
            edge.id === interactionState.selectedEdgeId
        )
      : activeEdges;

    const visibleNodeIds = new Set<string>(importantNodeIds);
    if (visibleEdges.length === 0) {
      if (shouldOnlyShowMatches) {
        matchedNodeIds.forEach((nodeId) => visibleNodeIds.add(nodeId));
      } else {
        normalizedGraph.nodes.forEach((node) => visibleNodeIds.add(node.id));
      }
    } else {
      visibleEdges.forEach((edge) => {
        visibleNodeIds.add(edge.source);
        visibleNodeIds.add(edge.target);
      });
      if (shouldOnlyShowMatches) {
        matchedNodeIds.forEach((nodeId) => visibleNodeIds.add(nodeId));
      }
    }

    return {
      nodes: normalizedGraph.nodes.filter((node) => visibleNodeIds.has(node.id)),
      edges: visibleEdges
    };
  }, [
    activeEdges,
    graphDataState.rootNodeId,
    interactionState.graphFilterQuery,
    interactionState.selectedEdgeId,
    interactionState.selectedNodeId,
    interactionState.showOnlyMatches,
    matchedNodeIdSet,
    matchedNodeIds,
    normalizedGraph.nodes,
    pathEdgeIdSet,
    pathNodeIds,
    selectedEdge
  ]);

  const pathStartNode = useMemo(
    () => normalizedGraph.nodes.find((node) => node.id === interactionState.pathStartId) ?? null,
    [interactionState.pathStartId, normalizedGraph.nodes]
  );
  const pathEndNode = useMemo(
    () => normalizedGraph.nodes.find((node) => node.id === interactionState.pathEndId) ?? null,
    [interactionState.pathEndId, normalizedGraph.nodes]
  );

  useEffect(() => {
    updateMetrics({
      normalizationMs: normalizedGraph.normalizationMs,
      anomalyCount: normalizedGraph.anomalies.length,
      hiddenNodeCount: Math.max(0, normalizedGraph.nodes.length - visibleGraph.nodes.length),
      hiddenEdgeCount: Math.max(0, normalizedGraph.edges.length - visibleGraph.edges.length),
      renderNodeCount: visibleGraph.nodes.length,
      renderEdgeCount: visibleGraph.edges.length
    });
  }, [normalizedGraph, updateMetrics, visibleGraph.edges.length, visibleGraph.nodes.length]);

  useEffect(() => {
    const anomalySignature = normalizedGraph.anomalies.map((item) => item.id).join("|");
    if (anomalySignature !== "" && anomalySignature !== lastAnomalySignatureRef.current) {
      appendLog("warn", "graph", "Graph normalization skipped invalid or duplicate elements.", {
        anomalies: normalizedGraph.anomalies.length
      });
      lastAnomalySignatureRef.current = anomalySignature;
    }
  }, [appendLog, normalizedGraph.anomalies]);

  useEffect(() => {
    let cancelled = false;
    setLoadingState((current) => ({ ...current, namespaces: true }));
    appendLog("info", "fetch", "Loading namespaces.");

    fetchNamespaces()
      .then((response) => {
        if (cancelled) {
          return;
        }

        setGraphDataState((current) => ({ ...current, namespaces: response.items }));
        setInteractionState((current) => ({
          ...current,
          selectedNamespace: response.items.some((item) => item.name === current.selectedNamespace)
            ? current.selectedNamespace
            : response.defaultNamespace || response.items[0]?.name || defaultNamespaceFromEnv
        }));
      })
      .catch((requestError: Error) => {
        if (cancelled) {
          return;
        }

        const message = createFriendlyError("namespace", requestError.message);
        setPanelState((current) => ({
          ...current,
          notice: { tone: "error", title: "Namespaces unavailable", description: message }
        }));
        appendLog("error", "fetch", "Namespace request failed.", { message: requestError.message });
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingState((current) => ({ ...current, namespaces: false }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appendLog]);

  useEffect(() => {
    const nodeIds = new Set(normalizedGraph.nodes.map((node) => node.id));
    const edgeIds = new Set(normalizedGraph.edges.map((edge) => edge.id));

    setInteractionState((current) => {
      let changed = false;
      const nextState = { ...current };

      if (current.selectedNodeId && !nodeIds.has(current.selectedNodeId)) {
        nextState.selectedNodeId = null;
        changed = true;
      }
      if (current.selectedEdgeId && !edgeIds.has(current.selectedEdgeId)) {
        nextState.selectedEdgeId = null;
        changed = true;
      }
      if (current.pathStartId && !nodeIds.has(current.pathStartId)) {
        nextState.pathStartId = null;
        changed = true;
      }
      if (current.pathEndId && !nodeIds.has(current.pathEndId)) {
        nextState.pathEndId = null;
        changed = true;
      }

      return changed ? nextState : current;
    });
  }, [normalizedGraph.edges, normalizedGraph.nodes]);

  useEffect(() => {
    if (!selectedNode) {
      setPanelState((current) => ({ ...current, nodeDetail: null, manifest: null }));
      return;
    }

    let cancelled = false;
    setLoadingState((current) => ({ ...current, detail: true }));
    appendLog("info", "fetch", "Loading node details.", { nodeId: selectedNode.id });

    fetchNodeDetail(selectedNode.kind, selectedNode.name, selectedNode.namespace)
      .then((response) => {
        if (!cancelled) {
          setPanelState((current) => ({ ...current, nodeDetail: response }));
        }
      })
      .catch((requestError: Error) => {
        if (cancelled) {
          return;
        }

        setPanelState((current) => ({
          ...current,
          notice: {
            tone: "warning",
            title: "Details unavailable",
            description: createFriendlyError("detail", requestError.message)
          }
        }));
        appendLog("error", "fetch", "Detail request failed.", { nodeId: selectedNode.id, message: requestError.message });
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingState((current) => ({ ...current, detail: false }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appendLog, selectedNode]);

  const resetGraphWorkspace = useCallback((clearSearchResults: boolean) => {
    setGraphDataState((current) => ({
      ...current,
      searchResults: clearSearchResults ? [] : current.searchResults,
      baseGraph: { nodes: [], edges: [] },
      expansions: {},
      rootNodeId: null,
      lastRequest: null
    }));
    setInteractionState((current) => ({
      ...current,
      selectedNodeId: null,
      selectedEdgeId: null,
      graphFilterQuery: "",
      showOnlyMatches: false,
      pathStartId: null,
      pathEndId: null
    }));
    setPanelState((current) => ({ ...current, nodeDetail: null, manifest: null, graphError: null }));
    setPathResult(null);
  }, []);

  const loadGraphForNode = useCallback(
    async (node: GraphNode, reset: boolean) => {
      setLoadingState((current) => ({ ...current, graph: true }));
      setPanelState((current) => ({ ...current, graphError: null, notice: null, manifest: null }));
      appendLog("info", "fetch", reset ? "Loading graph root." : "Expanding graph neighbors.", {
        nodeId: node.id,
        reset,
        namespace: interactionState.selectedNamespace
      });

      try {
        const payload = await fetchNeighbors(
          interactionState.selectedNamespace,
          node.kind,
          node.name,
          [...SUPPORTED_EDGE_TYPES]
        );

        setGraphDataState((current) => ({
          ...current,
          baseGraph: reset ? { nodes: payload.nodes, edges: payload.edges } : current.baseGraph,
          expansions: reset
            ? {}
            : {
                ...current.expansions,
                [node.id]: {
                  originNodeId: node.id,
                  nodes: payload.nodes,
                  edges: payload.edges,
                  fetchedAt: Date.now()
                }
              },
          rootNodeId: reset ? payload.center.id : current.rootNodeId,
          lastRequest: { node, reset }
        }));
        setInteractionState((current) => ({
          ...current,
          selectedNodeId: payload.center.id,
          selectedEdgeId: null,
          fitRequestToken: reset ? current.fitRequestToken + 1 : current.fitRequestToken,
          pathStartId: reset ? null : current.pathStartId,
          pathEndId: reset ? null : current.pathEndId
        }));
        setPathResult(null);
        appendLog("info", "graph", "Graph data ready.", {
          nodeId: node.id,
          nodes: payload.nodes.length,
          edges: payload.edges.length,
          reset
        });
      } catch (requestError) {
        const message = createFriendlyError("graph", (requestError as Error).message);
        setPanelState((current) => ({ ...current, graphError: message }));
        appendLog("error", "fetch", "Graph request failed.", { nodeId: node.id, message: (requestError as Error).message });
      } finally {
        setLoadingState((current) => ({ ...current, graph: false }));
      }
    },
    [appendLog, interactionState.selectedNamespace]
  );

  async function handleSearch() {
    if (!interactionState.selectedNamespace) {
      return;
    }

    setLoadingState((current) => ({ ...current, search: true }));
    setPanelState((current) => ({ ...current, notice: null }));
    appendLog("info", "fetch", "Searching resources.", {
      query: interactionState.query,
      kind: interactionState.kind || "all",
      namespace: interactionState.selectedNamespace
    });
    try {
      const response = await searchResources(
        interactionState.selectedNamespace,
        interactionState.query,
        interactionState.kind
      );
      setGraphDataState((current) => ({ ...current, searchResults: response.items }));
      if (response.items.length === 0) {
        setPanelState((current) => ({
          ...current,
          notice: {
            tone: "info",
            title: "No resources found",
            description: "Try a broader query or switch to another namespace."
          }
        }));
      }
    } catch (requestError) {
      const message = createFriendlyError("search", (requestError as Error).message);
      setPanelState((current) => ({
        ...current,
        notice: { tone: "error", title: "Search failed", description: message }
      }));
      appendLog("error", "fetch", "Search request failed.", { message: (requestError as Error).message });
    } finally {
      setLoadingState((current) => ({ ...current, search: false }));
    }
  }

  function handleSelectSearchResult(node: GraphNode) {
    void loadGraphForNode(node, true);
  }

  function handleNamespaceChange(namespace: string) {
    setInteractionState((current) => ({
      ...current,
      selectedNamespace: namespace,
      query: "",
      kind: "",
      selectedNodeId: null,
      selectedEdgeId: null,
      graphFilterQuery: "",
      pathStartId: null,
      pathEndId: null,
      showOnlyMatches: false
    }));
    resetGraphWorkspace(true);
    appendLog("info", "ui", "Namespace changed.", { namespace });
  }

  function handleNodeSelect(nodeId: string) {
    setInteractionState((current) => ({ ...current, selectedNodeId: nodeId, selectedEdgeId: null }));
  }

  function handleEdgeSelect(edgeId: string) {
    setInteractionState((current) => ({ ...current, selectedNodeId: null, selectedEdgeId: edgeId }));
  }

  function handleClearSelection() {
    setInteractionState((current) => ({ ...current, selectedNodeId: null, selectedEdgeId: null }));
  }

  function handleToggleEdgeType(edgeType: string) {
    setInteractionState((current) => ({
      ...current,
      activeEdgeTypes: current.activeEdgeTypes.includes(edgeType)
        ? current.activeEdgeTypes.filter((item) => item !== edgeType)
        : [...current.activeEdgeTypes, edgeType]
    }));
  }

  function handleEnableAllEdgeTypes() {
    setInteractionState((current) => ({ ...current, activeEdgeTypes: [...SUPPORTED_EDGE_TYPES] }));
  }

  function handleClearAllEdgeTypes() {
    setInteractionState((current) => ({ ...current, activeEdgeTypes: [] }));
  }

  function handleCollapseSelected() {
    if (!selectedNode || !graphDataState.expansions[selectedNode.id]) {
      return;
    }

    setGraphDataState((current) => {
      const nextExpansions = { ...current.expansions };
      delete nextExpansions[selectedNode.id];
      return { ...current, expansions: nextExpansions };
    });
    setPathResult(null);
    appendLog("info", "graph", "Collapsed subgraph.", { nodeId: selectedNode.id });
  }

  function handleExpandSelected() {
    if (!selectedNode || isSelectedNodeExpanded) {
      return;
    }

    void loadGraphForNode(selectedNode, false);
  }

  function handleRetryGraph() {
    if (!graphDataState.lastRequest) {
      return;
    }

    void loadGraphForNode(graphDataState.lastRequest.node, graphDataState.lastRequest.reset);
  }

  function handleSetPathStart() {
    if (!selectedNode) {
      return;
    }

    setInteractionState((current) => ({ ...current, pathStartId: selectedNode.id }));
    appendLog("info", "path", "Path start selected.", { nodeId: selectedNode.id });
  }

  function handleSetPathEnd() {
    if (!selectedNode) {
      return;
    }

    setInteractionState((current) => ({ ...current, pathEndId: selectedNode.id }));
    appendLog("info", "path", "Path end selected.", { nodeId: selectedNode.id });
  }

  function handleRunPathAnalysis() {
    if (!interactionState.pathStartId || !interactionState.pathEndId) {
      setPanelState((current) => ({
        ...current,
        notice: {
          tone: "warning",
          title: "Select two nodes first",
          description: "Choose both a path start and a path end before running shortest path analysis."
        }
      }));
      return;
    }

    const result = findShortestPath(normalizedGraph.nodes, activeEdges, interactionState.pathStartId, interactionState.pathEndId);
    setPathResult(result);
    setPanelState((current) => ({
      ...current,
      notice: result.found
        ? {
            tone: "success",
            title: "Path highlighted",
            description: `Found a path with ${result.edgeIds.length} hops between the selected resources.`
          }
        : {
            tone: "warning",
            title: "No path found",
            description: "The current graph does not contain a path between the selected resources. Expand the graph or relax filters and try again."
          }
    }));
    appendLog("info", "path", result.found ? "Shortest path highlighted." : "No path found.", {
      startId: interactionState.pathStartId,
      endId: interactionState.pathEndId,
      found: result.found,
      hops: result.edgeIds.length
    });
  }

  function handleClearPath() {
    setInteractionState((current) => ({ ...current, pathStartId: null, pathEndId: null }));
    setPathResult(null);
  }

  async function handleLoadManifest() {
    const node = panelState.nodeDetail?.node ?? selectedNode;
    if (!node) {
      return;
    }

    setLoadingState((current) => ({ ...current, manifest: true }));
    appendLog("info", "fetch", "Loading manifest.", { nodeId: node.id });
    try {
      const response = await fetchManifest(node.kind, node.name, node.namespace);
      setPanelState((current) => ({ ...current, manifest: response }));
    } catch (requestError) {
      setPanelState((current) => ({
        ...current,
        notice: {
          tone: "warning",
          title: "Manifest unavailable",
          description: createFriendlyError("manifest", (requestError as Error).message)
        }
      }));
      appendLog("error", "fetch", "Manifest request failed.", { nodeId: node.id, message: (requestError as Error).message });
    } finally {
      setLoadingState((current) => ({ ...current, manifest: false }));
    }
  }

  const notice = panelState.notice;
  const pathStartLabel = pathStartNode ? describeNode(pathStartNode) : null;
  const pathEndLabel = pathEndNode ? describeNode(pathEndNode) : null;
  const graphEmptyState = useMemo(() => {
    if (panelState.graphError) {
      return { title: "Graph unavailable", description: panelState.graphError };
    }
    if (graphDataState.rootNodeId === null) {
      return {
        title: "Start from a resource",
        description: "Search for a resource in the selected namespace and open it to build the graph."
      };
    }
    if (interactionState.showOnlyMatches && interactionState.graphFilterQuery.trim() !== "" && visibleGraph.nodes.length === 0) {
      return {
        title: "No visible matches",
        description: "Relax the graph filter or turn off “Only show matches” to reveal more of the graph."
      };
    }
    return {
      title: "No graph data",
      description: "Expand another node or adjust filters to continue exploring the graph."
    };
  }, [
    graphDataState.rootNodeId,
    interactionState.graphFilterQuery,
    interactionState.showOnlyMatches,
    panelState.graphError,
    visibleGraph.nodes.length
  ]);

  return (
    <div className={`app-shell theme-${interactionState.themeMode}`}>
      <header className="app-header">
        <div>
          <h1>kube-graph</h1>
          <p>Stable namespace-scoped Kubernetes graph exploration with diagnostics, path analysis and responsive workspace controls.</p>
        </div>
        <div className="header-stats">
          <span className="info-chip">{normalizedGraph.nodes.length} total nodes</span>
          <span className="info-chip">{normalizedGraph.edges.length} total edges</span>
          <span className="info-chip">{Object.keys(graphDataState.expansions).length} expanded subgraphs</span>
        </div>
      </header>

      {notice ? (
        <div className={`notice-banner notice-banner--${notice.tone}`}>
          <div>
            <strong>{notice.title}</strong>
            <p>{notice.description}</p>
          </div>
          <button className="text-button" onClick={() => setPanelState((current) => ({ ...current, notice: null }))}>
            Dismiss
          </button>
        </div>
      ) : null}

      <main className="workspace-grid">
        <aside className="workspace-sidebar">
          <NamespaceSelector
            namespaces={graphDataState.namespaces}
            selectedNamespace={interactionState.selectedNamespace}
            loading={loadingState.namespaces}
            onChange={handleNamespaceChange}
          />
          <SearchPanel
            query={interactionState.query}
            kind={interactionState.kind}
            loading={loadingState.search}
            results={graphDataState.searchResults}
            onQueryChange={(value) => setInteractionState((current) => ({ ...current, query: value }))}
            onKindChange={(value) => setInteractionState((current) => ({ ...current, kind: value }))}
            onSearch={handleSearch}
            onSelect={handleSelectSearchResult}
          />
          <EdgeFilterBar
            activeEdgeTypes={interactionState.activeEdgeTypes}
            onToggle={handleToggleEdgeType}
            onEnableAll={handleEnableAllEdgeTypes}
            onClearAll={handleClearAllEdgeTypes}
          />
        </aside>

        <section className="workspace-main">
          <GraphToolbar
            layoutMode={interactionState.layoutMode}
            themeMode={interactionState.themeMode}
            debugMode={interactionState.debugMode}
            filterQuery={interactionState.graphFilterQuery}
            showOnlyMatches={interactionState.showOnlyMatches}
            selectedNode={selectedNode}
            isSelectedNodeExpanded={isSelectedNodeExpanded}
            pathStartLabel={pathStartLabel}
            pathEndLabel={pathEndLabel}
            visibleNodeCount={visibleGraph.nodes.length}
            visibleEdgeCount={visibleGraph.edges.length}
            onLayoutModeChange={(mode) => setInteractionState((current) => ({ ...current, layoutMode: mode }))}
            onThemeToggle={() =>
              setInteractionState((current) => ({
                ...current,
                themeMode: current.themeMode === "dark" ? "light" : "dark"
              }))
            }
            onDebugToggle={() => setInteractionState((current) => ({ ...current, debugMode: !current.debugMode }))}
            onFilterQueryChange={(value) => setInteractionState((current) => ({ ...current, graphFilterQuery: value }))}
            onShowOnlyMatchesChange={(value) => setInteractionState((current) => ({ ...current, showOnlyMatches: value }))}
            onFitView={() =>
              setInteractionState((current) => ({ ...current, fitRequestToken: current.fitRequestToken + 1 }))
            }
            onExpandSelected={handleExpandSelected}
            onCollapseSelected={handleCollapseSelected}
            onSetPathStart={handleSetPathStart}
            onSetPathEnd={handleSetPathEnd}
            onRunPathAnalysis={handleRunPathAnalysis}
            onClearPath={handleClearPath}
          />

          <div className="panel-card graph-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Resource graph</div>
                <p className="panel-description">Use layout switching, filters, path analysis and debug mode to inspect graph stability.</p>
              </div>
            </div>

            <GraphCanvas
              nodes={visibleGraph.nodes}
              edges={visibleGraph.edges}
              selectedNodeId={interactionState.selectedNodeId}
              selectedEdgeId={interactionState.selectedEdgeId}
              layoutMode={interactionState.layoutMode}
              themeMode={interactionState.themeMode}
              debugMode={interactionState.debugMode}
              loading={loadingState.graph}
              errorMessage={panelState.graphError}
              emptyTitle={graphEmptyState.title}
              emptyDescription={graphEmptyState.description}
              matchedNodeIds={matchedNodeIds}
              pathNodeIds={pathNodeIds}
              pathEdgeIds={pathEdgeIds}
              fitRequestToken={interactionState.fitRequestToken}
              onNodeSelect={handleNodeSelect}
              onEdgeSelect={handleEdgeSelect}
              onClearSelection={handleClearSelection}
              onRetry={handleRetryGraph}
              onMetricsChange={updateMetrics}
              onLog={appendLog}
            />
          </div>
        </section>

        <aside className="workspace-details">
          <DetailPanel
            selectedNode={selectedNode}
            nodeDetail={panelState.nodeDetail}
            manifest={panelState.manifest}
            selectedEdge={selectedEdge}
            detailLoading={loadingState.detail}
            manifestLoading={loadingState.manifest}
            debugMode={interactionState.debugMode}
            isSelectedNodeExpanded={isSelectedNodeExpanded}
            pathStartId={interactionState.pathStartId}
            pathEndId={interactionState.pathEndId}
            pathResult={pathResult}
            onLoadManifest={handleLoadManifest}
            onExpandNode={handleExpandSelected}
            onCollapseNode={handleCollapseSelected}
            onSetPathStart={handleSetPathStart}
            onSetPathEnd={handleSetPathEnd}
            onRunPathAnalysis={handleRunPathAnalysis}
            onClearPath={handleClearPath}
          />

          <DebugPanel
            visible={interactionState.debugMode}
            anomalies={normalizedGraph.anomalies}
            logs={logs}
            metrics={metrics}
            totalNodeCount={normalizedGraph.nodes.length}
            totalEdgeCount={normalizedGraph.edges.length}
            expandedNodeCount={Object.keys(graphDataState.expansions).length}
            layoutMode={interactionState.layoutMode}
            themeMode={interactionState.themeMode}
          />
        </aside>
      </main>
    </div>
  );
}
