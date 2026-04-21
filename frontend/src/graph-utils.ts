import type {
  GraphAnomaly,
  GraphEdge,
  GraphLogLevel,
  GraphLogScope,
  GraphNode,
  GraphPathResult
} from "./types";

export const LARGE_GRAPH_NODE_THRESHOLD = 80;

type TranslateFn = (key: string, values?: Record<string, string | number | boolean | null | undefined>) => string;

function getTranslatedMessage(translate: TranslateFn | undefined, key: string, fallback: string, values?: Record<string, string | number>) {
  const translated = translate?.(key, values);
  return translated && translated !== key ? translated : fallback;
}

export function mergeUniqueById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export function normalizeGraphData(nodes: GraphNode[], edges: GraphEdge[], translate?: TranslateFn) {
  const startedAt = performance.now();
  const anomalies: GraphAnomaly[] = [];
  const nodeMap = new Map<string, GraphNode>();
  const edgeMap = new Map<string, GraphEdge>();

  nodes.forEach((node) => {
    if (nodeMap.has(node.id)) {
      anomalies.push({
        id: `duplicate-node-${node.id}`,
        kind: "duplicate-node",
        severity: "warning",
        message: getTranslatedMessage(
          translate,
          "anomalies.duplicateNode",
          `Node ${node.id} was duplicated and has been merged.`,
          { id: node.id }
        ),
        relatedId: node.id
      });
    }
    nodeMap.set(node.id, node);
  });

  edges.forEach((edge) => {
    if (edgeMap.has(edge.id)) {
      anomalies.push({
        id: `duplicate-edge-${edge.id}`,
        kind: "duplicate-edge",
        severity: "warning",
        message: getTranslatedMessage(
          translate,
          "anomalies.duplicateEdge",
          `Edge ${edge.id} was duplicated and has been merged.`,
          { id: edge.id }
        ),
        relatedId: edge.id
      });
    }
    edgeMap.set(edge.id, edge);
  });

  const validEdges: GraphEdge[] = [];
  edgeMap.forEach((edge) => {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) {
      anomalies.push({
        id: `dangling-edge-${edge.id}`,
        kind: "dangling-edge",
        severity: "error",
        message: getTranslatedMessage(
          translate,
          "anomalies.danglingEdge",
          `Edge ${edge.id} references missing nodes and has been ignored.`,
          { id: edge.id }
        ),
        relatedId: edge.id
      });
      return;
    }

    validEdges.push(edge);
  });

  return {
    nodes: Array.from(nodeMap.values()),
    edges: validEdges,
    anomalies,
    normalizationMs: performance.now() - startedAt
  };
}

export function matchesNode(node: GraphNode, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery === "") {
    return true;
  }

  return [node.kind, node.name, node.namespace ?? "", node.category, node.id]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

export function describeNode(node: GraphNode) {
  return node.namespace ? `${node.kind}/${node.name} (${node.namespace})` : `${node.kind}/${node.name}`;
}

export function describeEdge(edge: GraphEdge) {
  return `${edge.type}: ${edge.reason}`;
}

export function createFriendlyError(
  scope: "namespace" | "search" | "graph" | "detail" | "manifest",
  message: string,
  translate?: TranslateFn
) {
  const fallback = message.trim() || getTranslatedMessage(translate, "errors.unknown", "Unknown error");
  return getTranslatedMessage(translate, `errors.${scope}`, fallback, { message: fallback });
}

export function buildLogContext(context?: Record<string, unknown>) {
  if (!context) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(context)
      .filter(([, value]) => value === null || ["string", "number", "boolean"].includes(typeof value))
      .map(([key, value]) => [key, value as string | number | boolean | null])
  );
}

export function buildLogMessage(
  level: GraphLogLevel,
  scope: GraphLogScope,
  message: string,
  context?: Record<string, unknown>
) {
  return {
    level,
    scope,
    message,
    context: buildLogContext(context)
  };
}

export function findShortestPath(nodes: GraphNode[], edges: GraphEdge[], startId: string, endId: string): GraphPathResult {
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (!nodeIds.has(startId) || !nodeIds.has(endId)) {
    return { startId, endId, nodeIds: [], edgeIds: [], found: false };
  }

  if (startId === endId) {
    return { startId, endId, nodeIds: [startId], edgeIds: [], found: true };
  }

  const adjacency = new Map<string, Array<{ nodeId: string; edgeId: string }>>();
  edges.forEach((edge) => {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, []);
    }
    adjacency.get(edge.source)?.push({ nodeId: edge.target, edgeId: edge.id });
  });

  const queue = [startId];
  const visited = new Set<string>([startId]);
  const parents = new Map<string, { nodeId: string; edgeId: string }>();

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) {
      continue;
    }

    const neighbors = adjacency.get(currentId) ?? [];
    for (const neighbor of neighbors) {
      if (visited.has(neighbor.nodeId)) {
        continue;
      }

      visited.add(neighbor.nodeId);
      parents.set(neighbor.nodeId, { nodeId: currentId, edgeId: neighbor.edgeId });

      if (neighbor.nodeId === endId) {
        const pathNodeIds: string[] = [endId];
        const pathEdgeIds: string[] = [];
        let cursor = endId;

        while (cursor !== startId) {
          const parent = parents.get(cursor);
          if (!parent) {
            break;
          }

          pathEdgeIds.unshift(parent.edgeId);
          pathNodeIds.unshift(parent.nodeId);
          cursor = parent.nodeId;
        }

        return { startId, endId, nodeIds: pathNodeIds, edgeIds: pathEdgeIds, found: true };
      }

      queue.push(neighbor.nodeId);
    }
  }

  return { startId, endId, nodeIds: [], edgeIds: [], found: false };
}
