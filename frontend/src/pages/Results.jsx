
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

  // Build a lookup for answers
  const answerMap = {};
  if (quiz && quiz.questions) {
    for (const q of quiz.questions) {
      answerMap[q.id] = q.options[q.answerIndex];
    }
  }

  function handleDownloadCertificate() {
    const pdfBlob = generateCertificatePDF(
      candidate,
      result.score,
      result.total,
      result.passed,
      result.perCategory,
      categoryNames
    );
    const fileName = `OWASP_Quiz_${candidate.replace(/\s+/g, "_")}_${new Date().toISOString().split('T')[0]}.pdf`;
    downloadCertificate(pdfBlob, fileName);
  }

  return (
    <div>
      <h3>Results</h3>
      <p>
        {pass ? "✅ Passed" : "❌ Not Passed"} — Score: <b>{result.score}/{result.total}</b>
        {" "}({Math.round(result.score*100/result.total)}%). Threshold: <b>≥ {passingThreshold}%</b>.
      </p>

      <h4>Categories</h4>
      <p style={{fontSize:13}}>
        <b>Available:</b> {allCats?.join(", ") || "-"}<br/>
        <b>Selected:</b> {selectedCats?.join(", ") || "(all)"}
      </p>

      <h4>Category Scorecard</h4>
      <table border="1" cellPadding="6" style={{borderCollapse:"collapse"}}>
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
                <td style={{textAlign:"center"}}>{obj.score}</td>
                <td style={{textAlign:"center"}}>{obj.total}</td>
                <td style={{textAlign:"center"}}>{pct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h4>Review Incorrect Answers</h4>
      <ul style={{marginTop:8, fontSize:15}}>
        {quiz?.questions?.map((q, idx) => {
          const userAns = result.answers?.[q.id];
          if (userAns == null || userAns === q.answerIndex) return null;
          return (
            <li key={q.id} style={{marginBottom:10}}>
              <b>Q{idx+1}:</b> <span>{sanitizeText(q.stem)}</span><br/>
              <span style={{color:'#c00'}}>Your answer:</span> <span>{sanitizeText(q.options[userAns])}</span><br/>
              <span style={{color:'#080'}}>Correct answer:</span> <span>{sanitizeText(q.options[q.answerIndex])}</span>
            </li>
          );
        })}
        {quiz?.questions?.filter(q => result.answers?.[q.id] != null && result.answers[q.id] !== q.answerIndex).length === 0 && (
          <li>All answers correct!</li>
        )}
      </ul>

      <div style={{display:"flex", gap:12, marginTop:12}}>
        <button onClick={handleDownloadCertificate}>
          Download Certificate (PDF)
        </button>
        <button onClick={onRestart}>Take another exam</button>
      </div>
    </div>
  );
}
