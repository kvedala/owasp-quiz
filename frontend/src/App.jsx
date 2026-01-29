
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
    <div style={{maxWidth: 980, margin: "0 auto", padding: 16}}>
      <header style={{marginBottom: 16, borderBottom: '2px solid #f0f0f0', paddingBottom: 16}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 20, marginBottom: 12}}>
          <img 
            src="https://pspservicesco.com/wp-content/uploads/2025/11/psplogo.jpg" 
            alt="PSP Services" 
            style={{height: 60, width: 'auto'}}
          />
          <div style={{flex: 1}}>
            <h2 style={{margin: 0}}>{title}</h2>
            <p style={{fontSize: 14, color: '#666', margin: '4px 0 0 0'}}>
              Powered by PSP Services Inc.
            </p>
          </div>
        </div>
        <p style={{fontSize: 12, color: '#888', margin: 0}}>
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
