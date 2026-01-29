
import { useState } from "react";
import { useMetadata } from "../hooks/useMetadata";
import { generateCertificatePDF, downloadCertificate } from "../utils/pdfGenerator";

// Sanitize text to prevent XSS
function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[<>&"']/g, (match) => {
    const entities = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&#x27;'
    };
    return entities[match];
  });
}

export default function Results({ candidate, quiz, result, categoryNames, allCats, selectedCats, onRestart }) {
  const { metadata } = useMetadata();
  const pass = result.passed;
  const passingThreshold = 75; // Standard threshold; could be made configurable via metadata
  const [locationConsent, setLocationConsent] = useState(false);
  const [downloadingCert, setDownloadingCert] = useState(false);

  // Build a lookup for answers
  const answerMap = {};
  if (quiz && quiz.questions) {
    for (const q of quiz.questions) {
      answerMap[q.id] = q.options[q.answerIndex];
    }
  }

  async function getLocationDetails() {
    if (!locationConsent || !navigator.geolocation) return null;

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          });
        },
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
      );
    });
  }

  async function handleDownloadCertificate() {
    setDownloadingCert(true);
    try {
      const now = new Date();
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const userAgent = navigator.userAgent;
      const location = await getLocationDetails();

      const pdfBlob = generateCertificatePDF(
        candidate,
        result.score,
        result.total,
        result.passed,
        result.perCategory,
        categoryNames,
        {
          localTime: now.toLocaleString(),
          utcTime: now.toUTCString(),
          timeZone,
          userAgent,
          location
        }
      );
      const fileName = `OWASP_Quiz_${candidate.replace(/\s+/g, "_")}_${new Date().toISOString().split('T')[0]}.pdf`;
      downloadCertificate(pdfBlob, fileName);
    } finally {
      setDownloadingCert(false);
    }
  }

  return (
    <div>
      <h3>Results</h3>
      <p>
        {pass ? "✅ Passed" : "❌ Not Passed"} — Score: <b>{result.score}/{result.total}</b>
        {" "}({Math.round(result.score*100/result.total)}%). Threshold: <b>≥ {passingThreshold}%</b>.
      </p>

      <h4>Categories</h4>
      <p className="results-meta">
        <b>Available:</b> {allCats?.join(", ") || "-"}<br/>
        <b>Selected:</b> {selectedCats?.join(", ") || "(all)"}
      </p>

      <h4>Category Scorecard</h4>
      <table border="1" cellPadding="6" className="score-table">
        <thead>
          <tr><th>Category</th><th>Name</th><th>Score</th><th>Total</th><th>%</th></tr>
        </thead>
        <tbody>
          {Object.entries(result.perCategory).map(([id, obj]) => {
            const name = categoryNames?.[id] || id;
            const pct = obj.total ? Math.round(obj.score*100/obj.total) : 0;
            return (
              <tr key={id}>
                <td>{id}</td>
                <td>{name}</td>
                <td className="score-center">{obj.score}</td>
                <td className="score-center">{obj.total}</td>
                <td className="score-center">{pct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h4>Review Incorrect Answers</h4>
      <ul className="review-list">
        {quiz?.questions?.map((q, idx) => {
          const userAns = result.answers?.[q.id];
          if (userAns == null || userAns === q.answerIndex) return null;
          return (
            <li key={q.id} className="review-item">
              <b>Q{idx+1}:</b> <span>{sanitizeText(q.stem)}</span><br/>
              <span className="review-incorrect">Your answer:</span> <span>{sanitizeText(q.options[userAns])}</span><br/>
              <span className="review-correct">Correct answer:</span> <span>{sanitizeText(q.options[q.answerIndex])}</span>
            </li>
          );
        })}
        {quiz?.questions?.filter(q => result.answers?.[q.id] != null && result.answers[q.id] !== q.answerIndex).length === 0 && (
          <li>All answers correct!</li>
        )}
      </ul>

      <div className="location-consent-box">
        <label className="location-consent-label">
          <input
            type="checkbox"
            checked={locationConsent}
            onChange={(e) => setLocationConsent(e.target.checked)}
          />
          <span>
            Include approximate location in certificate (requires permission)
          </span>
        </label>
      </div>

      <div className="results-actions">
        <button onClick={handleDownloadCertificate} disabled={downloadingCert}>
          {downloadingCert ? 'Generating...' : 'Download Certificate (PDF)'}
        </button>
        <button onClick={onRestart}>Take another exam</button>
      </div>
    </div>
  );
}
