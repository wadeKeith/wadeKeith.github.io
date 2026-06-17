const APP_VERSION = "20260617rich";
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

const LECTURE_BLUEPRINTS = {
  orientation: {
    question: "如何把一个庞大的本地资料库，变成可持续学习的大模型研究实验室？",
    core: [
      "导学章不是教一个算法，而是建立学习系统。大模型资料库最危险的地方不是资料少，而是资料太多：论文、课件、代码、博客和数据集彼此交叉，初学者很容易在目录里迷路。",
      "本课程把资料库重新解释为一张学习地图：每个章节都有问题、概念、证据、练习和产出。你不是从文件夹开始学，而是从一个可回答的问题开始，再去找能支撑这个问题的材料。",
      "所谓“知识库地图”，在这里不是通用知识图谱，也不是仓库清单；它是一种学习导航结构。它告诉你当前章要掌握什么、哪些资料是证据、读完要交付什么作品、卡住时该问什么问题。",
    ],
    mechanisms: [
      ["路径", "先按 16 个阶段定位自己正在学哪一类能力：基础实现、训练、后训练、系统、应用、多模态或具身智能。阶段决定你应该读什么，而不是让搜索词随机决定。"],
      ["证据", "每个概念都要找到支撑材料：课程讲义负责建立框架，论文负责给出正式定义和实验，代码负责暴露工程约束，项目任务负责检验你是否真的会用。"],
      ["产出", "学习不是“看过了”，而是交付一个可检查产物。例如本章的产出是个人资料地图；后续章节会变成最小 Transformer、部署说明、RAG 助手或机器人任务设计。"],
      ["复盘", "每周把读过的材料映射回路线图：哪些概念会讲了，哪些证据还薄，哪个练习没有完成。复盘让资料库从仓库变成训练场。"],
    ],
    example: "如果你要学习 FlashAttention，错误方式是直接搜一堆博客；正确方式是先把它放到“推理系统”章节，明确它解决的是 attention 的 HBM/SRAM IO 瓶颈，再读论文机制、看实现约束，最后用一页部署说明解释它如何影响显存、吞吐和延迟。",
    mistakes: ["把资料库当网盘，只按文件名乱翻。", "一遇到不会就问模型，跳过自己建立问题的过程。", "只收藏资料，不定义产出和验收标准。"],
    protocol: ["先读本章核心判断，写出一句话理解。", "打开目录，确认本章在 16 阶段路径中的位置。", "挑 3 个关键词，分别写“定义、机制、验证方式”。", "完成本章产出，再让导师检查漏洞。"],
  },
  math_pytorch_nlp: {
    question: "为什么大模型学习必须先补数学、PyTorch、NLP 和深度学习基础？",
    core: [
      "这一章的目标不是把所有基础课重学一遍，而是补齐能读懂 Transformer 和训练代码的最小底座。你需要知道张量形状如何流动、梯度如何回传、优化器为什么更新参数、文本怎样变成 token 和 embedding。",
      "大模型工程里很多 bug 都不是“模型不聪明”，而是基础张量、mask、loss、batch 或 dtype 出错。基础能力越扎实，后面读论文和调代码越不会被表面术语吓住。",
      "学习顺序应当从张量开始，到自动微分和训练循环，再到语言建模目标。这样你看到 Transformer 时，注意力只是一个可微分模块，而不是神秘黑箱。",
    ],
    mechanisms: [
      ["张量形状", "任何模型层都可以先问输入输出 shape。batch、sequence、hidden 维度一旦错位，后面的 attention、mask 和 loss 都会跟着错。"],
      ["自动微分", "PyTorch 通过计算图记录操作，loss.backward 会把标量损失对参数的梯度传播回去。理解这点才能调试 detach、no_grad、梯度累积和显存问题。"],
      ["语言建模", "文本先被 tokenizer 变成 token id，再查 embedding 表变成向量。自回归语言模型的训练目标，是用前文预测下一个 token。"],
      ["训练循环", "一个最小训练循环包含前向、loss、反向、优化器更新和评测。大模型训练只是这个循环在数据、并行、稳定性和规模上变复杂。"],
    ],
    example: "复现一个字符级语言模型时，你会看到完整链条：字符串切成 token，token 变 embedding，模型输出 logits，cross entropy 比较下一个 token，反向传播更新 embedding 和网络权重。",
    mistakes: ["只会调用 Trainer，不知道 loss mask 在哪里生效。", "看论文公式时跳过 shape，导致实现时维度全靠猜。", "把 tokenizer、embedding 和模型主体混成一个概念。"],
    protocol: ["手写一个小 batch 的 shape 注释。", "跑通最小训练循环并打印 loss。", "解释 embedding 表的输入输出。", "用断点看一次梯度是否回到参数。"],
  },
  transformer_gpt_llama: {
    question: "从 attention 到 GPT/LLaMA，decoder-only 大模型到底由哪些可实现的部件组成？",
    core: [
      "Transformer 不是一个魔法整体，而是一组可组合模块：token embedding、位置编码、attention、MLP、残差、归一化和采样。你要把每个模块的输入输出讲清楚。",
      "GPT/LLaMA 的核心是 decoder-only 自回归建模：当前位置只能看过去 token，通过 causal mask 防止信息泄漏。训练时并行预测每个位置的下一个 token，推理时逐 token 生成。",
      "LLaMA 系列的设计改变，如 RoPE、RMSNorm、SwiGLU、GQA，不是技巧清单，而是稳定性、上下文长度和推理效率之间的工程选择。",
    ],
    mechanisms: [
      ["Self-Attention", "Q/K 做内容寻址，softmax 得到每个 token 应该看哪些上下文，V 承载被混合的信息。scale 和 mask 决定数值稳定性与可见范围。"],
      ["Causal Mask", "mask 把未来位置置为不可见，保证训练时的条件分布和推理时一致。没有 mask，模型会偷看答案。"],
      ["MLP 与残差", "attention 混合信息，MLP 做逐位置非线性变换，残差和归一化让深层网络更容易训练。"],
      ["采样", "temperature、top-k、top-p 改变从 logits 到 token 的选择方式，影响多样性、稳定性和重复。"],
    ],
    example: "实现一个两层 decoder-only Transformer：先打印 attention logits 的形状，再验证 mask 后上三角为不可见，最后用同一句 prompt 对比 greedy、top-k 和 temperature 采样。",
    mistakes: ["把 attention 说成“模型在注意”，却讲不出 Q/K/V。", "忘记 causal mask，训练 loss 很低但推理崩坏。", "把 RoPE、RMSNorm、SwiGLU 当孤立名词背。"],
    protocol: ["手写单头 attention。", "验证 mask 前后 logits。", "搭一个最小 GPT block。", "比较不同采样策略的输出。"],
  },
  llm_training_scaling_data: {
    question: "预训练为什么是数据、规模、架构和预算的共同优化，而不只是把模型做大？",
    core: [
      "预训练阶段决定模型的基础能力。它不是单纯堆 GPU，而是在 token 数、模型参数、数据质量、训练稳定性和评测节奏之间做预算分配。",
      "Scaling Law 给出一种思考方式：在给定算力下，模型大小和训练 token 数要匹配。数据质量、去重、过滤和混合比例会直接影响模型学到什么分布。",
      "DeepSeek 风格架构把效率问题放到中心：MoE 用稀疏激活扩大总参数，MLA 降低 KV cache 压力，长上下文和多 token prediction 都服务于训练/推理成本与能力的平衡。",
    ],
    mechanisms: [
      ["Scaling", "参数、token 和算力不是越多越好，而是要匹配。欠训练的大模型和过训练的小模型都会浪费预算。"],
      ["数据流水线", "去重、质量过滤、语言/领域配比、敏感内容处理会改变模型最终能力。数据不是燃料，而是训练目标的定义。"],
      ["MoE", "Mixture-of-Experts 每个 token 只激活部分专家，使总参数变大但单次计算相对可控。难点是路由、负载均衡和通信。"],
      ["MLA 与上下文", "Multi-head Latent Attention 等方法尝试压缩 KV 表示，降低长上下文推理时的缓存压力。"],
    ],
    example: "设计一个 1B 模型预训练计划时，你必须写清：训练多少 token、数据从哪里来、如何去重、每隔多少 step 评测、如果 loss 异常该回滚到哪个 checkpoint。",
    mistakes: ["只讨论模型参数，不讨论 token 预算。", "把数据清洗当杂活，而不是能力边界。", "只看最终榜单，不看训练曲线和中间评测。"],
    protocol: ["画出数据流水线。", "写一张规模预算表。", "列出至少 5 个评测 checkpoint。", "说明一个架构选择如何降低成本。"],
  },
  sft_peft_lora: {
    question: "怎样把预训练模型变成会听指令、可定制、可评测的助手？",
    core: [
      "SFT 和 PEFT 位于后训练阶段。预训练模型学到语言和世界知识，但不一定会按用户意图回答；SFT 用指令数据教模型遵循格式和任务。",
      "LoRA/QLoRA 的意义是降低适配成本：冻结基座模型，只训练低秩增量或少量 adapter。它适合资源有限的任务定制，但不能替代数据质量和评测。",
      "后训练最重要的不是 loss 下降，而是模型是否在目标任务上稳定、是否遗忘原能力、是否遵守格式和安全边界。",
    ],
    mechanisms: [
      ["SFT 数据", "一条样本通常包含 system、user、assistant。训练时常用 loss mask，只让 assistant response 承担生成损失。"],
      ["LoRA", "LoRA 用低秩矩阵近似权重更新，常插入 attention 或 MLP 线性层。rank、alpha、target modules 会影响容量和稳定性。"],
      ["QLoRA", "QLoRA 冻结量化后的基座权重，只训练 adapter，显著降低显存，但更依赖量化质量和训练超参。"],
      ["评测", "后训练要同时看指令遵循、目标任务指标、格式稳定性和回归测试，而不是只看训练 loss。"],
    ],
    example: "为课程问答助手做 LoRA：先整理 200 条课程问答样本，明确哪些 token 参与 loss，再训练 adapter，最后用固定 30 道题比较训练前后的回答格式、事实性和拒答边界。",
    mistakes: ["把 LoRA 当免费午餐。", "不做 loss mask，模型学会复读用户输入。", "只看 loss，不做固定题集回归。"],
    protocol: ["写 10 条高质量指令样本。", "标出 assistant loss 区间。", "选择 target modules。", "设计训练前后对比题。"],
  },
  inference_systems: {
    question: "为什么推理系统的瓶颈常常不是 FLOPs，而是内存、缓存和调度？",
    core: [
      "推理阶段把模型能力变成用户可感知的延迟、吞吐和成本。一个模型在论文里效果好，不代表它能稳定服务大量请求。",
      "LLM 推理分成 prefill 和 decode：prefill 并行处理 prompt，decode 逐 token 生成。随着上下文增长，KV cache 会占用大量显存，调度策略直接影响吞吐。",
      "FlashAttention、PagedAttention、continuous batching、speculative decoding、张量并行等技术，本质都是围绕显存、带宽、批处理和通信瓶颈做工程优化。",
    ],
    mechanisms: [
      ["KV Cache", "生成每个新 token 时，历史 K/V 不必重复计算，但要保存在显存中。长上下文和大 batch 会让 KV cache 成为主要显存压力。"],
      ["FlashAttention", "通过分块、在线 softmax 和算子融合减少 HBM/SRAM 往返，避免显式物化完整注意力矩阵，提升实际 wall-clock 速度。"],
      ["Batching", "continuous batching 把不同请求动态合批，提高 GPU 利用率，但需要处理不同长度请求的调度公平性。"],
      ["Speculative Decoding", "用小模型先草拟 token，大模型验证，目标是在保持分布正确的前提下减少大模型调用步数。"],
    ],
    example: "部署 7B 模型时，你要估算权重显存、KV cache 显存、单 token 延迟和吞吐。若用户 prompt 很长，优化重点可能不是换 GPU，而是降低 KV cache、改 batch 策略或启用高效 attention kernel。",
    mistakes: ["只看参数量，不算 KV cache。", "把 FlashAttention 误解成 sparse attention。", "只优化单请求延迟，忽略多用户吞吐。"],
    protocol: ["画出 prefill/decode 流程。", "估算一次 KV cache。", "解释 FlashAttention 的 IO 优化。", "写一页部署预算。"],
  },
  alignment_rlhf_eval: {
    question: "模型怎样从“会续写”变成“可控、可评测、相对安全”的助手？",
    core: [
      "对齐不是让模型变礼貌这么简单，而是把人类偏好、安全约束和任务质量引入后训练。它包含奖励模型、偏好优化、红队测试和回归评测。",
      "RLHF 先训练奖励模型，再用 PPO 等方法优化策略；DPO/IPO/GRPO 等方法则尝试更直接地利用偏好对。不同方法在稳定性、成本和可控性上各有权衡。",
      "评测是对齐的地基。没有固定评测集、失败样例和回归测试，任何“更安全”或“更好用”的说法都不可靠。",
    ],
    mechanisms: [
      ["Reward Model", "奖励模型学习人类偏好排序，把开放回答压成可优化信号，但会带来 reward hacking 和分布外失真风险。"],
      ["PPO/RLHF", "PPO 在 KL 约束下优化策略，让模型更接近高奖励回答，同时避免偏离原模型太远。"],
      ["DPO", "DPO 直接用偏好对优化模型，省去显式奖励模型，工程上更简单，但仍依赖偏好数据质量。"],
      ["Eval", "能力、安全、事实性、格式和回归测试要分开看；单一排行榜不能代表生产可用性。"],
    ],
    example: "为课程导师做评测时，可以固定 50 个问题：20 个概念解释、10 个实验设计、10 个误区纠正、10 个安全边界。每次改 prompt 或模型，都必须跑同一套题。",
    mistakes: ["把 RLHF 当万能安全方案。", "只看主观感觉，不做固定回归。", "混淆能力评测和安全评测。"],
    protocol: ["写偏好样例。", "定义评分 rubric。", "建立回归题集。", "记录每次模型变更的失败样例。"],
  },
  rag_agents: {
    question: "怎样把大模型接入资料、工具和流程，做成可用的 AI 应用？",
    core: [
      "RAG 和 Agent 把模型从“只靠参数回答”扩展为“能查资料、用工具、记状态、执行流程”的系统。真正的难点在于可靠性，而不是把工具接上就结束。",
      "RAG 的核心链路是 chunk、embedding/FTS、rerank、context compression、answer、verification。每一步都可能引入噪声、遗漏或幻觉。",
      "Agent 的核心是状态、动作、工具、观察和停止条件。没有观测日志和失败恢复，agent 很容易陷入循环、调用错工具或把错误结果当事实。",
    ],
    mechanisms: [
      ["Chunking", "切块决定检索单位。太小会丢上下文，太大会引入噪声。好的 chunk 要围绕语义边界和回答任务设计。"],
      ["Retrieval", "关键词检索适合精确术语，embedding 适合语义相似，rerank 用于把候选重新排序。生产系统常组合使用。"],
      ["Tool Calling", "工具调用要定义 schema、权限、错误处理和可观测日志，否则模型会把工具当普通文本猜。"],
      ["Verification", "回答后要检查证据是否支持 claim，特别是涉及路径、数值、代码和实验结论时。"],
    ],
    example: "课程问答助手可以先用 FTS 找到候选资料，再把片段交给 StepFun 综合回答。前端不展示召回列表，但后端必须把检索作为内部证据，避免模型凭空讲。",
    mistakes: ["把 RAG 等同于向量数据库。", "不做 rerank 和证据压缩。", "工具失败后没有恢复策略。"],
    protocol: ["定义一个问答任务。", "设计 chunk 和检索策略。", "记录每次召回与回答。", "用固定问题评估命中率和幻觉率。"],
  },
  vlm_multimodal: {
    question: "视觉语言模型怎样把图像证据接入语言推理？",
    core: [
      "VLM 的目标不是简单给图片配文字，而是把视觉证据变成语言模型可操作的 token 或表示。它需要解决图像编码、跨模态对齐、指令数据和视觉 grounding。",
      "常见路线是用 ViT/CLIP 类视觉编码器提取图像特征，再通过 projector 映射到语言模型的隐藏空间。语言模型随后把视觉 token 与文本 token 一起处理。",
      "多模态能力要分开评估：看图描述、OCR、目标定位、空间关系、图表理解和多步视觉推理不是同一种能力。",
    ],
    mechanisms: [
      ["视觉编码器", "ViT 把图像切成 patch，得到一组视觉表示；CLIP 则通过图文对比学习把图像和文本拉到共享语义空间。"],
      ["Projector", "projector 把视觉表示映射到 LLM 能理解的 hidden size，使图像信息能进入语言上下文。"],
      ["Instruction Tuning", "多模态指令数据教模型按用户问题使用视觉证据，而不是只生成图片标题。"],
      ["Grounding", "grounding 要求回答能对应图像里的实际区域、文字或关系，不能只凭常识猜。"],
    ],
    example: "同一张科研图表，可以问“这张图在比较什么指标”“最高点在哪里”“结论是否支持论文 claim”。一个好 VLM 必须既读懂图像元素，又能把它们转成语言推理证据。",
    mistakes: ["把 OCR 能力当成完整视觉理解。", "只看图片描述，不测空间关系。", "忽略视觉 token 数对上下文和成本的影响。"],
    protocol: ["画出 image encoder 到 LLM 的路径。", "区分 OCR、caption、grounding、reasoning。", "设计 10 个视觉失败样例。", "记录模型依据了哪些图像证据。"],
  },
  streaming_video_vlm: {
    question: "视频理解为什么比图像理解更难，流式 VLM 要解决什么问题？",
    core: [
      "视频不是很多图片的简单堆叠。它多了时间顺序、动作变化、事件边界和长上下文记忆。模型既要看清单帧，又要知道前后发生了什么。",
      "视频 VLM 要在帧采样、时间压缩、memory 和延迟之间权衡。采样太少会漏动作，采样太多会压垮上下文和成本。",
      "流式场景还要求模型边看边回答，不能等完整视频结束。它需要增量更新状态，保留关键事件，并在延迟预算内生成响应。",
    ],
    mechanisms: [
      ["帧采样", "均匀采样适合摘要，关键帧采样适合事件定位，密集采样适合细粒度动作，但成本最高。"],
      ["时间建模", "模型需要把相邻帧变化压缩成动作、状态转移和事件，而不是独立理解每张图。"],
      ["Streaming Memory", "流式记忆保留已经发生的重要事件，让模型处理长视频时不必把所有帧都塞进上下文。"],
      ["评测", "视频问答要测事件顺序、时间定位、因果关系和延迟，不只是问画面里有什么。"],
    ],
    example: "看一段机器人倒水视频时，单帧只能看到杯子和水壶；视频理解要判断“先拿起水壶、再倾斜、液体进入杯子、最后放回”。这需要时间状态而不是静态 caption。",
    mistakes: ["把视频任务降级成抽几帧做图片问答。", "只看准确率，不看延迟。", "忽略事件边界和时间定位。"],
    protocol: ["定义采样策略。", "写出事件时间线。", "设计顺序和因果问题。", "记录回答延迟与帧数成本。"],
  },
  vla_robotics: {
    question: "VLA 如何把视觉、语言和动作连接成机器人策略？",
    core: [
      "VLA 模型把视觉观察、语言指令和机器人状态映射到动作。它不是只回答问题，而是要在真实或仿真环境里改变世界。",
      "机器人策略的难点在于动作空间和反馈。语言里的“把杯子拿起来”要落到连续控制、末端执行器姿态、碰撞约束和失败恢复上。",
      "VLA 学习通常结合 imitation data、机器人轨迹、视觉编码和语言指令。评估时必须看成功率、鲁棒性、泛化和安全失败，而不只是生成文本是否合理。",
    ],
    mechanisms: [
      ["Observation", "输入通常包含相机图像、机器人 proprioception、任务文本和历史状态。缺一个维度都可能导致策略误判。"],
      ["Action", "输出可以是离散动作、末端位姿、关节控制或高层 skill。动作表示决定模型能控制到什么粒度。"],
      ["Imitation", "模仿学习从专家轨迹学策略，容易起步，但对数据分布和环境变化敏感。"],
      ["Evaluation", "机器人评测要记录成功率、碰撞、恢复、时间和不同初始条件，而不是只看单次演示。"],
    ],
    example: "桌面机器人“把红色积木放进盒子”任务，需要识别红色积木、定位盒子、规划抓取、执行移动、放置并检查结果。VLA 必须把语言目标转成动作闭环。",
    mistakes: ["把 VLA 当成会看图的聊天模型。", "只看 demo，不做多 seed 评测。", "忽略动作空间和安全约束。"],
    protocol: ["写状态、动作、奖励/成功标准。", "列出训练数据来源。", "定义 5 个失败模式。", "设计多初始位置评测。"],
  },
  robot_sim_data: {
    question: "机器人仿真和数据集为什么决定具身智能能不能复现？",
    core: [
      "机器人学习离不开环境和数据。仿真器提供可控任务、重复实验和安全探索；真实数据集提供传感器噪声、物体多样性和真实接触 dynamics。",
      "不同数据集的差别很大：相机视角、动作频率、控制接口、任务分布、标注方式都会影响模型能学到什么。不能只看数据量。",
      "评测协议是复现的关键。没有固定场景、seed、成功判定和失败记录，机器人结果很容易变成不可比较的演示视频。",
    ],
    mechanisms: [
      ["Simulator", "ManiSkill、RoboCasa 等仿真器提供任务环境和物理引擎，但 sim2real gap 会影响真实迁移。"],
      ["Dataset", "DROID、BridgeData 等真实数据包含多样任务和设备，但数据分布不均、动作标准不一。"],
      ["Task Distribution", "任务集合决定模型泛化范围。只在单一桌面任务训练，不能声称具备通用机器人能力。"],
      ["Metrics", "成功率、时间、碰撞、恢复次数和泛化条件要一起记录。"],
    ],
    example: "同样是开抽屉任务，仿真里把手位置、摩擦、相机视角都可控；真实数据里会有光照、遮挡和机械误差。评测必须说明模型在哪些条件下成功。",
    mistakes: ["只报平均成功率，不报任务分布。", "把仿真成功直接等同真实可用。", "忽略传感器和动作接口差异。"],
    protocol: ["列出环境版本和 seed。", "写清动作空间。", "定义成功/失败判定。", "保存失败视频和状态日志。"],
  },
  world_models: {
    question: "世界模型怎样让智能体预测未来、规划动作和压缩经验？",
    core: [
      "世界模型学习环境动力学：给定当前状态和动作，预测未来状态、奖励或观测。它让智能体不只被动反应，而能在内部模拟可能结果。",
      "世界模型通常在 latent space 中工作，把高维图像或状态压缩成可预测表示。规划时，智能体可以在模型里试算多个动作序列，再选择最可能成功的方案。",
      "关键难点是误差累积和分布外泛化。模型预测一步可能准确，多步 rollout 后误差会放大，导致规划建立在错误未来上。",
    ],
    mechanisms: [
      ["Latent State", "把复杂观测压缩成低维状态，保留与任务相关的信息，降低预测难度。"],
      ["Dynamics", "学习 state + action 到 next state 的转移，是世界模型支持规划的核心。"],
      ["Planning", "在学习到的模型中评估候选动作序列，选择预期回报更高的动作。"],
      ["Uncertainty", "预测不确定性越高，规划越应该保守或请求更多真实交互。"],
    ],
    example: "在一个小迷宫中，世界模型可以学习“向右走会靠近墙还是靠近出口”。智能体先在内部模拟几步，再决定是否转弯，而不是每次都随机探索。",
    mistakes: ["把世界模型等同视频生成。", "只看单步预测，不测多步规划。", "忽略模型误差对策略的影响。"],
    protocol: ["定义状态和动作。", "训练一步预测。", "测试多步 rollout。", "比较有无世界模型的规划效果。"],
  },
  driving_world_models: {
    question: "自动驾驶世界模型如何用于闭环仿真、轨迹预测和安全评估？",
    core: [
      "驾驶世界模型试图学习道路场景随时间变化的规律：车辆、行人、交通灯、道路拓扑和 ego car 动作共同决定未来。",
      "它的价值不只在生成好看的视频，而是在闭环仿真中测试策略：如果 ego car 改变动作，周围交通参与者会怎样响应，风险如何变化。",
      "安全评估必须关注长尾场景。普通巡航很容易，难的是遮挡、突然横穿、复杂路口和规则冲突。",
    ],
    mechanisms: [
      ["Scene Representation", "驾驶场景可表示为图像、BEV、occupancy、轨迹或对象列表，不同表示影响可控性和评测。"],
      ["Closed-loop Eval", "策略动作会改变后续场景，评测必须让模型根据动作滚动更新，而不是只做离线预测。"],
      ["Trajectory", "轨迹预测关注其他交通参与者未来位置，是风险评估和规划的重要输入。"],
      ["Safety Cases", "安全不是平均准确率，而是长尾危险场景下是否能提前预测和规避。"],
    ],
    example: "十字路口左转时，世界模型要预测对向车、行人和 ego car 轨迹的交互。如果模型只生成逼真画面，却不能评估碰撞风险，就不够用于安全验证。",
    mistakes: ["把视频逼真度当驾驶能力。", "只做 open-loop，不做闭环。", "忽略长尾危险场景。"],
    protocol: ["定义场景表示。", "写出闭环变量。", "设计 5 个危险场景。", "记录碰撞、刹车和轨迹偏差。"],
  },
  diffusion_video_3d: {
    question: "生成模型如何进入视频、3D 和空间智能？",
    core: [
      "Diffusion 模型通过逐步去噪生成数据，从图像扩展到视频和 3D 后，核心挑战变成时序一致性、空间一致性和可控性。",
      "视频生成不仅要每帧好看，还要物体身份、运动轨迹、光照和相机运动前后一致。3D 表示则要求模型理解空间结构，而不是只生成 2D 外观。",
      "空间智能关注可操作的场景表示：物体在哪里、如何遮挡、相机怎么移动、动作会造成什么变化。这些能力会连接到机器人和世界模型。",
    ],
    mechanisms: [
      ["Diffusion", "模型从噪声逐步还原数据分布，训练目标通常是预测噪声或速度。"],
      ["Video Consistency", "视频模型要在时间维度保持身份和运动一致，否则会出现闪烁、漂移和物体变形。"],
      ["3D Representation", "NeRF、3D Gaussian 等方法把场景表示为可渲染空间结构，支持视角变化。"],
      ["Control", "文本、姿态、深度、相机轨迹等条件让生成结果可控，避免纯随机生成。"],
    ],
    example: "生成一段机器人拿杯子视频时，模型不仅要画出杯子，还要保持杯子位置、手的接触关系和相机视角变化一致。这就是视频生成和空间智能的交界。",
    mistakes: ["只看单帧质量。", "忽略几何和相机一致性。", "把可控条件当后处理，而不是模型设计的一部分。"],
    protocol: ["解释扩散去噪目标。", "列出时序一致性指标。", "比较 2D 与 3D 表示。", "设计一个空间关系评测。"],
  },
  omni_audio_capstone: {
    question: "怎样把文本、语音、视觉、工具和评测整合成一个完整 AI 系统？",
    core: [
      "毕业章的目标是系统整合。你不再只学一个模型能力，而是设计一个端到端 AI 产品：输入是什么、模型如何理解、工具如何执行、失败如何恢复、结果如何评测。",
      "Omni 模型强调实时多模态交互：语音、图像、视频和文本同时进入系统，延迟、turn-taking、上下文管理和安全边界都会影响体验。",
      "最终项目必须可演示、可评测、可复盘。一个好的项目说明书要同时包含任务定义、数据来源、模型选择、接口设计、评测题集和风险控制。",
    ],
    mechanisms: [
      ["Realtime", "实时系统要控制首包延迟、流式输出和打断处理。用户体验常常由延迟决定，而不只是模型能力。"],
      ["Multimodal State", "系统要维护文本、语音、视觉和工具结果的统一状态，避免各模态互相打架。"],
      ["Tool Orchestration", "工具调用需要权限、schema、错误处理和日志；模型不是直接做所有事。"],
      ["Evaluation", "毕业项目必须有固定测试集、成功标准、失败样例和回归记录。"],
    ],
    example: "一个多模态学习助手可以听学生提问、看屏幕上的代码、检索课程资料、调用评测脚本，再用语音解释错误。它的难点是把这些能力串成可靠流程。",
    mistakes: ["只做 demo，不做评测。", "只追求模型炫技，不定义用户任务。", "忽略延迟、权限和失败恢复。"],
    protocol: ["写项目任务卡。", "画系统架构图。", "列接口和工具 schema。", "准备固定评测题和失败复盘表。"],
  },
};

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

function inlineFormat(value) {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
}

function renderTutorAnswer(raw) {
  const text = String(raw || "").trim();
  if (!text) return '<p class="answer-muted">导师没有返回可显示回答。</p>';
  const lines = text.replace(/\r/g, "").split("\n");
  const html = [];
  let listType = "";

  function closeList() {
    if (listType) {
      html.push(`</${listType}>`);
      listType = "";
    }
  }

  for (const original of lines) {
    const line = original.trim();
    if (!line || /^-{3,}$/.test(line)) {
      closeList();
      continue;
    }
    const heading = line.match(/^#{1,4}\s*(.+)$/);
    if (heading) {
      closeList();
      html.push(`<h3>${inlineFormat(heading[1])}</h3>`);
      continue;
    }
    const labeled = line.match(/^(结论|解释|机制|例子|下一步|建议|注意)[:：]\s*(.+)$/);
    if (labeled) {
      closeList();
      html.push(`<h3>${escapeHtml(labeled[1])}</h3>`);
      html.push(`<p>${inlineFormat(labeled[2])}</p>`);
      continue;
    }
    const labelOnly = line.match(/^(结论|解释|机制|例子|下一步|建议|注意)[:：]$/);
    if (labelOnly) {
      closeList();
      html.push(`<h3>${escapeHtml(labelOnly[1])}</h3>`);
      continue;
    }
    const numbered = line.match(/^(\d+)[.、)]\s*(.+)$/);
    if (numbered) {
      if (listType !== "ol") {
        closeList();
        listType = "ol";
        html.push("<ol>");
      }
      html.push(`<li>${inlineFormat(numbered[2])}</li>`);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (listType !== "ul") {
        closeList();
        listType = "ul";
        html.push("<ul>");
      }
      html.push(`<li>${inlineFormat(bullet[1])}</li>`);
      continue;
    }
    closeList();
    html.push(`<p>${inlineFormat(line)}</p>`);
  }
  closeList();
  return html.join("");
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

function lectureBlueprint(module) {
  return (
    LECTURE_BLUEPRINTS[module.id] || {
      question: `怎样系统掌握「${module.title}」？`,
      core: [
        module.summary,
        `这一章要把 ${module.queries.slice(0, 4).join("、")} 这些关键词放进一个可执行学习闭环：先理解概念，再找到证据，最后完成可检查产出。`,
        "读这一章时，不要把材料当成资料列表。你要不断追问：这个概念解决什么问题，改变了哪个变量，如何用实验或项目证明自己真的掌握。",
      ],
      mechanisms: (module.outcomes || []).map((item, idx) => [`能力 ${idx + 1}`, item]),
      example: `本章的最小例子就是完成产出「${module.project}」。把它拆成输入、方法、验证和失败样例四部分，就能检查学习是否落地。`,
      mistakes: ["只背术语，不解释机制。", "只看资料，不完成产出。", "问模型太早，跳过自己组织问题的过程。"],
      protocol: ["读完核心判断。", "解释前三个关键词。", "找到一条证据材料。", "完成最小产出并复盘。"],
    }
  );
}

function conceptCards(module) {
  const blueprint = lectureBlueprint(module);
  return (module.queries || []).slice(0, 6).map((concept, idx) => {
    const checks = module.outcomes || [];
    const mechanism = blueprint.mechanisms[idx % Math.max(blueprint.mechanisms.length, 1)];
    return {
      title: concept,
      body: mechanism ? mechanism[1] : checks[idx % Math.max(checks.length, 1)] || module.summary,
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
  const blueprint = lectureBlueprint(module);
  const route = learningRoute(module);
  const concepts = conceptCards(module);
  el("lessonView").innerHTML = `
    <article class="lesson-article">
      <div class="reading-lead">
        <strong>本章要回答的问题：</strong>
        ${escapeHtml(blueprint.question)}
      </div>

      <section class="chapter-section">
        <h3>教授讲义</h3>
        ${blueprint.core.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
      </section>

      <section class="chapter-section">
        <h3>机制拆解</h3>
        <div class="route-list">
          ${blueprint.mechanisms
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
        <h3>课堂例子</h3>
        <p>${escapeHtml(blueprint.example)}</p>
      </section>

      <section class="chapter-section">
        <h3>常见误区</h3>
        <ul>
          ${blueprint.mistakes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </section>

      <section class="chapter-section">
        <h3>学习路线</h3>
        <div class="route-list">
          ${route
            .map(
              ([title, body], idx) => `
                <div class="route-item compact">
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
        <h3>阅读协议与交付</h3>
        <ol>
          ${blueprint.protocol.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ol>
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
  el("answerBox").innerHTML = '<p class="answer-muted">正在后台检索课程资料，并调用 StepFun 导师生成回答...</p>';
  try {
    const startedAt = performance.now();
    const data = await api("ask", {
      method: "POST",
      body: JSON.stringify({
        question,
        module_id: activeModule().id,
        top_k: 3,
      }),
    });
    const seconds = Math.max(0.1, (performance.now() - startedAt) / 1000).toFixed(1);
    el("answerBox").innerHTML = `<div class="answer-meta">StepFun 导师 · ${seconds}s · ${escapeHtml(data.model || "模型")}</div>${renderTutorAnswer(data.answer)}`;
  } catch (error) {
    el("answerBox").innerHTML = `<p class="answer-error">问答失败：${escapeHtml(error.message)}</p>`;
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
    el("answerBox").innerHTML = `<p class="answer-error">课程可以离线阅读；导师问答暂时连接不到公网 API：${escapeHtml(error.message)}</p>`;
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
  el("answerBox").innerHTML = '<p class="answer-muted">导师回答会显示在这里。系统会在后台检索课程资料，但不会把召回列表展示给读者。</p>';
});

load();
