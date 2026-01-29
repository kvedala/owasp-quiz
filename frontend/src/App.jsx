
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
          <img 
            src="https://pspservicesco.com/wp-content/uploads/2025/11/psplogo.jpg" 
            alt="PSP Services" 
            className="app-logo"
          />
          <div className="app-header-content">
            <h2 className="app-title">{title}</h2>
            <p className="app-subtitle">
              Powered by PSP Services Inc.
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
