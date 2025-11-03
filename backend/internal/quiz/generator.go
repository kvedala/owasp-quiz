
package quiz

import (
	"errors"
	"math/rand/v2"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
)

type Question struct {
	ID         string   `json:"id"`
	Stem       string   `json:"stem"`
	Options    []string `json:"options"`
	AnswerIx   int      `json:"answerIndex"`
	Source     string   `json:"source"`
	URL        string   `json:"url"`
	Category   string   `json:"category"`
	CategoryID string   `json:"categoryId"`
}

type Quiz struct {
	ID        string     `json:"id"`
	Questions []Question `json:"questions"`
}

func BuildMCQ(categoryID, categoryName, cheatTitle, cheatURL string,
	facts []string, distractorPool []string, seed int64) ([]Question, error) {
	if len(facts) == 0 || len(distractorPool) < 3 {
		return nil, errors.New("insufficient facts")
	}
	r := rand.New(rand.NewPCG(uint64(seed), uint64(time.Now().UnixNano())))
	rngPick := func(pool []string) string { return pool[r.IntN(len(pool))] }

	var qs []Question
	// take up to 20 facts to avoid over-long quizzes from a single source
	n := min(20, len(facts))
	picks := r.Perm(len(facts))[:n]

	for _, ix := range picks {
		correct := sanitize(facts[ix])
		if correct == "" {
			continue
		}
		// build options: 1 correct + 3 distractors
		opts := map[string]struct{}{correct: {}}
		for len(opts) < 4 {
			d := sanitize(rngPick(distractorPool))
			if d != "" {
				opts[d] = struct{}{}
			}
		}
		var arr []string
		for k := range opts { arr = append(arr, k) }
		// shuffle
		r.Shuffle(len(arr), func(i, j int) { arr[i], arr[j] = arr[j], arr[i] })
		answerIx := indexOf(arr, correct)

		qs = append(qs, Question{
			ID:         uuid.NewString(),
			Stem:       "Which of the following aligns with guidance from \"" + cheatTitle + "\"?",
			Options:    arr,
			AnswerIx:   answerIx,
			Source:     cheatTitle,
			URL:        cheatURL,
			Category:   categoryID + " – " + categoryName,
			CategoryID: categoryID,
		})
		if len(qs) >= 25 { break }
	}
	return qs, nil
}

func AssembleQuiz(id string, bundles ...[]Question) Quiz {
	var all []Question
	for _, b := range bundles { all = append(all, b...) }
	if len(all) > 30 { all = all[:30] }
	return Quiz{ID: id, Questions: all}
}

func sanitize(s string) string {
	s = strings.TrimSpace(s)
	s = strings.Trim(s, "•-–— ")
	s = strings.TrimSuffix(s, ".")
	if len(s) < 10 { return "" }
	return s
}

func indexOf(arr []string, s string) int { for i, v := range arr { if v == s { return i } }; return -1 }

func min(a, b int) int { if a < b { return a }; return b }

// Merge and de-duplicate a pool for distractors.
func MergePool(slices ...[]string) []string {
	seen := map[string]struct{}{}
	var out []string
	for _, sl := range slices {
		for _, it := range sl {
			it = sanitize(it)
			if it == "" { continue }
			if _, ok := seen[it]; !ok {
				seen[it] = struct{}{}
				out = append(out, it)
			}
		}
	}
	sort.Strings(out)
	return out
}
