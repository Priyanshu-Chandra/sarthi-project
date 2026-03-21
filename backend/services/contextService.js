const Course = require("../models/course");

const STOP_WORDS = new Set([
  "the",
  "is",
  "what",
  "which",
  "a",
  "an",
  "of",
  "to",
  "in",
  "and",
  "for",
]);
const MAX_DESCRIPTION_LENGTH = 200;
const MAX_CONTEXT_LENGTH = 1200;

function extractKeywords(query = "") {
  const cleanedKeywords = query
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word));

  return cleanedKeywords;
}

function calculateRelevanceScore(course, keywords) {
  const courseName = course.courseName || "";
  const courseDescription = course.courseDescription || "";

  return keywords.reduce((score, keyword) => {
    const keywordRegex = new RegExp(keyword, "i");
    const matchesName = keywordRegex.test(courseName);
    const matchesDescription = keywordRegex.test(courseDescription);

    return matchesName || matchesDescription ? score + 1 : score;
  }, 0);
}

function truncateText(text = "", maxLength = MAX_DESCRIPTION_LENGTH) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

function formatCourses(courses) {
  const formattedContext = courses
    .map(
      (course) =>
        `Course: ${course.courseName}\nDescription: ${truncateText(course.courseDescription || "")}`
    )
    .join("\n\n");

  return formattedContext.slice(0, MAX_CONTEXT_LENGTH).trim();
}

async function getFallbackContext() {
  const popularCourses = await Course.aggregate([
    {
      $project: {
        courseName: 1,
        courseDescription: 1,
        popularity: { $size: { $ifNull: ["$studentsEnrolled", []] } },
      },
    },
    { $sort: { popularity: -1 } },
    { $limit: 2 },
  ]);

  const platformDescription =
    "Platform: Sarthi\nDescription: Sarthi is a learning platform where students can explore courses, enroll in them, and learn from instructors through structured course content.";

  if (popularCourses.length === 0) {
    return platformDescription;
  }

  return `${platformDescription}\n\nPopular Courses:\n\n${formatCourses(popularCourses)}`;
}

async function getCourseSpecificContext(courseId) {
  if (!courseId) {
    return "";
  }

  try {
    const course = await Course.findById(courseId)
      .populate({
        path: "courseContent",
        populate: {
          path: "subSection",
        },
      })
      .lean();

    if (!course) {
      return "";
    }

    const sections = (course.courseContent || [])
      .map((section) => {
        const topics = (section.subSection || [])
          .map((subSection) => {
            const topicTitle = subSection.title || "Untitled Topic";
            const topicDescription = truncateText(subSection.description || "", 120);

            return topicDescription
              ? `  * ${topicTitle}: ${topicDescription}`
              : `  * ${topicTitle}`;
          })
          .join("\n");

        return topics
          ? `* ${section.sectionName || "Untitled Section"}\n${topics}`
          : `* ${section.sectionName || "Untitled Section"}`;
      })
      .join("\n");

    return [
      `Course: ${course.courseName || "Untitled Course"}`,
      `Description: ${truncateText(course.courseDescription || "")}`,
      "Sections:",
      sections || "* No sections available",
    ].join("\n");
  } catch (error) {
    console.error("Error fetching course-specific context:", error);
    return "";
  }
}

async function getBasicContext(query = "", courseId = null) {
  try {
    let focusCourseContext = "";
    if (courseId) {
      try {
        const focusCourse = await Course.findById(
          courseId,
          "courseName courseDescription"
        ).lean();
        if (focusCourse) {
          focusCourseContext = `Current Page Course: ${
            focusCourse.courseName
          }\nDescription: ${truncateText(focusCourse.courseDescription || "")}`;
        }
      } catch (err) {
        console.error("Error fetching focus course:", err);
      }
    }

    const keywords = extractKeywords(query);

    if (keywords.length === 0) {
      const fallback = await getFallbackContext();
      return focusCourseContext
        ? `${focusCourseContext}\n\nRelated:\n${fallback}`
        : fallback;
    }

    const keywordPattern = keywords.join("|");

    // Perform a targeted DB search matching either name or description.
    const matchedCourses = await Course.find(
      {
        $or: [
          { courseName: { $regex: keywordPattern, $options: "i" } },
          { courseDescription: { $regex: keywordPattern, $options: "i" } },
        ],
      },
      "courseName courseDescription"
    )
      .limit(5)
      .lean();

    if (matchedCourses.length === 0) {
      const fallback = await getFallbackContext();
      return focusCourseContext
        ? `${focusCourseContext}\n\nRelated:\n${fallback}`
        : fallback;
    }

    const filteredCourses = matchedCourses
      .filter((c) => c._id.toString() !== courseId)
      .map((course) => ({
        ...course,
        score: calculateRelevanceScore(course, keywords),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const relatedContext = formatCourses(filteredCourses);

    return focusCourseContext
      ? `Main Subject:\n${focusCourseContext}\n\nOther Related Material:\n${relatedContext}`
      : relatedContext;
  } catch (error) {
    console.error("Error fetching AI context:", error);
    return getFallbackContext();
  }
}

module.exports = {
  getBasicContext,
  getCourseSpecificContext,
};
