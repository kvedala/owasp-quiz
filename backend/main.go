
package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"

	"psp.com/owasp-quiz/backend/internal/quiz"
	"psp.com/owasp-quiz/backend/internal/questionbank"
)

func main() {
	// Initialize question bank
	bankPath := getenv("QUESTION_BANK_PATH", "/data/questionbank/questions.json")
	if err := questionbank.InitBank(bankPath); err != nil {
		log.Printf("⚠️  Failed to load question bank: %v (will fallback to live generation)", err)
	} else {
		if questionbank.IsEmpty() {
			log.Println("⚠️  Question bank is empty; using live generation until bank is populated")
		} else {
			stats := questionbank.GetStats()
			log.Printf("✓ Question bank loaded: %d categories", len(stats))
			for catID, count := range stats {
				log.Printf("  %s: %d questions", catID, count)
			}
		}
	}

	r := chi.NewRouter()

	// Configure CORS
	allowedOrigins := strings.Split(getenv("ALLOWED_ORIGINS", "http://localhost:5173,https://localhost:5173"), ",")
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Add middleware
	r.Use(securityHeadersMiddleware)
	limiter := newRateLimiter()
	r.Use(limiter.middleware)

	// Health check
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	// API routes
	r.Get("/api/categories", handleCategories)
	r.Get("/api/topics", handleTopics)
	r.Get("/api/metadata", handleMetadata)
	r.Get("/api/generate-quiz", handleGenerateQuiz)
	r.Post("/api/start-exam", handleStartExam)
	r.Post("/api/submit", handleSubmit)
	r.Post("/api/warmup", handleWarmup)
	r.Get("/api/certificate", handleCertificate)

	// Optional: configure LLM enhancer
	if p := strings.TrimSpace(os.Getenv("QUIZ_LLM_PROVIDER")); p != "" {
		cfg := quiz.LLMConfig{
			Provider: p,
			Model:    strings.TrimSpace(os.Getenv("QUIZ_LLM_MODEL")),
			Endpoint: strings.TrimSpace(os.Getenv("QUIZ_LLM_ENDPOINT")),
			APIKey:   strings.TrimSpace(os.Getenv("QUIZ_LLM_API_KEY")),
		}
		if f := quiz.OldNewLLMEnhancer(cfg); f != nil {
			quiz.SetStemEnhancer(f)
			log.Println("LLM stem enhancer enabled (provider:", strings.ToLower(p), ")")
		} else {
			log.Println("LLM stem enhancer not enabled: incomplete configuration")
		}
	}

	// Fire-and-forget prewarm of caches
	go func() {
		defer func() { recover() }()
		prewarm()
	}()

	port := getenv("PORT", "8080")
	tlsCert := os.Getenv("TLS_CERT")
	tlsKey := os.Getenv("TLS_KEY")

	if tlsCert != "" && tlsKey != "" {
		log.Println("backend listening on :" + port + " (HTTPS)")
		log.Fatal(http.ListenAndServeTLS(":"+port, tlsCert, tlsKey, r))
	} else {
		log.Println("backend listening on :" + port + " (HTTP)")
		log.Fatal(http.ListenAndServe(":"+port, r))
	}
}
