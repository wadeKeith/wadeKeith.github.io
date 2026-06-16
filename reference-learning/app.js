const APP_VERSION = "20260616ao";
const PUBLIC_API_BASE = "http://47.111.133.184:61135/api";
const SITE_HOSTS = ["yincheng429.cn", "www.yincheng429.cn"];

if (window.location.protocol === "https:" && SITE_HOSTS.includes(window.location.hostname)) {
  window.location.replace(`http://${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}`);
  throw new Error("Redirecting to the HTTP site so the public teaching API can be reached.");
}

function apiCandidates() {
  const host = window.location.hostname;
  const override = window.LLM_ROAD_API_BASE;
  if (override) return [override.replace(/\/$/, "")];
  if (["localhost", "127.0.0.1"].includes(host)) return ["./api", PUBLIC_API_BASE];
  if (SITE_HOSTS.includes(host)) return [PUBLIC_API_BASE];
  return [`${window.location.origin}/api`, PUBLIC_API_BASE];
}

const API_CANDIDATES = apiCandidates().map((base) => base.replace(/\/$/, ""));
let activeApiBase = API_CANDIDATES[0];

const state = {
  modules: [],
  active: null,
  activeTab: "teach",
  activeLens: "intuition",
  studyLevel: localStorage.getItem("llmRoadStudyLevel") || "concept",
  lectureStep: Number(localStorage.getItem("llmRoadLectureStep") || "0"),
  mechanismKnobs: { component: 55, evidence: 55, budget: 45, pressure: 40 },
  searchMode: "fts",
  lesson: null,
  lessonRequest: 0,
  visibleEvidence: [],
  searchCache: new Map(),
  lessonCache: new Map(),
  manualSearchActive: false,
  staticEvidence: null,
  staticEvidencePromise: null,
  staticSearchIndex: null,
  staticSearchIndexPromise: null,
  staticIndexReadyAt: 0,
  apiWarmupStarted: false,
  searchRequest: 0,
  done: new Set(JSON.parse(localStorage.getItem("llmRoadDone") || "[]")),
  notes: JSON.parse(localStorage.getItem("llmRoadNotes") || "{}"),
  mastery: JSON.parse(localStorage.getItem("llmRoadMastery") || "{}"),
  quizAnswers: JSON.parse(localStorage.getItem("llmRoadQuizAnswers") || "{}"),
  pinnedSources: JSON.parse(localStorage.getItem("llmRoadPinnedSources") || "{}"),
};

const FALLBACK_STATS = {
  documents: 66956,
  chunks: 831986,
  modules: 16,
};

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
    queries: ["PyTorch", "自然语言处理", "Word2Vec", "Embedding", "大模型必备的深度学习基础"],
    project: "复现一个极小文本分类器或语言模型训练循环。",
  },
  {
    id: "transformer_gpt_llama",
    stage: "02",
    title: "从零实现 Transformer、GPT 与 LLaMA",
    summary: "从注意力机制推到 decoder-only 大模型实现，建立可调试的底层理解。",
    outcomes: ["推导 scaled dot-product attention、mask、MHA、MLP、残差和归一化。", "实现 GPT 风格训练与采样。", "理解 RoPE、RMSNorm、SwiGLU、GQA 等 LLaMA 设计选择。"],
    queries: ["Transformer", "手撕GPT", "LLaMA", "RoPE", "RMSNorm", "Grouped Query Attention", "CS336 assignment1"],
    project: "实现一个最小 decoder-only Transformer，并和 nanoGPT 或 CS336 基础实现对照。",
  },
  {
    id: "llm_training_scaling_data",
    stage: "03",
    title: "大模型预训练、数据、Scaling 与 DeepSeek 架构",
    summary: "系统学习现代预训练决策、数据流水线、Scaling Law 与 MoE/MLA 等架构设计。",
    outcomes: ["解释 Scaling Law 与数据质量/规模之间的权衡。", "理解去重、过滤、课程式数据配比和数据混合。", "学习 MoE、MLA、YaRN、负载均衡和 multi-token prediction。"],
    queries: ["scaling laws", "CS336 scaling", "CS336 data", "DeepSeek-V3", "Mixture-of-Experts", "Multi Latent Attention", "YaRN"],
    project: "设计一个小型预训练实验计划：数据、模型规模、训练预算和评测节点。",
  },
  {
    id: "sft_peft_lora",
    stage: "04",
    title: "SFT、PEFT、LoRA、QLoRA 与指令微调",
    summary: "学习把预训练模型变成可用助手的核心后训练与参数高效微调方法。",
    outcomes: ["理解 SFT 数据格式、loss mask 和监督微调流程。", "比较全量微调、LoRA、QLoRA、Adapter 和 prompt tuning。", "判断何时适合使用量化与 PEFT。"],
    queries: ["LoRA", "QLoRA", "PEFT", "SFT", "Adapter", "Prompting", "Supervised FineTuning"],
    project: "准备一个小型指令微调数据集，并写出 SFT/LoRA 实验方案。",
  },
  {
    id: "inference_systems",
    stage: "05",
    title: "推理、服务化、加速与分布式系统",
    summary: "把模型内部机制连接到真实延迟、吞吐、显存和服务约束。",
    outcomes: ["解释 KV cache、batching、prefill/decode、chunk prefill 和 speculative decoding。", "理解 FlashAttention、vLLM、张量并行和分布式训练基础。", "能阅读 profiling 结果并定位系统瓶颈。"],
    queries: ["Inference", "FlashAttention", "vLLM", "KV cache", "speculative decoding", "DeepSpeed", "Tensor Model Parallelism", "CS336 systems"],
    project: "写一份 7B 模型部署说明：延迟、吞吐、显存预算与优化策略。",
  },
  {
    id: "alignment_rlhf_eval",
    stage: "06",
    title: "RLHF、DPO、奖励模型、评测与安全",
    summary: "学习偏好学习、后训练、评测体系和安全检查如何共同塑造可用模型。",
    outcomes: ["理解 reward modeling、PPO、DPO、GRPO 和 Constitutional AI。", "使用 benchmark harness 和简单本地评测。", "区分能力评测、安全评测和回归测试。"],
    queries: ["RLHF", "PPO", "DPO", "reward model", "OpenAI Evals", "HELM", "HarmBench", "Constitutional AI", "CS329H"],
    project: "为“大模型学习之路”导师定义一套本地评测题和回归测试。",
  },
  {
    id: "rag_agents",
    stage: "07",
    title: "RAG、Agent、工具调用与代码智能体",
    summary: "构建能检索、推理、调用工具并完成任务的大模型系统。",
    outcomes: ["理解切分、检索、重排、来源引用和幻觉失败模式。", "学习工具调用、规划、记忆、ReAct 和代码 Agent 工作流。", "把本应用的数据库设计映射到生产级 RAG 模式。"],
    queries: ["RAG", "ReAct", "Agent", "LangChain", "Berkeley LLM Agents", "Code Agents", "SWE-bench"],
    project: "改进一个检索提示词，并用资料库里的五个问题测试效果。",
  },
  {
    id: "vlm_multimodal",
    stage: "08",
    title: "VLM 与多模态基础",
    summary: "学习视觉语言表征、图文对齐和以 LLM 为中心的多模态模型。",
    outcomes: ["理解 ViT、CLIP、BLIP-2、LLaVA、多模态对齐和 VQA 任务。", "比较对比学习、图像描述和指令微调 VLM 路线。", "知道图像 token 如何接入 LLM 上下文。"],
    queries: ["ViT", "CLIP", "BLIP2", "LLaVA", "多模态", "CMU MMML", "CS25", "VLM"],
    project: "解释 LLaVA 从图像编码器到语言模型输出的训练流水线。",
  },
  {
    id: "streaming_video_vlm",
    stage: "09",
    title: "流式 VLM 与在线视频理解",
    summary: "聚焦长时序、实时输入和在线视频语言系统。",
    outcomes: ["理解在线视频 benchmark 与时间推理需求。", "比较流式记忆、帧选择和层次化视频理解。", "把 streaming VLM 与具身智能、机器人场景联系起来。"],
    queries: ["StreamingVLM", "VideoLLM-online", "StreamingBench", "OVO-Bench", "online video", "hierarchical streaming video"],
    project: "为机器人或第一视角视频场景设计一组 streaming VLM 评测题。",
  },
  {
    id: "vla_robotics",
    stage: "10",
    title: "VLA、机器人学习与具身策略",
    summary: "学习视觉语言模型如何进一步成为机器人动作策略。",
    outcomes: ["理解 OpenVLA、RT-1/RT-2、Octo、pi0、动作 token 化和策略微调。", "连接机器人数据集、模拟器与真实世界操作任务。", "知道输出从文本变成动作后，建模和评测会发生什么变化。"],
    queries: ["OpenVLA", "OpenVLA-OFT", "RT-1", "RT-2", "Octo", "pi0", "action tokenization", "CS224R", "CS285"],
    project: "草拟一个在新操作任务上微调 VLA 的实验方案。",
  },
  {
    id: "robot_sim_data",
    stage: "11",
    title: "机器人模拟器、数据集与可复现实验",
    summary: "学习在本地或工作站上运行机器人学习实验所需的工具链。",
    outcomes: ["比较 ManiSkill、Isaac Lab、Habitat、RoboCasa、RLBench、robosuite、DROID 和 BridgeData。", "理解 benchmark/任务设计与数据采集权衡。", "知道模拟器如何支撑 VLA 与 world model 研究。"],
    queries: ["ManiSkill", "Isaac Lab", "Habitat", "RoboCasa", "RLBench", "robosuite", "DROID", "BridgeData"],
    project: "选择一个模拟器，写出复现一个操作 benchmark 的最小步骤。",
  },
  {
    id: "world_models",
    stage: "12",
    title: "World Model 与模型式强化学习",
    summary: "学习潜变量动力学、想象 rollout、预测表征和规划。",
    outcomes: ["理解 World Models、Dreamer、MuZero、V-JEPA、JEPA-WM、Genie 和 model-based RL。", "比较重建式模型与 joint-embedding predictive model。", "把 world model 与机器人、自动驾驶联系起来。"],
    queries: ["World Models", "DreamerV3", "MuZero", "V-JEPA", "JEPA-WM", "Genie", "LightZero", "CS330"],
    project: "解释为什么潜空间想象可以提升控制任务的样本效率。",
  },
  {
    id: "driving_world_models",
    stage: "13",
    title: "自动驾驶 World Model 与 VLM",
    summary: "学习面向驾驶的生成式仿真、规划和视觉语言推理。",
    outcomes: ["理解 GAIA-1、DriveDreamer、Vista、CarDreamer、Waymax、DriveLM 和 OpenEMMA。", "连接场景生成、闭环评测和规划。", "识别驾驶 world model 与通用视频生成的差异。"],
    queries: ["GAIA-1", "DriveDreamer", "Vista", "CarDreamer", "Waymax", "DriveLM", "OpenEMMA", "autonomous driving world model"],
    project: "写一篇短综述，比较两种自动驾驶 world model 路线。",
  },
  {
    id: "diffusion_video_3d",
    stage: "14",
    title: "扩散、Flow Matching、视频生成与 3D 空间智能",
    summary: "把现代生成建模和空间表征加入 LLM/VLM 技术栈。",
    outcomes: ["理解 DDPM、score SDE、latent diffusion、DiT、flow matching 和视频扩散。", "理解 NeRF、3D Gaussian Splatting、PyTorch3D、Nerfstudio 和空间 VLM。", "把生成式视频与世界模拟器联系起来。"],
    queries: ["DDPM", "Score SDE", "Latent Diffusion", "DiT", "Flow Matching", "Stable Video Diffusion", "NeRF", "Gaussian Splatting", "VLM-3R"],
    project: "解释视频生成和 3D 场景表征如何支持 world model 训练。",
  },
  {
    id: "omni_audio_capstone",
    stage: "15",
    title: "全模态模型与最终 Capstone",
    summary: "跟踪音频/全模态模型，并把整条课程线整合成一个研究作品。",
    outcomes: ["理解 Qwen3-Omni、Ola、InternLM OmniLive、SLAM-LLM、SenseVoice 和 CosyVoice 方向。", "设计一个至少使用两种模态和一套评测的研究项目。", "把这个本地学习网页作为开源学习伴侣继续迭代。"],
    queries: ["Qwen3-Omni", "Ola", "InternLM OmniLive", "SLAM-LLM", "SenseVoice", "CosyVoice", "audio language model"],
    project: "完成一份 Capstone 提案：问题、数据、模型、评测、baseline、风险和算力计划。",
  },
];

const LESSON_BLUEPRINTS = {
  orientation: {
    thesis: "先把资料库当成研究实验室，而不是文件夹仓库。",
    frame:
      "这一章解决学习系统问题：你需要知道哪些资料负责概念、哪些资料负责代码、哪些资料负责前沿论文，随后用检索和笔记把它们串成可复用的研究工作流。",
    concepts: ["知识库地图", "课程矩阵", "检索式学习", "证据引用", "本地 RAG", "学习闭环"],
    route: [
      ["先建地图", "读目录、覆盖矩阵和模块路径，明确 LLM、VLM、VLA、world model 等板块的边界。"],
      ["再建索引感", "理解 SQLite/FTS 的角色：它不是替你学习，而是帮你快速回到证据。"],
      ["最后建习惯", "每次学习都留下问题、来源和自己的解释，后续问答才有上下文。"],
    ],
    misconceptions: ["把数据库检索结果当最终答案。它只是证据入口。", "跳过目录直接刷材料，最后会迷失在 60k+ 文件里。"],
    checks: [
      ["为什么这套系统要本地优先？", "从隐私、速度、可复现资料来源三个角度回答。", "本地优先让资料、索引、问答都在自己的机器或私有服务里运行，适合长期学习和研究复现；即使没有模型，也能靠数据库证据继续阅读。"],
      ["检索、精读、问答的顺序应该是什么？", "先证据，再解释。", "先检索定位资料，再精读片段和源文件，最后用导师解释卡住的概念；这样模型回答会被证据约束。"],
    ],
    labSteps: ["打开覆盖矩阵，标出三类最常用资料。", "为每个模块保存一个你最想追问的问题。", "完成一次检索、精读、笔记、追问的闭环。"],
  },
  math_pytorch_nlp: {
    thesis: "大模型不是魔法，它首先是张量程序、优化问题和语言建模目标。",
    frame:
      "这一章把数学、PyTorch、NLP 基础压成一条可执行路径：你要能看懂 shape，能追踪梯度，能解释 token 如何变成 embedding，再进入 Transformer。",
    concepts: ["Tensor shape", "Autograd", "Optimization", "Tokenization", "Embedding", "Language modeling"],
    route: [
      ["看张量", "所有模型结构都先落实为矩阵维度、广播和 batch 约定。"],
      ["看训练", "理解 loss、反向传播、优化器和训练循环，才能定位模型为什么不收敛。"],
      ["看文本", "把文本切成 token、映射成向量，再用语言建模目标学习分布。"],
    ],
    misconceptions: ["只背公式不跑代码。大模型工程里 shape 错误会比概念错误更早出现。", "把 tokenizer 当预处理细节。它直接影响压缩率、上下文预算和多语言表现。"],
    checks: [
      ["为什么 embedding 不是 one-hot 的简单替代？", "关注可学习参数和语义邻近性。", "Embedding 是可学习的稠密表示，既降低维度，也让相似 token 在训练中形成可用的几何关系。"],
      ["训练循环最小闭环包括哪些部分？", "数据、前向、loss、反向、更新。", "取 batch，前向计算 logits，计算 loss，反向传播梯度，优化器更新参数，并监控指标。"],
    ],
    labSteps: ["实现一个小文本分类器。", "打印每一层张量形状。", "换 tokenizer 或 vocab 后观察输入长度变化。"],
  },
  transformer_gpt_llama: {
    thesis: "Transformer 的核心不是一堆模块名，而是信息如何在序列内被选择、混合与归一化。",
    frame:
      "这一章从 scaled dot-product attention 到 GPT/LLaMA。目标是能手写 decoder-only 模型，并解释 RoPE、RMSNorm、SwiGLU、GQA 为什么会出现在现代架构里。",
    concepts: ["Self-Attention", "Causal mask", "MHA/GQA", "RoPE", "RMSNorm", "SwiGLU", "Sampling"],
    route: [
      ["推注意力", "从 QK^T 的相似度、scale、mask、softmax 和 V 加权平均开始。"],
      ["搭 GPT", "把 attention、MLP、残差、归一化堆成 decoder block，再接语言建模头。"],
      ["读 LLaMA", "比较 RoPE、RMSNorm、SwiGLU、GQA 与 vanilla Transformer 的差异。"],
    ],
    misconceptions: ["只会说 attention is all you need，却说不清 mask 后 logits 发生什么。", "把 LLaMA 结构变化当技巧清单，而不是训练稳定性和推理效率选择。"],
    checks: [
      ["causal mask 保护了什么？", "从自回归训练的信息泄漏回答。", "它阻止当前位置看到未来 token，保证训练时的条件分布和推理时逐 token 生成一致。"],
      ["RoPE 和绝对位置编码的差异是什么？", "关注相对位置信息如何进入注意力。", "RoPE 通过旋转 Q/K 表示把位置信息注入相似度计算，更自然地表达相对位置并支持一定长度外推。"],
    ],
    labSteps: ["手写一个单头 attention 并验证 mask。", "实现最小 GPT block。", "比较 top-k、top-p、temperature 的采样输出。"],
  },
  llm_training_scaling_data: {
    thesis: "预训练质量由模型、数据、算力和训练配方共同决定，任何一个短板都会放大。",
    frame:
      "这一章进入现代 LLM 训练：scaling laws 告诉你预算如何分配，数据工程决定模型学到什么，MoE/MLA/YaRN 等结构选择影响效率和长上下文能力。",
    concepts: ["Scaling laws", "Data mixture", "Deduplication", "MoE", "MLA", "YaRN", "Multi-token prediction"],
    route: [
      ["定预算", "用 scaling 思维理解参数量、token 数和 compute 的权衡。"],
      ["管数据", "去重、过滤、配比和质量评估比单纯堆数据更关键。"],
      ["看架构", "用 DeepSeek 风格材料理解 MoE、MLA、长上下文和训练效率的系统组合。"],
    ],
    misconceptions: ["把 scaling law 当固定公式。它是决策工具，不是替代实验的定律。", "只看模型结构忽略数据配比，实际训练会被数据质量支配。"],
    checks: [
      ["为什么高质量数据会改变小模型表现？", "从有效 token 和噪声梯度回答。", "高质量数据提高每个 token 的学习信号，减少无效或冲突梯度，因此同样 compute 下模型更容易学到可泛化模式。"],
      ["MoE 的收益和代价是什么？", "稀疏激活 vs 路由和负载均衡。", "MoE 增大总参数但每个 token 只激活部分专家，提高容量效率；代价是路由、通信和负载均衡更复杂。"],
    ],
    labSteps: ["写一个 1B 级别预训练计划草案。", "列出数据过滤指标。", "设计三个 checkpoint eval。"],
  },
  sft_peft_lora: {
    thesis: "后训练的目标不是让模型记更多知识，而是让它按任务和人类偏好使用已有能力。",
    frame:
      "这一章讨论 SFT、PEFT、LoRA、QLoRA 和 instruction tuning。你要能判断何时全参微调，何时只训练低秩适配器，何时量化会影响质量。",
    concepts: ["SFT", "Loss masking", "LoRA", "QLoRA", "Adapter", "Instruction data", "Quantization"],
    route: [
      ["看数据格式", "区分 prompt、response、system、mask 和多轮对话模板。"],
      ["看参数路径", "比较全参、LoRA、QLoRA、adapter、prompt tuning 的更新范围。"],
      ["看评估", "用任务集和人工检查判断后训练是否真的改善了目标行为。"],
    ],
    misconceptions: ["把 LoRA 当免费午餐。它省显存，但 rank、target module 和数据质量仍然决定效果。", "只看训练 loss，不检查指令遵循和灾难性遗忘。"],
    checks: [
      ["SFT 中为什么要做 loss masking？", "哪些 token 该负责学习？", "通常只让模型在 assistant response 上承担 loss，避免把用户输入和模板也当成需要生成的目标。"],
      ["QLoRA 的关键节省来自哪里？", "基础权重量化，适配器训练。", "冻结的基础模型用低比特量化存储和计算，只训练少量 LoRA 参数，从而显著降低显存。"],
    ],
    labSteps: ["整理 100 条 instruction 数据。", "选择 LoRA target modules。", "设计训练前后对比问题。"],
  },
  inference_systems: {
    thesis: "推理系统的核心矛盾是内存带宽、批处理效率和用户延迟之间的博弈。",
    frame:
      "这一章把模型结构连接到真实服务：KV cache、prefill/decode、FlashAttention、vLLM、张量并行和 speculative decoding 都是为吞吐、延迟、显存服务。",
    concepts: ["KV cache", "Prefill/decode", "Batching", "FlashAttention", "vLLM", "Tensor parallel", "Speculative decoding"],
    route: [
      ["拆阶段", "区分 prefill 的并行计算和 decode 的逐 token 生成瓶颈。"],
      ["看内存", "理解 KV cache、显存占用和 attention IO 对吞吐的影响。"],
      ["看调度", "用 vLLM、batching、并行和 speculative decoding 思考生产部署。"],
    ],
    misconceptions: ["把 FlashAttention 误解成 sparse attention。它是 exact attention 的 IO-aware 实现。", "只追求单请求 latency，忽略批量吞吐和显存碎片。"],
    checks: [
      ["KV cache 为什么能加速 decode？", "避免重复计算过去 token 的 K/V。", "生成新 token 时，过去 token 的 K/V 已缓存，只需计算新位置并与缓存交互，减少重复前向计算。"],
      ["FlashAttention 主要优化什么？", "不是近似稀疏，而是内存读写。", "它通过分块和在线 softmax 避免物化完整注意力矩阵，减少 HBM 与 SRAM 间 IO，同时保持精确 attention。"],
    ],
    labSteps: ["估算 7B 模型 KV cache 显存。", "画出 prefill/decode 时序。", "写一页部署预算说明。"],
  },
  alignment_rlhf_eval: {
    thesis: "对齐不是单个算法，而是偏好数据、优化目标、评测和安全边界的组合工程。",
    frame:
      "这一章从 reward model、PPO、DPO、GRPO 到 eval harness。重点是把能力评测、安全评测和回归测试分开，不让漂亮分数掩盖真实风险。",
    concepts: ["Reward model", "PPO", "DPO", "GRPO", "Eval harness", "Safety eval", "Regression"],
    route: [
      ["建偏好", "理解 pairwise preference、reward model 和直接偏好优化的区别。"],
      ["看优化", "比较 PPO 这类 RL 方法和 DPO 这类离线目标。"],
      ["做评测", "把 benchmark、红队、安全检查和回归测试组合成套件。"],
    ],
    misconceptions: ["把 benchmark 分数当部署许可。真实应用还需要安全、鲁棒性和回归测试。", "认为 RLHF 一定优于 SFT；数据和目标错了会让模型更会迎合。"],
    checks: [
      ["DPO 为什么可以绕过显式 reward model？", "它直接用偏好对优化策略。", "DPO 把偏好数据转成直接优化的分类式目标，用参考模型约束策略，不需要先单独训练 reward model 再跑 PPO。"],
      ["能力 eval 和安全 eval 为什么要分开？", "高能力不等于低风险。", "能力评测衡量任务表现，安全评测衡量拒答、越狱、偏见和有害输出；两者目标不同，混在一起会误判。"],
    ],
    labSteps: ["为学习助手列 10 个能力题。", "列 10 个安全/幻觉题。", "定义上线前必须通过的回归项。"],
  },
  rag_agents: {
    thesis: "RAG 和 Agent 的价值在于把模型从闭卷生成变成有证据、有工具、有行动边界的系统。",
    frame:
      "这一章把本网站本身当案例：chunking、retrieval、reranking、citation、tool use、ReAct、code agent 都服务于可靠完成任务，而不是炫技。",
    concepts: ["Chunking", "Retrieval", "Reranking", "Citation", "ReAct", "Tool use", "SWE-bench"],
    route: [
      ["看检索", "理解 chunk 粒度、关键词扩展、排序和噪声过滤。"],
      ["看回答", "引用来源、承认不足、避免把模型常识伪装成资料证据。"],
      ["看行动", "Agent 需要计划、工具、状态和失败恢复，不能只靠长提示词。"],
    ],
    misconceptions: ["把 RAG 当向量库接模型。真正难点在资料治理、召回质量和引用约束。", "Agent 越自主越好。高风险任务需要明确工具权限和可审计轨迹。"],
    checks: [
      ["为什么 RAG 仍然会幻觉？", "检索错、证据不足、生成越界。", "如果召回片段不相关、上下文缺关键证据，或模型没有被严格要求引用来源，RAG 仍会生成看似合理但无依据的答案。"],
      ["ReAct 的核心思想是什么？", "推理和行动交替。", "模型在思考下一步时选择工具行动，再根据观察结果继续推理，适合需要多步检索或环境反馈的任务。"],
    ],
    labSteps: ["改写一个检索 query。", "用五个问题测试召回。", "记录一次模型回答引用是否充分。"],
  },
  vlm_multimodal: {
    thesis: "多模态模型的关键是把视觉表示对齐到语言模型能使用的语义空间。",
    frame:
      "这一章从 ViT、CLIP、BLIP-2、LLaVA 到 VQA。重点不是会念模型名，而是知道图像 token 如何进入 LLM，上游视觉编码和下游指令微调如何衔接。",
    concepts: ["ViT", "CLIP", "BLIP-2", "LLaVA", "VQA", "Image tokens", "Multimodal alignment"],
    route: [
      ["看视觉编码", "ViT 把图像分 patch，CLIP 用对比学习建立图文空间。"],
      ["看桥接", "Q-Former、投影层或 adapter 把视觉特征接入 LLM。"],
      ["看指令", "多模态 instruction tuning 让模型学会按语言任务使用视觉证据。"],
    ],
    misconceptions: ["以为把图片向量拼到文本前面就够了。对齐和数据任务设计才决定是否可用。", "忽略 OCR、空间关系和细粒度感知这类 VLM 常见短板。"],
    checks: [
      ["CLIP 为什么适合做多模态基础？", "图文对比空间。", "CLIP 用大量图文对学习共享表示，使图像和文本可以在同一语义空间中检索和匹配。"],
      ["LLaVA 训练大致分几步？", "先对齐，再指令微调。", "常见路线是先训练视觉到语言空间的投影/连接层，再用多模态指令数据微调，让 LLM 学会视觉问答和描述。"],
    ],
    labSteps: ["画出 LLaVA 数据流。", "比较 CLIP 和 BLIP-2 的训练目标。", "设计 5 个 VQA 失败案例。"],
  },
  streaming_video_vlm: {
    thesis: "在线视频理解的难点是时间、记忆和延迟，而不是把更多帧塞进上下文。",
    frame:
      "这一章研究 streaming VLM、online video benchmark、帧选择和层级记忆。你要能解释为什么长视频需要状态管理和事件抽象。",
    concepts: ["Streaming VLM", "Online video", "Temporal reasoning", "Frame selection", "Memory", "StreamingBench", "OVO-Bench"],
    route: [
      ["看时间", "区分离线整段理解和在线逐步观察。"],
      ["看记忆", "比较短期帧缓存、长期摘要和层级事件表示。"],
      ["看评测", "设计问题时要测试时序、因果、状态变化和实时性。"],
    ],
    misconceptions: ["认为长上下文能直接解决视频理解。视觉冗余和事件稀疏会让上下文浪费严重。", "只看最终答案，不测在线过程中的更新和延迟。"],
    checks: [
      ["在线 VLM 为什么需要记忆机制？", "历史帧不能无限保留。", "系统必须压缩历史观察，保留任务相关事件，否则上下文和计算成本会随视频长度失控。"],
      ["视频 benchmark 应该覆盖哪些能力？", "时间、状态、因果。", "应覆盖动作顺序、状态变化、长期依赖、事件定位、因果推理和实时响应。"],
    ],
    labSteps: ["设计 10 个在线公开视频问题。", "定义帧采样策略。", "写一个层级摘要记忆方案。"],
  },
  vla_robotics: {
    thesis: "VLA 的核心转变是：语言模型输出的不再只是文本，而是可执行的动作或策略条件。",
    frame:
      "这一章连接 VLM 和机器人学习。OpenVLA、RT-1/RT-2、Octo、pi0、action tokenization 共同回答一个问题：如何把视觉语言理解落到机器人动作。",
    concepts: ["OpenVLA", "RT-1/RT-2", "Octo", "pi0", "Action tokenization", "Policy fine-tuning", "LIBERO"],
    route: [
      ["看输入输出", "观察、语言指令、动作空间和控制频率决定模型接口。"],
      ["看数据", "机器人数据的场景、硬件、动作标注和分布偏移非常关键。"],
      ["看微调", "VLA fine-tuning 要关注任务成功率、泛化和安全约束。"],
    ],
    misconceptions: ["把 VLA 当带摄像头的聊天机器人。它必须控制真实或仿真环境。", "忽略动作空间定义，导致模型输出无法稳定执行。"],
    checks: [
      ["VLA 和 VLM 的输出差异是什么？", "文本 vs 行动。", "VLM 通常输出文本解释或答案，VLA 需要输出动作、动作 token 或策略条件，直接影响环境状态。"],
      ["机器人数据为什么难？", "收集成本和分布偏移。", "真实机器人数据昂贵、硬件差异大、任务环境复杂，训练分布和部署场景之间很容易偏移。"],
    ],
    labSteps: ["选一个 manipulation 任务。", "定义观察、指令和动作空间。", "列出 fine-tuning 成功指标。"],
  },
  robot_sim_data: {
    thesis: "可复现实验依赖仿真、数据和评测协议，而不只是一个策略模型。",
    frame:
      "这一章研究 ManiSkill、Isaac Lab、Habitat、RoboCasa、RLBench、robosuite、DROID、BridgeData。目标是知道如何选择工具、复现实验并解释数据偏差。",
    concepts: ["ManiSkill", "Isaac Lab", "Habitat", "RoboCasa", "RLBench", "robosuite", "DROID", "BridgeData"],
    route: [
      ["选环境", "根据任务类型、物理精度、传感器和生态选择模拟器。"],
      ["看数据", "理解 demonstration、teleoperation、真实采集和仿真数据的差异。"],
      ["做复现", "记录版本、任务种子、评测指标和失败模式。"],
    ],
    misconceptions: ["认为仿真成功等于真实成功。sim-to-real gap 需要单独处理。", "只报告平均成功率，不保存失败轨迹和任务配置。"],
    checks: [
      ["选择机器人模拟器要看哪些维度？", "任务、物理、传感器、生态。", "要看支持的任务类型、物理引擎、传感器、资产、并行效率、已有 benchmark 和社区生态。"],
      ["数据集为什么会限制策略泛化？", "分布覆盖。", "如果 demonstrations 只覆盖少数场景、物体或动作方式，策略容易记住分布而不是学习可泛化控制。"],
    ],
    labSteps: ["选一个模拟器并列安装步骤。", "定义任务初始状态分布。", "写失败案例记录模板。"],
  },
  world_models: {
    thesis: "世界模型通过学习环境动力学，让智能体可以在潜空间里想象、评估和规划。",
    frame:
      "这一章从 World Models、Dreamer、MuZero、V-JEPA、JEPA-WM、Genie 到 model-based RL。关键是区分重构式预测、联合嵌入预测和规划使用方式。",
    concepts: ["Latent dynamics", "DreamerV3", "MuZero", "V-JEPA", "JEPA-WM", "Genie", "Model-based RL"],
    route: [
      ["学表示", "把高维观察压到可预测、可控制的潜在状态。"],
      ["学动力学", "预测未来状态、奖励或价值，用 imagination rollout 训练策略。"],
      ["看规划", "MuZero 类方法把模型用于搜索，Dreamer 类方法用于潜空间策略学习。"],
    ],
    misconceptions: ["把世界模型等同视频生成。控制任务关心可规划状态，不只是逼真像素。", "忽略模型误差累积，长 rollout 会放大偏差。"],
    checks: [
      ["latent imagination 为什么能省样本？", "在模型里生成训练经验。", "学到动力学后，智能体可以在潜空间模拟未来，减少真实环境交互次数，用更多想象轨迹更新策略。"],
      ["MuZero 和 Dreamer 的使用方式有什么不同？", "搜索 vs 潜空间策略学习。", "MuZero 学模型辅助 MCTS 搜索，Dreamer 学潜在动力学并在想象 rollout 中训练 actor-critic。"],
    ],
    labSteps: ["画出 Dreamer 数据流。", "列出模型误差来源。", "设计一个小控制任务的 world model eval。"],
  },
  driving_world_models: {
    thesis: "自动驾驶世界模型必须同时服务场景生成、闭环评测、规划和安全边界。",
    frame:
      "这一章关注 GAIA-1、DriveDreamer、Vista、CarDreamer、Waymax、DriveLM、OpenEMMA。驾驶场景比一般视频生成更强调物理一致性、交通规则和闭环控制。",
    concepts: ["GAIA-1", "DriveDreamer", "Vista", "CarDreamer", "Waymax", "DriveLM", "Closed-loop eval"],
    route: [
      ["看生成", "生成未来场景需要车辆、道路、交通参与者和相机几何一致。"],
      ["看规划", "世界模型要能评估不同动作对未来风险的影响。"],
      ["看评测", "闭环指标比离线像素质量更接近真实驾驶价值。"],
    ],
    misconceptions: ["把驾驶世界模型当普通 text-to-video。交通交互和安全约束才是重点。", "只看开环预测，不做闭环规划评估。"],
    checks: [
      ["驾驶世界模型和普通视频生成的差别是什么？", "控制和安全。", "驾驶模型需要保持道路结构、物体运动、交通规则和动作后果一致，最终服务规划和评测。"],
      ["为什么闭环评测重要？", "动作会改变未来。", "开环预测只比较记录数据，闭环评测让策略动作影响后续状态，更能暴露累积错误和危险行为。"],
    ],
    labSteps: ["比较两个驾驶世界模型。", "列三个闭环指标。", "设计一个危险场景生成需求。"],
  },
  diffusion_video_3d: {
    thesis: "扩散、flow matching、视频生成和 3D 表示共同构成现代生成式世界建模工具箱。",
    frame:
      "这一章把 DDPM、score SDE、latent diffusion、DiT、flow matching、NeRF、3D Gaussian Splatting 串起来。目标是理解生成模型如何服务视觉、视频和空间智能。",
    concepts: ["DDPM", "Score SDE", "Latent diffusion", "DiT", "Flow matching", "NeRF", "3D Gaussian Splatting"],
    route: [
      ["看扩散", "从加噪/去噪、score 和采样过程理解生成。"],
      ["看 flow", "比较 flow matching 与扩散在路径和训练目标上的差异。"],
      ["看空间", "NeRF 和 3DGS 让场景表示从 2D 图像走向可渲染空间。"],
    ],
    misconceptions: ["只看生成图像质量，忽略采样速度、控制性和物理一致性。", "把 3DGS 当渲染技巧，不看它对空间理解和仿真的意义。"],
    checks: [
      ["latent diffusion 为什么高效？", "在压缩潜空间中扩散。", "它先用自编码器把图像压到潜空间，再在较低维空间建模扩散过程，降低计算和显存成本。"],
      ["3D 表示对世界模型有什么价值？", "可视角变化和几何一致。", "空间表示支持新视角渲染、几何关系和场景重建，可为机器人、驾驶和视频模型提供更稳定的环境结构。"],
    ],
    labSteps: ["比较 DDPM 和 flow matching。", "画出 latent diffusion pipeline。", "解释 NeRF 与 3DGS 的取舍。"],
  },
  omni_audio_capstone: {
    thesis: "最终目标不是收集更多模型名，而是能提出一个多模态研究问题并设计可执行评测。",
    frame:
      "这一章把 Qwen3-Omni、Ola、InternLM OmniLive、SLAM-LLM、SenseVoice、CosyVoice 等方向作为 capstone 起点。你需要整合模态、任务、数据、模型、评测和风险。",
    concepts: ["Omni-modal", "Speech foundation model", "Audio LLM", "Qwen3-Omni", "SLAM-LLM", "CosyVoice", "Capstone eval"],
    route: [
      ["选问题", "问题要足够具体：场景、用户、模态和输出形式明确。"],
      ["定系统", "说明输入模态、基础模型、微调数据、工具和部署约束。"],
      ["做评测", "定义 baseline、主指标、失败模式、安全和消融实验。"],
    ],
    misconceptions: ["把 capstone 写成综述清单。研究计划必须有可验证假设。", "只追求多模态数量，不定义每个模态带来的增量。"],
    checks: [
      ["一个 capstone proposal 最少包括什么？", "问题、数据、模型、评测。", "应包括研究问题、数据来源、模型路线、baseline、评测指标、风险、计算预算和时间计划。"],
      ["多模态系统如何证明某个模态有用？", "消融实验。", "通过去掉或替换该模态，比较任务表现、鲁棒性和失败模式，证明它带来独立增益。"],
    ],
    labSteps: ["写一页 capstone 题目。", "列数据和 baseline。", "设计主指标、消融和风险表。"],
  },
};

const COURSE_ANCHORS = {
  orientation: ["Stanford CS336：用从零构建理解完整语言模型栈。", "Stanford CS25：用前沿专题保持 Transformer 视野。", "MIT 6.S191：先打牢深度学习和生成模型直觉。"],
  math_pytorch_nlp: ["MIT 6.S191：神经网络、优化和生成模型基础。", "Stanford CS224N：词向量、语言模型和 NLP 数据。", "CS336 预备能力：能读 shape、loss 和训练循环。"],
  transformer_gpt_llama: ["Stanford CS336：从 tokenizer 到 Transformer block 手写实现。", "Stanford CS25：理解 Transformer 架构演化。", "nanoGPT/LLM-from-scratch：用最小代码闭环验证。"],
  llm_training_scaling_data: ["Stanford CS336：data、scaling、training dynamics。", "DeepSeek 技术路线：MoE、MLA、长上下文和训练效率。", "前沿论文阅读：把架构选择和算力预算联系起来。"],
  sft_peft_lora: ["后训练主线：SFT、偏好优化和安全边界。", "DeepLearning.AI/业界课程：用小数据做可验证 adaptation。", "工程视角：数据格式、mask、LoRA target 和评测闭环。"],
  inference_systems: ["Stanford CS336 systems：FlashAttention、并行和推理瓶颈。", "vLLM/PagedAttention：从论文到服务系统。", "GPU 性能课：用内存带宽和调度解释延迟。"],
  alignment_rlhf_eval: ["RLHF/DPO 课程线：偏好数据、reward、policy optimization。", "HELM/OpenAI Evals：区分能力、安全和回归。", "安全课程视角：模型行为要可测、可复现、可追踪。"],
  rag_agents: ["Berkeley LLM Agents：tools、planning、memory、ReAct。", "RAG 工程课：chunking、retrieval、reranking、citation。", "SWE-bench/code agents：把语言模型接到真实任务。"],
  vlm_multimodal: ["Stanford CS25：Transformer 扩展到视觉和多模态。", "CLIP/LLaVA 路线：图文对齐、连接器和指令微调。", "VQA/空间推理：从感知到语言证据。"],
  streaming_video_vlm: ["在线视频理解：temporal reasoning、memory、latency。", "StreamingBench/OVO-Bench：测在线状态更新能力。", "具身视角：视频理解服务于行动和反馈。"],
  vla_robotics: ["Berkeley/Stanford robot learning：从感知到策略。", "OpenVLA/RT-2：语言、视觉、动作的接口设计。", "LIBERO/robot benchmarks：用成功率和泛化评估策略。"],
  robot_sim_data: ["ManiSkill/Isaac Lab：仿真、资产和并行实验。", "RoboCasa/RLBench：任务设计和数据分布。", "可复现研究：版本、种子、评测协议和失败轨迹。"],
  world_models: ["Dreamer/MuZero：model-based RL 和 latent imagination。", "V-JEPA/JEPA-WM：预测表征和世界建模。", "控制视角：模型误差、规划和样本效率。"],
  driving_world_models: ["DriveDreamer/GAIA-1：驾驶场景生成和预测。", "Waymax/closed-loop eval：让动作影响未来。", "DriveLM/OpenEMMA：VLM 推理进入驾驶决策。"],
  diffusion_video_3d: ["MIT 6.S978：深度生成模型统一视角。", "Diffusion/Flow Matching：从 score 到生成路径。", "NeRF/3DGS：空间表示服务世界模型。"],
  omni_audio_capstone: ["Omni 模型路线：音频、语音、视觉、文本统一接口。", "Capstone 研究训练：问题、数据、baseline、评测。", "系统整合：检索、模型、工具和多模态输入协作。"],
};

const COURSE_TRACKS = [
  {
    id: "foundation",
    title: "Foundation：研究学习系统与基础能力",
    summary: "建立资料库地图、数学/PyTorch/NLP 基础，以及手写 Transformer 的最低可运行能力。",
    modules: ["orientation", "math_pytorch_nlp", "transformer_gpt_llama"],
    milestone: "能从零解释 decoder-only LLM 的数据流，并用最小代码验证。",
  },
  {
    id: "llm_core",
    title: "Core LLM：训练、后训练、推理系统与对齐",
    summary: "从预训练数据和 scaling 进入 SFT/LoRA、推理服务、RLHF/DPO 与评测安全。",
    modules: ["llm_training_scaling_data", "sft_peft_lora", "inference_systems", "alignment_rlhf_eval"],
    milestone: "能设计一个小模型训练/后训练/部署/评测的完整实验计划。",
  },
  {
    id: "agents",
    title: "Systems & Agents：RAG、工具调用与代码智能体",
    summary: "把模型从闭卷生成扩展为能检索、引用、调用工具和完成任务的可审计系统。",
    modules: ["rag_agents"],
    milestone: "能解释一个生产级 RAG/Agent 系统的召回、重排、引用、工具和失败恢复。",
  },
  {
    id: "embodied",
    title: "Multimodal & Embodied：VLM、视频、VLA 与机器人数据",
    summary: "把语言模型扩展到图像、视频、动作策略、仿真和机器人可复现实验。",
    modules: ["vlm_multimodal", "streaming_video_vlm", "vla_robotics", "robot_sim_data"],
    milestone: "能把视觉语言理解转成机器人任务接口、数据方案和成功率评测。",
  },
  {
    id: "world_models",
    title: "World Models & Generative Systems：世界模型、驾驶、扩散、3D 与全模态",
    summary: "学习可预测世界、可生成场景、可评测规划和全模态 capstone 研究设计。",
    modules: ["world_models", "driving_world_models", "diffusion_video_3d", "omni_audio_capstone"],
    milestone: "能提出一个多模态或世界模型研究计划，并定义 baseline、指标和风险。",
  },
];

const GLOBAL_COURSE_MAP = [
  {
    source: "Stanford CS336",
    title: "从零构建语言模型",
    body: "按 tokenizer、PyTorch 资源核算、Transformer 架构、MoE、GPU kernel、并行、scaling、inference 的顺序建立硬核底层能力。",
    modules: ["00", "01", "02", "03", "05"],
    query: "CS336 tokenizer PyTorch resource accounting FlashAttention parallelism scaling inference",
  },
  {
    source: "Stanford CS25",
    title: "Transformer 前沿研讨",
    body: "把 Transformer 放进 LLM、视觉、机器人、科学和生成系统的最新进展里读，训练学生追踪一线研究问题而不是背模型名。",
    modules: ["02", "03", "08", "10", "15"],
    query: "CS25 Transformers GPT robotics multimodal frontier AI",
  },
  {
    source: "Berkeley LLM Agents",
    title: "Agent 推理与工具系统",
    body: "围绕 reasoning、planning、memory、tool use、code generation、program verification 学习可审计的智能体系统。",
    modules: ["07"],
    query: "Berkeley LLM Agents ReAct tool use planning code generation program verification",
  },
  {
    source: "Full Stack / DeepLearning.AI",
    title: "RAG、评测与产品化",
    body: "从 prompt、retriever、vector database、reranking、evaluation、LLMOps、用户体验和安全回归进入真实应用构建。",
    modules: ["04", "06", "07"],
    query: "RAG retriever vector database reranking evaluation LLMOps prompt engineering",
  },
  {
    source: "Hugging Face LLM Course",
    title: "开源工具链实战",
    body: "用 Transformers、Datasets、Tokenizers、Accelerate 和 Hub 把概念落到可运行实验，适合把讲义变成代码。",
    modules: ["01", "02", "04"],
    query: "Hugging Face Transformers Datasets Tokenizers Accelerate fine tuning",
  },
  {
    source: "MIT / CMU 生成与多模态",
    title: "生成模型、多模态与具身扩展",
    body: "用 diffusion、autoregressive、flow、3D 表示、multimodal representation/alignment/fusion 连接视频、世界模型和机器人。",
    modules: ["08", "09", "10", "12", "14", "15"],
    query: "diffusion flow matching multimodal alignment fusion world models robotics",
  },
];

const COURSE_STANDARD_BENCHMARKS = [
  {
    id: "from_scratch",
    source: "Stanford CS336",
    title: "从零构建，而不是只会调用",
    body: "每章都要能落到一个可运行或可复查的最小系统：数据、模型、训练/推理、评测至少有一条链路被亲手打通。",
    query: "CS336 language modeling from scratch tokenizer transformer training evaluation",
    ask: "请按 Stanford CS336 的 from-scratch 标准检查我这一章：哪些部分必须亲手实现，哪些可以只读证据？",
  },
  {
    id: "frontier_seminar",
    source: "Stanford CS25",
    title: "用前沿 seminar 视野追问题",
    body: "不要把模型名当结论；把每个概念放进当前 Transformer / multimodal / robotics / systems 的前沿问题里。",
    query: "CS25 Transformers frontier LLM multimodal robotics seminar",
    ask: "请按 Stanford CS25 的前沿研讨方式，把本章整理成 3 个研究问题和 3 个值得追踪的方向。",
  },
  {
    id: "agent_reasoning",
    source: "Berkeley LLM Agents",
    title: "把能力放进任务、工具与验证",
    body: "凡是 RAG、agent、reasoning、code、robotics 相关内容，都要问：状态如何表示，工具如何调用，失败如何恢复，结果如何验证。",
    query: "Berkeley LLM Agents reasoning planning tool use code generation verification",
    ask: "请按 Berkeley LLM Agents 的标准，把本章内容转成状态、动作、工具、记忆、验证五栏。",
  },
  {
    id: "open_toolchain",
    source: "Hugging Face LLM Course",
    title: "工具链必须能跑起来",
    body: "把抽象概念连接到 Transformers、Datasets、Tokenizers、Accelerate、Hub 或可替代工具，形成可分享 demo 或 notebook。",
    query: "Hugging Face LLM course Transformers Datasets Tokenizers Accelerate demo",
    ask: "请按 Hugging Face LLM Course 的工具链标准，给我这一章的最小 notebook 或 demo 设计。",
  },
];

const TEACHING_LENSES = [
  {
    id: "intuition",
    label: "直觉",
    title: "先建立可讲给别人听的直觉",
    prompt: "请把这章先讲成一段研究生能立刻抓住的直觉解释。",
  },
  {
    id: "mechanism",
    label: "机制",
    title: "再拆开关键机制、公式或系统链路",
    prompt: "请按机制链路解释这章：输入是什么，变换是什么，瓶颈或目标是什么。",
  },
  {
    id: "engineering",
    label: "工程",
    title: "落到代码、实验和部署约束",
    prompt: "请把这章转成工程检查表：该实现什么，观察什么指标，容易在哪里失败。",
  },
  {
    id: "research",
    label: "研究",
    title: "最后连接论文问题和开放研究方向",
    prompt: "请指出这章对应的前沿论文问题、评测方式和可做的小研究题。",
  },
];

const LECTURE_PACKS = {
  orientation: {
    principles: ["把资料库理解为可复现研究环境：目录负责边界，索引负责定位，笔记负责迁移。", "每章按“核心问题 -> 证据 -> 机制解释 -> 小实验 -> 复盘”的顺序学习。"],
    mechanisms: ["FTS 适合快速定位术语和路径，embedding 适合语义相近问题；二者混合才适合大型资料库。", "引用来源不是装饰，而是防止模型把常识、猜测和资料证据混在一起。"],
    readings: ["先读课程矩阵和目录，再读本章证据卡片，最后把卡住的问题交给导师追问。", "每周固定产出一页学习地图：本周概念、来源路径、实验记录、仍未解决的问题。"],
  },
  math_pytorch_nlp: {
    principles: ["大模型的第一语言是张量形状：batch、sequence、hidden、head 维度必须能在脑中流动。", "语言建模把文本转成 token 序列，再通过 next-token prediction 学习条件分布。"],
    mechanisms: ["反向传播不是抽象公式：loss 对 logits、embedding、attention 权重的梯度共同决定表示如何移动。", "Tokenizer 的压缩率直接影响上下文预算，多语言和代码场景尤其明显。"],
    readings: ["先复现一个小训练循环，再读 CS224N/深度学习材料里的 embedding 与语言模型章节。", "实验：换 tokenizer 或 vocab 后比较同一段中英文/代码文本的 token 数。"],
  },
  transformer_gpt_llama: {
    principles: ["Decoder-only LLM 是自回归概率模型：每个位置只能基于过去 token 预测下一个 token。", "现代 LLaMA 系结构是在标准 Transformer 上围绕稳定性、上下文和推理效率做系统取舍。"],
    mechanisms: ["Attention 的核心是 QK^T 形成内容寻址，mask 保证不泄露未来，softmax 决定信息混合权重。", "RoPE 把相对位置信息注入 Q/K 相似度；RMSNorm 与 SwiGLU 改善训练稳定性和表达效率。"],
    readings: ["按 CS336 路线：tokenizer -> attention -> MLP -> residual/norm -> sampling。", "实验：手写单头 attention，打印 mask 前后 logits 与 attention map。"],
  },
  llm_training_scaling_data: {
    principles: ["预训练是模型容量、数据质量、token 数、算力预算之间的联合优化。", "Scaling law 是预算分配工具，不是替代数据治理和评测的魔法公式。"],
    mechanisms: ["数据去重和质量过滤减少冲突梯度；课程式混合决定模型先学基础模式还是专业能力。", "MoE 用稀疏激活提高容量效率，代价是路由、通信和负载均衡复杂度。"],
    readings: ["先读 CS336 data/scaling，再读 DeepSeek 类架构材料，最后把每个设计映射到成本或质量指标。", "实验：写一个 1B 级训练计划，明确数据比例、token 预算、checkpoint eval。"],
  },
  sft_peft_lora: {
    principles: ["后训练不是灌知识，而是改变模型在任务格式、偏好和安全边界下调用已有能力的方式。", "SFT 决定基本指令遵循，偏好优化决定回答风格和取舍。"],
    mechanisms: ["Loss masking 控制哪些 token 真正参与学习；LoRA 通过低秩增量近似权重更新。", "QLoRA 的节省来自冻结量化基座，只训练少量 adapter 参数。"],
    readings: ["先看数据模板和 loss，再比较 full FT、LoRA、QLoRA、adapter 的更新范围。", "实验：构造 100 条 instruction 数据，检查训练前后同一问题的格式、事实和拒答变化。"],
  },
  inference_systems: {
    principles: ["推理系统的主要瓶颈常常不是 FLOPs，而是内存带宽、KV cache、调度和批处理。", "Prefill 是并行大矩阵计算，decode 是逐 token 小批量延迟瓶颈。"],
    mechanisms: ["FlashAttention 是 exact attention 的 IO-aware 算法：分块、在线 softmax、减少 HBM/SRAM 读写。", "PagedAttention/vLLM 把 KV cache 管理做成系统问题，减少碎片并提高批处理吞吐。"],
    readings: ["按 CS336 systems 路线读 FlashAttention、parallelism、serving，再看 vLLM 设计。", "实验：估算 7B 模型在不同 batch/sequence 下的 KV cache 显存。"],
  },
  alignment_rlhf_eval: {
    principles: ["对齐是数据、目标函数、参考模型、评测和安全策略共同构成的系统。", "高 benchmark 分数不能替代回归测试和真实用户场景评估。"],
    mechanisms: ["Reward model 把偏好对转成标量信号；DPO 直接用偏好对优化策略相对参考模型的概率。", "安全评测要覆盖拒答、越狱、幻觉、偏见和工具滥用，不能混在能力分数里。"],
    readings: ["先读 RLHF/PPO/DPO 基本目标，再看 HELM、OpenAI Evals 或本地 eval harness。", "实验：为学习助手写 10 个能力题和 10 个幻觉/安全回归题。"],
  },
  rag_agents: {
    principles: ["RAG 的核心不是接向量库，而是资料治理、召回质量、上下文压缩和引用约束。", "Agent 的价值来自可审计工具调用和状态管理，不是无限自主。"],
    mechanisms: ["Chunk 粒度影响召回和上下文噪声；rerank 决定有限窗口里放哪些证据。", "ReAct 通过 thought/action/observation 循环，把推理和外部工具反馈交替起来。"],
    readings: ["参考 Berkeley LLM Agents：foundation abilities、tools、memory、planning、applications。", "实验：固定 5 个问题，比较 FTS、semantic、rerank 后的来源质量。"],
  },
  vlm_multimodal: {
    principles: ["VLM 的关键是让视觉表示进入语言模型可操作的语义空间。", "图文对齐、视觉编码器、连接器和指令数据共同决定多模态能力。"],
    mechanisms: ["ViT 把图像切成 patch token；CLIP 用对比学习对齐图文；LLaVA 用投影层连接视觉特征和 LLM。", "OCR、空间关系和细粒度定位是 VLM 评测里最容易暴露短板的能力。"],
    readings: ["先读 ViT/CLIP，再读 BLIP-2/LLaVA，最后看 VQA 与多模态 instruction tuning。", "实验：设计 5 个会让 VLM 混淆空间关系或文字识别的问题。"],
  },
  streaming_video_vlm: {
    principles: ["在线视频理解要处理不断到来的帧、有限上下文和实时延迟。", "长视频不是更多帧，而是事件抽象、状态更新和记忆压缩。"],
    mechanisms: ["短期缓存保留局部运动，长期摘要保留事件；帧选择策略决定计算是否浪费在冗余画面。", "在线 benchmark 要测模型在观察过程中的答案更新，而不只是最终离线答案。"],
    readings: ["读 StreamingBench/online video 任务，关注 temporal reasoning、state change、causal order。", "实验：为第一视角视频写 10 个必须依赖历史状态的问题。"],
  },
  vla_robotics: {
    principles: ["VLA 把语言和视觉理解变成动作条件，输出不再只是文本而是会改变环境的策略。", "机器人任务的难点是数据分布、动作空间、控制频率和安全约束。"],
    mechanisms: ["Action tokenization 把连续控制转成模型可预测的离散或结构化输出。", "Fine-tuning 要同时看成功率、泛化、失败轨迹和物理安全。"],
    readings: ["按 OpenVLA/RT-2/Octo/pi0 路线读：输入表示、动作接口、数据集、评测。", "实验：定义一个 manipulation 任务的 observation、instruction、action 和 success metric。"],
  },
  robot_sim_data: {
    principles: ["仿真和数据决定机器人实验能否复现，模型只是其中一个变量。", "成功率必须和任务分布、种子、资产版本、失败案例一起报告。"],
    mechanisms: ["Sim-to-real gap 来自物理、视觉、控制器和任务分布不一致。", "Demonstration 数据覆盖不足会让策略记住场景而不是学到可迁移技能。"],
    readings: ["比较 ManiSkill、Isaac Lab、RoboCasa、RLBench、robosuite 的任务生态和复现成本。", "实验：为一个模拟器写环境版本、初始状态分布、评测脚本和失败记录模板。"],
  },
  world_models: {
    principles: ["世界模型学习环境动力学，使智能体可以在潜空间想象未来并训练策略。", "像素逼真不等于可规划；控制任务更看重状态是否可预测、可干预。"],
    mechanisms: ["Dreamer 学 latent dynamics 并在 imagination rollout 中训练 actor-critic。", "MuZero 学可用于搜索的模型，不需要完全重构真实观察。"],
    readings: ["先读 World Models/Dreamer/MuZero，再看 V-JEPA、JEPA-WM、Genie 的预测表征路线。", "实验：画出观察 -> latent -> dynamics -> reward/value -> policy 的数据流。"],
  },
  driving_world_models: {
    principles: ["驾驶 world model 必须服务规划和安全，不能只追求视频生成质量。", "闭环评测比开环预测更能暴露累积错误和危险动作。"],
    mechanisms: ["未来场景生成需要保持道路结构、交通参与者运动和相机几何一致。", "动作会改变未来状态，所以规划模型要能评估候选动作的后果。"],
    readings: ["读 GAIA-1、DriveDreamer、Vista、Waymax、DriveLM/OpenEMMA，区分生成、规划和语言推理角色。", "实验：设计一个危险切入场景，列出开环指标和闭环指标。"],
  },
  diffusion_video_3d: {
    principles: ["扩散、flow matching、视频和 3D 表示是现代生成式世界建模的基础工具。", "生成质量、采样速度、控制性和几何一致性必须一起评估。"],
    mechanisms: ["Diffusion 通过加噪/去噪学习 score 或噪声预测；flow matching 学连续变换路径。", "NeRF/3DGS 把多视角图像转成可渲染空间表示，支持新视角和几何推理。"],
    readings: ["参考 MIT 6.S978：VAE/GAN/diffusion/autoregressive/flow 的统一生成视角。", "实验：比较 DDPM 与 flow matching 的训练目标，并画 latent diffusion pipeline。"],
  },
  omni_audio_capstone: {
    principles: ["全模态系统的目标是统一多种输入输出，而不是堆更多模型名。", "Capstone 要提出可验证假设，并用数据、baseline、评测和风险约束它。"],
    mechanisms: ["音频/语音模型需要处理时间连续性、说话人、语义和生成质量。", "多模态消融能证明某个模态是否真的提供独立增益。"],
    readings: ["读 Qwen3-Omni、SLAM-LLM、SenseVoice、CosyVoice 等方向，关注接口和评测。", "实验：写一页 proposal，包括问题、数据、模型路线、baseline、指标、风险和算力预算。"],
  },
};

const SEMINAR_GUIDES = {
  orientation: {
    question: "如何把 83 万知识片段变成一套可持续学习的研究系统？",
    model: "目录给边界，FTS 给定位，证据篮给可追踪来源，笔记给长期迁移。",
    board: ["资料库不是答案机，而是实验室。", "学习闭环：定位 -> 精读 -> 解释 -> 产出 -> 复盘。", "每次问导师前，先给它一条可引用证据。"],
  },
  math_pytorch_nlp: {
    question: "为什么大模型学习必须从张量、优化和语言建模目标开始？",
    model: "文本先变成 token，token 进入 embedding，训练循环用 loss 和梯度不断移动表示空间。",
    board: ["形状是第一种调试语言。", "Tokenizer 决定上下文预算。", "训练循环最小闭环：batch -> logits -> loss -> backward -> step。"],
  },
  transformer_gpt_llama: {
    question: "Decoder-only Transformer 如何把上下文变成下一个 token 的分布？",
    model: "Q/K 做内容寻址，V 承载被混合的信息，causal mask 保证自回归，MLP 与残差层累积可组合特征。",
    board: ["Attention = 内容寻址，不是神秘注意力。", "Mask 保护训练/推理一致性。", "LLaMA 改动要放进稳定性、上下文和推理效率里理解。"],
  },
  llm_training_scaling_data: {
    question: "现代 LLM 预训练如何在数据、模型、算力和架构之间分配预算？",
    model: "Scaling law 给预算直觉，数据治理给有效 token，MoE/MLA/长上下文设计给效率边界。",
    board: ["好数据会改变每单位 compute 的价值。", "MoE 是容量效率，不是免费扩参。", "每个 checkpoint 都应该服务一个评测问题。"],
  },
  sft_peft_lora: {
    question: "如何把预训练模型变成遵循任务格式和人类偏好的助手？",
    model: "SFT 教格式和行为，LoRA/QLoRA 控制更新成本，偏好优化再调整回答取舍。",
    board: ["后训练不是灌知识。", "Loss mask 决定模型应该学谁的话。", "LoRA 的 rank、target module 和数据质量同样关键。"],
  },
  inference_systems: {
    question: "为什么大模型推理常常慢在内存、调度和 KV cache，而不是只慢在算力？",
    model: "Prefill 像并行矩阵计算，decode 像逐 token 服务系统；FlashAttention、PagedAttention、batching 都是在管 IO 和状态。",
    board: ["区分 prefill 与 decode。", "FlashAttention 是 exact attention 的 IO-aware 实现。", "吞吐、延迟、显存必须一起算。"],
  },
  alignment_rlhf_eval: {
    question: "对齐、偏好优化和评测如何共同约束模型行为？",
    model: "偏好数据定义取舍，优化目标改变策略，评测和安全回归决定能否上线。",
    board: ["Benchmark 分数不是部署许可。", "DPO 直接优化偏好对。", "能力、安全、回归测试要分开。"],
  },
  rag_agents: {
    question: "怎样让模型从闭卷生成变成有证据、有工具、有行动边界的系统？",
    model: "RAG 管证据，rerank 管上下文预算，Agent 管工具行动和状态恢复。",
    board: ["RAG 难在资料治理和引用约束。", "ReAct = 推理与行动交替。", "Agent 权限必须可审计。"],
  },
  vlm_multimodal: {
    question: "视觉表示如何进入语言模型，并变成可解释的图文推理？",
    model: "ViT 提供视觉 token，CLIP 建立图文空间，连接器把视觉特征映射到 LLM 可使用的语义接口。",
    board: ["图文对齐决定能不能用。", "连接器不是小细节。", "OCR、空间关系、细粒度定位是常见短板。"],
  },
  streaming_video_vlm: {
    question: "在线视频理解为什么不能只靠把更多帧塞进上下文？",
    model: "流式系统必须选择帧、压缩记忆、更新状态，并在延迟预算内回答时间和因果问题。",
    board: ["长视频的核心是事件抽象。", "记忆分短期缓存和长期摘要。", "在线评测要看过程更新。"],
  },
  vla_robotics: {
    question: "当输出从文本变成动作，VLM 会变成怎样的机器人策略？",
    model: "VLA 把视觉、语言指令和动作空间接到同一个策略接口，评测标准从答得对变成做得成。",
    board: ["动作空间定义决定模型接口。", "数据分布比模型名字更关键。", "成功率必须结合失败轨迹。"],
  },
  robot_sim_data: {
    question: "机器人学习为什么离不开仿真、数据协议和可复现实验？",
    model: "模拟器定义任务和物理近似，数据集定义分布覆盖，评测协议定义结果是否可信。",
    board: ["仿真成功不等于真实成功。", "报告成功率要带种子和任务分布。", "失败案例是数据资产。"],
  },
  world_models: {
    question: "世界模型如何让智能体在潜空间里想象、规划和学习？",
    model: "表征把观察压成状态，动力学预测未来，策略在想象 rollout 中学习或在搜索中评估动作。",
    board: ["像素逼真不等于可规划。", "Dreamer 用想象训练策略。", "MuZero 用模型辅助搜索。"],
  },
  driving_world_models: {
    question: "自动驾驶 world model 如何同时服务场景生成、规划和安全评测？",
    model: "驾驶世界模型必须保持道路、交通参与者、相机几何和动作后果一致，闭环评测比像素质量更重要。",
    board: ["驾驶不是普通视频生成。", "动作会改变未来。", "闭环指标暴露累积风险。"],
  },
  diffusion_video_3d: {
    question: "扩散、flow matching、视频生成和 3D 表示如何组成空间智能工具箱？",
    model: "扩散/flow 学生成路径，视频模型学习时序，NeRF/3DGS 提供可渲染空间结构。",
    board: ["生成质量要和速度、控制性一起看。", "Latent diffusion 把生成搬到压缩空间。", "3D 表示提供几何一致性。"],
  },
  omni_audio_capstone: {
    question: "如何把整条学习路径收束成一个可评测的全模态研究项目？",
    model: "Capstone 要把问题、数据、模态、模型、baseline、评测和风险写成可执行研究计划。",
    board: ["不要写模型名清单。", "每个模态都要证明增量。", "Proposal 必须有可验证假设。"],
  },
};

const el = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const { timeoutMs = 0, ...fetchOptions } = options;
  const headers = fetchOptions.body ? { "Content-Type": "application/json", ...(fetchOptions.headers || {}) } : fetchOptions.headers || {};
  const bases = [activeApiBase, ...API_CANDIDATES.filter((base) => base !== activeApiBase)];
  const failures = [];
  for (const base of bases) {
    const controller = timeoutMs > 0 ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const res = await fetch(`${base}/${path}`, { ...fetchOptions, headers, signal: controller ? controller.signal : fetchOptions.signal });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      activeApiBase = base;
      return res.json();
    } catch (err) {
      failures.push(`${base}: ${err.name === "AbortError" ? "timeout" : err.message}`);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw new Error(failures.join("；"));
}

function startApiWarmup() {
  if (state.apiWarmupStarted) return;
  state.apiWarmupStarted = true;
  const warm = () => {
    if (!document.hidden) api("ping").catch(() => {});
  };
  const warmStatic = () => {
    Promise.all([loadStaticEvidence(), loadStaticSearchIndex()]).catch(() => {});
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(warmStatic, { timeout: 1200 });
  } else {
    setTimeout(warmStatic, 150);
  }
  setTimeout(warm, 600);
  setTimeout(() => {
    if (!document.hidden) warmStatic();
  }, 900);
  setInterval(warm, 25000);
}

async function loadStaticEvidence() {
  if (state.staticEvidence) return state.staticEvidence;
  if (!state.staticEvidencePromise) {
    state.staticEvidencePromise = fetch(`./course_evidence.json?v=${APP_VERSION}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        state.staticEvidence = data;
        return data;
      })
      .catch(() => null);
  }
  return state.staticEvidencePromise;
}

async function loadStaticSearchIndex() {
  if (state.staticSearchIndex) return state.staticSearchIndex;
  if (!state.staticSearchIndexPromise) {
    state.staticSearchIndexPromise = fetch(`./search_index.json?v=${APP_VERSION}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        state.staticSearchIndex = prepareStaticSearchIndex(data);
        state.staticIndexReadyAt = performance.now();
        if (el("retrievalStatus") && /连接中|离线|检查中/.test(el("retrievalStatus").textContent)) {
          el("retrievalStatus").textContent = `检索：本地索引 ${state.staticSearchIndex.items.length}`;
        }
        return state.staticSearchIndex;
      })
      .catch(() => {
        state.staticSearchIndex = { items: [] };
        return state.staticSearchIndex;
      });
  }
  return state.staticSearchIndexPromise;
}

function prepareStaticSearchIndex(data) {
  const items = data && Array.isArray(data.items) ? data.items : [];
  items.forEach((item) => {
    const modules = Array.isArray(item.modules) ? item.modules : [];
    item._moduleSet = new Set(modules);
    item._titleLower = String(item.title || "").toLowerCase();
    item._pathLower = String(item.path || "").toLowerCase();
    item._categoryLower = String(item.category || "").toLowerCase();
    item._excerptLower = String(item.excerpt || "").toLowerCase();
    item._searchText = `${item._titleLower} ${item._pathLower} ${item._categoryLower} ${item._excerptLower}`;
  });
  return { ...(data || {}), items };
}

async function staticLessonFor(moduleId) {
  const data = await loadStaticEvidence();
  return data && data.modules ? data.modules[moduleId] : null;
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNumber(value) {
  if (typeof value !== "number") return "-";
  return new Intl.NumberFormat("zh-CN", { notation: value > 9999 ? "compact" : "standard" }).format(value);
}

function saveDone() {
  localStorage.setItem("llmRoadDone", JSON.stringify([...state.done]));
}

function saveNotes() {
  localStorage.setItem("llmRoadNotes", JSON.stringify(state.notes));
}

function saveMastery() {
  localStorage.setItem("llmRoadMastery", JSON.stringify(state.mastery));
}

function saveQuizAnswers() {
  localStorage.setItem("llmRoadQuizAnswers", JSON.stringify(state.quizAnswers));
}

function savePinnedSources() {
  localStorage.setItem("llmRoadPinnedSources", JSON.stringify(state.pinnedSources));
}

const BLACKBOARD_NOTES = {
  orientation: {
    title: "学习系统 = 路径 + 证据 + 产出 + 复盘",
    formula: "learning_gain = route_quality x evidence_quality x practice_feedback",
    interpretation: "只收藏资料不会形成能力；每章都要把证据转成可检查作品，再用复盘修正下一章的阅读策略。",
  },
  math_pytorch_nlp: {
    title: "语言建模的最小闭环",
    formula: "tokens -> embeddings -> logits -> cross_entropy(logits, next_token)",
    interpretation: "先能追踪每个张量的形状，再谈模型规模；shape 错误通常比概念错误更早暴露理解漏洞。",
  },
  transformer_gpt_llama: {
    title: "Decoder-only Transformer 数据流",
    formula: "p(x_t | x_<t) = softmax(W_o * Block_L(...Block_1(E[x] + pos)))",
    interpretation: "mask 决定可见信息，attention 决定信息混合，MLP 决定非线性变换，残差和归一化决定训练稳定性。",
  },
  llm_training_scaling_data: {
    title: "预训练预算方程",
    formula: "quality ~= f(model_params, tokens, data_mix, compute, eval_feedback)",
    interpretation: "Scaling law 给预算分配方向，数据质量和评测闭环决定这些预算是否真正转化为能力。",
  },
  sft_peft_lora: {
    title: "后训练的更新范围",
    formula: "W' = W + delta_W, delta_W_lora = B * A, rank(A,B) << rank(W)",
    interpretation: "LoRA 的核心不是神秘技巧，而是用低秩增量改变任务行为，同时保留大部分预训练权重。",
  },
  inference_systems: {
    title: "推理延迟拆解",
    formula: "latency = prefill_compute + decode_memory_io + scheduling_overhead",
    interpretation: "FlashAttention、KV cache、batching 和并行策略都在改变这个式子里的某一项。",
  },
  alignment_rlhf_eval: {
    title: "偏好优化的对照视角",
    formula: "policy_update = improve(preferred > rejected) while staying near reference",
    interpretation: "对齐不是让模型更会背答案，而是在参考模型附近改变取舍、语气、安全边界和拒答行为。",
  },
  rag_agents: {
    title: "RAG/Agent 的可审计链路",
    formula: "question -> retrieve -> rerank -> compress -> answer -> cite -> verify",
    interpretation: "每一步都可能失败；优秀系统要能指出证据从哪里来、为什么被选中、如何被回答使用。",
  },
  vlm_multimodal: {
    title: "视觉语言对齐",
    formula: "image_patches -> visual_encoder -> projector -> LLM_context -> text_or_action",
    interpretation: "VLM 的难点在接口：视觉特征如何变成语言模型能推理、能引用、能执行的上下文。",
  },
  streaming_video_vlm: {
    title: "在线视频状态更新",
    formula: "state_t = update(memory_t-1, selected_frames_t, query)",
    interpretation: "流式理解不是把所有帧塞进上下文，而是持续选择、压缩和更新对任务有用的状态。",
  },
  vla_robotics: {
    title: "从理解到行动",
    formula: "policy(action_t | image_t, language, history) -> environment_t+1",
    interpretation: "VLA 的输出会改变世界，所以评测必须看闭环成功率、失败轨迹和安全约束。",
  },
  robot_sim_data: {
    title: "可复现实验协议",
    formula: "result = policy x task_distribution x simulator_version x seed x metric",
    interpretation: "机器人结果不能脱离环境版本、任务分布和评测脚本，否则同一个成功率没有比较意义。",
  },
  world_models: {
    title: "世界模型与想象 rollout",
    formula: "latent_state -> predict(next_state, reward) -> plan(action)",
    interpretation: "世界模型的价值在于让智能体在内部模拟后果，但模型误差会沿规划链路累积。",
  },
  driving_world_models: {
    title: "驾驶闭环评测",
    formula: "action_t changes scenario_t+1; open_loop_score != closed_loop_safety",
    interpretation: "驾驶系统必须让动作影响未来，才能暴露恢复能力、长尾风险和连锁错误。",
  },
  diffusion_video_3d: {
    title: "生成模型统一视角",
    formula: "noise/data path + score_or_velocity_field + sampler -> generated_sample",
    interpretation: "扩散、flow 和 3D 表示都在建模从潜变量到可观测世界的路径，只是参数化和约束不同。",
  },
  omni_audio_capstone: {
    title: "Capstone 研究设计",
    formula: "claim = task + data + baseline + metric + ablation + risk",
    interpretation: "一个前沿题目必须能被证伪：没有 baseline、指标和消融，就只是方向描述。",
  },
};

const GLOSSARY_NOTES = {
  "KV cache": "推理时缓存历史 token 的 Key/Value，避免每步重复计算过去上下文。",
  FlashAttention: "IO-aware exact attention，通过分块和在线 softmax 减少 HBM 读写。",
  RoPE: "旋转位置编码，把相对位置信息注入 Q/K 的相似度计算。",
  RMSNorm: "只按均方根归一化激活，常用于 LLaMA 系结构以提升稳定性和效率。",
  SwiGLU: "门控 MLP 变体，用更强非线性提高 Transformer FFN 表达能力。",
  MoE: "稀疏专家模型，每个 token 只激活部分专家以提升容量效率。",
  MLA: "Multi-head Latent Attention，用低维潜表示压缩 KV 以改善推理成本。",
  SFT: "监督微调，用指令-回答样本塑造基本任务格式和响应习惯。",
  LoRA: "低秩适配方法，只训练低秩增量参数来改变模型行为。",
  QLoRA: "在量化基座上训练 LoRA adapter，以更低显存完成微调。",
  RLHF: "用人类偏好训练 reward/policy，让模型输出更符合偏好和安全要求。",
  DPO: "直接偏好优化，不显式训练 reward model，直接用偏好对更新策略。",
  RAG: "检索增强生成，把外部证据放入上下文并要求回答引用来源。",
  ReAct: "让模型交替进行推理、行动和观察，适合工具调用和任务执行。",
  Agent: "具备状态、工具、计划和反馈循环的大模型系统。",
  ViT: "把图像分成 patch token 后用 Transformer 编码视觉信息。",
  CLIP: "用图文对比学习把图像和文本投到共同语义空间。",
  LLaVA: "典型视觉语言助手路线，用视觉编码器和投影层连接 LLM。",
  OpenVLA: "视觉-语言-动作模型路线，把多模态理解接到机器人动作策略。",
  Dreamer: "在潜空间学习世界模型并通过想象 rollout 做强化学习。",
  MuZero: "学习可用于规划的动态模型，不需要显式还原完整环境状态。",
  NeRF: "用神经场表示 3D 场景，可从新视角渲染图像。",
  "3D Gaussian Splatting": "用 3D 高斯显式表示场景，支持高效新视角渲染。",
  "Flow matching": "学习把简单分布连续变换到数据分布的速度场。",
};

function glossaryText(concept) {
  return GLOSSARY_NOTES[concept] || `${concept} 是本章的核心抓手；学习时要说清它的输入、输出、约束、指标和失败模式。`;
}

function lectureManuscriptFor(module, bp, pack) {
  const anchors = COURSE_ANCHORS[module.id] || COURSE_ANCHORS.orientation;
  const blackboard = BLACKBOARD_NOTES[module.id] || BLACKBOARD_NOTES.orientation;
  const conceptLine = bp.concepts.slice(0, 5).join("、");
  const firstRoute = bp.route[0] || ["先看问题", bp.thesis];
  const secondRoute = bp.route[1] || ["再看机制", pack.mechanisms[0]];
  const paragraphs = [
    `本章先抓一个主问题：${bp.thesis} 你不要从模型名开始学，而要先问：输入是什么、内部状态如何变化、优化目标或系统约束是什么、最后用什么证据判断它真的有效。`,
    `从机制上看，${pack.mechanisms[0]} 这句话应当被拆成可画在黑板上的链路：${firstRoute[0]}，然后${secondRoute[0]}。如果你只能复述术语，却画不出链路，说明还停留在资料浏览层。`,
    `从世界级课程的学习方式看，${anchors[0]} ${anchors[1] || ""} 本页把它们压缩成一套本地路线：先读讲义建立框架，再用证据精读验证细节，最后用作业和口试逼近真实掌握。`,
    `本章最应该反复使用的概念是 ${conceptLine}。每个概念都要能回答四个问题：它解决什么瓶颈、用什么假设换取收益、在哪些数据或系统条件下会失败、如何通过实验或评测发现失败。`,
    `学习动作要非常具体：${pack.readings[0]} 然后完成本章产出物「${module.project}」。完成以后再问导师，不是让导师替你学习，而是让它检查你的证据链、推导漏洞和实验设计。`,
  ];
  const checkpoints = [
    ["一句话", `我能否不用术语讲清：${bp.thesis}`],
    ["黑板图", `我能否画出：${blackboard.formula}`],
    ["反例", bp.misconceptions[0] || "我能否指出一种会让本章方法失败的场景？"],
    ["作品", `我是否完成了可检查产出：${module.project}`],
  ];
  return {
    title: `${module.stage}｜${module.title}：一节可独立阅读的主讲义`,
    paragraphs,
    blackboard,
    glossary: bp.concepts.slice(0, 6).map((concept) => [concept, glossaryText(concept)]),
    checkpoints,
    searchQuery: module.queries.slice(0, 4).join(" ") || module.title,
    askPrompt: `请作为“大模型学习之路”的课程教授，围绕本章主讲义答疑。\n章节：${module.title}\n核心论断：${bp.thesis}\n黑板式：${blackboard.formula}\n我的问题是：`,
  };
}

function workedExampleFor(module, bp, pack, manuscript) {
  const main = bp.concepts[0] || module.title;
  const supporting = bp.concepts[1] || main;
  const failure = bp.misconceptions[0] || "只看平均结果，忽略失败样例和边界条件。";
  const mechanism = pack.mechanisms[0] || bp.frame;
  return {
    title: `${module.stage}｜Worked Example：把 ${main} 学成一个可复现实验`,
    problem: `给定一个围绕「${main}」的小研究问题：如何证明它真的解决了「${supporting}」相关瓶颈，而不是只在术语上看起来合理？`,
    steps: [
      ["定义对象", `先写清输入、状态、输出和约束。黑板式是：${manuscript.blackboard.formula}`],
      ["拆机制", `把机制拆成可检查链路：${mechanism} 每一步都要能指出它读写什么信息。`],
      ["设 baseline", `至少设置一个朴素 baseline：不用 ${main}、替换 ${supporting}，或把关键组件关掉。`],
      ["找反例", `主动构造失败场景：${failure} 反例不是扣分项，而是判断你是否真的理解边界。`],
    ],
    experiment: [
      ["输入", `选 3 个代表性样例：一个简单样例、一个长上下文/复杂样例、一个故意困难的反例。`],
      ["变量", `只改变一个变量：${main} 是否启用，或 ${supporting} 的实现方式。`],
      ["指标", "记录准确性/延迟/显存/成功率/引用质量中的一个主指标，再保存 2 个失败样例。"],
      ["结论", `用一句话解释结果是否支持本章判断：${bp.thesis}`],
    ],
    rubric: [
      ["A", "有变量、有 baseline、有失败样例，并能把结果连接回机制。"],
      ["B", "能跑出结果，但 baseline 或失败分析不够清楚。"],
      ["Redo", "只复述概念，没有可检查输入、指标或反例。"],
    ],
    searchQuery: `${main} ${supporting} baseline ablation evaluation`,
    askPrompt: `请像 CS336/研究生课程助教一样审这个 worked example。\n章节：${module.title}\n示范题：围绕 ${main} 证明它如何解决 ${supporting} 相关瓶颈。\n黑板式：${manuscript.blackboard.formula}\n请检查：变量定义、baseline、指标、失败样例和结论是否充分。`,
  };
}

function researchBriefFor(module, bp, pack, worked) {
  const concepts = bp.concepts || module.queries || [];
  const main = concepts[0] || module.title;
  const supporting = concepts[1] || main;
  const risk = bp.misconceptions[0] || "证据不足时把相关性误读成因果性。";
  const query = `${main} ${supporting} ${module.queries.slice(0, 3).join(" ")} benchmark baseline`;
  return {
    title: `${module.stage}｜研究任务书：${module.title}`,
    claim: `证明「${main}」能在本章场景中改善「${supporting}」相关瓶颈，并明确它在哪些条件下会失效。`,
    context: `这份任务书把讲义、证据精读和练习闭环合成一个可提交作品。最终作品不是“学习心得”，而是一个可以被复查的研究小包：问题定义、证据来源、baseline、实验/推导、评测、失败复盘。`,
    specs: [
      ["研究问题", `用一句可证伪的话重写本章判断：${bp.thesis}`],
      ["Baseline", `设置一个不用 ${main} 或替换 ${supporting} 的朴素对照，避免只展示漂亮结论。`],
      ["数据 / 证据", `至少保存 3 条来源：一条课程讲义、一条论文/代码、一条失败或局限证据。优先检索：${query}。`],
      ["方法", `沿用 worked example：${worked.problem} 把变量、输入、输出和关键步骤写清楚。`],
      ["评测指标", "选择一个主指标和两个辅助观察：质量、延迟、显存、成功率、引用准确性或人工评分。"],
      ["失败复盘", `主动解释一个反例：${risk} 写出你下一轮会如何改变数据、模型、检索或评测。`],
    ],
    gates: [
      ["可证伪", "claim 不是口号，至少能被一个 baseline 推翻。"],
      ["可追溯", "每个关键判断都能回到本地资料或实验记录。"],
      ["可复现", "别人能按你的步骤复做最小版本。"],
      ["可迁移", `能说明本章如何连接到：${module.project}`],
    ],
    searchQuery: query,
    askPrompt: `请像人工智能研究生课程教授一样，审阅这份「${module.title}」研究任务书。\n\n研究 claim：证明「${main}」能改善「${supporting}」相关瓶颈，并说明失效条件。\n本章产出物：${module.project}\n常见风险：${risk}\n\n请严格检查：1）claim 是否可证伪；2）baseline 是否足够；3）证据是否覆盖机制和实验；4）指标是否能支撑结论；5）还缺哪些失败样例。`,
  };
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function mechanismSimulatorFor(module, bp, pack) {
  const concepts = bp.concepts || module.queries || [];
  const main = concepts[0] || module.title;
  const supporting = concepts[1] || main;
  const third = concepts[2] || supporting;
  const k = state.mechanismKnobs;
  const claim = clampScore(18 + k.component * 0.34 + k.evidence * 0.32 + k.budget * 0.16 - k.pressure * 0.12);
  const cost = clampScore(12 + k.component * 0.24 + k.evidence * 0.12 + k.budget * 0.35 + k.pressure * 0.14);
  const risk = clampScore(84 - k.evidence * 0.28 - k.budget * 0.12 + k.pressure * 0.32 + (k.component > 72 ? 8 : 0));
  const diagnostic = clampScore(10 + k.evidence * 0.34 + k.pressure * 0.28 + k.component * 0.16 + k.budget * 0.1);
  const verdict =
    risk > 68
      ? `当前设置把「${main}」推到高压力区，适合暴露失败模式；不要急着下结论，先保存反例和误差来源。`
      : claim > 70 && diagnostic > 62
        ? `当前设置已经能支撑一个较强 claim：${main} 可能改善 ${supporting}，但仍要保留 baseline 和消融。`
        : cost > 72
          ? `预算和复杂度偏高，像真实工程系统：先确认收益是否超过实现成本，再决定是否扩大实验。`
          : `这是适合入门的教学设置：先观察 ${main} 如何影响 ${supporting}，再逐步提高证据质量和失败压力。`;
  return {
    title: `${module.stage}｜机制实验台：${main} 如何改变系统行为`,
    scenario: `把本章看成一个可调系统：你正在验证「${main}」是否真的改善「${supporting}」，同时观察预算、证据质量和长尾压力如何改变结论。`,
    controls: [
      ["component", "核心组件强度", `从朴素 baseline 到完整启用 ${main}`],
      ["evidence", "证据 / 数据质量", `来源覆盖、样例多样性和 ${third} 的标注可靠性`],
      ["budget", "上下文 / 算力预算", "可用上下文、显存、实验轮次或评测时间"],
      ["pressure", "失败压力", "长尾样例、分布偏移、噪声输入和安全边界"],
    ],
    metrics: [
      ["claim", "结论可信度", claim, "claim 是否足以进入任务书"],
      ["cost", "实现成本", cost, "系统复杂度、预算和维护负担"],
      ["risk", "残余风险", risk, "失败模式还没有被解释的程度"],
      ["diagnostic", "诊断能力", diagnostic, "实验能否暴露真实机制而非偶然结果"],
    ],
    presets: [
      ["baseline", "Baseline", { component: 20, evidence: 45, budget: 35, pressure: 30 }],
      ["balanced", "平衡实验", { component: 58, evidence: 62, budget: 50, pressure: 42 }],
      ["stress", "压力测试", { component: 72, evidence: 68, budget: 55, pressure: 82 }],
      ["research", "研究设置", { component: 84, evidence: 86, budget: 72, pressure: 64 }],
    ],
    verdict,
    searchQuery: `${main} ${supporting} ${module.queries.slice(0, 2).join(" ")} failure mode ablation`,
    askPrompt: `请作为“大模型学习之路”的教授，解释这个机制实验台的当前设置。\n章节：${module.title}\n核心组件强度：${k.component}/100\n证据/数据质量：${k.evidence}/100\n上下文/算力预算：${k.budget}/100\n失败压力：${k.pressure}/100\n当前观察：${verdict}\n\n请按：1）为什么这些变量会影响结论；2）此时该读哪些证据；3）下一步应该做哪个 baseline 或 ablation 来讲。`,
  };
}

function blueprintFor(module) {
  const fallback = {
    thesis: module.summary,
    frame: `这一章围绕「${module.title}」建立可讲清、可检索、可实践的学习闭环。先抓住问题，再读数据库证据，最后用项目验证。`,
    concepts: module.queries.slice(0, 7),
    route: module.outcomes.map((item, idx) => [`第 ${idx + 1} 步`, item]),
    misconceptions: ["不要只收藏资料，要把资料转成自己的解释。", "不要只问模型，要先定位数据库证据。"],
    checks: [
      [module.outcomes[0] || "本章最重要的能力是什么？", "回到本章目标和项目。", module.summary],
      [module.project, "尝试把任务拆成输入、方法、评测。", "先定义目标，再列资料来源，最后给出可验证产物。"],
    ],
    labSteps: ["定位本章三条证据。", "写下一个机制解释。", "完成项目的最小版本。"],
  };
  return { ...fallback, ...(LESSON_BLUEPRINTS[module.id] || {}) };
}

function seminarFor(module, bp, pack) {
  const guide = SEMINAR_GUIDES[module.id] || {
    question: `怎样系统掌握「${module.title}」？`,
    model: bp.frame,
    board: [bp.thesis, pack.mechanisms[0], module.project],
  };
  const anchors = COURSE_ANCHORS[module.id] || COURSE_ANCHORS.orientation;
  const paragraphs = [
    `这章的核心问题是：${guide.question} 先不要急着查零散名词，而要把它放进整条“大模型学习之路”的位置里：${bp.frame}`,
    `从机制上看，${pack.principles.join(" ")} ${pack.mechanisms.join(" ")} 读任何论文或代码时，都用“输入是什么、变换是什么、瓶颈是什么、如何评测”这四个问题压住细节。`,
    `对齐名课的读法是：${anchors.slice(0, 2).join(" ")} 本网页把这些公开名课的学习方式压缩成本章的讲义、证据精读、练习闭环和研究工作台。`,
    `完成本章的标准不是“看懂了”，而是能交付一个可检查产物：${module.project} 如果这个产物做不出来，就回到证据精读保存来源，再请导师只解释卡住的那一段。`,
  ];
  return {
    ...guide,
    paragraphs,
    studyCycle: [
      ["课前", `先带着问题读：${guide.question}`],
      ["课中", `用黑板框架抓机制：${guide.board[0] || guide.model}`],
      ["课后", `交付可检查作品：${module.project}`],
    ],
    evidenceQuery: module.queries.slice(0, 4).join(" ") || module.title,
    askPrompt: `请像人工智能前沿课程教授一样，围绕「${module.title}」讲一节课。\n\n核心问题：${guide.question}\n黑板框架：${guide.board.join(" / ")}\n本章项目：${module.project}\n\n请按：直觉、机制、工程实验、论文阅读、常见误区来讲。`,
  };
}

function sessionFor(module, bp, pack, seminar) {
  const concepts = bp.concepts || [];
  const queries = module.queries || [];
  const anchor = (COURSE_ANCHORS[module.id] || COURSE_ANCHORS.orientation)[0] || "国际一线课程视角";
  const evidenceQuery = seminar.evidenceQuery || queries.slice(0, 3).join(" ") || module.title;
  return {
    timeline: [
      {
        time: "0-15",
        title: "问题设定",
        body: `先回答「为什么现在必须学这一章」：${bp.thesis} 对齐 ${anchor}，把本章放进完整大模型栈。`,
        query: concepts[0] || module.title,
        ask: `请用研究生课堂开场方式讲清楚「${module.title}」为什么重要，并给出一个真实研究或工程场景。`,
      },
      {
        time: "15-40",
        title: "机制推导",
        body: `${pack.mechanisms[0]} 把它拆成输入、变换、约束、瓶颈和失败模式五栏，避免只背术语。`,
        query: concepts.slice(0, 2).join(" ") || module.title,
        ask: `请按“输入、变换、约束、瓶颈、失败模式”五栏推导「${module.title}」的核心机制。`,
      },
      {
        time: "40-65",
        title: "证据诊断",
        body: `从本地资料库取 2-3 条证据，判断它们分别支持概念、机制还是实验结论。优先检索：${evidenceQuery}。`,
        query: evidenceQuery,
        ask: `请帮我把「${module.title}」的证据分成概念证据、机制证据和实验证据，并说明每类应如何阅读。`,
      },
      {
        time: "65-90",
        title: "作品落地",
        body: `把课堂收束到可检查产物：${module.project} 交付物必须包含假设、来源、最小实验和失败复盘。`,
        query: queries.slice(-2).join(" ") || module.project,
        ask: `请把「${module.project}」拆成 90 分钟后能开始执行的产出模板：目标、步骤、数据、指标、风险。`,
      },
    ],
    artifacts: [
      ["一句话定理", `用一句话写出本章最重要判断：${bp.thesis}`],
      ["机制表", "至少填满“输入 / 变换 / 约束 / 瓶颈 / 失败模式”五列。"],
      ["证据卡", "保存 2 条来源：一条支持机制，一条支持实验或评测。"],
      ["小作品", module.project],
    ],
  };
}

function lessonDashboardFor(module, bp, pack, manuscript, seminar, worked, brief) {
  const anchors = COURSE_ANCHORS[module.id] || COURSE_ANCHORS.orientation;
  const concepts = bp.concepts || module.queries || [];
  const main = concepts[0] || module.title;
  const second = concepts[1] || main;
  const sourceQuery = module.queries.slice(0, 4).join(" ") || module.title;
  return {
    compass: [
      {
        label: "核心问题",
        title: seminar.question,
        body: `这一章先回答一个研究生课级别的问题，而不是背术语：${bp.thesis}`,
        query: main,
        ask: `请用一节课的开场方式解释这个核心问题：${seminar.question}`,
      },
      {
        label: "机制入口",
        title: manuscript.blackboard.title,
        body: `${manuscript.blackboard.formula}。先能画出这条链路，再去读论文细节。`,
        query: concepts.slice(0, 3).join(" ") || module.title,
        ask: `请按黑板推导方式讲清楚：${manuscript.blackboard.formula}`,
      },
      {
        label: "实验验证",
        title: worked.problem,
        body: "每章都要落到 baseline、变量、指标和失败样例；没有实验或口试，就只是看过资料。",
        query: worked.searchQuery,
        ask: worked.askPrompt,
      },
      {
        label: "提交标准",
        title: brief.claim,
        body: `最终作品必须能被复查：${module.project}`,
        query: brief.searchQuery,
        ask: brief.askPrompt,
      },
    ],
    flow: [
      ["01", "抓问题", `先写出本章要证明或解释的判断：${bp.thesis}`],
      ["02", "画机制", `把 ${main} 和 ${second} 放进输入、变换、约束、瓶颈、失败模式五栏。`],
      ["03", "读证据", `优先沿「${sourceQuery}」检索本地资料，并保存支持机制与实验的来源。`],
      ["04", "做作品", `完成：${module.project}`],
      ["05", "过口试", "能讲清反例、baseline、指标和下一步消融，才算真正掌握。"],
    ],
    takeaways: [
      ["一句话定理", bp.thesis],
      ["黑板式", manuscript.blackboard.formula],
      ["最小实验", worked.experiment[1] ? worked.experiment[1][1] : worked.problem],
      ["常见误区", bp.misconceptions[0] || "只会复述术语，无法说明输入、输出、约束和失败条件。"],
    ],
    sourceSpine: [
      ["课程参照", anchors[0] || "国际一线课程视角", sourceQuery],
      ["讲义证据", pack.readings[0] || seminar.evidenceQuery, seminar.evidenceQuery],
      ["机制证据", pack.mechanisms[0] || bp.frame, concepts.slice(0, 3).join(" ")],
      ["评测证据", "查 baseline、benchmark、ablation 和 failure mode，再决定结论是否站得住。", `${sourceQuery} benchmark ablation failure mode`],
    ],
  };
}

function lectureDeckFor(module, bp, pack, manuscript, seminar, worked, brief) {
  const concepts = bp.concepts || module.queries || [];
  const main = concepts[0] || module.title;
  const second = concepts[1] || main;
  const evidenceQuery = seminar.evidenceQuery || module.queries.slice(0, 4).join(" ") || module.title;
  return [
    {
      kicker: "Opening question",
      title: "先把问题立住",
      body: `这节课先回答：${seminar.question} 你要抓住的不是术语清单，而是这条核心判断：${bp.thesis}`,
      board: ["本章问题是什么", "为什么现在必须学", "学完要交付什么"],
      checkpoint: `能否用一句话说明「${module.title}」解决什么问题？`,
      query: main,
      ask: `请像教授开场一样讲清楚：${seminar.question}`,
    },
    {
      kicker: "Intuition",
      title: "建立可迁移直觉",
      body: `直觉层面，把本章放进这条课程线：${bp.frame} 先把 ${concepts.slice(0, 4).join("、")} 读成因果关系，而不是孤立名词。`,
      board: ["对象", main, "桥接概念", second],
      checkpoint: `能否不用公式解释 ${main} 和 ${second} 的关系？`,
      query: concepts.slice(0, 3).join(" ") || module.title,
      ask: `请用直觉方式重讲「${module.title}」，重点解释 ${main} 和 ${second}。`,
    },
    {
      kicker: "Mechanism",
      title: "把机制压到黑板上",
      body: `${pack.mechanisms[0] || bp.frame} 本章黑板式是：${manuscript.blackboard.formula}。你要能解释式子里每个变量对应什么资料、状态、动作或指标。`,
      board: ["输入", "变换", "约束", "瓶颈", "失败模式"],
      checkpoint: `能否画出 ${manuscript.blackboard.title} 并指出一个瓶颈？`,
      query: manuscript.blackboard.formula,
      ask: `请逐项解释这个黑板式：${manuscript.blackboard.formula}`,
    },
    {
      kicker: "Evidence",
      title: "先检索证据，再相信结论",
      body: `本章证据入口是：${evidenceQuery}。阅读时把资料分成概念证据、机制证据、实验证据和局限证据，先保存来源，再请导师解释卡住的片段。`,
      board: ["概念证据", "机制证据", "实验证据", "局限证据"],
      checkpoint: "能否保存两条来源，并说明它们分别支持什么 claim？",
      query: evidenceQuery,
      ask: `请把「${module.title}」的证据阅读顺序拆成 4 步，并说明每步看什么。`,
    },
    {
      kicker: "Lab",
      title: "把理解变成最小作品",
      body: `现在收束到作品：${module.project} 最小版本也必须包含 baseline、一个变量、一个指标、一个失败样例和一次复盘。`,
      board: ["baseline", "变量", "指标", "失败样例", "复盘"],
      checkpoint: `能否今天开始做出「${module.project}」的最小版本？`,
      query: worked.searchQuery || `${module.title} implementation baseline`,
      ask: worked.askPrompt,
    },
    {
      kicker: "Oral exam",
      title: "用口试确认真正掌握",
      body: `最后检查边界：${bp.misconceptions[0] || "不要把顺口解释当作掌握。"} 如果你能讲清反例、baseline、指标和下一步 ablation，才算进入下一章。`,
      board: ["反例", "baseline", "指标", "ablation"],
      checkpoint: "能否说出一个让本章方法失效的场景？",
      query: `${evidenceQuery} failure mode ablation benchmark`,
      ask: `请按严格口试官标准追问我「${module.title}」：反例、baseline、指标和 ablation。`,
    },
  ];
}

function textbookFor(module, bp, pack, manuscript, worked, brief) {
  const concepts = bp.concepts || module.queries || [];
  const main = concepts[0] || module.title;
  const second = concepts[1] || main;
  const third = concepts[2] || second;
  const anchors = COURSE_ANCHORS[module.id] || COURSE_ANCHORS.orientation;
  return {
    title: `${module.stage}｜${module.title}：从直觉到可复现实验`,
    sections: [
      {
        label: "1. 本章为什么重要",
        body: `本章要解决的不是“知道 ${main} 这个名词”，而是把它放进大模型系统的因果链里：${bp.frame} 顶级课程通常不会让学生先背模型名，而是先建立问题、机制、证据和实验之间的约束关系。`,
        query: main,
      },
      {
        label: "2. 核心概念如何连接",
        body: `把本章概念压成一条线：${concepts.slice(0, 5).join(" -> ")}。学习时先问 ${main} 的输入是什么，再问 ${second} 如何改变中间状态，最后问 ${third} 会怎样影响指标、成本或失败模式。`,
        query: concepts.slice(0, 4).join(" ") || module.title,
      },
      {
        label: "3. 机制与黑板推导",
        body: `${pack.mechanisms.join(" ")} 黑板上只保留一个式子：${manuscript.blackboard.formula}。如果你能解释这个式子里每个符号对应的数据、参数、缓存、动作或评测对象，就已经越过了“看过材料”的最低线。`,
        query: manuscript.blackboard.formula,
      },
      {
        label: "4. 工程实现与调试",
        body: `把机制落到工程时，先做最小闭环，再扩大规模。本章最小作品是：${module.project} 你需要写清输入、关键函数、输出、baseline、指标和一个失败样例；否则即使问答模型讲得很好，也无法证明你真正掌握。`,
        query: worked.searchQuery,
      },
      {
        label: "5. 研究阅读与证据",
        body: `推荐按这条阅读顺序推进：${pack.readings.join(" ")} 参考课程包括：${anchors.slice(0, 2).join(" ")} 阅读时每条资料都标注它是支持概念、机制、实验、局限还是工程复现。`,
        query: brief.searchQuery,
      },
      {
        label: "6. 失败模式与边界",
        body: `最常见的误区是：${bp.misconceptions.join(" ")} 顶级课程训练的不是“讲得顺”，而是知道什么时候不能下结论；你必须能提出一个让本章方法失效的场景，并说明下一步如何做 ablation。`,
        query: `${main} ${second} failure mode ablation`,
      },
    ],
    caseStudy: [
      ["场景", `你正在用「${module.title}」解决一个真实研究/工程问题，目标不是证明自己懂了，而是产出可复查作品。`],
      ["Baseline", `先禁用或替换 ${main}，保留其它条件，形成一个朴素对照。`],
      ["变量", `只改变 ${second} 的实现或强度，观察质量、成本、延迟、成功率或引用准确性。`],
      ["结论", `只有当结果能支持「${bp.thesis}」并解释失败样例时，才能进入下一章。`],
    ],
    checks: [
      `能否用 90 秒讲清 ${main} 的输入、变换、约束和失败模式？`,
      `能否画出黑板式：${manuscript.blackboard.formula}？`,
      `能否给出一个 baseline，并说明它为什么公平？`,
      `能否保存两条本地证据，分别支持机制和实验结论？`,
      `能否把本章连接到最终作品：${module.project}？`,
    ],
    matrix: [
      ["概念", `${main} / ${second}`, "讲清定义、输入输出和适用边界"],
      ["机制", manuscript.blackboard.title, "画出数据流、状态变化或优化目标"],
      ["工程", module.project, "做出最小实现、baseline 和失败记录"],
      ["研究", brief.claim, "提出可证伪 claim、指标和消融计划"],
    ],
  };
}

function courseStandardFor(module, bp, pack, manuscript, worked, brief) {
  const concepts = bp.concepts || module.queries || [];
  const main = concepts[0] || module.title;
  const queries = module.queries || [];
  const assignmentQuery = `${queries.slice(0, 3).join(" ") || module.title} baseline benchmark ablation implementation`;
  const prescriptions = {
    concept: {
      title: "先懂概念：用 45 分钟建立这章的心智地图",
      steps: [
        `用一句话写出本章判断：${bp.thesis}`,
        `把 ${concepts.slice(0, 4).join(" / ")} 分成“对象、机制、指标、失败条件”。`,
        `点击 2 个证据按钮，保存一条概念证据和一条机制证据。`,
      ],
      query: concepts.slice(0, 3).join(" ") || module.title,
      ask: `我现在只想先懂概念，请用 45 分钟学习计划讲清「${module.title}」：心智地图、最小术语表、必须读的证据。`,
    },
    builder: {
      title: "动手实现：用 90 分钟做出最小可检查作品",
      steps: [
        `把项目写成输入、函数、输出：${module.project}`,
        `先做 baseline，再只改变 ${main} 相关变量，记录指标和失败样例。`,
        "把关键代码、实验表和一条反例写进学习笔记。",
      ],
      query: worked.searchQuery || assignmentQuery,
      ask: `我想动手实现，请把「${module.project}」拆成 90 分钟可执行实验：文件、函数、baseline、指标、失败记录。`,
    },
    research: {
      title: "研究推进：把本章变成一个可证伪 claim",
      steps: [
        `提出一个能被实验反驳的 claim：${brief.claim}`,
        "检索 baseline、benchmark、ablation、failure mode，避免只做主观总结。",
        "写出一个小研究计划：假设、数据、模型/系统、指标、风险、下一步。",
      ],
      query: brief.searchQuery || assignmentQuery,
      ask: `请把「${module.title}」升级成一个小研究计划：claim、相关工作、baseline、benchmark、ablation、风险。`,
    },
  };
  return {
    benchmarks: COURSE_STANDARD_BENCHMARKS.map((item) => ({
      ...item,
      query: `${item.query} ${queries.slice(0, 2).join(" ")}`,
      ask: `${item.ask}\n\n当前章节：${module.title}\n本章核心：${bp.thesis}\n本章项目：${module.project}`,
    })),
    active: prescriptions[state.studyLevel] || prescriptions.concept,
    assignment: [
      {
        label: "作业题",
        title: `把「${module.title}」做成一份可复查课程作业`,
        body: `提交物必须包含：一句话 claim、机制图、2 条本地证据、一个 baseline、一个失败样例、下一步 ablation。`,
      },
      {
        label: "评分线",
        title: "按顶级课程标准自评",
        body: "A 档：能解释机制并复现实验；B 档：能引用证据并画出机制；C 档：只会复述概念；不及格：没有来源、没有指标、没有失败样例。",
      },
      {
        label: "快速入口",
        title: "先用即时检索找材料",
        body: `推荐查询：${assignmentQuery}`,
        query: assignmentQuery,
      },
    ],
  };
}

function conceptMapFor(module, bp, pack, manuscript, worked, brief) {
  const concepts = bp.concepts || module.queries || [];
  const queries = module.queries || [];
  const main = concepts[0] || module.title;
  const second = concepts[1] || main;
  const third = concepts[2] || second;
  const fourth = concepts[3] || third;
  const evidenceQuery = queries.slice(0, 4).join(" ") || module.title;
  const mechanism = pack.mechanisms[0] || bp.frame;
  return {
    formula: manuscript.blackboard.formula,
    nodes: [
      {
        tone: "foundation",
        label: "先修对象",
        title: main,
        body: `先把 ${main} 当作本章的研究对象：它输入什么、输出什么、为什么会影响整条大模型系统链路。`,
        query: `${main} ${queries[0] || ""}`.trim(),
        ask: `请用先修课方式解释「${main}」：定义、输入输出、和本章为什么相关。`,
      },
      {
        tone: "bridge",
        label: "连接概念",
        title: second,
        body: `${second} 是连接概念和机制的桥。学习时不要只背定义，要能说出它如何改变状态、表示、数据或动作。`,
        query: `${main} ${second}`,
        ask: `请解释「${main}」和「${second}」之间的关系，并给一个本章例子。`,
      },
      {
        tone: "mechanism",
        label: "机制链路",
        title: manuscript.blackboard.title,
        body: `${mechanism} 把它压成黑板式：${manuscript.blackboard.formula}`,
        query: manuscript.blackboard.formula,
        ask: `请按黑板式逐项解释：${manuscript.blackboard.formula}`,
      },
      {
        tone: "evidence",
        label: "证据入口",
        title: third,
        body: `读资料时先判断证据类型：${third} 支持的是概念、机制、实验，还是局限？先定位证据，再让导师解释。`,
        query: evidenceQuery,
        ask: `请把「${module.title}」的本地证据分成概念、机制、实验、局限四类，并告诉我怎么读。`,
      },
      {
        tone: "evaluation",
        label: "评测边界",
        title: fourth,
        body: `如果不能说清指标、baseline 和失败样例，${fourth} 就只是术语。顶级课程会要求你证明结论站得住。`,
        query: `${evidenceQuery} benchmark baseline ablation`,
        ask: `请为「${module.title}」设计 baseline、指标、失败样例和 ablation。`,
      },
      {
        tone: "artifact",
        label: "可交付作品",
        title: module.project,
        body: `最终把概念变成作品：${module.project} 这一步决定你是在学习，还是只是在浏览资料。`,
        query: worked.searchQuery || `${evidenceQuery} implementation`,
        ask: `请把这个作品拆成可以今天开始的任务：${module.project}`,
      },
    ],
    pathway: [
      ["01", "对象", `定义 ${main} 的输入、输出和边界。`, `${main} definition input output`],
      ["02", "状态", `说明 ${second} 如何改变模型、数据、环境或评测状态。`, `${main} ${second}`],
      ["03", "机制", `把机制压缩成：${manuscript.blackboard.formula}`, manuscript.blackboard.formula],
      ["04", "证据", `检索并保存两条来源，判断它们支持哪种结论。`, evidenceQuery],
      ["05", "作品", `完成一个可检查版本：${module.project}`, worked.searchQuery || module.project],
    ],
    debugQuestions: [
      [`我能不能不用模型，用自己的话解释 ${main}？`, main],
      [`如果去掉 ${second}，系统会在哪个指标上退化？`, `${second} ablation benchmark`],
      [`本章最容易误判的结论是什么？`, bp.misconceptions[0] || `${module.title} failure mode`],
      [`哪条证据能支持作品：${module.project}？`, worked.searchQuery || evidenceQuery],
    ],
  };
}

function trackFor(moduleId) {
  return COURSE_TRACKS.find((track) => track.modules.includes(moduleId)) || COURSE_TRACKS[0];
}

function moduleById(id) {
  return state.modules.find((item) => item.id === id) || FALLBACK_MODULES.find((item) => item.id === id);
}

function masteryFor(module, bp) {
  const concept = (bp.concepts && bp.concepts[0]) || module.title;
  return {
    protocol: [
      `用自己的话写出本章一句话判断：${bp.thesis}`,
      `从证据精读中保存 2 条来源，并说明它们分别支持哪个机制或实验结论。`,
      `完成实践任务的最小版本：${module.project}`,
      `记录 1 个失败案例或反例，再写出下一轮要检索的关键词。`,
    ],
    rubric: [
      {
        id: "explain",
        title: "能讲清机制",
        body: `不用照抄术语，能解释 ${concept} 的输入、变换、约束和常见误区。`,
      },
      {
        id: "build",
        title: "有最小作品",
        body: `至少产出一段代码、一个实验计划、一张系统图或一页论文笔记，可被别人复查。`,
      },
      {
        id: "evaluate",
        title: "会设计评测",
        body: `能写出通过标准、失败样例和下一步消融/对比，而不是只说“理解了”。`,
      },
    ],
  };
}

function readingProtocolFor(module, bp) {
  return [
    ["Claim", `先写出资料想回答的问题，并对照本章核心判断：${bp.thesis}`],
    ["Evidence", "保存 2 条来源到证据篮，标注它们分别支持概念、机制、实验还是局限。"],
    ["Mechanism", `把来源里的术语映射回本章概念：${bp.concepts.slice(0, 4).join(" / ")}。`],
    ["Transfer", `把证据转成一个可检查动作：${module.project}`],
  ];
}

function workbenchFor(module, bp) {
  const queries = module.queries || [];
  const concepts = bp.concepts || queries;
  return [
    {
      id: "paper",
      title: "论文阅读线",
      kicker: "Paper trail",
      body: `先用 ${concepts.slice(0, 3).join("、")} 定位核心论文或课程讲义，再写出“问题、方法、证据、局限”四格笔记。`,
      action: "检索论文证据",
      query: queries.slice(0, 3).join(" ") || module.title,
      ask: `请帮我为「${module.title}」制定论文阅读顺序，并说明每篇资料要抓住什么问题。`,
    },
    {
      id: "code",
      title: "代码实验线",
      kicker: "Code lab",
      body: `把本章产出物拆成最小可运行实验：${module.project} 先做 baseline，再记录 shape、指标、失败样例。`,
      action: "检索代码资料",
      query: `${queries[0] || module.title} implementation code notebook`,
      ask: `请把「${module.project}」拆成一个最小代码实验：文件结构、关键函数、输入输出和检查点。`,
    },
    {
      id: "eval",
      title: "评测闭环线",
      kicker: "Eval gate",
      body: `为本章定义至少 3 个检查项：一个概念题、一个实验指标、一个失败案例，避免只看模型回答是否顺眼。`,
      action: "检索评测资料",
      query: `${queries.slice(-2).join(" ") || module.title} benchmark evaluation`,
      ask: `请为「${module.title}」设计一个小型评测表：能力题、失败模式、通过标准和复盘方式。`,
    },
  ];
}

function examFor(module, bp) {
  const concepts = bp.concepts || module.queries || [];
  const keyConcept = concepts[0] || module.title;
  const secondConcept = concepts[1] || module.title;
  return {
    oral: [
      {
        label: "机制口试",
        question: `不用背定义，解释 ${keyConcept} 的输入、变换、约束、瓶颈和一个失败案例。`,
        answer: `合格回答必须把 ${keyConcept} 放回「${module.title}」的系统链路，并能说明它如何影响 ${module.project}。`,
        query: keyConcept,
      },
      {
        label: "实验口试",
        question: `如果只能做一个最小实验，你会怎样验证本章判断：${bp.thesis}`,
        answer: "合格回答要包含 baseline、变量、指标、失败样例和下一步消融，而不是只描述想法。",
        query: `${module.queries[0] || module.title} benchmark evaluation`,
      },
      {
        label: "迁移口试",
        question: `把 ${secondConcept} 迁移到一个新场景时，哪些假设最可能失效？`,
        answer: "合格回答要指出数据分布、算力/延迟、评测协议和安全边界中至少两类风险。",
        query: secondConcept,
      },
    ],
    rubric: [
      ["A", "能独立推导机制，能用本地证据支撑 claim，并完成可复查的小作品。"],
      ["B", "能讲清主要概念和实验方案，但证据链或失败分析还不够完整。"],
      ["C", "能复述术语，但无法说明输入/变换/瓶颈，也没有可靠评测。"],
      ["Redo", "只依赖导师问答，没有保存来源、没有实验产物、没有反例或失败记录。"],
    ],
  };
}

function problemSetFor(module, bp) {
  const concepts = bp.concepts || module.queries || [];
  const queries = module.queries || [];
  const main = concepts[0] || module.title;
  const supporting = concepts[1] || module.title;
  return [
    {
      kind: "P1",
      title: "推导题",
      body: `把 ${main} 写成一页推导：定义输入、状态、目标函数或系统约束，并指出一个会导致结论失效的假设。`,
      deliverable: "一页推导笔记 + 一个反例。",
      query: main,
      ask: `请像课程助教一样审题：我需要完成这道推导题：把 ${main} 写成一页推导，并指出一个会导致结论失效的假设。请给评分要点。`,
    },
    {
      kind: "P2",
      title: "实现题",
      body: `围绕「${module.project}」做最小可运行版本。只允许保留必要输入、核心函数、输出检查和一个 baseline。`,
      deliverable: "最小代码/伪代码 + baseline 对照。",
      query: `${queries[0] || module.title} implementation code`,
      ask: `请把「${module.project}」改写成一个最小实现题：输入、核心函数、输出、baseline、测试用例。`,
    },
    {
      kind: "P3",
      title: "实验题",
      body: `针对 ${supporting} 设计一个 ablation：只改变一个变量，记录指标、失败样例和你对结果的解释。`,
      deliverable: "实验表格 + 失败样例 + 解释。",
      query: `${supporting} ablation benchmark evaluation`,
      ask: `请为 ${supporting} 设计一个 ablation 实验，并列出变量、指标、失败样例和解释模板。`,
    },
    {
      kind: "P4",
      title: "写作题",
      body: `写一段 300-500 字课程笔记，说明本章如何连接到整条“大模型学习之路”，并引用至少两条本地证据。`,
      deliverable: "短论文式笔记 + 2 条证据引用。",
      query: queries.slice(0, 3).join(" ") || module.title,
      ask: `请给我一份「${module.title}」短论文式笔记提纲，要求引用本地证据并连接到整条大模型学习路径。`,
    },
  ];
}

function quizFor(module, bp) {
  const concepts = bp.concepts || module.queries || [];
  const main = concepts[0] || module.title;
  const second = concepts[1] || main;
  const misconception = bp.misconceptions[0] || "只复述术语，不保存证据，也不做最小实验。";
  const evidenceQuery = (module.queries || []).slice(0, 4).join(" ") || module.title;
  return [
    {
      id: "core_claim",
      label: "Q1 / 核心判断",
      question: `学完「${module.title}」后，最应该先能说清什么？`,
      query: main,
      ask: `请围绕「${module.title}」出 3 个核心判断自测题，并给出评分标准。`,
      options: [
        {
          text: `用自己的话解释：${bp.thesis}`,
          correct: true,
          feedback: "对。先抓住本章要证明或解释的核心判断，再进入资料细节。",
        },
        {
          text: `直接背下所有模型名和论文名。`,
          correct: false,
          feedback: "不够。模型名只是索引，不能替代机制、证据和实验判断。",
        },
        {
          text: `先让导师生成一份总结，再跳过证据。`,
          correct: false,
          feedback: "危险。导师可以解释卡点，但本章要求先读证据、再问问题。",
        },
      ],
    },
    {
      id: "mechanism",
      label: "Q2 / 机制理解",
      question: `解释 ${main} 时，哪种回答最接近顶级课程标准？`,
      query: `${main} ${second}`,
      ask: `请按“输入、变换、约束、瓶颈、失败模式”检查我是否真正理解 ${main}。`,
      options: [
        {
          text: `说明它的输入、变换、约束、瓶颈和失败模式。`,
          correct: true,
          feedback: "对。机制理解必须能把概念放进系统链路，而不是只给定义。",
        },
        {
          text: `说它很重要、很前沿、很多论文都在用。`,
          correct: false,
          feedback: "这只是背景，不是机制。缺少输入、变换、约束和失败条件。",
        },
        {
          text: `只引用一个 benchmark 分数。`,
          correct: false,
          feedback: "分数需要机制解释和评测条件，否则很容易误读。",
        },
      ],
    },
    {
      id: "evidence",
      label: "Q3 / 证据阅读",
      question: "遇到读不懂的概念时，正确顺序是什么？",
      query: evidenceQuery,
      ask: `请帮我为「${module.title}」制定证据阅读顺序：先检索什么，再精读什么，最后问什么。`,
      options: [
        {
          text: "先即时检索本地证据，保存来源，再把卡住的片段交给导师解释。",
          correct: true,
          feedback: "对。这样模型回答会被证据约束，学习也能复盘。",
        },
        {
          text: "先问导师要完整答案，证据以后有空再看。",
          correct: false,
          feedback: "这会让问答变成替代学习。当前网页的目标是证据优先、导师辅助。",
        },
        {
          text: "只看第一条搜索结果，不区分概念、机制、实验和局限。",
          correct: false,
          feedback: "不够。证据要分类阅读，否则很难形成可复用知识。",
        },
      ],
    },
    {
      id: "evaluation",
      label: "Q4 / 评测闭环",
      question: `怎样证明自己不是“看过了”，而是真懂「${module.title}」？`,
      query: `${evidenceQuery} baseline benchmark ablation failure mode`,
      ask: `请按严格助教标准检查我是否掌握「${module.title}」：baseline、指标、失败样例和 ablation。`,
      options: [
        {
          text: `完成作品：${module.project}，并写出 baseline、指标、失败样例和下一步 ablation。`,
          correct: true,
          feedback: "对。可交付作品和评测闭环是从“看懂”走向“掌握”的证据。",
        },
        {
          text: `把讲义读完，并感觉自己大概明白了。`,
          correct: false,
          feedback: "感觉不可靠。需要可检查产物、来源和失败样例。",
        },
        {
          text: misconception,
          correct: false,
          feedback: "这正是本章要避开的误区。请回到证据和最小实验。",
        },
      ],
    },
  ];
}

function renderProgress() {
  const total = state.modules.length;
  const done = state.modules.filter((item) => state.done.has(item.id)).length;
  el("progressStatus").textContent = `进度：${done}/${total}`;
  el("progressBar").style.width = total ? `${Math.round((done / total) * 100)}%` : "0%";
  el("markDone").textContent = state.active && state.done.has(state.active.id) ? "取消完成" : "标记完成";
}

function renderModules() {
  const list = el("moduleList");
  list.innerHTML = state.modules
    .map((mod) => {
      const active = state.active && state.active.id === mod.id ? " active" : "";
      const done = state.done.has(mod.id) ? " done" : "";
      return `
        <button class="module-btn${active}${done}" type="button" data-module="${escapeHtml(mod.id)}">
          <span class="module-stage">${escapeHtml(mod.stage)}</span>
          <span class="module-copy">
            <strong>${escapeHtml(mod.title)}</strong>
            <span>${escapeHtml(mod.summary)}</span>
          </span>
        </button>
      `;
    })
    .join("");
  renderProgress();
}

function renderHero() {
  if (!state.active) return;
  el("activeStage").textContent = `Stage ${state.active.stage}`;
  el("activeTitle").textContent = state.active.title;
  el("activeSummary").textContent = state.active.summary;
  el("projectText").textContent = state.active.project;
  el("projectTitle").textContent = `${state.active.stage} 章项目`;
}

function renderGlobalCourseMap() {
  el("globalCourseMap").innerHTML = GLOBAL_COURSE_MAP.map(
    (item) => `
      <article class="global-course-card">
        <div>
          <span>${escapeHtml(item.source)}</span>
          <h4>${escapeHtml(item.title)}</h4>
          <p>${escapeHtml(item.body)}</p>
        </div>
        <div class="global-course-foot">
          <small>${escapeHtml(item.modules.join(" / "))}</small>
          <button class="text-button" type="button" data-course-map-search="${escapeHtml(item.query)}">检索证据</button>
        </div>
      </article>
    `
  ).join("");
}

function renderCourseAtlas() {
  const modules = state.modules.length ? state.modules : FALLBACK_MODULES;
  el("courseAtlas").innerHTML = COURSE_TRACKS.map((track, trackIdx) => {
    const nodes = track.modules
      .map((id, idx) => {
        const item = modules.find((mod) => mod.id === id) || moduleById(id);
        if (!item) return "";
        const active = state.active && state.active.id === item.id ? " active" : "";
        const done = state.done.has(item.id) ? " done" : "";
        const query = (item.queries || []).slice(0, 3).join(" ") || item.title;
        return `
          <article class="atlas-node${active}${done}">
            <button class="atlas-select" type="button" data-track-module="${escapeHtml(item.id)}">
              <span>${escapeHtml(item.stage)}</span>
              <strong>${escapeHtml(item.title)}</strong>
            </button>
            <p>${escapeHtml(item.summary)}</p>
            <div class="atlas-node-foot">
              <small>${String(idx + 1).padStart(2, "0")} / ${String(track.modules.length).padStart(2, "0")}</small>
              <button class="text-button" type="button" data-atlas-search="${escapeHtml(query)}">证据</button>
            </div>
          </article>
        `;
      })
      .join("");
    return `
      <article class="atlas-track track-${trackIdx + 1}">
        <header>
          <span>${String(trackIdx + 1).padStart(2, "0")}</span>
          <div>
            <h4>${escapeHtml(track.title)}</h4>
            <p>${escapeHtml(track.summary)}</p>
          </div>
        </header>
        <div class="atlas-rail">${nodes}</div>
        <footer>${escapeHtml(track.milestone)}</footer>
      </article>
    `;
  }).join("");
}

function renderTeach() {
  if (!state.active) return;
  const bp = blueprintFor(state.active);
  const pack = LECTURE_PACKS[state.active.id] || LECTURE_PACKS.orientation;
  const manuscript = lectureManuscriptFor(state.active, bp, pack);
  const worked = workedExampleFor(state.active, bp, pack, manuscript);
  const simulator = mechanismSimulatorFor(state.active, bp, pack);
  const brief = researchBriefFor(state.active, bp, pack, worked);
  const seminar = seminarFor(state.active, bp, pack);
  const session = sessionFor(state.active, bp, pack, seminar);
  const dashboard = lessonDashboardFor(state.active, bp, pack, manuscript, seminar, worked, brief);
  const lectureDeck = lectureDeckFor(state.active, bp, pack, manuscript, seminar, worked, brief);
  const textbook = textbookFor(state.active, bp, pack, manuscript, worked, brief);
  const standard = courseStandardFor(state.active, bp, pack, manuscript, worked, brief);
  const conceptMap = conceptMapFor(state.active, bp, pack, manuscript, worked, brief);
  const lens = TEACHING_LENSES.find((item) => item.id === state.activeLens) || TEACHING_LENSES[0];
  const track = trackFor(state.active.id);
  const activeIndex = state.modules.findIndex((item) => item.id === state.active.id);
  const prev = activeIndex > 0 ? state.modules[activeIndex - 1] : null;
  const next = activeIndex >= 0 && activeIndex < state.modules.length - 1 ? state.modules[activeIndex + 1] : null;
  const activeLectureIdx = Math.min(Math.max(state.lectureStep, 0), lectureDeck.length - 1);
  state.lectureStep = activeLectureIdx;
  renderGlobalCourseMap();
  renderCourseAtlas();
  el("lessonCompass").innerHTML = dashboard.compass
    .map(
      (item) => `
        <article class="compass-card">
          <span>${escapeHtml(item.label)}</span>
          <h4>${escapeHtml(item.title)}</h4>
          <p>${escapeHtml(item.body)}</p>
          <div class="compass-actions">
            <button class="text-button" type="button" data-briefing-search="${escapeHtml(item.query)}">证据</button>
            <button class="text-button" type="button" data-briefing-ask="${escapeHtml(item.ask)}">请导师追问</button>
          </div>
        </article>
      `
    )
    .join("");
  el("lessonFlow").innerHTML = dashboard.flow
    .map(
      ([step, title, body]) => `
        <article class="flow-step">
          <span>${escapeHtml(step)}</span>
          <div>
            <strong>${escapeHtml(title)}</strong>
            <p>${escapeHtml(body)}</p>
          </div>
        </article>
      `
    )
    .join("");
  el("lessonTakeaways").innerHTML = dashboard.takeaways
    .map(
      ([label, body]) => `
        <article>
          <strong>${escapeHtml(label)}</strong>
          <p>${escapeHtml(body)}</p>
        </article>
      `
    )
    .join("");
  el("lessonSourceSpine").innerHTML = dashboard.sourceSpine
    .map(
      ([label, body, query]) => `
        <article>
          <span>${escapeHtml(label)}</span>
          <p>${escapeHtml(body)}</p>
          <button class="text-button" type="button" data-briefing-search="${escapeHtml(query)}">检索这条线</button>
        </article>
      `
    )
    .join("");
  el("lectureStepList").innerHTML = lectureDeck
    .map(
      (item, idx) => `
        <button class="lecture-step-btn${idx === activeLectureIdx ? " active" : ""}" type="button" data-lecture-step="${idx}">
          <span>${String(idx + 1).padStart(2, "0")}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(item.kicker)}</small>
        </button>
      `
    )
    .join("");
  const activeLecture = lectureDeck[activeLectureIdx];
  el("lectureSlide").innerHTML = `
    <div class="lecture-slide-head">
      <span>${escapeHtml(activeLecture.kicker)}</span>
      <h3>${escapeHtml(activeLecture.title)}</h3>
      <p>${escapeHtml(activeLecture.body)}</p>
    </div>
    <div class="lecture-board">
      ${activeLecture.board.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
    </div>
    <div class="lecture-checkpoint">
      <strong>课堂检查点</strong>
      <p>${escapeHtml(activeLecture.checkpoint)}</p>
    </div>
    <div class="lecture-slide-actions">
      <button class="secondary" type="button" data-lecture-nav="prev" ${activeLectureIdx === 0 ? "disabled" : ""}>上一段</button>
      <button class="secondary" type="button" data-deck-search="${escapeHtml(activeLecture.query)}">检索证据</button>
      <button type="button" data-deck-ask="${escapeHtml(activeLecture.ask)}">问导师</button>
      <button type="button" data-lecture-nav="next" ${activeLectureIdx === lectureDeck.length - 1 ? "disabled" : ""}>下一段</button>
    </div>
  `;
  el("textbookTitle").textContent = textbook.title;
  el("textbookSections").innerHTML = textbook.sections
    .map(
      (item) => `
        <article class="textbook-section">
          <div>
            <h4>${escapeHtml(item.label)}</h4>
            <p>${escapeHtml(item.body)}</p>
          </div>
          <button class="text-button" type="button" data-textbook-search="${escapeHtml(item.query)}">检索证据</button>
        </article>
      `
    )
    .join("");
  el("textbookCase").innerHTML = textbook.caseStudy
    .map(([label, body]) => `<article><strong>${escapeHtml(label)}</strong><p>${escapeHtml(body)}</p></article>`)
    .join("");
  el("textbookChecks").innerHTML = textbook.checks
    .map((item, idx) => `<article><span>${String(idx + 1).padStart(2, "0")}</span><p>${escapeHtml(item)}</p></article>`)
    .join("");
  el("textbookMatrix").innerHTML = textbook.matrix
    .map(
      ([label, title, body]) => `
        <article>
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(body)}</p>
        </article>
      `
    )
    .join("");
  el("standardBenchmarks").innerHTML = standard.benchmarks
    .map(
      (item) => `
        <article class="standard-card">
          <span>${escapeHtml(item.source)}</span>
          <h4>${escapeHtml(item.title)}</h4>
          <p>${escapeHtml(item.body)}</p>
          <div class="standard-actions">
            <button class="text-button" type="button" data-standard-search="${escapeHtml(item.query)}">检索本地证据</button>
            <button class="text-button" type="button" data-standard-ask="${escapeHtml(item.ask)}">导师按此检查</button>
          </div>
        </article>
      `
    )
    .join("");
  document.querySelectorAll("[data-study-level]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.studyLevel === state.studyLevel);
  });
  el("diagnosticTitle").textContent = standard.active.title;
  el("diagnosticPrescription").innerHTML = `
    <ol>
      ${standard.active.steps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ol>
    <div class="diagnostic-actions">
      <button class="secondary" type="button" data-standard-search="${escapeHtml(standard.active.query)}">按处方检索</button>
      <button type="button" data-standard-ask="${escapeHtml(standard.active.ask)}">让导师制定计划</button>
    </div>
  `;
  el("standardAssignment").innerHTML = standard.assignment
    .map(
      (item) => `
        <article>
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.body)}</p>
          ${
            item.query
              ? `<button class="text-button" type="button" data-standard-search="${escapeHtml(item.query)}">检索作业资料</button>`
              : ""
          }
        </article>
      `
    )
    .join("");
  el("conceptMapNodes").innerHTML = conceptMap.nodes
    .map(
      (item, idx) => `
        <article class="concept-node node-${escapeHtml(item.tone)}">
          <div class="concept-node-index">${String(idx + 1).padStart(2, "0")}</div>
          <div>
            <span>${escapeHtml(item.label)}</span>
            <h4>${escapeHtml(item.title)}</h4>
            <p>${escapeHtml(item.body)}</p>
          </div>
          <div class="concept-node-actions">
            <button class="text-button" type="button" data-map-search="${escapeHtml(item.query)}">检索证据</button>
            <button class="text-button" type="button" data-map-ask="${escapeHtml(item.ask)}">问导师</button>
          </div>
        </article>
      `
    )
    .join("");
  el("conceptPathway").innerHTML = conceptMap.pathway
    .map(
      ([step, title, body, query]) => `
        <article>
          <span>${escapeHtml(step)}</span>
          <div>
            <strong>${escapeHtml(title)}</strong>
            <p>${escapeHtml(body)}</p>
          </div>
          <button class="text-button" type="button" data-map-search="${escapeHtml(query)}">证据</button>
        </article>
      `
    )
    .join("");
  el("conceptMapFormula").textContent = conceptMap.formula;
  el("conceptDebugQuestions").innerHTML = conceptMap.debugQuestions
    .map(
      ([question, query]) => `
        <button type="button" data-map-search="${escapeHtml(query)}">${escapeHtml(question)}</button>
      `
    )
    .join("");
  el("readerTitle").textContent = manuscript.title;
  el("readerParagraphs").innerHTML = manuscript.paragraphs
    .map((item, idx) => `<p><span>${String(idx + 1).padStart(2, "0")}</span>${escapeHtml(item)}</p>`)
    .join("");
  el("readerBlackboard").innerHTML = `
    <strong>${escapeHtml(manuscript.blackboard.title)}</strong>
    <code>${escapeHtml(manuscript.blackboard.formula)}</code>
    <p>${escapeHtml(manuscript.blackboard.interpretation)}</p>
  `;
  el("readerGlossary").innerHTML = manuscript.glossary
    .map(
      ([term, body]) => `
        <button class="glossary-item" type="button" data-concept="${escapeHtml(term)}">
          <strong>${escapeHtml(term)}</strong>
          <span>${escapeHtml(body)}</span>
        </button>
      `
    )
    .join("");
  el("readerCheckpoints").innerHTML = manuscript.checkpoints
    .map(
      ([label, body]) => `
        <article>
          <strong>${escapeHtml(label)}</strong>
          <p>${escapeHtml(body)}</p>
        </article>
      `
    )
    .join("");
  el("readerSearchBtn").dataset.readerSearch = manuscript.searchQuery;
  el("readerAskBtn").dataset.readerAsk = manuscript.askPrompt;
  el("trackTitle").textContent = track.title;
  el("trackSummary").textContent = track.summary;
  el("trackModules").innerHTML = track.modules
    .map((id) => {
      const item = moduleById(id);
      if (!item) return "";
      const active = item.id === state.active.id ? " active" : "";
      const done = state.done.has(item.id) ? " done" : "";
      return `<button class="track-module${active}${done}" type="button" data-track-module="${escapeHtml(item.id)}"><span>${escapeHtml(item.stage)}</span>${escapeHtml(item.title)}</button>`;
    })
    .join("");
  el("moduleBridge").innerHTML = `
    <div class="bridge-row">
      <span>前置</span>
      ${
        prev
          ? `<button class="text-button" type="button" data-track-module="${escapeHtml(prev.id)}">${escapeHtml(prev.stage)} ${escapeHtml(prev.title)}</button>`
          : "<strong>从这里开始</strong>"
      }
    </div>
    <div class="bridge-row">
      <span>本章里程碑</span>
      <strong>${escapeHtml(track.milestone)}</strong>
    </div>
    <div class="bridge-row">
      <span>后续</span>
      ${
        next
          ? `<button class="text-button" type="button" data-track-module="${escapeHtml(next.id)}">${escapeHtml(next.stage)} ${escapeHtml(next.title)}</button>`
          : "<strong>进入 Capstone 复盘</strong>"
      }
    </div>
  `;
  el("outcomeList").innerHTML = (state.active.outcomes || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  el("courseAnchorList").innerHTML = (COURSE_ANCHORS[state.active.id] || COURSE_ANCHORS.orientation)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  el("deliverableText").textContent = state.active.project || bp.labSteps[0] || "";
  el("seminarQuestion").textContent = seminar.question;
  el("seminarBody").innerHTML = seminar.paragraphs.map((item) => `<p>${escapeHtml(item)}</p>`).join("");
  el("seminarBoard").innerHTML = `
    <div class="seminar-model">
      <strong>心智模型</strong>
      <p>${escapeHtml(seminar.model)}</p>
    </div>
    ${seminar.board
      .map(
        (item, idx) => `
          <div class="board-row">
            <span>${String(idx + 1).padStart(2, "0")}</span>
            <p>${escapeHtml(item)}</p>
          </div>
        `
      )
      .join("")}
    <div class="study-cycle">
      <strong>学习节奏</strong>
      ${seminar.studyCycle
        .map(
          ([label, body]) => `
            <div>
              <span>${escapeHtml(label)}</span>
              <p>${escapeHtml(body)}</p>
            </div>
          `
        )
        .join("")}
    </div>
  `;
  el("seminarSearchBtn").dataset.seminarSearch = seminar.evidenceQuery;
  el("seminarAskBtn").dataset.seminarAsk = seminar.askPrompt;
  el("principleList").innerHTML = pack.principles.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  el("mechanismList").innerHTML = pack.mechanisms.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  el("readingList").innerHTML = pack.readings.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  el("simulatorTitle").textContent = simulator.title;
  el("simulatorScenario").textContent = simulator.scenario;
  el("simulatorPresets").innerHTML = simulator.presets
    .map(([id, label]) => `<button class="preset-btn" type="button" data-lab-preset="${escapeHtml(id)}">${escapeHtml(label)}</button>`)
    .join("");
  el("simulatorControls").innerHTML = simulator.controls
    .map(
      ([id, label, helper]) => `
        <label class="sim-control">
          <span>
            <strong>${escapeHtml(label)}</strong>
            <small>${escapeHtml(helper)}</small>
          </span>
          <output>${escapeHtml(String(state.mechanismKnobs[id]))}</output>
          <input type="range" min="0" max="100" step="5" value="${escapeHtml(String(state.mechanismKnobs[id]))}" data-lab-control="${escapeHtml(id)}" />
        </label>
      `
    )
    .join("");
  el("simulatorMetrics").innerHTML = simulator.metrics
    .map(
      ([id, label, value, helper]) => `
        <article class="sim-metric ${escapeHtml(id)}">
          <div>
            <strong>${escapeHtml(label)}</strong>
            <span>${escapeHtml(String(value))}</span>
          </div>
          <div class="metric-bar" aria-hidden="true"><span style="width: ${escapeHtml(String(value))}%"></span></div>
          <p>${escapeHtml(helper)}</p>
        </article>
      `
    )
    .join("");
  el("simulatorObservation").innerHTML = `
    <strong>教授观察</strong>
    <p>${escapeHtml(simulator.verdict)}</p>
  `;
  el("simulatorSearchBtn").dataset.simulatorSearch = simulator.searchQuery;
  el("simulatorAskBtn").dataset.simulatorAsk = simulator.askPrompt;
  el("workedExampleTitle").textContent = worked.title;
  el("workedExampleProblem").textContent = worked.problem;
  el("workedExampleSteps").innerHTML = worked.steps
    .map(
      ([label, body], idx) => `
        <article>
          <span>${String(idx + 1).padStart(2, "0")}</span>
          <div>
            <strong>${escapeHtml(label)}</strong>
            <p>${escapeHtml(body)}</p>
          </div>
        </article>
      `
    )
    .join("");
  el("workedExampleExperiment").innerHTML = worked.experiment
    .map(([label, body]) => `<div><strong>${escapeHtml(label)}</strong><p>${escapeHtml(body)}</p></div>`)
    .join("");
  el("workedExampleRubric").innerHTML = worked.rubric
    .map(([label, body]) => `<div><span>${escapeHtml(label)}</span><p>${escapeHtml(body)}</p></div>`)
    .join("");
  el("workedSearchBtn").dataset.workedSearch = worked.searchQuery;
  el("workedAskBtn").dataset.workedAsk = worked.askPrompt;
  el("briefTitle").textContent = brief.title;
  el("briefClaim").textContent = brief.claim;
  el("briefContext").textContent = brief.context;
  el("briefGates").innerHTML = brief.gates
    .map(
      ([label, body]) => `
        <article class="brief-gate">
          <strong>${escapeHtml(label)}</strong>
          <p>${escapeHtml(body)}</p>
        </article>
      `
    )
    .join("");
  el("briefSpecGrid").innerHTML = brief.specs
    .map(
      ([label, body], idx) => `
        <article class="brief-spec">
          <span>${String(idx + 1).padStart(2, "0")}</span>
          <div>
            <strong>${escapeHtml(label)}</strong>
            <p>${escapeHtml(body)}</p>
          </div>
        </article>
      `
    )
    .join("");
  el("briefSearchBtn").dataset.briefSearch = brief.searchQuery;
  el("briefAskBtn").dataset.briefAsk = brief.askPrompt;
  el("sessionTimeline").innerHTML = session.timeline
    .map(
      (item) => `
        <article class="session-step">
          <span>${escapeHtml(item.time)}</span>
          <div>
            <h4>${escapeHtml(item.title)}</h4>
            <p>${escapeHtml(item.body)}</p>
          </div>
          <div class="session-actions">
            <button class="text-button" type="button" data-session-search="${escapeHtml(item.query)}">检索</button>
            <button class="text-button" type="button" data-session-ask="${escapeHtml(item.ask)}">追问</button>
          </div>
        </article>
      `
    )
    .join("");
  el("sessionArtifacts").innerHTML = session.artifacts
    .map(
      ([title, body]) => `
        <article class="artifact-card">
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(body)}</p>
        </article>
      `
    )
    .join("");
  el("lensSwitch").innerHTML = TEACHING_LENSES.map(
    (item) => `
      <button class="lens-btn${item.id === state.activeLens ? " active" : ""}" type="button" data-lens="${escapeHtml(item.id)}">
        ${escapeHtml(item.label)}
      </button>
    `
  ).join("");
  const lensBodies = {
    intuition: `把「${state.active.title}」先压缩成一句话：${bp.thesis} 这一视角要求你先能不用术语讲给同学听，再把术语逐个挂回 ${bp.concepts
      .slice(0, 4)
      .join("、")}。`,
    mechanism: `${pack.mechanisms[0]} 学习时按“输入 -> 变换 -> 约束 -> 失败模式”四步拆解；如果这四格填不满，说明还没有真正读懂机制。`,
    engineering: `把本章落成可运行作品：${state.active.project} 先做最小实验，再记录数据、指标、错误样例和一次复盘。`,
    research: `把本章接到前沿研究：从 ${bp.concepts.slice(0, 3).join("、")} 中选一个概念，追问它的 benchmark、baseline、开放问题和可复现实验。`,
  };
  el("lensCard").innerHTML = `
    <div>
      <span class="lens-label">${escapeHtml(lens.label)}视角</span>
      <h4>${escapeHtml(lens.title)}</h4>
      <p>${escapeHtml(lensBodies[lens.id] || lensBodies.intuition)}</p>
    </div>
    <div class="lens-actions">
      <button class="secondary" type="button" data-lens-search="${escapeHtml(bp.concepts.slice(0, 2).join(" "))}">检索这条线</button>
      <button type="button" data-lens-ask="${escapeHtml(`${lens.prompt}\n\n章节：${state.active.title}\n核心判断：${bp.thesis}`)}">请导师重讲</button>
    </div>
  `;
  const ladder = [
    ["入口问题", bp.thesis, bp.concepts[0] || state.active.title],
    ["概念骨架", bp.concepts.slice(0, 4).join(" / "), bp.concepts.slice(0, 2).join(" ")],
    ["机制抓手", pack.mechanisms[0], bp.concepts[1] || state.active.title],
    ["实验动作", bp.labSteps[0], state.active.queries[0] || state.active.title],
    ["研究迁移", state.active.project, state.active.queries.slice(0, 2).join(" ")],
  ];
  el("knowledgeLadder").innerHTML = ladder
    .map(
      ([title, body, query], idx) => `
        <article class="ladder-step">
          <span>${String(idx + 1).padStart(2, "0")}</span>
          <div>
            <h4>${escapeHtml(title)}</h4>
            <p>${escapeHtml(body)}</p>
          </div>
          <div class="ladder-actions">
            <button class="text-button" type="button" data-ladder-search="${escapeHtml(query)}">检索</button>
            <button class="text-button" type="button" data-ladder-ask="${escapeHtml(`请围绕「${title}」讲解 ${state.active.title}：${body}`)}">追问</button>
          </div>
        </article>
      `
    )
    .join("");
  el("lectureThesis").textContent = bp.thesis;
  el("lectureFrame").textContent = bp.frame;
  el("conceptMap").innerHTML = bp.concepts
    .map((concept, idx) => {
      const tone = ["green", "blue", "amber", "red"][idx % 4];
      return `<button class="concept-pill ${tone}" type="button" data-concept="${escapeHtml(concept)}">${escapeHtml(concept)}</button>`;
    })
    .join("");
  el("lectureRoute").innerHTML = bp.route
    .map(
      ([title, body], idx) => `
        <article class="route-card">
          <span>${String(idx + 1).padStart(2, "0")}</span>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(body)}</p>
        </article>
      `
    )
    .join("");
  el("misconceptionList").innerHTML = bp.misconceptions.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderPractice() {
  if (!state.active) return;
  const bp = blueprintFor(state.active);
  const mastery = masteryFor(state.active, bp);
  const exam = examFor(state.active, bp);
  const problems = problemSetFor(state.active, bp);
  const quiz = quizFor(state.active, bp);
  const checked = new Set(state.mastery[state.active.id] || []);
  const quizAnswers = state.quizAnswers[state.active.id] || {};
  el("protocolList").innerHTML = mastery.protocol.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  el("masteryChecklist").innerHTML = mastery.rubric
    .map(
      (item) => `
        <label class="mastery-item">
          <input type="checkbox" data-mastery="${escapeHtml(item.id)}" ${checked.has(item.id) ? "checked" : ""} />
          <span>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.body)}</small>
          </span>
        </label>
      `
    )
    .join("");
  const score = checked.size;
  el("masteryScore").textContent = `${score}/${mastery.rubric.length} 达标`;
  el("masteryMeterBar").style.width = `${Math.round((score / mastery.rubric.length) * 100)}%`;
  const quizCorrect = quiz.reduce((sum, item) => {
    const selected = quizAnswers[item.id];
    return sum + (item.options[selected] && item.options[selected].correct ? 1 : 0);
  }, 0);
  el("quizScore").textContent = `${quizCorrect}/${quiz.length} 正确`;
  el("quizCards").innerHTML = quiz
    .map((item, cardIdx) => {
      const selected = quizAnswers[item.id];
      const selectedOption = item.options[selected];
      const answered = selected != null;
      const feedbackClass = selectedOption && selectedOption.correct ? " correct" : answered ? " wrong" : "";
      return `
        <article class="quiz-card${feedbackClass}">
          <div class="quiz-card-head">
            <span>${escapeHtml(item.label)}</span>
            <h4>${escapeHtml(item.question)}</h4>
          </div>
          <div class="quiz-options">
            ${item.options
              .map((option, optionIdx) => {
                const active = selected === optionIdx ? " selected" : "";
                const tone = selected === optionIdx ? (option.correct ? " correct" : " wrong") : "";
                return `<button class="quiz-option${active}${tone}" type="button" data-quiz-card="${cardIdx}" data-quiz-option="${optionIdx}">${escapeHtml(option.text)}</button>`;
              })
              .join("")}
          </div>
          <div class="quiz-feedback${feedbackClass}">
            ${answered ? escapeHtml(selectedOption.feedback) : "先选一个答案；系统会立刻给出离线反馈。"}
          </div>
          <div class="quiz-actions">
            <button class="text-button" type="button" data-quiz-search="${escapeHtml(item.query)}">检索证据</button>
            <button class="text-button" type="button" data-quiz-ask="${escapeHtml(item.ask)}">让导师追问</button>
          </div>
        </article>
      `;
    })
    .join("");
  el("oralExamCards").innerHTML = exam.oral
    .map(
      (item, idx) => `
        <article class="oral-card">
          <span>${escapeHtml(item.label)}</span>
          <h4>${escapeHtml(item.question)}</h4>
          <p>${escapeHtml(item.answer)}</p>
          <div class="oral-actions">
            <button class="secondary" type="button" data-oral-search="${escapeHtml(item.query)}">检索证据</button>
            <button type="button" data-oral-ask="${escapeHtml(`请按严格口试官标准追问我：${item.question}\n\n章节：${state.active.title}\n本章项目：${state.active.project}`)}">导师追问</button>
          </div>
        </article>
      `
    )
    .join("");
  el("gradingRubric").innerHTML = exam.rubric
    .map(
      ([grade, body]) => `
        <article class="rubric-row">
          <strong>${escapeHtml(grade)}</strong>
          <p>${escapeHtml(body)}</p>
        </article>
      `
    )
    .join("");
  el("problemSetCards").innerHTML = problems
    .map(
      (item) => `
        <article class="problem-card">
          <span>${escapeHtml(item.kind)}</span>
          <h4>${escapeHtml(item.title)}</h4>
          <p>${escapeHtml(item.body)}</p>
          <div class="problem-deliverable">
            <strong>交付物</strong>
            <small>${escapeHtml(item.deliverable)}</small>
          </div>
          <div class="problem-actions">
            <button class="secondary" type="button" data-problem-search="${escapeHtml(item.query)}">检索资料</button>
            <button type="button" data-problem-ask="${escapeHtml(item.ask)}">导师审题</button>
          </div>
        </article>
      `
    )
    .join("");
  el("workbenchCards").innerHTML = workbenchFor(state.active, bp)
    .map(
      (card) => `
        <article class="workbench-card">
          <span>${escapeHtml(card.kicker)}</span>
          <h4>${escapeHtml(card.title)}</h4>
          <p>${escapeHtml(card.body)}</p>
          <div class="workbench-actions">
            <button class="secondary" type="button" data-workbench-search="${escapeHtml(card.query)}">${escapeHtml(card.action)}</button>
            <button type="button" data-workbench-ask="${escapeHtml(card.ask)}">导师拆解</button>
          </div>
        </article>
      `
    )
    .join("");
  el("checkList").innerHTML = bp.checks
    .map(
      ([question, hint, answer], idx) => `
        <article class="check-card">
          <div>
            <span class="check-index">Check ${idx + 1}</span>
            <h4>${escapeHtml(question)}</h4>
            <p>${escapeHtml(hint)}</p>
          </div>
          <button class="secondary reveal-check" type="button" data-check="${idx}">展开讲解</button>
          <div class="check-answer" id="checkAnswer${idx}">${escapeHtml(answer)}</div>
        </article>
      `
    )
    .join("");
  el("labSteps").innerHTML = bp.labSteps.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderNotes() {
  if (!state.active) return;
  const bp = blueprintFor(state.active);
  el("noteInput").value = state.notes[state.active.id] || "";
  el("notePrompts").innerHTML = [
    `本章一句话结论：${bp.thesis}`,
    `我最不懂的概念：${bp.concepts.slice(0, 3).join(" / ")}`,
    `我能否不用术语解释：${state.active.project}`,
    "我找到的来源路径和证据片段：",
  ]
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
}

function sourcePathLabel(path) {
  return path.replace(/^\/Users\/yin\/Documents_local\/Github\/LLM-learn\/[^/]+\//, "");
}

function sourceExcerptLabel(text) {
  return String(text || "")
    .replace(/\/Users\/yin\/Documents_local\/Github\/LLM-learn\/[^/]+\//g, "")
    .replace(/\b[A-Za-z_-]+\/Frontier-AI/g, "资料库/Frontier-AI");
}

function clientQueryTerms(query) {
  return (query.toLowerCase().match(/[a-z0-9][a-z0-9_.-]{1,}|[\u4e00-\u9fff]{2,}/g) || [])
    .filter((term) => !["and", "or", "the", "what", "how", "why"].includes(term))
    .slice(0, 10);
}

function countTermHits(text, terms) {
  const lower = text.toLowerCase();
  return terms.reduce((sum, term) => sum + (lower.includes(term) ? 1 : 0), 0);
}

function localPreviewResults(query, activeModuleId = "") {
  const modules = state.modules.length ? state.modules : FALLBACK_MODULES;
  const terms = clientQueryTerms(query);
  const scored = modules
    .map((module) => {
      const bp = blueprintFor(module);
      const pack = LECTURE_PACKS[module.id] || LECTURE_PACKS.orientation;
      const seminar = seminarFor(module, bp, pack);
      const anchors = COURSE_ANCHORS[module.id] || [];
      const haystack = [
        module.stage,
        module.title,
        module.summary,
        module.project,
        ...(module.outcomes || []),
        ...(module.queries || []),
        bp.thesis,
        bp.frame,
        ...(bp.concepts || []),
        ...(bp.misconceptions || []),
        ...(pack.principles || []),
        ...(pack.mechanisms || []),
        ...(pack.readings || []),
        seminar.question,
        seminar.model,
        ...seminar.board,
        ...anchors,
      ].join(" ");
      const hits = terms.length ? countTermHits(haystack, terms) : 0;
      const activeBoost = module.id === activeModuleId ? 2.4 : 0;
      const titleBoost = countTermHits(`${module.title} ${(module.queries || []).join(" ")}`, terms) * 1.7;
      return { module, bp, pack, seminar, score: hits + activeBoost + titleBoost };
    })
    .filter((item) => item.score > 0 || item.module.id === activeModuleId)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (!scored.length && modules[0]) {
    const module = modules[0];
    const bp = blueprintFor(module);
    const pack = LECTURE_PACKS[module.id] || LECTURE_PACKS.orientation;
    scored.push({ module, bp, pack, seminar: seminarFor(module, bp, pack), score: 0 });
  }

  return scored.flatMap(({ module, bp, pack, seminar }, idx) => {
    const intro = seminar.paragraphs.slice(0, 2).join(" ");
    const mechanism = [bp.thesis, pack.mechanisms[0], module.project].filter(Boolean).join(" ");
    const basePath = `大模型学习之路/课程内讲义/${module.stage}-${module.id}`;
    const cards = [
      {
        title: `${module.stage} ${module.title}：教授讲义`,
        path: `${basePath}/professor-lecture`,
        category: "课程内即时索引",
        score: idx,
        source_label: "课程讲义",
        excerpt: intro,
      },
      {
        title: `${module.stage} ${module.title}：机制与练习抓手`,
        path: `${basePath}/mechanism-practice`,
        category: "课程内即时索引",
        score: idx + 0.1,
        source_label: "课程讲义",
        excerpt: mechanism,
      },
    ];
    return cards;
  }).slice(0, 6);
}

function evidenceKey(item) {
  return `${item.title || ""}::${item.path || ""}`;
}

function mergeEvidenceResults(...lists) {
  const seen = new Set();
  const merged = [];
  lists.flat().forEach((item) => {
    if (!item) return;
    const key = evidenceKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  });
  return merged.slice(0, 10);
}

function staticEvidenceResults(query, activeModuleId = "") {
  const data = state.staticEvidence;
  if (!data || !data.modules) return [];
  const modules = state.modules.length ? state.modules : FALLBACK_MODULES;
  const terms = clientQueryTerms(query);
  const wholeQuery = query.trim().toLowerCase();
  const scored = [];

  Object.entries(data.modules).forEach(([moduleId, lesson]) => {
    const module = lesson.module || modules.find((item) => item.id === moduleId) || {};
    const moduleContext = [module.stage, module.title, module.summary, moduleId, lesson.evidence_query].join(" ");
    (lesson.evidence || []).forEach((item, idx) => {
      const title = item.title || "";
      const path = item.path || "";
      const category = item.category || "";
      const excerpt = item.excerpt || "";
      const titleLower = title.toLowerCase();
      const pathLower = path.toLowerCase();
      const excerptLower = excerpt.toLowerCase();
      const contextLower = `${moduleContext} ${category}`.toLowerCase();
      let score = moduleId === activeModuleId ? 2.5 : 0;

      terms.forEach((term) => {
        if (titleLower.includes(term)) score += 6;
        if (pathLower.includes(term)) score += 4;
        if (contextLower.includes(term)) score += 2.5;
        if (excerptLower.includes(term)) score += 1.5;
      });
      if (wholeQuery && `${titleLower} ${pathLower} ${excerptLower}`.includes(wholeQuery)) score += 6;

      if (score > 0) {
        scored.push({
          ...item,
          score,
          module_id: moduleId,
          source_label: moduleId === activeModuleId ? "本章静态证据" : "课程静态证据",
          category: category || "浏览器本地证据库",
          excerpt: excerpt.slice(0, 700),
          _rank: idx,
        });
      }
    });
  });

  return scored
    .sort((a, b) => b.score - a.score || a._rank - b._rank)
    .slice(0, 8)
    .map(({ _rank, ...item }) => item);
}

function staticIndexResults(query, activeModuleId = "") {
  const data = state.staticSearchIndex;
  const items = data && Array.isArray(data.items) ? data.items : [];
  if (!items.length) return [];
  const terms = clientQueryTerms(query);
  const wholeQuery = query.trim().toLowerCase();
  if (!terms.length && !wholeQuery) return [];
  const scored = [];

  items.forEach((item, idx) => {
    const title = item.title || "";
    const path = item.path || "";
    const category = item.category || "";
    const excerpt = item.excerpt || "";
    const moduleSet = item._moduleSet || new Set(Array.isArray(item.modules) ? item.modules : []);
    const titleLower = item._titleLower || title.toLowerCase();
    const pathLower = item._pathLower || path.toLowerCase();
    const categoryLower = item._categoryLower || category.toLowerCase();
    const excerptLower = item._excerptLower || excerpt.toLowerCase();
    const searchText = item._searchText || `${titleLower} ${pathLower} ${categoryLower} ${excerptLower}`;
    let score = moduleSet.has(activeModuleId) ? 3.5 : 0;

    terms.forEach((term) => {
      if (titleLower.includes(term)) score += 7;
      if (pathLower.includes(term)) score += 5;
      if (categoryLower.includes(term)) score += 3;
      if (excerptLower.includes(term)) score += 1.6;
    });
    if (wholeQuery && searchText.includes(wholeQuery)) score += 7;
    if (score <= 0) return;
    scored.push({
      ...item,
      score,
      source_label: moduleSet.has(activeModuleId) ? "本章静态索引" : "浏览器静态索引",
      category: category || "浏览器静态检索包",
      excerpt: excerpt.slice(0, 700),
      _rank: idx,
    });
  });

  return scored
    .sort((a, b) => b.score - a.score || a._rank - b._rank)
    .slice(0, 8)
    .map(({ _rank, modules, ...item }) => item);
}

function instantSearchPreview(query, activeModuleId = "") {
  return mergeEvidenceResults(
    staticIndexResults(query, activeModuleId),
    staticEvidenceResults(query, activeModuleId),
    localPreviewResults(query, activeModuleId)
  );
}

function renderEvidence(results, message = "") {
  const box = el("evidenceResults");
  if (message) {
    if (!results || !results.length) {
      state.visibleEvidence = [];
      box.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
      return;
    }
  }
  if (!results || !results.length) {
    state.visibleEvidence = [];
    box.innerHTML = `<div class="empty-state">没有检索到足够相关的片段。换一个更具体的术语试试。</div>`;
    return;
  }
  state.visibleEvidence = results;
  const status = message ? `<div class="retrieval-inline-status">${escapeHtml(message)}</div>` : "";
  box.innerHTML =
    status +
    results
    .map(
      (item, idx) => `
        <article class="evidence-card">
          <div class="source-meta">
            <span>${escapeHtml(item.source_label || "本章课程证据")}</span>
            <div class="source-actions">
              <button class="text-button pin-source" type="button" data-source="${idx}">存证据</button>
              <button class="text-button ask-source" type="button" data-source="${idx}">问这段</button>
            </div>
          </div>
          <h4>${escapeHtml(item.title || "未命名资料")}</h4>
          <code>${escapeHtml(sourcePathLabel(item.path || ""))}</code>
          <p>${escapeHtml(sourceExcerptLabel(item.excerpt || ""))}</p>
        </article>
      `
    )
    .join("");
}

function currentPinnedSources() {
  if (!state.active) return [];
  return state.pinnedSources[state.active.id] || [];
}

function renderPinnedSources() {
  if (!state.active) return;
  const pinned = currentPinnedSources();
  el("sourceBasketTitle").textContent = `${pinned.length} 条已保存`;
  if (!pinned.length) {
    el("pinnedSources").innerHTML = `<div class="empty-state compact">从检索结果中点击“存证据”，把关键来源放到这里。</div>`;
    return;
  }
  el("pinnedSources").innerHTML = pinned
    .map(
      (item, idx) => `
        <article class="pinned-source">
          <button class="text-button remove-pinned" type="button" data-pinned="${idx}">移除</button>
          <strong>${escapeHtml(item.title || "未命名资料")}</strong>
          <code>${escapeHtml(sourcePathLabel(item.path || ""))}</code>
          <p>${escapeHtml(sourceExcerptLabel(item.excerpt || ""))}</p>
        </article>
      `
    )
    .join("");
}

function pinSource(idx) {
  if (!state.active) return;
  const source = state.visibleEvidence[idx];
  if (!source) return;
  const pinned = currentPinnedSources();
  const key = `${source.title || ""}::${source.path || ""}`;
  if (!pinned.some((item) => `${item.title || ""}::${item.path || ""}` === key)) {
    state.pinnedSources[state.active.id] = [
      ...pinned,
      {
        title: source.title || "",
        path: source.path || "",
        excerpt: source.excerpt || "",
      },
    ].slice(0, 8);
    savePinnedSources();
  }
  renderPinnedSources();
}

function renderRead() {
  if (!state.active) return;
  const bp = blueprintFor(state.active);
  el("searchInput").value = state.active.queries.slice(0, 3).join(" ");
  document.querySelectorAll("[data-search-mode]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.searchMode === state.searchMode);
  });
  el("retrievalHint").textContent =
    state.searchMode === "semantic"
      ? "即时检索不等网络；点“后台全库补充”时会调用 qwen3-embedding 语义重排，适合模糊问题。"
      : "即时检索默认只扫浏览器静态检索包、课程证据和课程讲义；点“后台全库补充”才访问 83 万片段数据库。";
  el("queryChips").innerHTML = state.active.queries
    .map((query) => `<button type="button" data-query="${escapeHtml(query)}">${escapeHtml(query)}</button>`)
    .join("");
  el("readingProtocol").innerHTML = readingProtocolFor(state.active, bp)
    .map(
      ([label, body], idx) => `
        <article class="protocol-step">
          <span>${String(idx + 1).padStart(2, "0")}</span>
          <div>
            <strong>${escapeHtml(label)}</strong>
            <p>${escapeHtml(body)}</p>
          </div>
        </article>
      `
    )
    .join("");
  renderPinnedSources();
  if (!state.lesson) {
    renderEvidence([], "正在从本地数据库抽取本章必读证据...");
    return;
  }
  renderEvidence(state.lesson.evidence || []);
}

function renderLessonEvidenceIfSafe() {
  if (!state.manualSearchActive || state.activeTab !== "read") renderRead();
}

function renderQuickPrompts() {
  if (!state.active) return;
  const bp = blueprintFor(state.active);
  const prompts = [
    `请用教授口吻讲清楚本章核心：${bp.thesis}`,
    `我不懂 ${bp.concepts[0]}，请结合本地资料解释机制和例子。`,
    `请把本章实践任务拆成 5 个可执行步骤：${state.active.project}`,
  ];
  el("quickPrompts").innerHTML = prompts
    .map((prompt) => `<button type="button" data-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`)
    .join("");
}

function renderAll() {
  renderHero();
  renderModules();
  renderTeach();
  renderPractice();
  renderNotes();
  if (!state.manualSearchActive || state.activeTab !== "read") renderRead();
  renderQuickPrompts();
}

async function loadLesson(moduleId) {
  const requestId = ++state.lessonRequest;
  if (state.lessonCache.has(moduleId)) {
    state.lesson = state.lessonCache.get(moduleId);
    renderLessonEvidenceIfSafe();
    return;
  }
  state.lesson = null;
  renderLessonEvidenceIfSafe();
  const staticLesson = await staticLessonFor(moduleId);
  if (requestId !== state.lessonRequest) return;
  if (staticLesson) {
    state.lesson = staticLesson;
    state.lessonCache.set(moduleId, staticLesson);
    renderLessonEvidenceIfSafe();
    return;
  }
  try {
    const lesson = await api(`lesson?module=${encodeURIComponent(moduleId)}`);
    if (requestId !== state.lessonRequest) return;
    state.lesson = lesson;
    state.lessonCache.set(moduleId, lesson);
    renderLessonEvidenceIfSafe();
  } catch (err) {
    if (requestId !== state.lessonRequest) return;
    if (!state.manualSearchActive || state.activeTab !== "read") {
      renderEvidence([], `课程证据加载失败：${err.message}`);
    }
  }
}

function selectModule(id) {
  const next = state.modules.find((item) => item.id === id) || state.modules[0];
  if (!next) return;
  state.active = next;
  state.manualSearchActive = false;
  state.searchRequest += 1;
  renderAll();
  loadLesson(next.id);
}

function setQuestion(text, submit = false) {
  el("questionInput").value = text;
  el("questionInput").focus();
  if (submit) ask();
}

async function runSearch(queryOverride = "", options = {}) {
  const q = (queryOverride || el("searchInput").value).trim();
  if (!q) return;
  state.manualSearchActive = true;
  el("searchInput").value = q;
  const requestId = ++state.searchRequest;
  const deep = options.deep === true;
  const semantic = state.searchMode === "semantic" ? "1" : "0";
  const moduleId = state.active ? state.active.id : "";
  const cacheKey = `${activeApiBase}|${moduleId}|${state.searchMode}|${q}`;
  const instantMessage =
    state.staticSearchIndex
      ? "已使用浏览器静态检索包、课程证据和讲义索引即时检索；需要 83 万片段深挖时，再点“后台全库补充”。"
      : "正在加载浏览器静态检索包；先显示课程讲义索引，加载完成后自动补充更多证据。";
  const previewMessage =
    state.searchMode === "semantic"
      ? "正在后台请求公网语义重排；先显示浏览器静态证据库和课程索引，数据库证据返回后再补充。"
      : "正在后台请求公网极速 FTS；先显示浏览器静态证据库和课程索引，数据库证据返回后再补充。";
  const preview = instantSearchPreview(q, moduleId);
  if (!deep) {
    renderEvidence(preview, instantMessage);
    Promise.all([loadStaticEvidence(), loadStaticSearchIndex()]).then(() => {
      if (requestId !== state.searchRequest) return;
      renderEvidence(
        instantSearchPreview(q, moduleId),
        "已使用浏览器静态检索包、课程证据和讲义索引即时检索；这一步不等待公网 API。"
      );
    });
    el("retrievalHint").textContent = "即时检索只扫浏览器静态检索包、课程证据和讲义索引；后台全库补充才调用远端 FTS/语义重排。";
    showTab("read");
    return;
  }
  if (state.searchCache.has(cacheKey)) {
    const cached = state.searchCache.get(cacheKey);
    el("retrievalHint").textContent =
      cached.retrieval_mode === "semantic"
        ? "已从本机页面缓存复用语义重排结果。"
        : "已从本机页面缓存复用极速 FTS 结果。";
    renderEvidence(cached.results || []);
    showTab("read");
    return;
  }
  renderEvidence(preview, previewMessage);
  Promise.all([loadStaticEvidence(), loadStaticSearchIndex()]).then(() => {
    if (requestId !== state.searchRequest || state.searchCache.has(cacheKey)) return;
    const upgradedPreview = instantSearchPreview(q, moduleId);
    renderEvidence(upgradedPreview, `${previewMessage} 已先命中浏览器静态检索包。`);
  });
  const module = moduleId ? `&module=${encodeURIComponent(moduleId)}` : "";
  try {
    const timeoutMs = state.searchMode === "semantic" ? 5000 : 1500;
    const data = await api(`search?q=${encodeURIComponent(q)}&limit=8&semantic=${semantic}${module}`, { timeoutMs });
    state.searchCache.set(cacheKey, data);
    if (state.searchCache.size > 80) state.searchCache.delete(state.searchCache.keys().next().value);
    const timing = typeof data.elapsed_ms === "number" ? `，远端 ${data.elapsed_ms}ms` : "";
    const cache = data.cache_hit ? "，命中服务端缓存" : "";
    el("retrievalHint").textContent =
      data.retrieval_mode === "semantic"
        ? `已使用语义重排：适合解释型问题，但会比极速 FTS 慢${timing}${cache}。`
        : `已使用极速 FTS：关键词召回优先，适合快速定位原始证据${timing}${cache}。`;
    renderEvidence(data.results || []);
  } catch (err) {
    renderEvidence(
      instantSearchPreview(q, moduleId),
      `公网全库补充超过等待预算，已保留浏览器即时证据。需要更深召回时可再次点“后台全库补充”：${err.message}`
    );
  }
}

async function ask() {
  const question = el("questionInput").value.trim();
  if (!question) return;
  el("answerBox").textContent = "正在检索本地数据库，并尝试调用可用模型...";
  const body = {
    question,
    module_id: state.active ? state.active.id : null,
    top_k: 5,
  };
  try {
    const data = await api("ask", { method: "POST", body: JSON.stringify(body) });
    const sources = (data.sources || []).map((item, idx) => `[${idx + 1}] ${sourcePathLabel(item.path)}`).join("\n");
    el("answerBox").textContent = `${data.answer}\n\n来源：\n${sources || "无"}`;
  } catch (err) {
    el("answerBox").textContent = `问答失败：${err.message}`;
  }
}

function askAboutSource(idx) {
  const source = state.visibleEvidence[idx];
  if (!source) return;
  const prompt = `我读不懂这段资料，请像教授一样解释关键概念、背景和学习顺序：\n\n标题：${source.title}\n路径：${sourcePathLabel(source.path)}\n片段：${source.excerpt}`;
  setQuestion(prompt, true);
}

function showTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `${tab}Tab`));
}

async function load() {
  startApiWarmup();
  state.modules = FALLBACK_MODULES;
  el("statDocs").textContent = formatNumber(FALLBACK_STATS.documents);
  el("statChunks").textContent = formatNumber(FALLBACK_STATS.chunks);
  el("statModules").textContent = formatNumber(FALLBACK_STATS.modules);
  el("dbStatus").textContent = "知识库：课程已加载";
  el("modelStatus").textContent = "模型：连接中";
  el("retrievalStatus").textContent = "检索：连接中";
  renderModules();
  if (state.modules.length) selectModule((state.active && state.active.id) || state.modules[0].id);

  try {
    const [course, stats, model] = await Promise.all([api("course"), api("stats"), api("model/status")]);
    const activeId = state.active && state.active.id;
    state.modules = course.modules && course.modules.length ? course.modules : FALLBACK_MODULES;
    el("statDocs").textContent = formatNumber(stats.documents);
    el("statChunks").textContent = formatNumber(stats.chunks);
    el("statModules").textContent = formatNumber(stats.modules == null ? state.modules.length : stats.modules);
    el("dbStatus").textContent = stats.ready ? `知识库：${formatNumber(stats.documents)} 文档` : "知识库：未构建";
    const modelNames = Array.isArray(model.models) ? model.models : [];
    if (!model.available) {
      el("modelStatus").textContent = `模型：${model.provider || "服务"} 离线`;
    } else if (!modelNames.length) {
      el("modelStatus").textContent = `模型：未安装（默认 ${model.default_model}）`;
    } else if (modelNames.includes(model.default_model)) {
      el("modelStatus").textContent = `模型：${model.default_model}`;
    } else {
      el("modelStatus").textContent = `模型：${modelNames.length} 个可用，默认模型缺失`;
    }
    if (model.embedding_enabled && model.embedding_available) {
      el("retrievalStatus").textContent = "检索：语义就绪";
    } else if (model.embedding_enabled) {
      el("retrievalStatus").textContent = "检索：FTS 备用";
    } else {
      el("retrievalStatus").textContent = "检索：FTS";
    }
    if (activeId && state.modules.some((item) => item.id === activeId)) {
      state.active = state.modules.find((item) => item.id === activeId);
      renderAll();
    } else if (state.modules.length) {
      selectModule(state.modules[0].id);
    }
  } catch (err) {
    el("dbStatus").textContent = "知识库：离线课程";
    el("modelStatus").textContent = "模型：暂未连接";
    el("retrievalStatus").textContent = "检索：离线";
    el("answerBox").textContent = `课程内容已离线加载，可以先正常学习。证据检索和问答暂时连接不到公网 API：${err.message}`;
  }
}

el("moduleList").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-module]");
  if (btn) selectModule(btn.dataset.module);
});

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
});

el("conceptMap").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-concept]");
  if (!btn) return;
  showTab("read");
  runSearch(btn.dataset.concept);
});

el("teachTab").addEventListener("click", (event) => {
  const trackBtn = event.target.closest("[data-track-module]");
  if (trackBtn) {
    selectModule(trackBtn.dataset.trackModule);
    return;
  }
  const levelBtn = event.target.closest("[data-study-level]");
  if (levelBtn) {
    state.studyLevel = levelBtn.dataset.studyLevel;
    localStorage.setItem("llmRoadStudyLevel", state.studyLevel);
    renderTeach();
    return;
  }
  const lectureStepBtn = event.target.closest("[data-lecture-step]");
  if (lectureStepBtn) {
    state.lectureStep = Number(lectureStepBtn.dataset.lectureStep);
    localStorage.setItem("llmRoadLectureStep", String(state.lectureStep));
    renderTeach();
    return;
  }
  const lectureNavBtn = event.target.closest("[data-lecture-nav]");
  if (lectureNavBtn) {
    const delta = lectureNavBtn.dataset.lectureNav === "next" ? 1 : -1;
    state.lectureStep = Math.max(0, Math.min(5, state.lectureStep + delta));
    localStorage.setItem("llmRoadLectureStep", String(state.lectureStep));
    renderTeach();
    return;
  }
  const lensBtn = event.target.closest("[data-lens]");
  if (lensBtn) {
    state.activeLens = lensBtn.dataset.lens;
    renderTeach();
    return;
  }
  const presetBtn = event.target.closest("[data-lab-preset]");
  if (presetBtn && state.active) {
    const simulator = mechanismSimulatorFor(state.active, blueprintFor(state.active), LECTURE_PACKS[state.active.id] || LECTURE_PACKS.orientation);
    const preset = simulator.presets.find(([id]) => id === presetBtn.dataset.labPreset);
    if (preset) {
      state.mechanismKnobs = { ...preset[2] };
      renderTeach();
    }
    return;
  }
  const searchBtn = event.target.closest("[data-reader-search], [data-worked-search], [data-brief-search], [data-simulator-search], [data-lens-search], [data-ladder-search], [data-seminar-search], [data-course-map-search], [data-atlas-search], [data-briefing-search], [data-deck-search], [data-textbook-search], [data-standard-search], [data-map-search], [data-session-search], [data-concept]");
  if (searchBtn) {
    const query =
      searchBtn.dataset.readerSearch ||
      searchBtn.dataset.workedSearch ||
      searchBtn.dataset.briefSearch ||
      searchBtn.dataset.simulatorSearch ||
      searchBtn.dataset.lensSearch ||
      searchBtn.dataset.ladderSearch ||
      searchBtn.dataset.seminarSearch ||
      searchBtn.dataset.courseMapSearch ||
      searchBtn.dataset.atlasSearch ||
      searchBtn.dataset.briefingSearch ||
      searchBtn.dataset.deckSearch ||
      searchBtn.dataset.textbookSearch ||
      searchBtn.dataset.standardSearch ||
      searchBtn.dataset.mapSearch ||
      searchBtn.dataset.sessionSearch ||
      searchBtn.dataset.concept;
    showTab("read");
    runSearch(query);
    return;
  }
  const askBtn = event.target.closest("[data-reader-ask], [data-worked-ask], [data-brief-ask], [data-simulator-ask], [data-lens-ask], [data-ladder-ask], [data-seminar-ask], [data-briefing-ask], [data-deck-ask], [data-standard-ask], [data-map-ask], [data-session-ask]");
  if (askBtn) {
    const prompt =
      askBtn.dataset.readerAsk ||
      askBtn.dataset.workedAsk ||
      askBtn.dataset.briefAsk ||
      askBtn.dataset.simulatorAsk ||
      askBtn.dataset.lensAsk ||
      askBtn.dataset.ladderAsk ||
      askBtn.dataset.seminarAsk ||
      askBtn.dataset.briefingAsk ||
      askBtn.dataset.deckAsk ||
      askBtn.dataset.standardAsk ||
      askBtn.dataset.mapAsk ||
      askBtn.dataset.sessionAsk;
    setQuestion(prompt, true);
  }
});

el("teachTab").addEventListener("input", (event) => {
  const control = event.target.closest("[data-lab-control]");
  if (!control) return;
  const key = control.dataset.labControl;
  state.mechanismKnobs = { ...state.mechanismKnobs, [key]: Number(control.value) };
  renderTeach();
});

el("queryChips").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-query]");
  if (btn) runSearch(btn.dataset.query);
});

el("retrievalModeSwitch").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-search-mode]");
  if (!btn) return;
  state.searchMode = btn.dataset.searchMode;
  renderRead();
});

el("evidenceResults").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-source]");
  if (!btn) return;
  if (btn.classList.contains("pin-source")) pinSource(Number(btn.dataset.source));
  else askAboutSource(Number(btn.dataset.source));
});

el("pinnedSources").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-pinned]");
  if (!btn || !state.active) return;
  const pinned = currentPinnedSources();
  pinned.splice(Number(btn.dataset.pinned), 1);
  state.pinnedSources[state.active.id] = pinned;
  savePinnedSources();
  renderPinnedSources();
});

el("clearPinnedSources").addEventListener("click", () => {
  if (!state.active) return;
  state.pinnedSources[state.active.id] = [];
  savePinnedSources();
  renderPinnedSources();
});

el("sendSourcesToNotes").addEventListener("click", () => {
  if (!state.active) return;
  const pinned = currentPinnedSources();
  if (!pinned.length) return;
  const existing = state.notes[state.active.id] || "";
  const sourceNote = [
    "",
    `## 证据精读：${state.active.title}`,
    ...pinned.map((item, idx) => `${idx + 1}. ${item.title}\n   路径：${sourcePathLabel(item.path)}\n   证据用途：\n   局限/疑问：`),
  ].join("\n");
  state.notes[state.active.id] = `${existing}${existing ? "\n" : ""}${sourceNote}`.trim();
  saveNotes();
  showTab("notes");
  renderNotes();
});

el("askSourcesBtn").addEventListener("click", () => {
  if (!state.active) return;
  const pinned = currentPinnedSources();
  if (!pinned.length) return;
  const sources = pinned
    .map((item, idx) => `[${idx + 1}] ${item.title}\n路径：${sourcePathLabel(item.path)}\n片段：${item.excerpt}`)
    .join("\n\n");
  setQuestion(
    `请像论文课助教一样检查我为「${state.active.title}」保存的证据链是否足够。\n\n本章项目：${state.active.project}\n\n证据：\n${sources}\n\n请指出：1）每条证据支持什么 claim；2）缺少哪类证据；3）下一步应该检索什么关键词。`,
    true
  );
});

el("checkList").addEventListener("click", (event) => {
  const btn = event.target.closest(".reveal-check");
  if (!btn) return;
  const answer = el(`checkAnswer${btn.dataset.check}`);
  answer.classList.toggle("visible");
  btn.textContent = answer.classList.contains("visible") ? "收起讲解" : "展开讲解";
});

el("quizCards").addEventListener("click", (event) => {
  if (!state.active) return;
  const optionBtn = event.target.closest("[data-quiz-card][data-quiz-option]");
  if (optionBtn) {
    const quiz = quizFor(state.active, blueprintFor(state.active));
    const card = quiz[Number(optionBtn.dataset.quizCard)];
    if (!card) return;
    state.quizAnswers[state.active.id] = {
      ...(state.quizAnswers[state.active.id] || {}),
      [card.id]: Number(optionBtn.dataset.quizOption),
    };
    saveQuizAnswers();
    renderPractice();
    return;
  }
  const searchBtn = event.target.closest("[data-quiz-search]");
  if (searchBtn) {
    showTab("read");
    runSearch(searchBtn.dataset.quizSearch);
    return;
  }
  const askBtn = event.target.closest("[data-quiz-ask]");
  if (askBtn) setQuestion(askBtn.dataset.quizAsk, true);
});

el("workbenchCards").addEventListener("click", (event) => {
  const searchBtn = event.target.closest("[data-workbench-search]");
  if (searchBtn) {
    showTab("read");
    runSearch(searchBtn.dataset.workbenchSearch);
    return;
  }
  const askBtn = event.target.closest("[data-workbench-ask]");
  if (askBtn) setQuestion(askBtn.dataset.workbenchAsk, true);
});

el("oralExamCards").addEventListener("click", (event) => {
  const searchBtn = event.target.closest("[data-oral-search]");
  if (searchBtn) {
    showTab("read");
    runSearch(searchBtn.dataset.oralSearch);
    return;
  }
  const askBtn = event.target.closest("[data-oral-ask]");
  if (askBtn) setQuestion(askBtn.dataset.oralAsk, true);
});

el("problemSetCards").addEventListener("click", (event) => {
  const searchBtn = event.target.closest("[data-problem-search]");
  if (searchBtn) {
    showTab("read");
    runSearch(searchBtn.dataset.problemSearch);
    return;
  }
  const askBtn = event.target.closest("[data-problem-ask]");
  if (askBtn) setQuestion(askBtn.dataset.problemAsk, true);
});

el("masteryChecklist").addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-mastery]");
  if (!checkbox || !state.active) return;
  const current = new Set(state.mastery[state.active.id] || []);
  if (checkbox.checked) current.add(checkbox.dataset.mastery);
  else current.delete(checkbox.dataset.mastery);
  state.mastery[state.active.id] = [...current];
  saveMastery();
  renderPractice();
});

el("askMasteryBtn").addEventListener("click", () => {
  if (!state.active) return;
  const bp = blueprintFor(state.active);
  const mastery = masteryFor(state.active, bp);
  const checked = new Set(state.mastery[state.active.id] || []);
  const pending = mastery.rubric.filter((item) => !checked.has(item.id));
  const pendingText = pending.length
    ? pending.map((item) => `- ${item.title}：${item.body}`).join("\n")
    : "三项达标都已勾选，请用严格标准复查是否真的过关。";
  setQuestion(
    `请像严格课程助教一样检查我在「${state.active.title}」是否真正掌握。\n\n本章核心：${bp.thesis}\n本章项目：${state.active.project}\n需要重点检查的达标项：\n${pendingText}\n\n请给出：1）是否达标；2）还缺什么证据；3）下一步必须做的一个动作。`,
    true
  );
});

el("quickPrompts").addEventListener("click", (event) => {
  const btn = event.target.closest("[data-prompt]");
  if (btn) setQuestion(btn.dataset.prompt);
});

el("searchBtn").addEventListener("click", () => runSearch());
el("deepSearchBtn").addEventListener("click", () => runSearch("", { deep: true }));
el("askBtn").addEventListener("click", ask);
el("clearAnswer").addEventListener("click", () => {
  el("questionInput").value = "";
  el("answerBox").textContent = "导师回答会显示在这里；没有本地模型时，会先返回检索式讲解和来源。";
});
el("projectAskBtn").addEventListener("click", () => {
  if (!state.active) return;
  setQuestion(`请把这个实践任务拆成可执行计划，并指出我应该先读哪些本地资料：${state.active.project}`, true);
});
el("saveNote").addEventListener("click", () => {
  if (!state.active) return;
  state.notes[state.active.id] = el("noteInput").value;
  saveNotes();
  el("saveNote").textContent = "已保存";
  setTimeout(() => {
    el("saveNote").textContent = "保存笔记";
  }, 1200);
});
el("askFromNote").addEventListener("click", () => {
  if (!state.active) return;
  const note = el("noteInput").value.trim();
  if (!note) return;
  setQuestion(`这是我学习「${state.active.title}」的笔记。请指出理解漏洞，并给我下一步阅读建议：\n\n${note}`, true);
});
el("markDone").addEventListener("click", () => {
  if (!state.active) return;
  if (state.done.has(state.active.id)) state.done.delete(state.active.id);
  else state.done.add(state.active.id);
  saveDone();
  renderModules();
});
el("resetProgress").addEventListener("click", () => {
  if (!confirm("确认清空所有模块完成状态？")) return;
  state.done.clear();
  saveDone();
  renderModules();
});
el("searchInput").addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") runSearch("", { deep: true });
});
el("questionInput").addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") ask();
});

load();
