package graph

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	appsv1 "k8s.io/api/apps/v1"
	autoscalingv2 "k8s.io/api/autoscaling/v2"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes"
)

const (
	EdgeOwns       = "owns"
	EdgeSelects    = "selects"
	EdgeReferences = "references"
	EdgeMounts     = "mounts"
	EdgeRunsOn     = "runs_on"
	EdgeRoutesTo   = "routes_to"
)

var ErrResourceNotFound = errors.New("resource not found")

type NamespaceOption struct {
	Name string `json:"name"`
}

type Evidence struct {
	Field       string `json:"field"`
	Value       string `json:"value,omitempty"`
	Description string `json:"description,omitempty"`
}

type Node struct {
	ID            string            `json:"id"`
	Type          string            `json:"type"`
	Category      string            `json:"category"`
	Kind          string            `json:"kind"`
	Namespace     string            `json:"namespace,omitempty"`
	Name          string            `json:"name"`
	ClusterScoped bool              `json:"clusterScoped"`
	Labels        map[string]string `json:"labels,omitempty"`
}

type Edge struct {
	ID       string     `json:"id"`
	Source   string     `json:"source"`
	Target   string     `json:"target"`
	Type     string     `json:"type"`
	Category string     `json:"category"`
	Reason   string     `json:"reason"`
	Evidence []Evidence `json:"evidence,omitempty"`
}

type GraphPayload struct {
	Center Node   `json:"center"`
	Nodes  []Node `json:"nodes"`
	Edges  []Edge `json:"edges"`
}

type NodeDetail struct {
	Node     Node           `json:"node"`
	Metadata map[string]any `json:"metadata,omitempty"`
	Status   map[string]any `json:"status,omitempty"`
}

type ManifestPayload struct {
	Node     Node           `json:"node"`
	Manifest map[string]any `json:"manifest"`
}

type ResourceRef struct {
	Kind      string
	Namespace string
	Name      string
}

type Snapshot struct {
	Namespace       string
	Ingresses       []networkingv1.Ingress
	Services        []corev1.Service
	Deployments     []appsv1.Deployment
	ReplicaSets     []appsv1.ReplicaSet
	Pods            []corev1.Pod
	ConfigMaps      []corev1.ConfigMap
	Secrets         []corev1.Secret
	PVCs            []corev1.PersistentVolumeClaim
	PVs             []corev1.PersistentVolume
	ServiceAccounts []corev1.ServiceAccount
	Nodes           []corev1.Node
	HPAs            []autoscalingv2.HorizontalPodAutoscaler
}

type graphDocument struct {
	nodes map[string]Node
	edges map[string]Edge
}

type Service struct {
	client kubernetes.Interface
}

func NewService(client kubernetes.Interface) *Service {
	return &Service{client: client}
}

func SupportedKinds() []string {
	return []string{
		"ConfigMap",
		"Deployment",
		"HorizontalPodAutoscaler",
		"Ingress",
		"Node",
		"PersistentVolume",
		"PersistentVolumeClaim",
		"Pod",
		"ReplicaSet",
		"Secret",
		"Service",
		"ServiceAccount",
	}
}

func SupportedEdgeTypes() []string {
	return []string{EdgeOwns, EdgeSelects, EdgeReferences, EdgeMounts, EdgeRunsOn, EdgeRoutesTo}
}

func (ref ResourceRef) Canonical() (ResourceRef, error) {
	kind, err := canonicalKind(ref.Kind)
	if err != nil {
		return ResourceRef{}, err
	}

	return ResourceRef{
		Kind:      kind,
		Namespace: strings.TrimSpace(ref.Namespace),
		Name:      strings.TrimSpace(ref.Name),
	}, nil
}

func (ref ResourceRef) ID() string {
	return resourceID(ref.Kind, ref.Namespace, ref.Name)
}

func (service *Service) ListNamespaces(ctx context.Context) ([]NamespaceOption, error) {
	namespaceList, err := service.client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	result := make([]NamespaceOption, 0, len(namespaceList.Items))
	for _, namespace := range namespaceList.Items {
		result = append(result, NamespaceOption{Name: namespace.Name})
	}

	sort.Slice(result, func(left int, right int) bool {
		return result[left].Name < result[right].Name
	})

	return result, nil
}

func (service *Service) SearchResources(ctx context.Context, namespace string, query string, kind string) ([]Node, error) {
	if strings.TrimSpace(namespace) == "" {
		return nil, errors.New("namespace is required")
	}

	filterKind := ""
	if strings.TrimSpace(kind) != "" {
		canonicalKindValue, err := canonicalKind(kind)
		if err != nil {
			return nil, err
		}

		filterKind = canonicalKindValue
	}

	snapshot, err := service.loadSnapshot(ctx, namespace)
	if err != nil {
		return nil, err
	}

	queryValue := strings.ToLower(strings.TrimSpace(query))
	graph := buildGraph(snapshot)
	result := make([]Node, 0)
	for _, node := range graph.sortedNodes() {
		if node.ClusterScoped {
			continue
		}

		if node.Namespace != namespace {
			continue
		}

		if filterKind != "" && node.Kind != filterKind {
			continue
		}

		haystack := strings.ToLower(strings.Join([]string{node.Kind, node.Name, node.Namespace}, " "))
		if queryValue != "" && !strings.Contains(haystack, queryValue) {
			continue
		}

		result = append(result, node)
	}

	return result, nil
}

func (service *Service) QueryNeighbors(ctx context.Context, namespace string, ref ResourceRef, edgeTypes []string) (GraphPayload, error) {
	if strings.TrimSpace(namespace) == "" {
		return GraphPayload{}, errors.New("namespace is required")
	}

	canonicalRef, err := ref.Canonical()
	if err != nil {
		return GraphPayload{}, err
	}

	if canonicalRef.Name == "" {
		return GraphPayload{}, errors.New("name is required")
	}

	if requiresNamespace(canonicalRef.Kind) {
		canonicalRef.Namespace = namespace
	}

	filter := make(map[string]struct{})
	for _, edgeType := range edgeTypes {
		edgeType = strings.TrimSpace(edgeType)
		if edgeType == "" {
			continue
		}

		if !isSupportedEdgeType(edgeType) {
			return GraphPayload{}, fmt.Errorf("unsupported edge type: %s", edgeType)
		}

		filter[edgeType] = struct{}{}
	}

	snapshot, err := service.loadSnapshot(ctx, namespace)
	if err != nil {
		return GraphPayload{}, err
	}

	graph := buildGraph(snapshot)
	return graph.oneHop(canonicalRef.ID(), filter)
}

func (service *Service) GetNodeDetail(ctx context.Context, ref ResourceRef) (NodeDetail, error) {
	object, node, err := service.fetchObject(ctx, ref)
	if err != nil {
		return NodeDetail{}, err
	}

	manifest, err := toManifest(object)
	if err != nil {
		return NodeDetail{}, err
	}

	return NodeDetail{
		Node:     node,
		Metadata: manifestMap(manifest, "metadata"),
		Status:   manifestMap(manifest, "status"),
	}, nil
}

func (service *Service) GetManifest(ctx context.Context, ref ResourceRef) (ManifestPayload, error) {
	object, node, err := service.fetchObject(ctx, ref)
	if err != nil {
		return ManifestPayload{}, err
	}

	manifest, err := toManifest(object)
	if err != nil {
		return ManifestPayload{}, err
	}

	return ManifestPayload{Node: node, Manifest: manifest}, nil
}

func (service *Service) fetchObject(ctx context.Context, ref ResourceRef) (any, Node, error) {
	canonicalRef, err := ref.Canonical()
	if err != nil {
		return nil, Node{}, err
	}

	if canonicalRef.Name == "" {
		return nil, Node{}, errors.New("name is required")
	}

	if requiresNamespace(canonicalRef.Kind) && canonicalRef.Namespace == "" {
		return nil, Node{}, errors.New("namespace is required for namespaced resources")
	}

	switch canonicalRef.Kind {
	case "Ingress":
		resource, getErr := service.client.NetworkingV1().Ingresses(canonicalRef.Namespace).Get(ctx, canonicalRef.Name, metav1.GetOptions{})
		if getErr != nil {
			return nil, Node{}, getErr
		}
		return resource, nodeFromIngress(*resource), nil
	case "Service":
		resource, getErr := service.client.CoreV1().Services(canonicalRef.Namespace).Get(ctx, canonicalRef.Name, metav1.GetOptions{})
		if getErr != nil {
			return nil, Node{}, getErr
		}
		return resource, nodeFromService(*resource), nil
	case "Deployment":
		resource, getErr := service.client.AppsV1().Deployments(canonicalRef.Namespace).Get(ctx, canonicalRef.Name, metav1.GetOptions{})
		if getErr != nil {
			return nil, Node{}, getErr
		}
		return resource, nodeFromDeployment(*resource), nil
	case "ReplicaSet":
		resource, getErr := service.client.AppsV1().ReplicaSets(canonicalRef.Namespace).Get(ctx, canonicalRef.Name, metav1.GetOptions{})
		if getErr != nil {
			return nil, Node{}, getErr
		}
		return resource, nodeFromReplicaSet(*resource), nil
	case "Pod":
		resource, getErr := service.client.CoreV1().Pods(canonicalRef.Namespace).Get(ctx, canonicalRef.Name, metav1.GetOptions{})
		if getErr != nil {
			return nil, Node{}, getErr
		}
		return resource, nodeFromPod(*resource), nil
	case "ConfigMap":
		resource, getErr := service.client.CoreV1().ConfigMaps(canonicalRef.Namespace).Get(ctx, canonicalRef.Name, metav1.GetOptions{})
		if getErr != nil {
			return nil, Node{}, getErr
		}
		return resource, nodeFromConfigMap(*resource), nil
	case "Secret":
		resource, getErr := service.client.CoreV1().Secrets(canonicalRef.Namespace).Get(ctx, canonicalRef.Name, metav1.GetOptions{})
		if getErr != nil {
			return nil, Node{}, getErr
		}
		return resource, nodeFromSecret(*resource), nil
	case "PersistentVolumeClaim":
		resource, getErr := service.client.CoreV1().PersistentVolumeClaims(canonicalRef.Namespace).Get(ctx, canonicalRef.Name, metav1.GetOptions{})
		if getErr != nil {
			return nil, Node{}, getErr
		}
		return resource, nodeFromPVC(*resource), nil
	case "PersistentVolume":
		resource, getErr := service.client.CoreV1().PersistentVolumes().Get(ctx, canonicalRef.Name, metav1.GetOptions{})
		if getErr != nil {
			return nil, Node{}, getErr
		}
		return resource, nodeFromPV(*resource), nil
	case "ServiceAccount":
		resource, getErr := service.client.CoreV1().ServiceAccounts(canonicalRef.Namespace).Get(ctx, canonicalRef.Name, metav1.GetOptions{})
		if getErr != nil {
			return nil, Node{}, getErr
		}
		return resource, nodeFromServiceAccount(*resource), nil
	case "Node":
		resource, getErr := service.client.CoreV1().Nodes().Get(ctx, canonicalRef.Name, metav1.GetOptions{})
		if getErr != nil {
			return nil, Node{}, getErr
		}
		return resource, nodeFromNode(*resource), nil
	case "HorizontalPodAutoscaler":
		resource, getErr := service.client.AutoscalingV2().HorizontalPodAutoscalers(canonicalRef.Namespace).Get(ctx, canonicalRef.Name, metav1.GetOptions{})
		if getErr != nil {
			return nil, Node{}, getErr
		}
		return resource, nodeFromHPA(*resource), nil
	default:
		return nil, Node{}, fmt.Errorf("unsupported kind: %s", canonicalRef.Kind)
	}
}

func (service *Service) loadSnapshot(ctx context.Context, namespace string) (*Snapshot, error) {
	ingresses, err := service.client.NetworkingV1().Ingresses(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	services, err := service.client.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	deployments, err := service.client.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	replicaSets, err := service.client.AppsV1().ReplicaSets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	pods, err := service.client.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	configMaps, err := service.client.CoreV1().ConfigMaps(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	secrets, err := service.client.CoreV1().Secrets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	pvcs, err := service.client.CoreV1().PersistentVolumeClaims(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	pvs, err := service.client.CoreV1().PersistentVolumes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	serviceAccounts, err := service.client.CoreV1().ServiceAccounts(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	nodes, err := service.client.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	hpas, err := service.client.AutoscalingV2().HorizontalPodAutoscalers(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	return &Snapshot{
		Namespace:       namespace,
		Ingresses:       ingresses.Items,
		Services:        services.Items,
		Deployments:     deployments.Items,
		ReplicaSets:     replicaSets.Items,
		Pods:            pods.Items,
		ConfigMaps:      configMaps.Items,
		Secrets:         secrets.Items,
		PVCs:            pvcs.Items,
		PVs:             pvs.Items,
		ServiceAccounts: serviceAccounts.Items,
		Nodes:           nodes.Items,
		HPAs:            hpas.Items,
	}, nil
}

func buildGraph(snapshot *Snapshot) graphDocument {
	document := graphDocument{
		nodes: make(map[string]Node),
		edges: make(map[string]Edge),
	}

	for _, item := range snapshot.Ingresses {
		document.addNode(nodeFromIngress(item))
	}
	for _, item := range snapshot.Services {
		document.addNode(nodeFromService(item))
	}
	for _, item := range snapshot.Deployments {
		document.addNode(nodeFromDeployment(item))
	}
	for _, item := range snapshot.ReplicaSets {
		document.addNode(nodeFromReplicaSet(item))
	}
	for _, item := range snapshot.Pods {
		document.addNode(nodeFromPod(item))
	}
	for _, item := range snapshot.ConfigMaps {
		document.addNode(nodeFromConfigMap(item))
	}
	for _, item := range snapshot.Secrets {
		document.addNode(nodeFromSecret(item))
	}
	for _, item := range snapshot.PVCs {
		document.addNode(nodeFromPVC(item))
	}
	for _, item := range snapshot.PVs {
		document.addNode(nodeFromPV(item))
	}
	for _, item := range snapshot.ServiceAccounts {
		document.addNode(nodeFromServiceAccount(item))
	}
	for _, item := range snapshot.Nodes {
		document.addNode(nodeFromNode(item))
	}
	for _, item := range snapshot.HPAs {
		document.addNode(nodeFromHPA(item))
	}

	deploymentByUID := make(map[string]Node)
	for _, deployment := range snapshot.Deployments {
		deploymentByUID[string(deployment.UID)] = nodeFromDeployment(deployment)
	}

	replicaSetByUID := make(map[string]Node)
	for _, replicaSet := range snapshot.ReplicaSets {
		replicaSetByUID[string(replicaSet.UID)] = nodeFromReplicaSet(replicaSet)
		for _, ownerReference := range replicaSet.OwnerReferences {
			if ownerReference.Kind != "Deployment" {
				continue
			}

			if sourceNode, exists := deploymentByUID[string(ownerReference.UID)]; exists {
				document.addEdge(
					sourceNode,
					nodeFromReplicaSet(replicaSet),
					EdgeOwns,
					"control",
					"Deployment owns ReplicaSet via ownerReferences",
					Evidence{Field: "metadata.ownerReferences", Value: string(ownerReference.UID), Description: "deployment uid"},
				)
			}
		}
	}

	for _, pod := range snapshot.Pods {
		podNode := nodeFromPod(pod)
		for _, ownerReference := range pod.OwnerReferences {
			if ownerReference.Kind != "ReplicaSet" {
				continue
			}

			if sourceNode, exists := replicaSetByUID[string(ownerReference.UID)]; exists {
				document.addEdge(
					sourceNode,
					podNode,
					EdgeOwns,
					"control",
					"ReplicaSet owns Pod via ownerReferences",
					Evidence{Field: "metadata.ownerReferences", Value: string(ownerReference.UID), Description: "replicaset uid"},
				)
			}
		}
	}

	for _, serviceResource := range snapshot.Services {
		if len(serviceResource.Spec.Selector) == 0 {
			continue
		}

		selector := labels.SelectorFromSet(serviceResource.Spec.Selector)
		serviceNode := nodeFromService(serviceResource)
		for _, pod := range snapshot.Pods {
			if selector.Matches(labels.Set(pod.Labels)) {
				document.addEdge(
					serviceNode,
					nodeFromPod(pod),
					EdgeSelects,
					"traffic",
					"Service selector matches Pod labels",
					Evidence{Field: "spec.selector", Value: selector.String(), Description: "service selector"},
				)
			}
		}
	}

	for _, ingress := range snapshot.Ingresses {
		ingressNode := nodeFromIngress(ingress)
		if ingress.Spec.DefaultBackend != nil && ingress.Spec.DefaultBackend.Service != nil {
			document.addEdge(
				ingressNode,
				nodeFromResource("Service", ingress.Namespace, ingress.Spec.DefaultBackend.Service.Name, nil, "network", false),
				EdgeRoutesTo,
				"traffic",
				"Ingress default backend routes to Service",
				Evidence{Field: "spec.defaultBackend.service.name", Value: ingress.Spec.DefaultBackend.Service.Name, Description: "default backend service"},
			)
		}

		for _, rule := range ingress.Spec.Rules {
			if rule.HTTP == nil {
				continue
			}

			for _, path := range rule.HTTP.Paths {
				if path.Backend.Service == nil {
					continue
				}

				document.addEdge(
					ingressNode,
					nodeFromResource("Service", ingress.Namespace, path.Backend.Service.Name, nil, "network", false),
					EdgeRoutesTo,
					"traffic",
					"Ingress rule routes to Service",
					Evidence{Field: "spec.rules[].http.paths[].backend.service.name", Value: path.Backend.Service.Name, Description: "rule backend service"},
				)
			}
		}
	}

	for _, pod := range snapshot.Pods {
		podNode := nodeFromPod(pod)

		for _, volume := range pod.Spec.Volumes {
			if volume.ConfigMap != nil {
				document.addEdge(
					podNode,
					nodeFromResource("ConfigMap", pod.Namespace, volume.ConfigMap.Name, nil, "config", false),
					EdgeMounts,
					"config",
					"Pod mounts ConfigMap",
					Evidence{Field: "spec.volumes[].configMap.name", Value: volume.ConfigMap.Name, Description: volume.Name},
				)
			}

			if volume.Secret != nil {
				document.addEdge(
					podNode,
					nodeFromResource("Secret", pod.Namespace, volume.Secret.SecretName, nil, "config", false),
					EdgeMounts,
					"config",
					"Pod mounts Secret",
					Evidence{Field: "spec.volumes[].secret.secretName", Value: volume.Secret.SecretName, Description: volume.Name},
				)
			}

			if volume.PersistentVolumeClaim != nil {
				document.addEdge(
					podNode,
					nodeFromResource("PersistentVolumeClaim", pod.Namespace, volume.PersistentVolumeClaim.ClaimName, nil, "storage", false),
					EdgeMounts,
					"storage",
					"Pod mounts PersistentVolumeClaim",
					Evidence{Field: "spec.volumes[].persistentVolumeClaim.claimName", Value: volume.PersistentVolumeClaim.ClaimName, Description: volume.Name},
				)
			}

			if volume.Projected != nil {
				for _, source := range volume.Projected.Sources {
					if source.ConfigMap != nil {
						document.addEdge(
							podNode,
							nodeFromResource("ConfigMap", pod.Namespace, source.ConfigMap.Name, nil, "config", false),
							EdgeMounts,
							"config",
							"Pod mounts ConfigMap through projected volume",
							Evidence{Field: "spec.volumes[].projected.sources[].configMap.name", Value: source.ConfigMap.Name, Description: volume.Name},
						)
					}
					if source.Secret != nil {
						document.addEdge(
							podNode,
							nodeFromResource("Secret", pod.Namespace, source.Secret.Name, nil, "config", false),
							EdgeMounts,
							"config",
							"Pod mounts Secret through projected volume",
							Evidence{Field: "spec.volumes[].projected.sources[].secret.name", Value: source.Secret.Name, Description: volume.Name},
						)
					}
				}
			}
		}

		if pod.Spec.ServiceAccountName != "" {
			document.addEdge(
				podNode,
				nodeFromResource("ServiceAccount", pod.Namespace, pod.Spec.ServiceAccountName, nil, "identity", false),
				EdgeReferences,
				"config",
				"Pod references ServiceAccount",
				Evidence{Field: "spec.serviceAccountName", Value: pod.Spec.ServiceAccountName, Description: "service account"},
			)
		}

		for _, imagePullSecret := range pod.Spec.ImagePullSecrets {
			document.addEdge(
				podNode,
				nodeFromResource("Secret", pod.Namespace, imagePullSecret.Name, nil, "config", false),
				EdgeReferences,
				"config",
				"Pod references imagePullSecret",
				Evidence{Field: "spec.imagePullSecrets[].name", Value: imagePullSecret.Name, Description: "image pull secret"},
			)
		}

		collectContainerReferences(&document, podNode, pod.Namespace, pod.Spec.InitContainers, "spec.initContainers")
		collectContainerReferences(&document, podNode, pod.Namespace, pod.Spec.Containers, "spec.containers")

		if pod.Spec.NodeName != "" {
			document.addEdge(
				podNode,
				nodeFromResource("Node", "", pod.Spec.NodeName, nil, "runtime", true),
				EdgeRunsOn,
				"runtime",
				"Pod runs on Node",
				Evidence{Field: "spec.nodeName", Value: pod.Spec.NodeName, Description: "scheduled node"},
			)
		}
	}

	for _, hpa := range snapshot.HPAs {
		if hpa.Spec.ScaleTargetRef.Kind != "Deployment" || hpa.Spec.ScaleTargetRef.Name == "" {
			continue
		}

		document.addEdge(
			nodeFromHPA(hpa),
			nodeFromResource("Deployment", hpa.Namespace, hpa.Spec.ScaleTargetRef.Name, nil, "workload", false),
			EdgeReferences,
			"control",
			"HorizontalPodAutoscaler references Deployment target",
			Evidence{Field: "spec.scaleTargetRef", Value: hpa.Spec.ScaleTargetRef.Name, Description: hpa.Spec.ScaleTargetRef.Kind},
		)
	}

	for _, pvc := range snapshot.PVCs {
		if pvc.Spec.VolumeName == "" {
			continue
		}

		document.addEdge(
			nodeFromPVC(pvc),
			nodeFromResource("PersistentVolume", "", pvc.Spec.VolumeName, nil, "storage", true),
			EdgeReferences,
			"storage",
			"PersistentVolumeClaim references bound PersistentVolume",
			Evidence{Field: "spec.volumeName", Value: pvc.Spec.VolumeName, Description: "bound pv"},
		)
	}

	return document
}

func collectContainerReferences(document *graphDocument, podNode Node, namespace string, containers []corev1.Container, fieldPrefix string) {
	for containerIndex, container := range containers {
		for envFromIndex, envFrom := range container.EnvFrom {
			if envFrom.ConfigMapRef != nil && envFrom.ConfigMapRef.Name != "" {
				document.addEdge(
					podNode,
					nodeFromResource("ConfigMap", namespace, envFrom.ConfigMapRef.Name, nil, "config", false),
					EdgeReferences,
					"config",
					"Pod references ConfigMap through envFrom",
					Evidence{Field: fmt.Sprintf("%s[%d].envFrom[%d].configMapRef.name", fieldPrefix, containerIndex, envFromIndex), Value: envFrom.ConfigMapRef.Name, Description: container.Name},
				)
			}

			if envFrom.SecretRef != nil && envFrom.SecretRef.Name != "" {
				document.addEdge(
					podNode,
					nodeFromResource("Secret", namespace, envFrom.SecretRef.Name, nil, "config", false),
					EdgeReferences,
					"config",
					"Pod references Secret through envFrom",
					Evidence{Field: fmt.Sprintf("%s[%d].envFrom[%d].secretRef.name", fieldPrefix, containerIndex, envFromIndex), Value: envFrom.SecretRef.Name, Description: container.Name},
				)
			}
		}

		for envIndex, envVar := range container.Env {
			if envVar.ValueFrom == nil {
				continue
			}

			if envVar.ValueFrom.ConfigMapKeyRef != nil && envVar.ValueFrom.ConfigMapKeyRef.Name != "" {
				document.addEdge(
					podNode,
					nodeFromResource("ConfigMap", namespace, envVar.ValueFrom.ConfigMapKeyRef.Name, nil, "config", false),
					EdgeReferences,
					"config",
					"Pod references ConfigMap through env valueFrom",
					Evidence{Field: fmt.Sprintf("%s[%d].env[%d].valueFrom.configMapKeyRef.name", fieldPrefix, containerIndex, envIndex), Value: envVar.ValueFrom.ConfigMapKeyRef.Name, Description: envVar.Name},
				)
			}

			if envVar.ValueFrom.SecretKeyRef != nil && envVar.ValueFrom.SecretKeyRef.Name != "" {
				document.addEdge(
					podNode,
					nodeFromResource("Secret", namespace, envVar.ValueFrom.SecretKeyRef.Name, nil, "config", false),
					EdgeReferences,
					"config",
					"Pod references Secret through env valueFrom",
					Evidence{Field: fmt.Sprintf("%s[%d].env[%d].valueFrom.secretKeyRef.name", fieldPrefix, containerIndex, envIndex), Value: envVar.ValueFrom.SecretKeyRef.Name, Description: envVar.Name},
				)
			}
		}
	}
}

func (document *graphDocument) addNode(node Node) {
	document.nodes[node.ID] = node
}

func (document *graphDocument) addEdge(source Node, target Node, edgeType string, category string, reason string, evidence ...Evidence) {
	if source.ID == "" || target.ID == "" {
		return
	}

	document.addNode(source)
	document.addNode(target)

	edgeID := fmt.Sprintf("%s:%s:%s", edgeType, source.ID, target.ID)
	if existing, exists := document.edges[edgeID]; exists {
		existing.Evidence = uniqueEvidence(append(existing.Evidence, evidence...))
		document.edges[edgeID] = existing
		return
	}

	document.edges[edgeID] = Edge{
		ID:       edgeID,
		Source:   source.ID,
		Target:   target.ID,
		Type:     edgeType,
		Category: category,
		Reason:   reason,
		Evidence: uniqueEvidence(evidence),
	}
}

func (document graphDocument) sortedNodes() []Node {
	nodes := make([]Node, 0, len(document.nodes))
	for _, node := range document.nodes {
		nodes = append(nodes, node)
	}

	sort.Slice(nodes, func(left int, right int) bool {
		if nodes[left].Kind == nodes[right].Kind {
			if nodes[left].Namespace == nodes[right].Namespace {
				return nodes[left].Name < nodes[right].Name
			}
			return nodes[left].Namespace < nodes[right].Namespace
		}
		return nodes[left].Kind < nodes[right].Kind
	})

	return nodes
}

func (document graphDocument) sortedEdges() []Edge {
	edges := make([]Edge, 0, len(document.edges))
	for _, edge := range document.edges {
		edges = append(edges, edge)
	}

	sort.Slice(edges, func(left int, right int) bool {
		if edges[left].Type == edges[right].Type {
			return edges[left].ID < edges[right].ID
		}
		return edges[left].Type < edges[right].Type
	})

	return edges
}

func (document graphDocument) oneHop(centerID string, filter map[string]struct{}) (GraphPayload, error) {
	centerNode, exists := document.nodes[centerID]
	if !exists {
		return GraphPayload{}, ErrResourceNotFound
	}

	selectedNodes := map[string]Node{centerNode.ID: centerNode}
	selectedEdges := make([]Edge, 0)
	for _, edge := range document.sortedEdges() {
		if len(filter) > 0 {
			if _, ok := filter[edge.Type]; !ok {
				continue
			}
		}

		if edge.Source != centerID && edge.Target != centerID {
			continue
		}

		selectedEdges = append(selectedEdges, edge)
		selectedNodes[edge.Source] = document.nodes[edge.Source]
		selectedNodes[edge.Target] = document.nodes[edge.Target]
	}

	nodes := make([]Node, 0, len(selectedNodes))
	for _, node := range selectedNodes {
		nodes = append(nodes, node)
	}

	sort.Slice(nodes, func(left int, right int) bool {
		if nodes[left].Kind == nodes[right].Kind {
			return nodes[left].Name < nodes[right].Name
		}
		return nodes[left].Kind < nodes[right].Kind
	})

	return GraphPayload{Center: centerNode, Nodes: nodes, Edges: selectedEdges}, nil
}

func nodeFromIngress(resource networkingv1.Ingress) Node {
	return nodeFromResource("Ingress", resource.Namespace, resource.Name, resource.Labels, "network", false)
}

func nodeFromService(resource corev1.Service) Node {
	return nodeFromResource("Service", resource.Namespace, resource.Name, resource.Labels, "network", false)
}

func nodeFromDeployment(resource appsv1.Deployment) Node {
	return nodeFromResource("Deployment", resource.Namespace, resource.Name, resource.Labels, "workload", false)
}

func nodeFromReplicaSet(resource appsv1.ReplicaSet) Node {
	return nodeFromResource("ReplicaSet", resource.Namespace, resource.Name, resource.Labels, "workload", false)
}

func nodeFromPod(resource corev1.Pod) Node {
	return nodeFromResource("Pod", resource.Namespace, resource.Name, resource.Labels, "workload", false)
}

func nodeFromConfigMap(resource corev1.ConfigMap) Node {
	return nodeFromResource("ConfigMap", resource.Namespace, resource.Name, resource.Labels, "config", false)
}

func nodeFromSecret(resource corev1.Secret) Node {
	return nodeFromResource("Secret", resource.Namespace, resource.Name, resource.Labels, "config", false)
}

func nodeFromPVC(resource corev1.PersistentVolumeClaim) Node {
	return nodeFromResource("PersistentVolumeClaim", resource.Namespace, resource.Name, resource.Labels, "storage", false)
}

func nodeFromPV(resource corev1.PersistentVolume) Node {
	return nodeFromResource("PersistentVolume", "", resource.Name, resource.Labels, "storage", true)
}

func nodeFromServiceAccount(resource corev1.ServiceAccount) Node {
	return nodeFromResource("ServiceAccount", resource.Namespace, resource.Name, resource.Labels, "identity", false)
}

func nodeFromNode(resource corev1.Node) Node {
	return nodeFromResource("Node", "", resource.Name, resource.Labels, "runtime", true)
}

func nodeFromHPA(resource autoscalingv2.HorizontalPodAutoscaler) Node {
	return nodeFromResource("HorizontalPodAutoscaler", resource.Namespace, resource.Name, resource.Labels, "autoscaling", false)
}

func nodeFromResource(kind string, namespace string, name string, labelsMap map[string]string, category string, clusterScoped bool) Node {
	return Node{
		ID:            resourceID(kind, namespace, name),
		Type:          "resource",
		Category:      category,
		Kind:          kind,
		Namespace:     namespace,
		Name:          name,
		ClusterScoped: clusterScoped,
		Labels:        copyLabels(labelsMap),
	}
}

func resourceID(kind string, namespace string, name string) string {
	return fmt.Sprintf("%s:%s:%s", strings.ToLower(kind), strings.ToLower(namespace), strings.ToLower(name))
}

func copyLabels(source map[string]string) map[string]string {
	if len(source) == 0 {
		return nil
	}

	result := make(map[string]string, len(source))
	for key, value := range source {
		result[key] = value
	}

	return result
}

func canonicalKind(value string) (string, error) {
	canonicalKinds := map[string]string{
		"configmap":                "ConfigMap",
		"configmaps":               "ConfigMap",
		"deployment":               "Deployment",
		"deployments":              "Deployment",
		"hpa":                      "HorizontalPodAutoscaler",
		"horizontalpodautoscaler":  "HorizontalPodAutoscaler",
		"horizontalpodautoscalers": "HorizontalPodAutoscaler",
		"ingress":                  "Ingress",
		"ingresses":                "Ingress",
		"node":                     "Node",
		"nodes":                    "Node",
		"persistentvolume":         "PersistentVolume",
		"persistentvolumes":        "PersistentVolume",
		"pv":                       "PersistentVolume",
		"persistentvolumeclaim":    "PersistentVolumeClaim",
		"persistentvolumeclaims":   "PersistentVolumeClaim",
		"pvc":                      "PersistentVolumeClaim",
		"pod":                      "Pod",
		"pods":                     "Pod",
		"replicaset":               "ReplicaSet",
		"replicasets":              "ReplicaSet",
		"secret":                   "Secret",
		"secrets":                  "Secret",
		"service":                  "Service",
		"services":                 "Service",
		"serviceaccount":           "ServiceAccount",
		"serviceaccounts":          "ServiceAccount",
	}

	canonicalValue, ok := canonicalKinds[strings.ToLower(strings.TrimSpace(value))]
	if !ok {
		return "", fmt.Errorf("unsupported kind: %s", value)
	}

	return canonicalValue, nil
}

func requiresNamespace(kind string) bool {
	return !isClusterScopedKind(kind)
}

func isClusterScopedKind(kind string) bool {
	return kind == "Node" || kind == "PersistentVolume"
}

func isSupportedEdgeType(edgeType string) bool {
	for _, supportedEdgeType := range SupportedEdgeTypes() {
		if edgeType == supportedEdgeType {
			return true
		}
	}

	return false
}

func uniqueEvidence(items []Evidence) []Evidence {
	if len(items) == 0 {
		return nil
	}

	result := make([]Evidence, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		key := strings.Join([]string{item.Field, item.Value, item.Description}, "|")
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, item)
	}

	return result
}

func toManifest(object any) (map[string]any, error) {
	manifest, err := runtime.DefaultUnstructuredConverter.ToUnstructured(object)
	if err != nil {
		return nil, err
	}

	return manifest, nil
}

func manifestMap(manifest map[string]any, field string) map[string]any {
	value, ok := manifest[field]
	if !ok {
		return nil
	}

	result, ok := value.(map[string]any)
	if !ok {
		return nil
	}

	return result
}
