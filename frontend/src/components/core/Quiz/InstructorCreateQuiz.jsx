import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";

import {
  createQuiz,
  generateQuizAI,
  fetchTestsByCourse,
  deleteTest,
} from "../../../services/operations/quizAPI";
import { getAllProblems } from "../../../services/operations/problemApi";

const getEmptyMCQQuestion = () => ({
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

const DIFFICULTY_COLORS = {
  Easy: "text-caribbeangreen-300 bg-caribbeangreen-900/30 border-caribbeangreen-700",
  Medium: "text-yellow-300 bg-yellow-900/30 border-yellow-700",
  Hard: "text-pink-300 bg-pink-900/30 border-pink-700",
};

export default function InstructorCreateQuiz({ courseId }) {
  const { token } = useSelector((state) => state.auth);
  const { course } = useSelector((state) => state.course);
  const courseSections = course?.courseContent || [];
  const courseCategoryName = course?.category?.name || "";

  // Test config
  const [title, setTitle] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [testType, setTestType] = useState("MCQ");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(10);
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [savingTest, setSavingTest] = useState(false);

  // MCQ state
  const [questions, setQuestions] = useState([]);
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(10);
  const [loadingAI, setLoadingAI] = useState(false);

  // Coding state
  const [problems, setProblems] = useState([]);
  const [selectedProblems, setSelectedProblems] = useState([]);
  const [loadingProblems, setLoadingProblems] = useState(false);
  const [problemSearch, setProblemSearch] = useState("");

  // Existing tests
  const [existingTests, setExistingTests] = useState([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const refreshTests = async () => {
    if (!courseId) return;
    setLoadingTests(true);
    try {
      const res = await fetchTestsByCourse(courseId, token);
      if (res?.tests) setExistingTests(res.tests);
    } catch (err) {
      console.log("Failed to fetch tests", err);
    } finally {
      setLoadingTests(false);
    }
  };

  useEffect(() => {
    refreshTests();
  }, [courseId, token]);

  // Fetch problems when switching to CODING mode
  useEffect(() => {
    if (testType !== "CODING") return;
    const fetchProblems = async () => {
      setLoadingProblems(true);
      try {
        const res = await getAllProblems(token, { limit: 200 });
        console.log("DEBUG: All Problems Response:", res);
        
        // Handle potential nesting: res.data might be the array, or res might be the array, or res.problems
        const problemsList = Array.isArray(res) ? res : (res?.data || res?.problems || []);
        console.log("DEBUG: Final Problems List:", problemsList);
        
        setProblems(Array.isArray(problemsList) ? problemsList : []);
      } catch (err) {
        console.log("Failed to fetch problems", err);
      } finally {
        setLoadingProblems(false);
      }
    };
    fetchProblems();
  }, [testType, token]);

  // ── MCQ Handlers ────────────────────────────────────────────────
  const handleGenerateAI = async () => {
    if (!topic.trim()) { toast.error("Enter a topic first"); return; }
  
    // Note: Topics like "Two Pointers", "Valid Anagram" are subtopics within a course category
    // like "Data Structures". The backend accepts any topic - no strict matching required.
  
    try {
      setLoadingAI(true);
      const result = await generateQuizAI({ topic: topic.trim(), count: Number(count) || 10 }, token);
      const generatedQuestions = normalizeQuestions(result?.questions || []);
      if (!generatedQuestions.length) { toast.error("AI did not return valid questions"); return; }
      setQuestions(generatedQuestions);
      if (!title.trim()) setTitle(`${topic.trim()} Test`);
      toast.success(`Generated ${generatedQuestions.length} questions`);
    } catch (error) {
      toast.error(error?.response?.data?.error || "AI generation failed");
    } finally {
      setLoadingAI(false);
    }
  };

  const addMCQQuestion = () => {
    if (questions.length >= 50) {
      toast.error("Maximum 50 MCQ questions allowed per test");
      return;
    }
    setQuestions((prev) => [...prev, getEmptyMCQQuestion()]);
  };
  const removeMCQQuestion = (i) => setQuestions((prev) => prev.filter((_, idx) => idx !== i));

  const handleQuestionChange = (qi, value) =>
    setQuestions((prev) => prev.map((q, i) => (i === qi ? { ...q, question: value } : q)));

  const handleOptionChange = (qi, oi, value) =>
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qi) return q;
        const opts = [...q.options];
        opts[oi] = value;
        return { ...q, options: opts };
      })
    );

  const handleCorrectAnswer = (qi, value) =>
    setQuestions((prev) =>
      prev.map((q, i) => (i === qi ? { ...q, correctAnswer: Number(value) } : q))
    );

  // ── Coding Handlers ──────────────────────────────────────────────
  const toggleProblem = (problem) => {
    const alreadySelected = selectedProblems.find((p) => p._id === problem._id);
    if (alreadySelected) {
      setSelectedProblems((prev) => prev.filter((p) => p._id !== problem._id));
    } else {
      if (selectedProblems.length >= 5) {
        toast.error("Maximum 5 coding problems allowed per test");
        return;
      }
      setSelectedProblems((prev) => [...prev, problem]);
    }
  };

  // ── Reset state on type switch ───────────────────────────────────
  const handleTestTypeChange = (type) => {
    setTestType(type);
    setQuestions([]);
    setSelectedProblems([]);
  };

  // ── Submit ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!courseId)    { toast.error("Course ID is missing"); return; }
    if (!trimmedTitle){ toast.error("Test title is required"); return; }
    if (!sectionId)   { toast.error("Select a course section for this test"); return; }

    if (testType === "MCQ") {
      if (questions.length < 5 || questions.length > 50) {
        toast.error("MCQ test must contain between 5 and 50 questions");
        return;
      }
      const hasInvalidQuestion = questions.some(
        (q) =>
          !q.question?.trim() ||
          !Array.isArray(q.options) ||
          q.options.length !== 4 ||
          q.options.some((o) => !o?.trim()) ||
          !Number.isInteger(q.correctAnswer) ||
          q.correctAnswer < 0 ||
          q.correctAnswer > 3
      );
      if (hasInvalidQuestion) {
        toast.error("Each question needs 4 filled options and one correct answer");
        return;
      }
    }

    if (testType === "CODING") {
      if (selectedProblems.length < 1 || selectedProblems.length > 5) {
        toast.error("Coding test must contain between 1 and 5 problems");
        return;
      }
    }

    const timeLimitSecs = Math.max(Math.round(timeLimitMinutes * 60), 60);
    const attempts = Math.max(Math.round(maxAttempts), 1);

    try {
      setSavingTest(true);

      let questionsPayload;
      if (testType === "MCQ") {
        questionsPayload = questions.map((q) => ({
          question: q.question.trim(),
          options: q.options.map((o) => o.trim()),
          correctAnswer: q.correctAnswer,
        }));
      } else {
        questionsPayload = selectedProblems.map((p) => ({
          problemId: p._id,
        }));
      }

      const testData = {
        title: trimmedTitle,
        courseId,
        sectionId,
        testType,
        timeLimitSeconds: timeLimitSecs,
        maxAttempts: attempts,
        passingScore: 50, // Default 50% passing threshold
        questions: questionsPayload,
      };

      await createQuiz(testData, token);
      toast.success("Test created successfully!");

      // Reset form
      setTitle("");
      setTopic("");
      setCount(10);
      setTimeLimitMinutes(10);
      setMaxAttempts(2);
      setQuestions([]);
      setSelectedProblems([]);
      setProblemSearch("");

      await refreshTests();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to save the test");
    } finally {
      setSavingTest(false);
    }
  };

  const handleDeleteTest = async (testId) => {
    if (!window.confirm("Delete this test? All student results will also be deleted.")) return;
    try {
      setDeletingId(testId);
      await deleteTest(testId, token);
      toast.success("Test deleted successfully");
      await refreshTests();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to delete the test");
    } finally {
      setDeletingId(null);
    }
  };

  // ── Filtered Problems ─────────────────────────────────────────────
  // Show all problems, but filter by search text if provided
  const filteredProblems = problems.filter((p) => {
    if (!problemSearch.trim()) return true;
    const search = problemSearch.toLowerCase();
    return (
      p.title?.toLowerCase().includes(search) ||
      p.topic?.toLowerCase().includes(search)
    );
  });

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl p-6 text-white">
      <h2 className="mb-1 text-2xl font-bold">Create Test</h2>
      <p className="mb-6 text-sm text-richblack-300">
        Build an MCQ or coding assessment for your students.
      </p>

      {/* ── Existing Tests List ────────────────────────────────── */}
      {(existingTests.length > 0 || loadingTests) && (
        <div className="mb-8 rounded-xl border border-richblack-600 bg-richblack-700 p-4">
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
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-richblack-5">{t.title}</p>
                      {t.testType && (
                        <span className={`rounded px-2 py-0.5 text-xs font-bold border ${
                          t.testType === "CODING"
                            ? "bg-blue-900/40 text-blue-300 border-blue-700"
                            : "bg-purple-900/40 text-purple-300 border-purple-700"
                        }`}>
                          {t.testType}
                        </span>
                      )}
                      {t.isLegacy && (
                        <span className="rounded px-2 py-0.5 text-xs text-richblack-400 border border-richblack-600">
                          Legacy
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-richblack-200">
                      Section: {courseSections.find((s) => s._id === t.sectionId)?.sectionName || "Unknown"}
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
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {deletingId === t._id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Test Type Selector ─────────────────────────────────── */}
      <div className="mb-6 rounded-xl border border-richblack-600 bg-richblack-800 p-4">
        <h3 className="mb-3 font-semibold text-richblack-100">Test Type <sup className="text-pink-200">*</sup></h3>
        <div className="flex gap-4">
          {[
            { value: "MCQ", label: "📝 MCQ Test", desc: "5–50 multiple-choice questions" },
            { value: "CODING", label: "💻 Coding Test", desc: "1–5 coding problems" },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex flex-1 cursor-pointer flex-col gap-1 rounded-lg border-2 p-4 transition-all ${
                testType === opt.value
                  ? "border-yellow-500 bg-yellow-500/10"
                  : "border-richblack-600 bg-richblack-700 hover:border-richblack-400"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="testType"
                  value={opt.value}
                  checked={testType === opt.value}
                  onChange={() => handleTestTypeChange(opt.value)}
                  className="accent-yellow-500"
                />
                <span className="font-semibold">{opt.label}</span>
              </div>
              <p className="ml-5 text-xs text-richblack-300">{opt.desc}</p>
            </label>
          ))}
        </div>
      </div>

      {/* ── Title ─────────────────────────────────────────────── */}
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-richblack-100">
          Test Title <sup className="text-pink-200">*</sup>
        </label>
        <input
          type="text"
          placeholder="e.g. React Fundamentals Quiz"
          className="w-full rounded-lg p-2 text-black"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* ── Select Section ────────────────────────────────────── */}
      <div className="mb-4">
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
            <option key={sec._id} value={sec._id}>{sec.sectionName}</option>
          ))}
        </select>
      </div>

      {/* ── Time Limit & Max Attempts ──────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm text-richblack-200">Time Limit (minutes)</label>
          <input
            type="number" min="1" max="180"
            className="w-full rounded-lg p-2 text-black"
            value={timeLimitMinutes}
            onChange={(e) => setTimeLimitMinutes(Number(e.target.value) || 10)}
          />
          <p className="mt-1 text-xs text-richblack-400">Default: 10 minutes</p>
        </div>
        <div>
          <label className="mb-1 block text-sm text-richblack-200">Max Attempts</label>
          <input
            type="number" min="1" max="10"
            className="w-full rounded-lg p-2 text-black"
            value={maxAttempts}
            onChange={(e) => setMaxAttempts(Number(e.target.value) || 2)}
          />
          <p className="mt-1 text-xs text-richblack-400">Default: 2 attempts</p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* MCQ Test Builder                                       */}
      {/* ══════════════════════════════════════════════════════ */}
      {testType === "MCQ" && (
        <>
          {/* AI Generation Block */}
          <div className="mb-6 rounded-xl bg-richblack-800 p-4 border border-richblack-600">
            <h3 className="mb-3 font-semibold">🤖 Generate with AI</h3>
            <input
              type="text"
              placeholder="Topic (e.g. Two Pointers, Valid Anagram, Arrays)"
              className="mb-1 w-full rounded-lg p-2 text-black"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <p className="mb-2 text-xs text-richblack-400">
              ℹ️ Enter any topic name (e.g. Arrays, DP, SQL) — it will be saved with the questions
            </p>
            <input
              type="number" min="5" max="50"
              placeholder="Number of questions (5–50)"
              className="mb-3 w-full rounded-lg p-2 text-black"
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
            <button
              onClick={handleGenerateAI}
              disabled={loadingAI}
              className="rounded-lg bg-green-500 px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-70 hover:bg-green-600 transition-colors"
            >
              {loadingAI ? "Generating..." : "Generate Questions"}
            </button>
          </div>

          {/* Manual Question Add */}
          <div className="mb-4 flex items-center justify-between">
            <button
              className="rounded-lg bg-yellow-400 px-4 py-2 font-medium text-black hover:bg-yellow-300 transition-colors"
              onClick={addMCQQuestion}
            >
              + Add Question Manually
            </button>
            <p className="text-sm text-richblack-200">
              {questions.length}/50 questions
              {questions.length > 0 && questions.length < 5 && (
                <span className="ml-2 text-pink-400">(minimum 5)</span>
              )}
            </p>
          </div>

          {/* Questions Editor */}
          {questions.map((q, qi) => (
            <div key={qi} className="mt-4 rounded-xl border border-richblack-600 bg-richblack-800 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold text-richblack-5">Question {qi + 1}</p>
                <button
                  onClick={() => removeMCQQuestion(qi)}
                  className="text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove
                </button>
              </div>
              <input
                type="text"
                placeholder="Question text"
                className="w-full rounded-lg p-2 text-black"
                value={q.question}
                onChange={(e) => handleQuestionChange(qi, e.target.value)}
              />
              {q.options.map((opt, oi) => (
                <input
                  key={oi}
                  type="text"
                  placeholder={`Option ${oi + 1}`}
                  className="mt-2 block w-full rounded-lg p-2 text-black"
                  value={opt}
                  onChange={(e) => handleOptionChange(qi, oi, e.target.value)}
                />
              ))}
              <select
                className="mt-2 rounded-lg p-1 text-black"
                value={q.correctAnswer}
                onChange={(e) => handleCorrectAnswer(qi, e.target.value)}
              >
                <option value={0}>✅ Correct: Option 1</option>
                <option value={1}>✅ Correct: Option 2</option>
                <option value={2}>✅ Correct: Option 3</option>
                <option value={3}>✅ Correct: Option 4</option>
              </select>
            </div>
          ))}
        </>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* Coding Test Builder                                    */}
      {/* ══════════════════════════════════════════════════════ */}
      {testType === "CODING" && (
        <div className="mb-6 rounded-xl border border-richblack-600 bg-richblack-800 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">💻 Select Coding Problems</h3>
            <p className="text-sm text-richblack-300">
              {selectedProblems.length}/5 selected
            </p>
          </div>

          {/* Selected problems summary */}
          {selectedProblems.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {selectedProblems.map((p) => (
                <span
                  key={p._id}
                  className="flex items-center gap-1 rounded-full bg-blue-800 px-3 py-1 text-sm border border-blue-600"
                >
                  {p.title}
                  <button
                    onClick={() => toggleProblem(p)}
                    className="ml-1 text-blue-300 hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Problem search */}
          <input
            type="text"
            placeholder="Search problems by title or topic..."
            className="mb-3 w-full rounded-lg p-2 text-black"
            value={problemSearch}
            onChange={(e) => setProblemSearch(e.target.value)}
          />

          {/* Course category hint */}
          <p className="mb-3 text-xs text-richblack-400">
            ℹ️ All available problems are shown and can be added to the test.
          </p>

          {/* Problems list */}
          {loadingProblems ? (
            <p className="text-sm text-richblack-300">Loading problems…</p>
          ) : filteredProblems.length === 0 ? (
            <p className="text-sm text-richblack-400">No problems found.</p>
          ) : (
            <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
              {filteredProblems.map((p) => {
                const selected = !!selectedProblems.find((s) => s._id === p._id);
                return (
                  <button
                    key={p._id}
                    onClick={() => toggleProblem(p)}
                    className={`flex items-center justify-between rounded-lg border px-4 py-2 text-left text-sm transition-all ${
                      selected
                        ? "border-blue-500 bg-blue-900/50"
                        : "border-richblack-600 bg-richblack-700 hover:border-richblack-400"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold rounded border px-1.5 py-0.5 ${DIFFICULTY_COLORS[p.difficulty] || ""}`}>
                        {p.difficulty}
                      </span>
                      <span className={selected ? "text-white" : "text-richblack-100"}>{p.title}</span>
                    </div>
                    <span className="text-xs text-richblack-400">{p.topic}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Save Button ─────────────────────────────────────── */}
      {(testType === "MCQ" ? questions.length >= 5 : selectedProblems.length >= 1) && (
        <button
          onClick={handleSubmit}
          disabled={savingTest}
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 transition-colors"
        >
          {savingTest ? "Saving..." : `Save ${testType === "MCQ" ? "MCQ" : "Coding"} Test`}
        </button>
      )}
    </div>
  );
}
