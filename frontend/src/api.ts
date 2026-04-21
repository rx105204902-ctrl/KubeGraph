import type {
  GraphPayload,
  ManifestPayload,
  NamespaceResponse,
  NodeDetail,
  SearchResponse
} from "./types";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`);
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload ? String(payload.error) : response.statusText;
    throw new Error(message || "Request failed");
  }

  return payload as T;
}

export function fetchNamespaces(): Promise<NamespaceResponse> {
  return request<NamespaceResponse>("/api/v1/namespaces");
}

export function searchResources(namespace: string, query: string, kind: string): Promise<SearchResponse> {
  const params = new URLSearchParams();
  params.set("namespace", namespace);
  if (query.trim() !== "") {
    params.set("query", query.trim());
  }
  if (kind.trim() !== "") {
    params.set("kind", kind);
  }

  return request<SearchResponse>(`/api/v1/resources/search?${params.toString()}`);
}

export function fetchNeighbors(namespace: string, kind: string, name: string, edgeTypes: string[]): Promise<GraphPayload> {
  const params = new URLSearchParams();
  params.set("namespace", namespace);
  params.set("kind", kind);
  params.set("name", name);
  edgeTypes.forEach((edgeType) => params.append("edgeType", edgeType));
  return request<GraphPayload>(`/api/v1/graph/neighbors?${params.toString()}`);
}

export function fetchNodeDetail(kind: string, name: string, namespace?: string): Promise<NodeDetail> {
  const params = new URLSearchParams();
  params.set("kind", kind);
  params.set("name", name);
  if (namespace) {
    params.set("namespace", namespace);
  }

  return request<NodeDetail>(`/api/v1/resources/detail?${params.toString()}`);
}

export function fetchManifest(kind: string, name: string, namespace?: string): Promise<ManifestPayload> {
  const params = new URLSearchParams();
  params.set("kind", kind);
  params.set("name", name);
  if (namespace) {
    params.set("namespace", namespace);
  }

  return request<ManifestPayload>(`/api/v1/resources/manifest?${params.toString()}`);
}
