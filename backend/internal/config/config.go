package config

import "os"

type Config struct {
	Address          string
	DefaultNamespace string
	Kubeconfig       string
	AllowedOrigin    string
}

func Load() Config {
	return Config{
		Address:          envOrDefault("KUBE_GRAPH_ADDRESS", ":8999"),
		DefaultNamespace: envOrDefault("KUBE_GRAPH_DEFAULT_NAMESPACE", "default"),
		Kubeconfig:       os.Getenv("KUBECONFIG"),
		AllowedOrigin:    envOrDefault("KUBE_GRAPH_ALLOWED_ORIGIN", "*"),
	}
}

func envOrDefault(name string, fallback string) string {
	value := os.Getenv(name)
	if value == "" {
		return fallback
	}

	return value
}
