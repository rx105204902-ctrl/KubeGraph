package kube

import (
	"fmt"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

func NewClient(kubeconfigPath string) (kubernetes.Interface, error) {
	if kubeconfigPath != "" {
		config, err := clientcmd.BuildConfigFromFlags("", kubeconfigPath)
		if err != nil {
			return nil, fmt.Errorf("娴?KUBECONFIG 閸掓稑缂撻柊宥囩枂婢惰精瑙? %w", err)
		}

		return kubernetes.NewForConfig(config)
	}

	loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
	config, kubeconfigErr := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
		loadingRules,
		&clientcmd.ConfigOverrides{},
	).ClientConfig()
	if kubeconfigErr == nil {
		return kubernetes.NewForConfig(config)
	}

	inClusterConfig, inClusterErr := rest.InClusterConfig()
	if inClusterErr == nil {
		return kubernetes.NewForConfig(inClusterConfig)
	}

	return nil, fmt.Errorf("閺堫亣鍏橀崝鐘烘祰 kubeconfig: %v閿涙稒婀懗钘夊鏉炰粙娉︾紘銈呭敶闁板秶鐤? %v", kubeconfigErr, inClusterErr)
}
