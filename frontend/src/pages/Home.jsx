
import { useEffect, useState } from "react";

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
    const qs = new URLSearchParams();
    if (count) qs.set("count", count);
    if (seed) qs.set("seed", seed);
    if (selected.length > 0) qs.set("categories", selected.join(","));
    const res = await fetch(`/api/generate-quiz?` + qs.toString());
    if (!res.ok) throw new Error("failed to generate quiz");
    const payload = await res.json();
    onStart({
      quizData: payload,
      user: {
        name: candidate?.trim() || "Candidate",
        email: email.trim(),
        jobTitle: jobTitle.trim(),
        department: department.trim(),
      }
    });
  }

  const allIds = categories.map(c => c.id);

  return (
    <div>
      <h3>Candidate Information</h3>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
        <div>
          <label>Name</label><br/>
          <input value={candidate} onChange={e=>setCandidate(e.target.value)} placeholder="Full name" />
        </div>
        <div>
          <label>Email</label><br/>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com" />
        </div>
        <div>
          <label>Job Title</label><br/>
          <input value={jobTitle} onChange={e=>setJobTitle(e.target.value)} placeholder="CTO" />
        </div>
        <div>
          <label>Department</label><br/>
          <input value={department} onChange={e=>setDepartment(e.target.value)} placeholder="Engineering" />
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
