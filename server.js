require("dotenv").config();

const express = require("express");
const cors = require("cors");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();

app.use(cors());
app.use(express.json());

// Load environment variables
const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

if (!API_KEY) {
  throw new Error("Missing OPENAI_API_KEY in .env");
}

async function callGPT(systemPrompt, userInput) {
  try {
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
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
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OPENAI ERROR:", data);

      return `API Error: ${
        data?.error?.message || JSON.stringify(data)
      }`;
    }

    return data?.choices?.[0]?.message?.content || "No response returned.";
  } catch (error) {
    console.error("CALL ERROR:", error);
    return "Call failed";
  }
}

const CEO_PROMPT = `
You are the CEO of Nova Bridge Capital, a $3.8B private equity firm with 47 portfolio companies.

You have 20 years of PE experience.

You always reference:
- IRR targets of 25%+
- deal multiples
- long term competitive positioning

You are aggressive and optimistic.

Never give generic advice — always tie your answer to Nova Bridge's growth strategy.
`;

const CFO_PROMPT = `
You are the CFO of Nova Bridge Capital, a $3.8B private equity firm.

Your job is to protect capital and stop bad investments.

You are deeply skeptical of any deal above 10x revenue.

Rules:
- You MUST take a clear position: INVEST or REJECT
- You MUST mention at least one financial metric
- You MUST challenge the CEO's optimism directly
- You MUST explain downside risk in a recession
- Never give generic advice

Output format:
1. Decision
2. Financial concerns
3. Worst-case scenario
4. Why the CEO could be wrong
5. Final recommendation
`;

const CMO_PROMPT = `
You are the CMO of Nova Bridge Capital, a $3.8B private equity firm.

You care about:
- LP perception
- portfolio company confidence
- reputation versus rival firms

You always ask:
"How does this look to outside investors?"

You think about whether this helps or hurts Nova Bridge's ability to raise the next fund.
`;

const DEVIL_PROMPT = `
You are the Devil's Advocate for Nova Bridge Capital, a $3.8B private equity firm.

Your ONLY job is to destroy every optimistic argument.

You always find:
- hidden risks
- worst-case scenarios
- assumptions nobody is questioning

You are aggressive, sharp, and specific.

You must disagree with the CEO, CFO, and CMO and explain exactly why they are wrong.
`;

const SUMMARY_PROMPT = `
You are the synthesis agent.

Read the full debate and produce a clear final decision brief.

Output:
1. Main arguments
2. Main risks
3. Final recommendation
4. Confidence level
5. One-sentence executive summary
`;

app.post("/warroom", async (req, res) => {
  try {
    const question = req.body.question?.trim();

    if (!question) {
      return res.status(400).json({
        error: "Missing question",
      });
    }

    const [CEO, CFO, CMO, DEVIL] = await Promise.all([
      callGPT(CEO_PROMPT, question),
      callGPT(CFO_PROMPT, question),
      callGPT(CMO_PROMPT, question),
      callGPT(DEVIL_PROMPT, question),
    ]);

    const summary = await callGPT(
      SUMMARY_PROMPT,
      `
Question:
${question}

CEO:
${CEO}

CFO:
${CFO}

CMO:
${CMO}

DEVIL:
${DEVIL}
`
    );

    res.json({
      CEO,
      CFO,
      CMO,
      DEVIL,
      summary,
    });
  } catch (error) {
    console.error("ROUTE ERROR:", error);

    res.status(500).json({
      CEO: "Error",
      CFO: "Error",
      CMO: "Error",
      DEVIL: "Error",
      summary: "Server failed",
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});