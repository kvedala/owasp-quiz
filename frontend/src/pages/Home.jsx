import { useEffect, useState } from "react";
import { getCategories, generateQuiz } from "../api";

// Input sanitization function
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input.trim().substring(0, 200).replace(/[<>]/g, '');
}

// Less aggressive sanitizer for name field to allow typing spaces naturally.
// We avoid trimming trailing spaces during input so the user can insert a space
// between first and last name; final trim happens before submit.
function sanitizeNameInput(input) {
  if (typeof input !== 'string') return '';
  // Remove angle brackets only; preserve spaces as typed
  let cleaned = input.replace(/[<>]/g, '');
  // Limit length to 100 (matches backend name length constraint)
  if (cleaned.length > 100) cleaned = cleaned.substring(0, 100);
  return cleaned;
}

function validateEmail(email) {
  if (!email) return true; // optional
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return email.length <= 254 && emailRegex.test(email);
}

export default function Home({ candidate, setCandidate, onStart }) {
  // user info
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");

  const [categories, setCategories] = useState([]); // [{id,name}]
  const [selected, setSelected] = useState([]);     // ["A01", ...]
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => { 
    getCategories().then(cats => {
      setCategories(cats);
      // Set all as default selected
      setSelected(cats.map(c => c.id));
    }).catch(console.error); 
  }, []);

  function toggleCat(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  async function start() {
    setErrorMsg("");
    // Validate inputs
    const sanitizedName = sanitizeInput(candidate);
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedJobTitle = sanitizeInput(jobTitle);
    const sanitizedDepartment = sanitizeInput(department);
    if (!sanitizedName || sanitizedName.length < 2) {
      alert('Please enter a valid name (at least 2 characters)');
      return;
    }
    if (sanitizedEmail && !validateEmail(sanitizedEmail)) {
      alert('Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    try {
      // Generate quiz locally with selected categories
      const quizData = await generateQuiz({ 
        categories: selected.length > 0 ? selected : categories.map(c => c.id),
        count: 20
      });
      
      onStart({
        quizData,
        user: { name: sanitizedName, email: sanitizedEmail, jobTitle: sanitizedJobTitle, department: sanitizedDepartment }
      });
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to generate quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const allIds = categories.map(c => c.id);

  return (
    <div>
      {loading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="loading-spinner" />
            <div className="loading-text">Generating quiz…</div>
          </div>
        </div>
      )}
      <h3>Candidate Information</h3>
      <div className="form-grid">
        <div>
          <label>Name</label><br/>
          <input 
            type="text"
            name="name"
            autoComplete="name"
            value={candidate} 
            onChange={e=>setCandidate(sanitizeNameInput(e.target.value))} 
            placeholder="Full name" 
            maxLength="100"
            required
          />
        </div>
        <div>
          <label>Email</label><br/>
          <input 
            type="email"
            name="email"
            autoComplete="email"
            value={email} 
            onChange={e=>setEmail(sanitizeInput(e.target.value))} 
            placeholder="name@company.com" 
            maxLength="254"
          />
        </div>
        <div>
          <label>Job Title</label><br/>
          <input 
            type="text"
            name="jobTitle"
            autoComplete="organization-title"
            value={jobTitle} 
            onChange={e=>setJobTitle(sanitizeInput(e.target.value))} 
            placeholder="CTO" 
            maxLength="200"
          />
        </div>
        <div>
          <label>Department</label><br/>
          <input 
            type="text"
            name="department"
            autoComplete="organization"
            value={department} 
            onChange={e=>setDepartment(sanitizeInput(e.target.value))} 
            placeholder="Engineering" 
            maxLength="200"
          />
        </div>
      </div>

      <h3 className="section-title">Select Categories (OWASP Top 10)</h3>
      <p className="section-help">
        From OWASP Top‑10 mapping to official Cheat Sheets. Leave empty to include all categories.
      </p>
      <div className="category-grid">
        {categories.map(c => (
          <label key={c.id} className="category-item">
            <input type="checkbox" checked={selected.includes(c.id)} onChange={()=>toggleCat(c.id)} />{" "}
            <strong>{c.id}</strong> – {c.name}
          </label>
        ))}
      </div>

      <div className="form-actions">
        <button onClick={start}>Start Exam</button>
      </div>
      {errorMsg && (
        <div className="error-row">
          <span className="error-text">{errorMsg}</span>
          <button onClick={start}>Retry</button>
        </div>
      )}

      <details className="categories-details">
        <summary>Show all available categories</summary>
        <div className="categories-list">
          {allIds.join(", ")}
        </div>
      </details>
    </div>
  );
}
