require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

if (!API_KEY) {
  throw new Error("Missing OPENAI_API_KEY in .env");
}

async function callGPT(systemPrompt, userInput) {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userInput },
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OPENAI ERROR:", data);
      return `API Error: ${JSON.stringify(data)}`;
    }

    return data?.choices?.[0]?.message?.content || "No response returned.";
  } catch (error) {
    console.error("CALL ERROR:", error);
    return "Call failed";
  }
}

/* =========================
   VERSION 1 PROMPTS
========================= */

const CEO_PROMPT_V1 = `You are the CEO. Give strategic business advice.`;

const CFO_PROMPT_V1 = `You are the CFO. Discuss financial concerns.`;

const CMO_PROMPT_V1 = `You are the CMO. Discuss marketing and reputation.`;

const DEVIL_PROMPT_V1 = `You are the Devil's Advocate. Find risks.`;

/* =========================
   VERSION 2 PROMPTS
========================= */

const CEO_PROMPT_V2 = `You are the CEO of Nova Bridge Capital, a $3.8B private equity firm with 47 portfolio companies.

You are aggressive, strategic, and focused on long-term competitive advantage.

You always:
- Think boldly
- Reference growth strategy
- Discuss IRR and market positioning
- Push for ambitious moves

Never give generic advice.`;

const CFO_PROMPT_V2 = `You are the CFO of Nova Bridge Capital.

You are skeptical and financially disciplined.

You always:
- Mention financial risks
- Analyze valuation multiples
- Discuss recession scenarios
- Challenge aggressive assumptions

You MUST take a clear position: INVEST or REJECT.`;

const CMO_PROMPT_V2 = `You are the CMO of Nova Bridge Capital.

You focus on:
- brand reputation
- customer trust
- LP perception
- market positioning

You evaluate whether decisions improve or damage Nova Bridge's public image.`;

const DEVIL_PROMPT_V2 = `You are the Devil's Advocate.

Your ONLY job is to attack every optimistic argument.

You:
- find hidden risks
- expose weak assumptions
- challenge all other agents
- assume the deal could fail badly`;

const SUMMARY_PROMPT = `You are the synthesis agent.

Read the full debate and provide:

1. Main arguments
2. Main risks
3. Final recommendation
4. Confidence level
5. Executive summary`;

app.post("/warroom", async (req, res) => {
  try {
    const question = req.body.question?.trim();
    const version = req.body.version || "v2";

    if (!question) {
      return res.status(400).json({
        error: "Missing question"
      });
    }

    const CEO_PROMPT =
      version === "v1" ? CEO_PROMPT_V1 : CEO_PROMPT_V2;

    const CFO_PROMPT =
      version === "v1" ? CFO_PROMPT_V1 : CFO_PROMPT_V2;

    const CMO_PROMPT =
      version === "v1" ? CMO_PROMPT_V1 : CMO_PROMPT_V2;

    const DEVIL_PROMPT =
      version === "v1" ? DEVIL_PROMPT_V1 : DEVIL_PROMPT_V2;

    const [CEO, CFO, CMO, DEVIL] = await Promise.all([
      callGPT(CEO_PROMPT, question),
      callGPT(CFO_PROMPT, question),
      callGPT(CMO_PROMPT, question),
      callGPT(DEVIL_PROMPT, question),
    ]);

    const summary = await callGPT(
      SUMMARY_PROMPT,
      `Question: ${question}

CEO:
${CEO}

CFO:
${CFO}

CMO:
${CMO}

Devil:
${DEVIL}`
    );

    res.json({
      CEO,
      CFO,
      CMO,
      DEVIL,
      summary
    });

  } catch (error) {
    console.error("ROUTE ERROR:", error);

    res.status(500).json({
      error: "Server failed"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});