
let questionBankCache = null;

// Load question bank from static asset
async function loadQuestionBank() {
  if (questionBankCache) return questionBankCache;
  
  const res = await fetch("./questions.json");
  if (!res.ok) throw new Error("Failed to load questions.json");
  const data = await res.json();
  questionBankCache = data;
  return data;
}

// Get unique categories from questions
export async function getCategories() {
  const bank = await loadQuestionBank();
  const categoryMap = {};
  
  bank.questions.forEach(q => {
    const topic = q.topic || "";
    const parts = topic.split(":");
    const catID = parts[0].trim();
    if (!categoryMap[catID]) {
      categoryMap[catID] = {
        id: catID,
        name: topic
      };
    }
  });
  
  return Object.values(categoryMap).sort((a, b) => a.id.localeCompare(b.id));
}

// Get metadata
export async function getMetadata() {
  const bank = await loadQuestionBank();
  return bank.meta || {
    title: "OWASP Top 10 Quiz",
    license: "CC BY-SA 4.0",
    source: "https://owasp.org"
  };
}

// Get topics/cheat sheets
export async function getTopics() {
  const bank = await loadQuestionBank();
  const sources = new Set();
  
  bank.questions.forEach(q => {
    if (q.source) sources.add(q.source);
  });
  
  return Array.from(sources).map((title, i) => ({
    title,
    url: `https://owasp.org/cheatsheets/${title.replace(/\s+/g, "_")}`
  }));
}

// Generate quiz locally
export async function generateQuiz({ categories = [], count = 20 } = {}) {
  const bank = await loadQuestionBank();
  
  // Filter questions by category
  let pool = bank.questions;
  if (categories.length > 0) {
    pool = pool.filter(q => {
      const topic = q.topic || "";
      const catID = topic.split(":")[0].trim();
      return categories.includes(catID);
    });
  }
  
  if (pool.length === 0) throw new Error("No questions found for selected categories");
  
  // Shuffle and take count
  const shuffled = shuffleArray([...pool]);
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));
  
  // Convert to quiz format
  const allCats = await getCategories();
  const categoryMap = {};
  allCats.forEach(c => categoryMap[c.id] = c.name);
  
  const questions = selected.map((q, i) => ({
    id: `q${i}`,
    stem: q.question,
    options: q.options,
    answerIndex: q.answer,
    source: q.source,
    url: q.source,
    category: q.topic,
    categoryId: q.topic.split(":")[0].trim(),
    explanation: q.explanation
  }));
  
  return {
    quiz: {
      id: generateId(),
      questions: questions
    },
    allCategories: allCats.map(c => c.id),
    selectedCategories: categories.length > 0 ? categories : allCats.map(c => c.id),
    categoryNames: categoryMap
  };
}

// Submit attempt and compute score locally
export async function submitAttempt(payload) {
  const { quizId, answers, questions, name, email, jobTitle, department, selectedCats, allCats, categoryMap } = payload;
  
  // Compute score
  let score = 0;
  const perCategory = {};
  
  (allCats || []).forEach(cat => {
    perCategory[cat] = { correct: 0, total: 0 };
  });
  
  questions.forEach((q, idx) => {
    const userAnswer = answers[q.id];
    const correct = userAnswer === q.answerIndex;
    if (correct) score++;
    
    const catId = q.categoryId;
    if (catId && perCategory[catId]) {
      perCategory[catId].total++;
      if (correct) perCategory[catId].correct++;
    }
  });
  
  const total = questions.length;
  const percentage = Math.round((score / total) * 100);
  const passed = percentage >= 75;
  
  return {
    attemptId: generateId(),
    score,
    total,
    percentage,
    passed,
    answers,
    perCategory,
    categoryNames: categoryMap,
    allCategories: allCats,
    selectedCategories: selectedCats,
    name,
    email,
    jobTitle,
    department,
    questions
  };
}

// Helper functions
function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

