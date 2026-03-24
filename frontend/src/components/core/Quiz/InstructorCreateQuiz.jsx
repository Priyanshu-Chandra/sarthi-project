import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";

import {
  createQuiz,
  generateQuizAI,
  fetchTestsByCourse,
  deleteTest,
} from "../../../services/operations/quizAPI";

const getEmptyQuestion = () => ({
  question: "",
  options: ["", "", "", ""],
  correctAnswer: 0,
});

const normalizeQuestions = (questions = []) =>
  questions.map((question) => ({
    question: question?.question || "",
    options:
      Array.isArray(question?.options) && question.options.length === 4
        ? question.options
        : ["", "", "", ""],
    correctAnswer:
      typeof question?.correctAnswer === "number" ? question.correctAnswer : 0,
  }));

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m`;
  }
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
};

export default function InstructorCreateQuiz({ courseId }) {
  const { token } = useSelector((state) => state.auth);
  const { course } = useSelector((state) => state.course);
  const courseSections = course?.courseContent || [];

  const [title, setTitle] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [questions, setQuestions] = useState([]);
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(10);
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [loadingAI, setLoadingAI] = useState(false);
  const [savingTest, setSavingTest] = useState(false);

  // Existing tests for this course
  const [existingTests, setExistingTests] = useState([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Fetch existing tests on mount and after changes
  const refreshTests = async () => {
    if (!courseId) return;
    setLoadingTests(true);
    try {
      const res = await fetchTestsByCourse(courseId, token);
      if (res?.tests) {
        setExistingTests(res.tests);
      }
    } catch (err) {
      console.log("Failed to fetch tests", err);
    } finally {
      setLoadingTests(false);
    }
  };

  useEffect(() => {
    refreshTests();
  }, [courseId, token]);

  const handleGenerateAI = async () => {
    if (!topic.trim()) {
      toast.error("Enter a topic first");
      return;
    }

    try {
      setLoadingAI(true);

      const result = await generateQuizAI(
        { topic: topic.trim(), count: Number(count) || 5 },
        token
      );
      const generatedQuestions = normalizeQuestions(result?.questions || []);

      if (!generatedQuestions.length) {
        toast.error("AI did not return valid test questions");
        return;
      }

      setQuestions(generatedQuestions);

      if (!title.trim()) {
        setTitle(`${topic.trim()} Test`);
      }

      toast.success(`Generated ${generatedQuestions.length} test questions`);
    } catch (error) {
      toast.error(
        error?.response?.data?.error || "AI test generation failed"
      );
    } finally {
      setLoadingAI(false);
    }
  };

  const addQuestion = () => {
    setQuestions((prevQuestions) => [...prevQuestions, getEmptyQuestion()]);
  };

  const removeQuestion = (indexToRemove) => {
    setQuestions((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleQuestionChange = (questionIndex, value) => {
    setQuestions((prevQuestions) =>
      prevQuestions.map((question, index) =>
        index === questionIndex ? { ...question, question: value } : question
      )
    );
  };

  const handleOptionChange = (questionIndex, optionIndex, value) => {
    setQuestions((prevQuestions) =>
      prevQuestions.map((question, index) => {
        if (index !== questionIndex) {
          return question;
        }

        const updatedOptions = [...question.options];
        updatedOptions[optionIndex] = value;

        return {
          ...question,
          options: updatedOptions,
        };
      })
    );
  };

  const handleCorrectAnswer = (questionIndex, value) => {
    setQuestions((prevQuestions) =>
      prevQuestions.map((question, index) =>
        index === questionIndex
          ? { ...question, correctAnswer: Number(value) }
          : question
      )
    );
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();

    if (!courseId) {
      toast.error("Course id is missing");
      return;
    }

    if (!trimmedTitle) {
      toast.error("Test title is required");
      return;
    }

    if (!sectionId) {
      toast.error("Please select a course section for this test");
      return;
    }

    if (!questions.length) {
      toast.error("Add at least one question before saving");
      return;
    }

    const hasInvalidQuestion = questions.some(
      (question) =>
        !question.question?.trim() ||
        !Array.isArray(question.options) ||
        question.options.length !== 4 ||
        question.options.some((option) => !option?.trim()) ||
        !Number.isInteger(question.correctAnswer) ||
        question.correctAnswer < 0 ||
        question.correctAnswer > 3
    );

    if (hasInvalidQuestion) {
      toast.error("Each question needs 4 filled options and one correct answer");
      return;
    }

    const timeLimitSecs = Math.max(Math.round(timeLimitMinutes * 60), 60);
    const attempts = Math.max(Math.round(maxAttempts), 1);

    try {
      setSavingTest(true);

      const testData = {
        title: trimmedTitle,
        courseId,
        sectionId,
        timeLimitSeconds: timeLimitSecs,
        maxAttempts: attempts,
        questions: questions.map((question) => ({
          question: question.question.trim(),
          options: question.options.map((option) => option.trim()),
          correctAnswer: question.correctAnswer,
        })),
      };

      await createQuiz(testData, token);

      toast.success("Test created successfully");
      setTitle("");
      setTopic("");
      setCount(5);
      setTimeLimitMinutes(10);
      setMaxAttempts(2);
      setQuestions([]);

      // Refresh the test list
      await refreshTests();
    } catch (error) {
      toast.error(
        error?.response?.data?.error || "Failed to save the test"
      );
    } finally {
      setSavingTest(false);
    }
  };

  const handleDeleteTest = async (testId) => {
    if (!window.confirm("Are you sure you want to delete this test? All student results will also be deleted.")) {
      return;
    }

    try {
      setDeletingId(testId);
      await deleteTest(testId, token);
      toast.success("Test deleted successfully");
      await refreshTests();
    } catch (error) {
      toast.error(
        error?.response?.data?.error || "Failed to delete the test"
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6 text-white">
      <h2 className="mb-4 text-2xl font-bold">Create Test</h2>

      {/* ── Existing Tests List ──────────────────────────────────────── */}
      {(existingTests.length > 0 || loadingTests) && (
        <div className="mb-6 rounded-xl border border-richblack-600 bg-richblack-700 p-4">
          <h3 className="mb-3 text-lg font-semibold text-yellow-50">
            Existing Tests for this Course
          </h3>

          {loadingTests ? (
            <p className="text-sm text-richblack-300">Loading tests…</p>
          ) : (
            <div className="flex flex-col gap-3">
              {existingTests.map((t) => (
                <div
                  key={t._id}
                  className="flex items-center justify-between rounded-lg bg-richblack-800 px-4 py-3 border border-richblack-600"
                >
                  <div className="flex flex-col gap-1">
                    <p className="font-semibold text-richblack-5">{t.title}</p>
                    <p className="text-xs text-richblack-200">
                      Section: {courseSections.find(s => s._id === t.sectionId)?.sectionName || "Unknown"}
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs text-richblack-300">
                      <span>📝 {t.questionCount} questions</span>
                      <span>⏱ {formatTime(t.timeLimitSeconds)}</span>
                      <span>🔄 {t.maxAttempts} attempts</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteTest(t._id)}
                    disabled={deletingId === t._id}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white
                               hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed
                               transition-colors duration-150"
                  >
                    {deletingId === t._id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Title ──────────────────────────────────────────────────── */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Test Title"
          className="w-full rounded-lg p-2 text-black"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      {/* ── Select Section ─────────────────────────────────────────── */}
      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-richblack-100">
          Course Section <sup className="text-pink-200">*</sup>
        </label>
        <select
          className="w-full rounded-lg p-2 text-black"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
        >
          <option value="" disabled>Select a section for this test</option>
          {courseSections.map((sec) => (
            <option key={sec._id} value={sec._id}>
              {sec.sectionName}
            </option>
          ))}
        </select>
      </div>

      {/* ── Time Limit & Max Attempts ────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm text-richblack-200">
            Time Limit (minutes)
          </label>
          <input
            type="number"
            min="1"
            max="180"
            className="w-full rounded-lg p-2 text-black"
            value={timeLimitMinutes}
            onChange={(e) => setTimeLimitMinutes(Number(e.target.value) || 10)}
          />
          <p className="mt-1 text-xs text-richblack-400">Default: 10 minutes</p>
        </div>
        <div>
          <label className="mb-1 block text-sm text-richblack-200">
            Max Attempts
          </label>
          <input
            type="number"
            min="1"
            max="10"
            className="w-full rounded-lg p-2 text-black"
            value={maxAttempts}
            onChange={(e) => setMaxAttempts(Number(e.target.value) || 2)}
          />
          <p className="mt-1 text-xs text-richblack-400">Default: 2 attempts</p>
        </div>
      </div>

      {/* ── AI Generation ────────────────────────────────────────── */}
      <div className="mb-6 rounded-xl bg-richblack-800 p-4 border border-richblack-600">
        <h3 className="mb-3 font-semibold">Generate Test Questions with AI</h3>

        <input
          type="text"
          placeholder="Topic (for example: React Hooks)"
          className="mb-2 w-full rounded-lg p-2 text-black"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
        />

        <input
          type="number"
          min="1"
          max="50"
          placeholder="Number of Questions"
          className="mb-3 w-full rounded-lg p-2 text-black"
          value={count}
          onChange={(event) => setCount(event.target.value)}
        />

        <button
          onClick={handleGenerateAI}
          disabled={loadingAI}
          className="rounded-lg bg-green-500 px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-70
                     hover:bg-green-600 transition-colors duration-150"
        >
          {loadingAI ? "Generating..." : "Generate Questions"}
        </button>
      </div>

      {/* ── Add Manual Question ───────────────────────────────────── */}
      <div className="mb-4 flex items-center justify-between">
        <button
          className="rounded-lg bg-yellow-400 px-4 py-2 font-medium text-black hover:bg-yellow-300 transition-colors duration-150"
          onClick={addQuestion}
        >
          Add Question Manually
        </button>

        <p className="text-sm text-richblack-200">
          {questions.length} question{questions.length === 1 ? "" : "s"} ready
        </p>
      </div>

      {/* ── Questions Editor ──────────────────────────────────────── */}
      {questions.map((question, questionIndex) => (
        <div key={questionIndex} className="mt-6 rounded-xl border border-richblack-600 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold">Question {questionIndex + 1}</p>
            <button
              onClick={() => removeQuestion(questionIndex)}
              className="text-sm text-red-400 hover:text-red-300 transition-colors duration-150"
            >
              Remove
            </button>
          </div>

          <input
            type="text"
            placeholder="Question"
            className="w-full rounded-lg p-2 text-black"
            value={question.question}
            onChange={(event) =>
              handleQuestionChange(questionIndex, event.target.value)
            }
          />

          {question.options.map((option, optionIndex) => (
            <input
              key={optionIndex}
              type="text"
              placeholder={`Option ${optionIndex + 1}`}
              className="mt-2 block w-full rounded-lg p-2 text-black"
              value={option}
              onChange={(event) =>
                handleOptionChange(
                  questionIndex,
                  optionIndex,
                  event.target.value
                )
              }
            />
          ))}

          <select
            className="mt-2 rounded-lg p-1 text-black"
            value={question.correctAnswer}
            onChange={(event) =>
              handleCorrectAnswer(questionIndex, event.target.value)
            }
          >
            <option value={0}>Correct: Option 1</option>
            <option value={1}>Correct: Option 2</option>
            <option value={2}>Correct: Option 3</option>
            <option value={3}>Correct: Option 4</option>
          </select>
        </div>
      ))}

      {/* ── Save Button ──────────────────────────────────────────── */}
      {questions.length > 0 && (
        <button
          onClick={handleSubmit}
          disabled={savingTest}
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold
                     hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70
                     transition-colors duration-150"
        >
          {savingTest ? "Saving..." : "Save Test"}
        </button>
      )}
    </div>
  );
}
