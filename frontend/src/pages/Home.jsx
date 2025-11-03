
import { useEffect, useState } from "react";

// Input sanitization function
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input.trim().substring(0, 200).replace(/[<>]/g, '');
}

function validateEmail(email) {
  if (!email) return true; // optional
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return email.length <= 254 && emailRegex.test(email);
}

async function fetchCategories() {
  const res = await fetch(`/api/categories`);
  if (!res.ok) throw new Error("failed to load categories");
  return res.json();
}

export default function Home({ candidate, setCandidate, onStart }) {
  // user info
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");

  // categories
  const [categories, setCategories] = useState([]); // [{id,name,cheatSheets:[]}]
  const [selected, setSelected] = useState([]);     // ["A01:2021", ...]
  const [count, setCount] = useState(20);
  const [seed, setSeed] = useState("");

  useEffect(() => { fetchCategories().then(setCategories).catch(console.error); }, []);

  function toggleCat(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  async function start() {
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
    
    const qs = new URLSearchParams();
    if (count) qs.set("count", Math.min(Math.max(count, 5), 50)); // Clamp between 5-50
    if (seed) qs.set("seed", sanitizeInput(seed));
    if (selected.length > 0) qs.set("categories", selected.join(","));
    
    try {
      const res = await fetch(`/api/generate-quiz?` + qs.toString());
      if (!res.ok) throw new Error("failed to generate quiz");
      const payload = await res.json();
      onStart({
        quizData: payload,
        user: {
          name: sanitizedName,
          email: sanitizedEmail,
          jobTitle: sanitizedJobTitle,
          department: sanitizedDepartment,
        }
      });
    } catch (error) {
      alert('Failed to generate quiz. Please try again.');
    }
  }

  const allIds = categories.map(c => c.id);

  return (
    <div>
      <h3>Candidate Information</h3>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
        <div>
          <label>Name</label><br/>
          <input 
            value={candidate} 
            onChange={e=>setCandidate(sanitizeInput(e.target.value))} 
            placeholder="Full name" 
            maxLength="100"
            required
          />
        </div>
        <div>
          <label>Email</label><br/>
          <input 
            type="email"
            value={email} 
            onChange={e=>setEmail(sanitizeInput(e.target.value))} 
            placeholder="name@company.com" 
            maxLength="254"
          />
        </div>
        <div>
          <label>Job Title</label><br/>
          <input 
            value={jobTitle} 
            onChange={e=>setJobTitle(sanitizeInput(e.target.value))} 
            placeholder="CTO" 
            maxLength="200"
          />
        </div>
        <div>
          <label>Department</label><br/>
          <input 
            value={department} 
            onChange={e=>setDepartment(sanitizeInput(e.target.value))} 
            placeholder="Engineering" 
            maxLength="200"
          />
        </div>
      </div>

      <h3 style={{marginTop:16}}>Select Categories (OWASP Top 10)</h3>
      <p style={{fontSize:12, marginTop:-8}}>
        From OWASP Top‑10 mapping to official Cheat Sheets. Leave empty to include all categories.
      </p>
      <div style={{display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:6, marginBottom:12}}>
        {categories.map(c => (
          <label key={c.id} style={{border:"1px solid #ddd", padding:8, borderRadius:6}}>
            <input type="checkbox" checked={selected.includes(c.id)} onChange={()=>toggleCat(c.id)} />{" "}
            <strong>{c.id}</strong> – {c.name} <span style={{fontSize:12, color:"#666"}}>({c.cheatSheets.length} sheets)</span>
          </label>
        ))}
      </div>

      <div style={{display:"flex", gap:16, alignItems:"center"}}>
        <div>
          <label># Questions</label><br/>
          <input type="number" min={5} max={30} value={count} onChange={(e)=>setCount(parseInt(e.target.value || 20))} />
        </div>
        <div>
          <label>Seed (optional)</label><br/>
          <input value={seed} onChange={(e)=>setSeed(e.target.value)} />
        </div>
        <button style={{marginLeft:"auto"}} onClick={start}>Start Exam</button>
      </div>

      <details style={{marginTop:16}}>
        <summary>Show all available categories</summary>
        <div style={{fontSize:13, marginTop:6}}>
          {allIds.join(", ")}
        </div>
      </details>
    </div>
  );
}
