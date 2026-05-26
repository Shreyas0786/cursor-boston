const streamFrames = [
  {
    ts: "00:14:02",
    scene: "Pregame Performance",
    subtitle:
      "现场舞台灯光点亮，开场表演进入高潮，主持人邀请观众一起倒计时。",
    tags: ["stage", "countdown", "crowd"],
    terms: ["开场表演", "倒计时", "主场氛围"],
    news: {
      title: "开场热度拉满，现场进入正式比赛前最高情绪区间",
      bullets: [
        "节目已进入最后段落，比赛即将开始。",
        "主持人正在引导全场互动，观众注意力集中。",
        "对线上观众而言，这是判断转场节点的关键时刻。",
      ],
    },
  },
  {
    ts: "00:16:11",
    scene: "Commentator Analysis",
    subtitle:
      "解说提到主队将大量使用高位挡拆，通过错位制造中距离出手机会。",
    tags: ["commentary", "tactics", "pick-and-roll"],
    terms: ["高位挡拆", "错位", "中距离"],
    news: {
      title: "战术前瞻明确：主队首节或主打高位挡拆",
      bullets: [
        "解说给出首节核心策略，强调持球点与掩护质量。",
        "若成功制造错位，主队将优先攻击弱侧防守人。",
        "这类信息适合实时转为观赛提示，帮助新手理解战术。",
      ],
    },
  },
  {
    ts: "00:22:43",
    scene: "Game Action",
    subtitle:
      "这次转换进攻非常快，后卫推进后直接找到底角空位，三分命中。",
    tags: ["transition", "corner-three", "highlight"],
    terms: ["转换进攻", "底角三分", "空位"],
    news: {
      title: "节奏突变：客队通过转换进攻打出关键三分",
      bullets: [
        "回合速度明显提升，防守回位出现短暂断层。",
        "底角空间被精准利用，形成高质量投篮。",
        "这类回合通常会直接影响双方暂停和轮换决策。",
      ],
    },
  },
  {
    ts: "00:35:05",
    scene: "Injury / Recovery Update",
    subtitle:
      "场边记者更新消息：主力前锋正在接受队医评估，预计短时间内不会回归。",
    tags: ["sideline", "injury-report", "rotation"],
    terms: ["队医评估", "轮换压力", "回归时间"],
    news: {
      title: "突发人员变动：主力前锋暂时无法回归",
      bullets: [
        "医疗评估进行中，短期回归预期偏低。",
        "主队轮换深度将受到直接挑战。",
        "解说后续可能重点讨论替补阵容匹配。",
      ],
    },
  },
];

const termDict = {
  开场表演: "比赛前的娱乐环节，用于提升观众情绪和仪式感。",
  倒计时: "赛前统一节奏动作，常用于引导现场和线上观众注意力。",
  主场氛围: "主场观众制造的心理与声量优势。",
  高位挡拆: "掩护发生在三分线附近，目标是制造突破或错位机会。",
  错位: "进攻方让防守方出现身高、速度或力量不匹配。",
  中距离: "大致位于禁区外、三分线内的投篮区域。",
  转换进攻: "攻防转换中的快速进攻，通常在对方落位前完成终结。",
  底角三分: "球场底角区域的三分投篮，通常空间更好。",
  空位: "投篮时防守干扰较小的状态。",
  队医评估: "由医疗团队即时判断伤病风险和回归可能性。",
  轮换压力: "主力缺席导致替补承担更多分钟与对位任务。",
  回归时间: "球员重新上场的预估时间窗口。",
};

const subtitleBox = document.getElementById("subtitleBox");
const sceneTags = document.getElementById("sceneTags");
const nextSubtitleBtn = document.getElementById("nextSubtitle");
const sceneBadge = document.getElementById("sceneBadge");
const clockBadge = document.getElementById("clockBadge");
const newsTitle = document.getElementById("newsTitle");
const newsBullets = document.getElementById("newsBullets");
const termPanel = document.getElementById("termPanel");
const termDetail = document.getElementById("termDetail");
const questionInput = document.getElementById("questionInput");
const askBtn = document.getElementById("askBtn");
const answerBox = document.getElementById("answerBox");
const timeline = document.getElementById("timeline");
const confidencePill = document.getElementById("confidencePill");

const state = {
  index: 0,
};

function renderFrame(frame) {
  clockBadge.textContent = frame.ts;
  sceneBadge.textContent = `Scene: ${frame.scene}`;
  subtitleBox.textContent = frame.subtitle;

  sceneTags.innerHTML = "";
  frame.tags.forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = tag;
    sceneTags.appendChild(chip);
  });

  newsTitle.textContent = frame.news.title;
  newsBullets.innerHTML = "";
  frame.news.bullets.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    newsBullets.appendChild(li);
  });

  termPanel.innerHTML = "";
  frame.terms.forEach((term) => {
    const btn = document.createElement("button");
    btn.className = "term";
    btn.textContent = term;
    btn.addEventListener("click", () => {
      termDetail.textContent = `${term}: ${termDict[term] || "暂无解释"}`;
    });
    termPanel.appendChild(btn);
  });
}

function addEvidenceLine(ts, subtitle, confidence) {
  const li = document.createElement("li");
  li.innerHTML = `<strong>${ts}</strong> · 字幕证据: ${subtitle}<br>视频锚点: ${ts} - ${timeShift(ts, 6)} (vLLM visual retrieval mock)`;
  timeline.prepend(li);
  confidencePill.textContent = `Answer Confidence: ${confidence}%`;
}

function timeShift(ts, plusSec) {
  const [hh, mm, ss] = ts.split(":").map(Number);
  const base = hh * 3600 + mm * 60 + ss + plusSec;
  const h = String(Math.floor(base / 3600)).padStart(2, "0");
  const m = String(Math.floor((base % 3600) / 60)).padStart(2, "0");
  const s = String(base % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function buildAnswer(question, frame) {
  const q = question.toLowerCase();

  if (q.includes("高位挡拆") || q.includes("挡拆")) {
    return {
      text:
        "从当前字幕看，解说强调通过高位挡拆制造错位。系统在 00:16:11 定位到该术语，并在后续回合中检索到持球人与内线掩护的联动片段，因此判断这是球队首节重点战术。",
      confidence: 88,
    };
  }

  if (q.includes("受伤") || q.includes("回归")) {
    return {
      text:
        "字幕证据显示场边记者在 00:35:05 更新了队医评估，关键词是\"短时间内不会回归\"。结合时间锚点检索到球员持续留在替补席画面，系统给出短期回归概率较低的回答。",
      confidence: 91,
    };
  }

  if (q.includes("三分") || q.includes("转换")) {
    return {
      text:
        "系统在 00:22:43 捕捉到\"转换进攻 + 底角空位三分\"组合术语，并在视频时间轴回溯到防守未及时落位的镜头，因此判定该球来自攻防转换中的空间利用。",
      confidence: 86,
    };
  }

  return {
    text:
      `基于当前场景 ${frame.scene} 的字幕证据，系统已匹配到最相关片段并给出解释：${frame.subtitle}。如果你指定术语（如高位挡拆/底角三分/回归时间），答案会更精准。`,
    confidence: 73,
  };
}

nextSubtitleBtn.addEventListener("click", () => {
  state.index = (state.index + 1) % streamFrames.length;
  renderFrame(streamFrames[state.index]);
});

askBtn.addEventListener("click", () => {
  const q = questionInput.value.trim();
  const frame = streamFrames[state.index];
  if (!q) {
    answerBox.textContent = "请输入问题后再提问。";
    confidencePill.textContent = "Answer Confidence: -";
    return;
  }

  const result = buildAnswer(q, frame);
  answerBox.textContent = result.text;
  addEvidenceLine(frame.ts, frame.subtitle, result.confidence);
});

renderFrame(streamFrames[0]);
timeline.innerHTML = "<li><strong>System</strong> · 时间轴等待第一条问答证据...</li>";
