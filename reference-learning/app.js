const state = {
  modules: [],
  active: null,
  done: new Set(JSON.parse(localStorage.getItem("referenceLearningDone") || "[]")),
};

const el = (id) => document.getElementById(id);
const API_BASE = (
  window.REFERENCE_LEARNING_API_BASE ||
  (["localhost", "127.0.0.1"].includes(window.location.hostname) ? "./api" : "http://127.0.0.1:8765/api")
).replace(/\/$/, "");

function api(path, options = {}) {
  const headers = options.body ? { "Content-Type": "application/json", ...(options.headers || {}) } : options.headers || {};
  return fetch(`${API_BASE}/${path}`, {
    ...options,
    headers,
  }).then((res) => {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  });
}

function saveDone() {
  localStorage.setItem("referenceLearningDone", JSON.stringify([...state.done]));
}

function renderModules() {
  const list = el("moduleList");
  list.innerHTML = "";
  state.modules.forEach((mod) => {
    const btn = document.createElement("button");
    btn.className = "module-btn";
    if (state.active && state.active.id === mod.id) btn.classList.add("active");
    if (state.done.has(mod.id)) btn.classList.add("done");
    btn.innerHTML = `
      <span class="module-stage">${mod.stage}</span>
      <span>
        <span class="module-name">${mod.title}</span>
      </span>
      <span class="module-summary">${mod.summary}</span>
    `;
    btn.addEventListener("click", () => selectModule(mod.id));
    list.appendChild(btn);
  });
}

function selectModule(id) {
  state.active = state.modules.find((item) => item.id === id) || state.modules[0];
  el("activeTitle").textContent = state.active.title;
  el("activeSummary").textContent = state.active.summary;
  el("projectText").textContent = state.active.project;
  el("outcomeList").innerHTML = state.active.outcomes.map((item) => `<li>${item}</li>`).join("");
  el("searchInput").value = state.active.queries.join(" ");
  renderModules();
}

function renderResults(results) {
  const box = el("searchResults");
  if (!results.length) {
    box.innerHTML = `<div class="result-item"><strong>没有结果</strong><p>换一个关键词，或先运行索引构建脚本。</p></div>`;
    return;
  }
  box.innerHTML = results
    .map(
      (item, idx) => `
      <div class="result-item">
        <strong>${idx + 1}. ${item.title}</strong>
        <code>${item.path}</code>
        <p>${item.excerpt}</p>
      </div>
    `
    )
    .join("");
}

async function runSearch() {
  const q = el("searchInput").value.trim();
  if (!q) return;
  el("searchResults").innerHTML = `<div class="result-item"><strong>检索中</strong><p>正在查询本地 SQLite FTS 数据库。</p></div>`;
  const module = state.active ? `&module=${encodeURIComponent(state.active.id)}` : "";
  const data = await api(`search?q=${encodeURIComponent(q)}&limit=8${module}`);
  renderResults(data.results || []);
}

async function ask() {
  const question = el("questionInput").value.trim();
  if (!question) return;
  el("answerBox").textContent = "正在检索本地数据库并调用本地模型...";
  const body = {
    question,
    module_id: state.active ? state.active.id : null,
    top_k: 8,
  };
  const data = await api("ask", { method: "POST", body: JSON.stringify(body) });
  const sources = (data.sources || [])
    .map((item, idx) => `[${idx + 1}] ${item.path}`)
    .join("\n");
  el("answerBox").textContent = `${data.answer}\n\n来源：\n${sources || "无"}`;
}

async function load() {
  try {
    const [course, stats, model] = await Promise.all([api("course"), api("stats"), api("model/status")]);
    state.modules = course.modules || [];
    el("statDocs").textContent = stats.documents ?? "-";
    el("statChunks").textContent = stats.chunks ?? "-";
    el("statModules").textContent = stats.modules ?? state.modules.length;
    el("dbStatus").textContent = stats.ready ? `DB: ${stats.documents} docs` : "DB: not built";
    el("modelStatus").textContent = model.available ? `Model: ${model.models.length} local` : "Model: Ollama offline";
    renderModules();
    if (state.modules.length) selectModule(state.modules[0].id);
  } catch (err) {
    el("dbStatus").textContent = "DB: error";
    el("modelStatus").textContent = "Model: unknown";
    el("answerBox").textContent = String(err);
  }
}

el("searchBtn").addEventListener("click", runSearch);
el("askBtn").addEventListener("click", ask);
el("markDone").addEventListener("click", () => {
  if (!state.active) return;
  if (state.done.has(state.active.id)) state.done.delete(state.active.id);
  else state.done.add(state.active.id);
  saveDone();
  renderModules();
});
el("searchInput").addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") runSearch();
});
el("questionInput").addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") ask();
});

load();
