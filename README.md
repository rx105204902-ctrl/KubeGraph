# kube-graph

`kube-graph` 是一个 Kubernetes 资源关系图的概念验证项目，目标是帮助用户按命名空间探索资源之间的控制、流量、配置、存储与运行时关系。

## 仓库结构

- `backend/`：`Go` 后端，负责 Kubernetes 资源发现、关系提取和 HTTP API。
- `frontend/`：`React` + `TypeScript` 前端，负责图检索、过滤、展示和详情面板。
- `docs/contracts/`：前后端共享的数据契约说明。
- `openspec/`：需求、设计与任务分解文档。

## 后端启动

```powershell
cd backend
go mod tidy
go run ./cmd/kube-graph-api
```

默认监听地址为 `:8999`，可用环境变量见 `backend/.env.example`。

默认通过 `KUBE_GRAPH_ADDRESS=:8999` 监听所有网卡，并通过 `KUBE_GRAPH_ALLOWED_ORIGIN=*` 允许来自 IP 地址的前端访问。

## 前端启动

```powershell
cd frontend
npm install
npm run dev
```

开发环境默认通过 Vite 代理将 `/api` 转发到 `http://localhost:8999`，可用环境变量见 `frontend/.env.example`。

`Vite` 开发服务器默认绑定 `0.0.0.0`，因此可以通过 `http://<你的机器IP>:5173` 从局域网内其他设备访问；如果前后端不在同一台机器上，可设置 `VITE_API_BASE_URL=http://<服务IP>:8999`。

## 图谱工作区亮点

- 稳定的图数据规范化：自动去重节点/边、隔离无效边，并在 debug 面板中展示异常计数。
- 现代化工作区布局：左侧导航与搜索，中间图谱主视图，右侧详情与调试面板。
- 多布局切换：支持 `Force`、`Hierarchical` 与 `Circular` 三种布局模式。
- 路径分析：可为两个节点设置起点/终点，并高亮当前图中的最短可用路径。
- 子图展开与折叠：选中节点后可显式展开邻居或折叠已加载的子图，避免信息过载。
- 调试模式：展示节点 ID、关系诊断、FPS、布局耗时和最近日志，便于排查渲染异常。
- 友好状态反馈：提供 Skeleton loading、空状态说明、错误提示与重试入口。

## 主要接口

- `GET /api/v1/healthz`
- `GET /api/v1/namespaces`
- `GET /api/v1/resources/search?namespace=<ns>&query=<keyword>&kind=<kind>`
- `GET /api/v1/graph/neighbors?namespace=<ns>&kind=<kind>&name=<name>&edgeType=<type>`
- `GET /api/v1/resources/detail?kind=<kind>&namespace=<ns>&name=<name>`
- `GET /api/v1/resources/manifest?kind=<kind>&namespace=<ns>&name=<name>`

## 支持的首版资源类型

- `Ingress`
- `Service`
- `Deployment`
- `ReplicaSet`
- `Pod`
- `ConfigMap`
- `Secret`
- `PersistentVolumeClaim`
- `PersistentVolume`
- `ServiceAccount`
- `Node`
- `HorizontalPodAutoscaler`

## 支持的首版关系类型

- `owns`
- `selects`
- `references`
- `mounts`
- `runs_on`
- `routes_to`
