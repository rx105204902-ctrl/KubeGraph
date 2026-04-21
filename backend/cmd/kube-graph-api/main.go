package main

import (
	"log"
	"net/http"
	"time"

	"kube-graph/backend/internal/config"
	"kube-graph/backend/internal/graph"
	"kube-graph/backend/internal/httpapi"
	"kube-graph/backend/internal/kube"
)

func main() {
	appConfig := config.Load()

	client, err := kube.NewClient(appConfig.Kubeconfig)
	if err != nil {
		log.Fatalf("閸掓稑缂?Kubernetes 鐎广垺鍩涚粩顖氥亼鐠? %v", err)
	}

	service := graph.NewService(client)
	handler := httpapi.New(service, appConfig.AllowedOrigin, appConfig.DefaultNamespace)

	server := &http.Server{
		Addr:              appConfig.Address,
		Handler:           handler.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	log.Printf("kube-graph 閸氬海顏崥顖氬З娴?%s", appConfig.Address)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("HTTP 閺堝秴濮熼崥顖氬З婢惰精瑙? %v", err)
	}
}
