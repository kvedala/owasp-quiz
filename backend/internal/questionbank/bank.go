package questionbank

import (
	"encoding/json"
	"errors"
	"math/rand"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"opencompany/owasp-quiz/backend/internal/quiz"
)

// Question represents a pre-generated quiz question with metadata
type Question struct {
	ID          string   `json:"id"`
	CategoryID  string   `json:"categoryId"`
	Category    string   `json:"category"`
	Stem        string   `json:"stem"`
	Options     []string `json:"options"`
	AnswerIx    int      `json:"answerIndex"`
	Source      string   `json:"source"`
	URL         string   `json:"url"`
	Explanation string   `json:"explanation"` // Feedback on correct/incorrect answers
	Generated   string   `json:"generated"`   // ISO timestamp
}

// RawQuestion represents the ingested JSON format
type RawQuestion struct {
	Topic       string   `json:"topic"`
	Difficulty  string   `json:"difficulty"`
	Question    string   `json:"question"`
	Options     []string `json:"options"`
	Answer      int      `json:"answer"`
	Explanation string   `json:"explanation"`
	Tags        []string `json:"tags"`
	Source      string   `json:"source"`
}

type RawBank struct {
	Meta      map[string]interface{} `json:"meta"`
	Questions []RawQuestion          `json:"questions"`
}

// Bank represents the entire question bank
type Bank struct {
	Version   string                 `json:"version"`
	Generated string                 `json:"generated"` // ISO timestamp
	Meta      map[string]interface{} `json:"meta"`      // Metadata from raw format (title, license, sources, etc.)
	Questions map[string][]Question  `json:"questions"` // categoryID -> questions
	mu        sync.RWMutex
}

var globalBank *Bank
var bankPath string

// InitBank loads the question bank from the given file path
// Supports both raw indexed format and bank format
func InitBank(path string) error {
	bankPath = path
	globalBank = &Bank{Questions: make(map[string][]Question), Meta: make(map[string]interface{})}
	
	if _, err := os.Stat(path); os.IsNotExist(err) {
		// Bank doesn't exist yet; start empty
		return nil
	}
	
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	// Try to detect format: look for "meta" field (raw) vs "version" field (bank)
	var rawData map[string]interface{}
	if err := json.Unmarshal(data, &rawData); err != nil {
		return err
	}

	if _, hasMeta := rawData["meta"]; hasMeta {
		// Raw indexed format
		var raw RawBank
		if err := json.Unmarshal(data, &raw); err != nil {
			return err
		}
		return convertRawToBank(raw)
	}

	// Bank format
	if err := json.Unmarshal(data, globalBank); err != nil {
		return err
	}
	
	return nil
}

// convertRawToBank converts the raw indexed format to bank format
func convertRawToBank(raw RawBank) error {
	globalBank.Version = "1.0"
	globalBank.Generated = time.Now().UTC().Format(time.RFC3339)
	globalBank.Meta = raw.Meta // Preserve metadata from raw format

	categoryMap := make(map[string][]Question)
	// Track question stems to deduplicate (key: stem, value: Question)
	seenQuestions := make(map[string]Question)

	for _, rawQ := range raw.Questions {
		// Extract category ID from topic (e.g., "A01: Broken Access Control" -> "A01")
		parts := strings.Split(rawQ.Topic, ":")
		catID := parts[0]
		catID = strings.TrimSpace(catID)

		q := Question{
			ID:          uuid.New().String(),
			CategoryID:  catID,
			Category:    rawQ.Topic,
			Stem:        rawQ.Question,
			Options:     rawQ.Options,
			AnswerIx:    rawQ.Answer,
			Explanation: rawQ.Explanation,
			Source:      extractSourceName(rawQ.Topic),
			URL:         rawQ.Source,
			Generated:   time.Now().UTC().Format(time.RFC3339),
		}

		// Skip if we've already seen this exact question stem
		if _, exists := seenQuestions[rawQ.Question]; exists {
			continue
		}
		seenQuestions[rawQ.Question] = q

		categoryMap[catID] = append(categoryMap[catID], q)
	}

	globalBank.Questions = categoryMap
	return nil
}

func extractSourceName(topic string) string {
	// Extract source name from topic like "A01: Broken Access Control" -> "Broken Access Control"
	parts := strings.Split(topic, ":")
	if len(parts) > 1 {
		return strings.TrimSpace(parts[1])
	}
	return "OWASP"
}

// SaveBank persists the current question bank to disk
func SaveBank() error {
	if globalBank == nil || bankPath == "" {
		return errors.New("bank not initialized")
	}
	
	globalBank.mu.RLock()
	defer globalBank.mu.RUnlock()
	
	data, err := json.MarshalIndent(globalBank, "", "  ")
	if err != nil {
		return err
	}
	
	return os.WriteFile(bankPath, data, 0644)
}

// AddQuestions adds questions to the bank for a specific category
func AddQuestions(categoryID string, questions []Question) {
	if globalBank == nil {
		return
	}
	
	globalBank.mu.Lock()
	defer globalBank.mu.Unlock()
	
	globalBank.Questions[categoryID] = append(globalBank.Questions[categoryID], questions...)
	globalBank.Generated = time.Now().UTC().Format(time.RFC3339)
}

// SetQuestions replaces all questions for a category
func SetQuestions(categoryID string, questions []Question) {
	if globalBank == nil {
		return
	}
	
	globalBank.mu.Lock()
	defer globalBank.mu.Unlock()
	
	globalBank.Questions[categoryID] = questions
	globalBank.Generated = time.Now().UTC().Format(time.RFC3339)
}

// GetQuestions retrieves N random questions from the specified categories
// If count > available, returns all available questions
func GetQuestions(categoryIDs []string, count int, seed int64) []quiz.Question {
	if globalBank == nil {
		return nil
	}
	
	globalBank.mu.RLock()
	defer globalBank.mu.RUnlock()
	
	var pool []Question
	for _, catID := range categoryIDs {
		if qs, ok := globalBank.Questions[catID]; ok {
			pool = append(pool, qs...)
		}
	}
	
	if len(pool) == 0 {
		return nil
	}
	
	// Shuffle with seed for reproducibility
	r := rand.New(rand.NewSource(seed))
	r.Shuffle(len(pool), func(i, j int) { pool[i], pool[j] = pool[j], pool[i] })
	
	if count > len(pool) {
		count = len(pool)
	}
	
	// Convert to quiz.Question format
	result := make([]quiz.Question, count)
	for i := 0; i < count; i++ {
		q := pool[i]
		result[i] = quiz.Question{
			ID:          q.ID,
			Stem:        q.Stem,
			Options:     q.Options,
			AnswerIx:    q.AnswerIx,
			Source:      q.Source,
			URL:         q.URL,
			Category:    q.Category,
			CategoryID:  q.CategoryID,
			Explanation: q.Explanation,
		}
	}
	
	return result
}

// GetStats returns statistics about the question bank
func GetStats() map[string]int {
	if globalBank == nil {
		return nil
	}
	
	globalBank.mu.RLock()
	defer globalBank.mu.RUnlock()
	
	stats := make(map[string]int)
	for catID, qs := range globalBank.Questions {
		stats[catID] = len(qs)
	}
	
	return stats
}

// GetAllCategories returns the list of all category IDs in the bank
func GetAllCategories() []string {
	if globalBank == nil {
		return nil
	}
	
	globalBank.mu.RLock()
	defer globalBank.mu.RUnlock()
	
	cats := make([]string, 0, len(globalBank.Questions))
	for catID := range globalBank.Questions {
		cats = append(cats, catID)
	}
	return cats
}

// GetMetadata returns the metadata from the question bank (title, license, sources, etc.)
func GetMetadata() map[string]interface{} {
	if globalBank == nil {
		return nil
	}
	
	globalBank.mu.RLock()
	defer globalBank.mu.RUnlock()
	
	// Return a copy to prevent external modification
	meta := make(map[string]interface{})
	for k, v := range globalBank.Meta {
		meta[k] = v
	}
	return meta
}

// IsEmpty returns true if the question bank has no questions
func IsEmpty() bool {
	if globalBank == nil {
		return true
	}
	
	globalBank.mu.RLock()
	defer globalBank.mu.RUnlock()
	
	return len(globalBank.Questions) == 0
}

// Category represents a security category with its ID and name
type Category struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// CheatSheet represents a topic/source document
type CheatSheet struct {
	Title string `json:"title"`
	URL   string `json:"url"`
}

// GetCategories returns all categories available in the question bank
func GetCategories() []Category {
	if globalBank == nil {
		return nil
	}
	
	globalBank.mu.RLock()
	defer globalBank.mu.RUnlock()
	
	categories := make(map[string]string)
	for _, questions := range globalBank.Questions {
		for _, q := range questions {
			if _, exists := categories[q.CategoryID]; !exists {
				categories[q.CategoryID] = q.Category
			}
		}
	}
	
	result := make([]Category, 0, len(categories))
	for id, name := range categories {
		result = append(result, Category{ID: id, Name: name})
	}
	
	// Sort by ID for consistency
	sort.Slice(result, func(i, j int) bool {
		return result[i].ID < result[j].ID
	})
	
	return result
}

// GetCheatSheets returns all unique cheat sheet sources in the question bank
func GetCheatSheets() []CheatSheet {
	if globalBank == nil {
		return nil
	}
	
	globalBank.mu.RLock()
	defer globalBank.mu.RUnlock()
	
	sheets := make(map[string]string)
	for _, questions := range globalBank.Questions {
		for _, q := range questions {
			if q.Source != "" && q.URL != "" {
				sheets[q.Source] = q.URL
			}
		}
	}
	
	result := make([]CheatSheet, 0, len(sheets))
	for title, url := range sheets {
		result = append(result, CheatSheet{Title: title, URL: url})
	}
	
	// Sort by title for consistency
	sort.Slice(result, func(i, j int) bool {
		return result[i].Title < result[j].Title
	})
	
	return result
}
