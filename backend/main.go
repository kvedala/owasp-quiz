
package main

import (
	"encoding/json"
	"html"
	"log"
	"math"
	"net/http"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/google/uuid"

	"psp.com/owasp-quiz/backend/internal/cert"
	"psp.com/owasp-quiz/backend/internal/quiz"
	"psp.com/owasp-quiz/backend/internal/scraper"
)

type Attempt struct {
	ID        string
	QuizID    string
	Score     int
	Total     int
	Passed    bool
	CreatedAt time.Time

	// User info
	Name       string
	Email      string
	JobTitle   string
	Department string

	// Categories
	SelectedCats []string // IDs
	AllCats      []string // IDs

	PerCategory map[string]ct // ID -> score/total
}

type ct struct{ Score, Total int }

var (
	httpClient = &http.Client{ Timeout: 8 * time.Second }
	attempts   = map[string]Attempt{}
	indexCache []scraper.CheatSheet
	indexTS    time.Time
	top10Cache []scraper.Category
	top10TS    time.Time
)

// Input validation patterns
var (
	emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	nameRegex  = regexp.MustCompile(`^[a-zA-Z\s'-]{1,100}$`)
	textRegex  = regexp.MustCompile(`^[a-zA-Z0-9\s.,'-]{1,200}$`)
)

// Input sanitization and validation functions
func sanitizeText(input string) string {
	if input == "" {
		return ""
	}
	// HTML escape and trim
	cleaned := html.EscapeString(strings.TrimSpace(input))
	// Limit length
	if len(cleaned) > 200 {
		cleaned = cleaned[:200]
	}
	return cleaned
}

func validateEmail(email string) bool {
	if email == "" {
		return true // optional field
	}
	return len(email) <= 254 && emailRegex.MatchString(email)
}

func validateName(name string) bool {
	if name == "" {
		return false // required field
	}
	return len(name) <= 100 && nameRegex.MatchString(name)
}

func validateText(text string) bool {
	if text == "" {
		return true // optional field
	}
	return len(text) <= 200 && textRegex.MatchString(text)
}

func main() {
	r := chi.NewRouter()
	// Configure CORS with specific allowed origins
	allowedOrigins := strings.Split(getenv("ALLOWED_ORIGINS", "http://localhost:5173,https://localhost:5173"), ",")
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Add security headers middleware
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("X-XSS-Protection", "1; mode=block")
			w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
			w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'")
			next.ServeHTTP(w, r)
		})
	})

	// Add basic rate limiting middleware (simple implementation)
	rateLimiter := make(map[string][]time.Time)
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/healthz" {
				next.ServeHTTP(w, r)
				return
			}
			
			clientIP := r.RemoteAddr
			if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
				clientIP = strings.Split(xff, ",")[0]
			}
			
			now := time.Now()
			// Clean old entries
			if times, exists := rateLimiter[clientIP]; exists {
				var recent []time.Time
				for _, t := range times {
					if now.Sub(t) < time.Minute {
						recent = append(recent, t)
					}
				}
				rateLimiter[clientIP] = recent
			}
			
			// Check rate limit (60 requests per minute)
			if len(rateLimiter[clientIP]) >= 60 {
				http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
				return
			}
			
			rateLimiter[clientIP] = append(rateLimiter[clientIP], now)
			next.ServeHTTP(w, r)
		})
	})

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })

	r.Get("/api/categories", handleCategories)
	r.Get("/api/topics", handleTopics)
	r.Get("/api/generate-quiz", handleGenerateQuiz)
	r.Post("/api/submit", handleSubmit)
	r.Get("/api/certificate", handleCertificate)

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

// --- Handlers ---

func handleCategories(w http.ResponseWriter, r *http.Request) {
	cats, err := getTop10()
	if err != nil { http.Error(w, "failed to load categories", 500); return }
	writeJSON(w, cats)
}

func handleTopics(w http.ResponseWriter, r *http.Request) {
	topics, err := getIndex()
	if err != nil { http.Error(w, "failed to load topics", 500); return }
	writeJSON(w, topics)
}

type generateResp struct {
	Quiz        quiz.Quiz          `json:"quiz"`
	AllCats     []string           `json:"allCategories"`
	Selected    []string           `json:"selectedCategories"`
	CategoryMap map[string]string  `json:"categoryNames"` // ID -> name
}

func handleGenerateQuiz(w http.ResponseWriter, r *http.Request) {
	count := atoiDefault(r.URL.Query().Get("count"), 20)
	// Validate count limits
	if count < 5 { count = 5 }
	if count > 50 { count = 50 } // Prevent abuse
	
	seed := time.Now().UnixNano()
	if s := r.URL.Query().Get("seed"); s != "" { 
		if v, err := strconv.ParseInt(s, 10, 64); err == nil { 
			seed = v 
		} 
	}
	cats, err := getTop10()
	if err != nil { http.Error(w, "failed to load categories", 500); return }

	allIDs := make([]string, 0, len(cats))
	nameByID := map[string]string{}
	for _, c := range cats { allIDs = append(allIDs, c.ID); nameByID[c.ID] = c.Name }
	sort.Strings(allIDs)

	// Parse selected categories
	raw := strings.TrimSpace(r.URL.Query().Get("categories"))
	var selected []string
	if raw != "" { for _, tok := range strings.Split(raw, ",") { id := strings.TrimSpace(tok); if _, ok := nameByID[id]; ok { selected = append(selected, id) } } }
	if len(selected) == 0 { selected = allIDs }

	// Build distractor pool
	var distractorPool []string
	for _, catID := range selected {
		cat := findCat(cats, catID)
		for i := 0; i < min(2, len(cat.CheatSheets)); i++ {
			facts, _ := scraper.PullFacts(httpClient, cat.CheatSheets[i].URL)
			distractorPool = append(distractorPool, facts...)
		}
	}
	distractorPool = quiz.MergePool(distractorPool)

	// Build questions category-by-category
	var bundles [][]quiz.Question
outer:
	for _, catID := range selected {
		cat := findCat(cats, catID)
		for idx, cs := range cat.CheatSheets {
			facts, err := scraper.PullFacts(httpClient, cs.URL)
			if err != nil || len(facts) == 0 { continue }
			qs, err := quiz.BuildMCQ(cat.ID, cat.Name, cs.Title, cs.URL, facts, distractorPool, seed+int64(idx))
			if err == nil && len(qs) > 0 { bundles = append(bundles, qs) }
			if len(bundles) >= 6 { continue outer }
		}
	}

	q := quiz.AssembleQuiz(uuid.NewString(), bundles...)
	if len(q.Questions) == 0 { http.Error(w, "unable to generate questions", 500); return }
	if len(q.Questions) > count { q.Questions = q.Questions[:count] }
	writeJSON(w, generateResp{ Quiz: q, AllCats: allIDs, Selected: selected, CategoryMap: nameByID })
}

type submitReq struct {
	Name        string                 `json:"name"`
	Email       string                 `json:"email"`
	JobTitle    string                 `json:"jobTitle"`
	Department  string                 `json:"department"`
	QuizID      string                 `json:"quizId"`
	Answers     map[string]int         `json:"answers"`
	Questions   []quiz.Question        `json:"questions"`
	SelectedCats []string              `json:"selectedCategories"`
	AllCats      []string              `json:"allCategories"`
	CategoryMap  map[string]string     `json:"categoryNames"`
}

type submitResp struct {
	AttemptID   string                          `json:"attemptId"`
	Score       int                             `json:"score"`
	Total       int                             `json:"total"`
	Passed      bool                            `json:"passed"`
	PerCategory map[string]map[string]int       `json:"perCategory"` // ID->{score,total}
	CategoryMap map[string]string               `json:"categoryNames"`
	AllCats     []string                        `json:"allCategories"`
	Selected    []string                        `json:"selectedCategories"`
}

func handleSubmit(w http.ResponseWriter, r *http.Request) {
	var req submitReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { 
		http.Error(w, "bad request", 400); return 
	}
	
	// Validate and sanitize input
	req.Name = sanitizeText(req.Name)
	req.Email = sanitizeText(req.Email)
	req.JobTitle = sanitizeText(req.JobTitle)
	req.Department = sanitizeText(req.Department)
	
	if !validateName(req.Name) {
		http.Error(w, "invalid name", 400); return
	}
	if !validateEmail(req.Email) {
		http.Error(w, "invalid email", 400); return
	}
	if !validateText(req.JobTitle) {
		http.Error(w, "invalid job title", 400); return
	}
	if !validateText(req.Department) {
		http.Error(w, "invalid department", 400); return
	}
	
	// Validate quiz ID format
	if _, err := uuid.Parse(req.QuizID); err != nil {
		http.Error(w, "invalid quiz ID", 400); return
	}
	
	// Limit number of questions to prevent abuse
	if len(req.Questions) > 50 {
		http.Error(w, "too many questions", 400); return
	}
	
	score := 0
	total := len(req.Questions)

	per := map[string]ct{}
	for _, q := range req.Questions {
		b := per[q.CategoryID]
		b.Total++
		if ans, ok := req.Answers[q.ID]; ok && ans == q.AnswerIx { score++; b.Score++ }
		per[q.CategoryID] = b
	}
	passThreshold := int(math.Ceil(0.75 * float64(total)))
	passed := score >= passThreshold

	atID := uuid.NewString()
	// Store minimal data and add expiration
	attempt := Attempt{
		ID:           atID,
		QuizID:       req.QuizID,
		Score:        score,
		Total:        total,
		Passed:       passed,
		Name:         req.Name, // Already sanitized
		Email:        "", // Don't store email for privacy
		JobTitle:     req.JobTitle,
		Department:   req.Department,
		CreatedAt:    time.Now(),
		SelectedCats: req.SelectedCats,
		AllCats:      req.AllCats,
		PerCategory:  per,
	}
	
	// Clean old attempts (older than 24 hours)
	cutoff := time.Now().Add(-24 * time.Hour)
	for id, att := range attempts {
		if att.CreatedAt.Before(cutoff) {
			delete(attempts, id)
		}
	}
	
	attempts[atID] = attempt

	perOut := map[string]map[string]int{}
	for id, v := range per { perOut[id] = map[string]int{"score": v.Score, "total": v.Total} }
	writeJSON(w, submitResp{ AttemptID: atID, Score: score, Total: total, Passed: passed,
		PerCategory: perOut, CategoryMap: req.CategoryMap, AllCats: req.AllCats, Selected: req.SelectedCats })
}

func handleCertificate(w http.ResponseWriter, r *http.Request) {
	atID := r.URL.Query().Get("attempt_id")
	if atID == "" { 
		http.Error(w, "attempt_id required", 400); return 
	}
	
	// Validate UUID format
	if _, err := uuid.Parse(atID); err != nil {
		http.Error(w, "invalid attempt_id format", 400); return
	}
	
	at, ok := attempts[atID]
	if !ok { 
		http.Error(w, "attempt not found", 404); return 
	}
	var rows []cert.CategoryScore
	for id, v := range at.PerCategory { rows = append(rows, cert.CategoryScore{ Category: id, Score: v.Score, Total: v.Total }) }
	pdfBytes, err := cert.GeneratePDF(cert.CertData{
		AttemptID:    at.ID,
		Name:         firstNonEmpty(at.Name, "Candidate"),
		Score:        at.Score,
		Total:        at.Total,
		Passed:       at.Passed,
		Date:         at.CreatedAt,
		SelectedCats: at.SelectedCats,
		AllCats:      at.AllCats,
		PerCategory:  rows,
	})
	if err != nil { http.Error(w, "failed to generate certificate", 500); return }
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "attachment; filename=certificate-"+atID+".pdf")
	w.Write(pdfBytes)
}

// --- Helpers and caches ---

func getIndex() ([]scraper.CheatSheet, error) {
	if time.Since(indexTS) < 6*time.Hour && len(indexCache) > 0 { return indexCache, nil }
	topics, err := scraper.FetchAlphabeticalIndex(httpClient)
	if err != nil { return nil, err }
	indexCache = topics
	indexTS = time.Now()
	return topics, nil
}

func getTop10() ([]scraper.Category, error) {
	if time.Since(top10TS) < 6*time.Hour && len(top10Cache) > 0 { return top10Cache, nil }
	cats, err := scraper.FetchTop10Categories(httpClient)
	if err != nil { return nil, err }
	top10Cache = cats
	top10TS = time.Now()
	return cats, nil
}

func findCat(cats []scraper.Category, id string) scraper.Category {
	for _, c := range cats { if c.ID == id { return c } }
	return scraper.Category{ID: id, Name: id}
}

func writeJSON(w http.ResponseWriter, v any) { w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(v) }
func getenv(k, def string) string { if v := os.Getenv(k); v != "" { return v }; return def }
func atoiDefault(s string, def int) int { i, err := strconv.Atoi(s); if err != nil { return def }; return i }
func min(a, b int) int { if a < b { return a }; return b }
func firstNonEmpty(vals ...string) string { for _, v := range vals { if strings.TrimSpace(v) != "" { return v } }; return "" }
