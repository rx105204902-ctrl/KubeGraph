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
		log.Fatalf("创建 Kubernetes 客户端失败: %v", err)
	}

	service := graph.NewService(client)
	handler := httpapi.New(service, appConfig.AllowedOrigin, appConfig.DefaultNamespace)

	server := &http.Server{
		Addr:              appConfig.Address,
		Handler:           handler.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	log.Printf("kube-graph 服务监听于 %s", appConfig.Address)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("HTTP 服务启动失败: %v", err)
	}
}
