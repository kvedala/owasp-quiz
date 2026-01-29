
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
      {quiz.questions.map((q, i) => {
        const cardClass = submitted
          ? (answers[q.id] === undefined ? "question-card question-card--unanswered" : "question-card question-card--answered")
          : "question-card";

        return (
        <div key={q.id} className={cardClass}>
          <div className="question-header">
            <div><strong>Q{i+1}.</strong> {q.stem}</div>
            <div className="question-meta">{q.category}</div>
          </div>
          <ol type="A">
            {q.options.map((opt, ix) => {
              const isSelected = answers[q.id] === ix;
              const optionClass = submitted && isSelected
                ? "question-option question-option--selected"
                : "question-option";
              const labelClass = submitted ? "option-label option-label--disabled" : "option-label";
              return (
                <li key={ix} className={optionClass}>
                  <label className={labelClass}>
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
            <div className="explanation-box">
              <strong className="explanation-title">Explanation:</strong>
              <p className="explanation-text">{q.explanation}</p>
            </div>
          )}
          <div className="source-row">
            <a href={q.url || q.source} target="_blank" rel="noreferrer">[source: {q.source}]</a>
          </div>
        </div>
        );
      })}
      {!submitted && (
        <div className="quiz-actions">
          <button disabled={submitting} onClick={finish}>Submit</button>
          <span>Progress: {answered}/{total}</span>
          <span className="quiz-pass">Passing: ≥ 75%</span>
        </div>
      )}
      {submitted && (
        <div className="quiz-redirect">
          Redirecting to results in 1 second...
        </div>
      )}
    </div>
  );
}
