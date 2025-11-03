
import { useState } from "react";
import Home from "./pages/Home";
import Quiz from "./pages/Quiz";
import Results from "./pages/Results";

export default function App() {
  const [phase, setPhase] = useState("home");
  const [candidate, setCandidate] = useState("");
  const [userInfo, setUserInfo] = useState(null);
  const [quizPack, setQuizPack] = useState(null); // {quiz, allCategories, selectedCategories, categoryNames}
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  return (
    <div style={{maxWidth: 980, margin: "0 auto", padding: 16}}>
      <header style={{marginBottom: 16}}>
        <h2>OWASP Cheat Sheet Series – Q&A Portal</h2>
        <p style={{fontSize: 12}}>
          Uses official OWASP Cheat Sheets (CC BY‑SA 4.0). Source: <a href="https://cheatsheetseries.owasp.org" target="_blank">cheatsheetseries.owasp.org</a>
        </p>
      </header>

      {phase === "home" && (
        <Home
          candidate={candidate}
          setCandidate={setCandidate}
          onStart={({quizData, user}) => {
            setQuizPack(quizData);
            setUserInfo(user);
            setAnswers({});
            setPhase("quiz");
          }}
        />
      )}

      {phase === "quiz" && quizPack && (
        <Quiz
          candidate={candidate}
          quiz={quizPack.quiz}
          answers={answers}
          setAnswers={setAnswers}
          onDone={(res) => {
            setResult(res);
            setPhase("results");
          }}
          submitContext={{
            userInfo,
            allCategories: quizPack.allCategories,
            selectedCategories: quizPack.selectedCategories,
            categoryNames: quizPack.categoryNames
          }}
        />
      )}

      {phase === "results" && result && (
        <Results
          candidate={candidate}
          quiz={quizPack.quiz}
          result={result}
          categoryNames={result.categoryNames}
          allCats={result.allCategories}
          selectedCats={result.selectedCategories}
          onRestart={() => setPhase("home")}
        />
      )}
    </div>
  );
}
