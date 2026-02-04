
import { useState } from "react";
import Home from "./pages/Home";
import Quiz from "./pages/Quiz";
import Results from "./pages/Results";
import { MetadataProvider } from "./context/MetadataContext";
import { useMetadata } from "./hooks/useMetadata";

function AppContent() {
  const { metadata } = useMetadata();
  const [phase, setPhase] = useState("home");
  const [candidate, setCandidate] = useState("");
  const [userInfo, setUserInfo] = useState(null);
  const [quizPack, setQuizPack] = useState(null); // {quiz, allCategories, selectedCategories, categoryNames}
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  // Extract metadata values or use safe defaults
  const title = metadata?.title || "OWASP Security Quiz";
  const license = metadata?.license || "CC BY-SA 4.0";
  const sources = metadata?.sources || {};
  const sourceUrl = sources.about || "https://cheatsheetseries.owasp.org";

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-header-row">
          <svg 
            className="app-logo"
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="50" cy="50" r="48" fill="#FFD700" stroke="#333" strokeWidth="2"/>
            <circle cx="35" cy="40" r="5" fill="#333"/>
            <circle cx="65" cy="40" r="5" fill="#333"/>
            <path d="M 30 60 Q 50 75 70 60" stroke="#333" strokeWidth="3" fill="none" strokeLinecap="round"/>
          </svg>
          <div className="app-header-content">
            <h2 className="app-title">{title}</h2>
            <p className="app-subtitle">
              Powered by OpenCompany
            </p>
          </div>
        </div>
        <p className="app-attribution">
          Uses official OWASP Cheat Sheets ({license}). Source: <a href={sourceUrl} target="_blank">cheatsheetseries.owasp.org</a>
        </p>
      </header>

      {phase === "home" && (
        <Home
          candidate={candidate}
          setCandidate={setCandidate}
          onStart={({quizData, user, llmMode}) => {
            setQuizPack({ ...quizData, llmMode: llmMode || "" });
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
            categoryNames: quizPack.categoryNames,
            llmMode: quizPack.llmMode || ""
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

export default function App() {
  return (
    <MetadataProvider>
      <AppContent />
    </MetadataProvider>
  );
}
