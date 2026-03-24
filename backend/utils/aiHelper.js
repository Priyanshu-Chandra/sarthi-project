function extractJSON(rawText = "") {
  if (!rawText || typeof rawText !== "string") {
    return [];
  }

  const cleanedText = rawText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleanedText);
    return Array.isArray(parsed) ? parsed : parsed?.questions || [];
  } catch (error) {
    const arrayMatch = cleanedText.match(/\[[\s\S]*\]/);

    if (!arrayMatch) {
      try {
        const objectMatch = cleanedText.match(/\{[\s\S]*\}/);

        if (!objectMatch) {
          console.warn("Could not extract JSON payload from AI response");
          return [];
        }

        const parsedObject = JSON.parse(objectMatch[0]);
        return Array.isArray(parsedObject) ? parsedObject : parsedObject?.questions || [];
      } catch (objectParseError) {
        console.warn("Could not extract JSON payload from AI response", objectParseError);
        return [];
      }
    }

    try {
      return JSON.parse(arrayMatch[0]);
    } catch (parseError) {
      console.warn("Could not parse extracted AI JSON", parseError);
      return [];
    }
  }
}

function fixQuestions(questions) {
  if (!Array.isArray(questions)) {
    console.warn("Discarding AI questions: payload is not an array");
    return [];
  }

  return questions.reduce((validQuestions, question, index) => {
    const normalizedCorrectAnswer = Number(question?.correctAnswer);
    const hasFourOptions =
      Array.isArray(question?.options) && question.options.length === 4;
    const hasValidCorrectAnswer =
      Number.isInteger(normalizedCorrectAnswer) &&
      normalizedCorrectAnswer >= 0 &&
      normalizedCorrectAnswer <= 3;
    const hasQuestionText = typeof question?.question === "string" && question.question.trim().length > 0;
    const hasValidOptions =
      hasFourOptions &&
      question.options.every(
        (option) => typeof option === "string" && option.trim().length > 0
      );

    if (!hasQuestionText || !hasValidOptions || !hasValidCorrectAnswer) {
      console.warn("Discarding invalid AI question", {
        index,
        reason: {
          hasFourOptions,
          hasQuestionText,
          hasValidOptions,
          hasValidCorrectAnswer,
        },
      });
      return validQuestions;
    }

    validQuestions.push({
      question: question.question.trim(),
      options: question.options.map((option) => option.trim()),
      correctAnswer: normalizedCorrectAnswer,
    });

    return validQuestions;
  }, []);
}

module.exports = {
  extractJSON,
  fixQuestions,
};
