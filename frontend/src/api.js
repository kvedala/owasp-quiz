
const API = import.meta.env.VITE_API_BASE || ""; // relative by default, so /api works via Ingress

export async function getTopics() {
  const res = await fetch(`${API}/api/topics`);
  return res.json();
}

export async function generateQuiz({ count = 20, topic = "", seed = "" } = {}) {
  const url = new URL(`${API}/api/generate-quiz`, window.location.origin);
  if (count) url.searchParams.set("count", count);
  if (topic) url.searchParams.set("topic", topic);
  if (seed)  url.searchParams.set("seed", seed);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("failed to generate quiz");
  return res.json();
}

export async function submitAttempt(payload) {
  const res = await fetch(`${API}/api/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json"},
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("submit failed");
  return res.json();
}

export function certificateURL(attemptId, name) {
  const url = new URL(`${API}/api/certificate`, window.location.origin);
  url.searchParams.set("attempt_id", attemptId);
  if (name) url.searchParams.set("name", name);
  return url.toString();
}
