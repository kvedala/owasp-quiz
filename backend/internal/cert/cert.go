
package cert

import (
	"fmt"
	"sort"
	"time"

	"github.com/go-pdf/fpdf"
)

type CategoryScore struct {
	Category string
	Score    int
	Total    int
}

type CertData struct {
	AttemptID    string
	Name         string
	Score        int
	Total        int
	Passed       bool
	Date         time.Time
	SelectedCats []string
	AllCats      []string
	PerCategory  []CategoryScore
}

func GeneratePDF(data CertData) ([]byte, error) {
	pdf := fpdf.New("L", "mm", "A4", "")
	pdf.AddPage()

	pdf.SetFont("Helvetica", "B", 28)
	pdf.CellFormat(0, 16, "Certificate of Achievement", "", 1, "C", false, 0, "")

	pdf.SetFont("Helvetica", "", 16)
	pdf.CellFormat(0, 10, "OWASP Cheat Sheet Series Knowledge Assessment", "", 1, "C", false, 0, "")

	pdf.Ln(6)
	pdf.SetFont("Helvetica", "B", 22)
	pdf.CellFormat(0, 12, data.Name, "", 1, "C", false, 0, "")

	status := "FAILED"
	if data.Passed { status = "PASSED" }
	pdf.SetFont("Helvetica", "", 14)
	pdf.CellFormat(0, 8,
		fmt.Sprintf("Result: %s | Score: %d/%d (%.0f%%) | Date: %s",
			status, data.Score, data.Total, pct(data.Score, data.Total), data.Date.Format("2006-01-02")),
		"", 1, "C", false, 0, "")

	pdf.Ln(4)
	pdf.SetFont("Helvetica", "B", 12)
	pdf.CellFormat(0, 8, "Category Breakdown", "", 1, "C", false, 0, "")

	// Table header
	pdf.SetFont("Helvetica", "B", 10)
	pdf.CellFormat(100, 7, "Category", "1", 0, "L", false, 0, "")
	pdf.CellFormat(30, 7, "Score", "1", 0, "C", false, 0, "")
	pdf.CellFormat(30, 7, "Total", "1", 0, "C", false, 0, "")
	pdf.CellFormat(30, 7, "Percent", "1", 1, "C", false, 0, "")

	pdf.SetFont("Helvetica", "", 10)
	sort.Slice(data.PerCategory, func(i, j int) bool { return data.PerCategory[i].Category < data.PerCategory[j].Category })
	for _, row := range data.PerCategory {
		pdf.CellFormat(100, 7, row.Category, "1", 0, "L", false, 0, "")
		pdf.CellFormat(30, 7, fmt.Sprintf("%d", row.Score), "1", 0, "C", false, 0, "")
		pdf.CellFormat(30, 7, fmt.Sprintf("%d", row.Total), "1", 0, "C", false, 0, "")
		pdf.CellFormat(30, 7, fmt.Sprintf("%.0f%%", pct(row.Score, row.Total)), "1", 1, "C", false, 0, "")
	}

	pdf.Ln(4)
	pdf.SetFont("Helvetica", "", 10)
	pdf.MultiCell(0, 6,
		"This quiz dynamically references the OWASP Cheat Sheet Series (https://cheatsheetseries.owasp.org), "+
			"licensed under Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0). "+
			"Content is © the Cheat Sheets Series Team.", "", "C", false)

	pdf.Ln(2)
	pdf.CellFormat(0, 6, "Attempt ID: "+data.AttemptID, "", 1, "C", false, 0, "")

	// Selected vs All
	pdf.Ln(2)
	pdf.SetFont("Helvetica", "B", 11)
	pdf.CellFormat(0, 7, "Selected Categories vs. All Available", "", 1, "C", false, 0, "")
	pdf.SetFont("Helvetica", "", 9)
	pdf.MultiCell(0, 5, "Selected: "+stringsJoin(data.SelectedCats, ", "), "", "C", false)
	pdf.MultiCell(0, 5, "Available: "+stringsJoin(data.AllCats, ", "), "", "C", false)

	return pdf.OutputBytes()
}

func pct(a, b int) float64 { if b == 0 { return 0 }; return float64(a) * 100 / float64(b) }

func stringsJoin(ss []string, sep string) string {
	if len(ss) == 0 { return "-" }
	out := ss[0]
	for i := 1; i < len(ss); i++ { out += sep + " " + ss[i] }
	return out
}
