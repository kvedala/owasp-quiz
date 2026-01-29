
import { useMemo, useState } from "react";
import { submitAttempt } from "../api";

export default function Quiz({ candidate, quiz, answers, setAnswers, onDone, submitContext }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const total = quiz.questions.length;

  async function finish() {
    setSubmitting(true);
    try {
      const result = await submitAttempt({
        quizId: quiz.id,
        name: submitContext.userInfo?.name || candidate || "Candidate",
        email: submitContext.userInfo?.email || "",
        jobTitle: submitContext.userInfo?.jobTitle || "",
        department: submitContext.userInfo?.department || "",
        answers,
        questions: quiz.questions,
        selectedCats: submitContext.selectedCategories,
        allCats: submitContext.allCategories,
        categoryMap: submitContext.categoryNames
      });
      
      setSubmitted(true);
      setTimeout(() => onDone(result), 1000);
    } finally {
      setSubmitting(false);
    }
  }

  const answered = Object.keys(answers).length;

  return (
    <div>
      <h3>Questions ({total})</h3>
      {quiz.questions.map((q, i) => (
        <div key={q.id} style={{border:"1px solid #ddd", padding:12, marginBottom:12, background: submitted ? (answers[q.id] === undefined ? "#f5f5f5" : "#f0f0f0") : "white"}}>
          <div style={{display:"flex", justifyContent:"space-between"}}>
            <div><strong>Q{i+1}.</strong> {q.stem}</div>
            <div style={{fontSize:12, color:"#555"}}>{q.category}</div>
          </div>
          <ol type="A">
            {q.options.map((opt, ix) => {
              const isSelected = answers[q.id] === ix;
              const selectedStyle = submitted && isSelected ? {background: "#e8f4f8", border: "1px solid #0288d1"} : {};
              return (
                <li key={ix} style={{marginTop:6, ...selectedStyle}}>
                  <label style={{cursor: submitted ? "default" : "pointer"}}>
                    <input
                      type="radio"
                      name={q.id}
                      checked={isSelected}
                      onChange={()=> !submitted && setAnswers({...answers, [q.id]: ix})}
                      disabled={submitted}
                    />{" "}{opt}
                  </label>
                </li>
              );
            })}
          </ol>
          {submitted && q.explanation && (
            <div style={{marginTop:12, padding:10, background:"#f9f9f9", border:"1px solid #e0e0e0", borderRadius:4, fontSize:13}}>
              <strong style={{color:"#1976d2"}}>Explanation:</strong>
              <p style={{margin:"6px 0 0 0", lineHeight:1.5}}>{q.explanation}</p>
            </div>
          )}
          <div style={{fontSize:12, marginTop: 8}}>
            <a href={q.url || q.source} target="_blank" rel="noreferrer">[source: {q.source}]</a>
          </div>
        </div>
      ))}
      {!submitted && (
        <div style={{display:"flex", gap:16, alignItems:"center"}}>
          <button disabled={submitting} onClick={finish}>Submit</button>
          <span>Progress: {answered}/{total}</span>
          <span style={{marginLeft:"auto"}}>Passing: ≥ 75%</span>
        </div>
      )}
      {submitted && (
        <div style={{textAlign:"center", color:"#666", fontSize:14}}>
          Redirecting to results in 1 second...
        </div>
      )}
    </div>
  );
}
