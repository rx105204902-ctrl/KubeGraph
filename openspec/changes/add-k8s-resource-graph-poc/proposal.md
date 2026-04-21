## 为什么

Kubernetes 资源虽然容易枚举，但很难作为一个相互连接的系统来理解。运维人员和开发人员需要一种方式，能够从一个界面中看清工作负载、流量、配置、存储和运行时资源之间的关系，从而排查依赖问题、理解影响范围，并查看资源详情。

## 变更内容

- 为 Kubernetes 资源引入按命名空间划分的资源图视图。
- 定义类型化的关系模型，使每一条边都能解释两个资源为什么相连，而不是仅显示泛化的依赖关系。
- 统一图中节点和边使用的元数据，包括关系类型、类别、原因和证据。
- 支持从选定资源按需进行一跳扩展，而不是一次性渲染整个命名空间图。
- 支持查看每个节点对应的资源详情，包括元数据、状态和源清单。
- 将首个版本限制在核心内置资源类型和固定关系集合内，以便在扩展范围之前先验证可用性。

## 能力

### 新增能力
- `resource-relationship-model`：定义支持的关系类型、边方向规则，以及 Kubernetes 资源的标准化图数据契约。
- `namespace-graph-exploration`：允许用户选择命名空间，将资源作为图节点打开，并按需扩展直接相关的资源。
- `resource-detail-inspection`：允许用户查看任意图节点的详细信息，并理解每条关系背后的原因与证据。

### 修改的能力
- 无。

## 影响

- 会影响后端的图关系提取，以及 Kubernetes 资源发现和关系查询相关的 API 设计。
- 会影响前端的图渲染、详情面板、筛选能力和增量扩展交互流程。
- 明确首版支持的资源类型范围：`Ingress`、`Service`、`Deployment`、`ReplicaSet`、`Pod`、`ConfigMap`、`Secret`、`PersistentVolumeClaim`、`PersistentVolume`、`ServiceAccount`、`Node` 和 `HorizontalPodAutoscaler`。
- 明确首版支持的关系类型：`owns`、`selects`、`references`、`mounts`、`runs_on` 和 `routes_to`。
