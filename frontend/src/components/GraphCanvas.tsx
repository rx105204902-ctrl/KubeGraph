import { useEffect, useMemo, useRef } from "react";
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import type { GraphEdge, GraphNode } from "../types";

type GraphCanvasProps = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onNodeSelect: (id: string) => void;
  onNodeExpand: (id: string) => void;
  onEdgeSelect: (id: string) => void;
  onClearSelection: () => void;
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

function buildElements(nodes: GraphNode[], edges: GraphEdge[]): ElementDefinition[] {
  const nodeElements: ElementDefinition[] = nodes.map((node) => ({
    data: {
      ...node,
      label: node.namespace ? `${node.kind}\n${node.name}\n${node.namespace}` : `${node.kind}\n${node.name}`,
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

function applySelection(cy: Core, selectedNodeId: string | null, selectedEdgeId: string | null) {
  cy.elements().removeClass("selected connected dimmed");

  if (selectedEdgeId) {
    const selectedEdge = cy.getElementById(selectedEdgeId);
    if (selectedEdge.length > 0) {
      cy.elements().addClass("dimmed");
      selectedEdge.removeClass("dimmed").addClass("selected");
      selectedEdge.connectedNodes().removeClass("dimmed").addClass("connected");
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
      selectedNode.addClass("selected");
    }
  }
}

export function GraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  selectedEdgeId,
  onNodeSelect,
  onNodeExpand,
  onEdgeSelect,
  onClearSelection
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const elements = useMemo(() => buildElements(nodes, edges), [nodes, edges]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "background-color": "data(color)",
            color: "#0f172a",
            "font-size": "10px",
            "text-wrap": "wrap",
            "text-max-width": 96,
            "text-valign": "bottom",
            "text-margin-y": 6,
            width: 36,
            height: 36,
            "border-width": 2,
            "border-color": "#ffffff"
          }
        },
        {
          selector: "edge",
          style: {
            label: "data(label)",
            width: 2,
            "font-size": "9px",
            color: "#334155",
            "curve-style": "bezier",
            "line-color": "data(color)",
            "target-arrow-color": "data(color)",
            "target-arrow-shape": "triangle",
            "line-style": "data(lineStyle)",
            "text-background-color": "#ffffff",
            "text-background-opacity": 0.9,
            "text-background-padding": 2
          }
        },
        {
          selector: ".selected",
          style: {
            "border-color": "#111827",
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
            opacity: 0.18
          }
        }
      ] as any
    });

    cy.on("tap", "node", (event) => {
      const id = event.target.id();
      onNodeSelect(id);
      onNodeExpand(id);
    });

    cy.on("tap", "edge", (event) => {
      onEdgeSelect(event.target.id());
    });

    cy.on("tap", (event) => {
      if (event.target === cy) {
        onClearSelection();
      }
    });

    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [onClearSelection, onEdgeSelect, onNodeExpand, onNodeSelect]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    cy.elements().remove();
    cy.add(elements);
    cy.layout({
      name: "cose",
      animate: false,
      fit: true,
      padding: 48,
      nodeRepulsion: 300000,
      idealEdgeLength: 140
    }).run();
    applySelection(cy, selectedNodeId, selectedEdgeId);
  }, [elements, selectedEdgeId, selectedNodeId]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    applySelection(cy, selectedNodeId, selectedEdgeId);
  }, [selectedEdgeId, selectedNodeId]);

  return <div className="graph-canvas" ref={containerRef} />;
}
