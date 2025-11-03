
import { useMemo, useState } from "react";

export default function Quiz({ candidate, quiz, answers, setAnswers, onDone, submitContext }) {
  const [submitting, setSubmitting] = useState(false);
  const total = quiz.questions.length;

  const score = useMemo(() => {
    let s = 0;
    quiz.questions.forEach(q => {
      const a = answers[q.id];
      if (a != null && a === q.answerIndex) s++;
    });
    return s;
  }, [answers, quiz]);

  async function finish() {
    setSubmitting(true);
    try {
      const payload = {
        name: submitContext.userInfo?.name || candidate || "Candidate",
        email: submitContext.userInfo?.email || "",
        jobTitle: submitContext.userInfo?.jobTitle || "",
        department: submitContext.userInfo?.department || "",
        quizId: quiz.id,
        answers,
        questions: quiz.questions,
        selectedCategories: submitContext.selectedCategories,
        allCategories: submitContext.allCategories,
        categoryNames: submitContext.categoryNames
      };
      const res = await fetch(`/api/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("submit failed");
      const data = await res.json();
      onDone({ ...data });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h3>Questions ({total})</h3>
      {quiz.questions.map((q, i) => (
        <div key={q.id} style={{border:"1px solid #ddd", padding:12, marginBottom:12}}>
          <div style={{display:"flex", justifyContent:"space-between"}}>
            <div><strong>Q{i+1}.</strong> {q.stem}</div>
            <div style={{fontSize:12, color:"#555"}}>{q.category}</div>
          </div>
          <ol type="A">
            {q.options.map((opt, ix) => (
              <li key={ix} style={{marginTop:6}}>
                <label>
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === ix}
                    onChange={()=> setAnswers({...answers, [q.id]: ix})}
                  />{" "}{opt}
                </label>
              </li>
            ))}
          </ol>
          <div style={{fontSize:12}}>
            <a href={q.url} target="_blank" rel="noreferrer">[source: {q.source}]</a>
          </div>
        </div>
      ))}
      <div style={{display:"flex", gap:16, alignItems:"center"}}>
        <button disabled={submitting} onClick={finish}>Submit</button>
        <span>Progress: {Object.keys(answers).length}/{total}  |  Current score (local): {score}</span>
        <span style={{marginLeft:"auto"}}>Passing: ≥ 75%</span>
      </div>
    </div>
  );
}
