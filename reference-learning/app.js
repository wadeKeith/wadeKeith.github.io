const APP_VERSION = "20260617reader";
const PUBLIC_API_BASE = "http://47.111.133.184:61135/api";
const SITE_HOSTS = ["yincheng429.cn", "www.yincheng429.cn"];

if (window.location.protocol === "https:" && SITE_HOSTS.includes(window.location.hostname)) {
  window.location.replace(`http://${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}`);
  throw new Error("Redirecting to HTTP so the public teaching API can be reached.");
}

function apiCandidates() {
  const override = window.LLM_ROAD_API_BASE;
  const host = window.location.hostname;
  if (override) return [override.replace(/\/$/, "")];
  if (["localhost", "127.0.0.1"].includes(host)) return ["./api", PUBLIC_API_BASE];
  if (SITE_HOSTS.includes(host)) return [PUBLIC_API_BASE];
  return [`${window.location.origin}/api`, PUBLIC_API_BASE];
}

const API_CANDIDATES = apiCandidates().map((base) => base.replace(/\/$/, ""));
let activeApiBase = API_CANDIDATES[0];

const FALLBACK_MODULES = [
  {
    id: "orientation",
    stage: "00",
    title: "导学与学习系统",
    summary: "先把本地资料库当成研究实验室：理解目录、数据库和检索式学习方法。",
    outcomes: ["知道本地知识库的主要目录和各自承担的学习角色。", "能主动使用检索、来源引用、模块进度和学习笔记。", "区分中文实战材料、论文材料和前沿公开课程材料。"],
    queries: ["知识库目录地图", "Frontier AI PhD Curriculum", "学习路径", "LLM 综述"],
    project: "画出你每周会使用的个人大模型学习资料地图。",
  },
  {
    id: "math_pytorch_nlp",
    stage: "01",
    title: "数学、PyTorch、NLP 与深度学习基础",
    summary: "补齐实现和调试 Transformer 所需的张量、优化、NLP 与训练循环基础。",
    outcomes: ["复习张量形状、自动微分、优化器和训练循环。", "理解分词、Embedding、语言建模和 NLP 数据集。", "能阅读 notebook 与代码，而不是把它们当黑盒。"],
    queries: ["PyTorch", "自然语言处理", "Word2Vec", "Embedding", "深度学习基础"],
    project: "复现一个极小文本分类器或语言模型训练循环。",
  },
  {
    id: "transformer_gpt_llama",
    stage: "02",
    title: "从零实现 Transformer、GPT 与 LLaMA",
    summary: "从注意力机制推到 decoder-only 大模型实现，建立可调试的底层理解。",
    outcomes: ["推导 scaled dot-product attention、mask、MHA、MLP、残差和归一化。", "实现 GPT 风格训练与采样。", "理解 RoPE、RMSNorm、SwiGLU、GQA 等 LLaMA 设计选择。"],
    queries: ["Transformer", "GPT", "LLaMA", "RoPE", "RMSNorm", "Grouped Query Attention"],
    project: "实现一个最小 decoder-only Transformer，并和 nanoGPT 或 CS336 基础实现对照。",
  },
  {
    id: "llm_training_scaling_data",
    stage: "03",
    title: "大模型预训练、数据、Scaling 与 DeepSeek 架构",
    summary: "系统学习现代预训练决策、数据流水线、Scaling Law 与 MoE/MLA 等架构设计。",
    outcomes: ["解释 Scaling Law 与数据质量/规模之间的权衡。", "理解去重、过滤、课程式数据配比和数据混合。", "学习 MoE、MLA、YaRN、负载均衡和 multi-token prediction。"],
    queries: ["scaling laws", "CS336 scaling", "CS336 data", "DeepSeek-V3", "Mixture-of-Experts", "Multi Latent Attention"],
    project: "设计一个小型预训练实验计划：数据、模型规模、训练预算和评测节点。",
  },
  {
    id: "sft_peft_lora",
    stage: "04",
    title: "SFT、PEFT、LoRA、QLoRA 与指令微调",
    summary: "学习把预训练模型变成可用助手的核心后训练与参数高效微调方法。",
    outcomes: ["理解 SFT 数据格式、loss mask 和监督微调流程。", "比较全量微调、LoRA、QLoRA、Adapter 和 prompt tuning。", "判断何时适合使用量化与 PEFT。"],
    queries: ["LoRA", "QLoRA", "PEFT", "SFT", "Adapter", "Prompting"],
    project: "准备一个小型指令微调数据集，并写出 SFT/LoRA 实验方案。",
  },
  {
    id: "inference_systems",
    stage: "05",
    title: "推理、服务化、加速与分布式系统",
    summary: "把模型内部机制连接到真实延迟、吞吐、显存和服务约束。",
    outcomes: ["解释 KV cache、batching、prefill/decode、chunk prefill 和 speculative decoding。", "理解 FlashAttention、vLLM、张量并行和分布式训练基础。", "能阅读 profiling 结果并定位系统瓶颈。"],
    queries: ["Inference", "FlashAttention", "vLLM", "KV cache", "speculative decoding", "Tensor Parallelism"],
    project: "写一份 7B 模型部署说明：延迟、吞吐、显存预算与优化策略。",
  },
  {
    id: "alignment_rlhf_eval",
    stage: "06",
    title: "RLHF、DPO、奖励模型、评测与安全",
    summary: "学习偏好学习、后训练、评测体系和安全检查如何共同塑造可用模型。",
    outcomes: ["理解 reward modeling、PPO、DPO、GRPO 和 Constitutional AI。", "使用 benchmark harness 和简单本地评测。", "区分能力评测、安全评测和回归测试。"],
    queries: ["RLHF", "PPO", "DPO", "reward model", "OpenAI Evals", "HELM"],
    project: "为“大模型学习之路”导师定义一套本地评测题和回归测试。",
  },
  {
    id: "rag_agents",
    stage: "07",
    title: "RAG、Agent、工具调用、MCP 与生产应用",
    summary: "把模型放进真实应用：检索、工具、记忆、规划、接口和失败恢复。",
    outcomes: ["理解 RAG 的 chunking、embedding、rerank、引用和验证。", "学习 tool calling、agent loop、memory 和 planner/executor。", "能设计一个可观测、可回滚的 AI 应用。"],
    queries: ["RAG", "Agents", "Tool calling", "MCP", "LangChain", "LlamaIndex"],
    project: "构建一个带检索、工具调用和评测日志的小型课程问答助手。",
  },
  {
    id: "vlm_multimodal",
    stage: "08",
    title: "VLM、多模态理解与视觉语言模型",
    summary: "理解图像编码器、视觉 token、跨模态对齐和多模态指令数据。",
    outcomes: ["解释 CLIP、ViT、vision projector 和 image token。", "理解 LLaVA、Qwen-VL 等 VLM 训练流程。", "能评估多模态模型的 grounding、OCR 和视觉推理能力。"],
    queries: ["CLIP", "ViT", "LLaVA", "Qwen-VL", "multimodal instruction"],
    project: "设计一个图片问答评测集，并分析模型在哪类视觉证据上失败。",
  },
  {
    id: "streaming_video_vlm",
    stage: "09",
    title: "视频理解、流式 VLM 与长上下文多模态",
    summary: "学习视频 token、时序建模、流式输入和长上下文视觉推理。",
    outcomes: ["理解视频帧采样、temporal pooling 和 streaming memory。", "比较 Video-LLaVA、LongVA、Gemini/Claude 类长视频能力。", "能设计视频问答的延迟与准确率权衡。"],
    queries: ["Video-LLaVA", "streaming VLM", "long context video", "temporal reasoning"],
    project: "为一段教学视频设计章节定位、摘要和问答评测流程。",
  },
  {
    id: "vla_robotics",
    stage: "10",
    title: "VLA、机器人策略与具身智能",
    summary: "把视觉语言模型连接到动作空间、机器人策略和真实世界反馈。",
    outcomes: ["理解 VLA 模型如何从图像、语言和状态生成动作。", "学习 RT-2、OpenVLA、Octo 等路线。", "能区分 imitation、RL、offline data 和 simulator transfer。"],
    queries: ["VLA", "OpenVLA", "RT-2", "robot policy", "imitation learning"],
    project: "写一个桌面机器人任务的状态、动作、数据和评测设计。",
  },
  {
    id: "robot_sim_data",
    stage: "11",
    title: "机器人仿真、数据集与评测基准",
    summary: "学习 ManiSkill、RoboCasa、DROID、BridgeData 等数据和仿真系统如何支撑具身智能。",
    outcomes: ["理解仿真器、任务分布、数据采集和 sim2real。", "比较机器人数据集的动作空间、传感器和任务覆盖。", "能设计可复现的机器人评测协议。"],
    queries: ["ManiSkill", "RoboCasa", "DROID", "BridgeData", "sim2real"],
    project: "为一个机器人任务设计数据采集表、仿真评测和失败样例记录。",
  },
  {
    id: "world_models",
    stage: "12",
    title: "世界模型、规划与长期记忆",
    summary: "学习模型如何压缩环境动力学、预测未来、支持规划和长期任务。",
    outcomes: ["理解 latent dynamics、model-based RL 和 planning。", "比较 Dreamer、MuZero、Genie 等世界模型思想。", "能说明世界模型如何连接具身智能和视频生成。"],
    queries: ["world models", "Dreamer", "MuZero", "Genie", "planning"],
    project: "画出一个简单环境的世界模型训练与规划闭环。",
  },
  {
    id: "driving_world_models",
    stage: "13",
    title: "自动驾驶世界模型与生成式仿真",
    summary: "从驾驶场景理解世界模型、闭环仿真、轨迹预测和安全评测。",
    outcomes: ["理解 driving scene token、occupancy、trajectory 和 closed-loop eval。", "学习 GAIA、DriveDreamer、UniAD 等路线。", "能定义驾驶世界模型的安全失败样例。"],
    queries: ["driving world model", "DriveDreamer", "UniAD", "closed-loop evaluation"],
    project: "设计一个十字路口场景的生成式仿真与安全指标。",
  },
  {
    id: "diffusion_video_3d",
    stage: "14",
    title: "Diffusion、视频生成、3D 与空间智能",
    summary: "学习扩散模型、视频生成、3D 表示和空间推理怎样进入多模态智能。",
    outcomes: ["理解 diffusion、DiT、latent video 和 consistency。", "学习 3D Gaussian、NeRF、scene representation。", "能评估生成模型的时序一致性和空间可控性。"],
    queries: ["Diffusion", "DiT", "video generation", "NeRF", "3D Gaussian"],
    project: "为一个视频生成模型设计时序一致性和空间关系评测。",
  },
  {
    id: "omni_audio_capstone",
    stage: "15",
    title: "Omni、多模态实时交互与毕业项目",
    summary: "综合语音、视觉、文本、工具和具身任务，形成自己的端到端 AI 系统方案。",
    outcomes: ["理解实时音视频模型、turn-taking、latency 和工具协同。", "整合 RAG、VLM、agent 和评测。", "完成一个可演示、可评测、可复盘的毕业项目。"],
    queries: ["omni model", "audio language model", "real-time multimodal", "capstone"],
    project: "提交一个完整 AI 系统方案：任务、数据、模型、接口、评测和风险控制。",
  },
];

const state = {
  modules: FALLBACK_MODULES,
  activeId: localStorage.getItem("llmRoadActiveModule") || "orientation",
  activeTab: localStorage.getItem("llmRoadReaderTab") || "lesson",
  done: new Set(JSON.parse(localStorage.getItem("llmRoadDone") || "[]")),
  notes: JSON.parse(localStorage.getItem("llmRoadNotes") || "{}"),
};

const el = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  const number = Number(value || 0);
  if (number >= 10000) return `${Math.round(number / 10000)}万`;
  return String(number);
}

async function api(path, options = {}) {
  const bases = [activeApiBase, ...API_CANDIDATES.filter((base) => base !== activeApiBase)];
  let lastError;
  for (const base of bases) {
    try {
      const response = await fetch(`${base}/${path.replace(/^\//, "")}`, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      activeApiBase = base;
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("API unavailable");
}

function activeModule() {
  return state.modules.find((item) => item.id === state.activeId) || state.modules[0] || FALLBACK_MODULES[0];
}

function moduleIndex() {
  return Math.max(0, state.modules.findIndex((item) => item.id === activeModule().id));
}

function saveProgress() {
  localStorage.setItem("llmRoadDone", JSON.stringify([...state.done]));
}

function saveNotes() {
  localStorage.setItem("llmRoadNotes", JSON.stringify(state.notes));
}

function learningRoute(module) {
  const firstConcept = module.queries?.[0] || module.title;
  return [
    ["抓问题", `先用一句话回答：这一章为什么存在？本章要解决的是“${module.summary}”这件事。`],
    ["懂概念", `把 ${module.queries.slice(0, 4).join("、")} 逐个讲成“是什么、为什么、怎么验证”。`],
    ["读证据", "先读课程总览和核心材料，再读论文、代码或公开课细节；不要从资料堆里随机跳。"],
    ["做作品", `完成一个能被检查的产出：${module.project}`],
    ["问导师", `当你卡在 ${firstConcept} 或实践任务上，再把具体卡点交给导师，而不是让导师替你浏览。`],
  ];
}

function conceptCards(module) {
  return (module.queries || []).slice(0, 6).map((concept, idx) => {
    const checks = module.outcomes || [];
    return {
      title: concept,
      body: checks[idx % Math.max(checks.length, 1)] || module.summary,
      ask: `我不懂 ${concept}，请结合「${module.title}」和本地资料解释机制、例子和常见误区。`,
    };
  });
}

function quizItems(module) {
  const concept = module.queries?.[0] || module.title;
  const second = module.queries?.[1] || "本章核心机制";
  return [
    {
      question: `如果只能带走一个判断，你如何解释「${module.title}」？`,
      answer: `合格回答要回到本章摘要：${module.summary} 不能只背术语，要说明它解决什么学习或工程问题。`,
    },
    {
      question: `为什么 ${concept} 不能只靠看定义掌握？`,
      answer: `因为本课程要求把概念放进证据、实验和产出里验证。你至少要说清它影响哪些变量、指标或失败模式。`,
    },
    {
      question: `本章项目「${module.project}」最小可执行版本是什么？`,
      answer: `先保留一个输入、一个核心方法、一个可观察输出和一个验收标准；再让导师检查证据链，而不是一开始追求完整系统。`,
    },
    {
      question: `${second} 和本章最终产出之间有什么关系？`,
      answer: `好的回答要把 ${second} 连接到「${module.project}」：它提供了什么能力、解决什么瓶颈、又在哪些场景下会失效。`,
    },
  ];
}

function renderHeader() {
  const module = activeModule();
  const doneCount = state.modules.filter((item) => state.done.has(item.id)).length;
  el("stageLabel").textContent = `Stage ${module.stage}`;
  el("chapterTitle").textContent = module.title;
  el("chapterSummary").textContent = module.summary;
  el("progressStatus").textContent = `进度：${doneCount}/${state.modules.length}`;
  el("progressBar").style.width = `${state.modules.length ? (doneCount / state.modules.length) * 100 : 0}%`;
  el("markDone").textContent = state.done.has(module.id) ? "取消完成" : "标记完成";
  el("prevModule").disabled = moduleIndex() === 0;
  el("nextModule").disabled = moduleIndex() === state.modules.length - 1;
}

function renderCatalog() {
  const current = activeModule();
  el("moduleList").innerHTML = state.modules
    .map((module) => {
      const active = module.id === current.id ? " active" : "";
      const done = state.done.has(module.id) ? " done" : "";
      return `
        <button class="module-button${active}${done}" type="button" data-module="${escapeHtml(module.id)}">
          <span class="module-stage">${escapeHtml(module.stage)}</span>
          <span class="module-copy">
            <strong>${escapeHtml(module.title)}</strong>
            <span>${escapeHtml(module.summary)}</span>
          </span>
        </button>
      `;
    })
    .join("");
}

function renderTabs() {
  document.querySelectorAll(".reader-tabs button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === state.activeTab);
  });
  document.querySelectorAll(".reader-view").forEach((view) => {
    view.classList.toggle("active", view.id === `${state.activeTab}View`);
  });
}

function renderLesson() {
  const module = activeModule();
  const route = learningRoute(module);
  const concepts = conceptCards(module);
  el("lessonView").innerHTML = `
    <article class="lesson-article">
      <div class="reading-lead">
        <strong>本章核心判断：</strong>
        ${escapeHtml(module.summary)}
      </div>

      <section class="chapter-section">
        <p>这一页不是资料索引，而是一节可以直接读的课。你先要知道本章解决什么问题、哪些概念必须掌握、读完以后要交付什么作品。只有当某个概念、证据或练习卡住时，再打开右侧导师。</p>
        <p>学习大模型最容易犯的错，是把资料库当成文件夹仓库：看到很多论文、PPT、代码和课程链接，却不知道先读什么、为什么读、读到什么程度算过关。本课程把每章压成一条学习链：问题、概念、证据、练习、产出。</p>
      </section>

      <section class="chapter-section">
        <h3>学习路线</h3>
        <div class="route-list">
          ${route
            .map(
              ([title, body], idx) => `
                <div class="route-item">
                  <span class="route-index">${String(idx + 1).padStart(2, "0")}</span>
                  <div>
                    <h4>${escapeHtml(title)}</h4>
                    <p>${escapeHtml(body)}</p>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </section>

      <section class="chapter-section">
        <h3>本章必须掌握</h3>
        <ul>
          ${(module.outcomes || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </section>

      <section class="chapter-section">
        <h3>读完要交付</h3>
        <p>${escapeHtml(module.project)}</p>
        <button type="button" data-ask="${escapeHtml(`请把「${module.project}」拆成 5 个可执行步骤，并告诉我每一步需要读哪些本地资料。`)}">让导师拆任务</button>
      </section>
    </article>

    <section class="wide-section">
      <p class="kicker">下一步</p>
      <h3>先自己读，再带着具体问题问</h3>
      <div class="prompt-grid">
        ${concepts
          .slice(0, 4)
          .map((item) => `<button class="prompt-card" type="button" data-ask="${escapeHtml(item.ask)}"><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.body)}</p></button>`)
          .join("")}
      </div>
    </section>
  `;
}

function renderMap() {
  const module = activeModule();
  const concepts = conceptCards(module);
  el("mapView").innerHTML = `
    <section class="wide-section">
      <p class="kicker">概念图</p>
      <h3>把术语放进机制，而不是孤立背定义</h3>
      <p>点击任何概念都可以让导师结合当前章节解释。这里先给你一张可读的概念地图：每个概念都要回答“它改变了什么、如何验证、失败在哪里”。</p>
      <div class="concept-grid">
        ${concepts
          .map(
            (item) => `
              <article class="concept-card">
                <h4>${escapeHtml(item.title)}</h4>
                <p>${escapeHtml(item.body)}</p>
                <button class="text-button" type="button" data-ask="${escapeHtml(item.ask)}">问导师解释</button>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderPractice() {
  const module = activeModule();
  const checks = module.outcomes || [];
  const quiz = quizItems(module);
  el("practiceView").innerHTML = `
    <section class="wide-section">
      <p class="kicker">练习闭环</p>
      <h3>不用模型也能先自测</h3>
      <p>先把下面几项勾完，再问导师检查。学习体验会好很多，因为你问的是具体卡点，而不是把整章外包给模型。</p>
      <div class="check-list">
        ${checks
          .map(
            (item, idx) => `
              <label class="check-row">
                <input type="checkbox" data-check="${idx}" ${state.done.has(`${module.id}:check:${idx}`) ? "checked" : ""} />
                <span>${escapeHtml(item)}</span>
              </label>
            `
          )
          .join("")}
      </div>
    </section>

    <section class="wide-section">
      <p class="kicker">课堂小测</p>
      <h3>先答，再展开讲解</h3>
      <div class="practice-grid">
        ${quiz
          .map(
            (item, idx) => `
              <article class="practice-card">
                <h4>${escapeHtml(item.question)}</h4>
                <button class="ghost-button" type="button" data-reveal="${idx}">展开讲解</button>
                <div id="quizAnswer${idx}" class="quiz-answer">${escapeHtml(item.answer)}</div>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderNotes() {
  const module = activeModule();
  const note = state.notes[module.id] || "";
  el("notesView").innerHTML = `
    <section class="wide-section">
      <p class="kicker">学习笔记</p>
      <h3>把本章讲成自己的话</h3>
      <textarea id="noteInput" class="note-area" placeholder="写下你的理解、疑问、推导、实验记录。笔记只保存在本机浏览器。">${escapeHtml(note)}</textarea>
      <div class="mentor-actions">
        <button id="saveNote" type="button">保存笔记</button>
        <button class="ghost-button" type="button" data-note-ask="1">让导师检查笔记</button>
      </div>
    </section>
  `;
}

function renderQuickPrompts() {
  const module = activeModule();
  const prompts = [
    `请用教授口吻讲清楚「${module.title}」的核心问题。`,
    `我不懂 ${module.queries?.[0] || module.title}，请结合本地资料解释机制和例子。`,
    `请把本章实践任务拆成 5 个可执行步骤：${module.project}`,
  ];
  el("quickPrompts").innerHTML = prompts.map((prompt) => `<button type="button" data-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`).join("");
}

function renderAll() {
  renderHeader();
  renderCatalog();
  renderTabs();
  renderLesson();
  renderMap();
  renderPractice();
  renderNotes();
  renderQuickPrompts();
}

function selectModule(id) {
  if (!state.modules.some((item) => item.id === id)) return;
  state.activeId = id;
  localStorage.setItem("llmRoadActiveModule", id);
  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showTab(tab) {
  state.activeTab = tab;
  localStorage.setItem("llmRoadReaderTab", tab);
  renderTabs();
}

function openDrawer(name, focusId = "") {
  document.body.classList.remove("catalog-open", "mentor-open");
  document.body.classList.add("drawer-open", `${name}-open`);
  el("drawerBackdrop").hidden = false;
  const catalogOpen = name === "catalog";
  const mentorOpen = name === "mentor";
  el("catalogDrawer").toggleAttribute("inert", !catalogOpen);
  el("mentorDrawer").toggleAttribute("inert", !mentorOpen);
  el("catalogDrawer").setAttribute("aria-hidden", String(!catalogOpen));
  el("mentorDrawer").setAttribute("aria-hidden", String(!mentorOpen));
  el("openCatalog").setAttribute("aria-expanded", String(catalogOpen));
  el("openMentor").setAttribute("aria-expanded", String(mentorOpen));
  if (focusId) setTimeout(() => el(focusId)?.focus(), 0);
}

function closeDrawers() {
  document.body.classList.remove("drawer-open", "catalog-open", "mentor-open");
  el("drawerBackdrop").hidden = true;
  el("catalogDrawer").setAttribute("aria-hidden", "true");
  el("mentorDrawer").setAttribute("aria-hidden", "true");
  el("catalogDrawer").setAttribute("inert", "");
  el("mentorDrawer").setAttribute("inert", "");
  el("openCatalog").setAttribute("aria-expanded", "false");
  el("openMentor").setAttribute("aria-expanded", "false");
}

function setQuestion(question, submit = false) {
  openDrawer("mentor", "questionInput");
  el("questionInput").value = question;
  if (submit) ask();
}

async function ask() {
  const question = el("questionInput").value.trim();
  if (!question) return;
  openDrawer("mentor");
  el("answerBox").textContent = "正在后台检索课程资料，并调用 StepFun 导师生成回答...";
  try {
    const data = await api("ask", {
      method: "POST",
      body: JSON.stringify({
        question,
        module_id: activeModule().id,
        top_k: 5,
      }),
    });
    el("answerBox").textContent = data.answer || "导师没有返回可显示回答。";
  } catch (error) {
    el("answerBox").textContent = `问答失败：${error.message}`;
  }
}

async function load() {
  renderAll();
  try {
    const [course, stats, model] = await Promise.all([api("course"), api("stats"), api("model/status")]);
    if (course.modules?.length) state.modules = course.modules;
    if (!state.modules.some((item) => item.id === state.activeId)) state.activeId = state.modules[0]?.id || "orientation";
    el("dbStatus").textContent = stats.ready ? `知识库：${formatNumber(stats.documents)} 文档` : "知识库：离线课程";
    if (model.available) {
      el("modelStatus").textContent = `模型：${model.default_model || model.provider}`;
    } else {
      el("modelStatus").textContent = `模型：${model.provider || "服务"} 暂不可用`;
    }
    if (model.embedding_enabled && model.embedding_available) {
      el("retrievalStatus").textContent = "检索：语义就绪";
    } else if (model.embedding_enabled) {
      el("retrievalStatus").textContent = "检索：FTS 备用";
    } else {
      el("retrievalStatus").textContent = "检索：FTS";
    }
    renderAll();
  } catch (error) {
    el("dbStatus").textContent = "知识库：离线课程";
    el("modelStatus").textContent = "模型：暂未连接";
    el("retrievalStatus").textContent = "检索：离线";
    el("answerBox").textContent = `课程可以离线阅读；导师问答暂时连接不到公网 API：${error.message}`;
  }
}

el("openCatalog").addEventListener("click", () => openDrawer("catalog"));
el("openMentor").addEventListener("click", () => openDrawer("mentor", "questionInput"));
el("closeCatalog").addEventListener("click", closeDrawers);
el("closeMentor").addEventListener("click", closeDrawers);
el("drawerBackdrop").addEventListener("click", closeDrawers);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDrawers();
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") ask();
});

el("moduleList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-module]");
  if (!button) return;
  selectModule(button.dataset.module);
  closeDrawers();
});

document.querySelector(".reader-tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-tab]");
  if (button) showTab(button.dataset.tab);
});

el("prevModule").addEventListener("click", () => {
  const idx = moduleIndex();
  if (idx > 0) selectModule(state.modules[idx - 1].id);
});

el("nextModule").addEventListener("click", () => {
  const idx = moduleIndex();
  if (idx < state.modules.length - 1) selectModule(state.modules[idx + 1].id);
});

el("markDone").addEventListener("click", () => {
  const module = activeModule();
  if (state.done.has(module.id)) state.done.delete(module.id);
  else state.done.add(module.id);
  saveProgress();
  renderAll();
});

el("resetProgress").addEventListener("click", () => {
  if (!confirm("确认清空所有完成状态？")) return;
  state.done.clear();
  saveProgress();
  renderAll();
});

document.body.addEventListener("click", (event) => {
  const askButton = event.target.closest("[data-ask]");
  if (askButton) {
    setQuestion(askButton.dataset.ask, true);
    return;
  }
  const promptButton = event.target.closest("[data-prompt]");
  if (promptButton) {
    setQuestion(promptButton.dataset.prompt);
    return;
  }
  const revealButton = event.target.closest("[data-reveal]");
  if (revealButton) {
    const answer = el(`quizAnswer${revealButton.dataset.reveal}`);
    answer.classList.toggle("visible");
    revealButton.textContent = answer.classList.contains("visible") ? "收起讲解" : "展开讲解";
    return;
  }
  if (event.target.closest("[data-note-ask]")) {
    const note = el("noteInput")?.value.trim();
    if (note) setQuestion(`这是我学习「${activeModule().title}」的笔记。请指出理解漏洞，并给出下一步阅读建议：\n\n${note}`, true);
  }
});

document.body.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-check]");
  if (!checkbox) return;
  const key = `${activeModule().id}:check:${checkbox.dataset.check}`;
  if (checkbox.checked) state.done.add(key);
  else state.done.delete(key);
  saveProgress();
});

document.body.addEventListener("click", (event) => {
  if (!event.target.closest("#saveNote")) return;
  const module = activeModule();
  state.notes[module.id] = el("noteInput").value;
  saveNotes();
  el("saveNote").textContent = "已保存";
  setTimeout(() => {
    const save = el("saveNote");
    if (save) save.textContent = "保存笔记";
  }, 1200);
});

el("askBtn").addEventListener("click", ask);
el("clearAnswer").addEventListener("click", () => {
  el("questionInput").value = "";
  el("answerBox").textContent = "导师回答会显示在这里。系统会在后台检索课程资料，但不会把召回列表展示给读者。";
});

load();
