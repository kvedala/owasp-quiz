
import { certificateURL } from "../api";

export default function Results({ candidate, quiz, result, categoryNames, allCats, selectedCats, onRestart }) {
  const pass = result.passed;

  return (
    <div>
      <h3>Results</h3>
      <p>
        {pass ? "✅ Passed" : "❌ Not Passed"} — Score: <b>{result.score}/{result.total}</b>
        {" "}({Math.round(result.score*100/result.total)}%). Threshold: <b>≥ 75%</b>.
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

      <div style={{display:"flex", gap:12, marginTop:12}}>
        <a className="btn" href={certificateURL(result.attemptId, candidate)} target="_blank" rel="noreferrer">
          Download Certificate (PDF)
        </a>
        <button onClick={onRestart}>Take another exam</button>
      </div>
    </div>
  );
}
