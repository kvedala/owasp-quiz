import { jsPDF } from "jspdf";

/**
 * Generate a PDF certificate for quiz completion
 * @param {string} name - Candidate name
 * @param {number} score - Score achieved
 * @param {number} total - Total questions
 * @param {bool} passed - Whether passed (>= 75%)
 * @param {object} perCategory - Per-category scores {catId: {score, total}}
 * @param {object} categoryNames - Category name mapping {catId: name}
 * @param {object} extraDetails - Optional environment details
 * @returns {Blob} PDF blob that can be downloaded
 */
export function generateCertificatePDF(name, score, total, passed, perCategory, categoryNames, extraDetails = {}) {
  const pageWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  // Set colors
  const headerColor = passed ? [33, 150, 243] : [244, 67, 54]; // Blue if passed, red if not
  const textColor = [0, 0, 0];
  const lightGray = [100, 100, 100];

  // Title
  doc.setFillColor(...headerColor);
  doc.rect(0, 0, pageWidth, 50, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont(undefined, "bold");
  doc.text("OWASP Quiz Certificate", pageWidth / 2, 20, { align: "center" });
  
  doc.setFontSize(12);
  doc.setFont(undefined, "normal");
  const statusText = passed ? "✓ PASSED" : "✗ NOT PASSED";
  doc.text(statusText, pageWidth / 2, 35, { align: "center" });

  yPos = 60;

  // Candidate info
  doc.setTextColor(...textColor);
  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("Candidate Information", margin, yPos);
  yPos += 8;

  doc.setFont(undefined, "normal");
  doc.setFontSize(10);
  doc.text(`Name: ${name}`, margin, yPos);
  yPos += 6;
  doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, yPos);
  yPos += 10;

  const { localTime, utcTime, timeZone, userAgent, location } = extraDetails || {};
  const hasEnvDetails = localTime || utcTime || timeZone || userAgent || (location && (location.latitude || location.longitude));

  if (hasEnvDetails) {
    doc.setFont(undefined, "bold");
    doc.setFontSize(11);
    doc.text("Environment Details", margin, yPos);
    yPos += 7;

    doc.setFont(undefined, "normal");
    doc.setFontSize(9);

    if (localTime) {
      doc.text(`Local Time: ${localTime}`, margin, yPos);
      yPos += 5;
    }

    if (utcTime) {
      doc.text(`UTC Time: ${utcTime}`, margin, yPos);
      yPos += 5;
    }

    if (timeZone) {
      doc.text(`Timezone: ${timeZone}`, margin, yPos);
      yPos += 5;
    }

    if (userAgent) {
      const uaLines = doc.splitTextToSize(`Browser/Device: ${userAgent}`, contentWidth);
      doc.text(uaLines, margin, yPos);
      yPos += uaLines.length * 4 + 1;
    }

    if (location && (location.latitude || location.longitude)) {
      const accuracyText = location.accuracy ? ` (±${Math.round(location.accuracy)}m)` : "";
      doc.text(
        `Location: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}${accuracyText}`,
        margin,
        yPos
      );
      yPos += 6;
    }

    yPos += 4;
  }

  // Score summary
  doc.setFont(undefined, "bold");
  doc.setFontSize(12);
  doc.text("Score Summary", margin, yPos);
  yPos += 8;

  doc.setFont(undefined, "normal");
  doc.setFontSize(10);
  const percentage = Math.round((score / total) * 100);
  doc.text(`Total Score: ${score}/${total} (${percentage}%)`, margin, yPos);
  yPos += 6;
  doc.text(`Passing Threshold: ≥ 75%`, margin, yPos);
  yPos += 10;

  // Per-category breakdown
  if (perCategory && Object.keys(perCategory).length > 0) {
    doc.setFont(undefined, "bold");
    doc.setFontSize(11);
    doc.text("Category Breakdown", margin, yPos);
    yPos += 7;

    // Table headers
    const colX = [margin, margin + 40, margin + 80, margin + 120, margin + 160];
    const colWidths = [40, 40, 40, 40, 50];
    doc.setFont(undefined, "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(...headerColor);

    const headers = ["Category", "Score", "Total", "%", ""];
    headers.forEach((h, i) => {
      doc.rect(colX[i], yPos - 5, colWidths[i], 6, "F");
      doc.setTextColor(255, 255, 255);
      doc.text(h, colX[i] + 1, yPos - 1);
    });

    yPos += 2;
    doc.setTextColor(...textColor);
    doc.setFont(undefined, "normal");
    doc.setFontSize(8);

    // Table rows
    Object.entries(perCategory).forEach(([catId, scores]) => {
      const catName = categoryNames?.[catId] || catId;
      const catPercentage = scores.total ? Math.round((scores.correct / scores.total) * 100) : 0;
      
      doc.text(catId, colX[0] + 1, yPos);
      doc.text(String(scores.correct), colX[1] + 1, yPos);
      doc.text(String(scores.total), colX[2] + 1, yPos);
      doc.text(`${catPercentage}%`, colX[3] + 1, yPos);

      yPos += 5;
      if (yPos > pageHeight - margin - 10) {
        doc.addPage();
        yPos = margin;
      }
    });

    yPos += 5;
  }

  // Footer with attribution
  if (yPos > pageHeight - 30) {
    doc.addPage();
    yPos = margin;
  }

  doc.setTextColor(...lightGray);
  doc.setFontSize(9);
  doc.setFont(undefined, "italic");
  doc.text("This certificate is generated from the OWASP Top 10 Quiz.", margin, pageHeight - 15);
  doc.text("Content: CC BY-SA 4.0 | OWASP | https://owasp.org", margin, pageHeight - 10);

  return doc.output("blob");
}

/**
 * Trigger a download of the PDF certificate
 */
export function downloadCertificate(pdfBlob, fileName) {
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "OWASP_Quiz_Certificate.pdf";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
