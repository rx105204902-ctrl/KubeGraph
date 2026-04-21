## ADDED Requirements（新增需求）

### Requirement: 系统定义类型化的资源关系
系统必须将受支持的 Kubernetes 资源关系表示为类型化边，而不是泛化的依赖链接。每条边都必须包含 `source`、`target`、`type`、`category`、`reason` 和 `evidence`。

#### Scenario: Pod 挂载一个 Secret
- **WHEN（当）** 一个 `Pod` 声明了一个由 `Secret` 支持的卷时
- **THEN（则）** 系统创建一条从 `Pod` 指向 `Secret` 的边，其类型为 `mounts`，类别为 `config`，并包含能够标识来源字段的证据

#### Scenario: Ingress 将流量路由到一个 Service
- **WHEN（当）** 一个 `Ingress` 后端引用了某个 `Service` 时
- **THEN（则）** 系统创建一条从 `Ingress` 指向 `Service` 的边，其类型为 `routes_to`，类别为 `traffic`，并包含能够标识后端字段的证据

### Requirement: 系统应用固定的边方向规则
系统必须采用统一的边方向模型，即由控制、选择、使用、运行或路由的一方指向目标资源。

#### Scenario: 控制器拥有下级资源
- **WHEN（当）** 一个 `Deployment` 通过 `ownerReferences` 拥有某个 `ReplicaSet` 时
- **THEN（则）** 系统创建一条从 `Deployment` 指向 `ReplicaSet` 的 `owns` 类型边

#### Scenario: Service 选择 Pod
- **WHEN（当）** 一个 `Service` 的 selector 匹配一个或多个 `Pod` 标签时
- **THEN（则）** 系统创建从 `Service` 指向每个匹配 `Pod` 的 `selects` 类型边

### Requirement: 系统限制首版关系范围
系统必须将首版关系模型限制在受支持的内置资源类型，以及 `owns`、`selects`、`references`、`mounts`、`runs_on` 和 `routes_to` 这些受支持的边类型内。

#### Scenario: 遇到不受支持的资源类型
- **WHEN（当）** 系统处理首版支持列表之外的资源类型时
- **THEN（则）** 系统不会为该资源创建首版图关系

#### Scenario: 遇到不受支持的关系模式
- **WHEN（当）** 系统遇到无法映射到首版受支持边类型的关系时
- **THEN（则）** 系统不会为该关系生成通用的兜底边
