package graph

import (
	"fmt"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	autoscalingv2 "k8s.io/api/autoscaling/v2"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

func TestBuildGraphExtractsExpectedRelationships(t *testing.T) {
	snapshot := testSnapshot()
	graph := buildGraph(snapshot)

	expectedEdges := []struct {
		edgeType string
		source   ResourceRef
		target   ResourceRef
		category string
	}{
		{edgeType: EdgeOwns, source: ResourceRef{Kind: "Deployment", Namespace: "demo", Name: "web"}, target: ResourceRef{Kind: "ReplicaSet", Namespace: "demo", Name: "web-6d4f7c"}, category: "control"},
		{edgeType: EdgeOwns, source: ResourceRef{Kind: "ReplicaSet", Namespace: "demo", Name: "web-6d4f7c"}, target: ResourceRef{Kind: "Pod", Namespace: "demo", Name: "web-pod"}, category: "control"},
		{edgeType: EdgeSelects, source: ResourceRef{Kind: "Service", Namespace: "demo", Name: "web"}, target: ResourceRef{Kind: "Pod", Namespace: "demo", Name: "web-pod"}, category: "traffic"},
		{edgeType: EdgeRoutesTo, source: ResourceRef{Kind: "Ingress", Namespace: "demo", Name: "web"}, target: ResourceRef{Kind: "Service", Namespace: "demo", Name: "web"}, category: "traffic"},
		{edgeType: EdgeMounts, source: ResourceRef{Kind: "Pod", Namespace: "demo", Name: "web-pod"}, target: ResourceRef{Kind: "ConfigMap", Namespace: "demo", Name: "app-config"}, category: "config"},
		{edgeType: EdgeMounts, source: ResourceRef{Kind: "Pod", Namespace: "demo", Name: "web-pod"}, target: ResourceRef{Kind: "Secret", Namespace: "demo", Name: "app-secret"}, category: "config"},
		{edgeType: EdgeMounts, source: ResourceRef{Kind: "Pod", Namespace: "demo", Name: "web-pod"}, target: ResourceRef{Kind: "PersistentVolumeClaim", Namespace: "demo", Name: "app-data"}, category: "storage"},
		{edgeType: EdgeReferences, source: ResourceRef{Kind: "Pod", Namespace: "demo", Name: "web-pod"}, target: ResourceRef{Kind: "ServiceAccount", Namespace: "demo", Name: "web-sa"}, category: "config"},
		{edgeType: EdgeReferences, source: ResourceRef{Kind: "HorizontalPodAutoscaler", Namespace: "demo", Name: "web-hpa"}, target: ResourceRef{Kind: "Deployment", Namespace: "demo", Name: "web"}, category: "control"},
		{edgeType: EdgeReferences, source: ResourceRef{Kind: "PersistentVolumeClaim", Namespace: "demo", Name: "app-data"}, target: ResourceRef{Kind: "PersistentVolume", Name: "pv-app-data"}, category: "storage"},
		{edgeType: EdgeRunsOn, source: ResourceRef{Kind: "Pod", Namespace: "demo", Name: "web-pod"}, target: ResourceRef{Kind: "Node", Name: "worker-a"}, category: "runtime"},
	}

	for _, expectedEdge := range expectedEdges {
		edgeID := fmt.Sprintf("%s:%s:%s", expectedEdge.edgeType, expectedEdge.source.ID(), expectedEdge.target.ID())
		edge, ok := graph.edges[edgeID]
		if !ok {
			t.Fatalf("expected edge %s to exist", edgeID)
		}

		if edge.Category != expectedEdge.category {
			t.Fatalf("expected edge %s to use category %s, got %s", edgeID, expectedEdge.category, edge.Category)
		}

		if len(edge.Evidence) == 0 {
			t.Fatalf("expected edge %s to include evidence", edgeID)
		}
	}

	reverseEdgeID := fmt.Sprintf("%s:%s:%s", EdgeOwns, ResourceRef{Kind: "ReplicaSet", Namespace: "demo", Name: "web-6d4f7c"}.ID(), ResourceRef{Kind: "Deployment", Namespace: "demo", Name: "web"}.ID())
	if _, exists := graph.edges[reverseEdgeID]; exists {
		t.Fatalf("unexpected reverse edge %s", reverseEdgeID)
	}
}

func TestOneHopFilteringReturnsRequestedEdgeTypes(t *testing.T) {
	snapshot := testSnapshot()
	graph := buildGraph(snapshot)

	payload, err := graph.oneHop(
		ResourceRef{Kind: "Pod", Namespace: "demo", Name: "web-pod"}.ID(),
		map[string]struct{}{EdgeMounts: {}, EdgeRunsOn: {}},
	)
	if err != nil {
		t.Fatalf("expected one-hop query to succeed, got %v", err)
	}

	if payload.Center.Kind != "Pod" || payload.Center.Name != "web-pod" {
		t.Fatalf("unexpected center node: %+v", payload.Center)
	}

	if len(payload.Edges) != 4 {
		t.Fatalf("expected 4 filtered edges, got %d", len(payload.Edges))
	}

	for _, edge := range payload.Edges {
		if edge.Type != EdgeMounts && edge.Type != EdgeRunsOn {
			t.Fatalf("unexpected edge type %s", edge.Type)
		}
	}
}

func testSnapshot() *Snapshot {
	deploymentUID := types.UID("deployment-web")
	replicaSetUID := types.UID("replicaset-web")

	return &Snapshot{
		Namespace: "demo",
		Deployments: []appsv1.Deployment{{
			ObjectMeta: metav1.ObjectMeta{Name: "web", Namespace: "demo", UID: deploymentUID, Labels: map[string]string{"app": "web"}},
		}},
		ReplicaSets: []appsv1.ReplicaSet{{
			ObjectMeta: metav1.ObjectMeta{
				Name:            "web-6d4f7c",
				Namespace:       "demo",
				UID:             replicaSetUID,
				Labels:          map[string]string{"app": "web"},
				OwnerReferences: []metav1.OwnerReference{{Kind: "Deployment", UID: deploymentUID}},
			},
		}},
		Pods: []corev1.Pod{{
			ObjectMeta: metav1.ObjectMeta{
				Name:            "web-pod",
				Namespace:       "demo",
				Labels:          map[string]string{"app": "web"},
				OwnerReferences: []metav1.OwnerReference{{Kind: "ReplicaSet", UID: replicaSetUID}},
			},
			Spec: corev1.PodSpec{
				ServiceAccountName: "web-sa",
				NodeName:           "worker-a",
				ImagePullSecrets:   []corev1.LocalObjectReference{{Name: "pull-secret"}},
				Volumes: []corev1.Volume{
					{Name: "config", VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{LocalObjectReference: corev1.LocalObjectReference{Name: "app-config"}}}},
					{Name: "secret", VolumeSource: corev1.VolumeSource{Secret: &corev1.SecretVolumeSource{SecretName: "app-secret"}}},
					{Name: "storage", VolumeSource: corev1.VolumeSource{PersistentVolumeClaim: &corev1.PersistentVolumeClaimVolumeSource{ClaimName: "app-data"}}},
				},
				Containers: []corev1.Container{{
					Name: "web",
					EnvFrom: []corev1.EnvFromSource{
						{ConfigMapRef: &corev1.ConfigMapEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "env-config"}}},
						{SecretRef: &corev1.SecretEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: "env-secret"}}},
					},
					Env: []corev1.EnvVar{
						{Name: "APP_MODE", ValueFrom: &corev1.EnvVarSource{ConfigMapKeyRef: &corev1.ConfigMapKeySelector{LocalObjectReference: corev1.LocalObjectReference{Name: "app-config"}, Key: "mode"}}},
						{Name: "APP_TOKEN", ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{LocalObjectReference: corev1.LocalObjectReference{Name: "app-secret"}, Key: "token"}}},
					},
				}},
			},
		}},
		Services: []corev1.Service{{
			ObjectMeta: metav1.ObjectMeta{Name: "web", Namespace: "demo", Labels: map[string]string{"app": "web"}},
			Spec:       corev1.ServiceSpec{Selector: map[string]string{"app": "web"}},
		}},
		Ingresses: []networkingv1.Ingress{{
			ObjectMeta: metav1.ObjectMeta{Name: "web", Namespace: "demo"},
			Spec: networkingv1.IngressSpec{
				Rules: []networkingv1.IngressRule{{
					IngressRuleValue: networkingv1.IngressRuleValue{
						HTTP: &networkingv1.HTTPIngressRuleValue{
							Paths: []networkingv1.HTTPIngressPath{{
								Backend: networkingv1.IngressBackend{Service: &networkingv1.IngressServiceBackend{Name: "web"}},
							}},
						},
					},
				}},
			},
		}},
		ConfigMaps: []corev1.ConfigMap{
			{ObjectMeta: metav1.ObjectMeta{Name: "app-config", Namespace: "demo"}},
			{ObjectMeta: metav1.ObjectMeta{Name: "env-config", Namespace: "demo"}},
		},
		Secrets: []corev1.Secret{
			{ObjectMeta: metav1.ObjectMeta{Name: "app-secret", Namespace: "demo"}},
			{ObjectMeta: metav1.ObjectMeta{Name: "env-secret", Namespace: "demo"}},
			{ObjectMeta: metav1.ObjectMeta{Name: "pull-secret", Namespace: "demo"}},
		},
		PVCs: []corev1.PersistentVolumeClaim{{
			ObjectMeta: metav1.ObjectMeta{Name: "app-data", Namespace: "demo"},
			Spec:       corev1.PersistentVolumeClaimSpec{VolumeName: "pv-app-data"},
		}},
		PVs: []corev1.PersistentVolume{{
			ObjectMeta: metav1.ObjectMeta{Name: "pv-app-data"},
		}},
		ServiceAccounts: []corev1.ServiceAccount{{
			ObjectMeta: metav1.ObjectMeta{Name: "web-sa", Namespace: "demo"},
		}},
		Nodes: []corev1.Node{{
			ObjectMeta: metav1.ObjectMeta{Name: "worker-a"},
		}},
		HPAs: []autoscalingv2.HorizontalPodAutoscaler{{
			ObjectMeta: metav1.ObjectMeta{Name: "web-hpa", Namespace: "demo"},
			Spec:       autoscalingv2.HorizontalPodAutoscalerSpec{ScaleTargetRef: autoscalingv2.CrossVersionObjectReference{Kind: "Deployment", Name: "web"}},
		}},
	}
}
