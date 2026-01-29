
package scraper

import (
	"errors"
	"net/http"
	"strings"
	"time"
	"sync"

	"github.com/PuerkitoBio/goquery"
)

const (
	baseURL   = "https://cheatsheetseries.owasp.org"
	userAgent = "OWASP-Quiz-Bot/1.0 (+https://example.org)"
)

// CheatSheet holds a title and absolute link to an OWASP CSS page.
type CheatSheet struct {
	Title string `json:"title"`
	URL   string `json:"url"`
}

// cleanText normalizes text scraped from the web by:
// - trimming whitespace and collapsing internal runs of spaces
// - removing non-breaking and zero-width spaces
// - preserving unicode letters, numbers, and common punctuation
func cleanText(s string) string {
	if s == "" {
		return s
	}
	s = strings.TrimSpace(s)

	// normalize common problematic chars
	s = strings.ReplaceAll(s, "\u00A0", " ")  // nbsp -> regular space
	s = strings.ReplaceAll(s, "\u200B", "")   // zero-width space
	s = strings.ReplaceAll(s, "\uFEFF", "")   // BOM
	s = strings.ReplaceAll(s, "\u2060", "")   // word joiner
	s = strings.ReplaceAll(s, "\u200C", "")   // zero-width non-joiner
	s = strings.ReplaceAll(s, "\u200D", "")   // zero-width joiner

	// strip only obvious noise/bullet characters at edges using character-by-character checks
	// these are symbols, not valid unicode letters or numbers
	problemChars := "¶§•\u2020\u2021\u203B\u204E\u2010_[({])}‣⁎†"
	s = strings.Trim(s, problemChars)
	s = strings.TrimSpace(s)

	// collapse whitespace runs
	s = strings.Join(strings.Fields(s), " ")
	return s
}

// FetchAlphabeticalIndex finds the "Index Alphabetical" page from the homepage,
// then returns all cheat sheet links under /cheatsheets/*.html.
func FetchAlphabeticalIndex(client *http.Client) ([]CheatSheet, error) {
	indexURL, err := discoverAlphabeticalIndex(client)
	if err != nil {
		return nil, err
	}
	req, _ := http.NewRequest("GET", indexURL, nil)
	req.Header.Set("User-Agent", userAgent)
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("failed to load index")
	}

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, err
	}

	var out []CheatSheet
	doc.Find("a").Each(func(_ int, s *goquery.Selection) {
		href, ok := s.Attr("href")
		title := cleanText(s.Text())
		if !ok || title == "" {
			return
		}
		// We only want official cheat sheet pages - handle both absolute and relative paths
		if (strings.HasPrefix(href, "/cheatsheets/") || strings.HasPrefix(href, "cheatsheets/")) && strings.HasSuffix(href, ".html") {
			if !strings.HasPrefix(href, "/") {
				href = "/" + href
			}
			out = append(out, CheatSheet{
				Title: cleanText(title),
				URL:   baseURL + href,
			})
		}
	})
	return out, nil
}

func discoverAlphabeticalIndex(client *http.Client) (string, error) {
	req, _ := http.NewRequest("GET", baseURL+"/", nil)
	req.Header.Set("User-Agent", userAgent)
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", errors.New("failed to load OWASP CSS home")
	}

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return "", err
	}

	// Look for nav link that contains "Index Alphabetical".
	var indexHref string
	doc.Find("a").Each(func(_ int, s *goquery.Selection) {
		txt := strings.TrimSpace(strings.ToLower(s.Text()))
		if strings.Contains(txt, "index alphabetical") {
			if href, ok := s.Attr("href"); ok {
				if strings.HasPrefix(href, "http") {
					indexHref = href
				} else {
					indexHref = baseURL + "/" + strings.TrimLeft(href, "/")
				}
			}
		}
	})
	if indexHref == "" {
		// fallback to a known index path if website structure changes
		indexHref = baseURL + "/Index.html"
	}
	return indexHref, nil
}

// PullFacts extracts bullet-point facts from a cheat sheet page.
func PullFacts(client *http.Client, pageURL string) ([]string, error) {
	if facts, ok := getFactsFromCache(pageURL); ok {
		return facts, nil
	}
	req, _ := http.NewRequest("GET", pageURL, nil)
	req.Header.Set("User-Agent", userAgent)
	// be polite
	time.Sleep(300 * time.Millisecond)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("failed to load cheat sheet: " + pageURL)
	}
	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, err
	}

	var facts []string
	// Heuristic: capture bullet points from content area
	doc.Find("main ul li, article ul li").Each(func(_ int, li *goquery.Selection) {
		text := cleanText(li.Text())
		if len(text) > 0 && len(text) < 260 { // skip ultra-long lines
			facts = append(facts, text)
		}
	})
	putFactsInCache(pageURL, facts)
	return facts, nil
}

// PullPageContent extracts the main article/content text from a cheat sheet page.
// Returns the full content as a single string for LLM processing.
func PullPageContent(client *http.Client, pageURL string) (string, error) {
	if content, ok := getContentFromCache(pageURL); ok {
		return content, nil
	}
	req, _ := http.NewRequest("GET", pageURL, nil)
	req.Header.Set("User-Agent", userAgent)
	// be polite
	time.Sleep(300 * time.Millisecond)

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", errors.New("failed to load cheat sheet: " + pageURL)
	}
	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return "", err
	}

	// Extract main content - look for main article or content div
	var content strings.Builder
	doc.Find("main, article, .content").First().Find("h1, h2, h3, h4, p, li").Each(func(_ int, s *goquery.Selection) {
		text := cleanText(s.Text())
		if len(text) == 0 { return }
		// Filter navigation/metadata patterns
		lower := strings.ToLower(text)
		if strings.Contains(lower, "index") || strings.HasPrefix(lower, "introduction") ||
		   strings.HasSuffix(lower, ".md") || strings.Contains(lower, "top 10") ||
		   strings.Contains(lower, "proactive controls") || strings.Contains(lower, "masvs") {
			return
		}
		// Skip very short lines (likely headings/nav)
		if len(text) < 15 { return }
		content.WriteString(text)
		content.WriteString("\n")
	})
	
	result := content.String()
	// Trim to reasonable size for LLM prompts (1200 chars)
	if len(result) > 1200 {
		result = result[:1200] + "..."
	}
	putContentInCache(pageURL, result)
	return result, nil
}

// --- simple in-process cache for facts (6h TTL) ---
type factsEntry struct {
	at    time.Time
	facts []string
}

type contentEntry struct {
	at      time.Time
	content string
}

var (
	factsMu      sync.RWMutex
	factsCache   = map[string]factsEntry{}
	contentMu    sync.RWMutex
	contentCache = map[string]contentEntry{}
)

func getFactsFromCache(url string) ([]string, bool) {
	factsMu.RLock()
	e, ok := factsCache[url]
	factsMu.RUnlock()
	if !ok { return nil, false }
	if time.Since(e.at) > 6*time.Hour { return nil, false }
	return append([]string(nil), e.facts...), true
}

func putFactsInCache(url string, facts []string) {
	if len(facts) == 0 { return }
	factsMu.Lock()
	factsCache[url] = factsEntry{ at: time.Now(), facts: append([]string(nil), facts...) }
	factsMu.Unlock()
}

func getContentFromCache(url string) (string, bool) {
	contentMu.RLock()
	e, ok := contentCache[url]
	contentMu.RUnlock()
	if !ok { return "", false }
	if time.Since(e.at) > 6*time.Hour { return "", false }
	return e.content, true
}

func putContentInCache(url string, content string) {
	if len(content) == 0 { return }
	contentMu.Lock()
	contentCache[url] = contentEntry{ at: time.Now(), content: content }
	contentMu.Unlock()
}
