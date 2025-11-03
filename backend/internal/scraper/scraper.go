
package scraper

import (
	"errors"
	"net/http"
	"strings"
	"time"

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
		title := strings.TrimSpace(s.Text())
		if !ok || title == "" {
			return
		}
		// We only want official cheat sheet pages.
		if strings.HasPrefix(href, "/cheatsheets/") && strings.HasSuffix(href, ".html") {
			out = append(out, CheatSheet{
				Title: title,
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
		text := strings.Join(strings.Fields(strings.TrimSpace(li.Text())), " ")
		if len(text) > 0 && len(text) < 260 { // skip ultra-long lines
			facts = append(facts, text)
		}
	})
	return facts, nil
}
