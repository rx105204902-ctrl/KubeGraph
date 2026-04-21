package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"kube-graph/backend/internal/graph"
)

type Server struct {
	service          *graph.Service
	allowedOrigin    string
	defaultNamespace string
}

func New(service *graph.Service, allowedOrigin string, defaultNamespace string) *Server {
	return &Server{service: service, allowedOrigin: allowedOrigin, defaultNamespace: defaultNamespace}
}

func (server *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/healthz", server.handleHealth)
	mux.HandleFunc("/api/v1/namespaces", server.handleNamespaces)
	mux.HandleFunc("/api/v1/resources/search", server.handleSearch)
	mux.HandleFunc("/api/v1/resources/detail", server.handleDetail)
	mux.HandleFunc("/api/v1/resources/manifest", server.handleManifest)
	mux.HandleFunc("/api/v1/graph/neighbors", server.handleNeighbors)

	return server.withCORS(mux)
}

func (server *Server) handleHealth(writer http.ResponseWriter, _ *http.Request) {
	server.writeJSON(writer, http.StatusOK, map[string]any{"status": "ok"})
}

func (server *Server) handleNamespaces(writer http.ResponseWriter, request *http.Request) {
	items, err := server.service.ListNamespaces(request.Context())
	if err != nil {
		server.writeError(writer, http.StatusInternalServerError, err)
		return
	}

	server.writeJSON(writer, http.StatusOK, map[string]any{
		"defaultNamespace": server.defaultNamespace,
		"items":            items,
	})
}

func (server *Server) handleSearch(writer http.ResponseWriter, request *http.Request) {
	namespace := strings.TrimSpace(request.URL.Query().Get("namespace"))
	query := request.URL.Query().Get("query")
	kind := request.URL.Query().Get("kind")

	items, err := server.service.SearchResources(request.Context(), namespace, query, kind)
	if err != nil {
		server.writeError(writer, http.StatusBadRequest, err)
		return
	}

	server.writeJSON(writer, http.StatusOK, map[string]any{"items": items})
}

func (server *Server) handleNeighbors(writer http.ResponseWriter, request *http.Request) {
	namespace := strings.TrimSpace(request.URL.Query().Get("namespace"))
	ref := graph.ResourceRef{
		Kind:      request.URL.Query().Get("kind"),
		Namespace: request.URL.Query().Get("namespace"),
		Name:      request.URL.Query().Get("name"),
	}

	payload, err := server.service.QueryNeighbors(request.Context(), namespace, ref, parseEdgeTypes(request))
	if err != nil {
		server.writeServiceError(writer, err)
		return
	}

	server.writeJSON(writer, http.StatusOK, payload)
}

func (server *Server) handleDetail(writer http.ResponseWriter, request *http.Request) {
	ref := graph.ResourceRef{
		Kind:      request.URL.Query().Get("kind"),
		Namespace: request.URL.Query().Get("namespace"),
		Name:      request.URL.Query().Get("name"),
	}

	payload, err := server.service.GetNodeDetail(request.Context(), ref)
	if err != nil {
		server.writeServiceError(writer, err)
		return
	}

	server.writeJSON(writer, http.StatusOK, payload)
}

func (server *Server) handleManifest(writer http.ResponseWriter, request *http.Request) {
	ref := graph.ResourceRef{
		Kind:      request.URL.Query().Get("kind"),
		Namespace: request.URL.Query().Get("namespace"),
		Name:      request.URL.Query().Get("name"),
	}

	payload, err := server.service.GetManifest(request.Context(), ref)
	if err != nil {
		server.writeServiceError(writer, err)
		return
	}

	server.writeJSON(writer, http.StatusOK, payload)
}

func (server *Server) writeServiceError(writer http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, graph.ErrResourceNotFound):
		server.writeError(writer, http.StatusNotFound, err)
	case apierrors.IsNotFound(err):
		server.writeError(writer, http.StatusNotFound, err)
	default:
		server.writeError(writer, http.StatusBadRequest, err)
	}
}

func (server *Server) withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Access-Control-Allow-Origin", server.allowedOrigin)
		writer.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		writer.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if request.Method == http.MethodOptions {
			writer.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(writer, request)
	})
}

func (server *Server) writeJSON(writer http.ResponseWriter, statusCode int, payload any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(statusCode)
	_ = json.NewEncoder(writer).Encode(payload)
}

func (server *Server) writeError(writer http.ResponseWriter, statusCode int, err error) {
	server.writeJSON(writer, statusCode, map[string]any{"error": err.Error()})
}

func parseEdgeTypes(request *http.Request) []string {
	items := make([]string, 0)
	for _, rawValue := range request.URL.Query()["edgeType"] {
		for _, value := range strings.Split(rawValue, ",") {
			value = strings.TrimSpace(value)
			if value != "" {
				items = append(items, value)
			}
		}
	}

	return items
}
