
package scraper

import (
	"errors"
	"net/http"
	"regexp"
	"strings"

	"github.com/PuerkitoBio/goquery"
)

const top10URL = "https://cheatsheetseries.owasp.org/IndexTopTen.html"

type Category struct {
	ID          string      `json:"id"`   // e.g., "A01:2021"
	Name        string      `json:"name"` // e.g., "Broken Access Control"
	CheatSheets []CheatSheet `json:"cheatSheets"`
}

// FetchTop10Categories scrapes the Top 10 mapping page and returns categories.
func FetchTop10Categories(client *http.Client) ([]Category, error) {
	req, _ := http.NewRequest("GET", top10URL, nil)
	req.Header.Set("User-Agent", userAgent)
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, errors.New("failed to load Top 10 index")
	}
	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, err
	}

	// Headings look like: "A01:2021 – Broken Access Control"
	var cats []Category
	reID := regexp.MustCompile(`^A\d{2}:\d{4}`)
	doc.Find("h2, h3").Each(func(_ int, s *goquery.Selection) {
		txt := strings.TrimSpace(s.Text())
		if !reID.MatchString(txt) { return }
		id := reID.FindString(txt)
		name := strings.TrimSpace(strings.TrimPrefix(txt, id))
		name = strings.TrimLeft(name, "–- ")

		var list []CheatSheet
		// Next sibling lists hold the mapped cheat sheets with <a> links
		s.NextAll().Filter("ul").First().Find("a").Each(func(_ int, a *goquery.Selection) {
			href, ok := a.Attr("href")
			title := strings.TrimSpace(a.Text())
			if !ok || title == "" { return }
			if strings.HasPrefix(href, "/cheatsheets/") && strings.HasSuffix(href, ".html") {
				list = append(list, CheatSheet{Title: title, URL: baseURL + href})
			}
		})

		if len(list) > 0 {
			cats = append(cats, Category{ID: id, Name: name, CheatSheets: list})
		}
	})
	return cats, nil
}
