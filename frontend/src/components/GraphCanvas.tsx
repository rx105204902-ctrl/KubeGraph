import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import { LARGE_GRAPH_NODE_THRESHOLD, describeEdge, describeNode } from "../graph-utils";
import type {
  GraphEdge,
  GraphLayoutMode,
  GraphLogLevel,
  GraphLogScope,
  GraphNode,
  GraphPerformanceSnapshot,
  ThemeMode
} from "../types";

type GraphCanvasProps = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  layoutMode: GraphLayoutMode;
  themeMode: ThemeMode;
  debugMode: boolean;
  loading: boolean;
  errorMessage: string | null;
  emptyTitle: string;
  emptyDescription: string;
  matchedNodeIds: string[];
  pathNodeIds: string[];
  pathEdgeIds: string[];
  fitRequestToken: number;
  onNodeSelect: (id: string) => void;
  onEdgeSelect: (id: string) => void;
  onClearSelection: () => void;
  onRetry: () => void;
  onMetricsChange: (metrics: Partial<GraphPerformanceSnapshot>) => void;
  onLog: (
    level: GraphLogLevel,
    scope: GraphLogScope,
    message: string,
    context?: Record<string, string | number | boolean | null>
  ) => void;
};

type TooltipState = {
  title: string;
  subtitle: string;
  meta: string;
  x: number;
  y: number;
};

const nodeColors: Record<string, string> = {
  network: "#2563eb",
  workload: "#16a34a",
  config: "#7c3aed",
  storage: "#ea580c",
  identity: "#0f766e",
  runtime: "#64748b",
  autoscaling: "#db2777"
};

const edgeColors: Record<string, string> = {
  owns: "#1d4ed8",
  selects: "#0ea5e9",
  references: "#8b5cf6",
  mounts: "#f97316",
  runs_on: "#64748b",
  routes_to: "#22c55e"
};

const edgeLineStyles: Record<string, "solid" | "dashed"> = {
  owns: "solid",
  selects: "solid",
  references: "dashed",
  mounts: "solid",
  runs_on: "dashed",
  routes_to: "solid"
};

function buildElements(nodes: GraphNode[], edges: GraphEdge[], debugMode: boolean): ElementDefinition[] {
  const nodeElements: ElementDefinition[] = nodes.map((node) => ({
    data: {
      ...node,
      label: debugMode
        ? `${node.kind}\n${node.name}\n${node.namespace ?? "cluster"}\n#${node.id}`
        : node.namespace
          ? `${node.kind}\n${node.name}\n${node.namespace}`
          : `${node.kind}\n${node.name}`,
      color: nodeColors[node.category] ?? "#334155"
    }
  }));

  const edgeElements: ElementDefinition[] = edges.map((edge) => ({
    data: {
      ...edge,
      label: edge.type,
      color: edgeColors[edge.type] ?? "#475569",
      lineStyle: edgeLineStyles[edge.type] ?? "solid"
    }
  }));

  return [...nodeElements, ...edgeElements];
}

function buildStyles(themeMode: ThemeMode) {
  const isDark = themeMode === "dark";
  const nodeTextColor = isDark ? "#e2e8f0" : "#0f172a";
  const edgeTextColor = isDark ? "#cbd5e1" : "#334155";
  const tooltipBg = isDark ? "#0f172a" : "#ffffff";
  const borderColor = isDark ? "#1e293b" : "#ffffff";

  return [
    {
      selector: "node",
      style: {
        label: "data(label)",
        "background-color": "data(color)",
        color: nodeTextColor,
        "font-size": "10px",
        "text-wrap": "wrap",
        "text-max-width": 110,
        "text-valign": "bottom",
        "text-margin-y": 8,
        width: 40,
        height: 40,
        "border-width": 2,
        "border-color": borderColor
      }
    },
    {
      selector: "edge",
      style: {
        label: "data(label)",
        width: 2,
        "font-size": "9px",
        color: edgeTextColor,
        "curve-style": "bezier",
        "line-color": "data(color)",
        "target-arrow-color": "data(color)",
        "target-arrow-shape": "triangle",
        "line-style": "data(lineStyle)",
        "text-background-color": tooltipBg,
        "text-background-opacity": 0.9,
        "text-background-padding": 3
      }
    },
    {
      selector: ".selected",
      style: {
        "border-color": isDark ? "#f8fafc" : "#111827",
        width: 4,
        opacity: 1
      }
    },
    {
      selector: ".connected",
      style: {
        opacity: 1,
        width: 4
      }
    },
    {
      selector: ".dimmed",
      style: {
        opacity: 0.12
      }
    },
    {
      selector: ".matched",
      style: {
        "overlay-color": "#38bdf8",
        "overlay-opacity": 0.18,
        "overlay-padding": 10
      }
    },
    {
      selector: ".path",
      style: {
        "border-color": "#f59e0b",
        "line-color": "#f59e0b",
        "target-arrow-color": "#f59e0b",
        width: 5,
        opacity: 1,
        "z-index": 999
      }
    }
  ] as const;
}

function syncElements(cy: Core, elements: ElementDefinition[]) {
  const nextIds = new Set<string>();
  elements.forEach((element) => {
    const id = String(element.data?.id ?? "");
    if (id !== "") {
      nextIds.add(id);
    }
  });

  cy.startBatch();
  cy.elements().forEach((element) => {
    if (!nextIds.has(element.id())) {
      element.remove();
    }
  });

  elements.forEach((element) => {
    const id = String(element.data?.id ?? "");
    if (id === "") {
      return;
    }

    const existing = cy.getElementById(id);
    if (existing.length === 0) {
      cy.add(element);
      return;
    }

    const data = (element.data ?? {}) as Record<string, unknown>;
    if (existing.isEdge()) {
      const nextSource = String(data.source ?? "");
      const nextTarget = String(data.target ?? "");
      if (existing.data("source") !== nextSource || existing.data("target") !== nextTarget) {
        existing.remove();
        cy.add(element);
        return;
      }
    }

    Object.entries(data).forEach(([key, value]) => {
      existing.data(key, value);
    });
  });
  cy.endBatch();
}

function applyGraphState(
  cy: Core,
  selectedNodeId: string | null,
  selectedEdgeId: string | null,
  matchedNodeIds: string[],
  pathNodeIds: string[],
  pathEdgeIds: string[]
) {
  cy.elements().removeClass("selected connected dimmed matched path");

  matchedNodeIds.forEach((nodeId) => {
    cy.getElementById(nodeId).addClass("matched");
  });

  pathNodeIds.forEach((nodeId) => {
    cy.getElementById(nodeId).addClass("path");
  });

  pathEdgeIds.forEach((edgeId) => {
    cy.getElementById(edgeId).addClass("path");
  });

  if (selectedEdgeId) {
    const selectedEdge = cy.getElementById(selectedEdgeId);
    if (selectedEdge.length > 0) {
      cy.elements().addClass("dimmed");
      selectedEdge.removeClass("dimmed").addClass("selected path");
      selectedEdge.connectedNodes().removeClass("dimmed").addClass("connected");
      pathNodeIds.forEach((nodeId) => cy.getElementById(nodeId).removeClass("dimmed").addClass("path"));
      pathEdgeIds.forEach((edgeId) => cy.getElementById(edgeId).removeClass("dimmed").addClass("path"));
    }
    return;
  }

  if (selectedNodeId) {
    const selectedNode = cy.getElementById(selectedNodeId);
    if (selectedNode.length > 0) {
      cy.elements().addClass("dimmed");
      selectedNode.removeClass("dimmed").addClass("selected");
      const connectedEdges = selectedNode.connectedEdges();
      connectedEdges.removeClass("dimmed").addClass("connected");
      connectedEdges.connectedNodes().removeClass("dimmed").addClass("connected");
      pathNodeIds.forEach((nodeId) => cy.getElementById(nodeId).removeClass("dimmed").addClass("path"));
      pathEdgeIds.forEach((edgeId) => cy.getElementById(edgeId).removeClass("dimmed").addClass("path"));
      matchedNodeIds.forEach((nodeId) => cy.getElementById(nodeId).removeClass("dimmed").addClass("matched"));
    }
  }
}

function createTooltipForElement(element: cytoscape.SingularElementArgument, x: number, y: number): TooltipState {
  if (element.isNode()) {
    const data = element.data() as GraphNode;
    return {
      title: describeNode(data),
      subtitle: `Category: ${data.category}`,
      meta: `ID: ${data.id}`,
      x,
      y
    };
  }

  const data = element.data() as GraphEdge;
  return {
    title: data.type,
    subtitle: describeEdge(data),
    meta: `ID: ${data.id}`,
    x,
    y
  };
}

export function GraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  selectedEdgeId,
  layoutMode,
  themeMode,
  debugMode,
  loading,
  errorMessage,
  emptyTitle,
  emptyDescription,
  matchedNodeIds,
  pathNodeIds,
  pathEdgeIds,
  fitRequestToken,
  onNodeSelect,
  onEdgeSelect,
  onClearSelection,
  onRetry,
  onMetricsChange,
  onLog
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const lastLayoutModeRef = useRef<GraphLayoutMode>(layoutMode);
  const elements = useMemo(() => buildElements(nodes, edges, debugMode), [nodes, edges, debugMode]);
  const styles = useMemo(() => buildStyles(themeMode), [themeMode]);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: styles as never,
      minZoom: 0.2,
      maxZoom: 2.4,
      wheelSensitivity: 0.18
    });

    cy.on("tap", "node", (event) => {
      onNodeSelect(event.target.id());
    });

    cy.on("tap", "edge", (event) => {
      onEdgeSelect(event.target.id());
    });

    cy.on("tap", (event) => {
      if (event.target === cy) {
        onClearSelection();
      }
    });

    cy.on("mouseover mousemove", "node, edge", (event) => {
      const position = event.renderedPosition ?? { x: 0, y: 0 };
      setTooltip(createTooltipForElement(event.target, position.x, position.y));
    });

    cy.on("mouseout", "node, edge", () => {
      setTooltip(null);
    });

    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [onClearSelection, onEdgeSelect, onNodeSelect, styles]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    cy.style(styles as never);
  }, [styles]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    const previousNodeCount = cy.nodes().length;
    const shouldFit = previousNodeCount === 0 || lastLayoutModeRef.current !== layoutMode;
    const previousZoom = cy.zoom();
    const previousPan = cy.pan();

    syncElements(cy, elements);

    const graphIsLarge = nodes.length > LARGE_GRAPH_NODE_THRESHOLD;
    if (graphIsLarge) {
      onLog("warn", "layout", "Large graph detected; performance protection is active.", {
        nodeCount: nodes.length,
        edgeCount: edges.length
      });
    }

    const layoutStartedAt = performance.now();
    try {
      const layoutOptions =
        layoutMode === "hierarchical"
          ? {
              name: "breadthfirst",
              fit: shouldFit,
              directed: true,
              animate: false,
              padding: graphIsLarge ? 24 : 48,
              spacingFactor: graphIsLarge ? 0.85 : 1.15
            }
          : layoutMode === "circular"
            ? {
                name: "circle",
                fit: shouldFit,
                animate: false,
                padding: graphIsLarge ? 24 : 48,
                spacingFactor: graphIsLarge ? 0.8 : 1
              }
            : {
                name: "cose",
                fit: shouldFit,
                animate: false,
                padding: graphIsLarge ? 24 : 48,
                nodeRepulsion: graphIsLarge ? 120000 : 300000,
                idealEdgeLength: graphIsLarge ? 90 : 140,
                numIter: graphIsLarge ? 300 : 700
              };

      const layout = cy.layout(layoutOptions as never);
      (layout as any).on?.("layoutstop", () => {
        const lastLayoutMs = performance.now() - layoutStartedAt;
        onMetricsChange({
          lastLayoutMs,
          renderNodeCount: nodes.length,
          renderEdgeCount: edges.length
        });
        onLog("info", "layout", "Graph layout completed.", {
          mode: layoutMode,
          nodeCount: nodes.length,
          edgeCount: edges.length,
          durationMs: Math.round(lastLayoutMs)
        });
      });
      layout.run();
      if (!shouldFit && cy.elements().length > 0) {
        cy.zoom(previousZoom);
        cy.pan(previousPan);
      }
    } catch (error) {
      onLog("error", "layout", "Graph layout failed; falling back to a grid layout.", {
        mode: layoutMode,
        message: error instanceof Error ? error.message : "unknown"
      });
      cy.layout({ name: "grid", animate: false, fit: true, padding: 40 } as never).run();
    }

    lastLayoutModeRef.current = layoutMode;
    applyGraphState(cy, selectedNodeId, selectedEdgeId, matchedNodeIds, pathNodeIds, pathEdgeIds);
  }, [
    edges,
    elements,
    layoutMode,
    matchedNodeIds,
    nodes,
    onLog,
    onMetricsChange,
    pathEdgeIds,
    pathNodeIds,
    selectedEdgeId,
    selectedNodeId
  ]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    applyGraphState(cy, selectedNodeId, selectedEdgeId, matchedNodeIds, pathNodeIds, pathEdgeIds);
  }, [matchedNodeIds, pathEdgeIds, pathNodeIds, selectedEdgeId, selectedNodeId]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || fitRequestToken === 0) {
      return;
    }

    cy.fit(cy.elements(), 48);
    onLog("info", "ui", "Graph viewport fitted to visible elements.");
  }, [fitRequestToken, onLog]);

  useEffect(() => {
    if (!debugMode) {
      onMetricsChange({ fps: null });
      return;
    }

    let frameId = 0;
    let frameCount = 0;
    let windowStartedAt = performance.now();

    const tick = (timestamp: number) => {
      frameCount += 1;
      const elapsed = timestamp - windowStartedAt;
      if (elapsed >= 1000) {
        onMetricsChange({ fps: (frameCount * 1000) / elapsed });
        frameCount = 0;
        windowStartedAt = timestamp;
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [debugMode, onMetricsChange]);

  const showEmptyOverlay = !loading && !errorMessage && nodes.length === 0;
  const showSubtleLoading = loading && nodes.length > 0;

  return (
    <div className="graph-canvas-shell">
      <div className={`graph-canvas ${showSubtleLoading ? "graph-canvas--loading" : ""}`} ref={containerRef} />

      {loading && nodes.length === 0 ? (
        <div className="graph-overlay">
          <div className="graph-skeleton">
            <div className="graph-skeleton__line" />
            <div className="graph-skeleton__line graph-skeleton__line--wide" />
            <div className="graph-skeleton__grid">
              <span />
              <span />
              <span />
            </div>
            <strong>Loading graph…</strong>
            <p>We are collecting resource relationships and preparing the layout.</p>
          </div>
        </div>
      ) : null}

      {showSubtleLoading ? (
        <div className="graph-overlay graph-overlay--subtle">
          <strong>Updating graph…</strong>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="graph-overlay">
          <div className="graph-state-card">
            <strong>Graph unavailable</strong>
            <p>{errorMessage}</p>
            <button className="app-button" onClick={onRetry}>
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {showEmptyOverlay ? (
        <div className="graph-overlay">
          <div className="graph-state-card">
            <strong>{emptyTitle}</strong>
            <p>{emptyDescription}</p>
          </div>
        </div>
      ) : null}

      {tooltip ? (
        <div className="graph-tooltip" style={{ left: tooltip.x + 20, top: tooltip.y + 20 }}>
          <strong>{tooltip.title}</strong>
          <span>{tooltip.subtitle}</span>
          {debugMode ? <code>{tooltip.meta}</code> : null}
        </div>
      ) : null}
    </div>
  );
}
