# 图数据载荷契约

本文档定义 `kube-graph` 后端 API 与前端图组件共同使用的标准化节点与边载荷结构。

## Node

```json
{
  "id": "pod:demo:web-6d4f7c",
  "type": "resource",
  "category": "workload",
  "kind": "Pod",
  "namespace": "demo",
  "name": "web-6d4f7c",
  "clusterScoped": false,
  "labels": {
    "app": "web"
  }
}
```

字段说明：

- `id`：节点唯一标识，格式为 `<kind>:<namespace>:<name>`。
- `type`：节点类型，当前固定为 `resource`。
- `category`：节点所属类别，例如 `workload`、`network`、`config`、`storage`、`runtime`。
- `kind`：Kubernetes 资源类型。
- `namespace`：命名空间；集群级资源为空字符串。
- `name`：资源名称。
- `clusterScoped`：是否为集群级资源。
- `labels`：资源标签。

## Edge

```json
{
  "id": "routes_to:ingress:demo:web:service:demo:web",
  "source": "ingress:demo:web",
  "target": "service:demo:web",
  "type": "routes_to",
  "category": "traffic",
  "reason": "Ingress 将流量转发到 Service",
  "evidence": [
    {
      "field": "spec.rules[].http.paths[].backend.service.name",
      "value": "web",
      "description": "Ingress 后端 Service 名称"
    }
  ]
}
```

字段说明：

- `id`：边唯一标识，格式为 `<type>:<source-id>:<target-id>`。
- `source`：源节点 ID。
- `target`：目标节点 ID。
- `type`：关系类型，例如 `owns`、`selects`、`routes_to`。
- `category`：关系类别，例如 `control`、`traffic`、`config`、`storage`、`runtime`。
- `reason`：关系解释。
- `evidence`：用于推导关系的字段证据列表。

## GraphPayload

```json
{
  "center": { "id": "service:demo:web" },
  "nodes": [],
  "edges": []
}
```

- `center`：本次查询的中心节点。
- `nodes`：中心节点及一跳邻居节点集合。
- `edges`：中心节点与邻居之间满足过滤条件的边集合。

## NodeDetail

```json
{
  "node": {},
  "metadata": {},
  "status": {}
}
```

- `node`：标准化节点。
- `metadata`：资源元数据。
- `status`：资源状态字段。

## ManifestPayload

```json
{
  "node": {},
  "manifest": {}
}
```

- `manifest`：资源原始清单的对象表示，可直接用于格式化展示。
