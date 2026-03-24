const Groq = require("groq-sdk");
const Course = require("../models/course");
const {
  getBasicContext,
  getCourseSpecificContext,
} = require("./contextService");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});
const MAX_COMBINED_CONTEXT_LENGTH = 2400;
const RESPONSE_FORMAT_INSTRUCTIONS = `Response formatting rules:

## Use headings with ##
- Use bullet points (-) where helpful
- Use short paragraphs
- Add spacing between sections
- Keep answers clean and readable
- Do NOT return one large paragraph
- Always respond in clear markdown-like structure`;

function formatHistory(history = []) {
  return history
    .slice(-10)
    .map((entry) => {
      const speaker = entry?.sender === "user" ? "User" : "AI";
      return `${speaker}: ${entry?.text || ""}`;
    })
    .join("\n");
}

function trimContext(context = "", maxLength = MAX_COMBINED_CONTEXT_LENGTH) {
  if (context.length <= maxLength) {
    return context;
  }

  return `${context.slice(0, maxLength).trim()}...`;
}

function formatWeaknesses(weaknesses) {
  if (Array.isArray(weaknesses)) {
    return weaknesses.filter(Boolean).join(", ") || "None specified";
  }

  return weaknesses || "None specified";
}

function extractGoalKeywords(goal = "") {
  return goal
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 2);
}

async function getRelevantCoursesForGoal(goal = "") {
  const keywords = extractGoalKeywords(goal);

  try {
    const matchedCourses = keywords.length
      ? await Course.find(
          {
            $or: [
              { courseName: { $regex: keywords.join("|"), $options: "i" } },
              { courseDescription: { $regex: keywords.join("|"), $options: "i" } },
              { whatYouWillLearn: { $regex: keywords.join("|"), $options: "i" } },
            ],
          },
          "courseName courseDescription whatYouWillLearn"
        )
          .limit(4)
          .lean()
      : await Course.find(
          {},
          "courseName courseDescription whatYouWillLearn"
        )
          .limit(3)
          .lean();

    return matchedCourses;
  } catch (error) {
    console.error("Relevant course lookup error:", error);
    return [];
  }
}

function formatAvailableCourses(courses = []) {
  if (!courses.length) {
    return "No matching platform courses found.";
  }

  return courses
    .map((course, index) => {
      const summary =
        course.whatYouWillLearn || course.courseDescription || "No description available.";

      return `${index + 1}. ${course.courseName}\n   Summary: ${trimContext(summary, 180)}`;
    })
    .join("\n");
}

function normalizeStudyPlan(parsed) {
  const weeks = Array.isArray(parsed?.weeks)
    ? parsed.weeks.map((weekItem, weekIndex) => ({
        week:
          typeof weekItem?.week === "number" ? weekItem.week : weekIndex + 1,
        days: Array.isArray(weekItem?.days)
          ? weekItem.days.map((dayItem, dayIndex) => ({
              day:
                typeof dayItem?.day === "number" ? dayItem.day : dayIndex + 1,
              topic: dayItem?.topic || "",
              practice: dayItem?.practice || "",
              completed: Boolean(dayItem?.completed),
            }))
          : [],
        revision: weekItem?.revision || "",
        notes: weekItem?.notes || "",
      }))
    : [];

  return {
    strategy: parsed?.strategy || "",
    weeks,
    recommendedCourses: Array.isArray(parsed?.recommendedCourses)
      ? parsed.recommendedCourses.map((course) => ({
          name:
            typeof course === "string"
              ? course
              : course?.name || "",
          reason:
            typeof course === "string"
              ? ""
              : course?.reason || "",
        }))
      : [],
  };
}

function parseJSONSafely(content = "") {
  const normalizedContent = content
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    const parsed = JSON.parse(normalizedContent);

    if (!parsed || !Array.isArray(parsed.weeks)) {
      throw new Error("Invalid study plan shape");
    }

    return normalizeStudyPlan(parsed);
  } catch (error) {
    console.error("Study plan JSON parse error:", error);
    return {
      strategy: "",
      weeks: [],
      recommendedCourses: [],
    };
  }
}

async function generateAIResponse(message, history = [], courseId = null) {
  try {
    let context = "";

    if (courseId) {
      const [courseContext, platformContext] = await Promise.all([
        getCourseSpecificContext(courseId),
        getBasicContext(message),
      ]);

      context = trimContext(
        `Course Context:\n${courseContext}\n\nPlatform Context:\n${platformContext}`
      );
    } else {
      context = await getBasicContext(message);
    }

    const formattedHistory = formatHistory(history);
    const prompt = courseId
      ? `You are an AI tutor.

Use these rules:
- Use course context for course-related questions
- Use platform context for general questions
- If the question is outside the course, clearly say it is not covered in the course content

${RESPONSE_FORMAT_INSTRUCTIONS}

${context}

Chat History:
${formattedHistory || "No previous chat history."}

User Question:
${message}`
      : `System:
You are an AI tutor for Sarthi. Answer only using platform context when possible.
If answer is not in context, answer generally but mention it's not from platform.

${RESPONSE_FORMAT_INSTRUCTIONS}

Context:

${context}

Chat History:

${formattedHistory || "No previous chat history."}

User Question:

${message}`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "user", content: prompt },
      ],
      model: "llama-3.3-70b-versatile",
    });

    return chatCompletion.choices[0]?.message?.content || "No response";
  } catch (error) {
    console.error("AI service error:", error);
    throw error;
  }
}

async function generateStudyPlan(data = {}) {
  try {
    const { goal, duration, dailyHours, level, weaknesses } = data;
    const availableCourses = await getRelevantCoursesForGoal(goal);
    const availableCoursesText = formatAvailableCourses(availableCourses);

    const prompt = `You are an expert mentor.

Create a structured study plan based on:

Goal: ${goal || "Not specified"}
Duration: ${duration || "Not specified"}
Daily Time: ${dailyHours || "Not specified"} hours/day
Level: ${level || "Not specified"}
Weaknesses: ${formatWeaknesses(weaknesses)}

Available courses: ${availableCoursesText}

Requirements:

* Divide into weeks
* Each week MUST include a daily breakdown (Day 1-7)
* For each day, specify the topic, a practice task, and estimated time
* Include weekly revision
* Keep realistic and balanced
* Use the daily hours (${dailyHours || "Not specified"} hours/day) to limit topics per day and avoid overload.
* Do not assign more work than the user can complete in the given daily hours.
* Personalize for Level (${level || "Not specified"}):
  - If beginner: Focus on basics, fundamentals, and maintain a slower pace.
  - If advanced: Assume basics are known, move fast, and dive into deeper, advanced topics.
${weaknesses && weaknesses.length > 0 ? `* Personalize for Weaknesses (${formatWeaknesses(weaknesses)}):
  - Actively allocate extra time and focused practice days specifically for these weak topics.` : ""}
* Recommend relevant available courses when useful.
* In recommendedCourses, return objects with "name" and "reason".
* You may align topics with available courses when it helps, but keep the plan simple.

Return ONLY valid JSON. No extra text.

Use this exact format:
{
  "strategy": "A short, meaningful explanation of why the topics are ordered this way and how the user's specific weaknesses are handled in the plan.",
  "recommendedCourses": [
    {
      "name": "Course name",
      "reason": "Why this course fits the user's goal"
    }
  ],
  "weeks": [
    {
      "week": 1,
      "days": [
        {
          "day": 1,
          "topic": "Specific topic to study",
          "practice": "Practice task description",
          "completed": false
        }
      ],
      "revision": "Weekly revision or summary",
      "notes": "Additional notes"
    }
  ]
}`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
    });

    const responseText = chatCompletion.choices[0]?.message?.content || "";
    return parseJSONSafely(responseText);
  } catch (error) {
    console.error("Study planner AI error:", error);
    throw error;
  }
}

async function adaptStudyPlan(plan, message = "") {
  try {
    const prompt = `You are an expert mentor.

This is the current study plan:
${JSON.stringify(plan, null, 2)}

User update: ${message || "No update provided"}

Update the plan:

* redistribute incomplete tasks
* do not overload future days
* keep structure same
* maintain completed tasks

Return updated JSON only`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
    });

    const responseText = chatCompletion.choices[0]?.message?.content || "";
    return parseJSONSafely(responseText);
  } catch (error) {
    console.error("Study plan adapt AI error:", error);
    throw error;
  }
}

module.exports = {
  generateAIResponse,
  generateStudyPlan,
  adaptStudyPlan,
};
