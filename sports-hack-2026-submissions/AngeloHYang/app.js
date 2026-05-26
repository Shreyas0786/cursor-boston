const moments = [
  {
    ts: "00:14:02",
    quarterClock: "Q4 · 01:32",
    score: { home: 104, away: 102 },
    segment: "Pregame Crowd Build-up",
    subtitle:
      "The host is asking everyone to count down as arena lights sync with the opening show.",
    topic: "Pre-tip Emotional Momentum",
    description:
      "The broadcast is transitioning from entertainment to game focus, and crowd energy is peaking.",
    terms: ["arena energy", "countdown", "broadcast transition"],
  },
  {
    ts: "00:16:11",
    quarterClock: "Q4 · 01:08",
    score: { home: 106, away: 102 },
    segment: "Commentator Tactical Breakdown",
    subtitle:
      "The commentator expects Boston to run repeated high pick-and-roll actions to force smaller defenders into switches.",
    topic: "Crunch-Time Pick-and-Roll Pressure",
    description:
      "Boston is targeting mismatch creation in half-court offense while New York tries to protect weak-side spacing.",
    terms: ["high pick-and-roll", "mismatch", "weak-side"],
  },
  {
    ts: "00:22:43",
    quarterClock: "Q4 · 00:47",
    score: { home: 106, away: 105 },
    segment: "Fast Break Execution",
    subtitle:
      "A quick transition push creates an open corner three, and New York converts immediately.",
    topic: "Transition Pace Swing",
    description:
      "A single transition possession shifted momentum and compressed defensive reaction time.",
    terms: ["transition offense", "corner three", "defensive recovery"],
  },
  {
    ts: "00:35:05",
    quarterClock: "Q4 · 00:29",
    score: { home: 108, away: 105 },
    segment: "Sideline Medical Update",
    subtitle:
      "The sideline reporter says the starting forward is under medical evaluation and not expected to return soon.",
    topic: "Rotation Stress After Injury Report",
    description:
      "Possible absence of a starter increases bench workload and changes matchup strategy.",
    terms: ["medical evaluation", "rotation depth", "return timeline"],
  },
  {
    ts: "00:41:18",
    quarterClock: "Q4 · 00:08",
    score: { home: 110, away: 105 },
    segment: "Closing Possession",
    subtitle:
      "Boston wins the final possession battle with a strong paint finish after forcing a turnover.",
    topic: "Late-Game Possession Control",
    description:
      "Final possessions favored Boston through defensive pressure and efficient finishing.",
    terms: ["turnover pressure", "paint finish", "possession value"],
  },
];

const termDictionary = {
  "arena energy": "The overall emotional intensity of fans in the venue and online.",
  countdown: "A synchronized crowd cue often used before key transitions.",
  "broadcast transition": "A shift from one production segment to another, such as show to gameplay.",
  "high pick-and-roll": "A screen action near the top of the floor to create driving or switching advantages.",
  mismatch: "A favorable offensive matchup caused by size, speed, or skill differences.",
  "weak-side": "The side of the floor away from the ball, often used for spacing and help defense.",
  "transition offense": "Fast attack immediately after gaining possession before defense is set.",
  "corner three": "A three-point shot from the corner area, usually high-efficiency when open.",
  "defensive recovery": "How quickly defenders return to position after a transition event.",
  "medical evaluation": "A real-time health assessment by team medical staff.",
  "rotation depth": "How many reliable players can sustain team performance.",
  "return timeline": "Estimated window for an injured player to re-enter the game.",
  "turnover pressure": "Defensive pressure that increases the chance of ball-loss mistakes.",
  "paint finish": "Scoring at the rim or inside area near the basket.",
  "possession value": "Expected scoring impact of a single offensive possession.",
};

const state = {
  index: 0,
  autoMode: true,
  autoTimer: null,
  progress: 42,
};

const homeScoreEl = document.getElementById("homeScore");
const awayScoreEl = document.getElementById("awayScore");
const gameClockEl = document.getElementById("gameClock");
const topicTitleEl = document.getElementById("topicTitle");
const topicDescriptionEl = document.getElementById("topicDescription");
const overlayTitleEl = document.getElementById("overlayTitle");
const overlaySubEl = document.getElementById("overlaySub");
const streamTimeEl = document.getElementById("streamTime");
const progressFillEl = document.getElementById("progressFill");
const transcriptListEl = document.getElementById("transcriptList");
const termPanelEl = document.getElementById("termPanel");
const termDetailEl = document.getElementById("termDetail");
const toggleAutoEl = document.getElementById("toggleAuto");
const nextMomentEl = document.getElementById("nextMoment");
const chatLogEl = document.getElementById("chatLog");
const suggestionsEl = document.getElementById("suggestions");
const questionInputEl = document.getElementById("questionInput");
const askBtnEl = document.getElementById("askBtn");
const answerBoxEl = document.getElementById("answerBox");
const timelineEl = document.getElementById("timeline");
const confidencePillEl = document.getElementById("confidencePill");

const suggestionPrompts = [
  "Why does the AI call this a mismatch attack?",
  "What changed after the injury update?",
  "Which subtitle supports this topic summary?",
];

function highlightTerms(text, terms) {
  let result = text;
  terms.forEach((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
    result = result.replace(new RegExp(escaped, "gi"), (match) => `<mark>${match}</mark>`);
  });
  return result;
}

function pushTranscript(frame) {
  const li = document.createElement("li");
  li.innerHTML = `<span class="stamp">${frame.ts}</span><p>${highlightTerms(frame.subtitle, frame.terms)}</p>`;
  transcriptListEl.prepend(li);

  while (transcriptListEl.children.length > 8) {
    transcriptListEl.removeChild(transcriptListEl.lastChild);
  }
}

function renderTerms(frame) {
  termPanelEl.innerHTML = "";
  frame.terms.forEach((term) => {
    const button = document.createElement("button");
    button.className = "term";
    button.textContent = term;
    button.addEventListener("click", () => {
      termDetailEl.textContent = `${term}: ${termDictionary[term] || "Definition coming soon."}`;
    });
    termPanelEl.appendChild(button);
  });
}

function renderTop(frame) {
  homeScoreEl.textContent = String(frame.score.home);
  awayScoreEl.textContent = String(frame.score.away);
  gameClockEl.textContent = frame.quarterClock;
  topicTitleEl.textContent = frame.topic;
  topicDescriptionEl.textContent = frame.description;
  overlayTitleEl.textContent = `Current Segment: ${frame.segment}`;
  overlaySubEl.textContent = frame.description;
  streamTimeEl.textContent = frame.ts;
}

function addTimelineEvidence(frame, confidence) {
  const li = document.createElement("li");
  li.innerHTML = `<strong>${frame.ts}</strong> · Subtitle evidence: ${frame.subtitle}<br>Video anchor: ${frame.ts} - ${shiftTime(frame.ts, 7)} (mock visual lookup)`;
  timelineEl.prepend(li);
  confidencePillEl.textContent = `Answer Confidence: ${confidence}%`;
}

function shiftTime(ts, plusSeconds) {
  const [h, m, s] = ts.split(":").map(Number);
  const total = h * 3600 + m * 60 + s + plusSeconds;
  const hh = String(Math.floor(total / 3600)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function buildAiAnswer(question, frame) {
  const q = question.toLowerCase();

  if (q.includes("mismatch") || q.includes("pick-and-roll")) {
    return {
      text:
        "The subtitle at 00:16:11 explicitly mentions high pick-and-roll and switch pressure. That indicates Boston is trying to force weaker on-ball defenders into mismatches on purpose.",
      confidence: 89,
    };
  }

  if (q.includes("injury") || q.includes("return")) {
    return {
      text:
        "At 00:35:05, the sideline report says the starter is under medical evaluation and unlikely to return soon. That pushes extra minutes onto bench players and changes late-game matchups.",
      confidence: 92,
    };
  }

  if (q.includes("transition") || q.includes("corner three")) {
    return {
      text:
        "The transcript at 00:22:43 links a transition push to an open corner three. The likely cause is delayed defensive recovery while defenders are still matching assignments.",
      confidence: 86,
    };
  }

  return {
    text:
      `From the current topic (${frame.topic}), the most relevant subtitle evidence is: "${frame.subtitle}". If you ask with a tactical term, I can return a more precise explanation.`,
    confidence: 74,
  };
}

function appendChat(role, text) {
  const div = document.createElement("div");
  div.className = "msg";
  div.innerHTML = `<strong>${role}:</strong> ${text}`;
  chatLogEl.appendChild(div);
  chatLogEl.scrollTop = chatLogEl.scrollHeight;
}

function renderSuggestions() {
  suggestionsEl.innerHTML = "";
  suggestionPrompts.forEach((prompt) => {
    const chip = document.createElement("button");
    chip.className = "suggestion";
    chip.textContent = prompt;
    chip.addEventListener("click", () => {
      questionInputEl.value = prompt;
      questionInputEl.focus();
    });
    suggestionsEl.appendChild(chip);
  });
}

function nextMoment() {
  state.index = (state.index + 1) % moments.length;
  const frame = moments[state.index];
  state.progress = Math.min(96, state.progress + 11);
  progressFillEl.style.width = `${state.progress}%`;

  renderTop(frame);
  renderTerms(frame);
  pushTranscript(frame);
}

function askQuestion() {
  const question = questionInputEl.value.trim();
  if (!question) {
    answerBoxEl.textContent = "Please type a question first.";
    return;
  }

  const frame = moments[state.index];
  const result = buildAiAnswer(question, frame);

  appendChat("Fan", question);
  appendChat("AI", result.text);
  answerBoxEl.textContent = result.text;
  addTimelineEvidence(frame, result.confidence);

  questionInputEl.value = "";
}

function setAutoMode(enabled) {
  state.autoMode = enabled;
  toggleAutoEl.textContent = `Auto: ${enabled ? "On" : "Off"}`;

  if (state.autoTimer) {
    clearInterval(state.autoTimer);
    state.autoTimer = null;
  }

  if (enabled) {
    state.autoTimer = setInterval(nextMoment, 6000);
  }
}

nextMomentEl.addEventListener("click", nextMoment);
askBtnEl.addEventListener("click", askQuestion);
questionInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    askQuestion();
  }
});

toggleAutoEl.addEventListener("click", () => {
  setAutoMode(!state.autoMode);
});

function initialize() {
  const first = moments[0];
  renderTop(first);
  renderTerms(first);
  transcriptListEl.innerHTML = "";
  pushTranscript(first);

  timelineEl.innerHTML = "<li><strong>System</strong> · Timeline evidence will appear after the first AI answer.</li>";
  appendChat("System", "Welcome to PulseLens Broadcast Mock. Ask anything about the live moment.");
  renderSuggestions();
  setAutoMode(true);
}

initialize();
