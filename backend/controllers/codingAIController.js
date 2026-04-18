const crypto = require("crypto");

// Simple In-Memory Cache (TTL: 5 mins)
const aiCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

// Cleanup interval to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of aiCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      aiCache.delete(key);
    }
  }
}, 60000);

exports.getAICodeHelp = async (req, res) => {
  try {
    let { problemDescription, userCode, errorMessage, language, userQuestion, testId, problemId } = req.body;

    // GUARD 1: Prevent usage in exam mode
    if (testId) {
      return res.status(403).json({
        success: false,
        message: "AI assistant is strictly disabled during coding exams."
      });
    }

    if (!userQuestion || !problemDescription) {
      return res.status(400).json({
        success: false,
        message: "Question and problem description are required."
      });
    }

    // GUARD 2: Max Payload Size to protect token limits
    if (userCode && userCode.length > 8000) {
      userCode = userCode.slice(0, 8000) + "\n...[truncated]";
    }
    if (problemDescription && problemDescription.length > 8000) {
      problemDescription = problemDescription.slice(0, 8000) + "\n...[truncated]";
    }
    if (errorMessage && errorMessage.length > 4000) {
      errorMessage = errorMessage.slice(0, 4000) + "\n...[truncated]";
    }

    // Cache Hash Generation
    const cacheString = `${problemId}_${userCode}_${errorMessage}_${userQuestion}_${language}`;
    const cacheKey = crypto.createHash("sha256").update(cacheString).digest("hex");

    // Serve from Cache
    if (aiCache.has(cacheKey)) {
      const cached = aiCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return res.status(200).json({
          success: true,
          data: cached.data,
          cached: true
        });
      } else {
        aiCache.delete(cacheKey);
      }
    }

    // Construct Strict Mentor Prompt
    const prompt = `You are a strict but helpful programming mentor for a student.

Do NOT give full solutions.

You may:
- explain errors
- give hints
- analyze complexity
- suggest direction
- provide small, localized code snippets for syntax clarification

You must NOT output a full working solution to the problem. If the student asks for the full code, politely decline and offer a foundational concept instead. Keep your response formatting clean and use Markdown.

Problem Context:
${problemDescription}

Language: ${language || 'Unknown'}

Student Code:
\`\`\`${language}
${userCode || 'No code provided.'}
\`\`\`

Error / Output Status:
${errorMessage || 'None'}

Student Action / Question:
${userQuestion}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openrouter/free", // Or a preferred model
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      console.error("OPENROUTER AI ERROR:", response.status, response.statusText);
      return res.status(502).json({
        success: false,
        message: "AI service is currently unavailable. Please try again later."
      });
    }

    const data = await response.json();
    const aiResponseText = data.choices?.[0]?.message?.content || "I couldn't process this right now.";

    // Save to Cache
    aiCache.set(cacheKey, {
      data: aiResponseText,
      timestamp: Date.now()
    });

    // Logging (Non-blocking)
    console.log("[AI_MENTOR_USAGE]", {
      userId: req.user.id,
      problemId: problemId || "Unknown",
      language,
      questionPrefix: userQuestion.slice(0, 50),
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      data: aiResponseText
    });

  } catch (error) {
    console.error("AI MENTOR CONTROLLER ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error connecting to AI Mentor."
    });
  }
};
